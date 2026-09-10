import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookMarked,
  ExternalLink,
  GitFork,
  Link2,
  Link2Off,
  LocateFixed,
  Map as MapIcon,
  Network,
  PanelRightClose,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import type {
  AnnotatedPage,
  ConceptRelation,
  KeyConcept,
} from "../../../../../types/AnnotationTypes";
import type { ChapterNode } from "../chapters/useChapterTracker";
import {
  buildChapterRanges,
  filterConceptsByChapter,
  findChapterForPage,
  type ChapterRange,
} from "./chapterRanges";
import { useKeyConcepts } from "./useKeyConcepts";

type AnnotationTab = "page" | "graph" | "atlas";

interface AnnotationPanelProps {
  bookId: string;
  currentPage: number;
  totalPages: number;
  chapters: ChapterNode[] | null;
  onClose: () => void;
  onGoToPage: (page: number) => void;
}

function relationKey(relation: Pick<ConceptRelation, "conceptAId" | "conceptBId">) {
  return [relation.conceptAId, relation.conceptBId].sort().join("::");
}

function computeDegree(concepts: KeyConcept[], relations: ConceptRelation[]) {
  const degree = new Map(concepts.map((concept) => [concept.id, 0]));
  for (const relation of relations) {
    degree.set(relation.conceptAId, (degree.get(relation.conceptAId) ?? 0) + 1);
    degree.set(relation.conceptBId, (degree.get(relation.conceptBId) ?? 0) + 1);
  }
  return degree;
}

function chapterLabel(chapter: ChapterRange) {
  const pages = chapter.pageEnd && chapter.pageEnd !== chapter.pageStart
    ? `p. ${chapter.pageStart}-${chapter.pageEnd}`
    : `p. ${chapter.pageStart}`;
  return `${chapter.title} (${pages})`;
}

function ConceptPill({
  concept,
  selected,
  onClick,
}: {
  concept: KeyConcept;
  selected?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex w-full items-center justify-between gap-2 rounded-sm border px-2 py-1.5 text-left text-xs transition",
        selected
          ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-100"
          : "border-zinc-800 bg-zinc-900/80 text-zinc-200 hover:border-zinc-700 hover:bg-zinc-800",
      ].join(" ")}
    >
      <span className="min-w-0 truncate">{concept.title}</span>
      <span className="shrink-0 text-[10px] text-zinc-500">p. {concept.page}</span>
    </button>
  );
}

