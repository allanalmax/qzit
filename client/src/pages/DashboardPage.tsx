import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useAuth } from '../context/AuthContext';
import { getMyQuizzes } from '../api/quiz-api';
import type { MyQuizSummary } from '../types/quiz';
import { QuizState, QuizMode } from '../types/quiz';

const stateColors: Record<
  QuizState,
  'muted' | 'success' | 'warning' | 'primary' | 'danger'
> = {
  [QuizState.CREATED]: 'muted',
  [QuizState.WAITING]: 'warning',
  [QuizState.QUESTION_ACTIVE]: 'primary',
  [QuizState.QUESTION_LOCKED]: 'warning',
  [QuizState.ANSWER_REVEALED]: 'warning',
  [QuizState.LEADERBOARD]: 'primary',
  [QuizState.ENDED]: 'success',
};

const stateLabel: Record<QuizState, string> = {
  [QuizState.CREATED]: 'Not started',
  [QuizState.WAITING]: 'Waiting',
  [QuizState.QUESTION_ACTIVE]: 'Live',
  [QuizState.QUESTION_LOCKED]: 'Live',
  [QuizState.ANSWER_REVEALED]: 'Live',
  [QuizState.LEADERBOARD]: 'Live',
  [QuizState.ENDED]: 'Ended',
};

export function DashboardPage() {
  const navigate = useNavigate();
  const { token, clearToken } = useAuth();
  const [quizzes, setQuizzes] = useState<MyQuizSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    getMyQuizzes(token)
      .then(setQuizzes)
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Failed to load'),
      )
      .finally(() => setLoading(false));
  }, [token]);

  function handleResume(quiz: MyQuizSummary) {
    navigate(`/host/${quiz.id}`, {
      state: { hostCode: quiz.hostCode, joinCode: quiz.joinCode },
    });
  }

  return (
    <div className="flex flex-1 justify-center p-4">
      <div className="w-full max-w-2xl flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Logo size="sm" />
          <button
            onClick={() => {
              clearToken();
              navigate('/');
            }}
            className="text-sm text-(--color-text-muted) hover:underline cursor-pointer"
          >
            Sign out
          </button>
        </div>

        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">My Quizzes</h1>
          <Button onClick={() => navigate('/create')}>+ New Quiz</Button>
        </div>

        {loading && (
          <p className="text-center text-(--color-text-muted)">
            Loading...
          </p>
        )}

        {error && (
          <p className="text-center text-(--color-danger)">{error}</p>
        )}

        {!loading && !error && quizzes.length === 0 && (
          <Card>
            <div className="text-center py-8 flex flex-col gap-4">
              <p className="text-(--color-text-muted)">
                You haven&apos;t created any quizzes yet.
              </p>
              <Button onClick={() => navigate('/create')}>
                Create your first quiz
              </Button>
            </div>
          </Card>
        )}

        {quizzes.map((quiz) => (
          <Card key={quiz.id}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-1 flex-1 min-w-0">
                <h2 className="text-lg font-bold truncate">{quiz.title}</h2>
                <div className="flex flex-wrap gap-2">
                  <Badge color={stateColors[quiz.state]}>
                    {stateLabel[quiz.state]}
                  </Badge>
                  <Badge color="muted">
                    {quiz.mode === QuizMode.TEAM ? 'Team' : 'Individual'}
                  </Badge>
                  <Badge color="muted">
                    {quiz.participantCount}{' '}
                    {quiz.participantCount === 1 ? 'player' : 'players'}
                  </Badge>
                </div>
                {quiz.state !== QuizState.ENDED && (
                  <p className="text-xs text-(--color-text-muted) mt-1">
                    Join code:{' '}
                    <span className="font-mono font-bold tracking-wider">
                      {quiz.joinCode}
                    </span>
                  </p>
                )}
              </div>
              {quiz.state !== QuizState.ENDED && (
                <Button
                  variant={
                    quiz.state === QuizState.CREATED ? 'primary' : 'secondary'
                  }
                  onClick={() => handleResume(quiz)}
                >
                  {quiz.state === QuizState.CREATED ? 'Open' : 'Rejoin'}
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
