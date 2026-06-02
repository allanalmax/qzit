export interface Submission {
    id: string;
    questionId: string;
    participantId: string;
    teamId: string | null;
    selectedOptionIndex: number;
    isCorrect: boolean;
    submittedAt: Date;
}
