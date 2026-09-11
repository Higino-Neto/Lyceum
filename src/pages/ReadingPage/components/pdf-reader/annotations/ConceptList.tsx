import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  GitFork,
  MoreVertical,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import type { KeyConcept } from "../../../../../types/AnnotationTypes";
import type { ChapterRange } from "./chapterRanges";
import AnnotationEmptyState from "./AnnotationEmptyState";
import {
  conceptAccent,
  CONCEPT_LIST_PAGE_SIZE,
  type FilterScope,
  formatRelativeUpdatedAt,
  paginate,
  type SortMode,
} from "./annotationPanelUtils";

interface ConceptListProps {
  concepts: KeyConcept[];
  loading: boolean;
  selectedConceptId: string | null;
  relationCounts: Map<string, number>;
  query: string;
  sortMode: SortMode;
  filterScope: FilterScope;
  chapterRanges: ChapterRange[];
  currentChapter: ChapterRange | null;
  selectedChapterId: string;
  onQueryChange: (value: string) => void;
  onSortModeChange: (value: SortMode) => void;
  onFilterScopeChange: (value: FilterScope) => void;
  onSelectedChapterChange: (value: string) => void;
  onSelectConcept: (id: string) => void;
  onGoToPage: (page: number) => void;
}

const filterButtons: Array<{ value: FilterScope; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "page", label: "Pagina" },
  { value: "highlighted", label: "Highlights" },
  { value: "unlinked", label: "Sem links" },
];

const sortTabs: Array<{ value: SortMode; label: string }> = [
  { value: "recent", label: "Recentes" },
  { value: "title", label: "A-Z" },
  { value: "links", label: "Mais ligados" },
  { value: "page", label: "Por capitulo" },
];

function ConceptRow({
  concept,
  selected,
  accent,
  relationCount,
  onSelect,
  onGoToPage,
}: {
  concept: KeyConcept;
  selected: boolean;
  accent: string;
  relationCount: number;
  onSelect: () => void;
  onGoToPage: () => void;
}) {
  return (
    <article
      className={[
        "grid grid-cols-[1fr_auto] items-center gap-2 rounded-sm border px-2 py-2 transition",
        selected
          ? "border-emerald-500 bg-emerald-500/10"
          : "border-zinc-800 bg-zinc-900/70 hover:border-zinc-700",
      ].join(" ")}
    >
      <button
        type="button"
        onClick={onSelect}
        className="grid min-w-0 grid-cols-[14px_1fr] items-center gap-2 text-left"
      >
        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: accent }} aria-hidden="true" />
        <span className="min-w-0">
          <span className="block truncate text-xs font-semibold text-zinc-100">{concept.title}</span>
          <span className="mt-0.5 block truncate text-[11px] text-zinc-500">
            p. {concept.page} · {formatRelativeUpdatedAt(concept.updatedAt)}
          </span>
        </span>
      </button>
      <div className="flex items-center gap-1 text-zinc-500">
        <button
          type="button"
          onClick={onGoToPage}
          className="inline-flex h-7 min-w-7 items-center justify-center gap-1 rounded-sm text-[11px] hover:bg-zinc-800 hover:text-zinc-100"
          title="Ir para pagina"
          aria-label="Ir para pagina"
        >
          <GitFork size={13} />
          {relationCount}
        </button>
        <button
          type="button"
          onClick={onSelect}
          className="inline-flex h-7 w-7 items-center justify-center rounded-sm hover:bg-zinc-800 hover:text-zinc-100"
          title="Editar"
          aria-label="Editar concept"
        >
          <MoreVertical size={14} />
        </button>
      </div>
    </article>
  );
}

