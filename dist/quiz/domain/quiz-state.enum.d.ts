export declare enum QuizState {
    CREATED = "created",
    WAITING = "waiting",
    QUESTION_ACTIVE = "question_active",
    QUESTION_LOCKED = "question_locked",
    ANSWER_REVEALED = "answer_revealed",
    LEADERBOARD = "leaderboard",
    ENDED = "ended"
}
export declare enum QuizMode {
    INDIVIDUAL = "individual",
    TEAM = "team"
}
export declare enum QuizAction {
    OPEN_LOBBY = "OPEN_LOBBY",
    ACTIVATE_QUESTION = "ACTIVATE_QUESTION",
    LOCK_QUESTION = "LOCK_QUESTION",
    REVEAL_ANSWER = "REVEAL_ANSWER",
    SHOW_LEADERBOARD = "SHOW_LEADERBOARD",
    END_QUIZ = "END_QUIZ"
}
