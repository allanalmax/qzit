import { OnGatewayDisconnect } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { QuizService } from './quiz.service';
interface HostJoinPayload {
    quizId: string;
    hostCode: string;
}
interface ParticipantJoinPayload {
    quizId: string;
    participantId: string;
}
interface QuizActionPayload {
    quizId: string;
}
interface SubmitAnswerPayload {
    quizId: string;
    selectedOptionIndex: number;
}
export declare class QuizGateway implements OnGatewayDisconnect {
    private readonly quizService;
    server: Server;
    private readonly questionTimers;
    constructor(quizService: QuizService);
    handleDisconnect(client: Socket): void;
    handleHostJoin(payload: HostJoinPayload, client: Socket): {
        ok: true;
    } | {
        ok: boolean;
        message: string;
    };
    handleParticipantJoin(payload: ParticipantJoinPayload, client: Socket): {
        ok: true;
    } | {
        ok: boolean;
        message: string;
    };
    handleStartQuiz(payload: QuizActionPayload, client: Socket): {
        ok: true;
    } | {
        ok: boolean;
        message: string;
    };
    handleStartQuestion(payload: QuizActionPayload, client: Socket): {
        ok: true;
    } | {
        ok: boolean;
        message: string;
    };
    handleSubmitAnswer(payload: SubmitAnswerPayload, client: Socket): {
        ok: true;
    } | {
        ok: boolean;
        message: string;
    };
    handleLockQuestion(payload: QuizActionPayload, client: Socket): {
        ok: true;
    } | {
        ok: boolean;
        message: string;
    };
    handleRevealAnswer(payload: QuizActionPayload, client: Socket): {
        ok: true;
    } | {
        ok: boolean;
        message: string;
    };
    handleShowLeaderboard(payload: QuizActionPayload, client: Socket): {
        ok: true;
    } | {
        ok: boolean;
        message: string;
    };
    handleEndQuiz(payload: QuizActionPayload, client: Socket): {
        ok: true;
    } | {
        ok: boolean;
        message: string;
    };
    handleParticipantRejoin(payload: ParticipantJoinPayload, client: Socket): {
        ok: true;
    } | {
        ok: boolean;
        message: string;
    };
    private scheduleAutoLock;
    private clearAutoLock;
    private wrap;
    private assertHost;
    private assertParticipant;
    private getQuizRoom;
    private getHostRoom;
}
export {};
