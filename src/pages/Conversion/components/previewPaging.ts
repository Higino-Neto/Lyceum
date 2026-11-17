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
