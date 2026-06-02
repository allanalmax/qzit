import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { io, Socket } from 'socket.io-client';
import request from 'supertest';
import type { Server } from 'node:http';
import { AppModule } from '../src/app.module';

// ── Shared quiz payload ────────────────────────────────────────────────────────

const QUIZ_PAYLOAD = {
  title: 'Gateway Test Quiz',
  mode: 'individual',
  rounds: [
    {
      title: 'Round 1',
      questions: [
        { text: 'Q1', options: ['A', 'B', 'C', 'D'], correctOptionIndex: 0 },
        { text: 'Q2', options: ['A', 'B', 'C', 'D'], correctOptionIndex: 2 },
      ],
    },
  ],
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function waitFor<T>(socket: Socket, event: string, timeout = 4000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timeout waiting for "${event}"`)),
      timeout,
    );
    socket.once(event, (data: T) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

// ── Test suite ─────────────────────────────────────────────────────────────────

describe('QuizGateway (e2e)', () => {
  let app: INestApplication;
  let port: number;
  let authToken: string;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    app.useWebSocketAdapter(new IoAdapter(app));
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.listen(0);
    port = (app.getHttpServer() as Server).address() as unknown as number;
    if (typeof port === 'object')
      port = (port as unknown as { port: number }).port;

    // Register + login to get a JWT for quiz creation
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'gw-host@qzit.test', password: 'password123' })
      .then((r) => {
        if (r.status === 409) {
          // Already registered
        }
      });

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'gw-host@qzit.test', password: 'password123' })
      .expect(200);

    authToken = (loginRes.body as { accessToken: string }).accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  function makeSocket(): Socket {
    return io(`http://localhost:${port}/quiz`, {
      transports: ['websocket'],
      autoConnect: false,
    });
  }

  async function createQuiz(payload = QUIZ_PAYLOAD) {
    const res = await request(app.getHttpServer())
      .post('/quiz')
      .set('Authorization', `Bearer ${authToken}`)
      .send(payload)
      .expect(201);
    return res.body as {
      id: string;
      hostCode: string;
      joinCode: string;
      state: string;
    };
  }

  async function joinQuiz(joinCode: string, name: string, teamName?: string) {
    const body: Record<string, string> = { joinCode, name };
    if (teamName) body.teamName = teamName;
    const res = await request(app.getHttpServer())
      .post('/quiz/join')
      .send(body)
      .expect(201);
    return res.body as { quizId: string; participantId: string; mode: string };
  }

  // ── host:join-session ───────────────────────────────────────────────────────

  describe('host:join-session', () => {
    it('receives quiz:snapshot on valid host code', async () => {
      const quiz = await createQuiz();
      const socket = makeSocket();
      socket.connect();

      const snapshotP = waitFor<{ quizId: string; state: string }>(
        socket,
        'quiz:snapshot',
      );
      socket.emit('host:join-session', {
        quizId: quiz.id,
        hostCode: quiz.hostCode,
      });
      const snapshot = await snapshotP;

      expect(snapshot.quizId).toBe(quiz.id);
      expect(snapshot.state).toBe('created');
      socket.disconnect();
    });

    it('emits quiz:error on invalid host code', async () => {
      const quiz = await createQuiz();
      const socket = makeSocket();
      socket.connect();

      const errorP = waitFor<{ message: string }>(socket, 'quiz:error');
      socket.emit('host:join-session', {
        quizId: quiz.id,
        hostCode: 'BADCOD',
      });
      const error = await errorP;

      expect(error.message).toBeDefined();
      socket.disconnect();
    });
  });

  // ── participant:join-session ─────────────────────────────────────────────────

  describe('participant:join-session', () => {
    it('receives quiz:snapshot', async () => {
      const quiz = await createQuiz();
      const joined = await joinQuiz(quiz.joinCode, 'Alice');
      const socket = makeSocket();
      socket.connect();

      const snapshotP = waitFor<{ quizId: string; participantCount: number }>(
        socket,
        'quiz:snapshot',
      );
      socket.emit('participant:join-session', {
        quizId: quiz.id,
        participantId: joined.participantId,
      });
      const snapshot = await snapshotP;

      expect(snapshot.quizId).toBe(quiz.id);
      expect(snapshot.participantCount).toBe(1);
      socket.disconnect();
    });
  });

  // ── Full gameplay loop ───────────────────────────────────────────────────────

  describe('full gameplay loop (individual)', () => {
    let quiz: { id: string; hostCode: string; joinCode: string };
    let participantId: string;
    let hostSocket: Socket;
    let participantSocket: Socket;

    beforeAll(async () => {
      quiz = await createQuiz();
      const joined = await joinQuiz(quiz.joinCode, 'Alice');
      participantId = joined.participantId;

      hostSocket = makeSocket();
      participantSocket = makeSocket();

      hostSocket.connect();
      const hostSnapshotP = waitFor(hostSocket, 'quiz:snapshot');
      hostSocket.emit('host:join-session', {
        quizId: quiz.id,
        hostCode: quiz.hostCode,
      });
      await hostSnapshotP;

      participantSocket.connect();
      const participantSnapshotP = waitFor(participantSocket, 'quiz:snapshot');
      participantSocket.emit('participant:join-session', {
        quizId: quiz.id,
        participantId,
      });
      await participantSnapshotP;
    });

    afterAll(() => {
      hostSocket.disconnect();
      participantSocket.disconnect();
    });

    it('host:start-quiz → both receive quiz:state-changed with state=waiting', async () => {
      const hostChange = waitFor<{ state: string }>(
        hostSocket,
        'quiz:state-changed',
      );
      const participantChange = waitFor<{ state: string }>(
        participantSocket,
        'quiz:state-changed',
      );

      hostSocket.emit('host:start-quiz', { quizId: quiz.id });

      const [hs, ps] = await Promise.all([hostChange, participantChange]);
      expect(hs.state).toBe('waiting');
      expect(ps.state).toBe('waiting');
    });

    it('host:start-question → state-changed + question-activated; no correctOptionIndex for participant', async () => {
      const hostStateChange = waitFor<{ state: string }>(
        hostSocket,
        'quiz:state-changed',
      );
      const hostQuestion = waitFor<{
        text: string;
        correctOptionIndex?: number;
      }>(hostSocket, 'quiz:question-activated');
      const participantStateChange = waitFor<{ state: string }>(
        participantSocket,
        'quiz:state-changed',
      );
      const participantQuestion = waitFor<{ correctOptionIndex?: number }>(
        participantSocket,
        'quiz:question-activated',
      );

      hostSocket.emit('host:start-question', { quizId: quiz.id });

      const [hs, hq, ps, pq] = await Promise.all([
        hostStateChange,
        hostQuestion,
        participantStateChange,
        participantQuestion,
      ]);

      expect(hs.state).toBe('question_active');
      expect(ps.state).toBe('question_active');
      expect(hq.text).toBe('Q1');
      expect(pq.correctOptionIndex).toBeUndefined();
    });

    it('participant:submit-answer → quiz:answer-submitted + host gets quiz:submission-count', async () => {
      const answerSubmitted = waitFor<{
        questionId: string;
        submissionId: string;
      }>(participantSocket, 'quiz:answer-submitted');
      const submissionCount = waitFor<{ count: number }>(
        hostSocket,
        'quiz:submission-count',
      );

      participantSocket.emit('participant:submit-answer', {
        quizId: quiz.id,
        selectedOptionIndex: 0,
      });

      const [ans, cnt] = await Promise.all([answerSubmitted, submissionCount]);
      expect(ans.submissionId).toBeDefined();
      expect(cnt.count).toBe(1);
    });

    it('host:lock-question → state-changed + quiz:question-locked', async () => {
      const hostChange = waitFor<{ state: string }>(
        hostSocket,
        'quiz:state-changed',
      );
      const participantChange = waitFor<{ state: string }>(
        participantSocket,
        'quiz:state-changed',
      );
      const hostLocked = waitFor(hostSocket, 'quiz:question-locked');
      const participantLocked = waitFor(
        participantSocket,
        'quiz:question-locked',
      );

      hostSocket.emit('host:lock-question', { quizId: quiz.id });

      const [hs, ps] = await Promise.all([
        hostChange,
        participantChange,
        hostLocked,
        participantLocked,
      ]);
      expect(hs.state).toBe('question_locked');
      expect(ps.state).toBe('question_locked');
    });

    it('host:reveal-answer → state-changed + quiz:answer-revealed with correctOptionIndex', async () => {
      const hostChange = waitFor<{ state: string }>(
        hostSocket,
        'quiz:state-changed',
      );
      const hostRevealed = waitFor<{
        question: { correctOptionIndex: number };
      }>(hostSocket, 'quiz:answer-revealed');
      const participantChange = waitFor<{ state: string }>(
        participantSocket,
        'quiz:state-changed',
      );
      const participantRevealed = waitFor<{
        question: { correctOptionIndex: number };
      }>(participantSocket, 'quiz:answer-revealed');

      hostSocket.emit('host:reveal-answer', { quizId: quiz.id });

      const [hs, hr, ps, pr] = await Promise.all([
        hostChange,
        hostRevealed,
        participantChange,
        participantRevealed,
      ]);
      expect(hs.state).toBe('answer_revealed');
      expect(ps.state).toBe('answer_revealed');
      expect(hr.question.correctOptionIndex).toBe(0);
      expect(pr.question.correctOptionIndex).toBe(0);
    });

    it('host:show-leaderboard → quiz:leaderboard with Alice scoring 1', async () => {
      const hostLeaderboard = waitFor<{
        rankings: { name: string; score: number }[];
      }>(hostSocket, 'quiz:leaderboard');
      const participantLeaderboard = waitFor<{
        rankings: { name: string; score: number }[];
      }>(participantSocket, 'quiz:leaderboard');

      hostSocket.emit('host:show-leaderboard', { quizId: quiz.id });

      const [hl, pl] = await Promise.all([
        hostLeaderboard,
        participantLeaderboard,
      ]);
      expect(hl.rankings).toHaveLength(1);
      expect(hl.rankings[0].score).toBe(1);
      expect(pl.rankings).toHaveLength(1);
    });

    it('host starts Q2, locks, reveals, leaderboard shows hasNextQuestion=false then ends quiz', async () => {
      // Q2 start
      hostSocket.emit('host:start-question', { quizId: quiz.id });
      await waitFor(hostSocket, 'quiz:question-activated');

      // lock
      hostSocket.emit('host:lock-question', { quizId: quiz.id });
      await waitFor(hostSocket, 'quiz:question-locked');

      // reveal
      hostSocket.emit('host:reveal-answer', { quizId: quiz.id });
      await waitFor(hostSocket, 'quiz:answer-revealed');

      // leaderboard — no more questions after Q2
      const lbP = waitFor<{ hasNextQuestion: boolean }>(
        hostSocket,
        'quiz:leaderboard',
      );
      hostSocket.emit('host:show-leaderboard', { quizId: quiz.id });
      const lb = await lbP;
      expect(lb.hasNextQuestion).toBe(false);

      // end
      const endedP = waitFor<{ leaderboard: unknown[] }>(
        hostSocket,
        'quiz:ended',
      );
      hostSocket.emit('host:end-quiz', { quizId: quiz.id });
      const ended = await endedP;
      expect(ended.leaderboard).toBeDefined();
    });
  });

  // ── Error paths ──────────────────────────────────────────────────────────────

  describe('error paths', () => {
    it('submit answer when not in QUESTION_ACTIVE emits quiz:error', async () => {
      const quiz = await createQuiz();
      const joined = await joinQuiz(quiz.joinCode, 'Bob');
      const socket = makeSocket();
      socket.connect();

      const snapshotP = waitFor(socket, 'quiz:snapshot');
      socket.emit('participant:join-session', {
        quizId: quiz.id,
        participantId: joined.participantId,
      });
      await snapshotP;

      const errorP = waitFor<{ message: string }>(socket, 'quiz:error');
      socket.emit('participant:submit-answer', {
        quizId: quiz.id,
        selectedOptionIndex: 0,
      });
      const error = await errorP;

      expect(error.message).toContain('active question');
      socket.disconnect();
    });

    it('duplicate submission emits quiz:error', async () => {
      const quiz = await createQuiz();
      const joined = await joinQuiz(quiz.joinCode, 'Charlie');

      const hostSock = makeSocket();
      const participantSock = makeSocket();
      hostSock.connect();
      participantSock.connect();

      const hostSnapshotP = waitFor(hostSock, 'quiz:snapshot');
      hostSock.emit('host:join-session', {
        quizId: quiz.id,
        hostCode: quiz.hostCode,
      });
      await hostSnapshotP;

      const participantSnapshotP = waitFor(participantSock, 'quiz:snapshot');
      participantSock.emit('participant:join-session', {
        quizId: quiz.id,
        participantId: joined.participantId,
      });
      await participantSnapshotP;

      hostSock.emit('host:start-quiz', { quizId: quiz.id });
      await waitFor(hostSock, 'quiz:state-changed');

      hostSock.emit('host:start-question', { quizId: quiz.id });
      await waitFor(hostSock, 'quiz:question-activated');

      // first submission succeeds
      const firstAns = waitFor(participantSock, 'quiz:answer-submitted');
      participantSock.emit('participant:submit-answer', {
        quizId: quiz.id,
        selectedOptionIndex: 1,
      });
      await firstAns;

      // second submission triggers error
      const errorP = waitFor<{ message: string }>(
        participantSock,
        'quiz:error',
      );
      participantSock.emit('participant:submit-answer', {
        quizId: quiz.id,
        selectedOptionIndex: 2,
      });
      const error = await errorP;

      expect(error.message).toContain('already submitted');
      hostSock.disconnect();
      participantSock.disconnect();
    });

    it('non-captain submit in team mode emits quiz:error', async () => {
      const quiz = await createQuiz({ ...QUIZ_PAYLOAD, mode: 'team' });
      await joinQuiz(quiz.joinCode, 'Captain', 'Team A');
      const member = await joinQuiz(quiz.joinCode, 'Member', 'Team A');

      const hostSock = makeSocket();
      const memberSock = makeSocket();
      hostSock.connect();
      memberSock.connect();

      const hostSnapshotP = waitFor(hostSock, 'quiz:snapshot');
      hostSock.emit('host:join-session', {
        quizId: quiz.id,
        hostCode: quiz.hostCode,
      });
      await hostSnapshotP;

      const memberSnapshotP = waitFor(memberSock, 'quiz:snapshot');
      memberSock.emit('participant:join-session', {
        quizId: quiz.id,
        participantId: member.participantId,
      });
      await memberSnapshotP;

      hostSock.emit('host:start-quiz', { quizId: quiz.id });
      await waitFor(hostSock, 'quiz:state-changed');
      hostSock.emit('host:start-question', { quizId: quiz.id });
      await waitFor(hostSock, 'quiz:question-activated');

      const errorP = waitFor<{ message: string }>(memberSock, 'quiz:error');
      memberSock.emit('participant:submit-answer', {
        quizId: quiz.id,
        selectedOptionIndex: 0,
      });
      const error = await errorP;

      expect(error.message).toContain('captain');
      hostSock.disconnect();
      memberSock.disconnect();
    });
  });

  // ── Auto-lock timer ──────────────────────────────────────────────────────────

  describe('auto-lock timer', () => {
    it('question is auto-locked after timeLimitSeconds with timedOut=true', async () => {
      // Create a quiz with a 1-second time limit
      const quiz = await createQuiz({
        ...QUIZ_PAYLOAD,
        rounds: [
          {
            title: 'Speed Round',
            questions: [
              {
                text: 'Fast Q',
                options: ['A', 'B', 'C', 'D'],
                correctOptionIndex: 0,
                timeLimitSeconds: 1,
              } as Record<string, unknown>,
            ],
          },
        ],
      } as typeof QUIZ_PAYLOAD);
      const joined = await joinQuiz(quiz.joinCode, 'Speedy');

      const hostSock = makeSocket();
      const participantSock = makeSocket();
      hostSock.connect();
      participantSock.connect();

      const hostSnapshotP = waitFor(hostSock, 'quiz:snapshot');
      hostSock.emit('host:join-session', {
        quizId: quiz.id,
        hostCode: quiz.hostCode,
      });
      await hostSnapshotP;

      const participantSnapshotP = waitFor(participantSock, 'quiz:snapshot');
      participantSock.emit('participant:join-session', {
        quizId: quiz.id,
        participantId: joined.participantId,
      });
      await participantSnapshotP;

      hostSock.emit('host:start-quiz', { quizId: quiz.id });
      await waitFor(hostSock, 'quiz:state-changed');

      hostSock.emit('host:start-question', { quizId: quiz.id });
      await waitFor(hostSock, 'quiz:question-activated');

      // Wait for auto-lock (up to 3s — 1s timer + buffer)
      const lockedEvent = await waitFor<{ quizId: string; timedOut?: boolean }>(
        hostSock,
        'quiz:question-locked',
        3000,
      );
      expect(lockedEvent.timedOut).toBe(true);

      hostSock.disconnect();
      participantSock.disconnect();
    }, 8000);

    it('manual lock cancels the timer (no double-lock error)', async () => {
      const quiz = await createQuiz({
        ...QUIZ_PAYLOAD,
        rounds: [
          {
            title: 'R',
            questions: [
              {
                text: 'Q',
                options: ['A', 'B', 'C', 'D'],
                correctOptionIndex: 0,
                timeLimitSeconds: 2,
              } as Record<string, unknown>,
            ],
          },
        ],
      } as typeof QUIZ_PAYLOAD);
      const joined = await joinQuiz(quiz.joinCode, 'Tester');

      const hostSock = makeSocket();
      const participantSock = makeSocket();
      hostSock.connect();
      participantSock.connect();

      const hSnap = waitFor(hostSock, 'quiz:snapshot');
      hostSock.emit('host:join-session', {
        quizId: quiz.id,
        hostCode: quiz.hostCode,
      });
      await hSnap;

      const pSnap = waitFor(participantSock, 'quiz:snapshot');
      participantSock.emit('participant:join-session', {
        quizId: quiz.id,
        participantId: joined.participantId,
      });
      await pSnap;

      hostSock.emit('host:start-quiz', { quizId: quiz.id });
      await waitFor(hostSock, 'quiz:state-changed');

      hostSock.emit('host:start-question', { quizId: quiz.id });
      await waitFor(hostSock, 'quiz:question-activated');

      // Manually lock before the 2s timer fires
      const lockedManually = waitFor<{ timedOut?: boolean }>(
        hostSock,
        'quiz:question-locked',
      );
      hostSock.emit('host:lock-question', { quizId: quiz.id });
      const locked = await lockedManually;

      // No timedOut flag on manual lock
      expect(locked.timedOut).toBeUndefined();

      // No quiz:error should arrive within the timer window
      let errorReceived = false;
      hostSock.once('quiz:error', () => {
        errorReceived = true;
      });
      await new Promise((r) => setTimeout(r, 2500));
      expect(errorReceived).toBe(false);

      hostSock.disconnect();
      participantSock.disconnect();
    }, 10000);
  });

  // ── Reconnect (participant:rejoin-session) ───────────────────────────────────

  describe('participant:rejoin-session', () => {
    it('receives current snapshot on rejoin', async () => {
      const quiz = await createQuiz();
      const joined = await joinQuiz(quiz.joinCode, 'Rejoin Alice');

      // Join once
      const sock1 = makeSocket();
      sock1.connect();
      const snap1P = waitFor<{ participantCount: number }>(
        sock1,
        'quiz:snapshot',
      );
      sock1.emit('participant:join-session', {
        quizId: quiz.id,
        participantId: joined.participantId,
      });
      await snap1P;
      sock1.disconnect();

      // Reconnect using rejoin event
      const sock2 = makeSocket();
      sock2.connect();
      const snap2P = waitFor<{ quizId: string; participantCount: number }>(
        sock2,
        'quiz:snapshot',
      );
      sock2.emit('participant:rejoin-session', {
        quizId: quiz.id,
        participantId: joined.participantId,
      });
      const snap2 = await snap2P;

      expect(snap2.quizId).toBe(quiz.id);
      expect(snap2.participantCount).toBe(1);
      sock2.disconnect();
    });

    it('emits quiz:participant-reconnected to the room', async () => {
      const quiz = await createQuiz();
      const joined = await joinQuiz(quiz.joinCode, 'Bob');

      // Host socket so it's in the room to receive the broadcast
      const hostSock = makeSocket();
      hostSock.connect();
      const hSnap = waitFor(hostSock, 'quiz:snapshot');
      hostSock.emit('host:join-session', {
        quizId: quiz.id,
        hostCode: quiz.hostCode,
      });
      await hSnap;

      const sock = makeSocket();
      sock.connect();
      sock.emit('participant:join-session', {
        quizId: quiz.id,
        participantId: joined.participantId,
      });
      await waitFor(sock, 'quiz:snapshot');
      sock.disconnect();

      // Reconnect
      const sock2 = makeSocket();
      sock2.connect();
      const reconnectedP = waitFor<{ participantId: string; name: string }>(
        hostSock,
        'quiz:participant-reconnected',
      );
      sock2.emit('participant:rejoin-session', {
        quizId: quiz.id,
        participantId: joined.participantId,
      });
      const reconnected = await reconnectedP;

      expect(reconnected.name).toBe('Bob');
      hostSock.disconnect();
      sock2.disconnect();
    });

    it('emits quiz:error when participant not found', async () => {
      const quiz = await createQuiz();
      const sock = makeSocket();
      sock.connect();

      const errorP = waitFor<{ message: string }>(sock, 'quiz:error');
      sock.emit('participant:rejoin-session', {
        quizId: quiz.id,
        participantId: 'no-such-participant',
      });
      const error = await errorP;

      expect(error.message).toBeDefined();
      sock.disconnect();
    });
  });
});
