import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";

interface StatFigureProps {
  label: string;
  value: ReactNode;
  /** Percentage change; `null` when there is nothing to compare with. */
  delta?: number | null;
  hint?: ReactNode;
  size?: "md" | "lg";
}

/** A labelled number with an optional change indicator. */
export default function StatFigure({ label, value, delta, hint, size = "md" }: StatFigureProps) {
  const tone = delta === undefined || delta === null || delta === 0
    ? "text-foreground-subtle"
    : delta > 0
      ? "text-success"
      : "text-destructive";
  const Icon = !delta ? Minus : delta > 0 ? TrendingUp : TrendingDown;
  return (
    <div className="min-w-0">
      <div className="truncate text-[11px] font-medium uppercase tracking-wider text-foreground-subtle">{label}</div>
      <div className={`mt-1 font-semibold tabular-nums text-foreground ${size === "lg" ? "text-3xl" : "text-xl"}`}>{value}</div>
      {(delta !== undefined || hint) && (
        <div className="mt-0.5 flex min-w-0 items-center gap-1 text-xs">
          {delta !== undefined && (
            <span className={`flex shrink-0 items-center gap-0.5 tabular-nums ${tone}`}>
              <Icon size={12} strokeWidth={1.5} />
              {delta === null ? "—" : `${delta > 0 ? "+" : ""}${delta}%`}
            </span>
          )}
          {hint && <span className="truncate text-foreground-subtle">{hint}</span>}
        </div>
      )}
    </div>
  );
}
