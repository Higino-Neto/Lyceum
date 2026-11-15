import { PDF_TO_EPUB_CHECKLIST } from "./checklist";
import { packageEpub, buildChapterFiles } from "./epub";
import { buildFontProfile, classifyTokenStyle } from "./fontAnalysis";
import {
  buildLines,
  computeDocumentStats,
  extractImageCandidatesFromPdfJsPage,
  extractTokensFromPdfJsPage,
} from "./geometry";
import { repairPrivateUseGlyphs } from "./glyphRepair";
import { PdfPageMarkerTracker, renderDefaultCss, renderSectionToXhtml } from "./html";
import { pageAnchorHtml, pageAnchorId } from "../lyceum/pagination/pageAnchors";
import { escapeXml } from "./text";
import { applyReadingOrder } from "./layout";
import { removeNoiseLines } from "./noise";
import { buildParagraphs } from "./paragraphs";
import { groupListItems, paragraphToBlock } from "./semantics";
import { buildOutlineSections, mergeHeadingRuns, type OutlineSection } from "./structure";
import type { EpubTocEntry } from "./epub";
import type {
  Block,
  ConversionReport,
  ConvertPdfToEpubOptions,
  EpubMetadata,
  PageModel,
  Section,
  Token,
} from "./types";

type PdfJsModule = {
  getDocument(args: {
    data: Uint8Array;
    useSystemFonts?: boolean;
    disableFontFace?: boolean;
  }): {
    promise: Promise<{
      numPages: number;
      getPage(pageNumber: number): Promise<unknown>;
    }>;
  };
  GlobalWorkerOptions?: {
    workerSrc?: string;
  };
  OPS?: Record<string, number>;
};

let pdfWorkerReady: Promise<void> | null = null;

async function ensurePdfJsWorkerLoaded() {
  pdfWorkerReady ??= import("pdfjs-dist/legacy/build/pdf.worker.mjs").then((workerModule) => {
    const worker = workerModule as {
      WorkerMessageHandler?: unknown;
    };

    if (!worker.WorkerMessageHandler) {
      throw new Error("PDF.js worker module loaded without WorkerMessageHandler.");
    }

    (globalThis as typeof globalThis & {
      pdfjsWorker?: {
        WorkerMessageHandler?: unknown;
      };
    }).pdfjsWorker = {
      WorkerMessageHandler: worker.WorkerMessageHandler,
    };
  });

  return pdfWorkerReady;
}

async function loadPdfJs(): Promise<PdfJsModule> {
  const pdfjs = (await import("pdfjs-dist/legacy/build/pdf.mjs")) as PdfJsModule;
  await ensurePdfJsWorkerLoaded();

  return pdfjs;
}

