import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import type { QuizSessionSnapshot } from '../types/quiz';

interface Props {
  snapshot: QuizSessionSnapshot;
}

export function WaitingScreen({ snapshot }: Props) {
  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <h1 className="text-2xl font-bold mb-2">{snapshot.title}</h1>
        <p className="text-(--color-text-muted) mb-4">
          Waiting for the host to start...
        </p>
        <div className="flex justify-center gap-3">
          <Badge color="primary">{snapshot.participantCount} players</Badge>
          {snapshot.teamCount > 0 && (
            <Badge color="success">{snapshot.teamCount} teams</Badge>
          )}
        </div>
        <div className="mt-6 animate-pulse text-(--color-text-muted) text-sm">
          ● Live
        </div>
      </Card>
    </div>
  );
}
