import { Card } from './ui/Card';

export function LockedScreen() {
  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <div className="text-4xl mb-3">🔒</div>
        <h2 className="text-xl font-bold mb-1">Time's Up!</h2>
        <p className="text-(--color-text-muted)">
          Answers are locked. Waiting for the reveal...
        </p>
      </Card>
    </div>
  );
}
