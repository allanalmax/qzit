# QZIT — Persistence, Auth & Host Features Requirements

## Project Context

QZIT is a real-time live quiz platform. The current MVP is fully functional with:

- **Backend:** NestJS 11, TypeScript, Socket.IO (namespace `/quiz`), in-memory `Map`-based `QuizStore`
- **Frontend:** React 18, TypeScript, Vite 5, Tailwind CSS v4, socket.io-client, react-router-dom
- **Quiz state machine:** `created → waiting → question_active → question_locked → answer_revealed → leaderboard → ended`
- **Quiz modes:** `individual` and `team` (captain submits for team)
- **Current storage:** All data lives in a `Map<string, Quiz>` inside `QuizStore` (injectable NestJS service). Lost on restart.

The goal is to add real persistence, host authentication, and host-facing features while preserving the existing real-time gameplay flow.

---

## Tier 1: Database Persistence

### Requirements

1. **Add a database** — Use PostgreSQL with Prisma ORM (or TypeORM if preferred). Define schema for:
   - `Quiz` — id, title, mode, state, hostCode, joinCode, createdAt, updatedAt, hostId (FK to User)
   - `Round` — id, title, quizId (FK), sortOrder
   - `Question` — id, text, options (JSON array of strings), correctOptionIndex, timeLimitSeconds, roundId (FK), sortOrder
   - `Participant` — id, name, teamId (nullable FK), isCaptain, score, quizId (FK), joinedAt
   - `Team` — id, name, quizId (FK), captainId, score, joinedAt
   - `Submission` — id, participantId (FK), questionId (FK), selectedOptionIndex, isCorrect, answeredAt, pointsAwarded

2. **Replace `QuizStore`** — Swap the in-memory Map with a repository/service that reads/writes from the database. The `QuizStore` is injected throughout the codebase — maintain the same interface or adapt callers.

3. **Hot state cache** — Active quizzes (state != `ended`) should be cached in memory for real-time performance. The database is the source of truth; writes go to both cache and DB. Ended quizzes can be evicted from cache.

4. **Migration strategy** — Provide Prisma migrations (or TypeORM migrations) that can be run with a single command.

### Current files to modify

- `src/quiz/quiz.store.ts` — Replace or wrap with DB-backed implementation
- `src/quiz/quiz.service.ts` — ~600 lines, all business logic. Uses `this.quizStore.findById()`, `this.quizStore.findByJoinCode()`, `this.quizStore.create()`, `this.quizStore.update()`
- `src/quiz/quiz.gateway.ts` — Socket.IO gateway, reads quiz state via service methods
- `src/quiz/domain/quiz.model.ts` — Current domain interfaces (`Quiz`, `Round`, `Question`)
- `src/quiz/domain/participant.model.ts` — `Participant` and `Team` interfaces
- `src/quiz/domain/submission.model.ts` — `Submission` interface

### Constraints

- The quiz state machine transitions must remain unchanged
- Socket.IO events and their payloads must remain backward-compatible with the frontend
- `participants` and `teams` are currently `Map<string, T>` on the Quiz object — these need to become DB relations
- `submissions` is currently `Map<string, Submission[]>` keyed by question ID

---

## Tier 2: Host Authentication

### Requirements

1. **User model** — `User` table: id, email, passwordHash, displayName, createdAt
2. **Auth endpoints:**
   - `POST /auth/register` — email, password, displayName → returns JWT
   - `POST /auth/login` — email, password → returns JWT
   - `GET /auth/me` — returns current user profile (requires valid JWT)
3. **JWT strategy** — Use `@nestjs/jwt` + `@nestjs/passport` with a JWT guard. Access token in Authorization header.
4. **Quiz ownership** — `POST /quiz` (create quiz) requires auth. Associates quiz with `hostId`. Other quiz endpoints (join, lookup) remain public.
5. **Host code removal (optional)** — Once auth exists, the `hostCode` becomes redundant for host identification. Can keep it as a secondary access mechanism or remove it.

### Frontend auth flow

- Add `/login` and `/register` pages
- Store JWT in localStorage
- Add auth context/provider that exposes `user`, `login()`, `register()`, `logout()`
- Protect `/create` and `/host/:quizId` routes — redirect to `/login` if not authenticated
- Landing page CTAs: "Host a Quiz" checks auth before navigating to `/create`

