import {
  flattenPdfOutline,
  formatPdfFileSize,
  formatPdfProgress,
  getPdfStorageId,
  parsePdfReaderPreferences,
  parseStoredPdfBookmarks,
} from "../mobile/pdfReaderModel";

describe("mobile PDF reader model", () => {
  it("clamps reading progress to a valid percentage", () => {
    expect(formatPdfProgress(25, 100)).toBe(25);
    expect(formatPdfProgress(120, 100)).toBe(100);
    expect(formatPdfProgress(-2, 100)).toBe(0);
    expect(formatPdfProgress(1, 0)).toBe(0);
  });

  it("flattens a nested outline without losing its destination", () => {
    const outline = flattenPdfOutline([
      {
        title: "Parte I",
        dest: "part-1",
        items: [{ title: "Capitulo 1", dest: [1, { name: "Fit" }] }],
      },
      { title: "Parte II", url: "https://example.com" },
    ]);

    expect(outline).toHaveLength(3);
    expect(outline.map((item) => [item.title, item.depth])).toEqual([
      ["Parte I", 0],
      ["Capitulo 1", 1],
      ["Parte II", 0],
    ]);
    expect(outline[1].dest).toEqual([1, { name: "Fit" }]);
    expect(new Set(outline.map((item) => item.id)).size).toBe(3);
  });

  it("sanitizes persisted bookmarks and removes duplicates", () => {
    expect(parseStoredPdfBookmarks("[5, 2, 2, 0, 31, \"3\", null]", 10)).toEqual([2, 3, 5]);
    expect(parseStoredPdfBookmarks("not-json", 10)).toEqual([]);
    expect(parseStoredPdfBookmarks("[1]", 0)).toEqual([]);
  });

  it("migrates malformed preferences to safe defaults", () => {
    expect(parsePdfReaderPreferences('{"theme":"night","layout":"page","brightness":12}')).toEqual({
      theme: "night",
      layout: "page",
      brightness: 55,
    });
    expect(parsePdfReaderPreferences('{"theme":"unknown","brightness":120}')).toEqual({
      theme: "paper",
      layout: "continuous",
      brightness: 100,
    });
    expect(parsePdfReaderPreferences("invalid").theme).toBe("paper");
  });

  it("creates stable storage ids and human-readable sizes", () => {
    expect(getPdfStorageId("ab:c/123")).toBe("abc123");
    expect(formatPdfFileSize(1_500)).toBe("1 KB");
    expect(formatPdfFileSize(2.5 * 1024 * 1024)).toBe("2.5 MB");
    expect(formatPdfFileSize(undefined)).toBe("");
  });
});
