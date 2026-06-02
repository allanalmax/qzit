import type { Participant, Team } from './participant.model';
import type { Submission } from './submission.model';
import { QuizMode, QuizState } from './quiz-state.enum';
export interface Question {
    id: string;
    text: string;
    options: string[];
    correctOptionIndex: number;
    timeLimitSeconds: number;
}
export interface Round {
    id: string;
    title: string;
    questions: Question[];
}
export interface Quiz {
    id: string;
    title: string;
    mode: QuizMode;
    state: QuizState;
    hostCode: string;
    joinCode: string;
    hostId: string | null;
    rounds: Round[];
    currentRoundIndex: number;
    currentQuestionIndex: number | null;
    participants: Map<string, Participant>;
    teams: Map<string, Team>;
    submissionsByQuestion: Map<string, Submission[]>;
    createdAt: Date;
}
