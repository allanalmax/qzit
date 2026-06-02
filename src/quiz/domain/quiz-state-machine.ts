import { BadRequestException } from '@nestjs/common';
import { QuizAction, QuizState } from './quiz-state.enum';

const transitions: Record<QuizState, Partial<Record<QuizAction, QuizState>>> = {
  [QuizState.CREATED]: {
    [QuizAction.OPEN_LOBBY]: QuizState.WAITING,
  },
  [QuizState.WAITING]: {
    [QuizAction.ACTIVATE_QUESTION]: QuizState.QUESTION_ACTIVE,
  },
  [QuizState.QUESTION_ACTIVE]: {
    [QuizAction.LOCK_QUESTION]: QuizState.QUESTION_LOCKED,
  },
  [QuizState.QUESTION_LOCKED]: {
    [QuizAction.REVEAL_ANSWER]: QuizState.ANSWER_REVEALED,
  },
  [QuizState.ANSWER_REVEALED]: {
    [QuizAction.SHOW_LEADERBOARD]: QuizState.LEADERBOARD,
    [QuizAction.ACTIVATE_QUESTION]: QuizState.QUESTION_ACTIVE,
  },
  [QuizState.LEADERBOARD]: {
    [QuizAction.ACTIVATE_QUESTION]: QuizState.QUESTION_ACTIVE,
    [QuizAction.END_QUIZ]: QuizState.ENDED,
  },
  [QuizState.ENDED]: {},
};

export function transitionQuizState(
  currentState: QuizState,
  action: QuizAction,
): QuizState {
  const nextState = transitions[currentState][action];

  if (!nextState) {
    throw new BadRequestException(
      `Invalid transition from ${currentState} using action ${action}`,
    );
  }

  return nextState;
}
