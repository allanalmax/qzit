import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

// ── Shared fixture ─────────────────────────────────────────────────────────────

const HOST_CREDS = { email: 'host@qzit.test', password: 'password123' };

const VALID_QUIZ = {
  title: 'Friday Night Trivia',
  mode: 'individual',
  rounds: [
    {
      title: 'General Knowledge',
      questions: [
        {
          text: 'What is the capital of Kenya?',
          options: ['Nairobi', 'Kampala', 'Kigali', 'Dodoma'],
          correctOptionIndex: 0,
        },
      ],
    },
  ],
};

const TEAM_QUIZ = { ...VALID_QUIZ, mode: 'team' };

// ── Test suite ─────────────────────────────────────────────────────────────────

describe('QuizController (e2e)', () => {
  let app: INestApplication<App>;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    // Register + login to get a JWT for all host-protected tests
    await request(app.getHttpServer())
      .post('/auth/register')
      .send(HOST_CREDS)
      .then((r) => {
        if (r.status === 409) {
          // Already registered from a previous run; just login
        }
      });

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send(HOST_CREDS)
      .expect(200);

    authToken = (loginRes.body as { accessToken: string }).accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  // ── POST /auth/register + POST /auth/login ─────────────────────────────────

  describe('POST /auth/register', () => {
    it('returns 409 when email already registered', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send(HOST_CREDS)
        .expect(409);
    });

    it('returns 400 when password is too short', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'new@qzit.test', password: 'short' })
        .expect(400);
    });
  });

  describe('POST /auth/login', () => {
    it('returns accessToken for valid credentials', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send(HOST_CREDS)
        .expect(200)
        .expect(({ body }) => {
          expect(typeof (body as { accessToken: string }).accessToken).toBe(
            'string',
          );
        });
    });

    it('returns 401 for wrong password', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: HOST_CREDS.email, password: 'wrongpassword' })
        .expect(401);
    });
  });

  // ── POST /quiz ─────────────────────────────────────────────────────────────

  describe('POST /quiz', () => {
    it('creates a quiz and returns expected shape', () => {
      return request(app.getHttpServer())
        .post('/quiz')
        .set('Authorization', `Bearer ${authToken}`)
        .send(VALID_QUIZ)
        .expect(201)
        .expect(({ body }) => {
          expect(body.id).toBeDefined();
          expect(body.hostCode).toHaveLength(6);
          expect(body.joinCode).toHaveLength(6);
          expect(body.state).toBe('created');
          expect(body.title).toBe('Friday Night Trivia');
          expect(body.mode).toBe('individual');
        });
    });

    it('creates a team quiz', () => {
      return request(app.getHttpServer())
        .post('/quiz')
        .set('Authorization', `Bearer ${authToken}`)
        .send(TEAM_QUIZ)
        .expect(201)
        .expect(({ body }) => {
          expect(body.mode).toBe('team');
          expect(body.state).toBe('created');
        });
    });

    it('returns 401 when no token provided', () => {
      return request(app.getHttpServer())
        .post('/quiz')
        .send(VALID_QUIZ)
        .expect(401);
    });

    it('returns 400 when title is missing', () => {
      const { title: _t, ...noTitle } = VALID_QUIZ;
      return request(app.getHttpServer())
        .post('/quiz')
        .set('Authorization', `Bearer ${authToken}`)
        .send(noTitle)
        .expect(400);
    });

    it('returns 400 when rounds is empty', () => {
      return request(app.getHttpServer())
        .post('/quiz')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ ...VALID_QUIZ, rounds: [] })
        .expect(400);
    });

    it('returns 400 when questions is empty', () => {
      return request(app.getHttpServer())
        .post('/quiz')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          ...VALID_QUIZ,
          rounds: [{ title: 'R1', questions: [] }],
        })
        .expect(400);
    });

    it('returns 400 when options array does not have exactly 4 items', () => {
      return request(app.getHttpServer())
        .post('/quiz')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          ...VALID_QUIZ,
          rounds: [
            {
              title: 'R1',
              questions: [
                {
                  text: 'Q',
                  options: ['A', 'B'],
                  correctOptionIndex: 0,
                },
              ],
            },
          ],
        })
        .expect(400);
    });
  });

  // ── GET /quiz/:id ──────────────────────────────────────────────────────────

  describe('GET /quiz/:id', () => {
    it('returns quiz by id', async () => {
      const created = await request(app.getHttpServer())
        .post('/quiz')
        .set('Authorization', `Bearer ${authToken}`)
        .send(VALID_QUIZ)
        .expect(201)
        .then((r) => r.body as { id: string });

      return request(app.getHttpServer())
        .get(`/quiz/${created.id}`)
        .expect(200)
        .expect(({ body }) => {
          expect(body.id).toBe(created.id);
        });
    });

    it('returns 404 for unknown id', () => {
      return request(app.getHttpServer()).get('/quiz/no-such-id').expect(404);
    });
  });

  // ── GET /quiz/lookup/:joinCode ─────────────────────────────────────────────

  describe('GET /quiz/lookup/:joinCode', () => {
    it('returns participant-safe quiz info', async () => {
      const created = await request(app.getHttpServer())
        .post('/quiz')
        .set('Authorization', `Bearer ${authToken}`)
        .send(VALID_QUIZ)
        .expect(201)
        .then((r) => r.body as { id: string; joinCode: string });

      return request(app.getHttpServer())
        .get(`/quiz/lookup/${created.joinCode}`)
        .expect(200)
        .expect(({ body }) => {
          expect(body.quizId).toBe(created.id);
          expect(body.mode).toBe('individual');
          expect(body.teams).toEqual([]);
          expect(body).not.toHaveProperty('hostCode');
        });
    });

    it('returns 404 for unknown join code', () => {
      return request(app.getHttpServer())
        .get('/quiz/lookup/XXXXXX')
        .expect(404);
    });
  });

  // ── POST /quiz/join ────────────────────────────────────────────────────────

  describe('POST /quiz/join', () => {
    it('joins individual quiz', async () => {
      const created = await request(app.getHttpServer())
        .post('/quiz')
        .set('Authorization', `Bearer ${authToken}`)
        .send(VALID_QUIZ)
        .expect(201)
        .then((r) => r.body as { joinCode: string; id: string });

      return request(app.getHttpServer())
        .post('/quiz/join')
        .send({ joinCode: created.joinCode, name: 'Alice' })
        .expect(201)
        .expect(({ body }) => {
          expect(body.quizId).toBe(created.id);
          expect(body.participantId).toBeDefined();
          expect(body.participantName).toBe('Alice');
          expect(body.mode).toBe('individual');
          expect(body.isCaptain).toBe(false);
        });
    });

    it('joins team quiz as captain (first joiner)', async () => {
      const created = await request(app.getHttpServer())
        .post('/quiz')
        .set('Authorization', `Bearer ${authToken}`)
        .send(TEAM_QUIZ)
        .expect(201)
        .then((r) => r.body as { joinCode: string; id: string });

      return request(app.getHttpServer())
        .post('/quiz/join')
        .send({ joinCode: created.joinCode, name: 'Alice', teamName: 'Alpha' })
        .expect(201)
        .expect(({ body }) => {
          expect(body.isCaptain).toBe(true);
          expect(body.teamId).toBeDefined();
        });
    });

    it('returns 404 for unknown join code', () => {
      return request(app.getHttpServer())
        .post('/quiz/join')
        .send({ joinCode: 'XXXXXX', name: 'Alice' })
        .expect(404);
    });

    it('returns 400 when name is missing', async () => {
      const created = await request(app.getHttpServer())
        .post('/quiz')
        .set('Authorization', `Bearer ${authToken}`)
        .send(VALID_QUIZ)
        .expect(201)
        .then((r) => r.body as { joinCode: string });

      return request(app.getHttpServer())
        .post('/quiz/join')
        .send({ joinCode: created.joinCode })
        .expect(400);
    });

    it('returns 400 when teamName is missing for team quiz', async () => {
      const created = await request(app.getHttpServer())
        .post('/quiz')
        .set('Authorization', `Bearer ${authToken}`)
        .send(TEAM_QUIZ)
        .expect(201)
        .then((r) => r.body as { joinCode: string });

      return request(app.getHttpServer())
        .post('/quiz/join')
        .send({ joinCode: created.joinCode, name: 'Alice' })
        .expect(400);
    });
  });

  // ── GET /quiz/my ───────────────────────────────────────────────────────────

  describe('GET /quiz/my', () => {
    it('returns only quizzes owned by the authenticated host', async () => {
      // Create two quizzes under the shared authToken host
      await request(app.getHttpServer())
        .post('/quiz')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ ...VALID_QUIZ, title: 'My Quiz A' })
        .expect(201);

      await request(app.getHttpServer())
        .post('/quiz')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ ...VALID_QUIZ, title: 'My Quiz B' })
        .expect(201);

      return request(app.getHttpServer())
        .get('/quiz/my')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect(({ body }) => {
          const titles = (body as { title: string }[]).map((q) => q.title);
          expect(titles).toContain('My Quiz A');
          expect(titles).toContain('My Quiz B');
        });
    });

    it('returns 401 when no token provided', () => {
      return request(app.getHttpServer()).get('/quiz/my').expect(401);
    });

    it('returned quizzes have expected summary fields', async () => {
      return request(app.getHttpServer())
        .get('/quiz/my')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect(({ body }) => {
          const quizzes = body as {
            id: string;
            title: string;
            mode: string;
            state: string;
            joinCode: string;
            participantCount: number;
            createdAt: string;
          }[];
          expect(quizzes.length).toBeGreaterThan(0);
          const q = quizzes[0];
          expect(q.id).toBeDefined();
          expect(q.joinCode).toBeDefined();
          expect(typeof q.participantCount).toBe('number');
          expect(q.createdAt).toBeDefined();
        });
    });
  });

  // ── PATCH /quiz/:id ────────────────────────────────────────────────────────

  describe('PATCH /quiz/:id', () => {
    it('updates the title', async () => {
      const created = await request(app.getHttpServer())
        .post('/quiz')
        .set('Authorization', `Bearer ${authToken}`)
        .send(VALID_QUIZ)
        .expect(201)
        .then((r) => r.body as { id: string });

      return request(app.getHttpServer())
        .patch(`/quiz/${created.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Updated Title' })
        .expect(200)
        .expect(({ body }) => {
          expect((body as { title: string }).title).toBe('Updated Title');
        });
    });

    it('replaces rounds', async () => {
      const created = await request(app.getHttpServer())
        .post('/quiz')
        .set('Authorization', `Bearer ${authToken}`)
        .send(VALID_QUIZ)
        .expect(201)
        .then((r) => r.body as { id: string });

      const newRounds = [
        {
          title: 'Brand New Round',
          questions: [
            {
              text: 'New question?',
              options: ['W', 'X', 'Y', 'Z'],
              correctOptionIndex: 2,
            },
          ],
        },
      ];

      return request(app.getHttpServer())
        .patch(`/quiz/${created.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ rounds: newRounds })
        .expect(200)
        .expect(({ body }) => {
          const rounds = (body as { rounds: { title: string }[] }).rounds;
          expect(rounds).toHaveLength(1);
          expect(rounds[0].title).toBe('Brand New Round');
        });
    });

    it('returns 401 when not authenticated', async () => {
      const created = await request(app.getHttpServer())
        .post('/quiz')
        .set('Authorization', `Bearer ${authToken}`)
        .send(VALID_QUIZ)
        .expect(201)
        .then((r) => r.body as { id: string });

      return request(app.getHttpServer())
        .patch(`/quiz/${created.id}`)
        .send({ title: 'X' })
        .expect(401);
    });

    it('returns 404 for unknown quiz', () => {
      return request(app.getHttpServer())
        .patch('/quiz/no-such-id')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'X' })
        .expect(404);
    });

    it('returns 400 when rounds is empty array', async () => {
      const created = await request(app.getHttpServer())
        .post('/quiz')
        .set('Authorization', `Bearer ${authToken}`)
        .send(VALID_QUIZ)
        .expect(201)
        .then((r) => r.body as { id: string });

      return request(app.getHttpServer())
        .patch(`/quiz/${created.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ rounds: [] })
        .expect(400);
    });
  });

  // ── GET /quiz/:id/results ──────────────────────────────────────────────────

  describe('GET /quiz/:id/results', () => {
    it('returns results shape for any quiz state', async () => {
      const created = await request(app.getHttpServer())
        .post('/quiz')
        .set('Authorization', `Bearer ${authToken}`)
        .send(VALID_QUIZ)
        .expect(201)
        .then((r) => r.body as { id: string });

      return request(app.getHttpServer())
        .get(`/quiz/${created.id}/results`)
        .expect(200)
        .expect(({ body }) => {
          const res = body as {
            quizId: string;
            title: string;
            mode: string;
            state: string;
            rounds: unknown[];
            leaderboard: unknown[];
            participantScoreHistory: unknown[];
          };
          expect(res.quizId).toBe(created.id);
          expect(res.title).toBe('Friday Night Trivia');
          expect(res.rounds).toHaveLength(1);
          expect(Array.isArray(res.leaderboard)).toBe(true);
          expect(Array.isArray(res.participantScoreHistory)).toBe(true);
        });
    });

    it('includes per-question option counts', async () => {
      const created = await request(app.getHttpServer())
        .post('/quiz')
        .set('Authorization', `Bearer ${authToken}`)
        .send(VALID_QUIZ)
        .expect(201)
        .then((r) => r.body as { id: string });

      return request(app.getHttpServer())
        .get(`/quiz/${created.id}/results`)
        .expect(200)
        .expect(({ body }) => {
          const q = (
            body as { rounds: { questions: { optionCounts: number[] }[] }[] }
          ).rounds[0].questions[0];
          expect(Array.isArray(q.optionCounts)).toBe(true);
          expect(q.optionCounts).toHaveLength(4); // 4 options in VALID_QUIZ
        });
    });

    it('returns 404 for unknown quiz', () => {
      return request(app.getHttpServer())
        .get('/quiz/no-such-id/results')
        .expect(404);
    });

    it('does not require authentication', async () => {
      const created = await request(app.getHttpServer())
        .post('/quiz')
        .set('Authorization', `Bearer ${authToken}`)
        .send(VALID_QUIZ)
        .expect(201)
        .then((r) => r.body as { id: string });

      // No Authorization header
      return request(app.getHttpServer())
        .get(`/quiz/${created.id}/results`)
        .expect(200);
    });
  });
});
