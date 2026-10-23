import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

interface MonthNavigatorProps {
  label: string;
  onPrevious: () => void;
  onNext: () => void;
}

export function MonthNavigator({
  label,
  onPrevious,
  onNext,
}: MonthNavigatorProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-2 rounded-sm bg-background/80 p-1 ring-1 ring-border-strong m-2">
      <button
        type="button"
        onClick={onPrevious}
        className="flex h-10 w-10 items-center justify-center rounded-sm text-foreground-muted transition hover:bg-surface-muted hover:text-foreground cursor-pointer"
        aria-label={t("habits:month.previous")}
      >
        <ChevronLeft size={18} />
      </button>
      <div className="min-w-52 px-4 text-center">
        <p className="text-sm font-medium capitalize text-foreground">{label}</p>
        <p className="text-xs uppercase tracking-[0.24em] text-foreground-subtle">
          {t("habits:month.caption")}
        </p>
      </div>
      <button
        type="button"
        onClick={onNext}
        className="flex h-10 w-10 items-center justify-center rounded-xl text-foreground-muted transition hover:bg-surface-muted hover:text-foreground cursor-pointer"
        aria-label={t("habits:month.next")}
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}
