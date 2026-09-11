import { useEffect, useMemo, useState } from "react";
import { ExternalLink, LocateFixed, Search, X } from "lucide-react";
import type { ConceptRelation, KeyConcept } from "../../../../../types/AnnotationTypes";
import type { ChapterRange } from "./chapterRanges";
import { filterConceptsByChapter } from "./chapterRanges";
import SigmaConceptGraph from "./SigmaConceptGraph";

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
  onClose,
  onGoToPage,
}: GraphDialogProps) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  const selectedChapter = chapterRanges.find((chapter) => chapter.id === selectedChapterId) ?? null;
  const filteredByChapter = filterConceptsByChapter(concepts, selectedChapter);
  const filteredConcepts = query.trim()
    ? filteredByChapter.filter((concept) =>
        `${concept.title} ${concept.note || ""} ${concept.excerpt || ""}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
      )
    : filteredByChapter;
  const filteredIds = new Set(filteredConcepts.map((concept) => concept.id));
  const filteredRelations = relations.filter(
    (relation) => filteredIds.has(relation.conceptAId) && filteredIds.has(relation.conceptBId),
  );
  const selectedConcept = selectedConceptId
    ? concepts.find((concept) => concept.id === selectedConceptId) ?? null
    : null;
  const stats = useMemo(() => ({
    concepts: filteredConcepts.length,
    relations: filteredRelations.length,
  }), [filteredConcepts.length, filteredRelations.length]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[88] flex items-center justify-center bg-black/45 px-3 py-5"
      onMouseDown={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="key-concepts-graph-title"
    >
      <div
        className="flex h-[min(860px,calc(100vh-40px))] w-full max-w-7xl overflow-hidden rounded border border-zinc-700/90 bg-zinc-950 shadow-2xl shadow-black/60"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="flex min-h-14 items-center justify-between border-b border-zinc-800 bg-zinc-900 px-4 sm:px-6">
            <div className="min-w-0">
              <h2 id="key-concepts-graph-title" className="truncate text-base font-semibold text-zinc-100">
                Key Concepts Graph
              </h2>
              <p className="hidden text-xs text-zinc-500 sm:block">
                Sigma.js + Graphology com layout ForceAtlas2.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
              title="Fechar"
              aria-label="Fechar graph"
            >
              <X size={17} />
            </button>
          </header>

          <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_310px]">
            <main className="flex min-h-0 min-w-0 flex-col">
              <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800 px-4 py-3">
                <label className="relative min-w-[220px] flex-1">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" size={14} />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Filtrar concepts"
                    className="h-9 w-full rounded-sm border border-zinc-800 bg-zinc-950 pl-8 pr-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-emerald-500"
                    aria-label="Filtrar concepts do graph"
                  />
                </label>
                <select
                  value={selectedChapterId}
                  onChange={(event) => onSelectedChapterChange(event.target.value)}
                  className="h-9 min-w-[220px] rounded-sm border border-zinc-800 bg-zinc-950 px-2 text-sm text-zinc-200 outline-none focus:border-emerald-500"
                  aria-label="Filtrar graph por capitulo"
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
                  onClick={() => currentChapter && onSelectedChapterChange(currentChapter.id)}
                  disabled={!currentChapter}
                  className="flex h-9 w-9 items-center justify-center rounded-sm border border-zinc-800 bg-zinc-900 text-zinc-300 transition hover:border-zinc-700 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
                  title="Usar capitulo atual"
                  aria-label="Usar capitulo atual"
                >
                  <LocateFixed size={15} />
                </button>
                <div className="ml-auto text-xs text-zinc-500">
                  {stats.concepts} concepts / {stats.relations} links
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

            <aside className="min-h-0 border-l border-zinc-800 bg-zinc-950 p-4">
              {selectedConcept ? (
                <div className="space-y-3">
                  <div>
                    <div className="text-sm font-semibold text-zinc-100">{selectedConcept.title}</div>
                    <button
                      type="button"
                      onClick={() => onGoToPage(selectedConcept.page)}
                      className="mt-1 inline-flex items-center gap-1 text-xs text-emerald-300 hover:text-emerald-200"
                    >
                      <ExternalLink size={13} />
                      p. {selectedConcept.page}
                    </button>
                  </div>
                  {selectedConcept.excerpt && (
                    <blockquote className="border-l border-emerald-700 pl-3 text-xs leading-relaxed text-zinc-400">
                      {selectedConcept.excerpt}
                    </blockquote>
                  )}
                  {selectedConcept.note && (
                    <p className="text-xs leading-relaxed text-zinc-400">{selectedConcept.note}</p>
                  )}
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-center text-xs text-zinc-500">
                  Selecione um node para abrir o conceito.
                </div>
              )}
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
