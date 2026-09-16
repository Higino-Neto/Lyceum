export type ByteRange = { start: number; end: number };
export type InvalidByteRange = { unsatisfiable: true };

/** Parse one HTTP byte range, including suffix ranges, for local PDF streaming. */
export function parseByteRange(header: string | null, size: number): ByteRange | InvalidByteRange | null {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || size <= 0 || (!match[1] && !match[2])) return { unsatisfiable: true };
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start > end || start >= size) {
    return { unsatisfiable: true };
  }
  return { start, end };
}
