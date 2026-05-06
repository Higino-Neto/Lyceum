import { clamp, median, percentile } from "./math";
import type { ColumnRegion, DocumentStats, Line, PageLayout, PageModel } from "./types";

function clusterCenters(lines: Line[], pageWidth: number) {
  const sorted = [...lines].sort((a, b) => a.center - b.center);
  if (sorted.length < 8) return [sorted];

  let bestGap = 0;
  let bestIndex = -1;

  for (let index = 1; index < sorted.length; index += 1) {
    const gap = sorted[index].center - sorted[index - 1].center;
    if (gap > bestGap) {
      bestGap = gap;
      bestIndex = index;
    }
  }

  if (bestGap < Math.max(28, pageWidth * 0.08) || bestIndex < 0) {
    return [sorted];
  }

  const left = sorted.slice(0, bestIndex);
  const right = sorted.slice(bestIndex);
  const minClusterSize = Math.max(3, sorted.length * 0.2);

  if (left.length < minClusterSize || right.length < minClusterSize) {
    return [sorted];
  }

  return [left, right];
}

function buildColumnRegion(id: number, lines: Line[]): ColumnRegion {
  return {
    id,
    x0: percentile(lines.map((line) => line.left), 5),
    x1: percentile(lines.map((line) => line.right), 95),
    lines,
  };
}

function detectFullWidthLines(lines: Line[], contentLeft: number, contentRight: number, stats?: DocumentStats) {
  const contentWidth = contentRight - contentLeft;
  const bodyFontLimit = stats?.fontSizeAnalysis?.headingThresholds.h3Min ?? median(lines.map((l) => l.avgFontSize)) * 1.25;

  return lines.filter((line) => {
    const lineWidth = line.right - line.left;
    return lineWidth >= contentWidth * 0.78 || line.avgFontSize > bodyFontLimit;
  });
}

export function detectColumns(page: PageModel, stats: DocumentStats): PageLayout {
  const bodyLimit = stats.fontSizeAnalysis?.headingThresholds.h3Min ?? stats.bodyFontSize * 1.25;
  const bodyCandidates = page.lines.filter((line) => {
    const width = line.right - line.left;
    const nearVerticalEdge =
      line.bbox.y0 < page.height * 0.08 || line.bbox.y1 > page.height * 0.92;

    return (
      !nearVerticalEdge &&
      line.text.length > 8 &&
      width > page.width * 0.12 &&
      line.avgFontSize <= bodyLimit
    );
  });

  if (bodyCandidates.length < 8) {
    return {
      columnCount: 1,
      columns: [buildColumnRegion(0, [...page.lines])],
      confidence: 0.4,
      mode: "single",
    };
  }

  const contentLeft = percentile(bodyCandidates.map((line) => line.left), 5);
  const contentRight = percentile(bodyCandidates.map((line) => line.right), 95);
  const clusters = clusterCenters(bodyCandidates, page.width);

  if (clusters.length === 1) {
    return {
      columnCount: 1,
      columns: [buildColumnRegion(0, [...page.lines])],
      confidence: 0.72,
      mode: "single",
    };
  }

  const columns = clusters
    .map((cluster, index) => buildColumnRegion(index, cluster))
    .sort((a, b) => a.x0 - b.x0);
  const gutter = columns[1].x0 - columns[0].x1;
  if (gutter <= Math.max(16, page.width * 0.035)) {
    return {
      columnCount: 1,
      columns: [buildColumnRegion(0, [...page.lines])],
      confidence: 0.62,
      mode: "single",
    };
  }

  const fullWidthLines = detectFullWidthLines(page.lines, contentLeft, contentRight, stats);
  const confidence = clamp(
    0.45 +
      clamp(gutter / Math.max(1, page.width * 0.12)) * 0.35 +
      clamp(Math.min(...clusters.map((cluster) => cluster.length)) / bodyCandidates.length / 0.35) * 0.2,
  );

  return {
    columnCount: columns.length,
    columns,
    confidence,
    mode: fullWidthLines.length ? "mixed" : "multi",
  };
}

function lineBelongsToColumn(line: Line, column: ColumnRegion) {
  const overlap = Math.min(line.right, column.x1) - Math.max(line.left, column.x0);
  const lineWidth = Math.max(1, line.right - line.left);

  return (
    overlap / lineWidth > 0.35 ||
    Math.abs(line.center - (column.x0 + column.x1) / 2) < (column.x1 - column.x0) * 0.75 ||
    (line.left >= column.x0 - lineWidth * 0.25 && line.left <= column.x1 + lineWidth * 0.15)
  );
}

