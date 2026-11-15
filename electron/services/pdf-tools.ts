import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";
import { PDFDocument, degrees } from "pdf-lib";
import { escapeXml } from "./book-metadata-formats";
import type {
  BuildPdfInput,
  ImagePageSize,
  ImagesToCbzInput,
  PdfToolInfo,
  PdfToolResult,
} from "./pdf-tools-types";

export type * from "./pdf-tools-types";

const require = createRequire(import.meta.url);

export type PdfToolProgress = (progress: number, message?: string) => void;

const MM_TO_PT = 72 / 25.4;
const PAGE_SIZES: Record<Exclude<ImagePageSize, "image">, [number, number]> = {
  A4: [595.28, 841.89],
  Letter: [612, 792],
};
export const PDF_TOOL_IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "gif", "bmp", "tif", "tiff", "avif"];

function loadSharp() {
  return require("sharp") as typeof import("sharp");
}

async function writeOutput(outputPath: string, data: Uint8Array | Buffer) {
  await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
  const tempPath = `${outputPath}.lyceum-tmp`;
  try {
    await fs.promises.writeFile(tempPath, data);
    await fs.promises.rename(tempPath, outputPath);
  } catch (error) {
    await fs.promises.rm(tempPath, { force: true }).catch(() => undefined);
    throw error;
  }
  return (await fs.promises.stat(outputPath)).size;
}

function requireInputs(paths: string[], minimum: number, label: string) {
  if (!Array.isArray(paths) || paths.length < minimum) {
    throw new Error(minimum > 1 ? `Selecione pelo menos ${minimum} ${label}.` : `Selecione ${label}.`);
  }
  for (const filePath of paths) {
    if (typeof filePath !== "string" || !fs.existsSync(filePath)) {
      throw new Error(`Arquivo nao encontrado: ${filePath}`);
    }
  }
}

async function loadPdf(filePath: string) {
  const pdf = await PDFDocument.load(await fs.promises.readFile(filePath), { ignoreEncryption: true, updateMetadata: false });
  if (pdf.isEncrypted) throw new Error(`O PDF "${path.basename(filePath)}" esta protegido por senha.`);
  return pdf;
}

function stampMetadata(pdf: PDFDocument, title?: string, author?: string) {
  const cleanTitle = title?.trim();
  const cleanAuthor = author?.trim();
  if (cleanTitle) pdf.setTitle(cleanTitle, { showInWindowTitleBar: true });
  if (cleanAuthor) pdf.setAuthor(cleanAuthor);
  pdf.setCreator("Lyceum");
  pdf.setProducer("Lyceum");
  pdf.setCreationDate(new Date());
  pdf.setModificationDate(new Date());
}

/**
 * Normalizes any image sharp can read into JPEG (opaque) or PNG (with
 * transparency) — the only raster formats PDF embeds natively — honouring
 * EXIF orientation.
 */
async function normalizeImage(imagePath: string) {
  const sharp = loadSharp();
  const image = sharp(imagePath, { animated: false }).rotate();
  const meta = await image.metadata();
  const orientedSwap = (meta.orientation || 1) >= 5;
  const width = (orientedSwap ? meta.height : meta.width) || 1;
  const height = (orientedSwap ? meta.width : meta.height) || 1;
  if (meta.hasAlpha) {
    return { kind: "png" as const, data: await image.png().toBuffer(), width, height, density: meta.density };
  }
  const passthrough = meta.format === "jpeg" && (meta.orientation || 1) === 1;
  const data = passthrough ? await fs.promises.readFile(imagePath) : await image.jpeg({ quality: 92, mozjpeg: true }).toBuffer();
  return { kind: "jpg" as const, data, width, height, density: meta.density };
}

/**
 * Assembles a PDF from an ordered list of pages, each taken from a PDF page or
 * an image, with an optional extra rotation. This single operation covers
 * merging, reordering, extracting, rotating and images-to-PDF.
 */
