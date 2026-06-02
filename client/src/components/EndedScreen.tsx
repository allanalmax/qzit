import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import type { LeaderboardEntry } from '../types/quiz';
import { clearSession } from '../hooks/useQuizSession';
import { useNavigate } from 'react-router-dom';

interface Props {
  rankings: LeaderboardEntry[];
  participantId?: string;
}

export function EndedScreen({ rankings, participantId }: Props) {
  const navigate = useNavigate();
  const myRank = rankings.findIndex((e) => e.id === participantId);
  const myEntry = myRank >= 0 ? rankings[myRank] : null;

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-lg text-center">
        <h2 className="text-2xl font-bold mb-2">Quiz Over!</h2>
        {myEntry && (
          <div className="mb-4">
            <p className="text-(--color-text-muted) mb-1">Your Result</p>
            <p className="text-3xl font-bold">{myEntry.score} pts</p>
            <Badge color="primary">
              #{myRank + 1} of {rankings.length}
            </Badge>
          </div>
        )}
        <div className="flex flex-col gap-2 mt-4 text-left">
          {rankings.slice(0, 5).map((entry, i) => (
            <div
              key={entry.id}
              className={`flex items-center justify-between rounded-lg px-4 py-2 ${
                entry.id === participantId
                  ? 'bg-indigo-500/10'
                  : 'bg-(--color-surface-hover)'
              }`}
            >
              <span>
                <span className="font-bold mr-2">{i + 1}.</span>
                {entry.name}
              </span>
              <span className="font-bold">{entry.score}</span>
            </div>
          ))}
        </div>
        <Button
          className="mt-6"
          fullWidth
          onClick={() => {
            clearSession();
            navigate('/join');
          }}
        >
          Back to Home
        </Button>
      </Card>
    </div>
  );
}
