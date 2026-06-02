import { QuizMode } from '../domain/quiz-state.enum';
export declare class CreateQuestionDto {
    text: string;
    options: string[];
    correctOptionIndex: number;
    timeLimitSeconds?: number;
}
export declare class CreateRoundDto {
    title: string;
    questions: CreateQuestionDto[];
}
export declare class CreateQuizDto {
    title: string;
    mode: QuizMode;
    rounds: CreateRoundDto[];
}
