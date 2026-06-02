# QZIT API Contract

## REST Endpoints

All endpoints return `application/json`. Validation errors return HTTP 400 with a `message` array.

---

### `POST /quiz`

Create a new quiz.

**Requires authentication** — `Authorization: Bearer <token>` header.

**Request body**

```json
{
  "title": "Friday Night Trivia",
  "mode": "individual",
  "rounds": [
    {
      "title": "Round 1",
      "questions": [
        {
          "text": "What is the capital of Kenya?",
          "options": ["Nairobi", "Kampala", "Kigali", "Dodoma"],
          "correctOptionIndex": 0,
          "timeLimitSeconds": 30
        }
      ]
    }
  ]
}
```

- `mode`: `"individual"` (any participant submits) or `"team"` (only captain submits)
- `options`: must have exactly 4 items
- `correctOptionIndex`: 0-based, must be within options range
- `timeLimitSeconds`: optional, defaults to 30

**Response 201**

```json
{
  "id": "uuid",
  "title": "...",
  "mode": "individual",
  "state": "created",
  "hostCode": "ABC123",
  "joinCode": "XYZ789",
  "createdAt": "2026-01-01T00:00:00.000Z",
  "currentRoundIndex": 0,
  "currentQuestionIndex": 0,
  "rounds": [ { "id": "uuid", "title": "...", "questions": [...] } ],
  "participants": [],
  "teams": [],
  "submissionCounts": []
}
```

**Errors**: 400 (validation), 401 (missing/invalid token)

---

### `GET /quiz/my`

Get all quizzes belonging to the authenticated host.

**Requires authentication.**

**Response 200** — array of full quiz objects (same shape as POST 201).

**Errors**: 401 (missing/invalid token)

---

### `PATCH /quiz/:id`

Update a quiz's title or rounds (only while state is `created`).

**Requires authentication.** Host must own the quiz.

**Request body** — partial; include only fields to change.

**Response 200** — updated full quiz object.

**Errors**: 400 (validation or quiz no longer in `created` state), 401, 403 (not owner), 404

---

### `GET /quiz/:id`

Get full quiz data by ID. Works for both active and ended quizzes.

**Response 200** — full quiz object (same shape as POST 201).

**Errors**: 404 (not found)

---

### `GET /quiz/:id/results`

Get post-game results including per-question statistics and per-participant score history.

**Response 200**

```json
{
  "quizId": "uuid",
  "title": "...",
  "mode": "individual",
  "state": "ended",
  "rounds": [
    {
      "id": "uuid",
      "title": "Round 1",
      "questions": [
        {
          "id": "uuid",
          "text": "...",
          "options": [...],
          "correctOptionIndex": 0,
          "timeLimitSeconds": 30,
          "totalAnswers": 5,
          "correctAnswers": 3,
          "optionCounts": [3, 1, 1, 0]
        }
      ]
    }
  ],
  "leaderboard": [ { "id": "uuid", "name": "Alice", "score": 2 } ],
  "participantScoreHistory": [...]
}
```

**Errors**: 404 (not found)

---

### `GET /quiz/lookup/:joinCode`

Look up a quiz by its participant join code. Safe for participants — does not expose `hostCode` or `correctOptionIndex`.

**Response 200**

```json
{
  "quizId": "uuid",
  "title": "...",
  "mode": "individual",
  "state": "waiting",
  "teams": [
    { "id": "uuid", "name": "Alpha", "memberCount": 2 }
  ]
}
```

- `teams` is always present; empty array for individual mode.

**Errors**: 404 (unknown code), 400 (quiz already ended)

---

### `POST /quiz/join`

Join a quiz as a participant.

**Request body**

```json
{
  "joinCode": "XYZ789",
  "name": "Alice",
  "teamName": "Team Alpha"
}
```

- `teamName`: required only for `team` mode; creates the team if it doesn't exist; first joiner with a new `teamName` becomes captain.

**Response 201**

```json
{
  "quizId": "uuid",
  "participantId": "uuid",
  "participantName": "Alice",
  "mode": "individual",
  "teamId": null,
  "isCaptain": false
}
```

**Errors**: 400 (ended quiz, missing teamName in team mode), 404 (invalid join code)

---

### Authentication endpoints

| Method | Path                  | Body                          | Response                  |
| ------ | --------------------- | ----------------------------- | ------------------------- |
| POST   | `/auth/register`      | `{ email, password, name }`   | 201 `{ accessToken }`     |
| POST   | `/auth/login`         | `{ email, password }`         | 200 `{ accessToken }`     |
| POST   | `/auth/forgot-password` | `{ email }`                 | 204 (sends reset email)   |
| POST   | `/auth/reset-password`  | `{ token, newPassword }`    | 204                       |

---

## Socket.IO — Namespace `/quiz`

Connect via `io("http://host/quiz", { transports: ["websocket"] })`.

### Inbound events (client → server)

