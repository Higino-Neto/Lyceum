import fs from "node:fs";
import {
  analyzeExercises,
  type ExerciseAnalysis,
  type ExerciseLine,
  type ExerciseOutlineEntry,
  type ExercisePageText,
} from "../../src/core/pdf/exercise-detection";
import { loadPdfJs } from "./pdf-page-renderer";

type Progress = (progress: number, message?: string) => void;

interface TextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
}

interface OutlineNode {
  title: string;
  dest: string | unknown[] | null;
  items?: OutlineNode[];
}

/**
 * Groups pdf.js text items into visual lines (top to bottom). Items on the
 * same baseline separated by a wide gap — two columns — become separate lines
 * so numbered items in the right column are still seen as line starts.
 */
export function itemsToLines(items: TextItem[], pageHeight: number, convert: (x: number, y: number) => [number, number]): ExerciseLine[] {
  const placed = items
    .filter((item) => typeof item.str === "string" && item.str.trim())
    .map((item) => {
      const [x, y] = convert(item.transform[4] ?? 0, item.transform[5] ?? 0);
      const size = Math.hypot(item.transform[2] ?? 0, item.transform[3] ?? 0) || item.height || 10;
      return { text: item.str, x, y, size, width: Math.abs(item.width) };
    })
    .sort((a, b) => a.y - b.y || a.x - b.x);

  const rows: Array<typeof placed> = [];
  for (const item of placed) {
    const row = rows[rows.length - 1];
    const reference = row?.[0];
    if (row && reference && Math.abs(item.y - reference.y) <= Math.max(2, Math.min(item.size, reference.size) * 0.5)) row.push(item);
    else rows.push([item]);
  }

  const lines: ExerciseLine[] = [];
  for (const row of rows) {
    row.sort((a, b) => a.x - b.x);
    let text = "";
    let size = 0;
    let end = -Infinity;
    let y = row[0]!.y;
    const flush = () => {
      if (text.trim()) lines.push({ text: text.replace(/\s+/g, " ").trim(), size, top: Math.min(1, Math.max(0, y / Math.max(1, pageHeight))) });
      text = "";
      size = 0;
    };
    for (const item of row) {
      const gap = item.x - end;
      if (text && gap > item.size * 3) flush();
      if (text && gap > item.size * 0.15 && !text.endsWith(" ") && !item.text.startsWith(" ")) text += " ";
      text += item.text;
      if (item.text.trim()) size = Math.max(size, item.size);
      end = item.x + item.width;
      y = item.y;
    }
    flush();
  }
  return lines;
}

export async function analyzePdfExercises(filePath: string, onProgress?: Progress): Promise<ExerciseAnalysis> {
  const pdfjs = await loadPdfJs();
  const bytes = new Uint8Array(await fs.promises.readFile(filePath));
  const document = await pdfjs.getDocument({ data: bytes, isEvalSupported: false, useSystemFonts: true, disableFontFace: true }).promise;
  try {
    const outline: ExerciseOutlineEntry[] = [];
    const walk = async (nodes: OutlineNode[] | null | undefined, depth: number) => {
      for (const node of nodes ?? []) {
        try {
          const dest = typeof node.dest === "string" ? await document.getDestination(node.dest) : node.dest;
          const ref = Array.isArray(dest) ? dest[0] : null;
          if (ref !== null && ref !== undefined) {
            const pageIndex = typeof ref === "number" ? ref : await document.getPageIndex(ref as Parameters<typeof document.getPageIndex>[0]);
            outline.push({ title: node.title || "", pageIndex, depth });
          }
        } catch {
          /* Broken destinations are skipped. */
        }
        if (depth < 4) await walk(node.items, depth + 1);
      }
    };
    await walk(await document.getOutline().catch(() => null) as OutlineNode[] | null, 0);

    const pages: ExercisePageText[] = [];
    const total = document.numPages;
    for (let pageNumber = 1; pageNumber <= total; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      try {
        const viewport = page.getViewport({ scale: 1 });
        const content = await page.getTextContent();
        const lines = itemsToLines(
          content.items as unknown as TextItem[],
          viewport.height,
          (x, y) => viewport.convertToViewportPoint(x, y) as [number, number],
        );
        pages.push({ lines });
      } catch {
        pages.push({ lines: [] });
      } finally {
        page.cleanup();
      }
      if (pageNumber % 10 === 0 || pageNumber === total) {
        onProgress?.(0.95 * (pageNumber / total), `Lendo página ${pageNumber} de ${total}`);
      }
    }
    onProgress?.(0.97, "Procurando exercícios");
    return analyzeExercises({ pages, outline });
  } finally {
    await document.destroy();
  }
}
