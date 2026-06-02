import type { ReactNode } from 'react';

type Color = 'primary' | 'success' | 'danger' | 'warning' | 'muted';

const colors: Record<Color, string> = {
  primary: 'bg-indigo-500/20 text-indigo-300',
  success: 'bg-green-500/20 text-green-300',
  danger: 'bg-red-500/20 text-red-300',
  warning: 'bg-amber-500/20 text-amber-300',
  muted: 'bg-slate-500/20 text-slate-300',
};

interface Props {
  color?: Color;
  children: ReactNode;
}

export function Badge({ color = 'muted', children }: Props) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[color]}`}
    >
      {children}
    </span>
  );
}
