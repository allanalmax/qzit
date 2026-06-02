import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { QuizMode } from '../domain/quiz-state.enum';

export class CreateQuestionDto {
  @ApiProperty({ example: 'What is the capital of Kenya?' })
  @IsString()
  text!: string;

  @ApiProperty({ example: ['Nairobi', 'Kampala', 'Kigali', 'Dodoma'], minItems: 4, maxItems: 4 })
  @IsArray()
  @ArrayMinSize(4)
  @ArrayMaxSize(4)
  @IsString({ each: true })
  options!: string[];

  @ApiProperty({ example: 0, description: '0-based index of the correct option' })
  @IsInt()
  @Min(0)
  correctOptionIndex!: number;

  @ApiPropertyOptional({ example: 30, minimum: 1, maximum: 300 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(300)
  timeLimitSeconds?: number;
}

export class CreateRoundDto {
  @ApiProperty({ example: 'Round 1' })
  @IsString()
  title!: string;

  @ApiProperty({ type: [CreateQuestionDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateQuestionDto)
  questions!: CreateQuestionDto[];
}

export class CreateQuizDto {
  @ApiProperty({ example: 'Friday Night Trivia' })
  @IsString()
  title!: string;

  @ApiProperty({ enum: QuizMode, example: QuizMode.INDIVIDUAL })
  @IsEnum(QuizMode)
  mode!: QuizMode;

  @ApiProperty({ type: [CreateRoundDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateRoundDto)
  rounds!: CreateRoundDto[];
}
