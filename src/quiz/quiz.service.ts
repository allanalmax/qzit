import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CreateQuizDto } from './dto/create-quiz.dto';
import { JoinQuizDto } from './dto/join-quiz.dto';
import { SubmitAnswerDto } from './dto/submit-answer.dto';
import { UpdateQuizDto } from './dto/update-quiz.dto';
import type { Participant, Team } from './domain/participant.model';
import type { Question, Quiz, Round } from './domain/quiz.model';
import type { Submission } from './domain/submission.model';
import { QuizAction, QuizMode, QuizState } from './domain/quiz-state.enum';
import { transitionQuizState } from './domain/quiz-state-machine';
import type { IQuizStore } from './quiz.store';
import { QUIZ_STORE } from './quiz.store';

interface QuestionCoordinates {
  roundIndex: number;
  questionIndex: number;
}

export interface SerializedQuestion {
  id: string;
  text: string;
  options: string[];
  timeLimitSeconds: number;
  correctOptionIndex?: number;
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  isCaptain?: boolean;
  memberIds?: string[];
}

export interface QuizSessionSnapshot {
  quizId: string;
  title: string;
  mode: QuizMode;
  state: QuizState;
  participantCount: number;
  teamCount: number;
  currentRoundIndex: number;
  currentQuestionIndex: number | null;
  activeQuestion: SerializedQuestion | null;
  submissionCount: number | null;
  leaderboard: LeaderboardEntry[];
  participant?: {
    id: string;
    name: string;
    teamId: string | null;
    isCaptain: boolean;
    score: number;
  };
}

@Injectable()
export class QuizService {
  constructor(@Inject(QUIZ_STORE) private readonly quizStore: IQuizStore) {}

  createQuiz(createQuizDto: CreateQuizDto, hostId: string | null = null) {
    createQuizDto.rounds.forEach((round) => {
      round.questions.forEach((question) => {
        if (question.correctOptionIndex >= question.options.length) {
          throw new BadRequestException(
            'Question correctOptionIndex must reference an existing option',
          );
        }
      });
    });

    const rounds: Round[] = createQuizDto.rounds.map((round) => ({
      id: randomUUID(),
      title: round.title,
      questions: round.questions.map((question) => ({
        id: randomUUID(),
        text: question.text,
        options: [...question.options],
        correctOptionIndex: question.correctOptionIndex,
        timeLimitSeconds: question.timeLimitSeconds ?? 30,
      })),
    }));

    const quiz: Quiz = {
      id: randomUUID(),
      title: createQuizDto.title,
      mode: createQuizDto.mode,
      state: QuizState.CREATED,
      hostCode: this.generateUniqueCode('host'),
      joinCode: this.generateUniqueCode('join'),
      hostId,
      rounds,
      currentRoundIndex: 0,
      currentQuestionIndex: null,
      participants: new Map<string, Participant>(),
      teams: new Map<string, Team>(),
      submissionsByQuestion: new Map<string, Submission[]>(),
      createdAt: new Date(),
    };

    this.quizStore.create(quiz);

    return {
      id: quiz.id,
      title: quiz.title,
      mode: quiz.mode,
      state: quiz.state,
      hostCode: quiz.hostCode,
      joinCode: quiz.joinCode,
      rounds: quiz.rounds,
      createdAt: quiz.createdAt,
    };
  }

  getQuizById(quizId: string) {
    return this.getQuizOrThrowAsync(quizId).then((quiz) =>
      this.serializeQuiz(quiz),
    );
  }

  lookupByJoinCode(joinCode: string) {
    const quiz = this.quizStore.findByJoinCode(joinCode.trim().toUpperCase());

    if (!quiz) {
      throw new NotFoundException('Quiz not found for join code');
    }

    if (quiz.state === QuizState.ENDED) {
      throw new BadRequestException('Quiz has already ended');
    }

    return {
      quizId: quiz.id,
      title: quiz.title,
      mode: quiz.mode,
      state: quiz.state,
      teams: Array.from(quiz.teams.values()).map((t) => ({
        id: t.id,
        name: t.name,
        memberCount: t.memberIds.length,
      })),
    };
  }

