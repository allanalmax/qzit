import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { QuizService } from './quiz.service';
import { QuizStore, QUIZ_STORE } from './quiz.store';
import { QuizMode, QuizState } from './domain/quiz-state.enum';
import type { CreateQuizDto } from './dto/create-quiz.dto';
import type { JoinQuizDto } from './dto/join-quiz.dto';

// ── Fixture helpers ───────────────────────────────────────────────────────────

function makeCreateDto(overrides: Partial<CreateQuizDto> = {}): CreateQuizDto {
  return {
    title: 'Test Quiz',
    mode: QuizMode.INDIVIDUAL,
    rounds: [
      {
        title: 'Round 1',
        questions: [
          { text: 'Q1', options: ['A', 'B', 'C', 'D'], correctOptionIndex: 0 },
          { text: 'Q2', options: ['A', 'B', 'C', 'D'], correctOptionIndex: 2 },
        ],
      },
    ],
    ...overrides,
  } as CreateQuizDto;
}

function makeTeamDto(): CreateQuizDto {
  return makeCreateDto({ mode: QuizMode.TEAM });
}

function joinDto(
  joinCode: string,
  name: string,
  teamName?: string,
): JoinQuizDto {
  return { joinCode, name, teamName } as JoinQuizDto;
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe('QuizService', () => {
  let service: QuizService;
  let store: QuizStore;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuizService,
        QuizStore,
        { provide: QUIZ_STORE, useExisting: QuizStore },
      ],
    }).compile();

    service = module.get<QuizService>(QuizService);
    store = module.get<QuizStore>(QuizStore);
  });

  // ── createQuiz ──────────────────────────────────────────────────────────────

  describe('createQuiz', () => {
    it('returns the expected shape', () => {
      const result = service.createQuiz(makeCreateDto());

      expect(result.id).toBeDefined();
      expect(result.title).toBe('Test Quiz');
      expect(result.mode).toBe(QuizMode.INDIVIDUAL);
      expect(result.state).toBe(QuizState.CREATED);
      expect(result.hostCode).toHaveLength(6);
      expect(result.joinCode).toHaveLength(6);
      expect(result.rounds).toHaveLength(1);
      expect(result.rounds[0].questions).toHaveLength(2);
    });

    it('assigns UUIDs to rounds and questions', () => {
      const result = service.createQuiz(makeCreateDto());

      expect(result.rounds[0].id).toBeDefined();
      expect(result.rounds[0].questions[0].id).toBeDefined();
    });

    it('defaults timeLimitSeconds to 30 when not provided', () => {
      const result = service.createQuiz(makeCreateDto());

      expect(result.rounds[0].questions[0].timeLimitSeconds).toBe(30);
    });

    it('throws BadRequestException when correctOptionIndex is out of range', () => {
      const dto = makeCreateDto();
      dto.rounds[0].questions[0].correctOptionIndex = 99;

      expect(() => service.createQuiz(dto)).toThrow(BadRequestException);
    });

    it('generates unique codes across multiple quizzes', () => {
      const a = service.createQuiz(makeCreateDto());
      const b = service.createQuiz(makeCreateDto());

      expect(a.joinCode).not.toBe(b.joinCode);
      expect(a.hostCode).not.toBe(b.hostCode);
    });
  });

  // ── lookupByJoinCode ────────────────────────────────────────────────────────

  describe('lookupByJoinCode', () => {
    it('returns participant-safe quiz info', () => {
      const created = service.createQuiz(makeCreateDto());
      const result = service.lookupByJoinCode(created.joinCode);

      expect(result.quizId).toBe(created.id);
      expect(result.title).toBe('Test Quiz');
      expect(result.mode).toBe(QuizMode.INDIVIDUAL);
      expect(result.teams).toEqual([]);
      expect(result).not.toHaveProperty('hostCode');
    });

    it('is case-insensitive', () => {
      const created = service.createQuiz(makeCreateDto());
      const result = service.lookupByJoinCode(created.joinCode.toLowerCase());

      expect(result.quizId).toBe(created.id);
    });

    it('throws NotFoundException for unknown join code', () => {
      expect(() => service.lookupByJoinCode('XXXXXX')).toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException for ended quiz', () => {
      const created = service.createQuiz(makeCreateDto());
      const quiz = store.findById(created.id)!;
      quiz.state = QuizState.ENDED;
      store.update(quiz);

      expect(() => service.lookupByJoinCode(created.joinCode)).toThrow(
        BadRequestException,
      );
    });

    it('returns teams for a team quiz', () => {
      const created = service.createQuiz(makeTeamDto());
      service.joinQuiz(joinDto(created.joinCode, 'Alice', 'Alpha'));

      const result = service.lookupByJoinCode(created.joinCode);

      expect(result.teams).toHaveLength(1);
      expect(result.teams[0].name).toBe('Alpha');
      expect(result.teams[0].memberCount).toBe(1);
    });
  });

  // ── joinQuiz ────────────────────────────────────────────────────────────────

  describe('joinQuiz', () => {
    it('returns the correct shape for individual mode', () => {
      const created = service.createQuiz(makeCreateDto());
      const result = service.joinQuiz(joinDto(created.joinCode, 'Alice'));

      expect(result.quizId).toBe(created.id);
      expect(result.participantName).toBe('Alice');
      expect(result.participantId).toBeDefined();
      expect(result.mode).toBe(QuizMode.INDIVIDUAL);
      expect(result.teamId).toBeNull();
      expect(result.isCaptain).toBe(false);
    });

    it('throws NotFoundException for invalid join code', () => {
      expect(() => service.joinQuiz(joinDto('XXXXXX', 'Alice'))).toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException for ended quiz', () => {
      const created = service.createQuiz(makeCreateDto());
      const quiz = store.findById(created.id)!;
      quiz.state = QuizState.ENDED;
      store.update(quiz);

      expect(() =>
        service.joinQuiz(joinDto(created.joinCode, 'Alice')),
      ).toThrow(BadRequestException);
    });

    describe('team mode', () => {
      it('throws BadRequestException when teamName is missing', () => {
        const created = service.createQuiz(makeTeamDto());

        expect(() =>
          service.joinQuiz(joinDto(created.joinCode, 'Alice')),
        ).toThrow(BadRequestException);
      });

      it('first joiner becomes team captain', () => {
        const created = service.createQuiz(makeTeamDto());
        const result = service.joinQuiz(
          joinDto(created.joinCode, 'Alice', 'Team A'),
        );

        expect(result.isCaptain).toBe(true);
        expect(result.teamId).toBeDefined();
      });

      it('second joiner with same team name is not captain', () => {
        const created = service.createQuiz(makeTeamDto());
        service.joinQuiz(joinDto(created.joinCode, 'Alice', 'Team A'));
        const result = service.joinQuiz(
          joinDto(created.joinCode, 'Bob', 'Team A'),
        );

        expect(result.isCaptain).toBe(false);
      });

      it('different team names create separate teams', () => {
        const created = service.createQuiz(makeTeamDto());
        const r1 = service.joinQuiz(
          joinDto(created.joinCode, 'Alice', 'Team A'),
        );
        const r2 = service.joinQuiz(joinDto(created.joinCode, 'Bob', 'Team B'));

        expect(r1.teamId).not.toBe(r2.teamId);
        expect(r1.isCaptain).toBe(true);
        expect(r2.isCaptain).toBe(true);
      });
    });
  });

  // ── connectHost ─────────────────────────────────────────────────────────────

  describe('connectHost', () => {
    it('returns snapshot for valid host code', () => {
      const created = service.createQuiz(makeCreateDto());
      const snapshot = service.connectHost(created.id, created.hostCode);

      expect(snapshot.quizId).toBe(created.id);
      expect(snapshot.state).toBe(QuizState.CREATED);
    });

    it('throws ForbiddenException for invalid host code', () => {
      const created = service.createQuiz(makeCreateDto());

      expect(() => service.connectHost(created.id, 'BADCOD')).toThrow(
        ForbiddenException,
      );
    });

    it('throws NotFoundException for unknown quizId', () => {
      expect(() => service.connectHost('no-such-id', 'ABCDEF')).toThrow(
        NotFoundException,
      );
    });
  });

  // ── State transitions ───────────────────────────────────────────────────────

  describe('state transitions', () => {
    function setupWaiting() {
      const created = service.createQuiz(makeCreateDto());
      const joined = service.joinQuiz(joinDto(created.joinCode, 'Alice'));
      service.startQuiz(created.id);
      return { quizId: created.id, participantId: joined.participantId };
    }

    function advanceThroughQuestion(quizId: string) {
      service.startQuestion(quizId);
      service.lockQuestion(quizId);
      service.revealAnswer(quizId);
      service.showLeaderboard(quizId);
    }

    it('startQuiz transitions CREATED → WAITING', () => {
      const created = service.createQuiz(makeCreateDto());
      const snapshot = service.startQuiz(created.id);

      expect(snapshot.state).toBe(QuizState.WAITING);
    });

    it('startQuiz throws NotFoundException for unknown quiz', () => {
      expect(() => service.startQuiz('bad-id')).toThrow(NotFoundException);
    });

    it('startQuestion transitions WAITING → QUESTION_ACTIVE', () => {
      const { quizId } = setupWaiting();
      const { snapshot, question } = service.startQuestion(quizId);

      expect(snapshot.state).toBe(QuizState.QUESTION_ACTIVE);
      expect(question.text).toBe('Q1');
    });

    it('startQuestion does not expose correctOptionIndex', () => {
      const { quizId } = setupWaiting();
      const { question } = service.startQuestion(quizId);

      expect(question.correctOptionIndex).toBeUndefined();
    });

    it('startQuestion advances to second question on second call', () => {
      const { quizId } = setupWaiting();
      advanceThroughQuestion(quizId);
      const { question } = service.startQuestion(quizId);

      expect(question.text).toBe('Q2');
    });

    it('startQuestion throws BadRequestException when all questions exhausted', () => {
      const { quizId } = setupWaiting();
      advanceThroughQuestion(quizId);
      advanceThroughQuestion(quizId);

      expect(() => service.startQuestion(quizId)).toThrow(BadRequestException);
    });

    it('lockQuestion transitions QUESTION_ACTIVE → QUESTION_LOCKED', () => {
      const { quizId } = setupWaiting();
      service.startQuestion(quizId);
      const snapshot = service.lockQuestion(quizId);

      expect(snapshot.state).toBe(QuizState.QUESTION_LOCKED);
    });

    it('revealAnswer transitions QUESTION_LOCKED → ANSWER_REVEALED and exposes correctOptionIndex', () => {
      const { quizId } = setupWaiting();
      service.startQuestion(quizId);
      service.lockQuestion(quizId);
      const { snapshot, question } = service.revealAnswer(quizId);

      expect(snapshot.state).toBe(QuizState.ANSWER_REVEALED);
      expect(question.correctOptionIndex).toBe(0);
    });

    it('showLeaderboard transitions ANSWER_REVEALED → LEADERBOARD', () => {
      const { quizId } = setupWaiting();
      service.startQuestion(quizId);
      service.lockQuestion(quizId);
      service.revealAnswer(quizId);
      const { snapshot } = service.showLeaderboard(quizId);

      expect(snapshot.state).toBe(QuizState.LEADERBOARD);
    });

    it('showLeaderboard reports hasNextQuestion correctly', () => {
      const { quizId } = setupWaiting();
      // After Q1 → still has Q2
      service.startQuestion(quizId);
      service.lockQuestion(quizId);
      service.revealAnswer(quizId);
      const { hasNextQuestion } = service.showLeaderboard(quizId);
      expect(hasNextQuestion).toBe(true);

      // After Q2 → no more questions
      service.startQuestion(quizId);
      service.lockQuestion(quizId);
      service.revealAnswer(quizId);
      const { hasNextQuestion: hasMore } = service.showLeaderboard(quizId);
      expect(hasMore).toBe(false);
    });

    it('endQuiz transitions LEADERBOARD → ENDED', () => {
      const { quizId } = setupWaiting();
      advanceThroughQuestion(quizId);
      advanceThroughQuestion(quizId);
      const { snapshot } = service.endQuiz(quizId);

      expect(snapshot.state).toBe(QuizState.ENDED);
    });
  });

  // ── submitAnswer ────────────────────────────────────────────────────────────

  describe('submitAnswer', () => {
    function setupAtActiveQuestion() {
      const created = service.createQuiz(makeCreateDto());
      const joined = service.joinQuiz(joinDto(created.joinCode, 'Alice'));
      service.startQuiz(created.id);
      service.startQuestion(created.id);
      return { quizId: created.id, participantId: joined.participantId };
    }

    it('accepts a valid answer and returns submission info', () => {
      const { quizId, participantId } = setupAtActiveQuestion();
      const result = service.submitAnswer({
        quizId,
        participantId,
        selectedOptionIndex: 0,
      });

      expect(result.questionId).toBeDefined();
      expect(result.submission.participantId).toBe(participantId);
      expect(result.submissionCount).toBe(1);
    });

    it('throws BadRequestException when state is not QUESTION_ACTIVE', () => {
      const created = service.createQuiz(makeCreateDto());
      const joined = service.joinQuiz(joinDto(created.joinCode, 'Alice'));
      service.startQuiz(created.id);

      expect(() =>
        service.submitAnswer({
          quizId: created.id,
          participantId: joined.participantId,
          selectedOptionIndex: 0,
        }),
      ).toThrow(BadRequestException);
    });

    it('throws ConflictException on duplicate submission', () => {
      const { quizId, participantId } = setupAtActiveQuestion();
      service.submitAnswer({ quizId, participantId, selectedOptionIndex: 0 });

      expect(() =>
        service.submitAnswer({ quizId, participantId, selectedOptionIndex: 1 }),
      ).toThrow(ConflictException);
    });

    it('throws BadRequestException for out-of-range selectedOptionIndex', () => {
      const { quizId, participantId } = setupAtActiveQuestion();

      expect(() =>
        service.submitAnswer({
          quizId,
          participantId,
          selectedOptionIndex: 99,
        }),
      ).toThrow(BadRequestException);
    });

    describe('team mode', () => {
      function setupTeamAtActiveQuestion() {
        const created = service.createQuiz(makeTeamDto());
        const captain = service.joinQuiz(
          joinDto(created.joinCode, 'Alice', 'Team A'),
        );
        const member = service.joinQuiz(
          joinDto(created.joinCode, 'Bob', 'Team A'),
        );
        service.startQuiz(created.id);
        service.startQuestion(created.id);
        return {
          quizId: created.id,
          captainId: captain.participantId,
          memberId: member.participantId,
        };
      }

      it('captain can submit', () => {
        const { quizId, captainId } = setupTeamAtActiveQuestion();
        const result = service.submitAnswer({
          quizId,
          participantId: captainId,
          selectedOptionIndex: 0,
        });

        expect(result.submissionCount).toBe(1);
      });

      it('non-captain throws ForbiddenException', () => {
        const { quizId, memberId } = setupTeamAtActiveQuestion();

        expect(() =>
          service.submitAnswer({
            quizId,
            participantId: memberId,
            selectedOptionIndex: 0,
          }),
        ).toThrow(ForbiddenException);
      });

      it('duplicate captain submission throws ConflictException', () => {
        const { quizId, captainId } = setupTeamAtActiveQuestion();
        service.submitAnswer({
          quizId,
          participantId: captainId,
          selectedOptionIndex: 0,
        });

        expect(() =>
          service.submitAnswer({
            quizId,
            participantId: captainId,
            selectedOptionIndex: 1,
          }),
        ).toThrow(ConflictException);
      });
    });
  });

  // ── Scoring ─────────────────────────────────────────────────────────────────

  describe('scoring', () => {
    it('awards +1 for correct answer', () => {
      const created = service.createQuiz(makeCreateDto()); // Q1 correct = 0
      const joined = service.joinQuiz(joinDto(created.joinCode, 'Alice'));
      service.startQuiz(created.id);
      service.startQuestion(created.id);
      service.submitAnswer({
        quizId: created.id,
        participantId: joined.participantId,
        selectedOptionIndex: 0,
      });
      service.lockQuestion(created.id);
      service.revealAnswer(created.id);

      const { leaderboard } = service.showLeaderboard(created.id);
      expect(leaderboard[0].score).toBe(1);
    });

    it('awards 0 for wrong answer', () => {
      const created = service.createQuiz(makeCreateDto()); // Q1 correct = 0
      const joined = service.joinQuiz(joinDto(created.joinCode, 'Alice'));
      service.startQuiz(created.id);
      service.startQuestion(created.id);
      service.submitAnswer({
        quizId: created.id,
        participantId: joined.participantId,
        selectedOptionIndex: 1, // wrong
      });
      service.lockQuestion(created.id);
      service.revealAnswer(created.id);

      const { leaderboard } = service.showLeaderboard(created.id);
      expect(leaderboard[0].score).toBe(0);
    });

    it('awards points to the team in team mode', () => {
      const created = service.createQuiz(makeTeamDto());
      const captain = service.joinQuiz(
        joinDto(created.joinCode, 'Alice', 'Team A'),
      );
      service.startQuiz(created.id);
      service.startQuestion(created.id);
      service.submitAnswer({
        quizId: created.id,
        participantId: captain.participantId,
        selectedOptionIndex: 0,
      });
      service.lockQuestion(created.id);
      service.revealAnswer(created.id);

      const { leaderboard } = service.showLeaderboard(created.id);
      expect(leaderboard[0].name).toBe('Team A');
      expect(leaderboard[0].score).toBe(1);
    });

    it('leaderboard sorts by score descending', () => {
      const created = service.createQuiz(makeCreateDto());
      const alice = service.joinQuiz(joinDto(created.joinCode, 'Alice'));
      const bob = service.joinQuiz(joinDto(created.joinCode, 'Bob'));
      service.startQuiz(created.id);
      service.startQuestion(created.id);

      // Alice correct, Bob wrong
      service.submitAnswer({
        quizId: created.id,
        participantId: alice.participantId,
        selectedOptionIndex: 0,
      });
      service.submitAnswer({
        quizId: created.id,
        participantId: bob.participantId,
        selectedOptionIndex: 1,
      });
      service.lockQuestion(created.id);
      service.revealAnswer(created.id);

      const { leaderboard } = service.showLeaderboard(created.id);
      expect(leaderboard[0].name).toBe('Alice');
      expect(leaderboard[1].name).toBe('Bob');
    });
  });

  // ── getSessionSnapshot ───────────────────────────────────────────────────────

  describe('getSessionSnapshot', () => {
    it('throws NotFoundException for unknown quizId', () => {
      expect(() => service.getSessionSnapshot('bad-id')).toThrow(
        NotFoundException,
      );
    });

    it('includes participant info when participantId provided', () => {
      const created = service.createQuiz(makeCreateDto());
      const joined = service.joinQuiz(joinDto(created.joinCode, 'Alice'));
      service.startQuiz(created.id);

      const snapshot = service.getSessionSnapshot(
        created.id,
        joined.participantId,
      );
      expect(snapshot.participant?.name).toBe('Alice');
    });

    it('does not expose correctOptionIndex in QUESTION_ACTIVE state', () => {
      const created = service.createQuiz(makeCreateDto());
      service.joinQuiz(joinDto(created.joinCode, 'Alice'));
      service.startQuiz(created.id);
      service.startQuestion(created.id);

      const snapshot = service.getSessionSnapshot(created.id);
      expect(snapshot.activeQuestion?.correctOptionIndex).toBeUndefined();
    });

    it('exposes correctOptionIndex in ANSWER_REVEALED state', () => {
      const created = service.createQuiz(makeCreateDto());
      service.joinQuiz(joinDto(created.joinCode, 'Alice'));
      service.startQuiz(created.id);
      service.startQuestion(created.id);
      service.lockQuestion(created.id);
      service.revealAnswer(created.id);

      const snapshot = service.getSessionSnapshot(created.id);
      expect(snapshot.activeQuestion?.correctOptionIndex).toBe(0);
    });

    it('includes leaderboard in LEADERBOARD state', () => {
      const created = service.createQuiz(makeCreateDto());
      const joined = service.joinQuiz(joinDto(created.joinCode, 'Alice'));
      service.startQuiz(created.id);
      service.startQuestion(created.id);
      service.submitAnswer({
        quizId: created.id,
        participantId: joined.participantId,
        selectedOptionIndex: 0,
      });
      service.lockQuestion(created.id);
      service.revealAnswer(created.id);
      service.showLeaderboard(created.id);

      const snapshot = service.getSessionSnapshot(created.id);
      expect(snapshot.leaderboard).toHaveLength(1);
    });

    it('includes submissionCount when requested', () => {
      const created = service.createQuiz(makeCreateDto());
      const joined = service.joinQuiz(joinDto(created.joinCode, 'Alice'));
      service.startQuiz(created.id);
      service.startQuestion(created.id);
      service.submitAnswer({
        quizId: created.id,
        participantId: joined.participantId,
        selectedOptionIndex: 0,
      });

      const snapshot = service.getSessionSnapshot(created.id, undefined, true);
      expect(snapshot.submissionCount).toBe(1);
    });

    it('submissionCount is null when not requested', () => {
      const created = service.createQuiz(makeCreateDto());
      service.startQuiz(created.id);
      service.startQuestion(created.id);

      const snapshot = service.getSessionSnapshot(created.id);
      expect(snapshot.submissionCount).toBeNull();
    });
  });

  // ── getMyQuizzes ─────────────────────────────────────────────────────────────

  describe('getMyQuizzes', () => {
    it('returns only quizzes owned by the given hostId', async () => {
      service.createQuiz(makeCreateDto({ title: 'Mine 1' }), 'host-a');
      service.createQuiz(makeCreateDto({ title: 'Mine 2' }), 'host-a');
      service.createQuiz(makeCreateDto({ title: 'Other' }), 'host-b');

      const results = await service.getMyQuizzes('host-a');
      expect(results).toHaveLength(2);
      expect(results.map((r) => r.title).sort()).toEqual(['Mine 1', 'Mine 2']);
    });

    it('returns empty array when host has no quizzes', async () => {
      const results = await service.getMyQuizzes('no-such-host');
      expect(results).toEqual([]);
    });

    it('returns quizzes sorted newest first', async () => {
      service.createQuiz(makeCreateDto({ title: 'First' }), 'host-c');
      service.createQuiz(makeCreateDto({ title: 'Second' }), 'host-c');

      const results = await service.getMyQuizzes('host-c');
      expect(results).toHaveLength(2);
      // Verify non-increasing createdAt order
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].createdAt.getTime()).toBeGreaterThanOrEqual(
          results[i].createdAt.getTime(),
        );
      }
    });

    it('includes expected summary fields', async () => {
      service.createQuiz(makeCreateDto(), 'host-d');
      const results = await service.getMyQuizzes('host-d');

      expect(results[0]).toMatchObject({
        id: expect.any(String),
        title: expect.any(String),
        mode: QuizMode.INDIVIDUAL,
        state: QuizState.CREATED,
        joinCode: expect.any(String),
        participantCount: 0,
        createdAt: expect.any(Date),
      });
    });
  });

  // ── updateQuiz ──────────────────────────────────────────────────────────────

  describe('updateQuiz', () => {
    it('updates the title', () => {
      const created = service.createQuiz(makeCreateDto(), 'host-u');
      const result = service.updateQuiz(
        created.id,
        { title: 'Updated Title' },
        'host-u',
      );
      expect(result.title).toBe('Updated Title');
    });

    it('replaces rounds and regenerates question IDs', () => {
      const created = service.createQuiz(makeCreateDto(), 'host-u');
      const newRound = {
        title: 'New Round',
        questions: [
          { text: 'NQ1', options: ['A', 'B', 'C', 'D'], correctOptionIndex: 1 },
        ],
      };
      const result = service.updateQuiz(
        created.id,
        { rounds: [newRound] },
        'host-u',
      );
      expect(result.rounds).toHaveLength(1);
      expect(result.rounds[0].title).toBe('New Round');
      expect(result.rounds[0].questions[0].id).toBeDefined();
      // New IDs differ from originals
      expect(result.rounds[0].questions[0].id).not.toBe(
        created.rounds[0].questions[0].id,
      );
    });

    it('throws 400 when quiz is not in CREATED state', () => {
      const created = service.createQuiz(makeCreateDto(), 'host-u');
      service.startQuiz(created.id);
      expect(() =>
        service.updateQuiz(created.id, { title: 'X' }, 'host-u'),
      ).toThrow(BadRequestException);
    });

    it('throws 403 when caller is not the owner', () => {
      const created = service.createQuiz(makeCreateDto(), 'host-u');
      expect(() =>
        service.updateQuiz(created.id, { title: 'X' }, 'host-other'),
      ).toThrow(ForbiddenException);
    });

    it('throws 404 for unknown quiz', () => {
      expect(() =>
        service.updateQuiz('no-such-id', { title: 'X' }, 'host-u'),
      ).toThrow(NotFoundException);
    });

    it('throws 400 when correctOptionIndex is out of range', () => {
      const created = service.createQuiz(makeCreateDto(), 'host-u');
      expect(() =>
        service.updateQuiz(
          created.id,
          {
            rounds: [
              {
                title: 'R',
                questions: [
                  {
                    text: 'Q',
                    options: ['A', 'B', 'C', 'D'],
                    correctOptionIndex: 5,
                  },
                ],
              },
            ],
          },
          'host-u',
        ),
      ).toThrow(BadRequestException);
    });

    it('does nothing when dto is empty', () => {
      const created = service.createQuiz(makeCreateDto(), 'host-u');
      const result = service.updateQuiz(created.id, {}, 'host-u');
      expect(result.title).toBe('Test Quiz');
      expect(result.rounds).toHaveLength(1);
    });
  });

  // ── getQuizResults ───────────────────────────────────────────────────────────

  describe('getQuizResults', () => {
    /** Run through a full single-question game: Q1 correct=0, Q2 correct=2 */
    function runFullGame(quizId: string, participantId: string) {
      service.startQuiz(quizId);

      // Question 1
      service.startQuestion(quizId);
      service.submitAnswer({
        quizId,
        participantId,
        selectedOptionIndex: 0, // correct (Q1 correctOptionIndex=0)
      });
      service.lockQuestion(quizId);
      service.revealAnswer(quizId);
      service.showLeaderboard(quizId);

      // Question 2
      service.startQuestion(quizId);
      service.submitAnswer({
        quizId,
        participantId,
        selectedOptionIndex: 1, // wrong (Q2 correctOptionIndex=2)
      });
      service.lockQuestion(quizId);
      service.revealAnswer(quizId);
      service.showLeaderboard(quizId);

      service.endQuiz(quizId);
    }

    it('throws 404 for unknown quiz', () => {
      expect(() => service.getQuizResults('no-such-id')).toThrow(
        NotFoundException,
      );
    });

    it('returns expected top-level shape', () => {
      const created = service.createQuiz(makeCreateDto());
      const joined = service.joinQuiz(joinDto(created.joinCode, 'Alice'));
      runFullGame(created.id, joined.participantId);

      const result = service.getQuizResults(created.id);
      expect(result.quizId).toBe(created.id);
      expect(result.title).toBe('Test Quiz');
      expect(result.state).toBe(QuizState.ENDED);
      expect(result.rounds).toHaveLength(1);
      expect(result.leaderboard).toHaveLength(1);
      expect(result.participantScoreHistory).toHaveLength(1);
    });

    it('counts correct and total answers per question', () => {
      const created = service.createQuiz(makeCreateDto());
      const alice = service.joinQuiz(joinDto(created.joinCode, 'Alice'));
      const bob = service.joinQuiz(joinDto(created.joinCode, 'Bob'));
      service.startQuiz(created.id);

      // Q1: Alice correct, Bob wrong
      service.startQuestion(created.id);
      service.submitAnswer({
        quizId: created.id,
        participantId: alice.participantId,
        selectedOptionIndex: 0, // correct
      });
      service.submitAnswer({
        quizId: created.id,
        participantId: bob.participantId,
        selectedOptionIndex: 1, // wrong
      });
      service.lockQuestion(created.id);
      service.revealAnswer(created.id);
      service.showLeaderboard(created.id);

      // Q2: skip (nobody answers)
      service.startQuestion(created.id);
      service.lockQuestion(created.id);
      service.revealAnswer(created.id);
      service.showLeaderboard(created.id);

      service.endQuiz(created.id);

      const result = service.getQuizResults(created.id);
      const q1Stats = result.rounds[0].questions[0];
      expect(q1Stats.totalAnswers).toBe(2);
      expect(q1Stats.correctAnswers).toBe(1);
      expect(q1Stats.optionCounts[0]).toBe(1); // Alice chose option 0
      expect(q1Stats.optionCounts[1]).toBe(1); // Bob chose option 1
    });

    it('records score history per participant', () => {
      const created = service.createQuiz(makeCreateDto());
      const alice = service.joinQuiz(joinDto(created.joinCode, 'Alice'));
      runFullGame(created.id, alice.participantId);

      const result = service.getQuizResults(created.id);
      const history = result.participantScoreHistory.find(
        (h) => h.name === 'Alice',
      )!;
      expect(history).toBeDefined();
      expect(history.scorePerQuestion).toHaveLength(2);
      expect(history.scorePerQuestion[0].isCorrect).toBe(true); // Q1
      expect(history.scorePerQuestion[1].isCorrect).toBe(false); // Q2
    });

    it('works on a quiz that has not yet ended', () => {
      const created = service.createQuiz(makeCreateDto());
      // No participants, not started — should still return valid shape
      const result = service.getQuizResults(created.id);
      expect(result.quizId).toBe(created.id);
      expect(result.rounds).toHaveLength(1);
      expect(result.leaderboard).toHaveLength(0);
      expect(result.participantScoreHistory).toHaveLength(0);
    });
  });
});
