import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import type { KeyConcept } from "../../../../../types/AnnotationTypes";
import type { ChapterRange } from "./chapterRanges";
import AnnotationEmptyState from "./AnnotationEmptyState";
import {
  CONCEPT_LIST_PAGE_SIZE,
  type FilterScope,
  formatRelativeUpdatedAt,
  paginate,
  type SortMode,
} from "./annotationPanelUtils";
import { useTranslation, type TranslationKey } from "../../../../../i18n";
import Select from "../../../../../components/ui/Select";

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

const filterButtons: Array<{ value: FilterScope; labelKey: TranslationKey }> = [
  { value: "all", labelKey: "pdf:annotations.list.filters.all" },
  { value: "page", labelKey: "pdf:annotations.list.filters.page" },
  { value: "highlighted", labelKey: "pdf:annotations.list.filters.highlighted" },
  { value: "unlinked", labelKey: "pdf:annotations.list.filters.unlinked" },
];

const sortTabs: Array<{ value: SortMode; labelKey: TranslationKey }> = [
  { value: "recent", labelKey: "pdf:annotations.list.sorts.recent" },
  { value: "title", labelKey: "pdf:annotations.list.sorts.title" },
  { value: "links", labelKey: "pdf:annotations.list.sorts.links" },
  { value: "page", labelKey: "pdf:annotations.list.sorts.page" },
];