  joinQuiz(joinQuizDto: JoinQuizDto) {
    const quiz = this.quizStore.findByJoinCode(
      joinQuizDto.joinCode.trim().toUpperCase(),
    );

    if (!quiz) {
      throw new NotFoundException('Quiz not found for join code');
    }

    if (quiz.state === QuizState.ENDED) {
      throw new BadRequestException('Quiz has already ended');
    }

    const participant: Participant = {
      id: randomUUID(),
      name: joinQuizDto.name.trim(),
      teamId: null,
      isCaptain: false,
      socketId: null,
      score: 0,
      joinedAt: new Date(),
    };

    if (quiz.mode === QuizMode.TEAM) {
      const teamName = joinQuizDto.teamName?.trim();

      if (!teamName) {
        throw new BadRequestException('teamName is required for team mode');
      }

      const existingTeam = this.findTeamByName(quiz, teamName);

      if (existingTeam) {
        participant.teamId = existingTeam.id;
        existingTeam.memberIds.push(participant.id);
      } else {
        const team: Team = {
          id: randomUUID(),
          name: teamName,
          memberIds: [participant.id],
          captainId: participant.id,
          score: 0,
          joinedAt: new Date(),
        };

        participant.teamId = team.id;
        participant.isCaptain = true;
        quiz.teams.set(team.id, team);
      }
    }

    quiz.participants.set(participant.id, participant);
    this.quizStore.update(quiz);

    return {
      quizId: quiz.id,
      participantId: participant.id,
      participantName: participant.name,
      mode: quiz.mode,
      teamId: participant.teamId,
      isCaptain: participant.isCaptain,
      state: quiz.state,
    };
  }

  connectHost(quizId: string, hostCode: string) {
    const quiz = this.getQuizOrThrow(quizId);

    if (quiz.hostCode !== hostCode.trim().toUpperCase()) {
      throw new ForbiddenException('Invalid host code');
    }

    return this.getSessionSnapshot(quizId, undefined, true);
  }

  connectParticipant(quizId: string, participantId: string, socketId: string) {
    const quiz = this.getQuizOrThrow(quizId);
    const participant = this.getParticipantOrThrow(quiz, participantId);

    participant.socketId = socketId;
    this.quizStore.update(quiz);

    return {
      participant,
      snapshot: this.getSessionSnapshot(quizId, participantId, false),
    };
  }

  disconnectSocket(socketId: string) {
    for (const quiz of this.quizStore.values()) {
      for (const participant of quiz.participants.values()) {
        if (participant.socketId === socketId) {
          participant.socketId = null;
          this.quizStore.update(quiz);
          return;
        }
      }
    }
  }

  startQuiz(quizId: string) {
    const quiz = this.getQuizOrThrow(quizId);
    quiz.state = transitionQuizState(quiz.state, QuizAction.OPEN_LOBBY);
    this.quizStore.update(quiz);
    return this.getSessionSnapshot(quizId, undefined, false);
  }

  startQuestion(quizId: string) {
    const quiz = this.getQuizOrThrow(quizId);
    const nextQuestionCoordinates = this.getNextQuestionCoordinates(quiz);

    if (!nextQuestionCoordinates) {
      throw new BadRequestException('No more questions available');
    }

    quiz.state = transitionQuizState(quiz.state, QuizAction.ACTIVATE_QUESTION);
    quiz.currentRoundIndex = nextQuestionCoordinates.roundIndex;
    quiz.currentQuestionIndex = nextQuestionCoordinates.questionIndex;
    this.quizStore.update(quiz);

    const activeQuestion = this.getCurrentQuestionOrThrow(quiz);

    return {
      snapshot: this.getSessionSnapshot(quizId, undefined, false),
      question: this.serializeQuestion(activeQuestion, false),
    };
  }

