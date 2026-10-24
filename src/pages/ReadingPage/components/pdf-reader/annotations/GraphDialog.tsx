import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, LocateFixed, Pencil, Search, X } from "lucide-react";
import type { ConceptRelation, KeyConcept } from "../../../../../types/AnnotationTypes";
import type { ChapterRange } from "./chapterRanges";
import { filterConceptsByChapter } from "./chapterRanges";
import SigmaConceptGraph from "./SigmaConceptGraph";
import { formatNumber, useTranslation } from "../../../../../i18n";
import Select from "../../../../../components/ui/Select";

interface GraphDialogProps {
  open: boolean;
  concepts: KeyConcept[];
  relations: ConceptRelation[];
  chapterRanges: ChapterRange[];
  currentChapter: ChapterRange | null;
  selectedConceptId: string | null;
  selectedChapterId: string;
  onSelectedChapterChange: (value: string) => void;
  onSelectConcept: (id: string | null) => void;
  onOpenConcept: (id: string) => void;
  onClose: () => void;
  onGoToPage: (page: number) => void;
}

export default function GraphDialog({
  open,
  concepts,
  relations,
  chapterRanges,
  currentChapter,
  selectedConceptId,
  selectedChapterId,
  onSelectedChapterChange,
  onSelectConcept,
  onOpenConcept,
  onClose,
  onGoToPage,
}: GraphDialogProps) {
  const { t, i18n } = useTranslation();
  const [query, setQuery] = useState("");
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab") {
        const elements = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled), input, select, [tabindex]:not([tabindex='-1'])") ?? []);
        if (!elements.length) return;
        const first = elements[0];
        const last = elements[elements.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first.focus();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => { window.removeEventListener("keydown", handleKeyDown); previousFocus?.focus(); };
  }, [onClose, open]);

  const selectedChapter = useMemo(() => chapterRanges.find((chapter) => chapter.id === selectedChapterId) ?? null, [chapterRanges, selectedChapterId]);
  const filteredConcepts = useMemo(() => {
    const chapterConcepts = filterConceptsByChapter(concepts, selectedChapter);
    const needle = query.trim().toLowerCase();
    return needle
      ? chapterConcepts.filter((concept) => `${concept.title} ${concept.note || ""} ${concept.excerpt || ""}`.toLowerCase().includes(needle))
      : chapterConcepts;
  }, [concepts, query, selectedChapter]);
  const filteredRelations = useMemo(() => {
    const filteredIds = new Set(filteredConcepts.map((concept) => concept.id));
    return relations.filter((relation) => filteredIds.has(relation.conceptAId) && filteredIds.has(relation.conceptBId));
  }, [filteredConcepts, relations]);
  const selectedConcept = selectedConceptId
    ? filteredConcepts.find((concept) => concept.id === selectedConceptId) ?? null
    : null;
  const stats = useMemo(() => ({
    concepts: filteredConcepts.length,
    relations: filteredRelations.length,
  }), [filteredConcepts.length, filteredRelations.length]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[88] flex items-center justify-center bg-backdrop px-3 py-5"
      onMouseDown={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="key-concepts-graph-title"
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="flex h-[min(860px,calc(100vh-40px))] w-full max-w-7xl overflow-hidden rounded-xl border border-border-strong/90 bg-background shadow-2xl shadow-shadow outline-none"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="flex min-h-14 items-center justify-between border-b border-border bg-surface px-4 sm:px-6">
            <div className="min-w-0">
              <h2 id="key-concepts-graph-title" className="truncate text-base font-semibold text-foreground">
                {t("pdf:annotations.graph.title")}
              </h2>
              <p className="hidden text-xs text-foreground-subtle sm:block">
                {t("pdf:annotations.graph.description")}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded text-foreground-muted transition hover:bg-surface-muted hover:text-foreground"
              title={t("pdf:annotations.graph.closeTitle")}
              aria-label={t("pdf:annotations.graph.closeAriaLabel")}
            >
              <X size={17} />
            </button>
          </header>

          <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,1fr)_300px] lg:grid-rows-1">
            <main className="flex min-h-0 min-w-0 flex-col">
              <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
                <label className="relative min-w-[220px] flex-1">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-foreground-subtle" size={14} />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={t("pdf:annotations.graph.searchPlaceholder")}
                    className="h-9 w-full rounded-sm border border-border bg-background pl-8 pr-3 text-sm text-foreground outline-none placeholder:text-input-placeholder focus:border-primary"
                    aria-label={t("pdf:annotations.graph.searchAriaLabel")}
                  />
                </label>
                <Select value={selectedChapterId} onChange={onSelectedChapterChange} ariaLabel={t("pdf:annotations.graph.chapterFilterAriaLabel")} className="h-9 min-w-[220px] text-sm" items={[{ value: "all", label: t("pdf:annotations.graph.allChapters") }, ...chapterRanges.map((chapter) => ({ value: chapter.id, label: `${chapter.title} - ${chapter.conceptCount}` }))]} />
                <button
                  type="button"
                  onClick={() => currentChapter && onSelectedChapterChange(currentChapter.id)}
                  disabled={!currentChapter}
                  className="flex h-9 w-9 items-center justify-center rounded-sm border border-border bg-surface text-foreground transition hover:border-border-strong hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                  title={t("pdf:annotations.graph.useCurrentChapterTitle")}
                  aria-label={t("pdf:annotations.graph.useCurrentChapterAriaLabel")}
                >
                  <LocateFixed size={15} />
                </button>
                <div className="ml-auto text-xs text-foreground-subtle">
                  {t("pdf:annotations.graph.stats", {
                    count: stats.concepts,
                    relations: formatNumber(stats.relations, i18n.language),
                  })}
                </div>
              </div>
              <div className="min-h-0 flex-1">
                <SigmaConceptGraph
                  concepts={filteredConcepts}
                  relations={filteredRelations}
                  selectedConceptId={selectedConceptId}
                  onSelectConcept={onSelectConcept}
                />
              </div>
            </main>

            <aside className="max-h-44 overflow-y-auto border-t border-border bg-background p-4 lg:max-h-none lg:border-l lg:border-t-0">
              {selectedConcept ? (
                <div className="space-y-3">
                  <div>
                    <div className="text-sm font-semibold text-foreground">{selectedConcept.title}</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" onClick={() => onOpenConcept(selectedConcept.id)} className="inline-flex items-center gap-1.5 rounded-md bg-surface-muted px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-surface"><Pencil size={13} /> {t("pdf:annotations.graph.openNote")}</button>
                      <button type="button" onClick={() => { onClose(); onGoToPage(selectedConcept.page); }} className="inline-flex items-center gap-1.5 rounded-md border border-border-strong px-2.5 py-1.5 text-xs text-foreground hover:bg-surface-muted"><ExternalLink size={13} />
                        {t("pdf:annotations.graph.pageLabel", { page: selectedConcept.page })}
                      </button>
                    </div>
                  </div>
                  {selectedConcept.excerpt && (
                    <blockquote className="border-l border-primary pl-3 text-xs leading-relaxed text-foreground-muted">
                      {selectedConcept.excerpt}
                    </blockquote>
                  )}
                  {selectedConcept.note && (
                    <p className="text-xs leading-relaxed text-foreground-muted">{selectedConcept.note}</p>
                  )}
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-center text-xs text-foreground-subtle">
                  {t("pdf:annotations.graph.emptyDetails")}
                </div>
              )}
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