function createIdentifier(data: ArrayBuffer) {
  const bytes = new Uint8Array(data);
  let hash = 0x811c9dc5;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193);
  }
  return `urn:lyceum:pdf:${data.byteLength.toString(16)}:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function inferTitle(sections: Section[], fallback = "Documento convertido") {
  const firstMeaningful = sections.find((section) => section.title && !(section as OutlineSection).front);
  return firstMeaningful?.title || fallback;
}

function buildMetadata(
  data: ArrayBuffer,
  sections: Section[],
  options: ConvertPdfToEpubOptions,
): EpubMetadata {
  return {
    title: options.title || inferTitle(sections),
    author: options.author,
    publisher: options.publisher,
    description: options.description,
    language: options.language || "pt-BR",
    identifier: options.identifier || createIdentifier(data),
    modified: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
  };
}

function summarizeConfidence(blocks: Block[]) {
  const scores = blocks.map((block) => block.confidence ?? 0.5);
  const average = scores.length
    ? scores.reduce((sum, score) => sum + score, 0) / scores.length
    : 0;

  return {
    average,
    lowConfidenceBlocks: scores.filter((score) => score < 0.6).length,
  };
}

function buildReport(args: {
  pages: PageModel[];
  sections: Section[];
  blocks: Block[];
  warnings: string[];
  mode?: "reflow" | "fixed-layout";
  preservedPageImages?: number;
}): ConversionReport {
  return {
    checklist: PDF_TO_EPUB_CHECKLIST,
    pageCount: args.pages.length,
    sectionCount: args.sections.length,
    blockCount: args.blocks.length,
    confidence: summarizeConfidence(args.blocks),
    warnings: args.warnings,
    mode: args.mode,
    preservedPageImages: args.preservedPageImages,
    fidelityMode: args.mode === "fixed-layout" ? "fixed-layout-visual" : "reflowable-semantic",
  };
}

function fixedLayoutCandidate(page: PageModel): import("./types").ImageCandidate {
  return {
    id: `page-${String(page.pageNumber).padStart(4, "0")}`,
    pageNumber: page.pageNumber,
    bbox: { x0: 0, y0: 0, x1: page.width, y1: page.height, width: page.width, height: page.height },
    pageWidth: page.width,
    pageHeight: page.height,
    confidence: 1,
  };
}

function renderFixedLayoutChapter(page: PageModel, asset: import("./types").EpubAsset) {
  const title = `Pagina ${page.pageNumber}`;
  const text = page.orderedLines.map((line) => line.text).filter(Boolean).join("\n");
  return {
    id: `page-${String(page.pageNumber).padStart(4, "0")}`,
    href: `text/page-${String(page.pageNumber).padStart(4, "0")}.xhtml`,
    title,
    xhtml: `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=${Math.round(page.width)},height=${Math.round(page.height)}" />
  <title>${title}</title>
  <link rel="stylesheet" type="text/css" href="../styles/book.css" />
</head>
<body class="fixed-page">
  ${pageAnchorHtml(String(page.pageNumber))}
  <img class="page-image" src="../${asset.href}" alt="${title}" />
  <div class="page-text" aria-label="Texto extraido da pagina">${escapeXml(text).replace(/\n/g, "<br />")}</div>
</body>
</html>`,
  };
}

function renderCoverPage(title: string, imageHref: string, markers: string, language = "pt-BR") {
  return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${escapeXml(language)}">
<head>
  <meta charset="utf-8" />
  <title>${escapeXml(title)}</title>
  <link rel="stylesheet" type="text/css" href="../styles/book.css" />
</head>
<body class="cover-page">
<section epub:type="cover">
${markers}<img class="cover-image" src="${escapeXml(imageHref)}" alt="${escapeXml(title)}" />
</section>
</body>
</html>`;
}

function fixedLayoutCss() {
  return `@page { margin: 0; }
html, body { margin: 0; padding: 0; width: 100%; height: 100%; }
body.fixed-page { position: relative; overflow: hidden; background: white; }
.page-image { display: block; width: 100%; height: 100%; object-fit: contain; }
.page-text { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: pre-wrap; }`;
}

function shouldRenderImageCandidate(candidate: import("./types").ImageCandidate) {
  const areaRatio = (candidate.bbox.width * candidate.bbox.height) / Math.max(1, candidate.pageWidth * candidate.pageHeight);
  return areaRatio >= 0.015 && candidate.bbox.width >= 48 && candidate.bbox.height >= 48;
}

function buildImageBlocks(assets: import("./types").EpubAsset[], candidates: import("./types").ImageCandidate[]): Block[] {
  return assets.map<Block>((asset, index) => {
    const candidate = candidates[index];
    return {
      type: "image",
      children: [],
      pageRange: {
        start: candidate.pageNumber,
        end: candidate.pageNumber,
      },
      text: "",
      bbox: candidate.bbox,
      confidence: candidate.confidence,
      attrs: {
        src: `../${asset.href}`,
      },
    };
  });
}