  submitAnswer(submitAnswerDto: SubmitAnswerDto) {
    const quiz = this.getQuizOrThrow(submitAnswerDto.quizId);

    if (quiz.state !== QuizState.QUESTION_ACTIVE) {
      throw new BadRequestException(
        'Answers are only accepted during an active question',
      );
    }

    const participant = this.getParticipantOrThrow(
      quiz,
      submitAnswerDto.participantId,
    );
    const question = this.getCurrentQuestionOrThrow(quiz);

    if (submitAnswerDto.selectedOptionIndex >= question.options.length) {
      throw new BadRequestException(
        'selectedOptionIndex must reference an existing option',
      );
    }

    const submissions = quiz.submissionsByQuestion.get(question.id) ?? [];

    if (quiz.mode === QuizMode.TEAM) {
      if (!participant.teamId) {
        throw new BadRequestException(
          'Participant must belong to a team in team mode',
        );
      }

      if (!participant.isCaptain) {
        throw new ForbiddenException(
          'Only the team captain can submit an answer',
        );
      }

      const alreadySubmitted = submissions.some(
        (submission) => submission.teamId === participant.teamId,
      );

      if (alreadySubmitted) {
        throw new ConflictException(
          'This team has already submitted an answer',
        );
      }
    } else {
      const alreadySubmitted = submissions.some(
        (submission) => submission.participantId === participant.id,
      );

      if (alreadySubmitted) {
        throw new ConflictException(
          'Participant has already submitted an answer',
        );
      }
    }

    const submission: Submission = {
      id: randomUUID(),
      questionId: question.id,
      participantId: participant.id,
      teamId: participant.teamId,
      selectedOptionIndex: submitAnswerDto.selectedOptionIndex,
      isCorrect: false,
      submittedAt: new Date(),
    };

    submissions.push(submission);
    quiz.submissionsByQuestion.set(question.id, submissions);
    this.quizStore.update(quiz);

    return {
      questionId: question.id,
      submissionCount: submissions.length,
      submission,
    };
  }

  lockQuestion(quizId: string) {
    const quiz = this.getQuizOrThrow(quizId);
    quiz.state = transitionQuizState(quiz.state, QuizAction.LOCK_QUESTION);
    this.quizStore.update(quiz);
    return this.getSessionSnapshot(quizId, undefined, false);
  }

  revealAnswer(quizId: string) {
    const quiz = this.getQuizOrThrow(quizId);
    const question = this.getCurrentQuestionOrThrow(quiz);

    quiz.state = transitionQuizState(quiz.state, QuizAction.REVEAL_ANSWER);

    const submissions = quiz.submissionsByQuestion.get(question.id) ?? [];

    submissions.forEach((submission) => {
      submission.isCorrect =
        submission.selectedOptionIndex === question.correctOptionIndex;

      if (!submission.isCorrect) {
        return;
      }

      if (quiz.mode === QuizMode.TEAM && submission.teamId) {
        const team = quiz.teams.get(submission.teamId);

        if (team) {
          team.score += 1;
        }

        return;
      }

      const participant = quiz.participants.get(submission.participantId);

      if (participant) {
        participant.score += 1;
      }
    });

    this.quizStore.update(quiz);

    return {
      snapshot: this.getSessionSnapshot(quizId, undefined, false),
      question: this.serializeQuestion(question, true),
    };
  }

  showLeaderboard(quizId: string) {
    const quiz = this.getQuizOrThrow(quizId);
    quiz.state = transitionQuizState(quiz.state, QuizAction.SHOW_LEADERBOARD);
    this.quizStore.update(quiz);

    return {
      snapshot: this.getSessionSnapshot(quizId, undefined, false),
      leaderboard: this.getLeaderboard(quiz),
      hasNextQuestion: this.getNextQuestionCoordinates(quiz) !== null,
    };
  }

  endQuiz(quizId: string) {
    const quiz = this.getQuizOrThrow(quizId);
    quiz.state = transitionQuizState(quiz.state, QuizAction.END_QUIZ);
    this.quizStore.update(quiz);

    return {
      snapshot: this.getSessionSnapshot(quizId, undefined, false),
      leaderboard: this.getLeaderboard(quiz),
    };
  }

  async getMyQuizzes(hostId: string) {
    const quizzes = await this.quizStore.findByHostId(hostId);
    return quizzes
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((q) => ({
        id: q.id,
        title: q.title,
        mode: q.mode,
        state: q.state,
        joinCode: q.joinCode,
        hostCode: q.hostCode,
        participantCount: q.participants.size,
        createdAt: q.createdAt,
      }));
  }

