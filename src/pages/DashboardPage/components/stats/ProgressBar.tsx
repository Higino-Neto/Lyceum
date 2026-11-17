interface ProgressBarProps {
  value: number;
  max: number;
  color?: string;
  /** Optional marker (0–1) such as the expected pace for a goal. */
  marker?: number;
  className?: string;
}

export default function ProgressBar({ value, max, color = "var(--primary)", marker, className = "" }: ProgressBarProps) {
  const ratio = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <div className={`relative h-1.5 w-full bg-surface-muted ${className}`} role="progressbar" aria-valuenow={Math.round(ratio * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full" style={{ width: `${ratio * 100}%`, background: color }} />
      {marker !== undefined && (
        <div className="absolute -top-0.5 h-2.5 w-px bg-foreground-muted" style={{ left: `${Math.max(0, Math.min(1, marker)) * 100}%` }} />
      )}
    </div>
  );
}
