import { describe, expect, it } from "vitest";
import type { ConceptRelation, KeyConcept } from "../types/AnnotationTypes";
import {
  buildRelationCounts,
  filterAndSortConcepts,
  findDuplicateTitle,
  parseHighlightRects,
} from "../pages/ReadingPage/components/pdf-reader/annotations/annotationPanelUtils";

function concept(input: Partial<KeyConcept> & { id: string; title: string; page: number }): KeyConcept {
  return {
    bookId: "book",
    note: null,
    excerpt: null,
    locatorJson: null,
    highlightJson: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...input,
  };
}

function relation(conceptAId: string, conceptBId: string): ConceptRelation {
  return {
    bookId: "book",
    conceptAId,
    conceptBId,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("annotation panel rules", () => {
  it("detects duplicate titles after whitespace and case normalization", () => {
    const concepts = [
      concept({ id: "a", title: "Distributed Systems", page: 1 }),
      concept({ id: "b", title: "Consensus", page: 2 }),
    ];

    expect(findDuplicateTitle(concepts, " distributed   systems ")?.id).toBe("a");
    expect(findDuplicateTitle(concepts, "distributed systems", "a")).toBeNull();
  });

  it("filters unlinked concepts using both sides of a relation", () => {
    const concepts = [
      concept({ id: "a", title: "A", page: 1 }),
      concept({ id: "b", title: "B", page: 2 }),
      concept({ id: "c", title: "C", page: 3 }),
    ];
    const relationCounts = buildRelationCounts(concepts, [relation("b", "a")]);

    expect(filterAndSortConcepts({
      concepts,
      currentPage: 1,
      filterScope: "unlinked",
      query: "",
      relationCounts,
      selectedChapter: null,
      sortMode: "title",
    }).map((item) => item.id)).toEqual(["c"]);
  });

  it("parses persisted highlight rectangles defensively", () => {
    const parsed = parseHighlightRects(concept({
      id: "h",
      title: "Highlight",
      page: 4,
      highlightJson: JSON.stringify({
        rects: [
          { page: 4, left: 0.1, top: 0.2, width: 0.3, height: 0.04 },
          { page: "4", left: 0.1, top: 0.2, width: 0.3, height: 0.04 },
        ],
      }),
    }));

    expect(parsed).toEqual([{ page: 4, left: 0.1, top: 0.2, width: 0.3, height: 0.04 }]);
  });
});