  updateQuiz(quizId: string, dto: UpdateQuizDto, hostId: string) {
    const quiz = this.getQuizOrThrow(quizId);

    if (quiz.state !== QuizState.CREATED) {
      throw new BadRequestException(
        'Quiz can only be edited before it has started',
      );
    }

    if (quiz.hostId !== hostId) {
      throw new ForbiddenException('You do not own this quiz');
    }

    if (dto.title !== undefined) {
      quiz.title = dto.title;
    }

    if (dto.rounds !== undefined) {
      dto.rounds.forEach((round) => {
        round.questions.forEach((q) => {
          if (q.correctOptionIndex >= q.options.length) {
            throw new BadRequestException(
              'Question correctOptionIndex must reference an existing option',
            );
          }
        });
      });

      quiz.rounds = dto.rounds.map((r) => ({
        id: randomUUID(),
        title: r.title,
        questions: r.questions.map((q) => ({
          id: randomUUID(),
          text: q.text,
          options: [...q.options],
          correctOptionIndex: q.correctOptionIndex,
          timeLimitSeconds: q.timeLimitSeconds ?? 30,
        })),
      }));
    }

    this.quizStore.update(quiz);

    return {
      id: quiz.id,
      title: quiz.title,
      mode: quiz.mode,
      state: quiz.state,
      hostCode: quiz.hostCode,
      joinCode: quiz.joinCode,
      rounds: quiz.rounds,
      createdAt: quiz.createdAt,
    };
  }

  async getQuizResults(quizId: string) {
    const quiz = await this.getQuizOrThrowAsync(quizId);

    const leaderboard = this.getLeaderboard(quiz);

    const rounds = quiz.rounds.map((round) => ({
      id: round.id,
      title: round.title,
      questions: round.questions.map((question) => {
        const submissions = quiz.submissionsByQuestion.get(question.id) ?? [];
        const totalAnswers = submissions.length;
        const correctAnswers = submissions.filter((s) => s.isCorrect).length;

        const optionCounts = question.options.map(
          (_, i) =>
            submissions.filter((s) => s.selectedOptionIndex === i).length,
        );

        return {
          id: question.id,
          text: question.text,
          options: question.options,
          correctOptionIndex: question.correctOptionIndex,
          timeLimitSeconds: question.timeLimitSeconds,
          totalAnswers,
          correctAnswers,
          optionCounts,
        };
      }),
    }));

    const participantScoreHistory: {
      participantId: string;
      name: string;
      scorePerQuestion: { questionId: string; isCorrect: boolean }[];
    }[] = Array.from(quiz.participants.values()).map((p) => ({
      participantId: p.id,
      name: p.name,
      scorePerQuestion: quiz.rounds
        .flatMap((r) => r.questions)
        .map((q) => {
          const submission = (quiz.submissionsByQuestion.get(q.id) ?? []).find(
            (s) => s.participantId === p.id,
          );
          return {
            questionId: q.id,
            isCorrect: submission?.isCorrect ?? false,
          };
        }),
    }));

    return {
      quizId: quiz.id,
      title: quiz.title,
      mode: quiz.mode,
      state: quiz.state,
      rounds,
      leaderboard,
      participantScoreHistory,
    };
  }

  getSessionSnapshot(
    quizId: string,
    participantId?: string,
    includeSubmissionCount = false,
  ): QuizSessionSnapshot {
    const quiz = this.getQuizOrThrow(quizId);
    const currentQuestion = this.getCurrentQuestion(quiz);
    const includeCorrectAnswer =
      quiz.state === QuizState.ANSWER_REVEALED ||
      quiz.state === QuizState.LEADERBOARD ||
      quiz.state === QuizState.ENDED;

    const participant = participantId
      ? this.getParticipantOrThrow(quiz, participantId)
      : undefined;
    const leaderboard =
      quiz.state === QuizState.LEADERBOARD || quiz.state === QuizState.ENDED
        ? this.getLeaderboard(quiz)
        : [];

    return {
      quizId: quiz.id,
      title: quiz.title,
      mode: quiz.mode,
      state: quiz.state,
      participantCount: quiz.participants.size,
      teamCount: quiz.teams.size,
      currentRoundIndex: quiz.currentRoundIndex,
      currentQuestionIndex: quiz.currentQuestionIndex,
      activeQuestion: currentQuestion
        ? this.serializeQuestion(currentQuestion, includeCorrectAnswer)
        : null,
      submissionCount:
        includeSubmissionCount && currentQuestion
          ? (quiz.submissionsByQuestion.get(currentQuestion.id) ?? []).length
          : null,
      leaderboard,
      participant: participant
        ? {
            id: participant.id,
            name: participant.name,
            teamId: participant.teamId,
            isCaptain: participant.isCaptain,
            score: participant.score,
          }
        : undefined,
    };
  }