function ConceptRow({
  concept,
  selected,
  relationCount,
  onSelect,
  onGoToPage,
}: {
  concept: KeyConcept;
  selected: boolean;
  relationCount: number;
  onSelect: () => void;
  onGoToPage: () => void;
}) {
  const { t } = useTranslation();

  return (
    <article
      className={[
        "grid grid-cols-[1fr_auto] items-center gap-2 rounded-sm border px-2 py-2 transition",
        selected
          ? "border-border-strong bg-surface-muted"
          : "border-border bg-surface/70 hover:border-border-strong",
      ].join(" ")}
    >
      <button
        type="button"
        onClick={onSelect}
        className="grid min-w-0 grid-cols-[14px_1fr] items-center gap-2 text-left"
      >
        <span className={`h-2.5 w-2.5 rounded-full ${concept.highlightJson ? "bg-foreground-muted" : "bg-border-strong"}`} aria-hidden="true" />
        <span className="min-w-0">
          <span className="block truncate text-xs font-semibold text-foreground">{concept.title}</span>
          <span className="mt-0.5 block truncate text-[11px] text-foreground-subtle">
            {t("pdf:annotations.list.pageLabel", { page: concept.page })} ·{" "}
            {formatRelativeUpdatedAt(concept.updatedAt)}
          </span>
        </span>
      </button>
      <div className="flex items-center gap-1 text-foreground-subtle">
        {relationCount > 0 && (
          <span
            className="text-[11px]"
            title={t("pdf:annotations.list.relationCountTitle", { count: relationCount })}
          >
            {t("pdf:annotations.list.relationCount", { count: relationCount })}
          </span>
        )}
        <button
          type="button"
          onClick={onGoToPage}
          className="inline-flex h-7 min-w-7 items-center justify-center gap-1 rounded-sm text-[11px] hover:bg-surface-muted hover:text-foreground"
          title={t("pdf:annotations.list.goToPageTitle")}
          aria-label={t("pdf:annotations.list.goToPageAriaLabel", { page: concept.page })}
        >
          <ExternalLink size={13} />
          {t("pdf:annotations.list.pageLabel", { page: concept.page })}
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
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => setPage(1), [concepts.length, filterScope, query, selectedChapterId, sortMode]);

  const paginated = useMemo(
    () => paginate(concepts, page, CONCEPT_LIST_PAGE_SIZE),
    [concepts, page],
  );

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between text-xs font-semibold text-foreground">
        <span>{t("pdf:annotations.list.allConcepts")}</span>
        <span className="text-[11px] font-normal text-foreground-subtle">{concepts.length}</span>
      </div>

      <div className="flex gap-2">
        <label className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-foreground-subtle" size={14} />
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={t("pdf:annotations.list.searchPlaceholder")}
            className="h-9 w-full rounded-sm border border-border bg-background pl-8 pr-3 text-xs text-foreground outline-none placeholder:text-input-placeholder focus:border-primary"
            aria-label={t("pdf:annotations.list.searchAriaLabel")}
          />
        </label>
        <button
          type="button"
          onClick={() => setFiltersOpen((value) => !value)}
          className={[
            "flex h-9 w-9 items-center justify-center rounded-sm border text-foreground",
            filtersOpen || filterScope !== "all"
              ? "border-border-strong bg-surface-muted"
              : "border-border bg-surface hover:border-border-strong",
          ].join(" ")}
          title={t("pdf:annotations.list.filtersTitle")}
          aria-label={t("pdf:annotations.list.filtersAriaLabel")}
        >
          <SlidersHorizontal size={14} />
        </button>
      </div>

      {filtersOpen && (
        <div className="space-y-2 rounded-sm border border-border bg-background/70 p-2">
          <div className="flex flex-wrap gap-1.5">
            {filterButtons.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => onFilterScopeChange(filter.value)}
                className={[
                  "h-7 rounded-sm border px-2 text-[11px]",
                  filterScope === filter.value
                    ? "border-border-strong bg-surface-muted text-foreground"
                    : "border-border bg-surface text-foreground-muted hover:border-border-strong",
                ].join(" ")}
              >
                {t(filter.labelKey)}
              </button>
            ))}
          </div>
          {chapterRanges.length > 0 && (
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <Select
                value={selectedChapterId}
                onChange={(value) => {
                  onSelectedChapterChange(value);
                  onFilterScopeChange(value === "all" ? "all" : "chapter");
                }}
                className="h-8 min-w-0 text-[11px]"
                ariaLabel={t("pdf:annotations.list.chapterFilterAriaLabel")}
                items={[{ value: "all", label: t("pdf:annotations.list.allChapters") }, ...chapterRanges.map((chapter) => ({ value: chapter.id, label: `${chapter.title} - ${chapter.conceptCount}` }))]}
              />
              <button
                type="button"
                onClick={() => {
                  if (currentChapter) {
                    onSelectedChapterChange(currentChapter.id);
                    onFilterScopeChange("chapter");
                  }
                }}
                disabled={!currentChapter}
                className="h-8 rounded-sm border border-border bg-surface px-2 text-[11px] text-foreground hover:border-border-strong disabled:opacity-40"
              >
                {t("pdf:annotations.list.currentChapter")}
              </button>
            </div>
          )}
        </div>
      )}

      <label className="flex items-center gap-2 text-xs text-foreground-subtle">
        {t("pdf:annotations.list.sortBy")}
        <Select value={sortMode} onChange={(value) => onSortModeChange(value as SortMode)} className="ml-auto h-8 text-xs" items={sortTabs.map((tab) => ({ value: tab.value, label: t(tab.labelKey) }))} />
      </label>

      {loading ? (
        <div className="py-8 text-center text-xs text-foreground-subtle">
          {t("pdf:annotations.list.loading")}
        </div>
      ) : concepts.length === 0 ? (
        <AnnotationEmptyState>{t("pdf:annotations.list.empty")}</AnnotationEmptyState>
      ) : (
        <div className="space-y-1.5">
          {paginated.items.map((concept) => (
            <ConceptRow
              key={concept.id}
              concept={concept}
              selected={concept.id === selectedConceptId}
              relationCount={relationCounts.get(concept.id) ?? 0}
              onSelect={() => onSelectConcept(concept.id)}
              onGoToPage={() => onGoToPage(concept.page)}
            />
          ))}
        </div>
      )}

      {concepts.length > CONCEPT_LIST_PAGE_SIZE && (
        <div className="flex items-center justify-between rounded-sm border border-border bg-surface/60 px-2 py-1.5 text-[11px] text-foreground-subtle">
          <button
            type="button"
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            disabled={paginated.page <= 1}
            className="inline-flex h-7 w-7 items-center justify-center rounded-sm disabled:opacity-40"
            aria-label={t("pdf:annotations.linkPicker.previousPage")}
          >
            <ChevronLeft size={13} />
          </button>
          <span>{paginated.page} / {paginated.pageCount}</span>
          <button
            type="button"
            onClick={() => setPage((value) => Math.min(paginated.pageCount, value + 1))}
            disabled={paginated.page >= paginated.pageCount}
            className="inline-flex h-7 w-7 items-center justify-center rounded-sm disabled:opacity-40"
            aria-label={t("pdf:annotations.linkPicker.nextPage")}
          >
            <ChevronRight size={13} />
          </button>
        </div>
      )}
    </section>
  );
}
