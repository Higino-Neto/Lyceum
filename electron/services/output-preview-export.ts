import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { BookFormat, LyceumConversionOptions, LyceumPackage, LyceumTextualContent } from "../../src/lib/lyceum";
import type { OutputPreviewSegmentKind } from "./output-preview-types";

/**
 * Worker side of the conversion preview: imports the source once (cached on
 * disk, shared by every worker), cuts out a single chapter (or comic page) and
 * exports just that slice with the real exporter and the user's options.
 * The main process then renders the result exactly as the reader would see it.
 */

export interface OutputPreviewExportInput {
  sourcePath: string;
  sourceFormat: BookFormat;
  targetFormat: BookFormat;
  conversionOptions?: LyceumConversionOptions;
  /** Zero-based chapter (textual) or page (comic) index. */
  segmentIndex: number;
  /** Where imported packages are cached between previews. */
  cacheRoot: string;
  /** Fresh folder that receives the exported slice. */
  outputDir: string;
  /** PDF sources rasterize image assets through this callback (same as a real conversion). */
  renderImageAsset?: unknown;
}

export interface OutputPreviewExportResult {
  /** What the main process has to render. "html" is printed to PDF when the target is PDF. */
  kind: "pdf" | "epub" | "html" | "txt";
  outputPath: string;
  segmentKind: OutputPreviewSegmentKind;
  segmentIndex: number;
  segmentCount: number;
  segmentTitle: string;
  /** Chapter document inside an exported EPUB, used to pick what to render. */
  chapterHref?: string;
  fixedLayout: boolean;
}

const PREVIEW_MARKER = ".lyceum-preview-ready";

function importKey(input: OutputPreviewExportInput, stats: fs.Stats) {
  const options = input.conversionOptions || {};
  // Only the PDF importer reads conversion options (reflow vs. fixed layout and spacing).
  const importOptions = input.sourceFormat === "pdf"
    ? [options.epubLayout, options.epubLineHeight, options.epubParagraphSpacingEm]
    : [];
  return crypto
    .createHash("sha1")
    .update(JSON.stringify([path.resolve(input.sourcePath), stats.size, stats.mtimeMs, input.sourceFormat, importOptions]))
    .digest("hex")
    .slice(0, 24);
}

async function loadPackage(input: OutputPreviewExportInput): Promise<LyceumPackage> {
  const lyceum = await import("../../src/lib/lyceum");
  const stats = await fs.promises.stat(input.sourcePath);
  const packageRoot = path.join(input.cacheRoot, importKey(input, stats));
  if (fs.existsSync(path.join(packageRoot, PREVIEW_MARKER))) {
    try {
      return lyceum.readLyceumPackage(packageRoot);
    } catch {
      // Corrupt cache: fall through and import again.
    }
  }
  await fs.promises.rm(packageRoot, { recursive: true, force: true });
  await fs.promises.mkdir(packageRoot, { recursive: true });
  const importer = lyceum.createDefaultConversionRegistry().getImporter(input.sourceFormat);
  if (!importer) throw new Error(`Formato de origem sem suporte: ${input.sourceFormat.toUpperCase()}`);
  const imported = await importer.import({
    sourcePath: input.sourcePath,
    sourceFormat: input.sourceFormat,
    packageRoot,
    conversionOptions: input.conversionOptions,
    renderImageAsset: input.renderImageAsset,
  });
  await fs.promises.writeFile(path.join(packageRoot, PREVIEW_MARKER), new Date().toISOString());
  return imported.package;
}

function readingOrder(textual: LyceumTextualContent) {
  const linear = textual.spine.filter((item) => item.linear !== false);
  return linear.length ? linear : textual.spine;
}

function baseHref(href: string) {
  return decodeURIComponent(href.split("#")[0] || "").toLowerCase();
}

/** Keeps one chapter plus the resources it can use (styles, fonts and the images it references). */
function sliceTextual(pkg: LyceumPackage, segmentIndex: number) {
  const textual = pkg.textual!;
  const order = readingOrder(textual);
  if (order.length === 0) throw new Error("O livro nao possui capitulos para pre-visualizar.");
  const index = Math.min(order.length - 1, Math.max(0, Math.floor(segmentIndex)));
  const item = order[index]!;
  const chapter = textual.chapters.find((candidate) => baseHref(candidate.href) === baseHref(item.href) || candidate.id === item.id);
  if (!chapter) throw new Error("Capitulo nao encontrado no pacote.");
  const xhtml = chapter.xhtml.toLowerCase();
  const resources = (textual.resources || []).filter((resource) => {
    if (!resource.mediaType.startsWith("image/")) return true;
    const name = path.posix.basename(resource.href).toLowerCase();
    return xhtml.includes(name) || xhtml.includes(encodeURIComponent(name).toLowerCase());
  });
  const sliced: LyceumPackage = {
    ...pkg,
    textual: {
      chapters: [chapter],
      spine: [item],
      toc: textual.toc.filter((entry) => baseHref(entry.href) === baseHref(chapter.href)),
      fulltext: "",
      resources,
    },
  };
  const title = item.title || chapter.title || textual.toc.find((entry) => baseHref(entry.href) === baseHref(chapter.href))?.title || "";
  return { sliced, index, count: order.length, title, chapterHref: chapter.href };
}

