import { clamp, textSimilarity } from "./math";
import type { DocumentStats, Line, PageModel } from "./types";

interface NoiseSignature {
  text: string;
  yBucket: number;
  xBucket: number;
  pageNumbers: Set<number>;
  examples: Line[];
}

export interface NoiseModel {
  repeated: NoiseSignature[];
  totalPages: number;
}

function normalizeNoiseText(text: string) {
  return text
    .toLowerCase()
    .replace(/\d+/g, "")
    .replace(/[^\p{L}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isPageNumber(text: string) {
  return /^\s*(\d{1,4}|[ivxlcdm]{1,8})\s*$/i.test(text);
}

export function buildNoiseModel(pages: PageModel[], stats: DocumentStats): NoiseModel {
  const signatures: NoiseSignature[] = [];

  for (const page of pages) {
    for (const line of page.lines) {
      const nearEdge =
        line.bbox.y0 < page.height * 0.14 || line.bbox.y1 > page.height * 0.86;

      if (!nearEdge) continue;

      const text = normalizeNoiseText(line.text);
      if (!text && !isPageNumber(line.text)) continue;

      const yBucket = Math.round(line.bbox.y0 / Math.max(1, stats.bodyFontSize * 2));
      const xBucket = Math.round(line.left / Math.max(1, stats.bodyFontSize * 4));
      let signature = signatures.find(
        (candidate) =>
          candidate.yBucket === yBucket &&
          Math.abs(candidate.xBucket - xBucket) <= 1 &&
          textSimilarity(candidate.text, text) >= 0.82,
      );

      if (!signature) {
        signature = {
          text,
          yBucket,
          xBucket,
          pageNumbers: new Set(),
          examples: [],
        };
        signatures.push(signature);
      }

      signature.pageNumbers.add(page.pageNumber);
      signature.examples.push(line);
    }
  }

  return {
    repeated: signatures,
    totalPages: pages.length,
  };
}

export function scoreNoise(line: Line, page: PageModel, model: NoiseModel, stats: DocumentStats) {
  const topDistance = line.bbox.y0 / page.height;
  const bottomDistance = 1 - line.bbox.y1 / page.height;
  const positionScore = clamp((0.16 - Math.min(topDistance, bottomDistance)) / 0.16);
  const shortTextScore = clamp((28 - line.text.length) / 28);
  const fontScore = clamp((stats.bodyFontSize * 1.1 - line.avgFontSize) / stats.bodyFontSize);
  const pageNumberPatternScore = isPageNumber(line.text) ? 1 : 0;
  const normalized = normalizeNoiseText(line.text);
  const matchingSignature = model.repeated.find((signature) => {
    const frequency = signature.pageNumbers.size / Math.max(1, model.totalPages);
    return frequency >= 0.35 && textSimilarity(signature.text, normalized) >= 0.82;
  });
  const repetitionScore = matchingSignature
    ? clamp(matchingSignature.pageNumbers.size / Math.max(1, model.totalPages * 0.5))
    : 0;

  const score =
    0.3 * positionScore +
    0.25 * repetitionScore +
    0.15 * shortTextScore +
    0.15 * fontScore +
    0.15 * pageNumberPatternScore;
  const repeatedEdgeLine = repetitionScore >= 0.9 && positionScore >= 0.75;

  const titleLike =
    line.avgFontSize > (stats.fontSizeAnalysis?.headingThresholds.h3Min ?? stats.bodyFontSize * 1.18) &&
    line.bbox.y0 < page.height * 0.35 &&
    line.text.length > 3;

  if (titleLike) return Math.min(score, 0.45);
  if (repeatedEdgeLine) return Math.max(score, 0.82);

  return score;
}

export function removeNoiseLines(pages: PageModel[], stats: DocumentStats) {
  const model = buildNoiseModel(pages, stats);

  return pages.map<PageModel>((page) => ({
    ...page,
    lines: page.lines.filter((line) => scoreNoise(line, page, model, stats) < 0.72),
  }));
}
