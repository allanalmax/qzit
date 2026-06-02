import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { IQuizStore } from './quiz.store';
import type { Quiz } from './domain/quiz.model';
import type { Participant, Team } from './domain/participant.model';
import type { Submission } from './domain/submission.model';
import { QuizMode, QuizState } from './domain/quiz-state.enum';

// Full DB shape returned by the include query
type QuizWithRelations = Prisma.QuizGetPayload<{
  include: {
    rounds: {
      include: { questions: { orderBy: { order: 'asc' } } };
      orderBy: { order: 'asc' };
    };
    participants: true;
    teams: true;
    submissions: true;
  };
}>;

@Injectable()
export class PrismaQuizRepository implements IQuizStore, OnModuleInit {
  private readonly cache = new Map<string, Quiz>();
  private readonly logger = new Logger(PrismaQuizRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    const rows = await this.prisma.quiz.findMany({
      where: { state: { not: QuizState.ENDED } },
      include: {
        rounds: {
          orderBy: { order: 'asc' },
          include: { questions: { orderBy: { order: 'asc' } } },
        },
        participants: true,
        teams: true,
        submissions: true,
      },
    });

    for (const row of rows) {
      this.cache.set(row.id, this.hydrate(row));
    }
    this.logger.log(`Loaded ${rows.length} active quiz(zes) from database`);
  }

  // ── IQuizStore (synchronous, cache-backed) ────────────────────────────────

  create(quiz: Quiz): Quiz {
    this.cache.set(quiz.id, quiz);
    this.persist(quiz).catch((err) =>
      this.logger.error(`Failed to persist quiz ${quiz.id}: ${String(err)}`),
    );
    return quiz;
  }

  findById(id: string): Quiz | undefined {
    return this.cache.get(id);
  }

  async findByIdAsync(id: string): Promise<Quiz | undefined> {
    const cached = this.cache.get(id);
    if (cached) return cached;

    // Ended quizzes are evicted from cache — fall back to DB
    const row = await this.prisma.quiz.findUnique({
      where: { id },
      include: {
        rounds: {
          orderBy: { order: 'asc' },
          include: { questions: { orderBy: { order: 'asc' } } },
        },
        participants: true,
        teams: true,
        submissions: true,
      },
    });

    return row ? this.hydrate(row) : undefined;
  }

  findByJoinCode(joinCode: string): Quiz | undefined {
    return Array.from(this.cache.values()).find((q) => q.joinCode === joinCode);
  }

  update(quiz: Quiz): Quiz {
    this.cache.set(quiz.id, quiz);
    this.sync(quiz).catch((err) =>
      this.logger.error(`Failed to sync quiz ${quiz.id}: ${String(err)}`),
    );
    return quiz;
  }

  values(): IterableIterator<Quiz> {
    return this.cache.values();
  }

  async findByHostId(hostId: string): Promise<Quiz[]> {
    // Non-ended quizzes come from the in-memory cache
    const active = Array.from(this.cache.values()).filter(
      (q) => q.hostId === hostId,
    );

    // Ended quizzes are evicted from cache – fetch from DB
    const endedRows = await this.prisma.quiz.findMany({
      where: { hostId, state: QuizState.ENDED },
      include: {
        rounds: {
          orderBy: { order: 'asc' },
          include: { questions: { orderBy: { order: 'asc' } } },
        },
        participants: true,
        teams: true,
        submissions: true,
      },
    });

    return [...active, ...endedRows.map((r) => this.hydrate(r))];
  }

  // ── DB write: full insert on creation ────────────────────────────────────

  private async persist(quiz: Quiz): Promise<void> {
    await this.prisma.quiz.create({
      data: {
        id: quiz.id,
        title: quiz.title,
        mode: quiz.mode,
        state: quiz.state,
        hostCode: quiz.hostCode,
        joinCode: quiz.joinCode,
        hostId: quiz.hostId,
        currentRoundIndex: quiz.currentRoundIndex,
        currentQuestionIndex: quiz.currentQuestionIndex,
        createdAt: quiz.createdAt,
        rounds: {
          create: quiz.rounds.map((r, ri) => ({
            id: r.id,
            title: r.title,
            order: ri,
            questions: {
              create: r.questions.map((q, qi) => ({
                id: q.id,
                text: q.text,
                options: q.options,
                correctOptionIndex: q.correctOptionIndex,
                timeLimitSeconds: q.timeLimitSeconds,
                order: qi,
              })),
            },
          })),
        },
      },
    });
  }

  // ── DB write: incremental sync on every update ────────────────────────────

