import { describe, expect, it } from "vitest";
import type { KeyConcept } from "../types/AnnotationTypes";
import type { ChapterNode } from "../pages/ReadingPage/components/pdf-reader/chapters/useChapterTracker";
import {
  buildChapterRanges,
  filterConceptsByChapter,
  findChapterForPage,
} from "../pages/ReadingPage/components/pdf-reader/annotations/chapterRanges";

function concept(id: string, page: number): KeyConcept {
  return {
    id,
    bookId: "book",
    title: id,
    note: null,
    excerpt: null,
    locatorJson: null,
    highlightJson: null,
    page,
    createdAt: "2026-09-10T00:00:00Z",
    updatedAt: "2026-09-10T00:00:00Z",
  };
}

const chapters: ChapterNode[] = [
  {
    id: "0",
    title: "Chapter 1",
    page: 1,
    depth: 0,
    hasChildren: false,
    children: [],
  },
  {
    id: "1",
    title: "Chapter 2",
    page: 10,
    depth: 0,
    hasChildren: true,
    children: [
      {
        id: "1/0",
        title: "Section 2.1",
        page: 14,
        depth: 1,
        hasChildren: false,
        children: [],
      },
    ],
  },
];

describe("key concept chapter filtering", () => {
  it("builds chapter ranges from the existing PDF outline", () => {
    const ranges = buildChapterRanges(chapters, [
      concept("Replication", 12),
      concept("Quorum", 14),
      concept("Linearizability", 20),
    ], 30);

    expect(ranges).toMatchObject([
      { id: "0", pageStart: 1, pageEnd: 9, conceptCount: 0 },
      { id: "1", pageStart: 10, pageEnd: 13, conceptCount: 1 },
      { id: "1/0", pageStart: 14, pageEnd: 30, conceptCount: 2 },
    ]);
  });

  it("finds the deepest chapter for the current page and filters concepts", () => {
    const concepts = [concept("Replication", 12), concept("Quorum", 14), concept("Consensus", 25)];
    const ranges = buildChapterRanges(chapters, concepts, 30);
    const current = findChapterForPage(ranges, 15);

    expect(current?.id).toBe("1/0");
    expect(filterConceptsByChapter(concepts, current).map((item) => item.title)).toEqual([
      "Quorum",
      "Consensus",
    ]);
  });
});
