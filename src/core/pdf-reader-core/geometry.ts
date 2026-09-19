export interface Bounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface SourceRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface LayerRect extends SourceRect {
  width: number;
  height: number;
}

export interface PageRatioRect {
  page: number;
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface ClusterItem {
  rects: LayerRect[];
  lineIndex: number; // defined by clusterIntoLines
}

export interface ClusterLine {
  center: number;
  threshold: number;
  top: number;
  bottom: number;
  left: number;
  right: number;
  items: ClusterItem[];
}

export interface MergeRect extends SourceRect {}

export interface MergeLine {
  center: number;
  threshold: number;
  top: number;
  bottom: number;
  rects: MergeRect[];
}

/**
 * Converts a DOM rect into layer-local coordinates, clamped to the layer
 * bounds. Returns null when the projected rect is too small to be meaningful.
 */
export function makeLayerRect(
  rect: SourceRect,
  layerBounds: Bounds,
): LayerRect | null {
  const left = Math.max(0, rect.left - layerBounds.left);
  const top = Math.max(0, rect.top - layerBounds.top);
  const right = Math.min(layerBounds.width, rect.right - layerBounds.left);
  const bottom = Math.min(layerBounds.height, rect.bottom - layerBounds.top);
  const width = right - left;
  const height = bottom - top;

  if (width < 0.5 || height < 0.5) {
    return null;
  }

  return { left, top, right, bottom, width, height };
}

/**
 * Clusters items into horizontal lines by vertical center proximity. Each item
 * receives its line index; the returned lines are sorted top-to-bottom.
 *
 * @param items items clustered by their first rect center; `lineIndex` is set
 *   as a side effect. Callers must re-read the same array afterwards.
 */
export function clusterIntoLines(items: ClusterItem[]): ClusterLine[] {
  const lines: ClusterLine[] = [];
  for (const item of items) {
    const rect = item.rects[0];
    if (!rect) {
      continue; // noUncheckedIndexedAccess: a cluster item always carries one.
    }

    const center = (rect.top + rect.bottom) / 2;
    const threshold = Math.max(2, Math.min(8, rect.height * 0.45));
    let line = lines.find(
      candidate => Math.abs(candidate.center - center) <= candidate.threshold,
    );

    if (!line) {
      line = {
        center,
        threshold,
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
        items: [],
      };
      lines.push(line);
    }

    item.lineIndex = lines.indexOf(line);
    line.center = (line.center * line.items.length + center) / (line.items.length + 1);
    line.top = Math.min(line.top, rect.top);
    line.bottom = Math.max(line.bottom, rect.bottom);
    line.left = Math.min(line.left, ...item.rects.map(itemRect => itemRect.left));
    line.right = Math.max(line.right, ...item.rects.map(itemRect => itemRect.right));
    line.items.push(item);
  }

  return lines;
}

/**
 * Merges selection rects into contiguous per-line intervals, insetting each
 * rect vertically so adjacent lines do not visually bleed into each other.
 */
export function mergeSelectionRects(rects: LayerRect[]): Bounds[] {
  if (rects.length <= 1) {
    return rects;
  }

  const sorted = rects
    .map(rect => {
      const verticalInset = Math.min(1.5, rect.height * 0.12);
      return {
        left: rect.left,
        top: rect.top + verticalInset,
        right: rect.left + rect.width,
        bottom: rect.top + rect.height - verticalInset,
      };
    })
    .filter(rect => rect.right - rect.left >= 0.5 && rect.bottom - rect.top >= 0.5)
    .sort((a, b) => (a.top + a.bottom) / 2 - (b.top + b.bottom) / 2 || a.left - b.left);

  const lines: MergeLine[] = [];
  for (const rect of sorted) {
    const center = (rect.top + rect.bottom) / 2;
    const line = lines.find(candidate => Math.abs(candidate.center - center) <= candidate.threshold);

    if (line) {
      line.center = (line.center * line.rects.length + center) / (line.rects.length + 1);
      line.top = Math.min(line.top, rect.top);
      line.bottom = Math.max(line.bottom, rect.bottom);
      line.rects.push(rect);
    } else {
      const height = rect.bottom - rect.top;
      lines.push({
        center,
        threshold: Math.max(2, Math.min(7, height * 0.35)),
        top: rect.top,
        bottom: rect.bottom,
        rects: [rect],
      });
    }
  }

  const merged: Bounds[] = [];
  for (const line of lines) {
    const intervals = line.rects.sort((a, b) => a.left - b.left);
    let current: { left: number; right: number } | null = null;

    for (const rect of intervals) {
      if (!current) {
        current = { left: rect.left, right: rect.right };
        continue;
      }

      if (rect.left <= current.right + 1.5) {
        current.right = Math.max(current.right, rect.right);
      } else {
        merged.push({
          left: current.left,
          top: line.top,
          width: current.right - current.left,
          height: line.bottom - line.top,
        });
        current = { left: rect.left, right: rect.right };
      }
    }

    if (current) {
      merged.push({
        left: current.left,
        top: line.top,
        width: current.right - current.left,
        height: line.bottom - line.top,
      });
    }
  }

  return merged;
}

/**
 * Projects layer-local rects into page-relative coordinates (fractions of the
 * page width/height) so select/highlight geometry survives zoom changes.
 * Degenerate page bounds produce no projections.
 */
export function projectRectsToPage(
  rects: Bounds[],
  layerBounds: Bounds,
  pageBounds: Bounds,
  page: number,
): PageRatioRect[] {
  if (pageBounds.width <= 0 || pageBounds.height <= 0) {
    return [];
  }

  const projected: PageRatioRect[] = [];
  for (const rect of rects) {
    projected.push({
      page,
      left: (layerBounds.left + rect.left - pageBounds.left) / pageBounds.width,
      top: (layerBounds.top + rect.top - pageBounds.top) / pageBounds.height,
      width: rect.width / pageBounds.width,
      height: rect.height / pageBounds.height,
    });
  }

  return projected;
}