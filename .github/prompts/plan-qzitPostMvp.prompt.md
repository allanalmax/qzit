# QZIT — Post-MVP Implementation Plan

## Guiding principles
- Preserve the current working gameplay loop
- Do not break socket payloads or state machine behavior
- Introduce persistence behind a compatibility layer first
- Keep host auth and host ownership explicit before expanding host features
- Ship in thin vertical slices with testable milestones

## Phase 0 — Hardening the current MVP
Goal:
- Freeze current behavior and create safety rails before major refactors

Tasks:
- Extract `IQuizStore` interface from `QuizStore` (5 methods: `create`, `findById`, `findByJoinCode`, `update`, `values`) → update `QuizService` to inject by token → update `QuizModule` provider registration. This locks the contract before Phase 1 replaces the implementation.
- Document current API endpoints and Socket.IO event contracts
- Add integration tests for the core gameplay loop:
  - create quiz
  - join quiz
  - start quiz
  - start question
  - submit answer
  - lock question
  - reveal answer
  - leaderboard
  - end quiz
- Add snapshot/serialization tests for `quiz:state-changed`
- Add basic error-path tests:
  - invalid join code
  - duplicate submission
  - captain-only enforcement
  - invalid state transition
- Identify all current `QuizStore` call sites and lock the interface

### QuizStore Call Sites (16 sites in QuizService only)
| Line | Method | QuizStore call |
|------|--------|---------------|
| 99 | `createQuiz()` | `this.quizStore.create(quiz)` |
| 113 | `lookupByJoinCode()` | `this.quizStore.findByJoinCode(...)` |
| 133 | `joinQuiz()` | `this.quizStore.findByJoinCode(...)` |
| 178 | `joinQuiz()` | `this.quizStore.update(quiz)` |
| 195 | `connectParticipant()` | `this.quizStore.update(quiz)` |
| 201–208 | `disconnectSocket()` | `this.quizStore.values()` + `this.quizStore.update(quiz)` |
| 213 | `startQuiz()` | `this.quizStore.update(quiz)` |
| 226 | `startQuestion()` | `this.quizStore.update(quiz)` |
| 349 | `submitAnswer()` | `this.quizStore.update(quiz)` |
| 357 | `lockQuestion()` | `this.quizStore.update(quiz)` |
| 374 | `revealAnswer()` | `this.quizStore.update(quiz)` |
| 396 | `showLeaderboard()` | `this.quizStore.update(quiz)` |
| 407 | `endQuiz()` | `this.quizStore.update(quiz)` |
| 496 | `getQuizOrThrow()` | `this.quizStore.findById(quizId)` |
| 618–623 | `generateUniqueCode()` | `this.quizStore.values()` |

### Test File Plan
- `src/quiz/domain/quiz-state-machine.spec.ts` — All 8 valid transitions + invalid transition rejection + terminal state tests
- `src/quiz/quiz.service.spec.ts` — Quiz lifecycle, join flow (individual + team), lookup, state transitions, submit answer (valid/duplicate/captain-only), scoring, question advancement, snapshot shape
- `src/quiz/quiz.gateway.spec.ts` — Full gameplay loop via real socket.io-client connections, plus error paths (invalid host code, wrong state, non-captain submit)
- `test/app.e2e-spec.ts` — Extend with all 4 REST endpoints (success + error cases)
- `docs/api-contract.md` — REST endpoints, socket events, state machine transitions

Deliverable:
- A stable baseline that proves refactors did not break gameplay

---

## Phase 1 — Persistence foundation
Goal:
- Replace in-memory-only storage with PostgreSQL while keeping the current service contract stable

Tasks:
- Add PostgreSQL + Prisma
- Create initial schema for:
  - User
  - Quiz
  - Round
  - Question
  - Participant
  - Team
  - Submission
- Keep domain models separate from Prisma models
- Introduce repository layer:
  - QuizRepository
  - ParticipantRepository
  - SubmissionRepository
- Replace `QuizStore` with a DB-backed implementation that preserves the existing service-facing contract as much as possible
- Add hot in-memory cache for active quizzes
- Implement hydration:
  - load active quiz from DB into cache on demand
- Implement dual write/update flow:
  - update cache
  - persist to DB
- Evict ended quizzes from active cache

### Map-to-relational mapping challenge
The `Quiz` model uses three `Map` fields:
- `participants: Map<string, Participant>` — keyed by participant UUID
- `teams: Map<string, Team>` — keyed by team UUID
- `submissionsByQuestion: Map<string, Submission[]>` — keyed by question UUID

These need a dedicated hydration/serialization layer in the repository that converts between Prisma relations and in-memory Maps.

