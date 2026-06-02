## Plan: QZIT Real-Time Quiz Backend MVP

Scaffold a NestJS + TypeScript backend with in-memory state, a quiz state machine, HTTP endpoints, and WebSocket events for the full host-controlled quiz loop. No DB, no auth, no frontend.

---

### Folder Structure

```
src/
├── main.ts
├── app.module.ts
├── quiz/
│   ├── quiz.module.ts
│   ├── quiz.controller.ts          # HTTP endpoints
│   ├── quiz.service.ts             # Business logic
│   ├── quiz.gateway.ts             # WebSocket gateway (Socket.IO)
│   ├── quiz.store.ts               # In-memory Map-based storage
│   ├── dto/
│   │   ├── create-quiz.dto.ts
│   │   ├── join-quiz.dto.ts
│   │   └── submit-answer.dto.ts
│   └── domain/
│       ├── quiz.model.ts           # Quiz, Round, Question interfaces
│       ├── participant.model.ts    # Participant, Team interfaces
│       ├── submission.model.ts     # Submission interface
│       ├── quiz-state.enum.ts      # QuizState enum
│       └── quiz-state-machine.ts   # Transition lookup table + validator
```

---

### Domain Models

**QuizState enum:** `created → waiting → question_active → question_locked → answer_revealed → leaderboard → ended`

**Quiz:** id, hostCode (6-char), joinCode (6-char), title, mode (`individual` | `team`), state, rounds (Round[]), currentRoundIndex, currentQuestionIndex, participants (Map), teams (Map), submissions (Map keyed by questionId), createdAt

**Round:** id, title, questions (Question[])

**Question:** id, text, options (string[4]), correctOptionIndex, timeLimitSeconds (default 30)

**Participant:** id, name, teamId?, isCaptain, socketId?, score

**Team:** id, name, memberIds[], captainId, score

**Submission:** id, questionId, participantId, teamId?, selectedOptionIndex, isCorrect, submittedAt

---

### State Transition Rules

| From | Action | To |
|---|---|---|
| created | OPEN_LOBBY | waiting |
| waiting | ACTIVATE_QUESTION | question_active |
| question_active | LOCK_QUESTION | question_locked |
| question_locked | REVEAL_ANSWER | answer_revealed |
| answer_revealed | SHOW_LEADERBOARD | leaderboard |
| leaderboard | ACTIVATE_QUESTION | question_active (next Q) |
| leaderboard | END_QUIZ | ended |
| answer_revealed | ACTIVATE_QUESTION | question_active (skip leaderboard) |

Any invalid transition throws an error.

---

### Steps

**Phase 1 — Scaffolding (step 1-2)**
1. Initialize NestJS project with `nest new` in the QZIT folder
2. Install deps: `@nestjs/websockets`, `@nestjs/platform-socket.io`, `socket.io`, `uuid`, `class-validator`, `class-transformer`

**Phase 2 — Domain Layer (steps 3-5)**
3. Define all domain model interfaces/types and `QuizState` enum
4. Implement `QuizStateMachine` — a pure transition function with a lookup table mapping `(currentState, action) → nextState`
5. Implement `QuizStore` — injectable service wrapping a `Map<string, Quiz>` with `create`, `findById`, `findByJoinCode`, `update`, `delete`

**Phase 3 — HTTP Layer (step 6)**
6. Implement `QuizController` + `QuizService`:
   - `POST /quiz` → create quiz (returns id, hostCode, joinCode)
   - `GET /quiz/:id` → get quiz details
   - `POST /quiz/join` → join quiz by joinCode (returns participantId, quizId)

**Phase 4 — WebSocket Layer (steps 7-10, *depends on phases 2-3*)**
7. Implement `QuizGateway` on namespace `/quiz` with all client→server events (`host:join`, `host:start`, `host:next-question`, `host:lock`, `host:reveal`, `host:leaderboard`, `host:end`, `participant:join`, `participant:submit`)
8. Implement server→client broadcasts (`quiz:state-changed`, `quiz:question`, `quiz:submission-count`, `quiz:answer-revealed`, `quiz:leaderboard`, `quiz:participant-joined`, `quiz:ended`, `error`)
9. Enforce business rules: answers only in `question_active`, one submission per participant/team per question, only captain submits in team mode
10. Track socket↔participant mapping; keep participants on disconnect (reconnect-safe)

**Phase 5 — Scoring (step 11, *depends on phase 4*)**
11. On reveal: iterate submissions, mark `isCorrect`, increment participant/team scores. Leaderboard = sorted by score descending. 1 point per correct answer.

---

### Relevant Files
- `src/quiz/domain/quiz-state.enum.ts` — `QuizState` enum + `QuizAction` enum
- `src/quiz/domain/quiz-state-machine.ts` — transition lookup table, `transition(state, action): QuizState`
- `src/quiz/domain/quiz.model.ts` — `Quiz`, `Round`, `Question` interfaces
- `src/quiz/domain/participant.model.ts` — `Participant`, `Team` interfaces
- `src/quiz/domain/submission.model.ts` — `Submission` interface
- `src/quiz/quiz.store.ts` — `QuizStore` class (in-memory `Map`)
- `src/quiz/quiz.service.ts` — all business logic (create, join, state transitions, scoring)
- `src/quiz/quiz.controller.ts` — 3 HTTP endpoints
- `src/quiz/quiz.gateway.ts` — Socket.IO gateway with all events
- `src/quiz/dto/*.ts` — request validation DTOs

---

### Verification
1. `npm run build` — TypeScript compiles cleanly
2. `npm run start:dev` — server starts on port 3000
3. Manual test flow with curl + a WebSocket client (e.g., Postman or `wscat`):
   - Create quiz → join → host WS connect → participant WS connect → start → next question → submit → lock → reveal → leaderboard → end
4. Verify invalid transitions are rejected (e.g., submit during `question_locked`)
5. Verify duplicate submissions are rejected

---

### Decisions & Assumptions
- **No timer auto-lock for MVP** — host manually locks questions. Timer deferred to phase 2.
- **No auth** — `hostCode` acts as a simple shared secret.
- **Quiz data provided upfront** — all rounds/questions in the create request. No editing after creation.
- **Team formation** — participant specifies `teamName` on join; server auto-creates team, first member becomes captain.
- **Reconnection** — participant re-sends `participant:join` with their `participantId`; server re-associates socket. State is preserved.
- **Scoring** — 1 point per correct answer. No time bonus for MVP.
- **Single server** — no horizontal scaling. Socket.IO Redis adapter can be added later.
- **CORS** — enabled for all origins in dev.

### Mocked/Simplified for Phase 1
- No timer-based auto-lock
- No persistent storage (in-memory only, lost on restart)
- No authentication or authorization
- No rate limiting
- Scoring is flat (1 point, no time bonus)

---

### Further Considerations
1. **Question timer**: Add server-side countdown that auto-locks? → Recommend deferring to phase 2.
2. **Team captain transfer on disconnect**: → Recommend deferring, keep simple.
3. **Max participants cap**: → Recommend no cap for MVP.
