import { Download, Bookmark, X } from "lucide-react";
import {
  VocabularyEntry,
  VocabularyStats,
  VocabularyStatus,
  getVocabularyStatusClasses,
  getVocabularyStatusLabel,
} from "./languageLearning";

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

const FILTER_LABELS: Record<VocabularyFilter, string> = {
  all: "Todas",
  learning: "Aprendendo",
  known: "Conhecidas",
};

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
  if (!isOpen) return null;

  const filteredEntries = entries.filter((entry) => {
    if (filter === "all") return true;
    return entry.status === filter;
  });

  return (
    <div className="absolute inset-0 z-40 flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/45"
        onClick={onClose}
      />

      <aside className="relative z-10 flex h-full w-full max-w-[360px] flex-col border-l border-zinc-800 bg-zinc-900 shadow-2xl">
        <header className="border-b border-zinc-800 px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                Vocabulário
              </p>
              <h2 className="mt-1 text-base font-semibold text-zinc-100">
                {fileName || "Livro atual"}
              </h2>
              <p className="mt-2 text-sm text-zinc-400">
                {stats.trackedCount} palavras rastreadas
              </p>
              <p className="text-sm text-zinc-500">
                {stats.knownCount} conhecidas • {stats.learningCount} aprendendo • {stats.progressPercent}% concluído
              </p>
            </div>

            <button
              type="button"
              className="rounded-sm p-2 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200"
              onClick={onClose}
            >
              <X size={18} />
            </button>
          </div>

          <div className="mt-4 flex items-center gap-2">
            {(Object.keys(FILTER_LABELS) as VocabularyFilter[]).map((filterOption) => (
              <button
                key={filterOption}
                type="button"
                className={`rounded-sm px-3 py-1.5 text-sm transition ${
                  filter === filterOption
                    ? "bg-zinc-100 text-zinc-900"
                    : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                }`}
                onClick={() => onFilterChange(filterOption)}
              >
                {FILTER_LABELS[filterOption]}
              </button>
            ))}

            <button
              type="button"
              className="ml-auto inline-flex items-center gap-2 rounded-sm border border-zinc-800 px-3 py-1.5 text-sm text-zinc-200 transition hover:bg-zinc-800"
              onClick={onExportCsv}
            >
              <Download size={16} />
              CSV
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          {filteredEntries.length === 0 ? (
            <div className="px-4 py-6 text-sm text-zinc-400">
              Nenhuma palavra nesta visao ainda.
            </div>
          ) : (
            filteredEntries.map((entry) => (
              <div
                key={entry.normalizedWord}
                className="border-b border-zinc-800 px-4 py-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-zinc-100">
                      {entry.displayWord}
                    </p>
                    <p className="mt-1 text-xs uppercase tracking-[0.14em] text-zinc-500">
                      {entry.normalizedWord}
                    </p>
                  </div>

                  <button
                    type="button"
                    className={`rounded-sm p-2 transition ${
                      entry.saved
                        ? "bg-yellow-400/10 text-yellow-200 hover:bg-yellow-400/20"
                        : "text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
                    }`}
                    onClick={() => onToggleSaved(entry.normalizedWord)}
                    title={entry.saved ? "Remover dos salvos" : "Salvar para revisao"}
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
                          : "border border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                      }`}
                      onClick={() => onStatusChange(entry.normalizedWord, status)}
                    >
                      {getVocabularyStatusLabel(status)}
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
