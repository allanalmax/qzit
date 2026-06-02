"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var PrismaQuizRepository_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaQuizRepository = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const quiz_state_enum_1 = require("./domain/quiz-state.enum");
let PrismaQuizRepository = PrismaQuizRepository_1 = class PrismaQuizRepository {
    prisma;
    cache = new Map();
    logger = new common_1.Logger(PrismaQuizRepository_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    async onModuleInit() {
        const rows = await this.prisma.quiz.findMany({
            where: { state: { not: quiz_state_enum_1.QuizState.ENDED } },
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
    create(quiz) {
        this.cache.set(quiz.id, quiz);
        this.persist(quiz).catch((err) => this.logger.error(`Failed to persist quiz ${quiz.id}: ${String(err)}`));
        return quiz;
    }
    findById(id) {
        return this.cache.get(id);
    }
    async findByIdAsync(id) {
        const cached = this.cache.get(id);
        if (cached)
            return cached;
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
    findByJoinCode(joinCode) {
        return Array.from(this.cache.values()).find((q) => q.joinCode === joinCode);
    }
    update(quiz) {
        this.cache.set(quiz.id, quiz);
        this.sync(quiz).catch((err) => this.logger.error(`Failed to sync quiz ${quiz.id}: ${String(err)}`));
        return quiz;
    }
    values() {
        return this.cache.values();
    }
    async findByHostId(hostId) {
        const active = Array.from(this.cache.values()).filter((q) => q.hostId === hostId);
        const endedRows = await this.prisma.quiz.findMany({
            where: { hostId, state: quiz_state_enum_1.QuizState.ENDED },
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
    async persist(quiz) {
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
    async sync(quiz) {
        const participants = Array.from(quiz.participants.values());
        const teams = Array.from(quiz.teams.values());
        const submissions = Array.from(quiz.submissionsByQuestion.values()).flat();
        await this.prisma.$transaction([
            this.prisma.quiz.update({
                where: { id: quiz.id },
                data: {
                    title: quiz.title,
                    state: quiz.state,
                    currentRoundIndex: quiz.currentRoundIndex,
                    currentQuestionIndex: quiz.currentQuestionIndex,
                },
            }),
            ...teams.map((t) => this.prisma.team.upsert({
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
            })),
            ...participants.map((p) => this.prisma.participant.upsert({
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
            })),
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
        if (quiz.state === quiz_state_enum_1.QuizState.CREATED) {
            await this.syncRounds(quiz);
        }
    }
    async syncRounds(quiz) {
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
    hydrate(raw) {
        const participants = new Map();
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
        const teams = new Map();
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
        const submissionsByQuestion = new Map();
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
            mode: raw.mode,
            state: raw.state,
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
                    options: q.options,
                    correctOptionIndex: q.correctOptionIndex,
                    timeLimitSeconds: q.timeLimitSeconds,
                })),
            })),
            participants,
            teams,
            submissionsByQuestion,
        };
    }
};
exports.PrismaQuizRepository = PrismaQuizRepository;
exports.PrismaQuizRepository = PrismaQuizRepository = PrismaQuizRepository_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PrismaQuizRepository);
//# sourceMappingURL=quiz.repository.js.map