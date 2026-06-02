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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateQuizDto = exports.CreateRoundDto = exports.CreateQuestionDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const quiz_state_enum_1 = require("../domain/quiz-state.enum");
class CreateQuestionDto {
    text;
    options;
    correctOptionIndex;
    timeLimitSeconds;
}
exports.CreateQuestionDto = CreateQuestionDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'What is the capital of Kenya?' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateQuestionDto.prototype, "text", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: ['Nairobi', 'Kampala', 'Kigali', 'Dodoma'], minItems: 4, maxItems: 4 }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(4),
    (0, class_validator_1.ArrayMaxSize)(4),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], CreateQuestionDto.prototype, "options", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0, description: '0-based index of the correct option' }),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateQuestionDto.prototype, "correctOptionIndex", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 30, minimum: 1, maximum: 300 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(300),
    __metadata("design:type", Number)
], CreateQuestionDto.prototype, "timeLimitSeconds", void 0);
class CreateRoundDto {
    title;
    questions;
}
exports.CreateRoundDto = CreateRoundDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Round 1' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateRoundDto.prototype, "title", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [CreateQuestionDto] }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => CreateQuestionDto),
    __metadata("design:type", Array)
], CreateRoundDto.prototype, "questions", void 0);
class CreateQuizDto {
    title;
    mode;
    rounds;
}
exports.CreateQuizDto = CreateQuizDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Friday Night Trivia' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateQuizDto.prototype, "title", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: quiz_state_enum_1.QuizMode, example: quiz_state_enum_1.QuizMode.INDIVIDUAL }),
    (0, class_validator_1.IsEnum)(quiz_state_enum_1.QuizMode),
    __metadata("design:type", String)
], CreateQuizDto.prototype, "mode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [CreateRoundDto] }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => CreateRoundDto),
    __metadata("design:type", Array)
], CreateQuizDto.prototype, "rounds", void 0);
//# sourceMappingURL=create-quiz.dto.js.map