import { describe, expect, it } from "vitest";
import { buildTextLayerModel, type TextItemSeed } from "../../core/pdf-reader-core/textModel";

function seed(key: string, text: string, top: number, left = 0): TextItemSeed {
  return { key, text, rects: [{ left, top, right: left + 10, bottom: top + 10, width: 10, height: 10 }] };
}

describe("buildTextLayerModel", () => {
  it("assigns global offsets in document order", () => {
    const model = buildTextLayerModel(
      [seed("a", "ab", 0), seed("b", "cd", 1), seed("c", "e", 50)],
      "sig",
    );

    expect(model.textLength).toBe(5);
    expect(model.items.map(item => [item.key, item.start, item.end])).toEqual([
      ["a", 0, 2],
      ["b", 2, 4],
      ["c", 4, 5],
    ]);
  });

  it("groups items into sorted lines with final indices", () => {
    const model = buildTextLayerModel(
      [seed("a", "ab", 0), seed("b", "cd", 1), seed("c", "e", 50)],
      "sig",
    );

    expect(model.lines).toHaveLength(2);
    expect(model.lines[0].items.map(item => item.key)).toEqual(["a", "b"]);
    expect(model.lines.map(line => line.items[0].lineIndex)).toEqual([0, 1]);
  });

  it("keeps the supplied signature for cache bookkeeping", () => {
    expect(buildTextLayerModel([seed("a", "x", 0)], "sig-123").signature).toBe("sig-123");
  });
});