function sliceComic(pkg: LyceumPackage, segmentIndex: number) {
  const comic = pkg.comic!;
  if (comic.pages.length === 0) throw new Error("O arquivo nao possui paginas.");
  const index = Math.min(comic.pages.length - 1, Math.max(0, Math.floor(segmentIndex)));
  const page = comic.pages[index]!;
  // Comic packages also carry fixed-layout XHTML pages and the image resources: keep only this page's.
  const imageName = path.posix.basename(page.resourceHref || page.href).toLowerCase();
  const textual = pkg.textual;
  const chapters = textual?.chapters.filter((chapter) => chapter.xhtml.toLowerCase().includes(imageName)) ?? [];
  const chapterHrefs = new Set(chapters.map((chapter) => baseHref(chapter.href)));
  const sliced: LyceumPackage = {
    ...pkg,
    textual: textual ? {
      chapters,
      spine: textual.spine.filter((item) => chapterHrefs.has(baseHref(item.href))),
      toc: textual.toc.filter((entry) => chapterHrefs.has(baseHref(entry.href))),
      fulltext: "",
      resources: (textual.resources || []).filter((resource) =>
        !resource.mediaType.startsWith("image/") || path.posix.basename(resource.href).toLowerCase() === imageName),
    } : undefined,
    comic: { pages: [page], pageCount: 1, totalBytes: page.byteLength },
  };
  return { sliced, index, count: comic.pages.length, title: page.title || "" };
}

export async function exportOutputPreview(input: OutputPreviewExportInput): Promise<OutputPreviewExportResult> {
  const lyceum = await import("../../src/lib/lyceum");
  const { optimizePackageImages, resolveImageSettings } = await import("../../src/lib/lyceum/images/imageOptimizer");
  const pkg = await loadPackage(input);
  const comic = Boolean(pkg.comic?.pageCount);
  const slice = comic ? sliceComic(pkg, input.segmentIndex) : sliceTextual(pkg, input.segmentIndex);

  let exportPackage = lyceum.preparePackageForExport(slice.sliced, input.conversionOptions);
  const imageSettings = resolveImageSettings(input.conversionOptions);
  if (imageSettings) exportPackage = (await optimizePackageImages(exportPackage, imageSettings)).pkg;

  // Kindle formats are built from the same content as EPUB; the slice is shown as an EPUB on a
  // Kindle-sized screen. Textual PDF goes through HTML because Chromium paginates it.
  const target = input.targetFormat;
  const exportFormat: BookFormat =
    target === "pdf" ? (comic ? "pdf" : "html")
      : target === "html" ? "html"
        : target === "txt" ? "txt"
          : "epub";
  const kind: OutputPreviewExportResult["kind"] = exportFormat === "pdf" ? "pdf" : exportFormat === "epub" ? "epub" : exportFormat === "txt" ? "txt" : "html";

  const exporter = lyceum.createDefaultConversionRegistry().getExporter(exportFormat);
  if (!exporter) throw new Error(`Pre-visualizacao indisponivel para ${target.toUpperCase()}.`);
  const capability = exporter.canExport(exportPackage);
  if (!capability.supported) throw new Error(capability.reason || `Pre-visualizacao indisponivel para ${target.toUpperCase()}.`);

  await fs.promises.mkdir(input.outputDir, { recursive: true });
  const outputPath = path.join(input.outputDir, `preview.${exportFormat}`);
  await exporter.export({
    package: exportPackage,
    outputPath,
    metadata: exportPackage.metadata,
    conversionOptions: {
      ...input.conversionOptions,
      ...(exportFormat === "html" ? { htmlIncludeToc: false } : {}),
    },
  });

  const fixedLayout = comic || input.conversionOptions?.epubLayout === "fixed-layout";
  return {
    kind,
    outputPath,
    segmentKind: comic ? "page" : "chapter",
    segmentIndex: slice.index,
    segmentCount: slice.count,
    segmentTitle: slice.title,
    chapterHref: "chapterHref" in slice ? String(slice.chapterHref) : undefined,
    fixedLayout,
  };
}
