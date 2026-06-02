import { Injectable } from '@nestjs/common';
import type { Quiz } from './domain/quiz.model';

export const QUIZ_STORE = Symbol('QUIZ_STORE');

export interface IQuizStore {
  create(quiz: Quiz): Quiz;
  findById(id: string): Quiz | undefined;
  findByIdAsync(id: string): Promise<Quiz | undefined>;
  findByJoinCode(joinCode: string): Quiz | undefined;
  update(quiz: Quiz): Quiz;
  values(): IterableIterator<Quiz>;
  findByHostId(hostId: string): Promise<Quiz[]>;
}

@Injectable()
export class QuizStore implements IQuizStore {
  private readonly quizzes = new Map<string, Quiz>();

  create(quiz: Quiz): Quiz {
    this.quizzes.set(quiz.id, quiz);
    return quiz;
  }

  findById(id: string): Quiz | undefined {
    return this.quizzes.get(id);
  }

  async findByIdAsync(id: string): Promise<Quiz | undefined> {
    return this.quizzes.get(id);
  }

  findByJoinCode(joinCode: string): Quiz | undefined {
    return Array.from(this.quizzes.values()).find(
      (quiz) => quiz.joinCode === joinCode,
    );
  }

  update(quiz: Quiz): Quiz {
    this.quizzes.set(quiz.id, quiz);
    return quiz;
  }

  values(): IterableIterator<Quiz> {
    return this.quizzes.values();
  }

  async findByHostId(hostId: string): Promise<Quiz[]> {
    return Array.from(this.quizzes.values()).filter((q) => q.hostId === hostId);
  }
}
