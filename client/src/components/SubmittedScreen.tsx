import { Card } from './ui/Card';

export function SubmittedScreen() {
  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <div className="text-4xl mb-3">✓</div>
        <h2 className="text-xl font-bold mb-1">Answer Submitted</h2>
        <p className="text-(--color-text-muted)">
          Waiting for other players...
        </p>
      </Card>
    </div>
  );
}
