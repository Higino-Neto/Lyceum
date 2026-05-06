import { combineBBoxes, median, percentile, weightedAverage } from "./math";
import type { BBox, DocumentStats, FontSizeAnalysis, FontSizeCluster, ImageCandidate, Line, PageModel, Token } from "./types";

export interface PdfJsTextItemLike {
  str: string;
  width?: number;
  height?: number;
  fontName?: string;
  transform: number[];
  dir?: "ltr" | "rtl";
}

export interface PdfJsPageLike {
  pageNumber?: number;
  getViewport(args: { scale: number }): { width: number; height: number };
  getTextContent(args?: {
    includeMarkedContent?: boolean;
    disableCombineTextItems?: boolean;
  }): Promise<{ items: unknown[] }>;
  getOperatorList?(): Promise<{ fnArray: number[]; argsArray: unknown[][] }>;
}

export function tokenBBox(token: Token): BBox {
  return {
    x0: token.x,
    y0: token.y,
    x1: token.x + token.width,
    y1: token.y + token.height,
    width: token.width,
    height: token.height,
  };
}

function isTextItem(item: unknown): item is PdfJsTextItemLike {
  return Boolean(
    item &&
      typeof item === "object" &&
      "str" in item &&
      "transform" in item &&
      Array.isArray((item as PdfJsTextItemLike).transform),
  );
}

function inferFontFlags(fontName: string) {
  return {
    bold: /\b(bold|black|heavy|semibold|demi)\b/i.test(fontName),
    italic: /\b(italic|oblique)\b/i.test(fontName),
  };
}

export async function extractTokensFromPdfJsPage(
  page: PdfJsPageLike,
  pageNumber: number,
): Promise<{ width: number; height: number; tokens: Token[] }> {
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent({
    includeMarkedContent: true,
    disableCombineTextItems: false,
  });

  const tokens = content.items
    .filter(isTextItem)
    .filter((item) => item.str.trim().length > 0)
    .map<Token>((item, sourceIndex) => {
      const [a, b, , d, e, f] = item.transform;
      const fontSize = Math.max(1, Math.hypot(a, b) || Math.abs(d) || item.height || 1);
      const width = Math.max(0, item.width ?? item.str.length * fontSize * 0.5);
      const height = Math.max(1, item.height ?? fontSize);
      const fontName = item.fontName || "unknown";
      const flags = inferFontFlags(fontName);

      return {
        text: item.str,
        x: e,
        y: viewport.height - f - height,
        width,
        height,
        fontName,
        fontSize,
        pageNumber,
        rawTransform: item.transform,
        dir: item.dir,
        sourceIndex,
        ...flags,
      };
    });

  return {
    width: viewport.width,
    height: viewport.height,
    tokens,
  };
}

function verticalOverlapRatio(a: BBox, b: BBox) {
  const overlap = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
  if (overlap <= 0) return 0;
  return overlap / Math.max(1, Math.min(a.height, b.height));
}

function matrixMultiply(left: number[], right: number[]) {
  return [
    left[0] * right[0] + left[2] * right[1],
    left[1] * right[0] + left[3] * right[1],
    left[0] * right[2] + left[2] * right[3],
    left[1] * right[2] + left[3] * right[3],
    left[0] * right[4] + left[2] * right[5] + left[4],
    left[1] * right[4] + left[3] * right[5] + left[5],
  ];
}

function transformPoint(matrix: number[], x: number, y: number) {
  return {
    x: matrix[0] * x + matrix[2] * y + matrix[4],
    y: matrix[1] * x + matrix[3] * y + matrix[5],
  };
}

function imageBBoxFromMatrix(matrix: number[], pageWidth: number, pageHeight: number): BBox | null {
  const points = [
    transformPoint(matrix, 0, 0),
    transformPoint(matrix, 1, 0),
    transformPoint(matrix, 0, 1),
    transformPoint(matrix, 1, 1),
  ];
  const x0 = Math.max(0, Math.min(...points.map((point) => point.x)));
  const x1 = Math.min(pageWidth, Math.max(...points.map((point) => point.x)));
  const pdfY0 = Math.max(0, Math.min(...points.map((point) => point.y)));
  const pdfY1 = Math.min(pageHeight, Math.max(...points.map((point) => point.y)));
  const y0 = Math.max(0, pageHeight - pdfY1);
  const y1 = Math.min(pageHeight, pageHeight - pdfY0);
  const width = x1 - x0;
  const height = y1 - y0;

  if (width < 24 || height < 24) return null;

  return { x0, y0, x1, y1, width, height };
}

