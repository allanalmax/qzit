## Plan: QZIT Participant Frontend

Build a React + Vite + Tailwind participant frontend that joins via HTTP, connects to Socket.IO, and renders state-driven screens for the full quiz loop. No host dashboard, no quiz editor, no auth.

---

### Folder Structure

```
client/                           # separate Vite project at repo root
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── package.json
├── src/
│   ├── main.tsx
│   ├── App.tsx                   # Router setup (2 routes)
│   ├── types/
│   │   └── quiz.ts              # Shared types mirroring backend contracts
│   ├── api/
│   │   └── quiz-api.ts          # HTTP: joinQuiz()
│   ├── socket/
│   │   └── quiz-socket.ts       # Socket.IO client + event helpers
│   ├── hooks/
│   │   └── useQuizSession.ts    # Core hook: socket → state
│   ├── pages/
│   │   ├── JoinPage.tsx         # Name + code form
│   │   └── QuizPage.tsx         # State-driven sub-screen container
│   ├── components/
│   │   ├── ui/                  # Design system primitives
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Card.tsx
│   │   │   └── Badge.tsx
│   │   ├── WaitingScreen.tsx
│   │   ├── QuestionScreen.tsx
│   │   ├── SubmittedScreen.tsx
│   │   ├── LockedScreen.tsx
│   │   ├── RevealScreen.tsx
│   │   ├── LeaderboardScreen.tsx
│   │   └── EndedScreen.tsx
│   └── styles/
│       └── index.css            # Tailwind directives
```

---

### State/Rendering Strategy

The client is a **pure state renderer**. The server drives all transitions.

**Flow:** JoinPage → `POST /quiz/join` → navigate to `/quiz/:quizId` → connect socket → `participant:join-session` → receive `quiz:snapshot` → render sub-screen based on `state`

**State → Screen mapping:**

| QuizState | Screen | What shows |
|---|---|---|
| created / waiting | WaitingScreen | Quiz title, "waiting for host" |
| question_active (not submitted) | QuestionScreen | Question text, 4 options, submit button |
| question_active (submitted) | SubmittedScreen | Confirmation, selected answer |
| question_locked | LockedScreen | "Question closed, waiting for reveal" |
| answer_revealed | RevealScreen | Correct answer highlighted, user's pick marked |
| leaderboard | LeaderboardScreen | Rankings, own position highlighted |
| ended | EndedScreen | Final rankings, "quiz over" |

**Local state in `useQuizSession` hook:**
- `quizState`, `quizTitle`, `mode` — from snapshot
- `activeQuestion` — from `quiz:question-activated`
- `hasSubmitted`, `submittedOptionIndex` — from `quiz:answer-submitted`
- `correctOptionIndex` — from `quiz:answer-revealed`
- `leaderboard` — from `quiz:leaderboard` / `quiz:ended`
- `participant` — own info from snapshot

**Socket event → state update:**

| Server Event | Update |
|---|---|
| `quiz:snapshot` | Initialize all fields |
| `quiz:state-changed` | Update quizState, participantCount |
| `quiz:question-activated` | Set question, reset submitted/correct state |
| `quiz:answer-submitted` | Mark hasSubmitted, store chosen index |
| `quiz:answer-revealed` | Set correctOptionIndex |
| `quiz:leaderboard` | Set rankings |
| `quiz:ended` | Set final leaderboard |
| `quiz:error` | Show inline error |

---

### Routing

```
/              → JoinPage
/quiz/:quizId  → QuizPage (renders sub-screen based on state)
```

Only 2 routes. QuizPage conditionally renders the right sub-screen.

---

### Steps

**Phase 1 — Scaffolding (steps 1-3)**
1. Create Vite + React + TS project in `client/`
2. Install: tailwindcss, socket.io-client, react-router-dom
3. Set up Tailwind with calm color palette + index.css

**Phase 2 — Design System (step 4, *parallel with phase 3*)**
4. Create Button, Input, Card, Badge — mobile-first, calm colors, clear primary action

**Phase 3 — Types + API + Socket (steps 5-7, *parallel with phase 2*)**
5. Define types in `types/quiz.ts` — QuizState, QuizMode, SerializedQuestion, LeaderboardEntry, QuizSessionSnapshot, JoinResponse
6. `quiz-api.ts` — `joinQuiz()` fetch wrapper pointing at backend
7. `quiz-socket.ts` — connect/disconnect/emit/listen helpers wrapping socket.io-client

**Phase 4 — Core Hook (step 8, *depends on phases 2-3*)**
8. `useQuizSession(quizId, participantId)` — connects socket, emits join, listens to all events, manages state, handles reconnection via sessionStorage

**Phase 5 — Pages + Screens (steps 9-11, *depends on phase 4*)**
9. JoinPage — name + code inputs, call joinQuiz, store in sessionStorage, navigate
10. QuizPage — read params, call useQuizSession, render sub-screen
11. Build 7 sub-screens: Waiting, Question, Submitted, Locked, Reveal, Leaderboard, Ended

**Phase 6 — Wiring (step 12)**
12. Router in App.tsx + sessionStorage redirect for refresh safety

---

### Reconnection Strategy

- After join, store `participantId` + `quizId` in `sessionStorage`
- On page refresh: if sessionStorage has values, skip JoinPage → navigate to QuizPage → reconnect socket → server sends fresh `quiz:snapshot`
- Socket.IO auto-reconnects on network drops; on reconnect, re-emit `participant:join-session`

---

### Backend Integration Assumptions (to verify)
- Backend runs on `localhost:3000`
- `POST /quiz/join` accepts `{ joinCode, name, teamName? }`
- Socket namespace is `/quiz`
- `participant:join-session` payload is `{ quizId, participantId }`
- `participant:submit-answer` payload is `{ quizId, selectedOptionIndex }`
- All server→client events match the names in the gateway (already verified by smoke test)

---

### Decisions
- **Separate `client/` folder** — not a monorepo, simplest scaffolding
- **No TanStack Query** — only 1 HTTP call (joinQuiz), everything else is WebSocket; adds no value yet
- **No global state manager** — `useQuizSession` hook is sufficient
- **sessionStorage** for reconnection — survives refresh, clears on tab close
- **Vite dev proxy** — proxy API/socket to localhost:3000 so no CORS issues in dev

### Excluded
- Host dashboard, quiz editor, auth, payments, media upload, animations, team mode UI polish
