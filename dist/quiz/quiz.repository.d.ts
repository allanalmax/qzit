import { OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { IQuizStore } from './quiz.store';
import type { Quiz } from './domain/quiz.model';
export declare class PrismaQuizRepository implements IQuizStore, OnModuleInit {
    private readonly prisma;
    private readonly cache;
    private readonly logger;
    constructor(prisma: PrismaService);
    onModuleInit(): Promise<void>;
    create(quiz: Quiz): Quiz;
    findById(id: string): Quiz | undefined;
    findByIdAsync(id: string): Promise<Quiz | undefined>;
    findByJoinCode(joinCode: string): Quiz | undefined;
    update(quiz: Quiz): Quiz;
    values(): IterableIterator<Quiz>;
    findByHostId(hostId: string): Promise<Quiz[]>;
    private persist;
    private sync;
    private syncRounds;
    private hydrate;
}