Important constraints:
- Do not rewrite the quiz state machine
- Do not change socket payload shape
- Do not refactor unrelated frontend code in this phase

Deliverable:
- Quizzes survive server restarts
- Existing gameplay still works

---

## Phase 2 — Authentication and quiz ownership
Goal:
- Introduce host identity cleanly before building dashboard-heavy workflows

Tasks:
- Add auth module
- Add User model and password hashing
- Implement:
  - POST /auth/register
  - POST /auth/login
  - GET /auth/me
- Add JWT guard
- Require auth on `POST /quiz`
- Associate new quizzes with `hostId`
- Add ownership checks for host-only actions
- Keep join/public gameplay endpoints public
- Decide on `hostCode`:
  - keep temporarily for backward compatibility
  - deprecate later once host auth is stable

Frontend:
- Add auth context/provider
- Add login/register pages
- Protect:
  - /create
  - /host/:quizId
  - later /dashboard
- Persist JWT in localStorage
- Add logout flow

Deliverable:
- Only authenticated hosts can create/manage quizzes
- Public participation remains frictionless

---

## Phase 3 — Host dashboard and host lifecycle
Goal:
- Give authenticated hosts a real product workflow beyond one-off quiz creation

Tasks:
- Add GET host quizzes endpoint
- Build `/dashboard` page
- Show:
  - title
  - mode
  - state
  - participant count
  - created date
- Actions:
  - Resume
  - View Results
  - Duplicate
  - Delete
- Change "Back to Dashboard" flows appropriately
- Remove reliance on frontend localStorage hacks for host-created quiz tracking

Backend endpoints:
- GET /quiz/mine
- DELETE /quiz/:id
- POST /quiz/:id/duplicate
- GET /quiz/:id/results

Deliverable:
- Hosts can manage quizzes as persistent assets

---

## Phase 4 — Quiz editing
Goal:
- Allow hosts to manage quiz content safely

Tasks:
- Add PUT /quiz/:id
- Permit edits only in `created` state
- Support editing:
  - title
  - rounds
  - questions
  - options
  - correct answer
  - timer fields
- Prevent edits once quiz has started
- Add frontend editing UX tied to ownership checks

Deliverable:
- Quizzes become reusable and maintainable
- No risk of mutating live sessions

---

## Phase 5 — Results and reporting
Goal:
- Make completed quizzes useful after gameplay

Tasks:
- Build results endpoint
- Add per-question breakdown
- Add final leaderboard output
- Add results page in frontend
- Optional CSV export after JSON endpoint is stable

Deliverable:
- Hosts can review and reuse quiz data
- Better retention and product value

---

## Phase 6 — Gameplay polish
Goal:
- Improve reliability and quality of the live experience

Tasks:
- Server-side timer with authoritative countdown
- Participant reconnection using persisted participant identity
- Optional question media (`imageUrl` first)
- Spectator mode

Recommended order within this phase:
1. Server-side timer
2. Participant reconnection
3. Question media
4. Spectator mode

Deliverable:
- A more resilient and polished live gameplay system

---

## Suggested execution order
1. Phase 0 — Hardening
2. Phase 1 — Persistence
3. Phase 2 — Authentication
4. Phase 3 — Host dashboard
5. Phase 4 — Quiz editing
6. Phase 5 — Results
7. Phase 6 — Gameplay polish

## Why this order
- Persistence first ensures all later host features sit on real data
- Auth before dashboard prevents building management flows without ownership
- Dashboard before editor gives hosts immediate value
- Editing after persistence/auth is safer and simpler
- Gameplay polish last avoids delaying productization work

---

## Milestone definitions

### Milestone A (Phase 0)
- MVP behavior locked with tests
- `IQuizStore` interface extracted
- Contract documented
- No visible product changes yet
- Safe to refactor

### Milestone B (Phase 1)
- Quizzes persist across restart
- Existing host/participant flow unchanged

### Milestone C (Phase 2)
- Host can register/login and create owned quizzes

### Milestone D (Phase 3)
- Host can see and manage quizzes from dashboard

### Milestone E (Phase 4)
- Host can edit created quizzes before launch

### Milestone F (Phase 5)
- Host can view/export results

### Milestone G (Phase 6)
- Timers, reconnection, and media support are in place

---

## Risks to manage
- `QuizService` is already large (~600 lines); persistence work may become messy if repositories are not introduced cleanly
- Mapping `Map<string, T>` structures to relational data will introduce hydration/serialization complexity
- Cache/DB dual-write logic can create drift if update paths are inconsistent
- Auth can accidentally leak into public participant flows if route boundaries are not kept strict
- Editing and duplication can mutate assumptions in current frontend types if not normalized

---

