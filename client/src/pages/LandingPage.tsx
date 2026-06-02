import { Link } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { Button } from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';

export function LandingPage() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 p-4">
      <Logo size="lg" />
      <p className="text-lg text-(--color-text-muted) text-center max-w-md">
        Real-time live quizzes for classrooms, teams, and events.
      </p>
      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-xs">
        <Link to={isAuthenticated ? '/dashboard' : '/login'} className="flex-1">
          <Button fullWidth>Host a Quiz</Button>
        </Link>
        <Link to="/join" className="flex-1">
          <Button fullWidth variant="secondary">
            Join a Quiz
          </Button>
        </Link>
      </div>
    </div>
  );
}
