import { useEffect, useReducer, useCallback, useRef } from 'react';
import { getSocket, disconnectSocket } from '../socket/quiz-socket';
import type {
  QuizSessionSnapshot,
  SerializedQuestion,
  LeaderboardEntry,
} from '../types/quiz';
import { QuizState } from '../types/quiz';

interface SessionState {
  snapshot: QuizSessionSnapshot | null;
  submitted: boolean;
  selectedOptionIndex: number | null;
  error: string | null;
  connected: boolean;
}

type Action =
  | { type: 'SNAPSHOT'; payload: QuizSessionSnapshot }
  | { type: 'QUESTION_ACTIVATED'; payload: SerializedQuestion }
  | { type: 'ANSWER_SUBMITTED'; payload: number }
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

function reducer(state: SessionState, action: Action): SessionState {
  switch (action.type) {
    case 'SNAPSHOT': {
      const isNewQuestion =
        action.payload.activeQuestion?.id !==
        state.snapshot?.activeQuestion?.id;
      return {
        ...state,
        snapshot: action.payload,
        submitted: isNewQuestion ? false : state.submitted,
        selectedOptionIndex: isNewQuestion ? null : state.selectedOptionIndex,
        error: null,
      };
    }
    case 'QUESTION_ACTIVATED':
      return state.snapshot
        ? {
            ...state,
            snapshot: {
              ...state.snapshot,
              state: QuizState.QUESTION_ACTIVE,
              activeQuestion: action.payload,
            },
            submitted: false,
            selectedOptionIndex: null,
          }
        : state;
    case 'ANSWER_SUBMITTED':
      return { ...state, submitted: true, selectedOptionIndex: action.payload };
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

const SESSION_KEY = 'qzit_session';

interface StoredSession {
  quizId: string;
  participantId: string;
}

function saveSession(data: StoredSession) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
}

export function loadSession(): StoredSession | null {
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

export function useQuizSession(
  quizId: string | undefined,
  participantId: string | undefined,
) {
  const [state, dispatch] = useReducer(reducer, {
    snapshot: null,
    submitted: false,
    selectedOptionIndex: null,
    error: null,
    connected: false,
  });

  const idsRef = useRef({ quizId, participantId });
  idsRef.current = { quizId, participantId };

  const selectedRef = useRef<number | null>(null);
  const joinedRef = useRef(false);

  useEffect(() => {
    if (!quizId || !participantId) return;

    saveSession({ quizId, participantId });
    joinedRef.current = false;

    const socket = getSocket();

    socket.on('connect', () => {
      dispatch({ type: 'CONNECTED' });
      const event = joinedRef.current
        ? 'participant:rejoin-session'
        : 'participant:join-session';
      joinedRef.current = true;
      socket.emit(event, {
        quizId: idsRef.current.quizId,
        participantId: idsRef.current.participantId,
      });
    });

    socket.on('disconnect', () => dispatch({ type: 'DISCONNECTED' }));
    socket.on('quiz:snapshot', (data: QuizSessionSnapshot) =>
      dispatch({ type: 'SNAPSHOT', payload: data }),
    );
    socket.on('quiz:state-changed', (data: QuizSessionSnapshot) =>
      dispatch({ type: 'SNAPSHOT', payload: data }),
    );
    socket.on('quiz:question-activated', (data: SerializedQuestion) =>
      dispatch({ type: 'QUESTION_ACTIVATED', payload: data }),
    );
    socket.on('quiz:answer-submitted', () =>
      dispatch({
        type: 'ANSWER_SUBMITTED',
        payload: selectedRef.current ?? -1,
      }),
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
  }, [quizId, participantId]);

  const submitAnswer = useCallback((selectedOptionIndex: number) => {
    selectedRef.current = selectedOptionIndex;
    const socket = getSocket();
    socket.emit('participant:submit-answer', {
      quizId: idsRef.current.quizId,
      selectedOptionIndex,
    });
  }, []);

  return { ...state, submitAnswer };
}
