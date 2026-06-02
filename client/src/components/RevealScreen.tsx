import { Card } from './ui/Card';
import type { SerializedQuestion } from '../types/quiz';

interface Props {
  question: SerializedQuestion;
  selectedOptionIndex: number | null;
}

export function RevealScreen({ question, selectedOptionIndex }: Props) {
  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <h2 className="text-xl font-bold mb-4">{question.text}</h2>
        <div className="flex flex-col gap-2">
          {question.options.map((opt, i) => {
            const isCorrect = i === question.correctOptionIndex;
            const isSelected = i === selectedOptionIndex;
            const isWrong = isSelected && !isCorrect;
            return (
              <div
                key={i}
                className={`rounded-lg border px-4 py-3 ${
                  isCorrect
                    ? 'border-(--color-success) bg-green-500/10 text-green-300'
                    : isWrong
                      ? 'border-(--color-danger) bg-red-500/10 text-red-300'
                      : 'border-(--color-border) text-(--color-text-muted)'
                }`}
              >
                <span className="font-medium mr-2">
                  {String.fromCharCode(65 + i)}.
                </span>
                {opt}
                {isCorrect && <span className="ml-2">✓</span>}
                {isWrong && <span className="ml-2">✗</span>}
                {isSelected && (
                  <span className="ml-2 text-xs opacity-70">(your answer)</span>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
