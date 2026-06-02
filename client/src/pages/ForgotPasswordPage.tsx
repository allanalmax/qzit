import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { forgotPassword } from '../api/auth-api';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await forgotPassword(email);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
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
        <h1 className="text-2xl font-bold text-center">Forgot Password</h1>

        <Card>
          {submitted ? (
            <div className="flex flex-col gap-4 text-center">
              <p className="text-(--color-text-muted)">
                If an account exists for <strong>{email}</strong>, you'll
                receive a reset link shortly.
              </p>
              <Link
                to="/login"
                className="text-sm text-(--color-primary) hover:underline"
              >
                Back to Sign In
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <p className="text-sm text-(--color-text-muted)">
                Enter your email and we'll send you a link to reset your
                password.
              </p>
              <Input
                label="Email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              {error && (
                <p className="text-sm text-(--color-danger)">{error}</p>
              )}
              <Button type="submit" fullWidth disabled={loading}>
                {loading ? 'Sending…' : 'Send Reset Link'}
              </Button>
            </form>
          )}
        </Card>

        {!submitted && (
          <p className="text-center text-sm text-(--color-text-muted)">
            Remember your password?{' '}
            <Link
              to="/login"
              className="text-(--color-primary) hover:underline"
            >
              Sign In
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
