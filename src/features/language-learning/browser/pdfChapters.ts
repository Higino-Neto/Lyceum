import type { RawBook, RawChapter } from "./sourceChapters";
import { chapterRanges, pageParagraphs, renderPdfChapterXhtml, type PdfChapterRange, type PdfTextItem } from "./pdfText";

/**
 * Reads a PDF's text layer in the browser (pdf.js, already used by the mobile
 * PDF reader) and splits it into chapters by the PDF outline, or into groups
 * of pages when there is none. Scanned PDFs without text are rejected with
 * NO_TEXTUAL_CONTENT, like on desktop.
 */
interface OutlineNode {
  title: string;
  dest: string | unknown[] | null;
  items?: OutlineNode[];
}

interface PdfDocumentLike {
  numPages: number;
  getPage(pageNumber: number): Promise<{ getTextContent(): Promise<{ items: unknown[] }>; cleanup?(): void }>;
  getOutline(): Promise<OutlineNode[] | null>;
  getDestination(id: string): Promise<unknown[] | null>;
  getPageIndex(ref: unknown): Promise<number>;
  getMetadata(): Promise<{ info?: Record<string, unknown> } | null>;
  destroy(): Promise<void>;
}

async function outlineStarts(pdf: PdfDocumentLike): Promise<PdfChapterRange[]> {
  const outline = await pdf.getOutline().catch(() => null);
  if (!outline?.length) return [];
  // A single top-level entry (the book title) usually wraps the real chapters.
  const entries = outline.length === 1 && outline[0]!.items?.length ? outline[0]!.items! : outline;
  const starts: PdfChapterRange[] = [];
  for (const entry of entries) {
    try {
      const dest = typeof entry.dest === "string" ? await pdf.getDestination(entry.dest) : entry.dest;
      const ref = Array.isArray(dest) ? dest[0] : null;
      if (ref === null || ref === undefined) continue;
      const start = typeof ref === "number" ? ref : await pdf.getPageIndex(ref);
      starts.push({ title: (entry.title || "").trim(), start });
    } catch {
      /* Broken destinations are skipped. */
    }
  }
  return starts;
}

export async function readPdfChapters(
  bytes: Uint8Array,
  fallbackTitle: string,
  pageLabel: (from: number, to: number) => string,
  onProgress?: (value: number) => void,
): Promise<RawBook> {
  const [pdfjs, { default: workerUrl }] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.mjs?url"),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  let pdf: PdfDocumentLike;
  try {
    pdf = await pdfjs.getDocument({ data: bytes, disableFontFace: true, isEvalSupported: false }).promise as unknown as PdfDocumentLike;
  } catch {
    throw new Error("INVALID_FILE");
  }

  try {
    const pageCount = pdf.numPages;
    const pages: string[][] = [];
    let characters = 0;
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const paragraphs = pageParagraphs(content.items.filter((item): item is PdfTextItem => typeof (item as PdfTextItem).str === "string"));
      characters += paragraphs.reduce((sum, text) => sum + text.length, 0);
      pages.push(paragraphs);
      page.cleanup?.();
      onProgress?.(pageNumber / pageCount);
      // Keep the WebView responsive on long books.
      if (pageNumber % 8 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
    }
    // Fewer than ~40 characters per page: a scan or an image-only PDF.
    if (characters < Math.max(200, pageCount * 40)) throw new Error("NO_TEXTUAL_CONTENT");

    const ranges = chapterRanges(await outlineStarts(pdf), pageCount, pageLabel);
    const chapters: RawChapter[] = [];
    ranges.forEach((range, index) => {
      const end = ranges[index + 1]?.start ?? pageCount;
      const paragraphs = pages.slice(range.start, end).flat();
      if (paragraphs.length === 0) return;
      const title = range.title || pageLabel(range.start + 1, end);
      const id = `pdf-chapter-${String(index + 1).padStart(3, "0")}`;
      chapters.push({ id, href: `${id}.xhtml`, title, xhtml: renderPdfChapterXhtml(title, paragraphs) });
    });
    if (chapters.length === 0) throw new Error("NO_TEXTUAL_CONTENT");

    const info = (await pdf.getMetadata().catch(() => null))?.info ?? {};
    const title = typeof info.Title === "string" && info.Title.trim() ? info.Title.trim() : fallbackTitle;
    const language = typeof info.Language === "string" && info.Language.trim() ? info.Language.trim() : null;
    return { title, metadataLanguage: language, chapters };
  } finally {
    void pdf.destroy().catch(() => undefined);
  }
}