export default function ConceptList({
  concepts,
  loading,
  selectedConceptId,
  relationCounts,
  query,
  sortMode,
  filterScope,
  chapterRanges,
  currentChapter,
  selectedChapterId,
  onQueryChange,
  onSortModeChange,
  onFilterScopeChange,
  onSelectedChapterChange,
  onSelectConcept,
  onGoToPage,
}: ConceptListProps) {
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => setPage(1), [concepts.length, filterScope, query, selectedChapterId, sortMode]);

  const paginated = useMemo(
    () => paginate(concepts, page, CONCEPT_LIST_PAGE_SIZE),
    [concepts, page],
  );

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between text-xs font-semibold text-zinc-200">
        <span>Todos os conceitos</span>
        <span className="text-[11px] font-normal text-zinc-500">{concepts.length}</span>
      </div>

      <div className="flex gap-2">
        <label className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" size={14} />
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Buscar conceitos..."
            className="h-9 w-full rounded-sm border border-zinc-800 bg-zinc-950 pl-8 pr-3 text-xs text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-emerald-500"
            aria-label="Buscar conceitos"
          />
        </label>
        <button
          type="button"
          onClick={() => setFiltersOpen((value) => !value)}
          className={[
            "flex h-9 w-9 items-center justify-center rounded-sm border text-zinc-300",
            filtersOpen || filterScope !== "all"
              ? "border-emerald-700 bg-emerald-950/40"
              : "border-zinc-800 bg-zinc-900 hover:border-zinc-700",
          ].join(" ")}
          title="Filtros"
          aria-label="Filtros"
        >
          <SlidersHorizontal size={14} />
        </button>
      </div>

      {filtersOpen && (
        <div className="space-y-2 rounded-sm border border-zinc-800 bg-zinc-950/70 p-2">
          <div className="flex flex-wrap gap-1.5">
            {filterButtons.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => onFilterScopeChange(filter.value)}
                className={[
                  "h-7 rounded-sm border px-2 text-[11px]",
                  filterScope === filter.value
                    ? "border-emerald-700 bg-emerald-950/50 text-emerald-200"
                    : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700",
                ].join(" ")}
              >
                {filter.label}
              </button>
            ))}
          </div>
          {chapterRanges.length > 0 && (
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <select
                value={selectedChapterId}
                onChange={(event) => {
                  const value = event.target.value;
                  onSelectedChapterChange(value);
                  onFilterScopeChange(value === "all" ? "all" : "chapter");
                }}
                className="h-8 min-w-0 rounded-sm border border-zinc-800 bg-zinc-950 px-2 text-[11px] text-zinc-200 outline-none focus:border-emerald-500"
                aria-label="Filtrar por capitulo"
              >
                <option value="all">Todos os capitulos</option>
                {chapterRanges.map((chapter) => (
                  <option key={chapter.id} value={chapter.id}>
                    {chapter.title} - {chapter.conceptCount}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  if (currentChapter) {
                    onSelectedChapterChange(currentChapter.id);
                    onFilterScopeChange("chapter");
                  }
                }}
                disabled={!currentChapter}
                className="h-8 rounded-sm border border-zinc-800 bg-zinc-900 px-2 text-[11px] text-zinc-300 hover:border-zinc-700 disabled:opacity-40"
              >
                Atual
              </button>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-4 gap-1.5">
        {sortTabs.map((tab) => {
          const isChapterTab = tab.value === "page";
          const active = sortMode === tab.value && (!isChapterTab || filterScope === "chapter");
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => {
                onSortModeChange(tab.value);
                if (isChapterTab) onFilterScopeChange("chapter");
                else if (filterScope === "chapter") onFilterScopeChange("all");
              }}
              className={[
                "h-8 truncate rounded-sm border px-2 text-[11px] transition",
                active
                  ? "border-emerald-700 bg-emerald-950/50 text-emerald-200"
                  : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200",
              ].join(" ")}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="py-8 text-center text-xs text-zinc-500">Carregando concepts...</div>
      ) : concepts.length === 0 ? (
        <AnnotationEmptyState>Nenhum Key Concept neste filtro.</AnnotationEmptyState>
      ) : (
        <div className="space-y-1.5">
          {paginated.items.map((concept, index) => (
            <ConceptRow
              key={concept.id}
              concept={concept}
              selected={concept.id === selectedConceptId}
              accent={conceptAccent(index)}
              relationCount={relationCounts.get(concept.id) ?? 0}
              onSelect={() => onSelectConcept(concept.id)}
              onGoToPage={() => onGoToPage(concept.page)}
            />
          ))}
        </div>
      )}

      {concepts.length > CONCEPT_LIST_PAGE_SIZE && (
        <div className="flex items-center justify-between rounded-sm border border-zinc-800 bg-zinc-900/60 px-2 py-1.5 text-[11px] text-zinc-500">
          <button
            type="button"
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            disabled={paginated.page <= 1}
            className="inline-flex h-7 w-7 items-center justify-center rounded-sm disabled:opacity-40"
            aria-label="Pagina anterior"
          >
            <ChevronLeft size={13} />
          </button>
          <span>{paginated.page} / {paginated.pageCount}</span>
          <button
            type="button"
            onClick={() => setPage((value) => Math.min(paginated.pageCount, value + 1))}
            disabled={paginated.page >= paginated.pageCount}
            className="inline-flex h-7 w-7 items-center justify-center rounded-sm disabled:opacity-40"
            aria-label="Proxima pagina"
          >
            <ChevronRight size={13} />
          </button>
        </div>
      )}
    </section>
  );
}