### Current files to modify

- `src/quiz/quiz.controller.ts` — Add auth guard to `POST /quiz`
- `client/src/App.tsx` — Add login/register routes, wrap with auth provider
- `client/src/pages/CreateQuizPage.tsx` — Ensure authenticated before rendering
- `client/src/pages/HostDashboard.tsx` — Verify host owns the quiz

---

## Tier 3: Host Dashboard & Quiz Management

### Requirements

1. **Host dashboard page (`/dashboard`)**
   - Lists all quizzes created by the authenticated host
   - Shows: title, mode, state, participant count, created date
   - Actions per quiz: Resume (if active), View Results (if ended), Duplicate, Delete
   - "Create New Quiz" button → `/create`

2. **Quiz editing** — `PUT /quiz/:id` endpoint (host-only). Allow editing title, rounds, questions while quiz is in `created` state. Once started, no edits.

3. **Quiz duplication** — `POST /quiz/:id/duplicate` — Creates a new quiz with the same rounds/questions, new join code, state = `created`.

4. **Results export** — `GET /quiz/:id/results` — Returns per-question breakdown and final leaderboard as JSON. Frontend can render a results page or offer CSV download.

### Frontend

- `client/src/pages/DashboardPage.tsx` — New page
- Update `client/src/App.tsx` — Add `/dashboard` route
- Host "Back to Dashboard" button (currently goes to `/create`) → change to `/dashboard`
- After creating a quiz, store in dashboard context (no more localStorage hack needed)

---

## Tier 4: Gameplay Polish (Optional / Lower Priority)

These are independent of Tiers 1–3 and can be done in any order:

1. **Server-side timer** — When a question starts, server sets a timeout that auto-transitions to `question_locked` when `timeLimitSeconds` expires. Emit countdown ticks to clients.

2. **Participant reconnection** — On socket disconnect, keep participant in DB. On reconnect with same `participantId`, re-associate socket and send current snapshot.

3. **Question media** — Add optional `imageUrl` field to Question. Display in both host and participant views.

4. **Spectator mode** — Allow joining a quiz as view-only after it has started. See questions and leaderboard but can't submit answers.

---

## Architecture Notes

### Current project structure

```
QZIT/
├── src/                          # NestJS backend
│   └── quiz/
│       ├── domain/               # Interfaces: quiz.model, participant.model, submission.model, quiz-state.enum, quiz-state-machine
│       ├── dto/                  # create-quiz.dto, join-quiz.dto, submit-answer.dto
│       ├── quiz.controller.ts    # REST endpoints
│       ├── quiz.gateway.ts       # Socket.IO gateway (namespace /quiz)
│       ├── quiz.service.ts       # All business logic (~600 lines)
│       ├── quiz.store.ts         # In-memory Map store
│       └── quiz.module.ts
├── client/                       # React frontend (Vite)
│   └── src/
│       ├── api/quiz-api.ts       # HTTP client functions
│       ├── hooks/                # useQuizSession (participant), useHostSession (host)
│       ├── components/           # UI components, Logo, screen components
│       ├── pages/                # LandingPage, JoinPage, QuizPage, CreateQuizPage, HostDashboard
│       └── types/quiz.ts         # Shared TypeScript types
├── tsconfig.json                 # Root config (excludes client/)
├── tsconfig.build.json
└── nest-cli.json
```

### Key integration points

- `QuizService` is the single source of truth for all quiz logic — both the controller and gateway call into it
- The gateway emits `quiz:state-changed` (full snapshot) on every state transition
- Vite proxies `/quiz` → backend:3000 (HTTP) and `/socket.io` → backend:3000 (WebSocket)
- Frontend types in `client/src/types/quiz.ts` mirror backend serialization interfaces

### What NOT to change

- The quiz state machine (`QuizState` enum + `transitionQuizState` function)
- Socket.IO event names and payload shapes (frontend depends on them)
- The Vite proxy configuration
- Tailwind CSS v4 setup (uses `@tailwindcss/vite` plugin, no tailwind.config)
