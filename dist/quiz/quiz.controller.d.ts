import { CreateQuizDto } from './dto/create-quiz.dto';
import { JoinQuizDto } from './dto/join-quiz.dto';
import { UpdateQuizDto } from './dto/update-quiz.dto';
import { QuizService } from './quiz.service';
import type { JwtPayload } from '../auth/jwt.strategy';
export declare class QuizController {
    private readonly quizService;
    constructor(quizService: QuizService);
    createQuiz(createQuizDto: CreateQuizDto, host: JwtPayload): {
        id: string;
        title: string;
        mode: import("./domain/quiz-state.enum").QuizMode;
        state: import("./domain/quiz-state.enum").QuizState;
        hostCode: string;
        joinCode: string;
        rounds: import("./domain/quiz.model").Round[];
        createdAt: Date;
    };
    getMyQuizzes(host: JwtPayload): Promise<{
        id: string;
        title: string;
        mode: import("./domain/quiz-state.enum").QuizMode;
        state: import("./domain/quiz-state.enum").QuizState;
        joinCode: string;
        hostCode: string;
        participantCount: number;
        createdAt: Date;
    }[]>;
    updateQuiz(id: string, dto: UpdateQuizDto, host: JwtPayload): {
        id: string;
        title: string;
        mode: import("./domain/quiz-state.enum").QuizMode;
        state: import("./domain/quiz-state.enum").QuizState.CREATED;
        hostCode: string;
        joinCode: string;
        rounds: import("./domain/quiz.model").Round[];
        createdAt: Date;
    };
    getQuizById(id: string): Promise<{
        id: string;
        title: string;
        mode: import("./domain/quiz-state.enum").QuizMode;
        state: import("./domain/quiz-state.enum").QuizState;
        hostCode: string;
        joinCode: string;
        createdAt: Date;
        currentRoundIndex: number;
        currentQuestionIndex: number | null;
        rounds: import("./domain/quiz.model").Round[];
        participants: import("./domain/participant.model").Participant[];
        teams: import("./domain/participant.model").Team[];
        submissionCounts: {
            questionId: string;
            count: number;
        }[];
    }>;
    getQuizResults(id: string): Promise<{
        quizId: string;
        title: string;
        mode: import("./domain/quiz-state.enum").QuizMode;
        state: import("./domain/quiz-state.enum").QuizState;
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
        leaderboard: import("./quiz.service").LeaderboardEntry[];
        participantScoreHistory: {
            participantId: string;
            name: string;
            scorePerQuestion: {
                questionId: string;
                isCorrect: boolean;
            }[];
        }[];
    }>;
    lookupByJoinCode(joinCode: string): {
        quizId: string;
        title: string;
        mode: import("./domain/quiz-state.enum").QuizMode;
        state: import("./domain/quiz-state.enum").QuizState.CREATED | import("./domain/quiz-state.enum").QuizState.WAITING | import("./domain/quiz-state.enum").QuizState.QUESTION_ACTIVE | import("./domain/quiz-state.enum").QuizState.QUESTION_LOCKED | import("./domain/quiz-state.enum").QuizState.ANSWER_REVEALED | import("./domain/quiz-state.enum").QuizState.LEADERBOARD;
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
        mode: import("./domain/quiz-state.enum").QuizMode;
        teamId: string | null;
        isCaptain: boolean;
        state: import("./domain/quiz-state.enum").QuizState.CREATED | import("./domain/quiz-state.enum").QuizState.WAITING | import("./domain/quiz-state.enum").QuizState.QUESTION_ACTIVE | import("./domain/quiz-state.enum").QuizState.QUESTION_LOCKED | import("./domain/quiz-state.enum").QuizState.ANSWER_REVEALED | import("./domain/quiz-state.enum").QuizState.LEADERBOARD;
    };
}