## Architecture Reference

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
│       ├── socket/quiz-socket.ts # Socket.IO client wrapper
│       └── types/quiz.ts         # Shared TypeScript types
├── tsconfig.json                 # Root config (excludes client/)
├── tsconfig.build.json
└── nest-cli.json
```

### QuizService public methods (14)
| Method | Purpose |
|--------|---------|
| `createQuiz` | Validates, assigns UUIDs, creates quiz in CREATED state |
| `getQuizById` | Returns full serialized quiz |
| `lookupByJoinCode` | Participant-safe lookup (no hostCode exposed) |
| `joinQuiz` | Creates participant, handles team logic |
| `connectHost` | Validates host code, returns snapshot |
| `connectParticipant` | Stores socket ID, returns snapshot |
| `disconnectSocket` | Nulls socketId across all quizzes |
| `startQuiz` | CREATED → WAITING |
| `startQuestion` | Advances to next question → QUESTION_ACTIVE |
| `submitAnswer` | Validates + stores submission |
| `lockQuestion` | QUESTION_ACTIVE → QUESTION_LOCKED |
| `revealAnswer` | Scores submissions → ANSWER_REVEALED |
| `showLeaderboard` | Sorts scores → LEADERBOARD |
| `endQuiz` | LEADERBOARD → ENDED |

### Socket.IO events

#### Inbound (9 events)
| Event | Payload |
|-------|---------|
| `host:join-session` | `{ quizId, hostCode }` |
| `participant:join-session` | `{ quizId, participantId }` |
| `host:start-quiz` | `{ quizId }` |
| `host:start-question` | `{ quizId }` |
| `participant:submit-answer` | `{ quizId, selectedOptionIndex }` |
| `host:lock-question` | `{ quizId }` |
| `host:reveal-answer` | `{ quizId }` |
| `host:show-leaderboard` | `{ quizId }` |
| `host:end-quiz` | `{ quizId }` |

#### Outbound (10 events)
| Event | Target | Payload |
|-------|--------|---------|
| `quiz:snapshot` | direct to socket | `QuizSessionSnapshot` |
| `quiz:participant-joined` | quiz room | `{ participantId, name, teamId, isCaptain }` |
| `quiz:state-changed` | quiz room | `QuizSessionSnapshot` |
| `quiz:question-activated` | quiz room | `SerializedQuestion` (no correctOptionIndex) |
| `quiz:submission-count` | host room | `{ questionId, count }` |
| `quiz:answer-submitted` | direct to submitter | `{ questionId, submissionId }` |
| `quiz:question-locked` | quiz room | `{ quizId }` |
| `quiz:answer-revealed` | quiz room | `{ question: SerializedQuestion }` (with correctOptionIndex) |
| `quiz:leaderboard` | quiz room | `{ rankings, hasNextQuestion }` |
| `quiz:ended` | quiz room | `{ leaderboard }` |

### State machine transitions
```
CREATED         → OPEN_LOBBY         → WAITING
WAITING         → ACTIVATE_QUESTION  → QUESTION_ACTIVE
QUESTION_ACTIVE → LOCK_QUESTION      → QUESTION_LOCKED
QUESTION_LOCKED → REVEAL_ANSWER      → ANSWER_REVEALED
ANSWER_REVEALED → SHOW_LEADERBOARD   → LEADERBOARD
ANSWER_REVEALED → ACTIVATE_QUESTION  → QUESTION_ACTIVE  (skip leaderboard)
LEADERBOARD     → ACTIVATE_QUESTION  → QUESTION_ACTIVE  (next question)
LEADERBOARD     → END_QUIZ           → ENDED
ENDED           → (none — terminal)
```

### REST endpoints
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `POST` | `/quiz` | public (→ auth in Phase 2) | Create quiz |
| `GET` | `/quiz/:id` | public | Get quiz by ID |
| `GET` | `/quiz/lookup/:joinCode` | public | Participant-safe lookup |
| `POST` | `/quiz/join` | public | Join quiz |

### Tech stack
- **Backend:** NestJS 11, TypeScript, Socket.IO 4.8 (namespace `/quiz`), class-validator, class-transformer
- **Frontend:** React 18, Vite 5, Tailwind CSS v4, socket.io-client, react-router-dom 7
- **Testing:** Jest 30, ts-jest, @nestjs/testing, supertest, socket.io-client

### What NOT to change across all phases
- The quiz state machine (`QuizState` enum + `transitionQuizState` function)
- Socket.IO event names and payload shapes
- The Vite proxy configuration
- Tailwind CSS v4 setup

---

## Implementation rules
- Keep the current state machine unchanged
- Keep socket event names unchanged
- Keep socket payload shape unchanged
- Refactor behind interfaces first, then expand features
- Prefer additive changes over rewrites
- Ship one phase at a time with passing tests
