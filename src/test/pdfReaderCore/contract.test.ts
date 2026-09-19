import { describe, expect, it } from "vitest";
import {
  isNavigateState,
  isOutlineNode,
  isPdfSelectionPayload,
  isPdfSelectionRect,
  isPdfViewState,
} from "../../core/pdf-reader-core/contract";

describe("contract validators", () => {
  it("validates PdfViewState", () => {
    expect(isPdfViewState({ page: 3, currentScale: 1.25, scrollTop: 220, totalPages: 120, canAccess: true })).toBe(true);
    expect(isPdfViewState({ page: 0, currentScale: 1, scrollTop: 0, totalPages: 1, canAccess: true })).toBe(false);
    expect(isPdfViewState({ ...{ page: 3, currentScale: 1, scrollTop: 0, totalPages: 1 }, canAccess: true, page: "3" })).toBe(false);
    expect(isPdfViewState(null)).toBe(false);
  });

  it("validates PdfSelectionRect and PdfSelectionPayload", () => {
    const rect = { page: 1, left: 0.1, top: 0.2, width: 0.3, height: 0.4 };
    expect(isPdfSelectionRect(rect)).toBe(true);
    expect(isPdfSelectionRect({ ...rect, left: "1" })).toBe(false);

    const payload = { text: "conceito", page: 1, rects: [rect] };
    expect(isPdfSelectionPayload(payload)).toBe(true);
    expect(isPdfSelectionPayload({ ...payload, rects: [{ ...rect, width: NaN }] })).toBe(false);
  });

  it("validates OutlineNode trees", () => {
    const tree = { title: "Cap 1", page: 4, items: [{ title: "1.1", page: 5, items: [] }] };
    expect(isOutlineNode(tree)).toBe(true);
    expect(isOutlineNode({ ...tree, items: [{ title: "1.1", page: 0, items: [] }] })).toBe(false);
    expect(isOutlineNode({ title: "x", page: null, items: [] })).toBe(true);
  });

  it("validates NavigateState", () => {
    expect(isNavigateState({ page: 2 })).toBe(true);
    expect(isNavigateState({ page: 2, currentScale: 1.2, scrollTop: 10 })).toBe(true);
    expect(isNavigateState({ page: 0 })).toBe(false);
    expect(isNavigateState({ page: 2, scrollTop: -1 })).toBe(false);
  });
});