function ChapterFilter({
  chapters,
  selectedChapterId,
  onChange,
  currentChapter,
}: {
  chapters: ChapterRange[];
  selectedChapterId: string;
  onChange: (value: string) => void;
  currentChapter: ChapterRange | null;
}) {
  if (chapters.length === 0) {
    return null;
  }

  return (
    <div className="flex gap-2">
      <select
        value={selectedChapterId}
        onChange={(event) => onChange(event.target.value)}
        className="min-w-0 flex-1 rounded-sm border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-emerald-500"
        aria-label="Filtrar por capitulo"
      >
        <option value="all">Todos os capitulos</option>
        {chapters.map((chapter) => (
          <option key={chapter.id} value={chapter.id}>
            {chapter.title} - {chapter.conceptCount} concepts
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => currentChapter && onChange(currentChapter.id)}
        disabled={!currentChapter}
        className="flex h-8 w-8 items-center justify-center rounded-sm border border-zinc-800 bg-zinc-900 text-zinc-300 transition hover:border-zinc-700 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
        title="Usar capitulo atual"
        aria-label="Usar capitulo atual"
      >
        <LocateFixed size={15} />
      </button>
    </div>
  );
}

function ConceptDetail({
  selected,
  related,
  relations,
  onUpdate,
  onDelete,
  onDeleteRelation,
  onGoToPage,
}: {
  selected: KeyConcept | null;
  related: KeyConcept[];
  relations: ConceptRelation[];
  onUpdate: (id: string, updates: { title: string; note: string | null }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onDeleteRelation: (relation: ConceptRelation) => Promise<void>;
  onGoToPage: (page: number) => void;
}) {
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    setTitle(selected?.title ?? "");
    setNote(selected?.note ?? "");
  }, [selected]);

  if (!selected) {
    return (
      <div className="rounded-sm border border-zinc-800 bg-zinc-950/60 p-3 text-xs text-zinc-500">
        Selecione um node ou concept para ver detalhes.
      </div>
    );
  }

  return (
    <div className="rounded-sm border border-zinc-800 bg-zinc-950/70 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="w-full rounded-sm border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-sm font-semibold text-zinc-100 outline-none focus:border-emerald-500"
            aria-label="Titulo do concept"
          />
          <button
            type="button"
            onClick={() => onGoToPage(selected.page)}
            className="mt-2 inline-flex items-center gap-1 text-xs text-emerald-300 hover:text-emerald-200"
          >
            <ExternalLink size={13} />
            p. {selected.page}
          </button>
        </div>
        <button
          type="button"
          onClick={() => onDelete(selected.id)}
          className="flex h-8 w-8 items-center justify-center rounded-sm border border-red-950 bg-red-950/30 text-red-300 transition hover:border-red-800 hover:bg-red-950"
          title="Remover concept"
          aria-label="Remover concept"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        rows={5}
        placeholder="Nota opcional"
        className="mt-3 w-full resize-none rounded-sm border border-zinc-800 bg-zinc-900 px-2 py-2 text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-emerald-500"
      />

      <button
        type="button"
        onClick={() => onUpdate(selected.id, { title, note })}
        className="mt-2 inline-flex h-8 items-center gap-2 rounded-sm border border-emerald-900 bg-emerald-950/50 px-3 text-xs font-medium text-emerald-200 transition hover:border-emerald-700 hover:bg-emerald-900/60"
      >
        <Save size={14} />
        Salvar
      </button>

      <div className="mt-4 space-y-2">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
          Relacionados
        </div>
        {related.length === 0 ? (
          <p className="text-xs text-zinc-500">Nenhuma relacao ainda.</p>
        ) : (
          related.map((concept) => {
            const relation = relations.find((item) =>
              relationKey(item) === relationKey({ conceptAId: selected.id, conceptBId: concept.id })
            );
            return (
              <div key={concept.id} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onGoToPage(concept.page)}
                  className="min-w-0 flex-1 truncate rounded-sm border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-left text-xs text-zinc-200 hover:border-zinc-700"
                >
                  {concept.title}
                </button>
                {relation && (
                  <button
                    type="button"
                    onClick={() => onDeleteRelation(relation)}
                    className="flex h-7 w-7 items-center justify-center rounded-sm border border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-red-900 hover:text-red-300"
                    title="Remover relacao"
                    aria-label="Remover relacao"
                  >
                    <Link2Off size={13} />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function GraphView({
  concepts,
  relations,
  selectedConceptId,
  onSelectConcept,
}: {
  concepts: KeyConcept[];
  relations: ConceptRelation[];
  selectedConceptId: string | null;
  onSelectConcept: (id: string) => void;
}) {
  const degree = useMemo(() => computeDegree(concepts, relations), [concepts, relations]);
  const positions = useMemo(() => {
    const centerX = 190;
    const centerY = 155;
    const radius = Math.max(72, Math.min(128, 30 + concepts.length * 9));
    return new Map(concepts.map((concept, index) => {
      const angle = concepts.length === 1 ? -Math.PI / 2 : (Math.PI * 2 * index) / concepts.length - Math.PI / 2;
      return [
        concept.id,
        {
          x: centerX + Math.cos(angle) * radius,
          y: centerY + Math.sin(angle) * radius,
        },
      ];
    }));
  }, [concepts]);

  if (concepts.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-sm border border-zinc-800 bg-zinc-950/60 px-6 text-center text-xs text-zinc-500">
        Crie concepts para formar o graph deste livro.
      </div>
    );
  }

  const visibleRelationKeys = new Set(concepts.map((concept) => concept.id));
  const visibleRelations = relations.filter(
    (relation) => visibleRelationKeys.has(relation.conceptAId) && visibleRelationKeys.has(relation.conceptBId),
  );

  return (
    <div className="overflow-hidden rounded-sm border border-zinc-800 bg-zinc-950">
      <svg viewBox="0 0 380 310" role="img" aria-label="Graph de key concepts" className="h-72 w-full">
        {visibleRelations.map((relation) => {
          const a = positions.get(relation.conceptAId);
          const b = positions.get(relation.conceptBId);
          if (!a || !b) return null;
          return (
            <line
              key={relationKey(relation)}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="#3f3f46"
              strokeWidth="1.5"
            />
          );
        })}
        {concepts.map((concept) => {
          const position = positions.get(concept.id);
          if (!position) return null;
          const size = 16 + Math.min(12, (degree.get(concept.id) ?? 0) * 4);
          const selected = concept.id === selectedConceptId;
          return (
            <g
              key={concept.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelectConcept(concept.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectConcept(concept.id);
                }
              }}
              className="cursor-pointer outline-none"
            >
              <circle
                cx={position.x}
                cy={position.y}
                r={size}
                fill={selected ? "#10b981" : "#18181b"}
                stroke={selected ? "#a7f3d0" : "#22c55e"}
                strokeWidth={selected ? 2 : 1.5}
              />
              <text
                x={position.x}
                y={position.y + size + 13}
                textAnchor="middle"
                fill={selected ? "#d1fae5" : "#d4d4d8"}
                fontSize="10"
              >
                {concept.title.length > 24 ? `${concept.title.slice(0, 21)}...` : concept.title}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function RelationBuilder({
  concepts,
  onCreateRelation,
}: {
  concepts: KeyConcept[];
  onCreateRelation: (a: string, b: string) => Promise<void>;
}) {
  const [a, setA] = useState("");
  const [b, setB] = useState("");

  useEffect(() => {
    setA((current) => current || concepts[0]?.id || "");
    setB((current) => current || concepts[1]?.id || "");
  }, [concepts]);

  if (concepts.length < 2) return null;

  return (
    <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
      <select
        value={a}
        onChange={(event) => setA(event.target.value)}
        className="min-w-0 rounded-sm border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-emerald-500"
        aria-label="Primeiro concept"
      >
        {concepts.map((concept) => (
          <option key={concept.id} value={concept.id}>{concept.title}</option>
        ))}
      </select>
      <select
        value={b}
        onChange={(event) => setB(event.target.value)}
        className="min-w-0 rounded-sm border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-emerald-500"
        aria-label="Segundo concept"
      >
        {concepts.map((concept) => (
          <option key={concept.id} value={concept.id}>{concept.title}</option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => onCreateRelation(a, b)}
        className="flex h-8 w-8 items-center justify-center rounded-sm border border-emerald-900 bg-emerald-950/50 text-emerald-200 transition hover:border-emerald-700 hover:bg-emerald-900/60"
        title="Criar relacao"
        aria-label="Criar relacao"
      >
        <Link2 size={14} />
      </button>
    </div>
  );
}

function LazyPageThumbnail({ bookId, page }: { bookId: string; page: number }) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    const node = rootRef.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: "180px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || src || !window.api?.getAnnotationPageThumbnail) return;
    let cancelled = false;
    void window.api.getAnnotationPageThumbnail(bookId, page).then((result) => {
      if (!cancelled && result.success && result.payload) {
        setSrc(result.payload);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [bookId, page, src, visible]);

  return (
    <div ref={rootRef} className="aspect-[3/4] w-full overflow-hidden rounded-sm bg-zinc-900">
      {src ? (
        <img src={src} alt={`Pagina ${page}`} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full items-center justify-center text-[11px] text-zinc-600">
          p. {page}
        </div>
      )}
    </div>
  );
}

function AtlasView({
  pages,
  bookId,
  onGoToPage,
  onSelectConcept,
}: {
  pages: AnnotatedPage[];
  bookId: string;
  onGoToPage: (page: number) => void;
  onSelectConcept: (id: string) => void;
}) {
  if (pages.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-sm border border-zinc-800 bg-zinc-950/60 px-6 text-center text-xs text-zinc-500">
        Nenhuma pagina anotada neste filtro.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 pr-1">
      {pages.map((page) => (
        <div key={page.page} className="rounded-sm border border-zinc-800 bg-zinc-950/70 p-2">
          <button type="button" onClick={() => onGoToPage(page.page)} className="block w-full text-left">
            <LazyPageThumbnail bookId={bookId} page={page.page} />
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="font-medium text-zinc-200">p. {page.page}</span>
              <span className="text-emerald-300">{"●".repeat(Math.min(3, page.conceptCount))}</span>
            </div>
          </button>
          <div className="mt-2 space-y-1">
            {page.concepts.map((concept) => (
              <button
                key={concept.id}
                type="button"
                onClick={() => {
                  onSelectConcept(concept.id);
                  onGoToPage(page.page);
                }}
                className="block w-full truncate text-left text-[11px] text-zinc-400 hover:text-emerald-200"
              >
                {concept.title}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AnnotationPanel({
  bookId,
  currentPage,
  totalPages,
  chapters,
  onClose,
  onGoToPage,
}: AnnotationPanelProps) {
  const [activeTab, setActiveTab] = useState<AnnotationTab>("page");
  const [quickTitle, setQuickTitle] = useState("");
  const [selectedConceptId, setSelectedConceptId] = useState<string | null>(null);
  const [selectedChapterId, setSelectedChapterId] = useState("all");
  const [actionError, setActionError] = useState<string | null>(null);
  const concepts = useKeyConcepts(bookId, currentPage);

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
  const filteredConcepts = useMemo(
    () => filterConceptsByChapter(concepts.graph.concepts, selectedChapter),
    [concepts.graph.concepts, selectedChapter],
  );
  const filteredConceptIds = useMemo(
    () => new Set(filteredConcepts.map((concept) => concept.id)),
    [filteredConcepts],
  );
  const filteredRelations = useMemo(
    () => concepts.graph.relations.filter((relation) =>
      filteredConceptIds.has(relation.conceptAId) && filteredConceptIds.has(relation.conceptBId)
    ),
    [concepts.graph.relations, filteredConceptIds],
  );
  const filteredPages = useMemo(
    () => concepts.annotatedPages
      .map((page) => ({
        ...page,
        concepts: filterConceptsByChapter(page.concepts, selectedChapter),
      }))
      .filter((page) => page.concepts.length > 0)
      .map((page) => ({ ...page, conceptCount: page.concepts.length })),
    [concepts.annotatedPages, selectedChapter],
  );
  const selectedConcept = selectedConceptId
    ? concepts.conceptsById.get(selectedConceptId) ?? null
    : null;
  const relatedConcepts = useMemo(() => {
    if (!selectedConcept) return [];
    return concepts.graph.relations
      .flatMap((relation) => {
        if (relation.conceptAId === selectedConcept.id) return [concepts.conceptsById.get(relation.conceptBId)];
        if (relation.conceptBId === selectedConcept.id) return [concepts.conceptsById.get(relation.conceptAId)];
        return [];
      })
      .filter((concept): concept is KeyConcept => Boolean(concept));
  }, [concepts.conceptsById, concepts.graph.relations, selectedConcept]);

  async function runAction(action: () => Promise<void>) {
    setActionError(null);
    try {
      await action();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    }
  }

  const submitQuickConcept = () => runAction(async () => {
    const title = quickTitle.trim();
    if (!title) return;
    const beforeIds = new Set(concepts.graph.concepts.map((concept) => concept.id));
    const next = await concepts.createConcept({ title, page: currentPage });
    const created = next.concepts.find((concept) => !beforeIds.has(concept.id));
    setSelectedConceptId(created?.id ?? null);
    setQuickTitle("");
  });

  const tabs: Array<{ id: AnnotationTab; label: string; icon: typeof BookMarked }> = [
    { id: "page", label: "Pagina", icon: BookMarked },
    { id: "graph", label: "Graph", icon: Network },
    { id: "atlas", label: "Atlas", icon: MapIcon },
  ];

  return (
    <aside className="flex h-full w-[390px] max-w-[42vw] flex-col border-l border-zinc-800 bg-zinc-950 text-zinc-100 shadow-2xl">
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold">Key Concepts</div>
          <div className="text-[11px] text-zinc-500">p. {currentPage}</div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-sm border border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700 hover:text-zinc-100"
          title="Fechar annotations"
          aria-label="Fechar annotations"
        >
          <PanelRightClose size={15} />
        </button>
      </div>

      <div className="border-b border-zinc-800 p-3">
        <div className="flex gap-2">
          <input
            value={quickTitle}
            onChange={(event) => setQuickTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void submitQuickConcept();
              }
            }}
            placeholder="Novo concept"
            className="min-w-0 flex-1 rounded-sm border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-emerald-500"
            aria-label="Novo key concept"
          />
          <button
            type="button"
            onClick={() => void submitQuickConcept()}
            className="flex h-9 w-9 items-center justify-center rounded-sm border border-emerald-900 bg-emerald-950/60 text-emerald-200 hover:border-emerald-700 hover:bg-emerald-900/60"
            title="Criar key concept"
            aria-label="Criar key concept"
          >
            <Plus size={16} />
          </button>
        </div>
        {(actionError || concepts.error) && (
          <div className="mt-2 flex items-start justify-between gap-2 rounded-sm border border-red-950 bg-red-950/30 px-2 py-1.5 text-xs text-red-200">
            <span>{actionError || concepts.error}</span>
            <button type="button" onClick={() => setActionError(null)} aria-label="Fechar erro">
              <X size={13} />
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 border-b border-zinc-800">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={[
                "flex h-10 items-center justify-center gap-2 text-xs transition",
                activeTab === tab.id
                  ? "bg-zinc-900 text-emerald-200"
                  : "text-zinc-500 hover:bg-zinc-900/70 hover:text-zinc-200",
              ].join(" ")}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {concepts.loading ? (
          <div className="py-8 text-center text-xs text-zinc-500">Carregando concepts...</div>
        ) : (
          <div className="space-y-3">
            {activeTab !== "page" && (
              <ChapterFilter
                chapters={chapterRanges}
                selectedChapterId={selectedChapterId}
                onChange={setSelectedChapterId}
                currentChapter={currentChapter}
              />
            )}

            {activeTab === "page" && (
              <>
                <div className="rounded-sm border border-zinc-800 bg-zinc-950/60 p-3">
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="font-semibold text-zinc-300">Concepts desta pagina</span>
                    {concepts.currentPageConcepts.length > 0 && (
                      <span className="text-emerald-300">●</span>
                    )}
                  </div>
                  {concepts.currentPageConcepts.length === 0 ? (
                    <p className="text-xs text-zinc-500">Nenhum concept na pagina atual.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {concepts.currentPageConcepts.map((concept) => (
                        <ConceptPill
                          key={concept.id}
                          concept={concept}
                          selected={concept.id === selectedConceptId}
                          onClick={() => setSelectedConceptId(concept.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
                <ConceptDetail
                  selected={selectedConcept}
                  related={relatedConcepts}
                  relations={concepts.graph.relations}
                  onUpdate={(id, updates) => runAction(async () => {
                    await concepts.updateConcept(id, updates);
                  })}
                  onDelete={(id) => runAction(async () => {
                    await concepts.deleteConcept(id);
                    setSelectedConceptId(null);
                  })}
                  onDeleteRelation={(relation) => runAction(async () => {
                    await concepts.deleteRelation(relation);
                  })}
                  onGoToPage={onGoToPage}
                />
              </>
            )}

            {activeTab === "graph" && (
              <>
                <RelationBuilder
                  concepts={concepts.graph.concepts}
                  onCreateRelation={(a, b) => runAction(async () => {
                    await concepts.createRelation(a, b);
                  })}
                />
                <GraphView
                  concepts={filteredConcepts}
                  relations={filteredRelations}
                  selectedConceptId={selectedConceptId}
                  onSelectConcept={setSelectedConceptId}
                />
                <ConceptDetail
                  selected={selectedConcept}
                  related={relatedConcepts}
                  relations={concepts.graph.relations}
                  onUpdate={(id, updates) => runAction(async () => {
                    await concepts.updateConcept(id, updates);
                  })}
                  onDelete={(id) => runAction(async () => {
                    await concepts.deleteConcept(id);
                    setSelectedConceptId(null);
                  })}
                  onDeleteRelation={(relation) => runAction(async () => {
                    await concepts.deleteRelation(relation);
                  })}
                  onGoToPage={onGoToPage}
                />
              </>
            )}

            {activeTab === "atlas" && (
              <AtlasView
                pages={filteredPages}
                bookId={bookId}
                onGoToPage={onGoToPage}
                onSelectConcept={setSelectedConceptId}
              />
            )}
          </div>
        )}
      </div>

      <div className="border-t border-zinc-800 px-3 py-2 text-[11px] text-zinc-600">
        {selectedChapter ? chapterLabel(selectedChapter) : `${concepts.graph.concepts.length} concepts no livro`}
      </div>
    </aside>
  );
}
