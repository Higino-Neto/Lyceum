import { describe, expect, it } from "vitest";
import { formatPageRanges, isPagePicksCommand, pageRuns } from "../../core/pdf-reader-core/contract";
import { EVT_EXPORT_PAGES, parsePdfViewerMessage, PDF_VIEWER_ORIGIN } from "../../pages/ReadingPage/components/pdf-reader/pdfBridgeProtocol";

describe("page picks", () => {
  it("formats picked pages as compact ranges", () => {
    expect(formatPageRanges([5, 3, 4, 9, 12, 13, 14, 3])).toBe("3–5, 9, 12–14");
    expect(formatPageRanges([])).toBe("");
  });

  it("groups picked pages into runs for the book edge", () => {
    expect(pageRuns([1, 2, 3, 7, 9, 10])).toEqual([{ from: 1, to: 3 }, { from: 7, to: 7 }, { from: 9, to: 10 }]);
  });

  it("validates pick commands", () => {
    expect(isPagePicksCommand({ pages: [1, 2], mode: "add" })).toBe(true);
    expect(isPagePicksCommand({ pages: [0], mode: "add" })).toBe(false);
    expect(isPagePicksCommand({ pages: [1.5], mode: "replace" })).toBe(false);
    expect(isPagePicksCommand({ pages: [1], mode: "toggle" })).toBe(false);
  });

  it("parses export requests only with a valid page list", () => {
    const source = {} as Window;
    const message = (data: unknown) => ({ source, origin: PDF_VIEWER_ORIGIN, data }) as MessageEvent;
    expect(parsePdfViewerMessage(message({ version: 1, type: EVT_EXPORT_PAGES, pages: [3, 4] }), source)).toMatchObject({ pages: [3, 4] });
    expect(parsePdfViewerMessage(message({ version: 1, type: EVT_EXPORT_PAGES, pages: ["3"] }), source)).toBeNull();
  });
});
