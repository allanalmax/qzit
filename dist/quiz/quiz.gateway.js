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
exports.QuizGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const quiz_service_1 = require("./quiz.service");
const quiz_state_enum_1 = require("./domain/quiz-state.enum");
let QuizGateway = class QuizGateway {
    quizService;
    server;
    questionTimers = new Map();
    constructor(quizService) {
        this.quizService = quizService;
    }
    handleDisconnect(client) {
        this.quizService.disconnectSocket(client.id);
    }
    handleHostJoin(payload, client) {
        return this.wrap(client, () => {
            const snapshot = this.quizService.connectHost(payload.quizId, payload.hostCode);
            client.data.role = 'host';
            client.data.quizId = payload.quizId;
            client.join(this.getQuizRoom(payload.quizId));
            client.join(this.getHostRoom(payload.quizId));
            client.emit('quiz:snapshot', snapshot);
            return { ok: true };
        });
    }
    handleParticipantJoin(payload, client) {
        return this.wrap(client, () => {
            const { participant, snapshot } = this.quizService.connectParticipant(payload.quizId, payload.participantId, client.id);
            client.data.role = 'participant';
            client.data.quizId = payload.quizId;
            client.data.participantId = payload.participantId;
            client.join(this.getQuizRoom(payload.quizId));
            client.emit('quiz:snapshot', snapshot);
            this.server
                .to(this.getQuizRoom(payload.quizId))
                .emit('quiz:participant-joined', {
                participantId: participant.id,
                name: participant.name,
                teamId: participant.teamId,
                isCaptain: participant.isCaptain,
            });
            return { ok: true };
        });
    }
    handleStartQuiz(payload, client) {
        return this.wrap(client, () => {
            this.assertHost(client, payload.quizId);
            const snapshot = this.quizService.startQuiz(payload.quizId);
            this.server
                .to(this.getQuizRoom(payload.quizId))
                .emit('quiz:state-changed', snapshot);
            return { ok: true };
        });
    }
    handleStartQuestion(payload, client) {
        return this.wrap(client, () => {
            this.assertHost(client, payload.quizId);
            const result = this.quizService.startQuestion(payload.quizId);
            this.server
                .to(this.getQuizRoom(payload.quizId))
                .emit('quiz:state-changed', result.snapshot);
            this.server
                .to(this.getQuizRoom(payload.quizId))
                .emit('quiz:question-activated', result.question);
            this.server
                .to(this.getHostRoom(payload.quizId))
                .emit('quiz:submission-count', {
                questionId: result.question.id,
                count: 0,
            });
            this.scheduleAutoLock(payload.quizId, result.question.timeLimitSeconds * 1000);
            return { ok: true };
        });
    }
    handleSubmitAnswer(payload, client) {
        return this.wrap(client, () => {
            this.assertParticipant(client, payload.quizId);
            const result = this.quizService.submitAnswer({
                quizId: payload.quizId,
                participantId: client.data.participantId,
                selectedOptionIndex: payload.selectedOptionIndex,
            });
            client.emit('quiz:answer-submitted', {
                questionId: result.questionId,
                submissionId: result.submission.id,
            });
            this.server
                .to(this.getHostRoom(payload.quizId))
                .emit('quiz:submission-count', {
                questionId: result.questionId,
                count: result.submissionCount,
            });
            return { ok: true };
        });
    }
    handleLockQuestion(payload, client) {
        return this.wrap(client, () => {
            this.assertHost(client, payload.quizId);
            this.clearAutoLock(payload.quizId);
            const snapshot = this.quizService.lockQuestion(payload.quizId);
            this.server
                .to(this.getQuizRoom(payload.quizId))
                .emit('quiz:state-changed', snapshot);
            this.server
                .to(this.getQuizRoom(payload.quizId))
                .emit('quiz:question-locked', {
                quizId: payload.quizId,
            });
            return { ok: true };
        });
    }
    handleRevealAnswer(payload, client) {
        return this.wrap(client, () => {
            this.assertHost(client, payload.quizId);
            const result = this.quizService.revealAnswer(payload.quizId);
            this.server
                .to(this.getQuizRoom(payload.quizId))
                .emit('quiz:state-changed', result.snapshot);
            this.server
                .to(this.getQuizRoom(payload.quizId))
                .emit('quiz:answer-revealed', {
                question: result.question,
            });
            return { ok: true };
        });
    }
    handleShowLeaderboard(payload, client) {
        return this.wrap(client, () => {
            this.assertHost(client, payload.quizId);
            const result = this.quizService.showLeaderboard(payload.quizId);
            this.server
                .to(this.getQuizRoom(payload.quizId))
                .emit('quiz:state-changed', result.snapshot);
            this.server
                .to(this.getQuizRoom(payload.quizId))
                .emit('quiz:leaderboard', {
                rankings: result.leaderboard,
                hasNextQuestion: result.hasNextQuestion,
            });
            return { ok: true };
        });
    }
    handleEndQuiz(payload, client) {
        return this.wrap(client, () => {
            this.assertHost(client, payload.quizId);
            this.clearAutoLock(payload.quizId);
            const result = this.quizService.endQuiz(payload.quizId);
            this.server
                .to(this.getQuizRoom(payload.quizId))
                .emit('quiz:state-changed', result.snapshot);
            this.server.to(this.getQuizRoom(payload.quizId)).emit('quiz:ended', {
                leaderboard: result.leaderboard,
            });
            return { ok: true };
        });
    }
    handleParticipantRejoin(payload, client) {
        return this.wrap(client, () => {
            const { participant, snapshot } = this.quizService.connectParticipant(payload.quizId, payload.participantId, client.id);
            client.data.role = 'participant';
            client.data.quizId = payload.quizId;
            client.data.participantId = payload.participantId;
            client.join(this.getQuizRoom(payload.quizId));
            client.emit('quiz:snapshot', snapshot);
            this.server
                .to(this.getQuizRoom(payload.quizId))
                .emit('quiz:participant-reconnected', {
                participantId: participant.id,
                name: participant.name,
            });
            return { ok: true };
        });
    }
    scheduleAutoLock(quizId, delayMs) {
        this.clearAutoLock(quizId);
        const timer = setTimeout(() => {
            this.questionTimers.delete(quizId);
            try {
                const snapshot = this.quizService.lockQuestion(quizId);
                if (snapshot.state !== quiz_state_enum_1.QuizState.QUESTION_LOCKED)
                    return;
                this.server
                    .to(this.getQuizRoom(quizId))
                    .emit('quiz:state-changed', snapshot);
                this.server
                    .to(this.getQuizRoom(quizId))
                    .emit('quiz:question-locked', { quizId, timedOut: true });
            }
            catch {
            }
        }, delayMs);
        timer.unref();
        this.questionTimers.set(quizId, timer);
    }
    clearAutoLock(quizId) {
        const existing = this.questionTimers.get(quizId);
        if (existing !== undefined) {
            clearTimeout(existing);
            this.questionTimers.delete(quizId);
        }
    }
    wrap(client, callback) {
        try {
            return callback();
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unexpected error';
            client.emit('quiz:error', { message });
            return { ok: false, message };
        }
    }
    assertHost(client, quizId) {
        if (client.data.role !== 'host' || client.data.quizId !== quizId) {
            throw new Error('Host must join the quiz session before controlling it');
        }
    }
    assertParticipant(client, quizId) {
        if (client.data.role !== 'participant' || client.data.quizId !== quizId) {
            throw new Error('Participant must join the quiz session before submitting');
        }
    }
    getQuizRoom(quizId) {
        return `quiz:${quizId}`;
    }
    getHostRoom(quizId) {
        return `quiz:${quizId}:hosts`;
    }
};
exports.QuizGateway = QuizGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", Function)
], QuizGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('host:join-session'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Function]),
    __metadata("design:returntype", void 0)
], QuizGateway.prototype, "handleHostJoin", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('participant:join-session'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Function]),
    __metadata("design:returntype", void 0)
], QuizGateway.prototype, "handleParticipantJoin", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('host:start-quiz'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Function]),
    __metadata("design:returntype", void 0)
], QuizGateway.prototype, "handleStartQuiz", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('host:start-question'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Function]),
    __metadata("design:returntype", void 0)
], QuizGateway.prototype, "handleStartQuestion", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('participant:submit-answer'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Function]),
    __metadata("design:returntype", void 0)
], QuizGateway.prototype, "handleSubmitAnswer", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('host:lock-question'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Function]),
    __metadata("design:returntype", void 0)
], QuizGateway.prototype, "handleLockQuestion", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('host:reveal-answer'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Function]),
    __metadata("design:returntype", void 0)
], QuizGateway.prototype, "handleRevealAnswer", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('host:show-leaderboard'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Function]),
    __metadata("design:returntype", void 0)
], QuizGateway.prototype, "handleShowLeaderboard", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('host:end-quiz'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Function]),
    __metadata("design:returntype", void 0)
], QuizGateway.prototype, "handleEndQuiz", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('participant:rejoin-session'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Function]),
    __metadata("design:returntype", void 0)
], QuizGateway.prototype, "handleParticipantRejoin", null);
exports.QuizGateway = QuizGateway = __decorate([
    (0, websockets_1.WebSocketGateway)({
        namespace: '/quiz',
        cors: {
            origin: '*',
        },
    }),
    __metadata("design:paramtypes", [quiz_service_1.QuizService])
], QuizGateway);
//# sourceMappingURL=quiz.gateway.js.map