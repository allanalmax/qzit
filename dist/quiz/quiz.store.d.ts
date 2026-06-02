import type { Quiz } from './domain/quiz.model';
export declare const QUIZ_STORE: unique symbol;
export interface IQuizStore {
    create(quiz: Quiz): Quiz;
    findById(id: string): Quiz | undefined;
    findByIdAsync(id: string): Promise<Quiz | undefined>;
    findByJoinCode(joinCode: string): Quiz | undefined;
    update(quiz: Quiz): Quiz;
    values(): IterableIterator<Quiz>;
    findByHostId(hostId: string): Promise<Quiz[]>;
}
export declare class QuizStore implements IQuizStore {
    private readonly quizzes;
    create(quiz: Quiz): Quiz;
    findById(id: string): Quiz | undefined;
    findByIdAsync(id: string): Promise<Quiz | undefined>;
    findByJoinCode(joinCode: string): Quiz | undefined;
    update(quiz: Quiz): Quiz;
    values(): IterableIterator<Quiz>;
    findByHostId(hostId: string): Promise<Quiz[]>;
}