  private async sync(quiz: Quiz): Promise<void> {
    const participants = Array.from(quiz.participants.values());
    const teams = Array.from(quiz.teams.values());
    const submissions = Array.from(quiz.submissionsByQuestion.values()).flat();

    await this.prisma.$transaction([
      // 1. Update quiz state fields
      this.prisma.quiz.update({
        where: { id: quiz.id },
        data: {
          title: quiz.title,
          state: quiz.state,
          currentRoundIndex: quiz.currentRoundIndex,
          currentQuestionIndex: quiz.currentQuestionIndex,
        },
      }),

      // 2. Upsert teams (new teams added, scores updated)
      ...teams.map((t) =>
        this.prisma.team.upsert({
          where: { id: t.id },
          create: {
            id: t.id,
            quizId: quiz.id,
            name: t.name,
            captainId: t.captainId,
            score: t.score,
            joinedAt: t.joinedAt,
          },
          update: { score: t.score, captainId: t.captainId },
        }),
      ),

      // 3. Upsert participants (new participants, score/socket updates)
      ...participants.map((p) =>
        this.prisma.participant.upsert({
          where: { id: p.id },
          create: {
            id: p.id,
            quizId: quiz.id,
            name: p.name,
            teamId: p.teamId,
            isCaptain: p.isCaptain,
            socketId: p.socketId,
            score: p.score,
            joinedAt: p.joinedAt,
          },
          update: { score: p.score, socketId: p.socketId, teamId: p.teamId },
        }),
      ),

      // 4. Insert new submissions, skip already-persisted ones
      this.prisma.submission.createMany({
        data: submissions.map((s) => ({
          id: s.id,
          quizId: quiz.id,
          questionId: s.questionId,
          participantId: s.participantId,
          teamId: s.teamId,
          selectedOptionIndex: s.selectedOptionIndex,
          isCorrect: s.isCorrect,
          submittedAt: s.submittedAt,
        })),
        skipDuplicates: true,
      }),
    ]);

    // 5. When the quiz is still in CREATED state, resync rounds + questions
    //    (supports pre-game editing)
    if (quiz.state === QuizState.CREATED) {
      await this.syncRounds(quiz);
    }
  }

  private async syncRounds(quiz: Quiz): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.round.deleteMany({ where: { quizId: quiz.id } });
      for (const [ri, round] of quiz.rounds.entries()) {
        await tx.round.create({
          data: {
            id: round.id,
            quizId: quiz.id,
            title: round.title,
            order: ri,
            questions: {
              create: round.questions.map((q, qi) => ({
                id: q.id,
                text: q.text,
                options: q.options,
                correctOptionIndex: q.correctOptionIndex,
                timeLimitSeconds: q.timeLimitSeconds,
                order: qi,
              })),
            },
          },
        });
      }
    });
  }

  // ── Hydration: DB row → domain Quiz ──────────────────────────────────────

  private hydrate(raw: QuizWithRelations): Quiz {
    const participants = new Map<string, Participant>();
    for (const p of raw.participants) {
      participants.set(p.id, {
        id: p.id,
        name: p.name,
        teamId: p.teamId,
        isCaptain: p.isCaptain,
        socketId: p.socketId,
        score: p.score,
        joinedAt: p.joinedAt,
      });
    }

    const teams = new Map<string, Team>();
    for (const t of raw.teams) {
      const memberIds = raw.participants
        .filter((p) => p.teamId === t.id)
        .map((p) => p.id);
      teams.set(t.id, {
        id: t.id,
        name: t.name,
        memberIds,
        captainId: t.captainId,
        score: t.score,
        joinedAt: t.joinedAt,
      });
    }

    const submissionsByQuestion = new Map<string, Submission[]>();
    for (const s of raw.submissions) {
      const list = submissionsByQuestion.get(s.questionId) ?? [];
      list.push({
        id: s.id,
        questionId: s.questionId,
        participantId: s.participantId,
        teamId: s.teamId,
        selectedOptionIndex: s.selectedOptionIndex,
        isCorrect: s.isCorrect,
        submittedAt: s.submittedAt,
      });
      submissionsByQuestion.set(s.questionId, list);
    }

    return {
      id: raw.id,
      title: raw.title,
      mode: raw.mode as QuizMode,
      state: raw.state as QuizState,
      hostCode: raw.hostCode,
      joinCode: raw.joinCode,
      hostId: raw.hostId,
      currentRoundIndex: raw.currentRoundIndex,
      currentQuestionIndex: raw.currentQuestionIndex,
      createdAt: raw.createdAt,
      rounds: raw.rounds.map((r) => ({
        id: r.id,
        title: r.title,
        questions: r.questions.map((q) => ({
          id: q.id,
          text: q.text,
          options: q.options as string[],
          correctOptionIndex: q.correctOptionIndex,
          timeLimitSeconds: q.timeLimitSeconds,
        })),
      })),
      participants,
      teams,
      submissionsByQuestion,
    };
  }
}
