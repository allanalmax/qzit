import { BadRequestException } from '@nestjs/common';
import { QuizAction, QuizState } from './quiz-state.enum';
import { transitionQuizState } from './quiz-state-machine';

describe('transitionQuizState', () => {
  describe('valid transitions', () => {
    it('CREATED + OPEN_LOBBY → WAITING', () => {
      expect(
        transitionQuizState(QuizState.CREATED, QuizAction.OPEN_LOBBY),
      ).toBe(QuizState.WAITING);
    });

    it('WAITING + ACTIVATE_QUESTION → QUESTION_ACTIVE', () => {
      expect(
        transitionQuizState(QuizState.WAITING, QuizAction.ACTIVATE_QUESTION),
      ).toBe(QuizState.QUESTION_ACTIVE);
    });

    it('QUESTION_ACTIVE + LOCK_QUESTION → QUESTION_LOCKED', () => {
      expect(
        transitionQuizState(
          QuizState.QUESTION_ACTIVE,
          QuizAction.LOCK_QUESTION,
        ),
      ).toBe(QuizState.QUESTION_LOCKED);
    });

    it('QUESTION_LOCKED + REVEAL_ANSWER → ANSWER_REVEALED', () => {
      expect(
        transitionQuizState(
          QuizState.QUESTION_LOCKED,
          QuizAction.REVEAL_ANSWER,
        ),
      ).toBe(QuizState.ANSWER_REVEALED);
    });

    it('ANSWER_REVEALED + SHOW_LEADERBOARD → LEADERBOARD', () => {
      expect(
        transitionQuizState(
          QuizState.ANSWER_REVEALED,
          QuizAction.SHOW_LEADERBOARD,
        ),
      ).toBe(QuizState.LEADERBOARD);
    });

    it('ANSWER_REVEALED + ACTIVATE_QUESTION → QUESTION_ACTIVE (skip leaderboard)', () => {
      expect(
        transitionQuizState(
          QuizState.ANSWER_REVEALED,
          QuizAction.ACTIVATE_QUESTION,
        ),
      ).toBe(QuizState.QUESTION_ACTIVE);
    });

    it('LEADERBOARD + ACTIVATE_QUESTION → QUESTION_ACTIVE (next question)', () => {
      expect(
        transitionQuizState(
          QuizState.LEADERBOARD,
          QuizAction.ACTIVATE_QUESTION,
        ),
      ).toBe(QuizState.QUESTION_ACTIVE);
    });

    it('LEADERBOARD + END_QUIZ → ENDED', () => {
      expect(
        transitionQuizState(QuizState.LEADERBOARD, QuizAction.END_QUIZ),
      ).toBe(QuizState.ENDED);
    });
  });

  describe('invalid transitions', () => {
    it('CREATED + LOCK_QUESTION throws BadRequestException', () => {
      expect(() =>
        transitionQuizState(QuizState.CREATED, QuizAction.LOCK_QUESTION),
      ).toThrow(BadRequestException);
    });

    it('WAITING + REVEAL_ANSWER throws BadRequestException', () => {
      expect(() =>
        transitionQuizState(QuizState.WAITING, QuizAction.REVEAL_ANSWER),
      ).toThrow(BadRequestException);
    });

    it('QUESTION_ACTIVE + END_QUIZ throws BadRequestException', () => {
      expect(() =>
        transitionQuizState(QuizState.QUESTION_ACTIVE, QuizAction.END_QUIZ),
      ).toThrow(BadRequestException);
    });

    it('QUESTION_LOCKED + OPEN_LOBBY throws BadRequestException', () => {
      expect(() =>
        transitionQuizState(QuizState.QUESTION_LOCKED, QuizAction.OPEN_LOBBY),
      ).toThrow(BadRequestException);
    });

    it('ANSWER_REVEALED + END_QUIZ throws BadRequestException', () => {
      expect(() =>
        transitionQuizState(QuizState.ANSWER_REVEALED, QuizAction.END_QUIZ),
      ).toThrow(BadRequestException);
    });
  });

  describe('terminal state (ENDED)', () => {
    it.each(Object.values(QuizAction))(
      'ENDED + %s throws BadRequestException',
      (action) => {
        expect(() => transitionQuizState(QuizState.ENDED, action)).toThrow(
          BadRequestException,
        );
      },
    );
  });
});