export async function extractImageCandidatesFromPdfJsPage(
  page: PdfJsPageLike,
  args: {
    pageNumber: number;
    width: number;
    height: number;
    ops?: Record<string, number>;
  },
): Promise<ImageCandidate[]> {
  if (!page.getOperatorList || !args.ops) return [];

  const operatorList = await page.getOperatorList();
  const transformOp = args.ops.transform;
  const saveOp = args.ops.save;
  const restoreOp = args.ops.restore;
  const imageOps = new Set(
    [
      args.ops.paintImageXObject,
      args.ops.paintJpegXObject,
      args.ops.paintInlineImageXObject,
      args.ops.paintImageMaskXObject,
      args.ops.paintImageMaskXObjectGroup,
      args.ops.paintImageXObjectRepeat,
      args.ops.paintInlineImageXObjectGroup,
    ].filter((value): value is number => typeof value === "number"),
  );
  const stack: number[][] = [];
  let current = [1, 0, 0, 1, 0, 0];
  const candidates: ImageCandidate[] = [];

  operatorList.fnArray.forEach((fn, index) => {
    const opArgs = operatorList.argsArray[index] || [];

    if (fn === saveOp) {
      stack.push([...current]);
      return;
    }

    if (fn === restoreOp) {
      current = stack.pop() || [1, 0, 0, 1, 0, 0];
      return;
    }

    if (fn === transformOp && opArgs.length >= 6 && opArgs.every((value) => typeof value === "number")) {
      current = matrixMultiply(current, opArgs as number[]);
      return;
    }

    if (!imageOps.has(fn)) return;

    const bbox = imageBBoxFromMatrix(current, args.width, args.height);
    if (!bbox) return;

    const areaRatio = (bbox.width * bbox.height) / Math.max(1, args.width * args.height);
    candidates.push({
      id: `page-${args.pageNumber}-image-${candidates.length + 1}`,
      pageNumber: args.pageNumber,
      bbox,
      pageWidth: args.width,
      pageHeight: args.height,
      confidence: Math.min(0.95, 0.55 + areaRatio * 3),
    });
  });

  return candidates;
}

export function normalizeLigatures(text: string) {
  return text
    .replace(/\uFB00/g, "ff")
    .replace(/\uFB01/g, "fi")
    .replace(/\uFB02/g, "fl")
    .replace(/\uFB03/g, "ffi")
    .replace(/\uFB04/g, "ffl")
    .normalize("NFKC");
}

function buildLineText(tokens: Token[], avgFontSize: number) {
  const ordered = [...tokens].sort((a, b) => a.x - b.x || (a.sourceIndex ?? 0) - (b.sourceIndex ?? 0));
  const spaceWidth = Math.max(1, avgFontSize * 0.28);
  let text = "";

  ordered.forEach((token, index) => {
    const cleanText = normalizeLigatures(token.text);
    if (index === 0) {
      text += cleanText;
      return;
    }

    const previous = ordered[index - 1];
    const gap = token.x - (previous.x + previous.width);
    const shouldInsertSpace =
      gap > spaceWidth * 0.6 &&
      !/\s$/.test(text) &&
      !/^[,.;:!?%\])}]/.test(cleanText) &&
      !/[([{]$/.test(text);

    text += shouldInsertSpace ? ` ${cleanText}` : cleanText;
  });

  return text.replace(/[ \t]+/g, " ").trim();
}

export function createLine(tokens: Token[]): Line {
  const ordered = [...tokens].sort((a, b) => a.x - b.x);
  const bbox = combineBBoxes(ordered.map(tokenBBox));
  const avgFontSize = weightedAverage(
    ordered,
    (token) => token.fontSize,
    (token) => Math.max(1, token.text.length),
  );
  const baseline = median(ordered.map((token) => token.y + token.height));

  return {
    tokens: ordered,
    text: buildLineText(ordered, avgFontSize),
    bbox,
    baseline,
    avgFontSize,
    left: bbox.x0,
    right: bbox.x1,
    center: (bbox.x0 + bbox.x1) / 2,
    pageNumber: ordered[0]?.pageNumber ?? 0,
  };
}

