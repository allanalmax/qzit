import { useParams, useLocation } from 'react-router-dom';
import { useQuizSession, loadSession } from '../hooks/useQuizSession';
import { QuizState } from '../types/quiz';
import { WaitingScreen } from '../components/WaitingScreen';
import { QuestionScreen } from '../components/QuestionScreen';
import { SubmittedScreen } from '../components/SubmittedScreen';
import { LockedScreen } from '../components/LockedScreen';
import { RevealScreen } from '../components/RevealScreen';
import { LeaderboardScreen } from '../components/LeaderboardScreen';
import { EndedScreen } from '../components/EndedScreen';

export function QuizPage() {
  const { quizId } = useParams<{ quizId: string }>();
  const location = useLocation();
  const participantId =
    (location.state as { participantId?: string })?.participantId ??
    loadSession()?.participantId;

  const {
    snapshot,
    submitted,
    selectedOptionIndex,
    error,
    connected,
    submitAnswer,
  } = useQuizSession(quizId, participantId);

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <p className="text-(--color-danger)">{error}</p>
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <p className="text-(--color-text-muted)">
          {connected ? 'Loading quiz...' : 'Connecting...'}
        </p>
      </div>
    );
  }

  switch (snapshot.state) {
    case QuizState.CREATED:
    case QuizState.WAITING:
      return <WaitingScreen snapshot={snapshot} />;

    case QuizState.QUESTION_ACTIVE:
      if (submitted) return <SubmittedScreen />;
      if (!snapshot.activeQuestion) return null;
      return (
        <QuestionScreen
          key={snapshot.activeQuestion.id}
          question={snapshot.activeQuestion}
          onSubmit={submitAnswer}
        />
      );

    case QuizState.QUESTION_LOCKED:
      return <LockedScreen />;

    case QuizState.ANSWER_REVEALED:
      if (!snapshot.activeQuestion) return null;
      return (
        <RevealScreen
          question={snapshot.activeQuestion}
          selectedOptionIndex={selectedOptionIndex}
        />
      );

    case QuizState.LEADERBOARD:
      return (
        <LeaderboardScreen
          rankings={snapshot.leaderboard}
          participantId={snapshot.participant?.id}
        />
      );

    case QuizState.ENDED:
      return (
        <EndedScreen
          rankings={snapshot.leaderboard}
          participantId={snapshot.participant?.id}
        />
      );

    default:
      return null;
  }
}
