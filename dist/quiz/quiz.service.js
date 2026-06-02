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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuizService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const quiz_state_enum_1 = require("./domain/quiz-state.enum");
const quiz_state_machine_1 = require("./domain/quiz-state-machine");
const quiz_store_1 = require("./quiz.store");
let QuizService = class QuizService {
    quizStore;
    constructor(quizStore) {
        this.quizStore = quizStore;
    }
    createQuiz(createQuizDto, hostId = null) {
        createQuizDto.rounds.forEach((round) => {
            round.questions.forEach((question) => {
                if (question.correctOptionIndex >= question.options.length) {
                    throw new common_1.BadRequestException('Question correctOptionIndex must reference an existing option');
                }
            });
        });
        const rounds = createQuizDto.rounds.map((round) => ({
            id: (0, crypto_1.randomUUID)(),
            title: round.title,
            questions: round.questions.map((question) => ({
                id: (0, crypto_1.randomUUID)(),
                text: question.text,
                options: [...question.options],
                correctOptionIndex: question.correctOptionIndex,
                timeLimitSeconds: question.timeLimitSeconds ?? 30,
            })),
        }));
        const quiz = {
            id: (0, crypto_1.randomUUID)(),
            title: createQuizDto.title,
            mode: createQuizDto.mode,
            state: quiz_state_enum_1.QuizState.CREATED,
            hostCode: this.generateUniqueCode('host'),
            joinCode: this.generateUniqueCode('join'),
            hostId,
            rounds,
            currentRoundIndex: 0,
            currentQuestionIndex: null,
            participants: new Map(),
            teams: new Map(),
            submissionsByQuestion: new Map(),
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
    getQuizById(quizId) {
        return this.getQuizOrThrowAsync(quizId).then((quiz) => this.serializeQuiz(quiz));
    }
    lookupByJoinCode(joinCode) {
        const quiz = this.quizStore.findByJoinCode(joinCode.trim().toUpperCase());
        if (!quiz) {
            throw new common_1.NotFoundException('Quiz not found for join code');
        }
        if (quiz.state === quiz_state_enum_1.QuizState.ENDED) {
            throw new common_1.BadRequestException('Quiz has already ended');
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
    joinQuiz(joinQuizDto) {
        const quiz = this.quizStore.findByJoinCode(joinQuizDto.joinCode.trim().toUpperCase());
        if (!quiz) {
            throw new common_1.NotFoundException('Quiz not found for join code');
        }
        if (quiz.state === quiz_state_enum_1.QuizState.ENDED) {
            throw new common_1.BadRequestException('Quiz has already ended');
        }
        const participant = {
            id: (0, crypto_1.randomUUID)(),
            name: joinQuizDto.name.trim(),
            teamId: null,
            isCaptain: false,
            socketId: null,
            score: 0,
            joinedAt: new Date(),
        };
        if (quiz.mode === quiz_state_enum_1.QuizMode.TEAM) {
            const teamName = joinQuizDto.teamName?.trim();
            if (!teamName) {
                throw new common_1.BadRequestException('teamName is required for team mode');
            }
            const existingTeam = this.findTeamByName(quiz, teamName);
            if (existingTeam) {
                participant.teamId = existingTeam.id;
                existingTeam.memberIds.push(participant.id);
            }
            else {
                const team = {
                    id: (0, crypto_1.randomUUID)(),
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
    connectHost(quizId, hostCode) {
        const quiz = this.getQuizOrThrow(quizId);
        if (quiz.hostCode !== hostCode.trim().toUpperCase()) {
            throw new common_1.ForbiddenException('Invalid host code');
        }
        return this.getSessionSnapshot(quizId, undefined, true);
    }
    connectParticipant(quizId, participantId, socketId) {
        const quiz = this.getQuizOrThrow(quizId);
        const participant = this.getParticipantOrThrow(quiz, participantId);
        participant.socketId = socketId;
        this.quizStore.update(quiz);
        return {
            participant,
            snapshot: this.getSessionSnapshot(quizId, participantId, false),
        };
    }
    disconnectSocket(socketId) {
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
    startQuiz(quizId) {
        const quiz = this.getQuizOrThrow(quizId);
        quiz.state = (0, quiz_state_machine_1.transitionQuizState)(quiz.state, quiz_state_enum_1.QuizAction.OPEN_LOBBY);
        this.quizStore.update(quiz);
        return this.getSessionSnapshot(quizId, undefined, false);
    }
    startQuestion(quizId) {
        const quiz = this.getQuizOrThrow(quizId);
        const nextQuestionCoordinates = this.getNextQuestionCoordinates(quiz);
        if (!nextQuestionCoordinates) {
            throw new common_1.BadRequestException('No more questions available');
        }
        quiz.state = (0, quiz_state_machine_1.transitionQuizState)(quiz.state, quiz_state_enum_1.QuizAction.ACTIVATE_QUESTION);
        quiz.currentRoundIndex = nextQuestionCoordinates.roundIndex;
        quiz.currentQuestionIndex = nextQuestionCoordinates.questionIndex;
        this.quizStore.update(quiz);
        const activeQuestion = this.getCurrentQuestionOrThrow(quiz);
        return {
            snapshot: this.getSessionSnapshot(quizId, undefined, false),
            question: this.serializeQuestion(activeQuestion, false),
        };
    }
    submitAnswer(submitAnswerDto) {
        const quiz = this.getQuizOrThrow(submitAnswerDto.quizId);
        if (quiz.state !== quiz_state_enum_1.QuizState.QUESTION_ACTIVE) {
            throw new common_1.BadRequestException('Answers are only accepted during an active question');
        }
        const participant = this.getParticipantOrThrow(quiz, submitAnswerDto.participantId);
        const question = this.getCurrentQuestionOrThrow(quiz);
        if (submitAnswerDto.selectedOptionIndex >= question.options.length) {
            throw new common_1.BadRequestException('selectedOptionIndex must reference an existing option');
        }
        const submissions = quiz.submissionsByQuestion.get(question.id) ?? [];
        if (quiz.mode === quiz_state_enum_1.QuizMode.TEAM) {
            if (!participant.teamId) {
                throw new common_1.BadRequestException('Participant must belong to a team in team mode');
            }
            if (!participant.isCaptain) {
                throw new common_1.ForbiddenException('Only the team captain can submit an answer');
            }
            const alreadySubmitted = submissions.some((submission) => submission.teamId === participant.teamId);
            if (alreadySubmitted) {
                throw new common_1.ConflictException('This team has already submitted an answer');
            }
        }
        else {
            const alreadySubmitted = submissions.some((submission) => submission.participantId === participant.id);
            if (alreadySubmitted) {
                throw new common_1.ConflictException('Participant has already submitted an answer');
            }
        }
        const submission = {
            id: (0, crypto_1.randomUUID)(),
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
    lockQuestion(quizId) {
        const quiz = this.getQuizOrThrow(quizId);
        quiz.state = (0, quiz_state_machine_1.transitionQuizState)(quiz.state, quiz_state_enum_1.QuizAction.LOCK_QUESTION);
        this.quizStore.update(quiz);
        return this.getSessionSnapshot(quizId, undefined, false);
    }
    revealAnswer(quizId) {
        const quiz = this.getQuizOrThrow(quizId);
        const question = this.getCurrentQuestionOrThrow(quiz);
        quiz.state = (0, quiz_state_machine_1.transitionQuizState)(quiz.state, quiz_state_enum_1.QuizAction.REVEAL_ANSWER);
        const submissions = quiz.submissionsByQuestion.get(question.id) ?? [];
        submissions.forEach((submission) => {
            submission.isCorrect =
                submission.selectedOptionIndex === question.correctOptionIndex;
            if (!submission.isCorrect) {
                return;
            }
            if (quiz.mode === quiz_state_enum_1.QuizMode.TEAM && submission.teamId) {
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
    showLeaderboard(quizId) {
        const quiz = this.getQuizOrThrow(quizId);
        quiz.state = (0, quiz_state_machine_1.transitionQuizState)(quiz.state, quiz_state_enum_1.QuizAction.SHOW_LEADERBOARD);
        this.quizStore.update(quiz);
        return {
            snapshot: this.getSessionSnapshot(quizId, undefined, false),
            leaderboard: this.getLeaderboard(quiz),
            hasNextQuestion: this.getNextQuestionCoordinates(quiz) !== null,
        };
    }
    endQuiz(quizId) {
        const quiz = this.getQuizOrThrow(quizId);
        quiz.state = (0, quiz_state_machine_1.transitionQuizState)(quiz.state, quiz_state_enum_1.QuizAction.END_QUIZ);
        this.quizStore.update(quiz);
        return {
            snapshot: this.getSessionSnapshot(quizId, undefined, false),
            leaderboard: this.getLeaderboard(quiz),
        };
    }
    async getMyQuizzes(hostId) {
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
    updateQuiz(quizId, dto, hostId) {
        const quiz = this.getQuizOrThrow(quizId);
        if (quiz.state !== quiz_state_enum_1.QuizState.CREATED) {
            throw new common_1.BadRequestException('Quiz can only be edited before it has started');
        }
        if (quiz.hostId !== hostId) {
            throw new common_1.ForbiddenException('You do not own this quiz');
        }
        if (dto.title !== undefined) {
            quiz.title = dto.title;
        }
        if (dto.rounds !== undefined) {
            dto.rounds.forEach((round) => {
                round.questions.forEach((q) => {
                    if (q.correctOptionIndex >= q.options.length) {
                        throw new common_1.BadRequestException('Question correctOptionIndex must reference an existing option');
                    }
                });
            });
            quiz.rounds = dto.rounds.map((r) => ({
                id: (0, crypto_1.randomUUID)(),
                title: r.title,
                questions: r.questions.map((q) => ({
                    id: (0, crypto_1.randomUUID)(),
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
    async getQuizResults(quizId) {
        const quiz = await this.getQuizOrThrowAsync(quizId);
        const leaderboard = this.getLeaderboard(quiz);
        const rounds = quiz.rounds.map((round) => ({
            id: round.id,
            title: round.title,
            questions: round.questions.map((question) => {
                const submissions = quiz.submissionsByQuestion.get(question.id) ?? [];
                const totalAnswers = submissions.length;
                const correctAnswers = submissions.filter((s) => s.isCorrect).length;
                const optionCounts = question.options.map((_, i) => submissions.filter((s) => s.selectedOptionIndex === i).length);
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
        const participantScoreHistory = Array.from(quiz.participants.values()).map((p) => ({
            participantId: p.id,
            name: p.name,
            scorePerQuestion: quiz.rounds
                .flatMap((r) => r.questions)
                .map((q) => {
                const submission = (quiz.submissionsByQuestion.get(q.id) ?? []).find((s) => s.participantId === p.id);
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
    getSessionSnapshot(quizId, participantId, includeSubmissionCount = false) {
        const quiz = this.getQuizOrThrow(quizId);
        const currentQuestion = this.getCurrentQuestion(quiz);
        const includeCorrectAnswer = quiz.state === quiz_state_enum_1.QuizState.ANSWER_REVEALED ||
            quiz.state === quiz_state_enum_1.QuizState.LEADERBOARD ||
            quiz.state === quiz_state_enum_1.QuizState.ENDED;
        const participant = participantId
            ? this.getParticipantOrThrow(quiz, participantId)
            : undefined;
        const leaderboard = quiz.state === quiz_state_enum_1.QuizState.LEADERBOARD || quiz.state === quiz_state_enum_1.QuizState.ENDED
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
            submissionCount: includeSubmissionCount && currentQuestion
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
    serializeQuiz(quiz) {
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
            submissionCounts: Array.from(quiz.submissionsByQuestion.entries()).map(([questionId, submissions]) => ({
                questionId,
                count: submissions.length,
            })),
        };
    }
    getQuizOrThrow(quizId) {
        const quiz = this.quizStore.findById(quizId);
        if (!quiz) {
            throw new common_1.NotFoundException('Quiz not found');
        }
        return quiz;
    }
    async getQuizOrThrowAsync(quizId) {
        const quiz = await this.quizStore.findByIdAsync(quizId);
        if (!quiz) {
            throw new common_1.NotFoundException('Quiz not found');
        }
        return quiz;
    }
    getParticipantOrThrow(quiz, participantId) {
        const participant = quiz.participants.get(participantId);
        if (!participant) {
            throw new common_1.NotFoundException('Participant not found');
        }
        return participant;
    }
    getCurrentQuestionOrThrow(quiz) {
        const question = this.getCurrentQuestion(quiz);
        if (!question) {
            throw new common_1.BadRequestException('No active question is set for this quiz');
        }
        return question;
    }
    getCurrentQuestion(quiz) {
        if (quiz.currentQuestionIndex === null) {
            return null;
        }
        const round = quiz.rounds[quiz.currentRoundIndex];
        return round?.questions[quiz.currentQuestionIndex] ?? null;
    }
    getNextQuestionCoordinates(quiz) {
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
    getLeaderboard(quiz) {
        if (quiz.mode === quiz_state_enum_1.QuizMode.TEAM) {
            return Array.from(quiz.teams.values())
                .map((team) => ({
                id: team.id,
                name: team.name,
                score: team.score,
                memberIds: [...team.memberIds],
                isCaptain: false,
            }))
                .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name));
        }
        return Array.from(quiz.participants.values())
            .map((participant) => ({
            id: participant.id,
            name: participant.name,
            score: participant.score,
            isCaptain: participant.isCaptain,
        }))
            .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name));
    }
    serializeQuestion(question, includeCorrectAnswer) {
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
    findTeamByName(quiz, teamName) {
        const normalizedName = teamName.trim().toLowerCase();
        return Array.from(quiz.teams.values()).find((team) => team.name.trim().toLowerCase() === normalizedName);
    }
    generateUniqueCode(type) {
        let code = this.generateCode();
        while ((type === 'host' &&
            Array.from(this.quizStore.values()).some((quiz) => quiz.hostCode === code)) ||
            (type === 'join' &&
                Array.from(this.quizStore.values()).some((quiz) => quiz.joinCode === code))) {
            code = this.generateCode();
        }
        return code;
    }
    generateCode() {
        return Math.random().toString(36).slice(2, 8).toUpperCase();
    }
};
exports.QuizService = QuizService;
exports.QuizService = QuizService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(quiz_store_1.QUIZ_STORE)),
    __metadata("design:paramtypes", [Object])
], QuizService);
//# sourceMappingURL=quiz.service.js.map