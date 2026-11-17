import { BookOpen, GraduationCap } from "lucide-react";
import { useTranslation } from "../i18n";

export type MobileReaderMode = "reader" | "learning";

/**
 * Switches a book between its own reader (EPUB, PDF, TXT...) and .lyceum
 * reading (tappable words, translation, vocabulary). The choice is remembered
 * per book, so the next time it opens in the same mode.
 */
export function ReadingModeSwitch({
  mode,
  formatLabel,
  onChange,
}: {
  mode: MobileReaderMode;
  /** The book's own format, e.g. "EPUB". */
  formatLabel: string;
  onChange(mode: MobileReaderMode): void;
}) {
  const { t } = useTranslation();
  const options: Array<{ value: MobileReaderMode; title: string; hint: string; icon: React.ReactNode }> = [
    { value: "reader", title: t("mobile:readingMode.original", { format: formatLabel }), hint: t("mobile:readingMode.originalHint"), icon: <BookOpen size={18} /> },
    { value: "learning", title: t("mobile:readingMode.lyceum"), hint: t("mobile:readingMode.lyceumHint"), icon: <GraduationCap size={18} /> },
  ];
  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-foreground-subtle">{t("mobile:readingMode.title")}</p>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t("mobile:readingMode.title")}>
        {options.map((option) => {
          const active = option.value === mode;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => { if (!active) onChange(option.value); }}
              className={`flex min-h-[4.5rem] flex-col items-start gap-1 rounded-2xl border px-3 py-2.5 text-left transition-colors ${active ? "border-primary bg-primary-muted text-primary" : "border-border bg-surface-muted text-foreground active:bg-surface"}`}
            >
              <span className="flex items-center gap-2 text-sm font-semibold">{option.icon}{option.title}</span>
              <span className={`text-xs leading-4 ${active ? "text-primary/80" : "text-foreground-subtle"}`}>{option.hint}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs leading-5 text-foreground-subtle">{t("mobile:readingMode.rememberHint")}</p>
    </div>
  );
}
