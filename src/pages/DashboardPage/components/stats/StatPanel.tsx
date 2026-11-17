import type { LucideIcon } from "lucide-react";
import { Info } from "lucide-react";
import type { ReactNode } from "react";
import { ICON_SIZE, STROKE_WIDTH } from "./chartTheme";

interface StatPanelProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  /** Explains how the numbers are calculated (shown on hover). */
  info?: string;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** Card used by every statistic on the dashboard tabs. */
export default function StatPanel({ title, subtitle, icon: Icon, info, actions, className = "", children }: StatPanelProps) {
  return (
    <section className={`flex min-w-0 flex-col rounded-sm border border-border bg-surface p-4 ${className}`}>
      <header className="mb-3 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          {Icon && <Icon size={ICON_SIZE} strokeWidth={STROKE_WIDTH} className="mt-0.5 shrink-0 text-foreground-subtle" />}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="truncate text-sm font-medium text-foreground">{title}</h3>
              {info && (
                <span className="shrink-0 cursor-help text-foreground-subtle" title={info} aria-label={info}>
                  <Info size={13} strokeWidth={STROKE_WIDTH} />
                </span>
              )}
            </div>
            {subtitle && <p className="mt-0.5 text-xs text-foreground-subtle">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
      </header>
      <div className="min-w-0 flex-1">{children}</div>
    </section>
  );
}
