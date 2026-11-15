import { escapeXml } from "./text";
import type { Block, Paragraph, Section } from "./types";
import { pageAnchorHtml, pageAnchorId } from "../lyceum/pagination/pageAnchors";
import { headingLines } from "./structure";

/** Heading content: merged lines ("1" / "No Dimming of the Sun") on separate lines. */
function headingHtml(block: Block, fallback: string) {
  const lines = headingLines(block);
  return (lines.length ? lines : [fallback]).map((line) => escapeXml(line)).join("<br />");
}

export interface PdfPageMarker {
  page: number;
  chapterIndex: number;
  anchorId: string;
}

/**
 * Emits one page-start marker per PDF page, in reading order, so the EPUB
 * (and the Kindle APNX built from it) shows the same pages as the PDF.
 * Pages are emitted lazily: a marker is written right before the first content
 * that belongs to that page, or inside a paragraph at the line where the page
 * changes. Pages without text get a marker at the next content position.
 */
export class PdfPageMarkerTracker {
  private nextPage = 1;
  private chapterIndex = 0;
  readonly markers: PdfPageMarker[] = [];

  constructor(readonly pageCount: number) {}

  setChapter(index: number) {
    this.chapterIndex = index;
  }

  /** Markers for every pending page up to and including `page`. */
  emitThrough(page: number): string {
    let html = "";
    const last = Math.min(Math.floor(page), this.pageCount);
    while (this.nextPage <= last) {
      const label = String(this.nextPage);
      this.markers.push({ page: this.nextPage, chapterIndex: this.chapterIndex, anchorId: pageAnchorId(label) });
      html += pageAnchorHtml(label);
      this.nextPage += 1;
    }
    return html;
  }

  /** Markers for every page not emitted yet (end of book). */
  flush(): string {
    return this.emitThrough(this.pageCount);
  }
}

function snapToWordStart(text: string, offset: number) {
  let index = Math.max(0, Math.min(text.length, offset));
  while (index > 0 && index < text.length && !/\s/.test(text[index - 1])) index += 1;
  while (index < text.length && /\s/.test(text[index])) index += 1;
  return index;
}

/**
 * Paragraph text with page markers at the line where each new page begins.
 * Line text and the joined paragraph text differ slightly (de-hyphenation),
 * so the split point is the proportional position snapped to a word start.
 */
function paragraphTextWithPageMarkers(paragraph: Paragraph, tracker?: PdfPageMarkerTracker): string {
  if (!tracker || paragraph.pageEnd <= paragraph.pageStart) return escapeXml(paragraph.text);
  const lineLengths = paragraph.lines.map((line) => line.text.length + 1);
  const totalLineLength = Math.max(1, lineLengths.reduce((sum, value) => sum + value, 0));
  const splits: { offset: number; page: number }[] = [];
  let consumed = 0;
  let currentPage = paragraph.lines[0]?.pageNumber ?? paragraph.pageStart;
  paragraph.lines.forEach((line, index) => {
    if (line.pageNumber > currentPage) {
      const offset = snapToWordStart(paragraph.text, Math.round((consumed / totalLineLength) * paragraph.text.length));
      splits.push({ offset, page: line.pageNumber });
      currentPage = line.pageNumber;
    }
    consumed += lineLengths[index];
  });

  let html = "";
  let cursor = 0;
  for (const split of splits) {
    const offset = Math.max(cursor, split.offset);
    html += escapeXml(paragraph.text.slice(cursor, offset)) + tracker.emitThrough(split.page);
    cursor = offset;
  }
  return html + escapeXml(paragraph.text.slice(cursor));
}

function isParagraph(value: Block | Paragraph): value is Paragraph {
  return "lines" in value;
}

function paragraphText(block: Block) {
  const paragraph = block.children.find(isParagraph);
  return paragraph?.text || block.text || "";
}

function renderParagraph(paragraph: Paragraph, className?: string, tracker?: PdfPageMarkerTracker) {
  const classAttr = className ? ` class="${className}"` : "";
  return `<p${classAttr}>${paragraphTextWithPageMarkers(paragraph, tracker)}</p>`;
}

function renderBlock(block: Block, index: number, tracker?: PdfPageMarkerTracker): string {
  const before = tracker ? tracker.emitThrough(block.pageRange.start) : "";
  return before + renderBlockContent(block, index, tracker);
}

