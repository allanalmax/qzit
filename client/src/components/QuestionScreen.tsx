import { useState } from 'react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import type { SerializedQuestion } from '../types/quiz';

interface Props {
  question: SerializedQuestion;
  onSubmit: (index: number) => void;
}

export function QuestionScreen({ question, onSubmit }: Props) {
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <h2 className="text-xl font-bold mb-1">{question.text}</h2>
        <p className="text-sm text-(--color-text-muted) mb-4">
          {question.timeLimitSeconds}s time limit
        </p>
        <div className="flex flex-col gap-3">
          {question.options.map((opt, i) => (
            <button
              key={i}
              onClick={() => setSelected(i)}
              className={`w-full rounded-lg border px-4 py-3 text-left transition-colors cursor-pointer ${
                selected === i
                  ? 'border-(--color-primary) bg-(--color-primary)/10 text-white'
                  : 'border-(--color-border) bg-(--color-surface-hover) hover:border-(--color-text-muted)'
              }`}
            >
              <span className="font-medium mr-2">
                {String.fromCharCode(65 + i)}.
              </span>
              {opt}
            </button>
          ))}
        </div>
        <Button
          className="mt-4"
          fullWidth
          disabled={selected === null}
          onClick={() => selected !== null && onSubmit(selected)}
        >
          Submit Answer
        </Button>
      </Card>
    </div>
  );
}
