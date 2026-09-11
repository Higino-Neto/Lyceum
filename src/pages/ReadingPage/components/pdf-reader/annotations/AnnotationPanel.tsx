import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, X } from "lucide-react";
import type {
  PdfSelectionPayload,
  PdfSelectionRect,
} from "../../../../../types/AnnotationTypes";
import type { ChapterNode } from "../chapters/useChapterTracker";
import {
  buildChapterRanges,
  findChapterForPage,
} from "./chapterRanges";
import {
  buildRelationCounts,
  clampConceptPage,
  type FilterScope,
  filterAndSortConcepts,
  findDuplicateTitle,
  getRelatedConcepts,
  parseHighlightRects,
  type SortMode,
} from "./annotationPanelUtils";
import ConceptComposer from "./ConceptComposer";
import ConceptEditor from "./ConceptEditor";
import ConceptList from "./ConceptList";
import CurrentPageConcepts from "./CurrentPageConcepts";
import GraphDialog from "./GraphDialog";
import KnowledgeMapPreview from "./KnowledgeMapPreview";
import PageContextCard from "./PageContextCard";
import RelatedPagesStrip from "./RelatedPagesStrip";
import { useKeyConcepts } from "./useKeyConcepts";

interface AnnotationPanelProps {
  bookId: string;
  currentPage: number;
  totalPages: number;
  chapters: ChapterNode[] | null;
  initialSelection: PdfSelectionPayload | null;
  onSelectionConsumed: () => void;
  onHighlightsChange: (highlights: Array<{ id: string; title: string; rects: PdfSelectionRect[] }>) => void;
  onClose: () => void;
  onGoToPage: (page: number) => void;
}

