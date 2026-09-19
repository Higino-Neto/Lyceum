import { clusterIntoLines, type ClusterLine, type LayerRect } from "./geometry";

export interface TextItemSeed {
  key: string;
  text: string;
  rects: LayerRect[];
}

export interface TextItem extends TextItemSeed {
  start: number;
  end: number;
  lineIndex: number;
}

export interface TextLine extends ClusterLine {
  items: TextItem[];
}

export interface TextLayerModel {
  signature: string;
  textLength: number;
  items: TextItem[];
  lines: TextLine[];
}

/**
 * Builds a stable text-layer model from per-text-node seeds. Items are laid
 * out in document order with global offsets, clustered into visual lines and
 * given final line indices. The `signature` is an opaque cache key supplied by
 * the caller (e.g. childCount+textLength+size) and is returned as-is.
 *
 * Pure: relies only on the geometries already present in each seed.
 */
export function buildTextLayerModel(
  seeds: TextItemSeed[],
  signature: string,
): TextLayerModel {
  let cursor = 0;
  const items: TextItem[] = [];

  for (const seed of seeds) {
    const start = cursor;
    const textLength = seed.text.length;
    const item: TextItem = {
      key: seed.key,
      text: seed.text,
      rects: seed.rects,
      start,
      end: start + textLength,
      lineIndex: -1,
    };
    cursor = item.end;
    items.push(item);
  }

  const lines = clusterIntoLines(items) as TextLine[];

  lines.sort((a, b) => a.center - b.center || a.left - b.left);
  lines.forEach((line, index) => {
    line.items.sort((first, second) => first.start - second.start);
    for (const item of line.items) {
      item.lineIndex = index;
    }
  });

  return {
    signature,
    textLength: cursor,
    items,
    lines,
  };
}