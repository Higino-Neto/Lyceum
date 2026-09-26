import { Trophy } from "lucide-react";
import { useState } from "react";
import { useLocalStorage } from "../../../../hooks/useLocalStorage";
import { useTranslation } from "../../../../i18n";
import type { TranslationKey } from "../../../../i18n";

type Period = "today" | "this_week" | "this_month" | "all_time";

interface PeriodOption {
  key: Period;
  labelKey: TranslationKey;
  labelKeyAria: TranslationKey;
  field: "today_pages" | "this_week_pages" | "month_pages" | "total_pages";
}

const ICON_SIZE = 16;
const STROKE_WIDTH = 1.5;

const PERIODS: PeriodOption[] = [
  {
    key: "today",
    labelKey: "dashboard:ranking.periods.today",
    labelKeyAria: "dashboard:ranking.periodLabels.today",
    field: "today_pages",
  },
  {
    key: "this_week",
    labelKey: "dashboard:ranking.periods.thisWeek",
    labelKeyAria: "dashboard:ranking.periodLabels.thisWeek",
    field: "this_week_pages",
  },
  {
    key: "this_month",
    labelKey: "dashboard:ranking.periods.thisMonth",
    labelKeyAria: "dashboard:ranking.periodLabels.thisMonth",
    field: "month_pages",
  },
  {
    key: "all_time",
    labelKey: "dashboard:ranking.periods.allTime",
    labelKeyAria: "dashboard:ranking.periodLabels.allTime",
    field: "total_pages",
  },
];

interface SelectPeriodButtonProps {
  onChange: (period: Period) => void;
}

export default function SelectPeriodButton({
  onChange,
}: SelectPeriodButtonProps) {
  const { t } = useTranslation();
  const [period, setPeriod] = useLocalStorage<Period>(
    "ranking_type",
    "all_time",
  );

  return (
    <>
      {PERIODS.map((p) => (
        <button
          key={p.key}
          onClick={() => {
            setPeriod(p.key);
            onChange(p.key);
          }}
          className={`cursor-pointer flex-1 py-3 flex items-center justify-center gap-1  font-medium transition ${
            period === p.key
              ? "bg-zinc-800 text-white"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"
          }`}
          aria-label={t(p.labelKeyAria)}
        >
          {p.key === "all_time" ? (
            <Trophy size={ICON_SIZE} strokeWidth={STROKE_WIDTH} />
          ) : (
            <span className="text-sm font-medium">{t(p.labelKey)}</span>
          )}
        </button>
      ))}
    </>
  );
}
