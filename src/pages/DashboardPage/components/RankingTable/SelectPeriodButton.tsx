import { Trophy } from "lucide-react";
import { useState } from "react";
import { useLocalStorage } from "../../../../hooks/useLocalStorage";

type Period = "today" | "this_week" | "this_month" | "all_time";

interface PeriodOption {
  key: Period;
  icon: React.ReactNode;
  field: "today_pages" | "this_week_pages" | "month_pages" | "total_pages";
}

const ICON_SIZE = 16;
const STROKE_WIDTH = 1.5;

const PERIODS: PeriodOption[] = [
  {
    key: "today",
    icon: <span className="text-sm font-medium">Hoje</span>,
    field: "today_pages",
  },
  {
    key: "this_week",
    icon: <span className="text-sm font-medium">Semanal</span>,
    field: "this_week_pages",
  },
  {
    key: "this_month",
    icon: <span className="text-sm font-medium">Mensal</span>,
    field: "month_pages",
  },
  {
    key: "all_time",
    icon: <Trophy size={ICON_SIZE} strokeWidth={STROKE_WIDTH} />,
    field: "total_pages",
  },
];

interface SelectPeriodButtonProps {
  onChange: (period: Period) => void;
}

export default function SelectPeriodButton({
  onChange,
}: SelectPeriodButtonProps) {
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
          aria-label={
            p.key === "today"
              ? "Hoje"
              : p.key === "this_week"
                ? "Esta semana"
                : p.key === "this_month"
                  ? "Este mês"
                  : "Geral"
          }
        >
          {p.icon}
        </button>
      ))}
    </>
  );
}
