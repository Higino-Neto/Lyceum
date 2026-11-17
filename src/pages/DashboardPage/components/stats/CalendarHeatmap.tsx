import { useMemo, useState } from "react";
import type { CalendarDay } from "../../../../features/stats/readingAnalytics";
import { formatNumber, getShortMonthNames, getWeekdayInitials, useLanguage, useTranslation } from "../../../../i18n";
import { seq } from "./chartTheme";

/** Quantile-free fixed buckets relative to the user's own busiest days. */
function levelFor(pages: number, thresholds: [number, number, number]): number {
  if (pages <= 0) return 0;
  if (pages < thresholds[0]) return 1;
  if (pages < thresholds[1]) return 2;
  if (pages < thresholds[2]) return 3;
  return 4;
}

interface CalendarHeatmapProps {
  days: CalendarDay[];
  maxCell?: number;
}

/** Calendar heatmap (one column per Monday-based week) that fills the card width. */
export default function CalendarHeatmap({ days, maxCell = 16 }: CalendarHeatmapProps) {
  const { t } = useTranslation();
  const { language, locale } = useLanguage();
  const [hover, setHover] = useState<CalendarDay | null>(null);
  const months = getShortMonthNames(language);
  const initials = getWeekdayInitials(language);

  const { weeks, thresholds } = useMemo(() => {
    const pad = days.length > 0 ? ((days[0]!.weekday + 6) % 7) : 0;
    const cells: Array<CalendarDay | null> = [...Array<null>(pad).fill(null), ...days];
    const grouped: Array<Array<CalendarDay | null>> = [];
    for (let index = 0; index < cells.length; index += 7) grouped.push(cells.slice(index, index + 7));
    const active = days.map((day) => day.pages).filter((pages) => pages > 0).sort((a, b) => a - b);
    const at = (q: number) => active[Math.min(active.length - 1, Math.floor(active.length * q))] ?? 0;
    return { weeks: grouped, thresholds: [Math.max(1, at(0.25)), Math.max(2, at(0.5)), Math.max(3, at(0.8))] as [number, number, number] };
  }, [days]);

  const columns = { gridTemplateColumns: `16px repeat(${weeks.length}, minmax(0, 1fr))`, maxWidth: 20 + weeks.length * (maxCell + 3) };
  const weekdayOrder = [1, 2, 3, 4, 5, 6, 0];

  return (
    <div>
      <div className="mb-1 grid gap-[3px] text-[10px] text-foreground-subtle" style={columns}>
        <div />
        {weeks.map((week, index) => {
          const first = week.find((day): day is CalendarDay => day !== null);
          const showMonth = first && Number(first.date.slice(8)) <= 7;
          return (
            <div key={index} className="overflow-visible whitespace-nowrap">
              {showMonth ? months[Number(first.date.slice(5, 7)) - 1] : ""}
            </div>
          );
        })}
      </div>
      <div className="grid gap-[3px]" style={columns}>
        <div className="grid grid-rows-7 gap-[3px] text-[9px] text-foreground-subtle">
          {weekdayOrder.map((weekday, index) => (
            <div key={weekday} className="flex items-center">{index % 2 === 0 ? initials[weekday] : ""}</div>
          ))}
        </div>
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="grid grid-rows-7 gap-[3px]">
            {Array.from({ length: 7 }, (_, dayIndex) => {
              const day = week[dayIndex];
              return day ? (
                <div
                  key={dayIndex}
                  className="heat-cell aspect-square w-full"
                  style={{ background: seq(levelFor(day.pages, thresholds)) }}
                  onMouseEnter={() => setHover(day)}
                  onMouseLeave={() => setHover(null)}
                  aria-label={`${day.date}: ${day.pages}`}
                />
              ) : (
                <div key={dayIndex} className="aspect-square w-full" />
              );
            })}
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-foreground-subtle">
        <span className="tabular-nums">
          {hover
            ? t("dashboard:stats.heatmapDay", {
                date: new Date(`${hover.date}T12:00:00`).toLocaleDateString(locale, { weekday: "short", day: "2-digit", month: "short", year: "numeric" }),
                pages: formatNumber(hover.pages, language),
              })
            : t("dashboard:stats.heatmapHint")}
        </span>
        <span className="flex items-center gap-1">
          {t("dashboard:stats.less")}
          {[0, 1, 2, 3, 4].map((level) => (
            <span key={level} className="inline-block h-2.5 w-2.5" style={{ background: seq(level) }} />
          ))}
          {t("dashboard:stats.more")}
        </span>
      </div>
    </div>
  );
}
