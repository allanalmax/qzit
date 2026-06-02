import type { InputHTMLAttributes } from 'react';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className = '', id, ...props }: Props) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm text-(--color-text-muted)"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`rounded-lg border border-(--color-border) bg-(--color-surface) px-3 py-2.5 text-(--color-text) placeholder:text-(--color-text-muted) focus:outline-none focus:ring-2 focus:ring-(--color-primary) ${error ? 'border-(--color-danger)' : ''} ${className}`}
        {...props}
      />
      {error && <p className="text-sm text-(--color-danger)">{error}</p>}
    </div>
  );
}
