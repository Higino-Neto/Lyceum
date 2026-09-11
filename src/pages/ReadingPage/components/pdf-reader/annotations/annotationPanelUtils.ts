import type {
  ConceptRelation,
  KeyConcept,
  PdfSelectionRect,
} from "../../../../../types/AnnotationTypes";
import type { ChapterRange } from "./chapterRanges";
import { filterConceptsByChapter } from "./chapterRanges";

export type FilterScope = "all" | "page" | "chapter" | "highlighted" | "unlinked";
export type SortMode = "recent" | "page" | "title" | "links";

export const LINK_PAGE_SIZE = 5;
export const CONCEPT_LIST_PAGE_SIZE = 8;

export function normalizeTitle(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

export function conceptSearchText(concept: KeyConcept) {
  return `${concept.title} ${concept.note || ""} ${concept.excerpt || ""}`.toLowerCase();
}

export function parseHighlightRects(concept: KeyConcept): PdfSelectionRect[] {
  if (!concept.highlightJson) return [];
  try {
    const parsed = JSON.parse(concept.highlightJson) as { rects?: unknown };
    const rects = Array.isArray(parsed?.rects) ? parsed.rects : [];
    return rects.filter((rect): rect is PdfSelectionRect => {
      const item = rect as Partial<PdfSelectionRect>;
      return [item.page, item.left, item.top, item.width, item.height]
        .every((value) => typeof value === "number" && Number.isFinite(value));
    });
  } catch {
    return [];
  }
}

export function buildRelationCounts(concepts: KeyConcept[], relations: ConceptRelation[]) {
  const counts = new Map(concepts.map((concept) => [concept.id, 0]));
  for (const relation of relations) {
    counts.set(relation.conceptAId, (counts.get(relation.conceptAId) ?? 0) + 1);
    counts.set(relation.conceptBId, (counts.get(relation.conceptBId) ?? 0) + 1);
  }
  return counts;
}

export function findDuplicateTitle(concepts: KeyConcept[], title: string, exceptId?: string | null) {
  const normalized = normalizeTitle(title);
  if (!normalized) return null;
  return concepts.find((concept) => concept.id !== exceptId && normalizeTitle(concept.title) === normalized) ?? null;
}

export function getRelatedConcepts(
  selected: KeyConcept | null,
  conceptsById: Map<string, KeyConcept>,
  relations: ConceptRelation[],
) {
  if (!selected) return [];
  return relations
    .flatMap((relation) => {
      if (relation.conceptAId === selected.id) return [conceptsById.get(relation.conceptBId)];
      if (relation.conceptBId === selected.id) return [conceptsById.get(relation.conceptAId)];
      return [];
    })
    .filter((concept): concept is KeyConcept => Boolean(concept))
    .sort((a, b) => a.title.localeCompare(b.title));
}

export function sortConcepts(
  concepts: KeyConcept[],
  sortMode: SortMode,
  relationCounts: Map<string, number> = new Map(),
) {
  return [...concepts].sort((a, b) => {
    if (sortMode === "title") return a.title.localeCompare(b.title);
    if (sortMode === "page") return a.page - b.page || a.title.localeCompare(b.title);
    if (sortMode === "links") {
      return (relationCounts.get(b.id) ?? 0) - (relationCounts.get(a.id) ?? 0)
        || Date.parse(b.updatedAt) - Date.parse(a.updatedAt)
        || a.title.localeCompare(b.title);
    }
    return Date.parse(b.updatedAt) - Date.parse(a.updatedAt) || a.title.localeCompare(b.title);
  });
}

export function filterAndSortConcepts({
  concepts,
  currentPage,
  filterScope,
  query,
  relationCounts,
  selectedChapter,
  sortMode,
}: {
  concepts: KeyConcept[];
  currentPage: number;
  filterScope: FilterScope;
  query: string;
  relationCounts: Map<string, number>;
  selectedChapter: ChapterRange | null;
  sortMode: SortMode;
}) {
  const needle = query.trim().toLowerCase();
  let pool = concepts;

  if (filterScope === "page") {
    pool = pool.filter((concept) => concept.page === currentPage);
  } else if (filterScope === "chapter") {
    pool = selectedChapter ? filterConceptsByChapter(pool, selectedChapter) : pool;
  } else if (filterScope === "highlighted") {
    pool = pool.filter((concept) => Boolean(concept.highlightJson));
  } else if (filterScope === "unlinked") {
    pool = pool.filter((concept) => (relationCounts.get(concept.id) ?? 0) === 0);
  }

  if (needle) {
    pool = pool.filter((concept) => conceptSearchText(concept).includes(needle));
  }

  return sortConcepts(pool, sortMode, relationCounts);
}

export function clampConceptPage(value: string | number, totalPages?: number) {
  const page = Math.round(Number(value));
  if (!Number.isFinite(page) || page < 1) return null;
  return totalPages && totalPages > 0 ? Math.min(page, totalPages) : page;
}

export function paginate<T>(items: T[], page: number, pageSize: number) {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(page, 1), pageCount);
  return {
    items: items.slice((safePage - 1) * pageSize, safePage * pageSize),
    page: safePage,
    pageCount,
  };
}

export function formatRelativeUpdatedAt(value: string, now = Date.now()) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "";
  const diffMs = Math.max(0, now - timestamp);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < minute) return "agora";
  if (diffMs < hour) return `ha ${Math.floor(diffMs / minute)} min`;
  if (diffMs < day) return `ha ${Math.floor(diffMs / hour)} h`;
  return `ha ${Math.floor(diffMs / day)} dia${Math.floor(diffMs / day) === 1 ? "" : "s"}`;
}

const ACCENTS = ["#38bdf8", "#22c55e", "#facc15", "#a855f7", "#f472b6", "#fb923c"];

export function conceptAccent(index: number) {
  return ACCENTS[Math.abs(index) % ACCENTS.length];
}
