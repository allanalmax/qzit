"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transitionQuizState = transitionQuizState;
const common_1 = require("@nestjs/common");
const quiz_state_enum_1 = require("./quiz-state.enum");
const transitions = {
    [quiz_state_enum_1.QuizState.CREATED]: {
        [quiz_state_enum_1.QuizAction.OPEN_LOBBY]: quiz_state_enum_1.QuizState.WAITING,
    },
    [quiz_state_enum_1.QuizState.WAITING]: {
        [quiz_state_enum_1.QuizAction.ACTIVATE_QUESTION]: quiz_state_enum_1.QuizState.QUESTION_ACTIVE,
    },
    [quiz_state_enum_1.QuizState.QUESTION_ACTIVE]: {
        [quiz_state_enum_1.QuizAction.LOCK_QUESTION]: quiz_state_enum_1.QuizState.QUESTION_LOCKED,
    },
    [quiz_state_enum_1.QuizState.QUESTION_LOCKED]: {
        [quiz_state_enum_1.QuizAction.REVEAL_ANSWER]: quiz_state_enum_1.QuizState.ANSWER_REVEALED,
    },
    [quiz_state_enum_1.QuizState.ANSWER_REVEALED]: {
        [quiz_state_enum_1.QuizAction.SHOW_LEADERBOARD]: quiz_state_enum_1.QuizState.LEADERBOARD,
        [quiz_state_enum_1.QuizAction.ACTIVATE_QUESTION]: quiz_state_enum_1.QuizState.QUESTION_ACTIVE,
    },
    [quiz_state_enum_1.QuizState.LEADERBOARD]: {
        [quiz_state_enum_1.QuizAction.ACTIVATE_QUESTION]: quiz_state_enum_1.QuizState.QUESTION_ACTIVE,
        [quiz_state_enum_1.QuizAction.END_QUIZ]: quiz_state_enum_1.QuizState.ENDED,
    },
    [quiz_state_enum_1.QuizState.ENDED]: {},
};
function transitionQuizState(currentState, action) {
    const nextState = transitions[currentState][action];
    if (!nextState) {
        throw new common_1.BadRequestException(`Invalid transition from ${currentState} using action ${action}`);
    }
    return nextState;
}
//# sourceMappingURL=quiz-state-machine.js.map