import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { QuizService } from './quiz.service';
import { QuizState } from './domain/quiz-state.enum';

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

@WebSocketGateway({
  namespace: '/quiz',
  cors: {
    origin: '*',
  },
})
export class QuizGateway implements OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  /** Active question timers keyed by quizId */
  private readonly questionTimers = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();

  constructor(private readonly quizService: QuizService) {}

  handleDisconnect(client: Socket) {
    this.quizService.disconnectSocket(client.id);
  }

  @SubscribeMessage('host:join-session')
  handleHostJoin(
    @MessageBody() payload: HostJoinPayload,
    @ConnectedSocket() client: Socket,
  ) {
    return this.wrap(client, () => {
      const snapshot = this.quizService.connectHost(
        payload.quizId,
        payload.hostCode,
      );

      client.data.role = 'host';
      client.data.quizId = payload.quizId;
      client.join(this.getQuizRoom(payload.quizId));
      client.join(this.getHostRoom(payload.quizId));
      client.emit('quiz:snapshot', snapshot);

      return { ok: true };
    });
  }

  @SubscribeMessage('participant:join-session')
  handleParticipantJoin(
    @MessageBody() payload: ParticipantJoinPayload,
    @ConnectedSocket() client: Socket,
  ) {
    return this.wrap(client, () => {
      const { participant, snapshot } = this.quizService.connectParticipant(
        payload.quizId,
        payload.participantId,
        client.id,
      );

      client.data.role = 'participant';
      client.data.quizId = payload.quizId;
      client.data.participantId = payload.participantId;
      client.join(this.getQuizRoom(payload.quizId));
      client.emit('quiz:snapshot', snapshot);

      this.server
        .to(this.getQuizRoom(payload.quizId))
        .emit('quiz:participant-joined', {
          participantId: participant.id,
          name: participant.name,
          teamId: participant.teamId,
          isCaptain: participant.isCaptain,
        });

      return { ok: true };
    });
  }

  @SubscribeMessage('host:start-quiz')
  handleStartQuiz(
    @MessageBody() payload: QuizActionPayload,
    @ConnectedSocket() client: Socket,
  ) {
    return this.wrap(client, () => {
      this.assertHost(client, payload.quizId);
      const snapshot = this.quizService.startQuiz(payload.quizId);
      this.server
        .to(this.getQuizRoom(payload.quizId))
        .emit('quiz:state-changed', snapshot);
      return { ok: true };
    });
  }

  @SubscribeMessage('host:start-question')
  handleStartQuestion(
    @MessageBody() payload: QuizActionPayload,
    @ConnectedSocket() client: Socket,
  ) {
    return this.wrap(client, () => {
      this.assertHost(client, payload.quizId);
      const result = this.quizService.startQuestion(payload.quizId);
      this.server
        .to(this.getQuizRoom(payload.quizId))
        .emit('quiz:state-changed', result.snapshot);
      this.server
        .to(this.getQuizRoom(payload.quizId))
        .emit('quiz:question-activated', result.question);
      this.server
        .to(this.getHostRoom(payload.quizId))
        .emit('quiz:submission-count', {
          questionId: result.question.id,
          count: 0,
        });

      // Schedule auto-lock when the time limit expires
      this.scheduleAutoLock(
        payload.quizId,
        result.question.timeLimitSeconds * 1000,
      );

      return { ok: true };
    });
  }

  @SubscribeMessage('participant:submit-answer')
  handleSubmitAnswer(
    @MessageBody() payload: SubmitAnswerPayload,
    @ConnectedSocket() client: Socket,
  ) {
    return this.wrap(client, () => {
      this.assertParticipant(client, payload.quizId);
      const result = this.quizService.submitAnswer({
        quizId: payload.quizId,
        participantId: client.data.participantId as string,
        selectedOptionIndex: payload.selectedOptionIndex,
      });

      client.emit('quiz:answer-submitted', {
        questionId: result.questionId,
        submissionId: result.submission.id,
      });

      this.server
        .to(this.getHostRoom(payload.quizId))
        .emit('quiz:submission-count', {
          questionId: result.questionId,
          count: result.submissionCount,
        });

      return { ok: true };
    });
  }

  @SubscribeMessage('host:lock-question')
  handleLockQuestion(
    @MessageBody() payload: QuizActionPayload,
    @ConnectedSocket() client: Socket,
  ) {
    return this.wrap(client, () => {
      this.assertHost(client, payload.quizId);
      this.clearAutoLock(payload.quizId);
      const snapshot = this.quizService.lockQuestion(payload.quizId);
      this.server
        .to(this.getQuizRoom(payload.quizId))
        .emit('quiz:state-changed', snapshot);
      this.server
        .to(this.getQuizRoom(payload.quizId))
        .emit('quiz:question-locked', {
          quizId: payload.quizId,
        });
      return { ok: true };
    });
  }

  @SubscribeMessage('host:reveal-answer')
  handleRevealAnswer(
    @MessageBody() payload: QuizActionPayload,
    @ConnectedSocket() client: Socket,
  ) {
    return this.wrap(client, () => {
      this.assertHost(client, payload.quizId);
      const result = this.quizService.revealAnswer(payload.quizId);
      this.server
        .to(this.getQuizRoom(payload.quizId))
        .emit('quiz:state-changed', result.snapshot);
      this.server
        .to(this.getQuizRoom(payload.quizId))
        .emit('quiz:answer-revealed', {
          question: result.question,
        });
      return { ok: true };
    });
  }

  @SubscribeMessage('host:show-leaderboard')
  handleShowLeaderboard(
    @MessageBody() payload: QuizActionPayload,
    @ConnectedSocket() client: Socket,
  ) {
    return this.wrap(client, () => {
      this.assertHost(client, payload.quizId);
      const result = this.quizService.showLeaderboard(payload.quizId);
      this.server
        .to(this.getQuizRoom(payload.quizId))
        .emit('quiz:state-changed', result.snapshot);
      this.server
        .to(this.getQuizRoom(payload.quizId))
        .emit('quiz:leaderboard', {
          rankings: result.leaderboard,
          hasNextQuestion: result.hasNextQuestion,
        });
      return { ok: true };
    });
  }

  @SubscribeMessage('host:end-quiz')
  handleEndQuiz(
    @MessageBody() payload: QuizActionPayload,
    @ConnectedSocket() client: Socket,
  ) {
    return this.wrap(client, () => {
      this.assertHost(client, payload.quizId);
      this.clearAutoLock(payload.quizId);
      const result = this.quizService.endQuiz(payload.quizId);
      this.server
        .to(this.getQuizRoom(payload.quizId))
        .emit('quiz:state-changed', result.snapshot);
      this.server.to(this.getQuizRoom(payload.quizId)).emit('quiz:ended', {
        leaderboard: result.leaderboard,
      });
      return { ok: true };
    });
  }

  @SubscribeMessage('participant:rejoin-session')
  handleParticipantRejoin(
    @MessageBody() payload: ParticipantJoinPayload,
    @ConnectedSocket() client: Socket,
  ) {
    return this.wrap(client, () => {
      const { participant, snapshot } = this.quizService.connectParticipant(
        payload.quizId,
        payload.participantId,
        client.id,
      );

      client.data.role = 'participant';
      client.data.quizId = payload.quizId;
      client.data.participantId = payload.participantId;
      client.join(this.getQuizRoom(payload.quizId));
      client.emit('quiz:snapshot', snapshot);

      // Notify the room that the participant has reconnected
      this.server
        .to(this.getQuizRoom(payload.quizId))
        .emit('quiz:participant-reconnected', {
          participantId: participant.id,
          name: participant.name,
        });

      return { ok: true };
    });
  }

  /**
   * Schedule an automatic question lock after `delayMs` milliseconds.
   * If the quiz state is no longer QUESTION_ACTIVE when the timer fires
   * (e.g. host locked manually first), the callback is a no-op.
   */
  private scheduleAutoLock(quizId: string, delayMs: number) {
    this.clearAutoLock(quizId);
    const timer = setTimeout(() => {
      this.questionTimers.delete(quizId);
      try {
        // Only lock if still accepting answers
        const snapshot = this.quizService.lockQuestion(quizId);
        if (snapshot.state !== QuizState.QUESTION_LOCKED) return;
        this.server
          .to(this.getQuizRoom(quizId))
          .emit('quiz:state-changed', snapshot);
        this.server
          .to(this.getQuizRoom(quizId))
          .emit('quiz:question-locked', { quizId, timedOut: true });
      } catch {
        // Quiz may have already moved past this state — ignore
      }
    }, delayMs);
    timer.unref();
    this.questionTimers.set(quizId, timer);
  }

  private clearAutoLock(quizId: string) {
    const existing = this.questionTimers.get(quizId);
    if (existing !== undefined) {
      clearTimeout(existing);
      this.questionTimers.delete(quizId);
    }
  }

  private wrap(client: Socket, callback: () => { ok: true }) {
    try {
      return callback();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unexpected error';
      client.emit('quiz:error', { message });
      return { ok: false, message };
    }
  }

  private assertHost(client: Socket, quizId: string) {
    if (client.data.role !== 'host' || client.data.quizId !== quizId) {
      throw new Error('Host must join the quiz session before controlling it');
    }
  }

  private assertParticipant(client: Socket, quizId: string) {
    if (client.data.role !== 'participant' || client.data.quizId !== quizId) {
      throw new Error(
        'Participant must join the quiz session before submitting',
      );
    }
  }

  private getQuizRoom(quizId: string) {
    return `quiz:${quizId}`;
  }

  private getHostRoom(quizId: string) {
    return `quiz:${quizId}:hosts`;
  }
}
