import type { LyceumTextualChapter } from "../schema/types";
import { escapeXml } from "../textual";

const CHAPTER_PATTERN = /^(?:#{1,2}\s+|(?:chapter|chapitre|cap[ií]tulo|capitolo|kapitel|parte|part|partie|teil|book|livro|livre|libro|buch|tome)\s+(?:\d+|[ivxlcdm]+|[a-z])(?:\b|\s*[-:]))/i;

function renderTextBlock(value: string) {
  const lines = value.split(/\r?\n/);
  return `<p>${lines.map(escapeXml).join("<br />")}</p>`;
}

function renderChapter(title: string, body: string) {
  const blocks = body.split(/(?:\r?\n){2,}/).filter((block) => block.length > 0);
  return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><meta charset="utf-8" /><title>${escapeXml(title)}</title></head>
<body><h1>${escapeXml(title)}</h1>
${blocks.map(renderTextBlock).join("\n")}
</body></html>`;
}

/** Splits plain text into chapters on "Chapter N"/"Capítulo N"/Markdown headings (no Node APIs). */
export function splitTextChapters(text: string, fallbackTitle: string): LyceumTextualChapter[] {
  const lines = text.split(/\r?\n/);
  const headings = lines
    .map((line, index) => ({ line: line.trim().replace(/^#{1,2}\s+/, ""), index }))
    .filter((item) => CHAPTER_PATTERN.test((lines[item.index] ?? "").trim()));
  const starts = headings.length ? headings : [{ line: fallbackTitle, index: 0 }];

  return starts.map((start, index) => {
    const next = starts[index + 1]?.index ?? lines.length;
    const includeHeading = headings.length === 0;
    const bodyLines = lines.slice(includeHeading ? start.index : start.index + 1, next);
    const title = start.line || `${fallbackTitle} ${index + 1}`;
    return {
      id: `chapter-${String(index + 1).padStart(3, "0")}`,
      href: `text/chapter-${String(index + 1).padStart(3, "0")}.xhtml`,
      title,
      xhtml: renderChapter(title, bodyLines.join("\n")),
      mediaType: "application/xhtml+xml",
    };
  });
}

