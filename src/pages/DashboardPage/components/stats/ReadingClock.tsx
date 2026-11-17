import { useState } from "react";
import { formatNumber, useLanguage, useTranslation } from "../../../../i18n";

/** Radial 24-hour chart: one bar per hour, length proportional to pages. */
export default function ReadingClock({ hours }: { hours: number[] }) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...hours);
  const total = hours.reduce((sum, value) => sum + value, 0);
  const peak = hours.indexOf(Math.max(...hours));
  const size = 240;
  const center = size / 2;
  const inner = 40;
  const outer = 88;
  const focus = hover ?? peak;

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={t("dashboard:reading.clock.title")}>
        <circle cx={center} cy={center} r={inner - 4} fill="var(--surface-muted)" />
        <circle cx={center} cy={center} r={outer} fill="none" stroke="var(--viz-grid)" strokeDasharray="2 3" />
        {hours.map((value, hour) => {
          const angle = (hour / 24) * Math.PI * 2 - Math.PI / 2;
          const length = inner + (value / max) * (outer - inner);
          return (
            <g key={hour} onMouseEnter={() => setHover(hour)} onMouseLeave={() => setHover(null)}>
              {/* Wide invisible hit target */}
              <line
                x1={center + Math.cos(angle) * inner}
                y1={center + Math.sin(angle) * inner}
                x2={center + Math.cos(angle) * outer}
                y2={center + Math.sin(angle) * outer}
                stroke="transparent"
                strokeWidth={12}
              />
              <line
                x1={center + Math.cos(angle) * inner}
                y1={center + Math.sin(angle) * inner}
                x2={center + Math.cos(angle) * Math.max(inner + 2, length)}
                y2={center + Math.sin(angle) * Math.max(inner + 2, length)}
                stroke={hover === hour ? "var(--foreground)" : "var(--primary)"}
                strokeOpacity={value === 0 ? 0.15 : 0.35 + (value / max) * 0.65}
                strokeWidth={6}
              />
            </g>
          );
        })}
        {[0, 6, 12, 18].map((hour) => {
          const angle = (hour / 24) * Math.PI * 2 - Math.PI / 2;
          return (
            <text key={hour} x={center + Math.cos(angle) * 104} y={center + Math.sin(angle) * 104 + 4} textAnchor="middle" fontSize={10} fill="var(--foreground-subtle)">
              {String(hour).padStart(2, "0")}h
            </text>
          );
        })}
        <text x={center} y={center - 1} textAnchor="middle" fontSize={17} fontWeight={600} fill="var(--foreground)">
          {String(focus).padStart(2, "0")}h
        </text>
        <text x={center} y={center + 14} textAnchor="middle" fontSize={9} fill="var(--foreground-subtle)">
          {total > 0 ? `${formatNumber(Math.round(((hours[focus] ?? 0) / total) * 100), language)}%` : ""}
        </text>
      </svg>
    </div>
  );
}