  private serializeQuiz(quiz: Quiz) {
    return {
      id: quiz.id,
      title: quiz.title,
      mode: quiz.mode,
      state: quiz.state,
      hostCode: quiz.hostCode,
      joinCode: quiz.joinCode,
      createdAt: quiz.createdAt,
      currentRoundIndex: quiz.currentRoundIndex,
      currentQuestionIndex: quiz.currentQuestionIndex,
      rounds: quiz.rounds,
      participants: Array.from(quiz.participants.values()),
      teams: Array.from(quiz.teams.values()),
      submissionCounts: Array.from(quiz.submissionsByQuestion.entries()).map(
        ([questionId, submissions]) => ({
          questionId,
          count: submissions.length,
        }),
      ),
    };
  }

  private getQuizOrThrow(quizId: string): Quiz {
    const quiz = this.quizStore.findById(quizId);

    if (!quiz) {
      throw new NotFoundException('Quiz not found');
    }

    return quiz;
  }

  private async getQuizOrThrowAsync(quizId: string): Promise<Quiz> {
    const quiz = await this.quizStore.findByIdAsync(quizId);

    if (!quiz) {
      throw new NotFoundException('Quiz not found');
    }

    return quiz;
  }

  private getParticipantOrThrow(
    quiz: Quiz,
    participantId: string,
  ): Participant {
    const participant = quiz.participants.get(participantId);

    if (!participant) {
      throw new NotFoundException('Participant not found');
    }

    return participant;
  }

  private getCurrentQuestionOrThrow(quiz: Quiz): Question {
    const question = this.getCurrentQuestion(quiz);

    if (!question) {
      throw new BadRequestException('No active question is set for this quiz');
    }

    return question;
  }

  private getCurrentQuestion(quiz: Quiz): Question | null {
    if (quiz.currentQuestionIndex === null) {
      return null;
    }

    const round = quiz.rounds[quiz.currentRoundIndex];

    return round?.questions[quiz.currentQuestionIndex] ?? null;
  }

  private getNextQuestionCoordinates(quiz: Quiz): QuestionCoordinates | null {
    if (quiz.currentQuestionIndex === null) {
      return { roundIndex: 0, questionIndex: 0 };
    }

    const currentRound = quiz.rounds[quiz.currentRoundIndex];

    if (quiz.currentQuestionIndex + 1 < currentRound.questions.length) {
      return {
        roundIndex: quiz.currentRoundIndex,
        questionIndex: quiz.currentQuestionIndex + 1,
      };
    }

    if (quiz.currentRoundIndex + 1 < quiz.rounds.length) {
      return {
        roundIndex: quiz.currentRoundIndex + 1,
        questionIndex: 0,
      };
    }

    return null;
  }

  private getLeaderboard(quiz: Quiz): LeaderboardEntry[] {
    if (quiz.mode === QuizMode.TEAM) {
      return Array.from(quiz.teams.values())
        .map((team) => ({
          id: team.id,
          name: team.name,
          score: team.score,
          memberIds: [...team.memberIds],
          isCaptain: false,
        }))
        .sort(
          (left, right) =>
            right.score - left.score || left.name.localeCompare(right.name),
        );
    }

    return Array.from(quiz.participants.values())
      .map((participant) => ({
        id: participant.id,
        name: participant.name,
        score: participant.score,
        isCaptain: participant.isCaptain,
      }))
      .sort(
        (left, right) =>
          right.score - left.score || left.name.localeCompare(right.name),
      );
  }

  private serializeQuestion(
    question: Question,
    includeCorrectAnswer: boolean,
  ): SerializedQuestion {
    return {
      id: question.id,
      text: question.text,
      options: [...question.options],
      timeLimitSeconds: question.timeLimitSeconds,
      correctOptionIndex: includeCorrectAnswer
        ? question.correctOptionIndex
        : undefined,
    };
  }

  private findTeamByName(quiz: Quiz, teamName: string): Team | undefined {
    const normalizedName = teamName.trim().toLowerCase();

    return Array.from(quiz.teams.values()).find(
      (team) => team.name.trim().toLowerCase() === normalizedName,
    );
  }

  private generateUniqueCode(type: 'host' | 'join'): string {
    let code = this.generateCode();

    while (
      (type === 'host' &&
        Array.from(this.quizStore.values()).some(
          (quiz) => quiz.hostCode === code,
        )) ||
      (type === 'join' &&
        Array.from(this.quizStore.values()).some(
          (quiz) => quiz.joinCode === code,
        ))
    ) {
      code = this.generateCode();
    }

    return code;
  }

  private generateCode(): string {
    return Math.random().toString(36).slice(2, 8).toUpperCase();
  }
}
