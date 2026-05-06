import { clamp } from "./math";
import type { Block, DocumentStats, Paragraph, Section } from "./types";

function centerScore(paragraph: Paragraph, stats: DocumentStats) {
  const pageCenter = stats.pageWidth / 2;
  const paragraphCenter = (paragraph.bbox.x0 + paragraph.bbox.x1) / 2;
  return 1 - clamp(Math.abs(paragraphCenter - pageCenter) / (stats.pageWidth * 0.15));
}

function shortTextScore(text: string, max = 140) {
  return clamp((max - text.length) / max);
}

function spacingScore(paragraph: Paragraph, stats: DocumentStats) {
  return clamp((paragraph.avgLineGap || stats.medianLineGap) / Math.max(1, stats.medianLineGap * 2));
}

function fontSizeScoreForHeading(paragraph: Paragraph, stats: DocumentStats) {
  const thresholds = stats.fontSizeAnalysis?.headingThresholds;
  if (!thresholds) {
    return clamp((paragraph.style.avgFontSize / stats.bodyFontSize - 1) / 0.6);
  }

  const size = paragraph.style.avgFontSize;
  if (size >= thresholds.h1Min) return 1.0;
  if (size >= thresholds.h2Min) return 0.75 + clamp((size - thresholds.h2Min) / (thresholds.h1Min - thresholds.h2Min)) * 0.25;
  if (size >= thresholds.h3Min) return 0.5 + clamp((size - thresholds.h3Min) / (thresholds.h2Min - thresholds.h3Min)) * 0.25;
  return clamp((size / stats.bodyFontSize - 1) / 0.6) * 0.5;
}

export function scoreTitle(paragraph: Paragraph, stats: DocumentStats) {
  const fontSizeScore = fontSizeScoreForHeading(paragraph, stats);
  const weightScore = clamp(paragraph.style.boldRatio * 1.3);
  const topPositionScore = paragraph.bbox.y0 < stats.pageHeight * 0.4 ? 1 : 0.45;

  return (
    0.25 * fontSizeScore +
    0.2 * spacingScore(paragraph, stats) +
    0.15 * centerScore(paragraph, stats) +
    0.15 * shortTextScore(paragraph.text) +
    0.15 * weightScore +
    0.1 * topPositionScore
  );
}

export function scoreFootnote(paragraph: Paragraph, stats: DocumentStats) {
  const bottomPosition = clamp((paragraph.bbox.y0 / stats.pageHeight - 0.62) / 0.28);
  const smallFont = clamp((stats.bodyFontSize - paragraph.style.avgFontSize) / (stats.bodyFontSize * 0.25));
  const markerPattern = /^\s*(?:\d+|[*†‡])\s+/.test(paragraph.text) ? 1 : 0;

  return 0.3 * bottomPosition + 0.3 * smallFont + 0.25 * markerPattern + 0.15 * shortTextScore(paragraph.text, 500);
}

export function scoreBlockquote(paragraph: Paragraph, stats: DocumentStats) {
  const columnWidth = Math.max(1, stats.bodyRight - stats.bodyLeft);
  const leftIndent = clamp((paragraph.bbox.x0 - stats.bodyLeft) / (columnWidth * 0.12));
  const rightIndent = clamp((stats.bodyRight - paragraph.bbox.x1) / (columnWidth * 0.08));
  const italicScore = clamp(paragraph.style.italicRatio * 1.4);

  return 0.4 * leftIndent + 0.25 * rightIndent + 0.2 * italicScore + 0.15 * shortTextScore(paragraph.text, 900);
}

export function isChapterText(text: string) {
  return /^(?:chapter|cap[ií]tulo|parte|book|livro)\s+([ivxlcdm]+|\d+|\w+)/i.test(text.trim());
}

function isListText(text: string) {
  return /^\s*(?:[-*•]|\d+[\.)]|[A-Za-z][\.)]|[ivxlcdm]+[\.)])\s+/.test(text);
}

const TOC_ENTRY_PATTERN = /(?:^|\s)\d+(\.\d+)+\s+[^\d]+[\s·.]+\d+\s*$/;
const TOC_PAGE_NUM_PATTERN = /[\s·.]{2,}\d{1,4}\s*$/;
const TOC_LEADER_DOTS = /[\s·.]{4,}\d+\s*$/;

function isTocEntry(text: string) {
  if (TOC_PAGE_NUM_PATTERN.test(text) && TOC_LEADER_DOTS.test(text)) return true;
  if (TOC_ENTRY_PATTERN.test(text)) return true;
  return false;
}

