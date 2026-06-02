## Plan: QZIT UX Improvements — Join Flow, Branding, Quiz Lifecycle

Five interconnected changes across backend and frontend. Grouped into phases that can be verified independently.

---

### Phase 1: Backend — New lookup endpoint

_No dependencies, start here_

1. Add `GET /quiz/lookup/:joinCode` to `quiz.controller.ts`
2. Add `lookupByJoinCode()` to `quiz.service.ts` using existing `quizStore.findByJoinCode()`
   - Returns: `{ quizId, title, mode, state, teams: { id, name, memberCount }[] }`
   - Participant-safe — does NOT expose `hostCode` or full quiz data
   - Throws 404 if not found, 400 if ended

### Phase 2: Landing page + branding

_Parallel with Phase 1_

3. Create `LandingPage.tsx` — QZIT logo/name prominently displayed, two CTAs: "Host a Quiz" → `/create`, "Join a Quiz" → `/join`
4. Create `Logo.tsx` — reusable QZIT brand component
5. Update `App.tsx` routes: `/` → LandingPage, `/join` → JoinPage (moved from `/`)
6. Add Logo to `JoinPage`, `CreateQuizPage`, `HostDashboard` headers

### Phase 3: Revamped join flow

_Depends on Phase 1_

7. Add `lookupQuiz(joinCode)` to `quiz-api.ts` calling `GET /quiz/lookup/:joinCode`
8. Add `QuizLookupResponse` type to `quiz.ts`
9. Rewrite `JoinPage.tsx` as multi-step form:
   - **Step 1:** Enter join code + name → call `lookupQuiz()` to discover mode
   - **Step 2 (individual):** Skip straight to `joinQuiz()` — no team step
   - **Step 2 (team):** Dropdown of existing teams (name + member count) plus "Create New Team" option. If creating, show text input for team name
   - Remove old "Team Name (optional)" field

### Phase 4: Create form validation

_No dependencies, parallel with all phases_

10. Change `emptyQuestion()` default in `CreateQuizPage.tsx` from `correctOptionIndex: 0` to `correctOptionIndex: -1`
11. Add validation in `handleSubmit`: if any question has `correctOptionIndex === -1`, show error "Please select the correct answer for Round X, Question Y" and prevent submission
12. Radio buttons start unchecked (since initial value is -1, none matches)

### Phase 5: End-of-quiz navigation

_No dependencies, parallel with all phases_

13. `HostDashboard.tsx` ENDED state: show leaderboard + "Back to Dashboard" button → navigates to `/create` (placeholder for future dashboard with quiz history)
14. `EndedScreen.tsx`: change "Back to Home" navigation from `/` to `/join`

---

### Verification

1. Backend compiles after adding lookup endpoint
2. Frontend `tsc --noEmit` + `npm run build` pass
3. Manual: create individual quiz → join with code+name → skips team step → lands in quiz
4. Manual: create team quiz → join → see team dropdown → create team → join as captain
5. Manual: second participant joins same team quiz → sees existing team in dropdown → selects → joins as non-captain
6. Manual: create quiz without selecting correct answer → submit → see validation error
7. Manual: host ends quiz → sees "Back to Dashboard" → participant sees "Back to Join"
8. Manual: QZIT branding visible on landing, join, create, and host pages

### Decisions

- Single landing page for hosts and participants (confirmed)
- No auth for now — host goes directly to `/create` (confirmed)
- Team join uses dropdown + "Create New Team" (confirmed)
- Host "Back to Dashboard" goes to `/create` now — becomes `/dashboard` when DB/auth is added
