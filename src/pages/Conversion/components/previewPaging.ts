export interface Position {
  /** One-based chapter (or comic page). */
  segment: number;
  /** One-based page inside the segment. */
  page: number;
}

/**
 * Global page bookkeeping. The backend renders one chapter at a time, so the
 * final PDF's page numbers are learned as chapters are visited; until every
 * chapter is known the total is an estimate.
 */
export function computeGlobalPage(
  position: Position,
  pageCounts: Map<number, number>,
): number | null {
  let offset = 0;
  for (let segment = 1; segment < position.segment; segment += 1) {
    const count = pageCounts.get(segment);
    if (count === undefined) return null;
    offset += count;
  }
  return offset + position.page;
}

export function estimateTotalPages(pageCounts: Map<number, number>, segmentCount: number): { total: number; exact: boolean } {
  if (segmentCount <= 0) return { total: 0, exact: false };
  let known = 0;
  let sum = 0;
  for (let segment = 1; segment <= segmentCount; segment += 1) {
    const count = pageCounts.get(segment);
    if (count === undefined) continue;
    known += 1;
    sum += count;
  }
  if (known === segmentCount) return { total: sum, exact: true };
  const average = known > 0 ? sum / known : 1;
  return { total: Math.max(sum, Math.round(average * segmentCount)), exact: false };
}

/**
 * Final page number even when earlier chapters were not measured yet: unknown
 * chapters are assumed to have the average length of the measured ones.
 */
export function estimateGlobalPage(
  position: Position,
  pageCounts: Map<number, number>,
): { page: number; exact: boolean } {
  const exact = computeGlobalPage(position, pageCounts);
  if (exact !== null) return { page: exact, exact: true };
  const known = Array.from(pageCounts.values());
  const average = known.length > 0 ? known.reduce((sum, count) => sum + count, 0) / known.length : 1;
  let offset = 0;
  for (let segment = 1; segment < position.segment; segment += 1) {
    offset += pageCounts.get(segment) ?? average;
  }
  return { page: Math.max(1, Math.round(offset + position.page)), exact: false };
}

/** Up to `limit` segment numbers (one-based) spread evenly across the book. */
export function sampleSegments(segmentCount: number, limit: number): number[] {
  if (segmentCount <= 0 || limit <= 0) return [];
  if (segmentCount <= limit) return Array.from({ length: segmentCount }, (_, index) => index + 1);
  const picks = new Set<number>();
  for (let index = 0; index < limit; index += 1) {
    picks.add(1 + Math.round((index * (segmentCount - 1)) / (limit - 1)));
  }
  return Array.from(picks).sort((a, b) => a - b);
}

/**
 * Estimated size of the converted file from segments exported on their own.
 * Every slice repeats the per-file overhead (container, styles, embedded
 * fonts), so for chapter slices part of the smallest slice is treated as
 * overhead and counted once. Comic pages are almost pure image data.
 */
export function estimateOutputBytes(
  segmentBytes: Map<number, number>,
  segmentCount: number,
  segmentKind: "chapter" | "page",
): { bytes: number; exact: boolean } | null {
  const sizes = Array.from(segmentBytes.values()).filter((size) => size > 0);
  if (sizes.length === 0 || segmentCount <= 0) return null;
  const overhead = segmentKind === "chapter" && sizes.length > 1 ? Math.min(...sizes) * 0.6 : 0;
  const average = sizes.reduce((sum, size) => sum + (size - overhead), 0) / sizes.length;
  return {
    bytes: Math.max(0, Math.round(average * segmentCount + overhead)),
    exact: sizes.length >= segmentCount,
  };
}