function renderBlockContent(block: Block, index: number, tracker?: PdfPageMarkerTracker): string {
  const paragraph = block.children.find(isParagraph);
  const text = paragraphText(block);

  switch (block.type) {
    case "chapter":
      return `<h1 id="chapter-${index}">${headingHtml(block, text)}</h1>`;
    case "title":
      return `<h1 id="title-${index}">${headingHtml(block, text)}</h1>`;
    case "subtitle":
      return `<h2 id="subtitle-${index}">${headingHtml(block, text)}</h2>`;
    case "tocEntry": {
      const cleanText = text.replace(/[\s·]{2,}\d+\s*$/, "");
      return `<p class="toc-entry">${escapeXml(cleanText)}</p>`;
    }
    case "blockquote":
      return `<blockquote>${paragraph ? renderParagraph(paragraph, "no-indent", tracker) : `<p>${escapeXml(text)}</p>`}</blockquote>`;
    case "footnote":
      return `<aside epub:type="footnote" id="fn-${index}"><p>${escapeXml(text)}</p></aside>`;
    case "list": {
      const ordered = block.children.some((child) => {
        const childText = isParagraph(child) ? child.text : child.text || "";
        return /^\s*\d+[.)]/.test(childText);
      });
      const tag = ordered ? "ol" : "ul";
      const items = block.children
        .map((child) => {
          const childText = isParagraph(child) ? child.text : child.text || "";
          const clean = childText.replace(/^\s*(?:[-*•]|\d+[.)]|[A-Za-z][.)]|[ivxlcdm]+[.)])\s+/i, "");
          return `<li>${escapeXml(clean)}</li>`;
        })
        .join("\n");
      return `<${tag}>\n${items}\n</${tag}>`;
    }
    case "image": {
      // Only a real caption from the PDF is shown; extracted images carry no
      // invented text (alt is empty for decorative page art).
      const caption = typeof block.attrs?.caption === "string" ? block.attrs.caption : "";
      const alt = typeof block.attrs?.alt === "string" ? block.attrs.alt : "";
      return `<figure><img src="${escapeXml(String(block.attrs?.src || ""))}" alt="${escapeXml(alt)}" />${caption ? `<figcaption>${escapeXml(caption)}</figcaption>` : ""}</figure>`;
    }
    case "table":
    case "formula":
      return `<figure class="${block.type}">${text ? `<figcaption>${escapeXml(text)}</figcaption>` : ""}</figure>`;
    case "paragraph":
    default:
      return paragraph ? renderParagraph(paragraph, undefined, tracker) : `<p>${escapeXml(text)}</p>`;
  }
}

export function renderSectionToXhtml(section: Section, index: number, tracker?: PdfPageMarkerTracker, documentTitle?: string) {
  tracker?.setChapter(index);
  const body = section.children
    .map((block, blockIndex) => renderBlock(block, index * 10000 + blockIndex, tracker))
    .join("\n\n");

  return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>${escapeXml(section.title || documentTitle || "")}</title>
  <link rel="stylesheet" type="text/css" href="../styles/book.css" />
</head>
<body>
<section epub:type="${section.level === 1 ? "chapter" : "section"}">
${body}
</section>
</body>
</html>`;
}

export function renderDefaultCss(options: { lineHeight?: number; paragraphSpacing?: number } = {}) {
  const lineHeight = Math.min(2.2, Math.max(1, options.lineHeight ?? 1.45));
  const paragraphSpacing = Math.min(3, Math.max(0, options.paragraphSpacing ?? 0.9));
  return `body {
  font-family: serif;
  line-height: ${lineHeight};
  margin: 0;
}

p {
  margin: 0 0 ${paragraphSpacing}em 0;
  text-indent: 1.2em;
}

p.no-indent,
blockquote p,
li p {
  text-indent: 0;
}

p.toc-entry {
  text-indent: 0;
  margin: 0.25em 0;
  font-size: 0.95em;
  line-height: 1.4;
}

h1,
h2,
h3 {
  line-height: 1.2;
  margin: 1.6em 0 0.8em;
}

blockquote {
  margin: 1em 1.5em;
}

figure {
  margin: 1em 0;
  text-align: center;
}

img {
  max-width: 100%;
  height: auto;
}

body.cover-page {
  margin: 0;
  padding: 0;
  text-align: center;
}

img.cover-image {
  display: block;
  margin: 0 auto;
  max-width: 100%;
  max-height: 100%;
}`;
}
