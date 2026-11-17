import { describe, expect, it } from "vitest";
import { chapterRanges, pageParagraphs, type PdfTextItem } from "./pdfText";

function line(str: string, y: number, x = 50, width = 400): PdfTextItem {
  return { str, transform: [12, 0, 0, 12, x, y], width, height: 12, hasEOL: true };
}

describe("pdf text for .lyceum reading", () => {
  it("joins wrapped lines, re-joins hyphenated words and splits paragraphs on gaps", () => {
    const paragraphs = pageParagraphs([
      line("Il était une fois un petit prin-", 700),
      line("ce qui habitait une planète.", 686, 50, 200),
      line("Le lendemain, il partit.", 650),
      line("12", 40, 300, 12),
    ]);
    expect(paragraphs).toEqual([
      "Il était une fois un petit prince qui habitait une planète.",
      "Le lendemain, il partit.",
    ]);
  });

  it("uses the outline when it has two or more chapters, page groups otherwise", () => {
    const label = (from: number, to: number) => `p. ${from}–${to}`;
    expect(chapterRanges([{ title: "I", start: 2 }, { title: "II", start: 9 }], 20, label)).toEqual([
      { title: "p. 1–2", start: 0 },
      { title: "I", start: 2 },
      { title: "II", start: 9 },
    ]);
    expect(chapterRanges([], 25, label).map((range) => range.title)).toEqual(["p. 1–10", "p. 11–20", "p. 21–25"]);
  });
});