function nearestColumn(line: Line, columns: ColumnRegion[]) {
  return [...columns].sort((a, b) => {
    const aCenter = (a.x0 + a.x1) / 2;
    const bCenter = (b.x0 + b.x1) / 2;
    return Math.abs(line.center - aCenter) - Math.abs(line.center - bCenter);
  })[0];
}

function spansMultipleColumns(line: Line, columns: ColumnRegion[]) {
  const contentLeft = columns[0].x0;
  const contentRight = columns[columns.length - 1].x1;
  const contentWidth = Math.max(1, contentRight - contentLeft);
  const lineWidth = line.right - line.left;
  const overlaps = columns.filter((column) => {
    const overlap = Math.min(line.right, column.x1) - Math.max(line.left, column.x0);
    return overlap > Math.min(lineWidth, column.x1 - column.x0) * 0.18;
  }).length;

  return lineWidth > contentWidth * 0.78 && overlaps > 1;
}

export function orderLinesForPage(page: PageModel, layout = page.layout ?? detectColumns(page, {
  bodyFontSize: 12,
  medianLineGap: 4,
  bodyLeft: 0,
  bodyRight: page.width,
  pageWidth: page.width,
  pageHeight: page.height,
})) {
  if (layout.columnCount <= 1 || layout.confidence < 0.68) {
    return [...page.lines].sort((a, b) => a.baseline - b.baseline || a.left - b.left);
  }

  const assigned = new Set<Line>();
  const fullWidth: Line[] = [];
  const columnLines = layout.columns.map((column) => ({
    ...column,
    lines: [] as Line[],
  }));

  for (const line of page.lines) {
    const spansColumns = spansMultipleColumns(line, layout.columns);
    const matchingColumn =
      columnLines.find((column) => lineBelongsToColumn(line, column)) ||
      (spansColumns ? null : nearestColumn(line, columnLines));

    if (!matchingColumn || spansColumns) {
      fullWidth.push(line);
      assigned.add(line);
      continue;
    }

    matchingColumn.lines.push({ ...line, columnId: matchingColumn.id });
    assigned.add(line);
  }

  for (const line of page.lines) {
    if (!assigned.has(line)) {
      fullWidth.push(line);
    }
  }

  const ordered: Line[] = [];
  const sortedFullWidth = fullWidth.sort((a, b) => a.baseline - b.baseline || a.left - b.left);

  const baselineSortedColumns = columnLines
    .map((column) => ({
      ...column,
      lines: column.lines.sort((a, b) => a.baseline - b.baseline || a.left - b.left),
    }))
    .sort((a, b) => a.x0 - b.x0);

  const columnMinY = Math.min(
    ...baselineSortedColumns.flatMap((col) => col.lines.map((line) => line.bbox.y0)),
  );
  const columnMaxY = Math.max(
    ...baselineSortedColumns.flatMap((col) => col.lines.map((line) => line.bbox.y1)),
  );

  const topFullWidth = sortedFullWidth.filter((line) => line.bbox.y1 < columnMinY - 1);
  const bottomFullWidth = sortedFullWidth.filter((line) => line.bbox.y0 > columnMaxY + 1);
  const betweenFullWidth = sortedFullWidth.filter(
    (line) => line.bbox.y1 >= columnMinY - 1 && line.bbox.y0 <= columnMaxY + 1,
  );

  ordered.push(...topFullWidth);

  for (const column of baselineSortedColumns) {
    const columnLinesOrdered = [...column.lines];
    const interleaved: Line[] = [];

    for (const fw of betweenFullWidth) {
      const insertIndex = columnLinesOrdered.findIndex(
        (line) => line.baseline > fw.baseline,
      );
      if (insertIndex >= 0) {
        columnLinesOrdered.splice(insertIndex, 0, fw);
      } else {
        columnLinesOrdered.push(fw);
      }
    }

    ordered.push(...columnLinesOrdered);
  }

  ordered.push(...bottomFullWidth);

  return ordered;
}

export function applyReadingOrder(pages: PageModel[], stats: DocumentStats) {
  return pages.map<PageModel>((page) => {
    const layout = detectColumns(page, stats);
    return {
      ...page,
      layout,
      orderedLines: orderLinesForPage(page, layout),
    };
  });
}
