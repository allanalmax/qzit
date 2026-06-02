import { Module } from '@nestjs/common';
import { QuizController } from './quiz.controller';
import { QuizGateway } from './quiz.gateway';
import { QuizService } from './quiz.service';
import { QUIZ_STORE } from './quiz.store';
import { PrismaQuizRepository } from './quiz.repository';

@Module({
  controllers: [QuizController],
  providers: [
    QuizGateway,
    QuizService,
    PrismaQuizRepository,
    { provide: QUIZ_STORE, useExisting: PrismaQuizRepository },
  ],
})
export class QuizModule {}
