import { useEffect, useReducer, useCallback, useRef } from 'react';
import { getSocket, disconnectSocket } from '../socket/quiz-socket';
import type {
  QuizSessionSnapshot,
  SerializedQuestion,
  LeaderboardEntry,
} from '../types/quiz';
import { QuizState } from '../types/quiz';

interface HostState {
  snapshot: QuizSessionSnapshot | null;
  error: string | null;
  connected: boolean;
}

type Action =
  | { type: 'SNAPSHOT'; payload: QuizSessionSnapshot }
  | {
      type: 'PARTICIPANT_JOINED';
      payload: { participantId: string; name: string };
    }
  | { type: 'QUESTION_ACTIVATED'; payload: SerializedQuestion }
  | { type: 'SUBMISSION_COUNT'; payload: { questionId: string; count: number } }
  | { type: 'QUESTION_LOCKED' }
  | { type: 'ANSWER_REVEALED'; payload: { question: SerializedQuestion } }
  | {
      type: 'LEADERBOARD';
      payload: { rankings: LeaderboardEntry[]; hasNextQuestion: boolean };
    }
  | { type: 'ENDED'; payload: { leaderboard: LeaderboardEntry[] } }
  | { type: 'ERROR'; payload: string }
  | { type: 'CONNECTED' }
  | { type: 'DISCONNECTED' };

function reducer(state: HostState, action: Action): HostState {
  switch (action.type) {
    case 'SNAPSHOT':
      return { ...state, snapshot: action.payload, error: null };
    case 'PARTICIPANT_JOINED':
      return state.snapshot
        ? {
            ...state,
            snapshot: {
              ...state.snapshot,
              participantCount: state.snapshot.participantCount + 1,
            },
          }
        : state;
    case 'QUESTION_ACTIVATED':
      return state.snapshot
        ? {
            ...state,
            snapshot: {
              ...state.snapshot,
              state: QuizState.QUESTION_ACTIVE,
              activeQuestion: action.payload,
              submissionCount: 0,
            },
          }
        : state;
    case 'SUBMISSION_COUNT':
      return state.snapshot
        ? {
            ...state,
            snapshot: {
              ...state.snapshot,
              submissionCount: action.payload.count,
            },
          }
        : state;
    case 'QUESTION_LOCKED':
      return state.snapshot
        ? {
            ...state,
            snapshot: { ...state.snapshot, state: QuizState.QUESTION_LOCKED },
          }
        : state;
    case 'ANSWER_REVEALED':
      return state.snapshot
        ? {
            ...state,
            snapshot: {
              ...state.snapshot,
              state: QuizState.ANSWER_REVEALED,
              activeQuestion: action.payload.question,
            },
          }
        : state;
    case 'LEADERBOARD':
      return state.snapshot
        ? {
            ...state,
            snapshot: {
              ...state.snapshot,
              state: QuizState.LEADERBOARD,
              leaderboard: action.payload.rankings,
            },
          }
        : state;
    case 'ENDED':
      return state.snapshot
        ? {
            ...state,
            snapshot: {
              ...state.snapshot,
              state: QuizState.ENDED,
              leaderboard: action.payload.leaderboard,
            },
          }
        : state;
    case 'ERROR':
      return { ...state, error: action.payload };
    case 'CONNECTED':
      return { ...state, connected: true, error: null };
    case 'DISCONNECTED':
      return { ...state, connected: false };
    default:
      return state;
  }
}

export function useHostSession(
  quizId: string | undefined,
  hostCode: string | undefined,
) {
  const [state, dispatch] = useReducer(reducer, {
    snapshot: null,
    error: null,
    connected: false,
  });

  const idsRef = useRef({ quizId, hostCode });
  idsRef.current = { quizId, hostCode };

  useEffect(() => {
    if (!quizId || !hostCode) return;

    const socket = getSocket();

    socket.on('connect', () => {
      dispatch({ type: 'CONNECTED' });
      socket.emit('host:join-session', {
        quizId: idsRef.current.quizId,
        hostCode: idsRef.current.hostCode,
      });
    });

    socket.on('disconnect', () => dispatch({ type: 'DISCONNECTED' }));
    socket.on('quiz:snapshot', (data: QuizSessionSnapshot) =>
      dispatch({ type: 'SNAPSHOT', payload: data }),
    );
    socket.on('quiz:state-changed', (data: QuizSessionSnapshot) =>
      dispatch({ type: 'SNAPSHOT', payload: data }),
    );
    socket.on(
      'quiz:participant-joined',
      (data: { participantId: string; name: string }) =>
        dispatch({ type: 'PARTICIPANT_JOINED', payload: data }),
    );
    socket.on('quiz:question-activated', (data: SerializedQuestion) =>
      dispatch({ type: 'QUESTION_ACTIVATED', payload: data }),
    );
    socket.on(
      'quiz:submission-count',
      (data: { questionId: string; count: number }) =>
        dispatch({ type: 'SUBMISSION_COUNT', payload: data }),
    );
    socket.on('quiz:question-locked', () =>
      dispatch({ type: 'QUESTION_LOCKED' }),
    );
    socket.on(
      'quiz:answer-revealed',
      (data: { question: SerializedQuestion }) =>
        dispatch({ type: 'ANSWER_REVEALED', payload: data }),
    );
    socket.on(
      'quiz:leaderboard',
      (data: { rankings: LeaderboardEntry[]; hasNextQuestion: boolean }) =>
        dispatch({ type: 'LEADERBOARD', payload: data }),
    );
    socket.on('quiz:ended', (data: { leaderboard: LeaderboardEntry[] }) =>
      dispatch({ type: 'ENDED', payload: data }),
    );
    socket.on('quiz:error', (data: { message: string }) =>
      dispatch({ type: 'ERROR', payload: data.message }),
    );

    socket.connect();

    return () => {
      disconnectSocket();
    };
  }, [quizId, hostCode]);

  const emit = useCallback((event: string) => {
    const socket = getSocket();
    socket.emit(event, { quizId: idsRef.current.quizId });
  }, []);

  const startQuiz = useCallback(() => emit('host:start-quiz'), [emit]);
  const startQuestion = useCallback(() => emit('host:start-question'), [emit]);
  const lockQuestion = useCallback(() => emit('host:lock-question'), [emit]);
  const revealAnswer = useCallback(() => emit('host:reveal-answer'), [emit]);
  const showLeaderboard = useCallback(
    () => emit('host:show-leaderboard'),
    [emit],
  );
  const endQuiz = useCallback(() => emit('host:end-quiz'), [emit]);

  return {
    ...state,
    startQuiz,
    startQuestion,
    lockQuestion,
    revealAnswer,
    showLeaderboard,
    endQuiz,
  };
}