function sortBlocksByPageGeometry(blocks: Block[]) {
  const getBlockStart = (block: Block) => {
    const firstParagraph = block.children.find((child) => "lines" in child);
    const firstLine = firstParagraph && "lines" in firstParagraph
      ? firstParagraph.lines[0]
      : undefined;

    return {
      page: firstLine?.pageNumber ?? block.pageRange.start,
      y: firstLine?.bbox.y0 ?? block.bbox?.y0 ?? 0,
      x: firstLine?.bbox.x0 ?? block.bbox?.x0 ?? 0,
    };
  };

  return [...blocks].sort((a, b) => {
    const aStart = getBlockStart(a);
    const bStart = getBlockStart(b);
    const pageDelta = aStart.page - bStart.page;
    if (pageDelta) return pageDelta;
    const yDelta = aStart.y - bStart.y;
    if (Math.abs(yDelta) > 1) return yDelta;
    return aStart.x - bStart.x;
  });
}

export async function parsePdfToPages(
  pdfData: ArrayBuffer,
  options: Pick<ConvertPdfToEpubOptions, "minTextTokensPerPage"> = {},
): Promise<PageModel[]> {
  const pdfjs = await loadPdfJs();
  const pdf = await pdfjs.getDocument({
    data: new Uint8Array(pdfData),
    useSystemFonts: true,
    disableFontFace: false,
  }).promise;
  const pages: PageModel[] = [];
  const minTextTokensPerPage = options.minTextTokensPerPage ?? 4;

  const allTokens: Token[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const extracted = await extractTokensFromPdfJsPage(page as Parameters<typeof extractTokensFromPdfJsPage>[0], pageNumber);
    allTokens.push(...extracted.tokens);

    pages.push({
      pageNumber,
      width: extracted.width,
      height: extracted.height,
      tokens: extracted.tokens,
      lines: [],
      orderedLines: [],
      requiresOcr: extracted.tokens.length < minTextTokensPerPage,
      imageCandidates: await extractImageCandidatesFromPdfJsPage(
        page as Parameters<typeof extractImageCandidatesFromPdfJsPage>[0],
        {
          pageNumber,
          width: extracted.width,
          height: extracted.height,
          ops: pdfjs.OPS,
        },
      ),
    });
  }

  const fontProfile = buildFontProfile(allTokens);

  for (const token of allTokens) {
    const style = classifyTokenStyle(token, fontProfile);
    token.bold = style.bold;
    token.italic = style.italic;
  }

  for (const page of pages) {
    page.lines = buildLines(page.tokens);
    page.orderedLines = page.lines;
  }

  return pages;
}

