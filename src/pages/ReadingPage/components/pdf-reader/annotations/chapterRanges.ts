import type { KeyConcept } from "../../../../../types/AnnotationTypes";
import type { ChapterNode } from "../chapters/useChapterTracker";

export interface ChapterRange {
  id: string;
  title: string;
  pageStart: number;
  pageEnd: number | null;
  depth: number;
  conceptCount: number;
}

function flattenChapters(nodes: ChapterNode[] | null | undefined): Array<Omit<ChapterRange, "pageEnd" | "conceptCount">> {
  const items: Array<Omit<ChapterRange, "pageEnd" | "conceptCount">> = [];

  function walk(chapters: ChapterNode[]) {
    for (const chapter of chapters) {
      if (typeof chapter.page === "number" && chapter.page >= 1) {
        items.push({
          id: chapter.id,
          title: chapter.title,
          pageStart: chapter.page,
          depth: chapter.depth,
        });
      }
      walk(chapter.children);
    }
  }

  walk(nodes ?? []);
  return items.sort((a, b) => a.pageStart - b.pageStart || b.depth - a.depth);
}

export function buildChapterRanges(
  nodes: ChapterNode[] | null | undefined,
  concepts: KeyConcept[],
  totalPages?: number,
): ChapterRange[] {
  const flattened = flattenChapters(nodes);
  return flattened.map((chapter, index) => {
    const next = flattened.slice(index + 1).find((candidate) => candidate.pageStart > chapter.pageStart);
    const pageEnd = next
      ? Math.max(chapter.pageStart, next.pageStart - 1)
      : totalPages && totalPages >= chapter.pageStart
        ? totalPages
        : null;

    const conceptCount = concepts.filter((concept) => {
      if (concept.page < chapter.pageStart) return false;
      if (pageEnd !== null && concept.page > pageEnd) return false;
      return true;
    }).length;

    return { ...chapter, pageEnd, conceptCount };
  });
}

export function findChapterForPage(ranges: ChapterRange[], page: number): ChapterRange | null {
  return ranges
    .filter((range) => {
      if (page < range.pageStart) return false;
      if (range.pageEnd !== null && page > range.pageEnd) return false;
      return true;
    })
    .sort((a, b) => b.depth - a.depth || b.pageStart - a.pageStart)[0] ?? null;
}

export function filterConceptsByChapter(
  concepts: KeyConcept[],
  chapter: ChapterRange | null,
): KeyConcept[] {
  if (!chapter) return concepts;
  return concepts.filter((concept) => {
    if (concept.page < chapter.pageStart) return false;
    if (chapter.pageEnd !== null && concept.page > chapter.pageEnd) return false;
    return true;
  });
}
