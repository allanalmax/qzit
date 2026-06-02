import { CreateQuizDto } from './dto/create-quiz.dto';
import { JoinQuizDto } from './dto/join-quiz.dto';
import { SubmitAnswerDto } from './dto/submit-answer.dto';
import { UpdateQuizDto } from './dto/update-quiz.dto';
import type { Participant, Team } from './domain/participant.model';
import type { Round } from './domain/quiz.model';
import type { Submission } from './domain/submission.model';
import { QuizMode, QuizState } from './domain/quiz-state.enum';
import type { IQuizStore } from './quiz.store';
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
    currentQuestionIndex: number | null;
    activeQuestion: SerializedQuestion | null;
    submissionCount: number | null;
    leaderboard: LeaderboardEntry[];
    participant?: {
        id: string;
        name: string;
        teamId: string | null;
        isCaptain: boolean;
        score: number;
    };
}
export declare class QuizService {
    private readonly quizStore;
    constructor(quizStore: IQuizStore);
    createQuiz(createQuizDto: CreateQuizDto, hostId?: string | null): {
        id: string;
        title: string;
        mode: QuizMode;
        state: QuizState;
        hostCode: string;
        joinCode: string;
        rounds: Round[];
        createdAt: Date;
    };
    getQuizById(quizId: string): Promise<{
        id: string;
        title: string;
        mode: QuizMode;
        state: QuizState;
        hostCode: string;
        joinCode: string;
        createdAt: Date;
        currentRoundIndex: number;
        currentQuestionIndex: number | null;
        rounds: Round[];
        participants: Participant[];
        teams: Team[];
        submissionCounts: {
            questionId: string;
            count: number;
        }[];
    }>;
    lookupByJoinCode(joinCode: string): {
        quizId: string;
        title: string;
        mode: QuizMode;
        state: QuizState.CREATED | QuizState.WAITING | QuizState.QUESTION_ACTIVE | QuizState.QUESTION_LOCKED | QuizState.ANSWER_REVEALED | QuizState.LEADERBOARD;
        teams: {
            id: string;
            name: string;
            memberCount: number;
        }[];
    };
    joinQuiz(joinQuizDto: JoinQuizDto): {
        quizId: string;
        participantId: string;
        participantName: string;
        mode: QuizMode;
        teamId: string | null;
        isCaptain: boolean;
        state: QuizState.CREATED | QuizState.WAITING | QuizState.QUESTION_ACTIVE | QuizState.QUESTION_LOCKED | QuizState.ANSWER_REVEALED | QuizState.LEADERBOARD;
    };
    connectHost(quizId: string, hostCode: string): QuizSessionSnapshot;
    connectParticipant(quizId: string, participantId: string, socketId: string): {
        participant: Participant;
        snapshot: QuizSessionSnapshot;
    };
    disconnectSocket(socketId: string): void;
    startQuiz(quizId: string): QuizSessionSnapshot;
    startQuestion(quizId: string): {
        snapshot: QuizSessionSnapshot;
        question: SerializedQuestion;
    };
    submitAnswer(submitAnswerDto: SubmitAnswerDto): {
        questionId: string;
        submissionCount: number;
        submission: Submission;
    };
    lockQuestion(quizId: string): QuizSessionSnapshot;
    revealAnswer(quizId: string): {
        snapshot: QuizSessionSnapshot;
        question: SerializedQuestion;
    };
    showLeaderboard(quizId: string): {
        snapshot: QuizSessionSnapshot;
        leaderboard: LeaderboardEntry[];
        hasNextQuestion: boolean;
    };
    endQuiz(quizId: string): {
        snapshot: QuizSessionSnapshot;
        leaderboard: LeaderboardEntry[];
    };
    getMyQuizzes(hostId: string): Promise<{
        id: string;
        title: string;
        mode: QuizMode;
        state: QuizState;
        joinCode: string;
        hostCode: string;
        participantCount: number;
        createdAt: Date;
    }[]>;
    updateQuiz(quizId: string, dto: UpdateQuizDto, hostId: string): {
        id: string;
        title: string;
        mode: QuizMode;
        state: QuizState.CREATED;
        hostCode: string;
        joinCode: string;
        rounds: Round[];
        createdAt: Date;
    };
    getQuizResults(quizId: string): Promise<{
        quizId: string;
        title: string;
        mode: QuizMode;
        state: QuizState;
        rounds: {
            id: string;
            title: string;
            questions: {
                id: string;
                text: string;
                options: string[];
                correctOptionIndex: number;
                timeLimitSeconds: number;
                totalAnswers: number;
                correctAnswers: number;
                optionCounts: number[];
            }[];
        }[];
        leaderboard: LeaderboardEntry[];
        participantScoreHistory: {
            participantId: string;
            name: string;
            scorePerQuestion: {
                questionId: string;
                isCorrect: boolean;
            }[];
        }[];
    }>;
    getSessionSnapshot(quizId: string, participantId?: string, includeSubmissionCount?: boolean): QuizSessionSnapshot;
    private serializeQuiz;
    private getQuizOrThrow;
    private getQuizOrThrowAsync;
    private getParticipantOrThrow;
    private getCurrentQuestionOrThrow;
    private getCurrentQuestion;
    private getNextQuestionCoordinates;
    private getLeaderboard;
    private serializeQuestion;
    private findTeamByName;
    private generateUniqueCode;
    private generateCode;
}