export function scoreTocEntry(paragraph: Paragraph, stats: DocumentStats) {
  let score = 0;

  const hasLeader = TOC_LEADER_DOTS.test(paragraph.text) ? 0.4 : 0;
  const hasPageNum = TOC_PAGE_NUM_PATTERN.test(paragraph.text) ? 0.3 : 0;
  const isShort = paragraph.text.length < 120 ? 0.15 : 0;

  const nearBodyFont = Math.abs(paragraph.style.avgFontSize - stats.bodyFontSize) / stats.bodyFontSize < 0.15;
  const fontScore = nearBodyFont ? 0.15 : 0;

  score = hasLeader + hasPageNum + isShort + fontScore;
  return score;
}

export function paragraphToBlock(paragraph: Paragraph, stats: DocumentStats): Block {
  const titleScore = scoreTitle(paragraph, stats);
  const footnoteScore = scoreFootnote(paragraph, stats);
  const quoteScore = scoreBlockquote(paragraph, stats);
  const chapterText = isChapterText(paragraph.text);
  const tocScore = scoreTocEntry(paragraph, stats);

  if (tocScore >= 0.65) {
    return {
      type: "tocEntry",
      children: [paragraph],
      pageRange: { start: paragraph.pageStart, end: paragraph.pageEnd },
      text: paragraph.text,
      bbox: paragraph.bbox,
      confidence: tocScore,
    };
  }

  if (footnoteScore >= 0.75) {
    return {
      type: "footnote",
      children: [paragraph],
      pageRange: { start: paragraph.pageStart, end: paragraph.pageEnd },
      text: paragraph.text,
      bbox: paragraph.bbox,
      confidence: footnoteScore,
    };
  }

  if (chapterText || titleScore >= 0.8) {
    return {
      type: chapterText ? "chapter" : "title",
      children: [paragraph],
      pageRange: { start: paragraph.pageStart, end: paragraph.pageEnd },
      text: paragraph.text,
      bbox: paragraph.bbox,
      confidence: Math.max(titleScore, chapterText ? 0.86 : 0),
    };
  }

  if (titleScore >= 0.68) {
    return {
      type: "subtitle",
      children: [paragraph],
      pageRange: { start: paragraph.pageStart, end: paragraph.pageEnd },
      text: paragraph.text,
      bbox: paragraph.bbox,
      confidence: titleScore,
    };
  }

  if (isListText(paragraph.text)) {
    return {
      type: "listItem",
      children: [paragraph],
      pageRange: { start: paragraph.pageStart, end: paragraph.pageEnd },
      text: paragraph.text,
      bbox: paragraph.bbox,
      confidence: 0.82,
    };
  }

  if (quoteScore >= 0.7) {
    return {
      type: "blockquote",
      children: [paragraph],
      pageRange: { start: paragraph.pageStart, end: paragraph.pageEnd },
      text: paragraph.text,
      bbox: paragraph.bbox,
      confidence: quoteScore,
    };
  }

  return {
    type: "paragraph",
    children: [paragraph],
    pageRange: { start: paragraph.pageStart, end: paragraph.pageEnd },
    text: paragraph.text,
    bbox: paragraph.bbox,
    confidence: 0.78,
  };
}

export function groupListItems(blocks: Block[]) {
  const grouped: Block[] = [];
  let activeList: Block | null = null;

  for (const block of blocks) {
    if (block.type === "listItem") {
      if (!activeList) {
        activeList = {
          type: "list",
          children: [],
          pageRange: { ...block.pageRange },
          confidence: block.confidence,
        };
        grouped.push(activeList);
      }

      activeList.children.push(block);
      activeList.pageRange.end = block.pageRange.end;
      continue;
    }

    activeList = null;
    grouped.push(block);
  }

  return grouped;
}

export function buildSections(blocks: Block[]) {
  const sections: Section[] = [];
  let current: Section | null = null;

  for (const block of blocks) {
    const startsSection = block.type === "chapter" || block.type === "title";

    if (startsSection) {
      current = {
        type: "section",
        title: block.text || `Secao ${sections.length + 1}`,
        level: block.type === "chapter" ? 1 : 2,
        children: [block],
        pageRange: { ...block.pageRange },
      };
      sections.push(current);
      continue;
    }

    if (!current) {
      current = {
        type: "section",
        title: "Inicio",
        level: 1,
        children: [],
        pageRange: { ...block.pageRange },
      };
      sections.push(current);
    }

    current.children.push(block);
    current.pageRange.end = block.pageRange.end;
  }

  return sections;
}
