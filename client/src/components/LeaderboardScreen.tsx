import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import type { LeaderboardEntry } from '../types/quiz';

interface Props {
  rankings: LeaderboardEntry[];
  participantId?: string;
}

export function LeaderboardScreen({ rankings, participantId }: Props) {
  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <h2 className="text-xl font-bold mb-4 text-center">Leaderboard</h2>
        <div className="flex flex-col gap-2">
          {rankings.map((entry, i) => {
            const isMe = entry.id === participantId;
            return (
              <div
                key={entry.id}
                className={`flex items-center justify-between rounded-lg px-4 py-3 ${
                  isMe
                    ? 'border border-(--color-primary) bg-indigo-500/10'
                    : 'bg-(--color-surface-hover)'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-(--color-text-muted) w-6 text-center">
                    {i + 1}
                  </span>
                  <span className="font-medium">{entry.name}</span>
                  {isMe && <Badge color="primary">You</Badge>}
                </div>
                <span className="font-bold">{entry.score}</span>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
