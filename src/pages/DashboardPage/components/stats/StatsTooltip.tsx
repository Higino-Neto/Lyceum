import { formatNumber, useLanguage } from "../../../../i18n";

interface TooltipEntry {
  name?: string | number;
  value?: number | string | null | Array<number | string>;
  color?: string;
  dataKey?: string | number | ((value: unknown) => unknown);
  payload?: Record<string, unknown>;
}

interface StatsTooltipProps {
  active?: boolean;
  payload?: readonly TooltipEntry[];
  label?: string | number;
  unit?: string;
  labelFormatter?: (label: string | number) => string;
  valueFormatter?: (value: number) => string;
}

/** Recharts tooltip in the app's surface style, values in text tokens. */
export default function StatsTooltip({ active, payload, label, unit, labelFormatter, valueFormatter }: StatsTooltipProps) {
  const { language } = useLanguage();
  if (!active || !payload?.length) return null;
  const rows = payload.filter((entry) => entry.value !== null && entry.value !== undefined);
  if (rows.length === 0) return null;
  return (
    <div className="min-w-36 rounded-sm border border-border-strong bg-surface px-3 py-2 text-xs shadow-lg shadow-shadow">
      {label !== undefined && label !== "" && (
        <div className="mb-1 font-medium text-foreground">{labelFormatter ? labelFormatter(label) : String(label)}</div>
      )}
      {rows.map((entry, index) => {
        const raw = Array.isArray(entry.value) ? entry.value[1] : entry.value;
        const number = typeof raw === "number" ? raw : Number(raw);
        const text = Number.isFinite(number)
          ? valueFormatter ? valueFormatter(number) : formatNumber(number, language, { maximumFractionDigits: 1 })
          : String(raw);
        return (
          <div key={`${String(entry.name)}-${index}`} className="flex items-center gap-2 text-foreground-muted">
            <span className="inline-block h-2 w-2 shrink-0" style={{ background: entry.color ?? String(entry.payload?.fill ?? "var(--primary)") }} />
            <span className="truncate">{entry.name}</span>
            <span className="ml-auto pl-3 tabular-nums text-foreground">
              {text}
              {unit ? ` ${unit}` : ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}
