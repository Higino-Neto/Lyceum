import { escapeXml } from "../../../lib/lyceum/textual";

/**
 * Turns pdf.js text items into reading paragraphs, without Node APIs, so a PDF
 * can be read in .lyceum mode inside a WebView. The layout heuristics are
 * deliberately simple: lines by baseline, paragraphs by vertical gaps and short
 * sentence-ending lines, hyphenated line breaks re-joined, bare page numbers
 * dropped.
 */

export interface PdfTextItem {
  str: string;
  /** pdf.js transform: [a, b, c, d, x, y]. */
  transform: number[];
  width?: number;
  height?: number;
  hasEOL?: boolean;
}

interface Line {
  text: string;
  y: number;
  x: number;
  right: number;
  height: number;
}

function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

function itemHeight(item: PdfTextItem) {
  return Math.abs(item.height || item.transform[3] || item.transform[0] || 10);
}

function buildLines(items: PdfTextItem[]): Line[] {
  const lines: Line[] = [];
  let current: Line | null = null;
  let breakNext = false;
  for (const item of items) {
    const text = item.str ?? "";
    const x = item.transform[4] ?? 0;
    const y = item.transform[5] ?? 0;
    const height = itemHeight(item);
    const width = item.width ?? text.length * height * 0.5;
    const sameLine = current !== null && !breakNext && Math.abs(current.y - y) <= Math.max(2, Math.min(current.height, height) * 0.5);
    if (!sameLine) {
      if (text.trim()) {
        current = { text, y, x, right: x + width, height };
        lines.push(current);
      } else {
        current = null;
      }
    } else if (current && text) {
      const gap = x - current.right;
      const needsSpace = gap > height * 0.15 && !/\s$/.test(current.text) && !/^\s/.test(text);
      current.text += (needsSpace ? " " : "") + text;
      current.right = Math.max(current.right, x + width);
      current.height = Math.max(current.height, height);
    }
    breakNext = Boolean(item.hasEOL);
  }
  return lines
    .map((line) => ({ ...line, text: line.text.replace(/\s+/g, " ").trim() }))
    .filter((line) => line.text.length > 0);
}

function joinLines(previous: string, next: string) {
  // "exam-" + "ple" → "example" (only when the next line continues in lowercase).
  if (/[\p{L}]-$/u.test(previous) && /^\p{Ll}/u.test(next)) return previous.slice(0, -1) + next;
  return `${previous} ${next}`;
}

/** Paragraphs of one page, in reading order. */
export function pageParagraphs(items: PdfTextItem[]): string[] {
  const lines = buildLines(items).filter((line, index, all) => {
    // Running page numbers at the top or bottom of the page.
    const edge = index === 0 || index === all.length - 1;
    return !(edge && /^[-–—\s]*\d{1,4}[-–—\s]*$/.test(line.text));
  });
  if (lines.length === 0) return [];

  const gaps: number[] = [];
  for (let index = 1; index < lines.length; index += 1) {
    const gap = Math.abs(lines[index - 1]!.y - lines[index]!.y);
    if (gap > 0) gaps.push(gap);
  }
  const typicalGap = median(gaps) || lines[0]!.height * 1.2;
  const fullWidth = Math.max(...lines.map((line) => line.right - line.x));

  const paragraphs: string[] = [];
  let paragraph = lines[0]!.text;
  for (let index = 1; index < lines.length; index += 1) {
    const previous = lines[index - 1]!;
    const line = lines[index]!;
    const gap = Math.abs(previous.y - line.y);
    const previousShort = previous.right - previous.x < fullWidth * 0.72;
    const endsSentence = /[.!?:;…»"”)]$/.test(previous.text);
    const indented = line.x - previous.x > previous.height * 0.8;
    const newParagraph = gap > typicalGap * 1.45 || (previousShort && endsSentence) || (indented && endsSentence);
    if (newParagraph) {
      paragraphs.push(paragraph);
      paragraph = line.text;
    } else {
      paragraph = joinLines(paragraph, line.text);
    }
  }
  paragraphs.push(paragraph);
  return paragraphs;
}

/** Chapter XHTML in the same shape as the TXT importer produces. */
export function renderPdfChapterXhtml(title: string, paragraphs: string[]) {
  return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><meta charset="utf-8" /><title>${escapeXml(title)}</title></head>
<body><h1>${escapeXml(title)}</h1>
${paragraphs.map((text) => `<p>${escapeXml(text)}</p>`).join("\n")}
</body></html>`;
}

export interface PdfChapterRange {
  title: string;
  /** Zero-based first page. */
  start: number;
}

/** Pages per chapter when the PDF has no usable outline. */
export const PAGES_PER_FALLBACK_CHAPTER = 10;

/**
 * Chapter starts from the outline when it gives at least two distinct pages,
 * otherwise fixed page groups. Always starts at page 0.
 */
export function chapterRanges(outline: PdfChapterRange[], pageCount: number, pageLabel: (from: number, to: number) => string): PdfChapterRange[] {
  const fromOutline = outline
    .filter((entry) => entry.start >= 0 && entry.start < pageCount)
    .sort((a, b) => a.start - b.start)
    .filter((entry, index, all) => index === 0 || entry.start !== all[index - 1]!.start);
  if (fromOutline.length >= 2) {
    if (fromOutline[0]!.start > 0) fromOutline.unshift({ title: pageLabel(1, fromOutline[0]!.start), start: 0 });
    return fromOutline;
  }
  const ranges: PdfChapterRange[] = [];
  for (let start = 0; start < pageCount; start += PAGES_PER_FALLBACK_CHAPTER) {
    const end = Math.min(pageCount, start + PAGES_PER_FALLBACK_CHAPTER);
    ranges.push({ title: pageLabel(start + 1, end), start });
  }
  return ranges;
}
