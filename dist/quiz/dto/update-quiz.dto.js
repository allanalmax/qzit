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
const swagger_1 = require("@nestjs/swagger");
nimport;
{
    Type;
}
from;
'class-transformer';
nimport;
{
    n;
    ArrayMaxSize, ;
    n;
    ArrayMinSize, ;
    n;
    IsArray, ;
    n;
    IsInt, ;
    n;
    IsNotEmpty, ;
    n;
    IsOptional, ;
    n;
    IsString, ;
    n;
    Max, ;
    n;
    Min, ;
    n;
    ValidateNested, ;
    n;
}
from;
'class-validator';
n;
nexport;
class UpdateQuestionDto {
    n;
    ;
    n;
    ;
    n;
    ;
    n;
    text;
    n;
    n;
    ;
    n;
    ;
    n;
    ;
    n;
    ;
    n;
    ;
    n;
    options;
    n;
    n;
    ;
    n;
    ;
    n;
    ;
    n;
    correctOptionIndex;
    n;
    n;
    ;
    n;
    ;
    n;
    ;
    n;
    ;
    n;
    ;
    n;
    timeLimitSeconds;
    n;
}
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'What color is the sky?' }),
    __metadata("design:type", Object)
], UpdateQuestionDto.prototype, "", void 0);
__decorate([
    IsString(),
    __metadata("design:type", Object)
], UpdateQuestionDto.prototype, "", void 0);
__decorate([
    IsNotEmpty(),
    __metadata("design:type", Object)
], UpdateQuestionDto.prototype, "", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: ['Red', 'Blue', 'Green', 'Yellow'], minItems: 4, maxItems: 4 }),
    __metadata("design:type", Object)
], UpdateQuestionDto.prototype, "", void 0);
__decorate([
    IsArray(),
    __metadata("design:type", Object)
], UpdateQuestionDto.prototype, "", void 0);
__decorate([
    ArrayMinSize(4),
    __metadata("design:type", Object)
], UpdateQuestionDto.prototype, "", void 0);
__decorate([
    ArrayMaxSize(4),
    __metadata("design:type", Object)
], UpdateQuestionDto.prototype, "", void 0);
__decorate([
    IsString({ each: true }),
    __metadata("design:type", Object)
], UpdateQuestionDto.prototype, "", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Object)
], UpdateQuestionDto.prototype, "", void 0);
__decorate([
    IsInt(),
    __metadata("design:type", Object)
], UpdateQuestionDto.prototype, "", void 0);
__decorate([
    Min(0),
    __metadata("design:type", Object)
], UpdateQuestionDto.prototype, "", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 30, minimum: 5, maximum: 300 }),
    __metadata("design:type", Object)
], UpdateQuestionDto.prototype, "", void 0);
__decorate([
    IsOptional(),
    __metadata("design:type", Object)
], UpdateQuestionDto.prototype, "", void 0);
__decorate([
    IsInt(),
    __metadata("design:type", Object)
], UpdateQuestionDto.prototype, "", void 0);
__decorate([
    Min(5),
    __metadata("design:type", Object)
], UpdateQuestionDto.prototype, "", void 0);
__decorate([
    Max(300),
    __metadata("design:type", Object)
], UpdateQuestionDto.prototype, "", void 0);
n;
nexport;
class UpdateRoundDto {
    n;
    ;
    n;
    ;
    n;
    ;
    n;
    title;
    n;
    n;
    ;
    n;
    ;
    n;
    ;
    n;
    ;
    n;
    ;
    n;
    questions;
    n;
}
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Round 1' }),
    __metadata("design:type", Object)
], UpdateRoundDto.prototype, "", void 0);
__decorate([
    IsString(),
    __metadata("design:type", Object)
], UpdateRoundDto.prototype, "", void 0);
__decorate([
    IsNotEmpty(),
    __metadata("design:type", Object)
], UpdateRoundDto.prototype, "", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [UpdateQuestionDto] }),
    __metadata("design:type", Object)
], UpdateRoundDto.prototype, "", void 0);
__decorate([
    IsArray(),
    __metadata("design:type", Object)
], UpdateRoundDto.prototype, "", void 0);
__decorate([
    ArrayMinSize(1),
    __metadata("design:type", Object)
], UpdateRoundDto.prototype, "", void 0);
__decorate([
    ValidateNested({ each: true }),
    __metadata("design:type", Object)
], UpdateRoundDto.prototype, "", void 0);
__decorate([
    Type(() => UpdateQuestionDto),
    __metadata("design:type", Object)
], UpdateRoundDto.prototype, "", void 0);
n;
nexport;
class UpdateQuizDto {
    n;
    ;
    n;
    ;
    n;
    ;
    n;
    ;
    n;
    title;
    n;
    n;
    ;
    n;
    ;
    n;
    ;
    n;
    ;
    n;
    ;
    n;
    ;
    n;
    rounds;
    n;
}
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Saturday Night Trivia' }),
    __metadata("design:type", Object)
], UpdateQuizDto.prototype, "", void 0);
__decorate([
    IsOptional(),
    __metadata("design:type", Object)
], UpdateQuizDto.prototype, "", void 0);
__decorate([
    IsString(),
    __metadata("design:type", Object)
], UpdateQuizDto.prototype, "", void 0);
__decorate([
    IsNotEmpty(),
    __metadata("design:type", Object)
], UpdateQuizDto.prototype, "", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [UpdateRoundDto] }),
    __metadata("design:type", Object)
], UpdateQuizDto.prototype, "", void 0);
__decorate([
    IsOptional(),
    __metadata("design:type", Object)
], UpdateQuizDto.prototype, "", void 0);
__decorate([
    IsArray(),
    __metadata("design:type", Object)
], UpdateQuizDto.prototype, "", void 0);
__decorate([
    ArrayMinSize(1),
    __metadata("design:type", Object)
], UpdateQuizDto.prototype, "", void 0);
__decorate([
    ValidateNested({ each: true }),
    __metadata("design:type", Object)
], UpdateQuizDto.prototype, "", void 0);
__decorate([
    Type(() => UpdateRoundDto),
    __metadata("design:type", Object)
], UpdateQuizDto.prototype, "", void 0);
//# sourceMappingURL=update-quiz.dto.js.map