export function buildLines(
  tokens: Token[],
  options: { yToleranceRatio?: number; minTolerancePx?: number } = {},
) {
  const yToleranceRatio = options.yToleranceRatio ?? 0.35;
  const minTolerancePx = options.minTolerancePx ?? 2;
  const sorted = [...tokens].sort((a, b) => {
    const pageDelta = a.pageNumber - b.pageNumber;
    if (pageDelta) return pageDelta;
    return a.y - b.y || (a.sourceIndex ?? 0) - (b.sourceIndex ?? 0);
  });
  const buckets: Token[][] = [];

  for (const token of sorted) {
    const baseline = token.y + token.height;
    const tolerance = Math.max(minTolerancePx, token.fontSize * yToleranceRatio);
    const bucket = buckets.find((candidate) => {
      if (candidate[0]?.pageNumber !== token.pageNumber) return false;
      const candidateBaseline = median(candidate.map((item) => item.y + item.height));
      const candidateBox = combineBBoxes(candidate.map(tokenBBox));
      const sameBaseline = Math.abs(candidateBaseline - baseline) <= tolerance;
      const sameVisualBand =
        verticalOverlapRatio(candidateBox, tokenBBox(token)) >= 0.52 &&
        Math.abs(candidateBox.y0 - token.y) <= Math.max(token.fontSize * 0.9, minTolerancePx * 2);

      return sameBaseline || sameVisualBand;
    });

    if (bucket) {
      bucket.push(token);
    } else {
      buckets.push([token]);
    }
  }

  return buckets
    .map(createLine)
    .filter((line) => line.text.length > 0)
    .sort((a, b) => {
      const pageDelta = a.pageNumber - b.pageNumber;
      if (pageDelta) return pageDelta;
      const yDelta = a.baseline - b.baseline;
      return Math.abs(yDelta) > 1 ? yDelta : a.left - b.left;
    });
}

function buildHistogram(tokenFontSizes: { size: number; weight: number }[], binSize = 0.5) {
  if (!tokenFontSizes.length) return { bins: [] as { center: number; totalWeight: number }[], binSize };

  const min = Math.min(...tokenFontSizes.map((t) => t.size));
  const max = Math.max(...tokenFontSizes.map((t) => t.size));
  const binCount = Math.max(1, Math.ceil((max - min) / binSize));
  const bins: { center: number; totalWeight: number }[] = [];

  for (let i = 0; i < binCount; i += 1) {
    bins.push({
      center: min + (i + 0.5) * binSize,
      totalWeight: 0,
    });
  }

  for (const token of tokenFontSizes) {
    const binIndex = Math.min(binCount - 1, Math.floor((token.size - min) / binSize));
    bins[binIndex].totalWeight += token.weight;
  }

  return { bins, binSize, min };
}

function smoothHistogram(bins: { center: number; totalWeight: number }[], windowSize = 3) {
  if (bins.length <= 1) return bins;
  const halfWindow = Math.floor(windowSize / 2);

  return bins.map((bin, index) => {
    let smoothedWeight = 0;
    let weightSum = 0;

    for (let offset = -halfWindow; offset <= halfWindow; offset += 1) {
      const neighborIndex = index + offset;
      if (neighborIndex >= 0 && neighborIndex < bins.length) {
        smoothedWeight += bins[neighborIndex].totalWeight;
        weightSum += 1;
      }
    }

    return {
      center: bin.center,
      totalWeight: smoothedWeight / weightSum,
    };
  });
}

function findPeaks(bins: { center: number; totalWeight: number }[], minWeightRatio = 0.08) {
  if (bins.length < 3) return bins.length ? [bins[0]] : [];

  const maxWeight = Math.max(...bins.map((b) => b.totalWeight));
  const threshold = maxWeight * minWeightRatio;
  const peaks: { center: number; totalWeight: number }[] = [];

  for (let i = 1; i < bins.length - 1; i += 1) {
    if (
      bins[i].totalWeight >= threshold &&
      bins[i].totalWeight >= bins[i - 1].totalWeight &&
      bins[i].totalWeight >= bins[i + 1].totalWeight
    ) {
      peaks.push(bins[i]);
    }
  }

  if (!peaks.length && bins.length) {
    const maxIndex = bins.findIndex((b) => b.totalWeight === maxWeight);
    peaks.push(bins[maxIndex]);
  }

  return peaks.sort((a, b) => b.totalWeight - a.totalWeight);
}