export function reconstructStructureFromPages(
  pages: PageModel[],
  imageBlocks: Block[] = [],
) {
  const initialStats = computeDocumentStats(pages);
  const cleanedPages = removeNoiseLines(pages, initialStats);
  const stats = computeDocumentStats(cleanedPages);
  const orderedPages = applyReadingOrder(cleanedPages, stats);
  const orderedLines = orderedPages.flatMap((page) => page.orderedLines);
  const paragraphs = buildParagraphs(orderedLines, stats);
  const textBlocks = paragraphs.map((paragraph) => paragraphToBlock(paragraph, stats));
  const blocks = mergeHeadingRuns(groupListItems(sortBlocksByPageGeometry([...textBlocks, ...imageBlocks])));
  const sections = buildOutlineSections(blocks);

  return {
    stats,
    pages: orderedPages,
    paragraphs,
    blocks,
    sections,
  };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(Math.max(1, concurrency), items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await mapper(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * "auto" keeps text PDFs reflowable (adjustable font, real page markers) and
 * only preserves pages as images when the PDF is mostly scanned/drawn pages
 * (comics, scans) and a page renderer is available.
 */
export function choosePdfEpubMode(
  pages: Array<Pick<PageModel, "requiresOcr">>,
  options: Pick<ConvertPdfToEpubOptions, "mode" | "renderImageAsset">,
): "reflow" | "fixed-layout" {
  if (options.mode === "fixed-layout") return "fixed-layout";
  if (options.mode === "reflow" || !options.renderImageAsset || pages.length === 0) return "reflow";
  const imagePages = pages.filter((page) => page.requiresOcr).length;
  return imagePages / pages.length >= 0.5 ? "fixed-layout" : "reflow";
}

export async function convertPdfToEpub(
  pdfData: ArrayBuffer,
  options: ConvertPdfToEpubOptions = {},
) {
  // PDF.js may transfer and detach the supplied ArrayBuffer. Keep the original
  // available for deterministic identifiers and later integrity reporting.
  const pages = await parsePdfToPages(pdfData.slice(0), options);
  const repairedGlyphs = repairPrivateUseGlyphs(pages);
  options.onProgress?.(0.12, `${pages.length} paginas analisadas`);
  const mode = choosePdfEpubMode(pages, options);
  const warnings = pages
    .filter((page) => page.requiresOcr)
    .map((page) => `Pagina ${page.pageNumber} tem pouco texto extraido e pode precisar de OCR.`);
  if (repairedGlyphs.size > 0) {
    warnings.push(`Ligaduras sem Unicode reconstruidas: ${Array.from(repairedGlyphs.values()).join(", ")}.`);
  }
  if (mode === "fixed-layout") {
    if (!options.renderImageAsset) throw new Error("O modo fixed-layout exige um renderizador de paginas PDF.");
    let renderedPageCount = 0;
    const renderedPages = await mapWithConcurrency(pages, 3, async (page) => {
      const asset = await options.renderImageAsset!(fixedLayoutCandidate(page));
      renderedPageCount += 1;
      options.onProgress?.(
        0.12 + (0.78 * renderedPageCount) / Math.max(1, pages.length),
        `Renderizando pagina ${renderedPageCount} de ${pages.length}`,
      );
      return { page, asset };
    });
    const missingPages = renderedPages.filter((item) => !item.asset).map((item) => item.page.pageNumber);
    if (missingPages.length) throw new Error(`Falha ao preservar as paginas PDF: ${missingPages.join(", ")}.`);
    const completePages = renderedPages as Array<{ page: PageModel; asset: import("./types").EpubAsset }>;
    if (completePages[0]) completePages[0].asset.properties = "cover-image";
    const metadata = buildMetadata(pdfData, [], options);
    const chapters = completePages.map(({ page, asset }) => renderFixedLayoutChapter(page, asset));
    const epub = await packageEpub({
      metadata,
      chapters,
      css: fixedLayoutCss(),
      assets: completePages.map((item) => item.asset),
      layout: "pre-paginated",
      pageList: completePages.map(({ page }, index) => ({
        label: String(page.pageNumber),
        href: `${chapters[index].href}#${pageAnchorId(String(page.pageNumber))}`,
      })),
    });
    options.onProgress?.(0.96, "Validando pacote EPUB");
    return {
      epub,
      report: buildReport({
        pages,
        sections: [],
        blocks: [],
        warnings: [
          ...warnings,
          "Layout fixo usado para preservar integralmente a aparencia de cada pagina; uma camada textual acessivel foi mantida.",
        ],
        mode,
        preservedPageImages: completePages.length,
      }),
    };
  }

  const imageCandidates = pages
    .flatMap((page) => page.imageCandidates || [])
    .filter(shouldRenderImageCandidate);
  let renderedImageCount = 0;
  const renderedImagePairs = options.renderImageAsset
    ? (
        await mapWithConcurrency(
          imageCandidates,
          3,
          async (candidate) => {
            const asset = await options.renderImageAsset?.(candidate);
            renderedImageCount += 1;
            options.onProgress?.(
              0.2 + (0.65 * renderedImageCount) / Math.max(1, imageCandidates.length),
              `Preservando imagem ${renderedImageCount} de ${imageCandidates.length}`,
            );
            return { candidate, asset };
          },
        )
      ).filter((pair): pair is { candidate: (typeof imageCandidates)[number]; asset: import("./types").EpubAsset } =>
        Boolean(pair.asset),
      )
    : [];
  // Cover: the Lyceum cover of a PDF is its first page, so page 1 is rendered
  // at full resolution and opens the book on its own page (no invented text).
  const firstPage = pages[0];
  const coverAsset = options.renderImageAsset && firstPage
    ? await options.renderImageAsset(fixedLayoutCandidate(firstPage)).catch(() => null)
    : null;
  if (coverAsset) {
    coverAsset.href = coverAsset.href.replace(/[^/]+$/, (name) => `cover-${name}`);
    coverAsset.properties = "cover-image";
  }
  // Page 1 art already shown by the cover page is not repeated in the text.
  const pageArea = firstPage ? firstPage.width * firstPage.height : 1;
  const firstPageArt = coverAsset
    ? renderedImagePairs.filter((pair) => pair.candidate.pageNumber === 1
      && (pair.candidate.bbox.width * pair.candidate.bbox.height) / Math.max(1, pageArea) >= 0.5)
    : [];
  const contentImagePairs = renderedImagePairs.filter((pair) => !firstPageArt.includes(pair));
  const coverIsArtOnly = firstPageArt.length > 0;
  const imageBlocks = buildImageBlocks(
    contentImagePairs.map((pair) => pair.asset),
    contentImagePairs.map((pair) => pair.candidate),
  );
  const pagesForText = coverIsArtOnly
    ? pages.map((page) => (page.pageNumber === 1 ? { ...page, lines: [], orderedLines: [], tokens: [] } : page))
    : pages;
  const structure = reconstructStructureFromPages(pagesForText, imageBlocks);
  const metadata = buildMetadata(pdfData, structure.sections, options);
  const pageTracker = new PdfPageMarkerTracker(pages.length);
  let coverChapter: { id: string; href: string; title: string; xhtml: string } | null = null;
  if (coverAsset) {
    pageTracker.setChapter(-1);
    coverChapter = {
      id: "cover",
      href: "text/cover.xhtml",
      title: metadata.title,
      xhtml: renderCoverPage(metadata.title, `../${coverAsset.href}`, pageTracker.emitThrough(1), metadata.language),
    };
  }
  const chapters = buildChapterFiles(
    structure.sections,
    (section, index) => renderSectionToXhtml(section, index, pageTracker, metadata.title),
  ).map((chapter, index) => ({
    ...chapter,
    title: structure.sections[index].title || metadata.title,
  }));
  const trailingMarkers = pageTracker.flush();
  if (trailingMarkers && chapters.length > 0) {
    const last = chapters[chapters.length - 1];
    last.xhtml = last.xhtml.replace(/<\/section>\s*<\/body>/, `${trailingMarkers}\n</section>\n</body>`);
  }
  const markerHref = (chapterIndex: number) => (chapterIndex < 0 ? coverChapter?.href : chapters[chapterIndex]?.href);
  const pageList = pageTracker.markers
    .filter((marker) => markerHref(marker.chapterIndex))
    .map((marker) => ({
      label: String(marker.page),
      href: `${markerHref(marker.chapterIndex)}#${marker.anchorId}`,
    }));
  const toc: EpubTocEntry[] = structure.sections.flatMap((section, index) => (
    (section as OutlineSection).front || !section.title
      ? []
      : [{ href: chapters[index].href, title: section.title, level: section.level }]
  ));
  const allChapters = coverChapter ? [coverChapter, ...chapters] : chapters;
  const epub = await packageEpub({
    metadata,
    chapters: allChapters,
    pageList,
    toc: coverChapter ? [{ href: coverChapter.href, title: metadata.title, level: 1 }, ...toc] : toc,
    css: renderDefaultCss({
      lineHeight: options.lineHeight,
      paragraphSpacing: options.paragraphSpacing,
    }),
    assets: [...(coverAsset ? [coverAsset] : []), ...contentImagePairs.map((pair) => pair.asset)],
  });
  options.onProgress?.(0.96, "Validando pacote EPUB");

  return {
    epub,
    report: buildReport({
      pages: structure.pages,
      sections: structure.sections,
      blocks: structure.blocks,
      warnings,
      mode,
      preservedPageImages: renderedImagePairs.length,
    }),
  };
}
