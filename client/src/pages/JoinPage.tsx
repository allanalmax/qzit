import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Logo } from '../components/Logo';
import { joinQuiz, lookupQuiz } from '../api/quiz-api';
import type { QuizLookupResponse } from '../types/quiz';
import { QuizMode } from '../types/quiz';

// Steps:
//   'code'        — enter quiz code
//   'individual'  — individual quiz: enter your name
//   'team-choice' — team quiz: choose create-team or join-team
//   'create-team' — enter team name + your name (becomes captain)
//   'join-team'   — pick existing team + enter your name

type Step = 'code' | 'individual' | 'team-choice' | 'create-team' | 'join-team';

export function JoinPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('code');
  const [joinCode, setJoinCode] = useState('');
  const [name, setName] = useState('');
  const [quizInfo, setQuizInfo] = useState<QuizLookupResponse | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [newTeamName, setNewTeamName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // ── Step 1: look up the quiz by code ──────────────────────────────
  async function handleCodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const info = await lookupQuiz(joinCode.trim().toUpperCase());
      setQuizInfo(info);
      setStep(info.mode === QuizMode.TEAM ? 'team-choice' : 'individual');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Quiz not found');
    } finally {
      setLoading(false);
    }
  }

  // ── Step 2a: individual — enter name then join ────────────────────
  async function handleIndividualJoin(e: React.FormEvent) {
    e.preventDefault();
    await doJoin(name.trim());
  }

  // ── Step 2b: team — create new team ──────────────────────────────
  async function handleCreateTeam(e: React.FormEvent) {
    e.preventDefault();
    await doJoin(name.trim(), newTeamName.trim());
  }

  // ── Step 2c: team — join existing team ───────────────────────────
  async function handleJoinTeam(e: React.FormEvent) {
    e.preventDefault();
    const team = quizInfo!.teams.find((t) => t.id === selectedTeamId);
    await doJoin(name.trim(), team?.name);
  }

  async function doJoin(playerName: string, teamName?: string) {
    setLoading(true);
    setError('');
    try {
      const res = await joinQuiz(
        joinCode.trim().toUpperCase(),
        playerName,
        teamName,
      );
      navigate(`/quiz/${res.quizId}`, {
        state: { participantId: res.participantId },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join');
    } finally {
      setLoading(false);
    }
  }

  function back(to: Step) {
    setError('');
    setStep(to);
  }

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-sm flex flex-col gap-6">
        <div className="text-center">
          <Logo size="sm" />
        </div>

        {/* ── Step 1: Enter quiz code ──────────────────────────── */}
        {step === 'code' && (
          <Card>
            <h1 className="text-2xl font-bold text-center mb-6">Join a Quiz</h1>
            <form onSubmit={handleCodeSubmit} className="flex flex-col gap-4">
              <Input
                label="Quiz Code"
                placeholder="e.g. ABC123"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                required
              />
              {error && (
                <p className="text-sm text-(--color-danger) text-center">
                  {error}
                </p>
              )}
              <Button
                type="submit"
                fullWidth
                disabled={loading || !joinCode.trim()}
              >
                {loading ? 'Looking up...' : 'Next'}
              </Button>
            </form>
          </Card>
        )}

        {/* ── Step 2a: Individual — enter name ────────────────── */}
        {step === 'individual' && quizInfo && (
          <Card>
            <h1 className="text-2xl font-bold text-center mb-1">
              {quizInfo.title}
            </h1>
            <p className="text-center text-sm text-(--color-text-muted) mb-6">
              Enter your name to join
            </p>
            <form
              onSubmit={handleIndividualJoin}
              className="flex flex-col gap-4"
            >
              <Input
                label="Your Name"
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              {error && (
                <p className="text-sm text-(--color-danger) text-center">
                  {error}
                </p>
              )}
              <Button
                type="submit"
                fullWidth
                disabled={loading || !name.trim()}
              >
                {loading ? 'Joining...' : 'Join Quiz'}
              </Button>
              <button
                type="button"
                onClick={() => back('code')}
                className="text-sm text-(--color-text-muted) hover:underline cursor-pointer text-center"
              >
                ← Change code
              </button>
            </form>
          </Card>
        )}

        {/* ── Step 2b: Team quiz — choose path ────────────────── */}
        {step === 'team-choice' && quizInfo && (
          <Card>
            <h1 className="text-2xl font-bold text-center mb-1">
              {quizInfo.title}
            </h1>
            <p className="text-center text-sm text-(--color-text-muted) mb-6">
              This is a team quiz. How would you like to join?
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => setStep('create-team')}
                className="w-full rounded-xl border-2 border-(--color-border) hover:border-(--color-primary) bg-(--color-surface) px-5 py-4 text-left transition-colors cursor-pointer"
              >
                <p className="font-semibold">Create a Team</p>
                <p className="text-sm text-(--color-text-muted) mt-0.5">
                  Start a new team and become its captain
                </p>
              </button>
              {quizInfo.teams.length > 0 && (
                <button
                  onClick={() => setStep('join-team')}
                  className="w-full rounded-xl border-2 border-(--color-border) hover:border-(--color-primary) bg-(--color-surface) px-5 py-4 text-left transition-colors cursor-pointer"
                >
                  <p className="font-semibold">Join an Existing Team</p>
                  <p className="text-sm text-(--color-text-muted) mt-0.5">
                    {quizInfo.teams.length}{' '}
                    {quizInfo.teams.length === 1 ? 'team' : 'teams'} available
                  </p>
                </button>
              )}
            </div>
            {error && (
              <p className="text-sm text-(--color-danger) text-center mt-3">
                {error}
              </p>
            )}
            <button
              type="button"
              onClick={() => back('code')}
              className="text-sm text-(--color-text-muted) hover:underline cursor-pointer text-center mt-4 block w-full"
            >
              ← Change code
            </button>
          </Card>
        )}

        {/* ── Step 3a: Create a team ───────────────────────────── */}
        {step === 'create-team' && quizInfo && (
          <Card>
            <h1 className="text-2xl font-bold text-center mb-1">
              Create a Team
            </h1>
            <p className="text-center text-sm text-(--color-text-muted) mb-6">
              You will be the team captain
            </p>
            <form onSubmit={handleCreateTeam} className="flex flex-col gap-4">
              <Input
                label="Team Name"
                placeholder="Enter team name"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                required
              />
              <Input
                label="Your Name"
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              {error && (
                <p className="text-sm text-(--color-danger) text-center">
                  {error}
                </p>
              )}
              <Button
                type="submit"
                fullWidth
                disabled={loading || !newTeamName.trim() || !name.trim()}
              >
                {loading ? 'Creating...' : 'Create Team & Join'}
              </Button>
              <button
                type="button"
                onClick={() => back('team-choice')}
                className="text-sm text-(--color-text-muted) hover:underline cursor-pointer text-center"
              >
                ← Back
              </button>
            </form>
          </Card>
        )}

        {/* ── Step 3b: Join an existing team ──────────────────── */}
        {step === 'join-team' && quizInfo && (
          <Card>
            <h1 className="text-2xl font-bold text-center mb-1">Join a Team</h1>
            <p className="text-center text-sm text-(--color-text-muted) mb-6">
              Choose your team and enter your name
            </p>
            <form onSubmit={handleJoinTeam} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm text-(--color-text-muted)">
                  Select Team
                </label>
                <select
                  value={selectedTeamId}
                  onChange={(e) => setSelectedTeamId(e.target.value)}
                  className="rounded-lg border border-(--color-border) bg-(--color-surface) px-3 py-2.5 text-(--color-text)"
                  required
                >
                  <option value="" disabled>
                    Choose a team...
                  </option>
                  {quizInfo.teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.memberCount}{' '}
                      {t.memberCount === 1 ? 'member' : 'members'})
                    </option>
                  ))}
                </select>
              </div>
              <Input
                label="Your Name"
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              {error && (
                <p className="text-sm text-(--color-danger) text-center">
                  {error}
                </p>
              )}
              <Button
                type="submit"
                fullWidth
                disabled={loading || !selectedTeamId || !name.trim()}
              >
                {loading ? 'Joining...' : 'Join Team'}
              </Button>
              <button
                type="button"
                onClick={() => back('team-choice')}
                className="text-sm text-(--color-text-muted) hover:underline cursor-pointer text-center"
              >
                ← Back
              </button>
            </form>
          </Card>
        )}
      </div>
    </div>
  );
}
