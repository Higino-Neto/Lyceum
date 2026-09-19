import { describe, expect, it } from "vitest";
import {
  clusterIntoLines,
  makeLayerRect,
  mergeSelectionRects,
  projectRectsToPage,
  type ClusterItem,
  type LayerRect,
} from "../../core/pdf-reader-core/geometry";

describe("makeLayerRect", () => {
  const bounds = { left: 10, top: 20, width: 300, height: 200 };

  it("projects a rect into layer coordinates", () => {
    expect(makeLayerRect({ left: 30, top: 40, right: 60, bottom: 55 }, bounds)).toEqual({
      left: 20,
      top: 20,
      right: 50,
      bottom: 35,
      width: 30,
      height: 15,
    });
  });

  it("clamps the rect to the layer bounds", () => {
    expect(makeLayerRect({ left: 0, top: 0, right: 150, bottom: 250 }, bounds)).toEqual({
      left: 0,
      top: 0,
      right: 140,
      bottom: 200,
      width: 140,
      height: 200,
    });
  });

  it("rejects degenerate rects", () => {
    expect(makeLayerRect({ left: 40, top: 40, right: 40.2, bottom: 41 }, bounds)).toBeNull();
  });
});

describe("clusterIntoLines", () => {
  function rect(top: number, left = 0, right = 20): LayerRect {
    return { left, top, right, bottom: top + 10, width: right - left, height: 10 };
  }

  function item(...rects: LayerRect[]): ClusterItem {
    return { rects, lineIndex: -1 };
  }

  it("groups items on the same visual line by center proximity", () => {
    const items = [
      item(rect(0, 0, 30)),
      item(rect(1, 40, 70)),
      item(rect(50, 0, 30)),
    ];

    const lines = clusterIntoLines(items);

    expect(lines).toHaveLength(2);
    expect(lines[0].items.map(i => i.rects[0].left)).toEqual([0, 40]);
    expect(lines[0].items.map(i => i.lineIndex)).toEqual([0, 0]);
    expect(lines[1].items.map(i => i.rects[0].left)).toEqual([0]);
    expect(lines[1].items[0].lineIndex).toBe(1);
  });

  it("keeps items far apart vertically on separate lines", () => {
    const items = [item(rect(0)), item(rect(200))];
    const lines = clusterIntoLines(items);
    expect(lines).toHaveLength(2);
  });

  it("tracks the line bounds", () => {
    const lines = clusterIntoLines([item(rect(2, 5, 15)), item(rect(4, 30, 40))]);
    expect(lines[0]).toMatchObject({ left: 5, right: 40, top: 2, bottom: 14 });
  });
});

describe("mergeSelectionRects", () => {
  function rect(top: number, left: number, width: number, height = 10): LayerRect {
    return { left, top, right: left + width, bottom: top + height, width, height };
  }

  it("returns a single rect unchanged", () => {
    const rects = [rect(0, 0, 50)];
    expect(mergeSelectionRects(rects)).toHaveLength(1);
  });

  it("merges horizontally adjacent rects of the same line", () => {
    const merged = mergeSelectionRects([rect(0, 0, 20), rect(0, 21, 20)]);
    expect(merged).toHaveLength(1);
    expect(merged[0].width).toBeCloseTo(41, 5);
  });

  it("keeps rects from different lines separate", () => {
    const merged = mergeSelectionRects([rect(0, 0, 20), rect(100, 0, 20)]);
    expect(merged).toHaveLength(2);
  });

  it("filters out sub-pixel rects", () => {
    const merged = mergeSelectionRects([rect(0, 0, 20), rect(50, 0, 20, 0.2)]);
    expect(merged).toHaveLength(1);
  });
});

describe("projectRectsToPage", () => {
  it("projects layer rects into page-ratio coordinates", () => {
    const layer = { left: 10, top: 20, width: 300, height: 200 };
    const page = { left: 5, top: 10, width: 400, height: 400 };

    const projected = projectRectsToPage(
      [{ left: 0, top: 0, width: 100, height: 50 }],
      layer,
      page,
      3,
    );

    expect(projected).toEqual([
      { page: 3, left: 0.0125, top: 0.025, width: 0.25, height: 0.125 },
    ]);
  });

  it("returns no projections for degenerate page bounds", () => {
    expect(projectRectsToPage([], { left: 0, top: 0, width: 0, height: 0 }, { left: 0, top: 0, width: 0, height: 0 }, 1)).toEqual([]);
    expect(projectRectsToPage([{ left: 0, top: 0, width: 10, height: 10 }], { left: 0, top: 0, width: 100, height: 100 }, { left: 0, top: 0, width: 0, height: 100 }, 1)).toEqual([]);
  });
});