export default function AnnotationPanel({
  bookId,
  currentPage,
  totalPages,
  chapters,
  initialSelection,
  onSelectionConsumed,
  onHighlightsChange,
  onClose,
  onGoToPage,
}: AnnotationPanelProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftNote, setDraftNote] = useState("");
  const [creationSelection, setCreationSelection] = useState<PdfSelectionPayload | null>(initialSelection);
  const [composerOpen, setComposerOpen] = useState(Boolean(initialSelection?.text?.trim()));
  const [currentPageSectionCollapsed, setCurrentPageSectionCollapsed] = useState(false);
  const [pendingLinkedIds, setPendingLinkedIds] = useState<Set<string>>(new Set());
  const [selectedConceptId, setSelectedConceptId] = useState<string | null>(null);
  const [selectedChapterId, setSelectedChapterId] = useState("all");
  const [filterScope, setFilterScope] = useState<FilterScope>("all");
  const [sortMode, setSortMode] = useState<SortMode>("recent");
  const [query, setQuery] = useState("");
  const [graphOpen, setGraphOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const concepts = useKeyConcepts(bookId, currentPage);

  useEffect(() => {
    if (!initialSelection?.text?.trim()) return;
    setCreationSelection(initialSelection);
    setDraftTitle("");
    setDraftNote("");
    setPendingLinkedIds(new Set());
    setSelectedConceptId(null);
    setComposerOpen(true);
    setFilterScope("page");
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [initialSelection]);

  useEffect(() => {
    if (selectedConceptId && !concepts.conceptsById.has(selectedConceptId)) {
      setSelectedConceptId(null);
    }
  }, [concepts.conceptsById, selectedConceptId]);

  const relationCounts = useMemo(
    () => buildRelationCounts(concepts.graph.concepts, concepts.graph.relations),
    [concepts.graph.concepts, concepts.graph.relations],
  );

  const highlights = useMemo(
    () => concepts.graph.concepts
      .map((concept) => ({ id: concept.id, title: concept.title, rects: parseHighlightRects(concept) }))
      .filter((item) => item.rects.length > 0),
    [concepts.graph.concepts],
  );

  useEffect(() => onHighlightsChange(highlights), [highlights, onHighlightsChange]);

  const chapterRanges = useMemo(
    () => buildChapterRanges(chapters, concepts.graph.concepts, totalPages),
    [chapters, concepts.graph.concepts, totalPages],
  );

  const currentChapter = useMemo(
    () => findChapterForPage(chapterRanges, currentPage),
    [chapterRanges, currentPage],
  );

  const selectedChapter = useMemo(
    () => chapterRanges.find((chapter) => chapter.id === selectedChapterId) ?? null,
    [chapterRanges, selectedChapterId],
  );

  const selectedConcept = selectedConceptId
    ? concepts.conceptsById.get(selectedConceptId) ?? null
    : null;

  const relatedConcepts = useMemo(
    () => getRelatedConcepts(selectedConcept, concepts.conceptsById, concepts.graph.relations),
    [concepts.conceptsById, concepts.graph.relations, selectedConcept],
  );

  const draftPage = clampConceptPage(creationSelection?.page || currentPage, totalPages) ?? 1;
  const draftDuplicate = findDuplicateTitle(concepts.graph.concepts, draftTitle);
  const draftValid = Boolean(draftTitle.trim()) && draftPage >= 1 && !draftDuplicate;
  const currentPageConceptCount = concepts.currentPageConcepts.length;

  const visibleConcepts = useMemo(
    () => filterAndSortConcepts({
      concepts: concepts.graph.concepts,
      currentPage,
      filterScope,
      query,
      relationCounts,
      selectedChapter,
      sortMode,
    }),
    [concepts.graph.concepts, currentPage, filterScope, query, relationCounts, selectedChapter, sortMode],
  );

  async function runAction(action: () => Promise<void>) {
    setActionError(null);
    try {
      await action();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    }
  }

  const togglePendingLink = (id: string) => {
    setPendingLinkedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submitDraft = () => {
    void runAction(async () => {
      if (!draftValid) return;
      const selection = creationSelection;
      const beforeIds = new Set(concepts.graph.concepts.map((concept) => concept.id));
      const graph = await concepts.createConcept({
        title: draftTitle,
        note: draftNote.trim() || null,
        page: draftPage,
        excerpt: selection?.text || null,
        locatorJson: selection
          ? JSON.stringify({ source: "pdf-selection", page: selection.page, text: selection.text })
          : null,
        highlightJson: selection ? JSON.stringify({ rects: selection.rects }) : null,
      });
      const created = graph.concepts.find((concept) => !beforeIds.has(concept.id));
      if (created) {
        for (const relatedId of pendingLinkedIds) {
          await concepts.createRelation(created.id, relatedId);
        }
        setSelectedConceptId(created.id);
      }
      setDraftTitle("");
      setDraftNote("");
      setCreationSelection(null);
      setComposerOpen(false);
      setPendingLinkedIds(new Set());
      onSelectionConsumed();
    });
  };

  const toggleExistingLink = (id: string) => {
    if (!selectedConcept) return;
    const selectedLinkIds = new Set(relatedConcepts.map((concept) => concept.id));
    void runAction(async () => {
      if (selectedLinkIds.has(id)) {
        await concepts.deleteRelation({ conceptAId: selectedConcept.id, conceptBId: id });
      } else {
        await concepts.createRelation(selectedConcept.id, id);
      }
    });
  };

  const deleteSelectedConcept = (id: string) => runAction(async () => {
    await concepts.deleteConcept(id);
    setSelectedConceptId(null);
  });

  const handleFilterScopeChange = (scope: FilterScope) => {
    if (scope !== "chapter") {
      setFilterScope(scope);
      return;
    }

    const fallbackChapter = currentChapter ?? chapterRanges[0] ?? null;
    if (!fallbackChapter) {
      setFilterScope("all");
      setSelectedChapterId("all");
      return;
    }

    if (selectedChapterId === "all" || !chapterRanges.some((chapter) => chapter.id === selectedChapterId)) {
      setSelectedChapterId(fallbackChapter.id);
    }
    setFilterScope("chapter");
  };

  const openBlankComposer = () => {
    setCreationSelection(null);
    setComposerOpen(true);
    onSelectionConsumed();
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const openSelectionComposer = () => {
    if (!creationSelection) return;
    setComposerOpen(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const closeComposer = () => {
    setDraftTitle("");
    setDraftNote("");
    setPendingLinkedIds(new Set());
    setCreationSelection(null);
    setComposerOpen(false);
    onSelectionConsumed();
  };

  return (
    <aside className="flex h-full w-[370px] min-w-[340px] max-w-[44vw] flex-col border-l border-zinc-800 bg-zinc-950 text-zinc-100 shadow-2xl">
      <header className="shrink-0 border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold leading-tight">Key Concepts</h2>
            <div className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-zinc-400">
              <BookOpen size={12} />
              <span className="truncate">{currentChapter?.title ?? "Livro inteiro"}</span>
            </div>
            <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-zinc-500">
              <span>{concepts.graph.concepts.length} conceitos</span>
              <span>·</span>
              <span>{concepts.graph.relations.length} links</span>
              <span>·</span>
              <span>{concepts.annotatedPages.length} paginas</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-sm text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
            title="Fechar"
            aria-label="Fechar annotations"
          >
            <X size={16} />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <ConceptComposer
          inputRef={inputRef}
          open={composerOpen}
          title={draftTitle}
          note={draftNote}
          page={draftPage}
          selection={creationSelection}
          concepts={concepts.graph.concepts}
          pendingLinkedIds={pendingLinkedIds}
          duplicateTitle={Boolean(draftDuplicate)}
          valid={draftValid}
          hasPendingSelection={Boolean(creationSelection?.text?.trim())}
          onOpenBlank={openBlankComposer}
          onOpenFromSelection={openSelectionComposer}
          onCloseDraft={closeComposer}
          onTitleChange={setDraftTitle}
          onNoteChange={setDraftNote}
          onSubmit={submitDraft}
          onRemoveSelection={() => {
            setCreationSelection(null);
            onSelectionConsumed();
          }}
          onTogglePendingLink={togglePendingLink}
        />

        <div className="space-y-4 px-3 py-3">
          <PageContextCard
            page={currentPage}
            conceptCount={currentPageConceptCount}
            chapter={currentChapter}
            onOpenPageConcepts={() => {
              setFilterScope("page");
              setCurrentPageSectionCollapsed(false);
            }}
          />

          <CurrentPageConcepts
            concepts={concepts.currentPageConcepts}
            collapsed={currentPageSectionCollapsed}
            onToggleCollapsed={() => setCurrentPageSectionCollapsed((value) => !value)}
            onSelectConcept={setSelectedConceptId}
          />

          {(actionError || concepts.error) && (
            <div className="flex items-start justify-between gap-2 rounded-sm border border-red-950 bg-red-950/30 px-2 py-1.5 text-xs text-red-200">
              <span>{actionError || concepts.error}</span>
              <button type="button" onClick={() => setActionError(null)} aria-label="Fechar erro">
                <X size={13} />
              </button>
            </div>
          )}

          <ConceptList
            concepts={visibleConcepts}
            loading={concepts.loading}
            selectedConceptId={selectedConceptId}
            relationCounts={relationCounts}
            query={query}
            sortMode={sortMode}
            filterScope={filterScope}
            chapterRanges={chapterRanges}
            currentChapter={currentChapter}
            selectedChapterId={selectedChapterId}
            onQueryChange={setQuery}
            onSortModeChange={setSortMode}
            onFilterScopeChange={handleFilterScopeChange}
            onSelectedChapterChange={setSelectedChapterId}
            onSelectConcept={setSelectedConceptId}
            onGoToPage={onGoToPage}
          />

          {selectedConcept && (
            <ConceptEditor
              selected={selectedConcept}
              concepts={concepts.graph.concepts}
              related={relatedConcepts}
              relations={concepts.graph.relations}
              totalPages={totalPages}
              onUpdate={(id, updates) => runAction(async () => {
                await concepts.updateConcept(id, updates);
              })}
              onDelete={deleteSelectedConcept}
              onDeleteRelation={(relation) => runAction(async () => {
                await concepts.deleteRelation(relation);
              })}
              onToggleRelation={toggleExistingLink}
              onGoToPage={onGoToPage}
            />
          )}

          <KnowledgeMapPreview
            concepts={concepts.graph.concepts}
            relations={concepts.graph.relations}
            onOpenGraph={() => setGraphOpen(true)}
          />

          <RelatedPagesStrip
            pages={concepts.annotatedPages}
            currentPage={currentPage}
            onGoToPage={onGoToPage}
          />
        </div>
      </div>

      <GraphDialog
        open={graphOpen}
        concepts={concepts.graph.concepts}
        relations={concepts.graph.relations}
        chapterRanges={chapterRanges}
        currentChapter={currentChapter}
        selectedConceptId={selectedConceptId}
        selectedChapterId={selectedChapterId}
        onSelectedChapterChange={setSelectedChapterId}
        onSelectConcept={setSelectedConceptId}
        onClose={() => setGraphOpen(false)}
        onGoToPage={onGoToPage}
      />
    </aside>
  );
}
