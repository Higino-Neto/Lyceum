import { combineBBoxes, median, percentile, weightedAverage } from "./math";
import { joinParagraphLines } from "./text";
import type { DocumentStats, Line, Paragraph } from "./types";

function isHeadingLike(line: Line, stats: DocumentStats) {
  const h3Threshold = stats.fontSizeAnalysis?.headingThresholds.h3Min ?? stats.bodyFontSize * 1.08;
  return (
    line.avgFontSize >= h3Threshold &&
    line.text.length <= 160 &&
    line.right - line.left < (stats.bodyRight - stats.bodyLeft) * 0.9
  );
}

function isDialogueStart(text: string) {
  return /^\s*(?:[-\u2013\u2014]|["'\u201c\u2018])\s*\S+/.test(text);
}

function isAllCapsLine(text: string) {
  const letters = text.replace(/[^\p{L}]/gu, "");
  if (letters.length < 4) return false;
  return letters === letters.toUpperCase() && letters !== letters.toLowerCase();
}

function isListStart(text: string) {
  return /^\s*(?:[-*\u2022]|\d+[\.)]|[A-Za-z][\.)]|[ivxlcdm]+[\.)])\s+/i.test(text);
}

function endsStrongly(text: string) {
  return /[.!?]["')\]]?$/.test(text.trim());
}

const TOC_LEADER_PATTERN = /[\s·]{3,}|\.{3,}|\-{3,}/;
const TOC_PAGE_NUMBER_PATTERN = /[\s·.]{2,}\d{1,4}\s*$/;
const TOC_NUMBERED_ENTRY_PATTERN = /^\s*\d+(\.\d+)+\s+.+/;
const TOC_ROMAN_NUMERAL_PATTERN = /^\s*[ivxlcdmIVXLCDM]+\s+[\s·]+\d/;

function isTocLine(line: Line, stats: DocumentStats) {
  const text = line.text.trim();
  if (text.length < 3) return false;

  let score = 0;

  if (TOC_LEADER_PATTERN.test(text)) score += 0.3;
  if (TOC_PAGE_NUMBER_PATTERN.test(text)) score += 0.35;
  if (TOC_NUMBERED_ENTRY_PATTERN.test(text)) score += 0.2;
  if (TOC_ROMAN_NUMERAL_PATTERN.test(text)) score += 0.15;

  const rightEdgeRatio = line.right / stats.pageWidth;
  if (rightEdgeRatio > 0.85) score += 0.1;

  const isBodyLike = line.avgFontSize >= stats.bodyFontSize * 0.9 &&
    line.avgFontSize <= stats.bodyFontSize * 1.1;
  if (isBodyLike) score += 0.1;

  return score >= 0.55;
}

function shouldStartNewParagraph(previous: Line, current: Line, activeLines: Line[], stats: DocumentStats) {
  const columnWidth = Math.max(1, stats.bodyRight - stats.bodyLeft);

  if (
    previous.pageNumber !== current.pageNumber &&
    previous.right < stats.bodyRight - columnWidth * 0.2
  ) {
    return true;
  }

  const verticalGap = current.bbox.y0 - previous.bbox.y1;
  const activeLeft = percentile(activeLines.map((line) => line.left), 20);
  const leftDelta = current.left - activeLeft;
  const previousWidth = previous.right - previous.left;
  const currentWidth = current.right - current.left;
  const previousIsShort = previousWidth < columnWidth * 0.72;
  const currentIsShort = currentWidth < columnWidth * 0.72;
  const regularGap = verticalGap >= stats.medianLineGap * 0.55;

  if (isHeadingLike(previous, stats) && !isHeadingLike(current, stats)) return true;
  if (isHeadingLike(current, stats)) return true;
  if (isListStart(current.text) && !isDialogueStart(current.text)) return true;
  if (isDialogueStart(current.text) && activeLines.length > 0 && regularGap) return true;

  if (
    activeLines.length === 1 &&
    previousIsShort &&
    currentIsShort &&
    regularGap &&
    (isAllCapsLine(previous.text) || isAllCapsLine(current.text))
  ) {
    return true;
  }

  if (
    previousIsShort &&
    regularGap &&
    !previous.text.endsWith("-") &&
    (/^[A-ZÀ-Ý"'\u201c\u2018]/.test(current.text.trim()) || isDialogueStart(current.text)) &&
    Math.abs(current.left - activeLeft) <= columnWidth * 0.08
  ) {
    return true;
  }

  if (verticalGap >= stats.medianLineGap * 1.65) return true;
  if (leftDelta >= Math.max(12, columnWidth * 0.035) && leftDelta <= columnWidth * 0.2) {
    return true;
  }
  if (verticalGap >= stats.medianLineGap * 1.45 && endsStrongly(previous.text)) return true;
  if (Math.abs(current.avgFontSize - previous.avgFontSize) / Math.max(1, previous.avgFontSize) > 0.15) {
    return true;
  }

  const previousIsToc = isTocLine(previous, stats);
  const currentIsToc = isTocLine(current, stats);
  if (previousIsToc && currentIsToc) return true;
  if (previousIsToc && endsStrongly(previous.text)) return true;

  return false;
}

function createParagraph(lines: Line[], stats: DocumentStats): Paragraph {
  const bbox = combineBBoxes(lines.map((line) => line.bbox));
  const gaps: number[] = [];
  for (let index = 1; index < lines.length; index += 1) {
    const gap = lines[index].bbox.y0 - lines[index - 1].bbox.y1;
    if (gap > 0) gaps.push(gap);
  }

  const fontNames = new Map<string, number>();
  const tokens = lines.flatMap((line) => line.tokens);
  for (const token of tokens) {
    fontNames.set(token.fontName, (fontNames.get(token.fontName) || 0) + Math.max(1, token.text.length));
  }
  const dominantFontName = [...fontNames.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const tokenWeight = Math.max(1, tokens.reduce((sum, token) => sum + token.text.length, 0));
  const boldWeight = tokens
    .filter((token) => token.bold)
    .reduce((sum, token) => sum + Math.max(1, token.text.length), 0);
  const italicWeight = tokens
    .filter((token) => token.italic)
    .reduce((sum, token) => sum + Math.max(1, token.text.length), 0);
  const columnRight = percentile(lines.map((line) => line.right), 95) || stats.bodyRight;
  const columnLeft = percentile(lines.map((line) => line.left), 10) || stats.bodyLeft;
  const columnWidth = Math.max(1, columnRight - columnLeft);

  return {
    lines,
    text: joinParagraphLines(lines, columnRight, columnWidth),
    bbox,
    indentation: lines[0].left - stats.bodyLeft,
    avgLineGap: median(gaps),
    pageStart: Math.min(...lines.map((line) => line.pageNumber)),
    pageEnd: Math.max(...lines.map((line) => line.pageNumber)),
    style: {
      avgFontSize: weightedAverage(
        lines,
        (line) => line.avgFontSize,
        (line) => Math.max(1, line.text.length),
      ),
      dominantFontName,
      boldRatio: boldWeight / tokenWeight,
      italicRatio: italicWeight / tokenWeight,
    },
  };
}

export function buildParagraphs(lines: Line[], stats: DocumentStats) {
  const paragraphs: Paragraph[] = [];
  let active: Line[] = [];

  for (const line of lines) {
    if (!active.length) {
      active = [line];
      continue;
    }

    const previous = active[active.length - 1];

    if (shouldStartNewParagraph(previous, line, active, stats)) {
      paragraphs.push(createParagraph(active, stats));
      active = [line];
    } else {
      active.push(line);
    }
  }

  if (active.length) {
    paragraphs.push(createParagraph(active, stats));
  }

  return paragraphs.filter((paragraph) => paragraph.text.length > 0);
}
