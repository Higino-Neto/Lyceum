export type PdfReaderTheme = "paper" | "sepia" | "night";
export type PdfReaderLayout = "continuous" | "page";

export interface PdfOutlineItem {
  title: string;
  dest?: string | unknown[];
  url?: string | null;
  items?: PdfOutlineItem[];
}

export interface FlatPdfOutlineItem extends PdfOutlineItem {
  depth: number;
  id: string;
}

export interface PdfReaderPreferences {
  theme: PdfReaderTheme;
  layout: PdfReaderLayout;
  brightness: number;
}

export const DEFAULT_PDF_READER_PREFERENCES: PdfReaderPreferences = {
  theme: "paper",
  layout: "continuous",
  brightness: 100,
};

export function clampPdfValue(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function formatPdfProgress(page: number, pageCount: number) {
  if (pageCount < 1) return 0;
  return Math.round(clampPdfValue(page / pageCount, 0, 1) * 100);
}

export function formatPdfFileSize(bytes?: number) {
  if (!bytes || bytes < 1) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
}

export function flattenPdfOutline(
  items: PdfOutlineItem[] | null | undefined,
  depth = 0,
  parentId = "outline",
): FlatPdfOutlineItem[] {
  if (!items?.length) return [];
  return items.flatMap((item, index) => {
    const id = `${parentId}-${index}`;
    const current: FlatPdfOutlineItem = { ...item, depth, id };
    return [current, ...flattenPdfOutline(item.items, depth + 1, id)];
  });
}

export function getPdfStorageId(fingerprint?: string, fallback = "document") {
  const safe = String(fingerprint || fallback)
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 96);
  return safe || "document";
}

export function parseStoredPdfBookmarks(value: string | null, pageCount: number) {
  if (!value || pageCount < 1) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed
      .map((page) => Number(page))
      .filter((page) => Number.isInteger(page) && page >= 1 && page <= pageCount))]
      .sort((left, right) => left - right);
  } catch {
    return [];
  }
}

export function parsePdfReaderPreferences(value: string | null): PdfReaderPreferences {
  if (!value) return DEFAULT_PDF_READER_PREFERENCES;
  try {
    const parsed = JSON.parse(value) as Partial<PdfReaderPreferences>;
    return {
      theme: parsed.theme === "sepia" || parsed.theme === "night" ? parsed.theme : "paper",
      layout: parsed.layout === "page" ? "page" : "continuous",
      brightness: clampPdfValue(Number(parsed.brightness) || 100, 55, 100),
    };
  } catch {
    return DEFAULT_PDF_READER_PREFERENCES;
  }
}