function assignClusterLabel(
  clusterSize: number,
  bodySize: number,
  clusterWeight: number,
  allPeaks: { center: number; totalWeight: number }[],
): FontSizeCluster["label"] {
  const ratio = clusterSize / bodySize;

  if (ratio < 0.85) return "tiny";
  if (ratio >= 1.4) return "heading1";
  if (ratio >= 1.15) return "heading2";
  if (ratio >= 1.05) return "heading3";
  return "body";
}

export function analyzeFontSizes(tokens: Token[]): FontSizeAnalysis {
  const tokenFontSizes = tokens.map((t) => ({
    size: t.fontSize,
    weight: Math.max(1, t.text.length),
  }));

  const { bins } = buildHistogram(tokenFontSizes);
  const smoothed = smoothHistogram(bins);
  const peaks = findPeaks(smoothed);

  if (!peaks.length || !tokens.length) {
    const fallback = median(tokens.map((t) => t.fontSize)) || 12;
    return {
      bodyFontSize: fallback,
      clusters: [{
        label: "body" as const,
        minSize: fallback * 0.85,
        maxSize: fallback * 1.15,
        representativeSize: fallback,
        tokenCount: tokens.length,
      }],
      headingThresholds: {
        h1Min: fallback * 1.35,
        h2Min: fallback * 1.18,
        h3Min: fallback * 1.08,
      },
    };
  }

  const dominantPeak = peaks.reduce((a, b) =>
    a.totalWeight > b.totalWeight ? a : b,
  );
  const bodyFontSize = dominantPeak.center;

  const clusters: FontSizeCluster[] = [];

  for (const peak of peaks.sort((a, b) => a.center - b.center)) {
    const label = assignClusterLabel(peak.center, bodyFontSize, peak.totalWeight, peaks);
    const binRange = smoothed.filter((b) => {
      const minNeighbor = Math.min(...smoothed.map((s) => s.totalWeight));
      const maxWeight = Math.max(...smoothed.map((s) => s.totalWeight));
      return b.totalWeight >= minNeighbor + (maxWeight - minNeighbor) * 0.15;
    });

    const clusterMin = binRange.length ? Math.min(...binRange.map((b) => b.center)) : peak.center - 0.5;
    const clusterMax = binRange.length ? Math.max(...binRange.map((b) => b.center)) : peak.center + 0.5;

    clusters.push({
      label,
      minSize: clusterMin,
      maxSize: clusterMax,
      representativeSize: peak.center,
      tokenCount: Math.round(peak.totalWeight),
    });
  }

  const heading1Cluster = clusters.find((c) => c.label === "heading1");
  const heading2Cluster = clusters.find((c) => c.label === "heading2");
  const heading3Cluster = clusters.find((c) => c.label === "heading3");

  const h1Min = heading1Cluster ? heading1Cluster.minSize : bodyFontSize * 1.35;
  const h2Min = heading2Cluster ? heading2Cluster.minSize : bodyFontSize * 1.18;
  const h3Min = heading3Cluster ? heading3Cluster.minSize : bodyFontSize * 1.08;

  return {
    bodyFontSize,
    clusters,
    headingThresholds: { h1Min, h2Min, h3Min },
  };
}

export function computeDocumentStats(pages: PageModel[]): DocumentStats {
  const allTokens = pages.flatMap((page) => page.tokens);
  const fontSizeAnalysis = analyzeFontSizes(allTokens);
  const bodyFontSize = fontSizeAnalysis.bodyFontSize;

  const lines = pages.flatMap((page) => page.lines);
  const usefulLines = lines.filter((line) => line.text.length > 2);
  const pageWidth = median(pages.map((page) => page.width)) || 1;
  const pageHeight = median(pages.map((page) => page.height)) || 1;
  const lineGaps: number[] = [];

  for (const page of pages) {
    const pageLines = page.lines
      .filter((line) => line.avgFontSize <= bodyFontSize * 1.25)
      .sort((a, b) => a.baseline - b.baseline);

    for (let index = 1; index < pageLines.length; index += 1) {
      const gap = pageLines[index].bbox.y0 - pageLines[index - 1].bbox.y1;
      if (gap > 0 && gap < bodyFontSize * 4) {
        lineGaps.push(gap);
      }
    }
  }

  return {
    bodyFontSize,
    medianLineGap: median(lineGaps) || bodyFontSize * 0.35,
    bodyLeft: percentile(usefulLines.map((line) => line.left), 10),
    bodyRight: percentile(usefulLines.map((line) => line.right), 90),
    pageWidth,
    pageHeight,
    fontSizeAnalysis,
  };
}
