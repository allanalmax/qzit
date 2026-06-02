import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { resetPassword } from '../api/auth-api';

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!token) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm flex flex-col gap-6">
          <div className="text-center">
            <Logo size="sm" />
          </div>
          <Card>
            <div className="flex flex-col gap-4 text-center">
              <p className="text-(--color-danger)">
                Invalid or missing reset token.
              </p>
              <Link
                to="/forgot-password"
                className="text-sm text-(--color-primary) hover:underline"
              >
                Request a new reset link
              </Link>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await resetPassword(token, password);
      navigate('/login', {
        state: { notice: 'Password reset successfully. Please sign in.' },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm flex flex-col gap-6">
        <div className="text-center">
          <Logo size="sm" />
        </div>
        <h1 className="text-2xl font-bold text-center">Set New Password</h1>

        <Card>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="New Password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
            <Input
              label="Confirm New Password"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={8}
            />
            {error && (
              <p className="text-sm text-(--color-danger)">{error}</p>
            )}
            <Button type="submit" fullWidth disabled={loading}>
              {loading ? 'Saving…' : 'Set New Password'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
