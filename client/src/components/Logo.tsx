interface Props {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap = {
  sm: 'text-xl',
  md: 'text-3xl',
  lg: 'text-5xl',
} as const;

export function Logo({ className = '', size = 'md' }: Props) {
  return (
    <span
      className={`font-extrabold tracking-tight ${sizeMap[size]} ${className}`}
    >
      <span className="text-(--color-primary)">QZ</span>
      <span className="text-(--color-text)">IT</span>
    </span>
  );
}
