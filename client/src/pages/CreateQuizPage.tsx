import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import type { CreateQuestionInput, CreateRoundInput } from '../types/quiz';
import { QuizMode } from '../types/quiz';
import { createQuiz } from '../api/quiz-api';
import { Logo } from '../components/Logo';
import { useAuth } from '../context/AuthContext';

const OPTION_LABELS = ['A', 'B', 'C', 'D'] as const;

function emptyQuestion(): CreateQuestionInput {
  return { text: '', options: ['', '', '', ''], correctOptionIndex: -1 };
}

function emptyRound(): CreateRoundInput {
  return { title: 'Round 1', questions: [emptyQuestion()] };
}

export function CreateQuizPage() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [title, setTitle] = useState('');
  const [mode, setMode] = useState<QuizMode>(QuizMode.INDIVIDUAL);
  const [rounds, setRounds] = useState<CreateRoundInput[]>([emptyRound()]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function updateRound(ri: number, patch: Partial<CreateRoundInput>) {
    setRounds((prev) =>
      prev.map((r, i) => (i === ri ? { ...r, ...patch } : r)),
    );
  }

  function updateQuestion(
    ri: number,
    qi: number,
    patch: Partial<CreateQuestionInput>,
  ) {
    setRounds((prev) =>
      prev.map((r, i) =>
        i === ri
          ? {
              ...r,
              questions: r.questions.map((q, j) =>
                j === qi ? { ...q, ...patch } : q,
              ),
            }
          : r,
      ),
    );
  }

  function updateOption(ri: number, qi: number, oi: number, value: string) {
    setRounds((prev) =>
      prev.map((r, i) =>
        i === ri
          ? {
              ...r,
              questions: r.questions.map((q, j) => {
                if (j !== qi) return q;
                const opts = [...q.options] as [string, string, string, string];
                opts[oi] = value;
                return { ...q, options: opts };
              }),
            }
          : r,
      ),
    );
  }

  function addQuestion(ri: number) {
    setRounds((prev) =>
      prev.map((r, i) =>
        i === ri ? { ...r, questions: [...r.questions, emptyQuestion()] } : r,
      ),
    );
  }

  function removeQuestion(ri: number, qi: number) {
    setRounds((prev) =>
      prev.map((r, i) =>
        i === ri
          ? { ...r, questions: r.questions.filter((_, j) => j !== qi) }
          : r,
      ),
    );
  }

  function addRound() {
    setRounds((prev) => [
      ...prev,
      { title: `Round ${prev.length + 1}`, questions: [emptyQuestion()] },
    ]);
  }

  function removeRound(ri: number) {
    setRounds((prev) => prev.filter((_, i) => i !== ri));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    for (let ri = 0; ri < rounds.length; ri++) {
      for (let qi = 0; qi < rounds[ri].questions.length; qi++) {
        if (rounds[ri].questions[qi].correctOptionIndex < 0) {
          setError(
            `Please select the correct answer for Round ${ri + 1}, Question ${qi + 1}`,
          );
          return;
        }
      }
    }

    setLoading(true);
    try {
      const res = await createQuiz({ title, mode, rounds }, token!);
      navigate(`/host/${res.id}`, {
        state: { hostCode: res.hostCode, joinCode: res.joinCode },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create quiz');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-1 justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-2xl flex flex-col gap-6"
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="text-sm text-(--color-text-muted) hover:underline cursor-pointer"
          >
            ← Dashboard
          </button>
          <div className="flex-1 text-center">
            <Logo size="sm" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-center">Create Quiz</h1>

        <Card>
          <div className="flex flex-col gap-4">
            <Input
              label="Quiz Title"
              value={title}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setTitle(e.target.value)
              }
              required
            />

            <div className="flex flex-col gap-1">
              <label className="text-sm text-(--color-text-muted)">
                Mode
              </label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as QuizMode)}
                className="rounded-lg border border-(--color-border) bg-(--color-surface) px-3 py-2.5 text-(--color-text)"
              >
                <option value={QuizMode.INDIVIDUAL}>Individual</option>
                <option value={QuizMode.TEAM}>Team</option>
              </select>
            </div>
          </div>
        </Card>

        {rounds.map((round, ri) => (
          <Card key={ri}>
            <div className="flex items-center justify-between mb-4">
              <Input
                label={`Round ${ri + 1} Title`}
                value={round.title}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  updateRound(ri, { title: e.target.value })
                }
                required
              />
              {rounds.length > 1 && (
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => removeRound(ri)}
                  className="ml-4 shrink-0"
                >
                  Remove Round
                </Button>
              )}
            </div>

            {round.questions.map((q, qi) => (
              <div
                key={qi}
                className="border border-(--color-border) rounded-lg p-4 mb-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="font-medium">Question {qi + 1}</span>
                  {round.questions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeQuestion(ri, qi)}
                      className="text-sm text-(--color-danger) hover:underline cursor-pointer"
                    >
                      Remove
                    </button>
                  )}
                </div>

                <Input
                  label="Question Text"
                  value={q.text}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    updateQuestion(ri, qi, { text: e.target.value })
                  }
                  required
                />

                <div className="flex flex-col gap-2 mt-3">
                  <p className="text-xs text-(--color-text-muted) mb-1">
                    Enter each option, then click an option row to mark it as
                    the correct answer.
                  </p>
                  {q.options.map((opt, oi) => {
                    const isCorrect = q.correctOptionIndex === oi;
                    return (
                      <div
                        key={oi}
                        className={`flex items-center gap-2 rounded-lg border-2 px-3 py-2 transition-colors ${
                          isCorrect
                            ? 'border-green-500 bg-green-500/10'
                            : 'border-(--color-border) hover:border-(--color-text-muted)'
                        }`}
                      >
                        <span className="text-sm font-bold w-5 shrink-0">
                          {OPTION_LABELS[oi]}
                        </span>
                        <input
                          type="text"
                          value={opt}
                          onChange={(e) =>
                            updateOption(ri, qi, oi, e.target.value)
                          }
                          placeholder={`Option ${OPTION_LABELS[oi]}`}
                          required
                          className="flex-1 bg-transparent focus:outline-none text-(--color-text)"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            updateQuestion(ri, qi, { correctOptionIndex: oi })
                          }
                          title={`Mark ${OPTION_LABELS[oi]} as correct answer`}
                          className={`shrink-0 text-xs font-semibold px-2 py-1 rounded cursor-pointer transition-colors ${
                            isCorrect
                              ? 'bg-green-500 text-white'
                              : 'bg-(--color-surface) text-(--color-text-muted) hover:bg-green-500/20 hover:text-green-400'
                          }`}
                        >
                          {isCorrect ? '✓ Correct' : 'Mark correct'}
                        </button>
                      </div>
                    );
                  })}
                  {q.correctOptionIndex < 0 && (
                    <p className="text-xs text-(--color-danger)">
                      No correct answer selected — click &quot;Mark
                      correct&quot; on the right answer.
                    </p>
                  )}
                </div>
              </div>
            ))}

            <Button
              type="button"
              variant="secondary"
              onClick={() => addQuestion(ri)}
            >
              + Add Question
            </Button>
          </Card>
        ))}

        <Button type="button" variant="secondary" onClick={addRound} fullWidth>
          + Add Round
        </Button>

        {error && (
          <p className="text-sm text-(--color-danger) text-center">
            {error}
          </p>
        )}

        <Button type="submit" fullWidth disabled={loading || !title}>
          {loading ? 'Creating...' : 'Create Quiz'}
        </Button>
      </form>
    </div>
  );
}
