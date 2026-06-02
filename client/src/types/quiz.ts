export enum QuizState {
  CREATED = 'created',
  WAITING = 'waiting',
  QUESTION_ACTIVE = 'question_active',
  QUESTION_LOCKED = 'question_locked',
  ANSWER_REVEALED = 'answer_revealed',
  LEADERBOARD = 'leaderboard',
  ENDED = 'ended',
}

export enum QuizMode {
  INDIVIDUAL = 'individual',
  TEAM = 'team',
}

export interface SerializedQuestion {
  id: string;
  text: string;
  options: string[];
  timeLimitSeconds: number;
  correctOptionIndex?: number;
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  isCaptain?: boolean;
  memberIds?: string[];
}

export interface QuizSessionSnapshot {
  quizId: string;
  title: string;
  mode: QuizMode;
  state: QuizState;
  participantCount: number;
  teamCount: number;
  currentRoundIndex: number;
  currentQuestionIndex: number;
  activeQuestion: SerializedQuestion | null;
  submissionCount: number | null;
  leaderboard: LeaderboardEntry[];
  participant?: {
    id: string;
    name: string;
    teamId?: string;
    isCaptain?: boolean;
    score: number;
  };
}

export interface JoinResponse {
  quizId: string;
  participantId: string;
  participantName: string;
  mode: QuizMode;
  teamId?: string;
  isCaptain?: boolean;
  state: QuizState;
}

/* ── Host types ──────────────────────────────────── */

export interface CreateQuestionInput {
  text: string;
  options: [string, string, string, string];
  correctOptionIndex: number;
  timeLimitSeconds?: number;
}

export interface CreateRoundInput {
  title: string;
  questions: CreateQuestionInput[];
}

export interface CreateQuizInput {
  title: string;
  mode: QuizMode;
  rounds: CreateRoundInput[];
}

export interface CreateQuizResponse {
  id: string;
  title: string;
  hostCode: string;
  joinCode: string;
  state: QuizState;
}

export interface QuizLookupResponse {
  quizId: string;
  title: string;
  mode: QuizMode;
  state: QuizState;
  teams: { id: string; name: string; memberCount: number }[];
}

export interface MyQuizSummary {
  id: string;
  title: string;
  mode: QuizMode;
  state: QuizState;
  joinCode: string;
  hostCode: string;
  participantCount: number;
  createdAt: string;
}
