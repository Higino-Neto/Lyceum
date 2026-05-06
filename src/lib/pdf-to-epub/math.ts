import type { BBox } from "./types";

export function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

export function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function percentile(values: number[], p: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = clamp(p / 100, 0, 1) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

export function weightedAverage<T>(
  items: T[],
  value: (item: T) => number,
  weight: (item: T) => number,
) {
  let weightedSum = 0;
  let totalWeight = 0;

  for (const item of items) {
    const itemWeight = Math.max(0, weight(item));
    weightedSum += value(item) * itemWeight;
    totalWeight += itemWeight;
  }

  return totalWeight ? weightedSum / totalWeight : 0;
}

export function combineBBoxes(boxes: BBox[]): BBox {
  if (!boxes.length) {
    return { x0: 0, y0: 0, x1: 0, y1: 0, width: 0, height: 0 };
  }

  const x0 = Math.min(...boxes.map((box) => box.x0));
  const y0 = Math.min(...boxes.map((box) => box.y0));
  const x1 = Math.max(...boxes.map((box) => box.x1));
  const y1 = Math.max(...boxes.map((box) => box.y1));

  return { x0, y0, x1, y1, width: x1 - x0, height: y1 - y0 };
}

export function textSimilarity(a: string, b: string) {
  const left = a.trim().toLowerCase();
  const right = b.trim().toLowerCase();
  if (!left && !right) return 1;
  if (!left || !right) return 0;
  if (left === right) return 1;

  const maxLength = Math.max(left.length, right.length);
  let matches = 0;
  const seen = new Set<number>();

  for (const char of left) {
    const index = right.indexOf(char);
    if (index >= 0 && !seen.has(index)) {
      matches += 1;
      seen.add(index);
    }
  }

  return matches / maxLength;
}
