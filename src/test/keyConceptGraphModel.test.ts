import { describe, expect, it } from "vitest";
import type { ConceptRelation, KeyConcept } from "../types/AnnotationTypes";
import { buildConceptGraphModel } from "../pages/ReadingPage/components/pdf-reader/annotations/graphModel";

function concept(id: string, title: string, page: number): KeyConcept {
  return {
    id,
    bookId: "book",
    title,
    note: null,
    excerpt: null,
    locatorJson: null,
    highlightJson: null,
    page,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
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

describe("key concept graph model", () => {
  it("builds node degrees and drops relations outside the visible concept set", () => {
    const model = buildConceptGraphModel(
      [concept("a", "A", 1), concept("b", "B", 2), concept("c", "C", 3)],
      [relation("a", "b"), relation("a", "c"), relation("a", "missing")],
    );

    expect(model.edges.map((edge) => edge.id)).toEqual(["a::b", "a::c"]);
    expect(model.nodes.map((node) => [node.id, node.degree])).toEqual([
      ["a", 2],
      ["b", 1],
      ["c", 1],
    ]);
  });
});
