import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import type { KeyConcept } from "../../../../../types/AnnotationTypes";
import AnnotationEmptyState from "./AnnotationEmptyState";
import {
  conceptSearchText,
  LINK_PAGE_SIZE,
  paginate,
  sortConcepts,
} from "./annotationPanelUtils";
import { useTranslation, type TranslationKey } from "../../../../../i18n";

interface ConceptLinkPickerProps {
  concepts: KeyConcept[];
  selectedIds: Set<string>;
  excludeId?: string | null;
  title: string;
  emptyLabel?: TranslationKey;
  onToggle: (id: string) => void;
}

export default function ConceptLinkPicker({
  concepts,
  selectedIds,
  excludeId,
  title,
  emptyLabel = "pdf:annotations.linkPicker.empty",
  onToggle,
}: ConceptLinkPickerProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const candidates = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const pool = sortConcepts(concepts.filter((concept) => concept.id !== excludeId), "recent");
    if (!needle) return pool;
    return pool.filter((concept) => conceptSearchText(concept).includes(needle));
  }, [concepts, excludeId, query]);

  useEffect(() => setPage(1), [query, concepts.length]);

  const paginated = paginate(candidates, page, LINK_PAGE_SIZE);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-zinc-300">{title}</span>
        <span className="text-zinc-500">
          {t("pdf:annotations.linkPicker.selectedCount", { count: selectedIds.size })}
        </span>
      </div>
      <label className="relative block">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" size={14} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("pdf:annotations.linkPicker.searchPlaceholder")}
          className="h-9 w-full rounded-sm border border-zinc-800 bg-zinc-950 pl-8 pr-3 text-xs text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-emerald-500"
          aria-label={t("pdf:annotations.linkPicker.searchAriaLabel")}
        />
      </label>
      {paginated.items.length === 0 ? (
        <AnnotationEmptyState>{t(emptyLabel)}</AnnotationEmptyState>
      ) : (
        <div className="space-y-1.5">
          {paginated.items.map((concept) => {
            const linked = selectedIds.has(concept.id);
            return (
              <button
                key={concept.id}
                type="button"
                onClick={() => onToggle(concept.id)}
                className={[
                  "grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-sm border px-2 py-2 text-left text-xs transition",
                  linked
                    ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-100"
                    : "border-zinc-800 bg-zinc-900/80 text-zinc-200 hover:border-zinc-700 hover:bg-zinc-800",
                ].join(" ")}
              >
                <span className="min-w-0">
                  <span className="block truncate">{concept.title}</span>
                  <span className="mt-0.5 block text-[10px] text-zinc-500">p. {concept.page}</span>
                </span>
                <span className="shrink-0 text-[10px] text-emerald-300">{linked ? "linkado" : "linkar"}</span>
              </button>
            );
          })}
        </div>
      )}
      {candidates.length > LINK_PAGE_SIZE && (
        <div className="flex items-center justify-between text-[11px] text-zinc-500">
          <button
            type="button"
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            disabled={paginated.page <= 1}
            className="inline-flex h-7 w-7 items-center justify-center rounded-sm border border-zinc-800 bg-zinc-900 disabled:opacity-40"
            aria-label={t("pdf:annotations.linkPicker.previousPage")}
          >
            <ChevronLeft size={13} />
          </button>
          <span>{paginated.page} / {paginated.pageCount}</span>
          <button
            type="button"
            onClick={() => setPage((value) => Math.min(paginated.pageCount, value + 1))}
            disabled={paginated.page >= paginated.pageCount}
            className="inline-flex h-7 w-7 items-center justify-center rounded-sm border border-zinc-800 bg-zinc-900 disabled:opacity-40"
            aria-label={t("pdf:annotations.linkPicker.nextPage")}
          >
            <ChevronRight size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
