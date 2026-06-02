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
exports.QuizController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const create_quiz_dto_1 = require("./dto/create-quiz.dto");
const join_quiz_dto_1 = require("./dto/join-quiz.dto");
const update_quiz_dto_1 = require("./dto/update-quiz.dto");
const quiz_service_1 = require("./quiz.service");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const current_host_decorator_1 = require("../auth/current-host.decorator");
let QuizController = class QuizController {
    quizService;
    constructor(quizService) {
        this.quizService = quizService;
    }
    createQuiz(createQuizDto, host) {
        return this.quizService.createQuiz(createQuizDto, host.sub);
    }
    getMyQuizzes(host) {
        return this.quizService.getMyQuizzes(host.sub);
    }
    updateQuiz(id, dto, host) {
        return this.quizService.updateQuiz(id, dto, host.sub);
    }
    getQuizById(id) {
        return this.quizService.getQuizById(id);
    }
    getQuizResults(id) {
        return this.quizService.getQuizResults(id);
    }
    lookupByJoinCode(joinCode) {
        return this.quizService.lookupByJoinCode(joinCode);
    }
    joinQuiz(joinQuizDto) {
        return this.quizService.joinQuiz(joinQuizDto);
    }
};
exports.QuizController = QuizController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Create a new quiz' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_host_decorator_1.CurrentHost)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_quiz_dto_1.CreateQuizDto, Object]),
    __metadata("design:returntype", void 0)
], QuizController.prototype, "createQuiz", null);
__decorate([
    (0, common_1.Get)('my'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get all quizzes belonging to the authenticated host' }),
    __param(0, (0, current_host_decorator_1.CurrentHost)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], QuizController.prototype, "getMyQuizzes", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Update a quiz (title / rounds) while still in created state' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_host_decorator_1.CurrentHost)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_quiz_dto_1.UpdateQuizDto, Object]),
    __metadata("design:returntype", void 0)
], QuizController.prototype, "updateQuiz", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Get full quiz data by ID' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], QuizController.prototype, "getQuizById", null);
__decorate([
    (0, common_1.Get)(':id/results'),
    (0, swagger_1.ApiOperation)({ summary: 'Get post-game results and per-question statistics' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], QuizController.prototype, "getQuizResults", null);
__decorate([
    (0, common_1.Get)('lookup/:joinCode'),
    (0, swagger_1.ApiOperation)({ summary: 'Look up a quiz by participant join code (safe for participants)' }),
    __param(0, (0, common_1.Param)('joinCode')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], QuizController.prototype, "lookupByJoinCode", null);
__decorate([
    (0, common_1.Post)('join'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [join_quiz_dto_1.JoinQuizDto]),
    __metadata("design:returntype", void 0)
], QuizController.prototype, "joinQuiz", null);
exports.QuizController = QuizController = __decorate([
    (0, swagger_1.ApiTags)('quiz'),
    (0, common_1.Controller)('quiz'),
    __metadata("design:paramtypes", [quiz_service_1.QuizService])
], QuizController);
//# sourceMappingURL=quiz.controller.js.map