import { useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useHostSession } from '../hooks/useHostSession';
import { QuizMode, QuizState } from '../types/quiz';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Logo } from '../components/Logo';

const OPTION_LABELS = ['A', 'B', 'C', 'D'] as const;

const HOST_SESSION_KEY = 'qzit_host_session';

interface StoredHostSession {
  quizId: string;
  hostCode: string;
  joinCode: string;
}

function saveHostSession(data: StoredHostSession) {
  sessionStorage.setItem(HOST_SESSION_KEY, JSON.stringify(data));
}

function loadHostSession(quizId: string): StoredHostSession | null {
  const raw = sessionStorage.getItem(HOST_SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed: StoredHostSession = JSON.parse(raw);
    return parsed.quizId === quizId ? parsed : null;
  } catch {
    return null;
  }
}

export function HostDashboard() {
  const { quizId } = useParams<{ quizId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const fromState = (location.state ?? {}) as {
    hostCode?: string;
    joinCode?: string;
  };
  const stored = quizId ? loadHostSession(quizId) : null;
  const hostCode = fromState.hostCode ?? stored?.hostCode;
  const joinCode = fromState.joinCode ?? stored?.joinCode;

  useEffect(() => {
    if (quizId && hostCode && joinCode) {
      saveHostSession({ quizId, hostCode, joinCode });
    }
  }, [quizId, hostCode, joinCode]);

  const {
    snapshot,
    error,
    connected,
    startQuiz,
    startQuestion,
    lockQuestion,
    revealAnswer,
    showLeaderboard,
    endQuiz,
  } = useHostSession(quizId, hostCode);

  if (!hostCode) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <p className="text-(--color-danger)">
          Missing host code. Please create a quiz first.
        </p>
      </div>
    );
  }

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
          {connected ? 'Loading...' : 'Connecting...'}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 justify-center p-4">
      <div className="w-full max-w-2xl flex flex-col gap-4">
        {/* Header */}
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <Logo size="sm" />
              <h1 className="text-2xl font-bold">{snapshot.title}</h1>
              <div className="flex gap-2 mt-1">
                <Badge color="primary">
                  {snapshot.participantCount} players
                </Badge>
                <Badge color="muted">{snapshot.state.replace('_', ' ')}</Badge>
              </div>
            </div>
            {joinCode && (
              <div className="text-right">
                <p className="text-xs text-(--color-text-muted)">
                  Join Code
                </p>
                <p className="text-2xl font-mono font-bold tracking-wider">
                  {joinCode}
                </p>
              </div>
            )}
          </div>
        </Card>

        {/* State-specific content */}
        {snapshot.state === QuizState.CREATED && (
          <Card>
            <p className="text-center text-(--color-text-muted) mb-4">
              Share the join code with participants, then start the quiz.
            </p>
            <Button fullWidth onClick={startQuiz}>
              Start Quiz
            </Button>
          </Card>
        )}

        {snapshot.state === QuizState.WAITING && (
          <Card>
            <p className="text-center text-(--color-text-muted) mb-4">
              {snapshot.participantCount} participant(s) connected. Ready?
            </p>
            <Button fullWidth onClick={startQuestion}>
              Show First Question
            </Button>
          </Card>
        )}

        {snapshot.state === QuizState.QUESTION_ACTIVE &&
          snapshot.activeQuestion && (
            <Card>
              <h2 className="text-lg font-bold mb-2">
                {snapshot.activeQuestion.text}
              </h2>
              <div className="flex flex-col gap-2 mb-4">
                {snapshot.activeQuestion.options.map((opt, i) => (
                  <div
                    key={i}
                    className="px-4 py-2 rounded-lg border border-(--color-border) bg-(--color-surface)"
                  >
                    <span className="font-medium mr-2">
                      {OPTION_LABELS[i]}.
                    </span>
                    {opt}
                  </div>
                ))}
              </div>
              <p className="text-sm text-(--color-text-muted) mb-4">
                Submissions: {snapshot.submissionCount ?? 0} /{' '}
                {snapshot.mode === QuizMode.TEAM
                  ? `${snapshot.teamCount} teams`
                  : `${snapshot.participantCount} players`}
              </p>
              <Button fullWidth onClick={lockQuestion}>
                Lock Answers
              </Button>
            </Card>
          )}

        {snapshot.state === QuizState.QUESTION_LOCKED && (
          <Card>
            <p className="text-center text-(--color-text-muted) mb-4">
              Answers locked. Ready to reveal the correct answer?
            </p>
            <Button fullWidth onClick={revealAnswer}>
              Reveal Answer
            </Button>
          </Card>
        )}

        {snapshot.state === QuizState.ANSWER_REVEALED &&
          snapshot.activeQuestion && (
            <Card>
              <h2 className="text-lg font-bold mb-2">
                {snapshot.activeQuestion.text}
              </h2>
              <div className="flex flex-col gap-2 mb-4">
                {snapshot.activeQuestion.options.map((opt, i) => {
                  const isCorrect =
                    i === snapshot.activeQuestion!.correctOptionIndex;
                  return (
                    <div
                      key={i}
                      className={`px-4 py-2 rounded-lg border ${
                        isCorrect
                          ? 'border-green-500 bg-green-500/10 text-green-400'
                          : 'border-(--color-border)'
                      }`}
                    >
                      <span className="font-medium mr-2">
                        {OPTION_LABELS[i]}.
                      </span>
                      {opt}
                      {isCorrect && <span className="ml-2">✓</span>}
                    </div>
                  );
                })}
              </div>
              <Button fullWidth onClick={showLeaderboard}>
                Show Leaderboard
              </Button>
            </Card>
          )}

        {snapshot.state === QuizState.LEADERBOARD && (
          <Card>
            <h2 className="text-xl font-bold mb-4 text-center">Leaderboard</h2>
            <div className="flex flex-col gap-2 mb-4">
              {snapshot.leaderboard.map((entry, i) => {
                const podiumClass =
                  i === 0
                    ? 'border-yellow-500 bg-yellow-500/10'
                    : i === 1
                      ? 'border-gray-400 bg-gray-400/10'
                      : i === 2
                        ? 'border-amber-600 bg-amber-600/10'
                        : 'border-[var(--color-border)]';
                return (
                  <div
                    key={entry.id}
                    className={`flex items-center justify-between px-4 py-2 rounded-lg border ${podiumClass}`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="font-bold w-6 text-center">
                        {i + 1}.
                      </span>
                      <span>{entry.name}</span>
                      {snapshot.mode === QuizMode.TEAM &&
                        entry.memberIds &&
                        entry.memberIds.length > 0 && (
                          <span className="text-xs text-(--color-text-muted)">
                            ({entry.memberIds.length}{' '}
                            {entry.memberIds.length === 1
                              ? 'member'
                              : 'members'}
                            )
                          </span>
                        )}
                    </span>
                    <span className="font-bold">{entry.score} pts</span>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-3">
              <Button fullWidth onClick={startQuestion}>
                Next Question
              </Button>
              <Button fullWidth variant="danger" onClick={endQuiz}>
                End Quiz
              </Button>
            </div>
          </Card>
        )}

        {snapshot.state === QuizState.ENDED && (
          <Card>
            <h2 className="text-xl font-bold mb-4 text-center">
              Final Results
            </h2>
            <div className="flex flex-col gap-2">
              {snapshot.leaderboard.map((entry, i) => {
                const podiumClass =
                  i === 0
                    ? 'border-yellow-500 bg-yellow-500/10'
                    : i === 1
                      ? 'border-gray-400 bg-gray-400/10'
                      : i === 2
                        ? 'border-amber-600 bg-amber-600/10'
                        : 'border-[var(--color-border)]';
                return (
                  <div
                    key={entry.id}
                    className={`flex items-center justify-between px-4 py-2 rounded-lg border ${podiumClass}`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="font-bold w-6 text-center">
                        {i + 1}.
                      </span>
                      <span>{entry.name}</span>
                      {snapshot.mode === QuizMode.TEAM &&
                        entry.memberIds &&
                        entry.memberIds.length > 0 && (
                          <span className="text-xs text-(--color-text-muted)">
                            ({entry.memberIds.length}{' '}
                            {entry.memberIds.length === 1
                              ? 'member'
                              : 'members'}
                            )
                          </span>
                        )}
                    </span>
                    <span className="font-bold">{entry.score} pts</span>
                  </div>
                );
              })}
            </div>
            <Button
              fullWidth
              onClick={() => navigate('/dashboard')}
              className="mt-4"
            >
              Back to Dashboard
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}
