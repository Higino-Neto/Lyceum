import { formatNumber, useLanguage, useTranslation } from "../../../../i18n";

interface TooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color?: string;
    payload: Record<string, unknown>;
  }>;
  label?: string;
}

export default function ChartTooltip({ active, payload, label }: TooltipProps) {
  const { t } = useTranslation();
  const { language } = useLanguage();

  if (!active || !payload?.length) return null;

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded px-3 py-2 shadow-xl">
      <p className="text-zinc-400 text-xs">{label}</p>
      {payload.map((entry, index) => (
        <p
          key={index}
          className="text-zinc-100 text-sm font-medium"
          style={{ color: entry.color }}
        >
          {t("dashboard:charts.tooltipEntry", {
            name: entry.name,
            value: formatNumber(Number(entry.value ?? 0), language),
          })}
        </p>
      ))}
    </div>
  );
}