| Event                        | Payload                           | Notes                                          |
| ---------------------------- | --------------------------------- | ---------------------------------------------- |
| `host:join-session`          | `{ quizId, hostCode }`            | Authenticate host; join room; receive snapshot |
| `participant:join-session`   | `{ quizId, participantId }`       | Connect existing participant; receive snapshot |
| `participant:rejoin-session` | `{ quizId, participantId }`       | Reconnect after disconnect; receive snapshot   |
| `host:start-quiz`            | `{ quizId }`                      | `created → waiting`                            |
| `host:start-question`        | `{ quizId }`                      | `waiting/answer_revealed/leaderboard → question_active` |
| `participant:submit-answer`  | `{ quizId, selectedOptionIndex }` | Only during `question_active`                  |
| `host:lock-question`         | `{ quizId }`                      | `question_active → question_locked`            |
| `host:reveal-answer`         | `{ quizId }`                      | `question_locked → answer_revealed`            |
| `host:show-leaderboard`      | `{ quizId }`                      | `answer_revealed → leaderboard`                |
| `host:end-quiz`              | `{ quizId }`                      | `leaderboard → ended`                          |

---

### Outbound events (server → client)

| Event                          | Recipients | Payload                                                                                                                      |
| ------------------------------ | ---------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `quiz:snapshot`                | direct     | Full session snapshot (see shape below). Sent on join/rejoin. |
| `quiz:state-changed`           | room       | Full session snapshot (same shape as `quiz:snapshot`). Sent on every state transition. |
| `quiz:participant-joined`      | room       | `{ participantId, name, teamId, isCaptain }`                                          |
| `quiz:participant-reconnected` | room       | `{ participantId, name }`                                                             |
| `quiz:question-activated`      | room       | `{ id, text, options, timeLimitSeconds }` — **no `correctOptionIndex`**               |
| `quiz:submission-count`        | host room  | `{ questionId, count }`                                                               |
| `quiz:answer-submitted`        | direct     | `{ questionId, submissionId }`                                                        |
| `quiz:question-locked`         | room       | `{ quizId, timedOut? }` — `timedOut: true` only when auto-locked by time limit       |
| `quiz:answer-revealed`         | room       | `{ question: { id, text, options, correctOptionIndex } }`                             |
| `quiz:leaderboard`             | room       | `{ rankings: [{ id, name, score, teamId? }], hasNextQuestion }`                       |
| `quiz:ended`                   | room       | `{ leaderboard: [{ id, name, score, teamId? }] }`                                     |
| `quiz:error`                   | direct     | `{ message }`                                                                         |

#### Session snapshot shape

Emitted as `quiz:snapshot` (on join) and `quiz:state-changed` (on every transition):

```json
{
  "quizId": "uuid",
  "title": "...",
  "mode": "individual",
  "state": "question_active",
  "participantCount": 3,
  "teamCount": 0,
  "currentRoundIndex": 0,
  "currentQuestionIndex": 1,
  "activeQuestion": {
    "id": "uuid",
    "text": "...",
    "options": [...],
    "timeLimitSeconds": 30
  },
  "submissionCount": 2,
  "leaderboard": [],
  "participant": {
    "id": "uuid",
    "name": "Alice",
    "teamId": null,
    "isCaptain": false,
    "score": 1
  }
}
```

- `activeQuestion` is `null` when no question is active.
- `correctOptionIndex` is included in `activeQuestion` only during `answer_revealed`, `leaderboard`, and `ended` states.
- `submissionCount` is non-null only in snapshots sent to the host.
- `participant` is included only in snapshots sent to a specific participant.
- `leaderboard` is populated only in `leaderboard` and `ended` states.

#### Rooms

- `quiz:{quizId}` — all connected sockets for the quiz
- `quiz:{quizId}:hosts` — host sockets only (used for `quiz:submission-count`)

---

## State Machine

```
created
  └─[OPEN_LOBBY]──→ waiting
                      └─[ACTIVATE_QUESTION]──→ question_active
                                                  └─[LOCK_QUESTION]──→ question_locked
                                                                          └─[REVEAL_ANSWER]──→ answer_revealed
                                                                                                  ├─[ACTIVATE_QUESTION]──→ question_active (next question, skip leaderboard)
                                                                                                  └─[SHOW_LEADERBOARD]──→ leaderboard
                                                                                                                             ├─[ACTIVATE_QUESTION]──→ question_active (next question)
                                                                                                                             └─[END_QUIZ]──→ ended (terminal)
```

Valid transitions:

| From              | Action              | To                |
| ----------------- | ------------------- | ----------------- |
| `created`         | `OPEN_LOBBY`        | `waiting`         |
| `waiting`         | `ACTIVATE_QUESTION` | `question_active` |
| `question_active` | `LOCK_QUESTION`     | `question_locked` |
| `question_locked` | `REVEAL_ANSWER`     | `answer_revealed` |
| `answer_revealed` | `SHOW_LEADERBOARD`  | `leaderboard`     |
| `answer_revealed` | `ACTIVATE_QUESTION` | `question_active` |
| `leaderboard`     | `ACTIVATE_QUESTION` | `question_active` |
| `leaderboard`     | `END_QUIZ`          | `ended`           |

All other transitions throw `400 Bad Request`. `ended` is a terminal state — all actions are rejected.
