import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import JSZip from "jszip";
import type sharpType from "sharp";
import type { BookFormat, LyceumConversionOptions } from "../../src/lib/lyceum";
import { extractCbzPage } from "../../src/lib/lyceum/importers/cbzImporter";
import { optimizeImageBytes, resolveImageSettings } from "../../src/lib/lyceum/images/imageOptimizer";
import type { ConversionPreviewResult } from "./conversion-preview-types";

export type { ConversionPreviewResult } from "./conversion-preview-types";

const require = createRequire(import.meta.url);

export const CONVERSION_PREVIEW_TEMP_PREFIX = "lyceum-conversion-preview-";

export interface ConversionPreviewInput {
  sourcePath: string;
  sourceFormat: BookFormat;
  /** Zero-based page/image index. */
  pageIndex: number;
  conversionOptions?: LyceumConversionOptions;
  /** Directory where the short-lived preview folder is created (app temp dir). */
  tempRoot: string;
}


const EPUB_IMAGE_EXTENSIONS: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
};

interface SourcePage {
  data: Uint8Array;
  mediaType: string;
  pageCount: number;
  pageIndex: number;
}

async function readEpubImage(sourcePath: string, pageIndex: number): Promise<SourcePage | null> {
  const zip = await JSZip.loadAsync(await fs.promises.readFile(sourcePath));
  const images = Object.values(zip.files)
    .filter((entry) => !entry.dir && EPUB_IMAGE_EXTENSIONS[path.posix.extname(entry.name).toLowerCase()])
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  if (images.length === 0) return null;
  const index = Math.min(images.length - 1, Math.max(0, Math.floor(pageIndex)));
  const entry = images[index];
  const mediaType = entry ? EPUB_IMAGE_EXTENSIONS[path.posix.extname(entry.name).toLowerCase()] : undefined;
  if (!entry || !mediaType) return null;
  return {
    data: await entry.async("uint8array"),
    mediaType,
    pageCount: images.length,
    pageIndex: index,
  };
}

async function readSourcePage(input: ConversionPreviewInput): Promise<SourcePage | null> {
  if (input.sourceFormat === "cbz") {
    const page = await extractCbzPage(input.sourcePath, input.pageIndex);
    if (!page) return null;
    return {
      data: page.data,
      mediaType: page.mediaType,
      pageCount: page.pageCount,
      pageIndex: Math.min(page.pageCount - 1, Math.max(0, Math.floor(input.pageIndex))),
    };
  }
  if (input.sourceFormat === "pdf") {
    const { renderPdfPageToPng } = await import("./pdf-page-renderer");
    const pageNumber = Math.max(1, Math.floor(input.pageIndex) + 1);
    try {
      const rendered = await renderPdfPageToPng(input.sourcePath, pageNumber, { scale: 2, maxDimension: 3200 });
      return { data: rendered.data, mediaType: "image/png", pageCount: rendered.pageCount, pageIndex: pageNumber - 1 };
    } catch (error) {
      if (pageNumber === 1) throw error;
      const first = await renderPdfPageToPng(input.sourcePath, 1, { scale: 2, maxDimension: 3200 });
      return { data: first.data, mediaType: "image/png", pageCount: first.pageCount, pageIndex: 0 };
    }
  }
  if (input.sourceFormat === "epub") return readEpubImage(input.sourcePath, input.pageIndex);
  throw new Error(`Preview de imagem indisponivel para ${input.sourceFormat.toUpperCase()}.`);
}

function isPathInside(basePath: string, targetPath: string) {
  const relative = path.relative(path.resolve(basePath), path.resolve(targetPath));
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

/**
 * Renders one page with the current image settings. The processed bytes are written to a
 * throwaway folder (exactly what the exporter will embed), read back and the folder is removed.
 */
export async function renderConversionPreview(input: ConversionPreviewInput): Promise<ConversionPreviewResult> {
  const page = await readSourcePage(input);
  if (!page) throw new Error("Nenhuma imagem encontrada para gerar o preview.");

  const sourceBytes = (await fs.promises.stat(input.sourcePath)).size;
  const settings = resolveImageSettings(input.conversionOptions);
  const original = Buffer.from(page.data.buffer, page.data.byteOffset, page.data.byteLength);
  const sharp = require("sharp") as typeof sharpType;
  const originalMeta = await sharp(original).metadata();
  const processed = settings
    ? await optimizeImageBytes(original, page.mediaType, settings)
    : { data: original, mediaType: page.mediaType, width: originalMeta.width || 0, height: originalMeta.height || 0, changed: false };

  await fs.promises.mkdir(input.tempRoot, { recursive: true });
  const tempDir = await fs.promises.mkdtemp(path.join(input.tempRoot, CONVERSION_PREVIEW_TEMP_PREFIX));
  try {
    const extension = processed.mediaType === "image/png" ? "png" : processed.mediaType === "image/jpeg" ? "jpg" : "img";
    const tempFile = path.join(tempDir, `page-${page.pageIndex + 1}.${extension}`);
    await fs.promises.writeFile(tempFile, processed.data);
    const written = await fs.promises.readFile(tempFile);
    const ratio = original.byteLength > 0 ? written.byteLength / original.byteLength : 1;

    return {
      dataUrl: `data:${processed.mediaType};base64,${written.toString("base64")}`,
      mediaType: processed.mediaType,
      width: processed.width,
      height: processed.height,
      bytes: written.byteLength,
      originalBytes: original.byteLength,
      originalWidth: originalMeta.width || 0,
      originalHeight: originalMeta.height || 0,
      pageIndex: page.pageIndex,
      pageCount: page.pageCount,
      sourceBytes,
      // PDF sources render pages, so a byte ratio against the rasterised page is meaningless.
      estimatedTotalBytes: input.sourceFormat === "pdf" ? 0 : Math.round(sourceBytes * Math.min(ratio, 1.5)),
      optimized: processed.changed,
    };
  } finally {
    if (isPathInside(input.tempRoot, tempDir)) {
      await fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}

/** Removes preview folders left behind by a crash. */
export async function cleanupStaleConversionPreviews(tempRoot: string) {
  const entries = await fs.promises.readdir(tempRoot, { withFileTypes: true }).catch(() => []);
  await Promise.all(entries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(CONVERSION_PREVIEW_TEMP_PREFIX))
    .map((entry) => fs.promises.rm(path.join(tempRoot, entry.name), { recursive: true, force: true }).catch(() => undefined)));
}
