import { IsInt, IsString, Min } from 'class-validator';

export class SubmitAnswerDto {
  @IsString()
  quizId!: string;

  @IsString()
  participantId!: string;

  @IsInt()
  @Min(0)
  selectedOptionIndex!: number;
}