export async function buildPdf(input: BuildPdfInput, onProgress?: PdfToolProgress): Promise<PdfToolResult> {
  if (!Array.isArray(input.pages) || input.pages.length === 0) {
    throw new Error("O documento precisa ter pelo menos uma pagina.");
  }
  requireInputs(Array.from(new Set(input.pages.map((page) => page.source))), 1, "um arquivo");
  for (const page of input.pages) {
    if (![0, 90, 180, 270].includes(page.rotation)) throw new Error(`Rotacao invalida: ${page.rotation}`);
  }

  const output = await PDFDocument.create();
  stampMetadata(output, input.title, input.author);
  const margin = Math.max(0, Math.min(50, input.marginMm ?? 0)) * MM_TO_PT;
  const pdfSources = new Map<string, PDFDocument>();
  const imageCache = new Map<string, { embedded: Awaited<ReturnType<PDFDocument["embedJpg"]>>; width: number; height: number; density?: number }>();

  for (const [position, entry] of input.pages.entries()) {
    onProgress?.(position / input.pages.length, path.basename(entry.source));

    if (entry.kind === "pdf") {
      let source = pdfSources.get(entry.source);
      if (!source) {
        source = await loadPdf(entry.source);
        pdfSources.set(entry.source, source);
      }
      const index = entry.pageIndex ?? 0;
      if (!Number.isInteger(index) || index < 0 || index >= source.getPageCount()) {
        throw new Error(`Pagina ${index + 1} nao existe em "${path.basename(entry.source)}".`);
      }
      const [page] = await output.copyPages(source, [index]);
      if (entry.rotation) page!.setRotation(degrees((page!.getRotation().angle + entry.rotation) % 360));
      output.addPage(page!);
      continue;
    }

    let image = imageCache.get(entry.source);
    if (!image) {
      const normalized = await normalizeImage(entry.source);
      const embedded = normalized.kind === "png" ? await output.embedPng(normalized.data) : await output.embedJpg(normalized.data);
      image = { embedded, width: normalized.width, height: normalized.height, density: normalized.density };
      imageCache.set(entry.source, image);
    }

    let page;
    if (input.imagePageSize === "A4" || input.imagePageSize === "Letter") {
      const [shortSide, longSide] = PAGE_SIZES[input.imagePageSize];
      const landscape = image.width > image.height;
      const pageWidth = landscape ? longSide : shortSide;
      const pageHeight = landscape ? shortSide : longSide;
      const scale = Math.min(Math.max(1, pageWidth - margin * 2) / image.width, Math.max(1, pageHeight - margin * 2) / image.height);
      const width = image.width * scale;
      const height = image.height * scale;
      page = output.addPage([pageWidth, pageHeight]);
      page.drawImage(image.embedded, { x: (pageWidth - width) / 2, y: (pageHeight - height) / 2, width, height });
    } else {
      // Keep the image's physical size when it declares a DPI; otherwise assume 150 DPI.
      const dpi = image.density && image.density >= 72 ? image.density : 150;
      const width = (image.width * 72) / dpi;
      const height = (image.height * 72) / dpi;
      page = output.addPage([width, height]);
      page.drawImage(image.embedded, { x: 0, y: 0, width, height });
    }
    if (entry.rotation) page.setRotation(degrees(entry.rotation));
  }

  onProgress?.(0.95, "Gravando PDF");
  const fileSize = await writeOutput(input.outputPath, await output.save());
  return { outputPath: input.outputPath, fileSize, pageCount: output.getPageCount() };
}

export async function imagesToCbz(input: ImagesToCbzInput, onProgress?: PdfToolProgress): Promise<PdfToolResult> {
  requireInputs(input.imagePaths, 1, "ao menos uma imagem");
  const sharp = loadSharp();
  const zip = new AdmZip();
  const digits = Math.max(3, String(input.imagePaths.length).length);
  const comicReadable = new Set(["jpg", "jpeg", "png", "webp", "gif"]);

  for (const [position, imagePath] of input.imagePaths.entries()) {
    onProgress?.(position / input.imagePaths.length, path.basename(imagePath));
    const extension = path.extname(imagePath).slice(1).toLowerCase();
    const name = String(position + 1).padStart(digits, "0");
    if (comicReadable.has(extension)) {
      zip.addFile(`${name}.${extension === "jpeg" ? "jpg" : extension}`, await fs.promises.readFile(imagePath));
    } else {
      // TIFF/BMP/AVIF are not understood by most comic readers.
      zip.addFile(`${name}.jpg`, await sharp(imagePath).rotate().jpeg({ quality: 92 }).toBuffer());
    }
  }

  const title = input.title?.trim();
  const author = input.author?.trim();
  zip.addFile("ComicInfo.xml", Buffer.from(
    `<?xml version="1.0" encoding="utf-8"?>\n<ComicInfo>\n${title ? `  <Title>${escapeXml(title)}</Title>\n` : ""}${
      author ? `  <Writer>${escapeXml(author)}</Writer>\n` : ""
    }  <PageCount>${input.imagePaths.length}</PageCount>\n</ComicInfo>\n`,
    "utf8",
  ));

  onProgress?.(0.95, "Gravando CBZ");
  const fileSize = await writeOutput(input.outputPath, zip.toBuffer());
  return { outputPath: input.outputPath, fileSize, pageCount: input.imagePaths.length };
}

export async function getPdfToolInfo(filePath: string): Promise<PdfToolInfo> {
  requireInputs([filePath], 1, "um PDF");
  const pdf = await loadPdf(filePath);
  return {
    pageCount: pdf.getPageCount(),
    title: pdf.getTitle() || undefined,
    fileSize: (await fs.promises.stat(filePath)).size,
  };
}

export async function renderPdfThumbnails(
  filePath: string,
  pageNumbers: number[],
  maxDimension = 260,
): Promise<Array<{ page: number; dataUrl: string; width: number; height: number }>> {
  const { renderPdfPagesToPng } = await import("./pdf-page-renderer");
  const sharp = loadSharp();
  const rendered = await renderPdfPagesToPng(filePath, pageNumbers, { scale: 1, maxDimension });
  return Promise.all(rendered.map(async (page) => {
    const webp = await sharp(page.data).webp({ quality: 70 }).toBuffer();
    return { page: page.pageNumber, dataUrl: `data:image/webp;base64,${webp.toString("base64")}`, width: page.width, height: page.height };
  }));
}

export async function renderImageThumbnail(imagePath: string, maxDimension = 260) {
  const sharp = loadSharp();
  const image = sharp(imagePath, { animated: false }).rotate();
  const meta = await image.metadata();
  const data = await image.resize(maxDimension, maxDimension, { fit: "inside", withoutEnlargement: true }).webp({ quality: 70 }).toBuffer();
  return { dataUrl: `data:image/webp;base64,${data.toString("base64")}`, width: meta.width || 0, height: meta.height || 0 };
}
