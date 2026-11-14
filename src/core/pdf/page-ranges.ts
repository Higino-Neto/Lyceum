/**
 * Parses page selections such as "1-3, 7, 10-" (1-based, inclusive) into
 * zero-based page indices, preserving the typed order. "10-" runs to the last
 * page, "-3" starts at the first and "5-1" walks backwards.
 */
export function parsePageRanges(spec: string, pageCount: number): number[] {
  const indices: number[] = [];
  for (const rawPart of spec.split(/[,;]+/)) {
    const part = rawPart.replace(/\s+/g, "");
    if (!part) continue;
    const match = part.match(/^(\d*)-(\d*)$|^(\d+)$/);
    if (!match || part === "-") throw new Error(`"${rawPart.trim()}"`);
    const start = match[3] ? Number(match[3]) : match[1] ? Number(match[1]) : 1;
    const end = match[3] ? Number(match[3]) : match[2] ? Number(match[2]) : pageCount;
    if (start < 1 || end < 1 || start > pageCount || end > pageCount) {
      throw new Error(`"${rawPart.trim()}" (1-${pageCount})`);
    }
    const step = start <= end ? 1 : -1;
    for (let page = start; step > 0 ? page <= end : page >= end; page += step) indices.push(page - 1);
  }
  if (indices.length === 0) throw new Error("—");
  return indices;
}
