"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuizAction = exports.QuizMode = exports.QuizState = void 0;
var QuizState;
(function (QuizState) {
    QuizState["CREATED"] = "created";
    QuizState["WAITING"] = "waiting";
    QuizState["QUESTION_ACTIVE"] = "question_active";
    QuizState["QUESTION_LOCKED"] = "question_locked";
    QuizState["ANSWER_REVEALED"] = "answer_revealed";
    QuizState["LEADERBOARD"] = "leaderboard";
    QuizState["ENDED"] = "ended";
})(QuizState || (exports.QuizState = QuizState = {}));
var QuizMode;
(function (QuizMode) {
    QuizMode["INDIVIDUAL"] = "individual";
    QuizMode["TEAM"] = "team";
})(QuizMode || (exports.QuizMode = QuizMode = {}));
var QuizAction;
(function (QuizAction) {
    QuizAction["OPEN_LOBBY"] = "OPEN_LOBBY";
    QuizAction["ACTIVATE_QUESTION"] = "ACTIVATE_QUESTION";
    QuizAction["LOCK_QUESTION"] = "LOCK_QUESTION";
    QuizAction["REVEAL_ANSWER"] = "REVEAL_ANSWER";
    QuizAction["SHOW_LEADERBOARD"] = "SHOW_LEADERBOARD";
    QuizAction["END_QUIZ"] = "END_QUIZ";
})(QuizAction || (exports.QuizAction = QuizAction = {}));
//# sourceMappingURL=quiz-state.enum.js.map