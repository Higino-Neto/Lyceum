import { Download, Bookmark, X } from "lucide-react";
import {
  VocabularyEntry,
  VocabularyStats,
  VocabularyStatus,
  getVocabularyStatusClasses,
  getVocabularyStatusLabelKey,
} from "./languageLearning";
import { useTranslation, type TranslationKey } from "../../../../i18n";

type VocabularyFilter = "all" | "learning" | "known";

interface VocabularyPanelProps {
  isOpen: boolean;
  fileName?: string;
  entries: VocabularyEntry[];
  stats: VocabularyStats;
  filter: VocabularyFilter;
  onFilterChange: (filter: VocabularyFilter) => void;
  onStatusChange: (word: string, status: VocabularyStatus) => void;
  onToggleSaved: (word: string) => void;
  onExportCsv: () => void;
  onClose: () => void;
}

const FILTER_LABEL_KEYS = {
  all: "epub:vocabulary.filters.all",
  learning: "epub:vocabulary.filters.learning",
  known: "epub:vocabulary.filters.known",
} as const satisfies Record<VocabularyFilter, TranslationKey>;

const STATUS_OPTIONS: VocabularyStatus[] = ["new", "learning", "known"];

export default function VocabularyPanel({
  isOpen,
  fileName,
  entries,
  stats,
  filter,
  onFilterChange,
  onStatusChange,
  onToggleSaved,
  onExportCsv,
  onClose,
}: VocabularyPanelProps) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  const filteredEntries = entries.filter((entry) => {
    if (filter === "all") return true;
    return entry.status === filter;
  });

  return (
    <div className="absolute inset-0 z-40 flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-backdrop"
        onClick={onClose}
      />

      <aside className="relative z-10 flex h-full w-full max-w-[360px] flex-col border-l border-border bg-surface shadow-2xl">
        <header className="border-b border-border px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-foreground-subtle">
                {t("epub:vocabulary.title")}
              </p>
              <h2 className="mt-1 text-base font-semibold text-foreground">
                {fileName || t("epub:vocabulary.currentBook")}
              </h2>
              <p className="mt-2 text-sm text-foreground-muted">
                {t("epub:vocabulary.tracked", { count: stats.trackedCount })}
              </p>
              <p className="text-sm text-foreground-subtle">
                {t("epub:vocabulary.summary", {
                  known: stats.knownCount,
                  learning: stats.learningCount,
                  progress: stats.progressPercent,
                })}
              </p>
            </div>

            <button
              type="button"
              className="rounded-sm p-2 text-foreground-muted transition hover:bg-surface-muted hover:text-foreground"
              onClick={onClose}
              title={t("epub:vocabulary.closeTitle")}
              aria-label={t("epub:vocabulary.closeAriaLabel")}
            >
              <X size={18} />
            </button>
          </div>

          <div className="mt-4 flex items-center gap-2">
            {(Object.keys(FILTER_LABEL_KEYS) as VocabularyFilter[]).map((filterOption) => (
              <button
                key={filterOption}
                type="button"
                className={`rounded-sm px-3 py-1.5 text-sm transition ${
                  filter === filterOption
                    ? "bg-surface-muted text-foreground"
                    : "bg-surface-muted text-foreground hover:bg-border-strong"
                }`}
                onClick={() => onFilterChange(filterOption)}
              >
                {t(FILTER_LABEL_KEYS[filterOption])}
              </button>
            ))}

            <button
              type="button"
              className="ml-auto inline-flex items-center gap-2 rounded-sm border border-border px-3 py-1.5 text-sm text-foreground transition hover:bg-surface-muted"
              onClick={onExportCsv}
            >
              <Download size={16} />
              CSV
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          {filteredEntries.length === 0 ? (
            <div className="px-4 py-6 text-sm text-foreground-muted">
              {t("epub:vocabulary.empty")}
            </div>
          ) : (
            filteredEntries.map((entry) => (
              <div
                key={entry.normalizedWord}
                className="border-b border-border px-4 py-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {entry.displayWord}
                    </p>
                    <p className="mt-1 text-xs uppercase tracking-[0.14em] text-foreground-subtle">
                      {entry.normalizedWord}
                    </p>
                  </div>

                  <button
                    type="button"
                    className={`rounded-sm p-2 transition ${
                      entry.saved
                        ? "bg-warning-muted text-warning hover:bg-warning-muted"
                        : "text-foreground-subtle hover:bg-surface-muted hover:text-foreground"
                    }`}
                    onClick={() => onToggleSaved(entry.normalizedWord)}
                    title={
                      entry.saved
                        ? t("epub:vocabulary.removeSaved")
                        : t("epub:vocabulary.saveForReview")
                    }
                  >
                    <Bookmark size={16} fill={entry.saved ? "currentColor" : "none"} />
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {STATUS_OPTIONS.map((status) => (
                    <button
                      key={status}
                      type="button"
                      className={`rounded-sm px-3 py-1.5 text-sm transition ${
                        entry.status === status
                          ? getVocabularyStatusClasses(status)
                          : "border border-border bg-surface text-foreground-muted hover:bg-surface-muted hover:text-foreground"
                      }`}
                      onClick={() => onStatusChange(entry.normalizedWord, status)}
                    >
                      {t(getVocabularyStatusLabelKey(status))}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}
