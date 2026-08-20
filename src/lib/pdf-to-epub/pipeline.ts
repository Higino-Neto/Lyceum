import { PDF_TO_EPUB_CHECKLIST } from "./checklist";
import { packageEpub, buildChapterFiles } from "./epub";
import { buildFontProfile, classifyTokenStyle } from "./fontAnalysis";
import {
  buildLines,
  computeDocumentStats,
  extractImageCandidatesFromPdfJsPage,
  extractTokensFromPdfJsPage,
} from "./geometry";
import { renderDefaultCss, renderSectionToXhtml } from "./html";
import { applyReadingOrder } from "./layout";
import { removeNoiseLines } from "./noise";
import { buildParagraphs } from "./paragraphs";
import { buildSections, groupListItems, paragraphToBlock } from "./semantics";
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
  const firstMeaningful = sections.find((section) => section.title && section.title !== "Inicio");
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
<html xmlns="http://www.w3.org/1999/xhtml" lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=${Math.round(page.width)},height=${Math.round(page.height)}" />
  <title>${title}</title>
  <link rel="stylesheet" type="text/css" href="../styles/book.css" />
</head>
<body class="fixed-page">
  <img class="page-image" src="../${asset.href}" alt="${title}" />
  <div class="page-text" aria-label="Texto extraido da pagina">${text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br />")}</div>
</body>
</html>`,
  };
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
      text: `Imagem da pagina ${candidate.pageNumber}`,
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
  const blocks = groupListItems(sortBlocksByPageGeometry([...textBlocks, ...imageBlocks]));
  const sections = buildSections(blocks);

  return {
    stats,
    pages: orderedPages,
    paragraphs,
    blocks,
    sections,
  };
}

export async function convertPdfToEpub(
  pdfData: ArrayBuffer,
  options: ConvertPdfToEpubOptions = {},
) {
  // PDF.js may transfer and detach the supplied ArrayBuffer. Keep the original
  // available for deterministic identifiers and later integrity reporting.
  const pages = await parsePdfToPages(pdfData.slice(0), options);
  const mode: "reflow" | "fixed-layout" = options.mode === "fixed-layout"
    || (options.mode !== "reflow" && Boolean(options.renderImageAsset))
    ? "fixed-layout"
    : "reflow";
  const warnings = pages
    .filter((page) => page.requiresOcr)
    .map((page) => `Pagina ${page.pageNumber} tem pouco texto extraido e pode precisar de OCR.`);
  if (mode === "fixed-layout") {
    if (!options.renderImageAsset) throw new Error("O modo fixed-layout exige um renderizador de paginas PDF.");
    const renderedPages = await Promise.all(pages.map(async (page) => ({
      page,
      asset: await options.renderImageAsset!(fixedLayoutCandidate(page)),
    })));
    const missingPages = renderedPages.filter((item) => !item.asset).map((item) => item.page.pageNumber);
    if (missingPages.length) throw new Error(`Falha ao preservar as paginas PDF: ${missingPages.join(", ")}.`);
    const completePages = renderedPages as Array<{ page: PageModel; asset: import("./types").EpubAsset }>;
    const metadata = buildMetadata(pdfData, [], options);
    const chapters = completePages.map(({ page, asset }) => renderFixedLayoutChapter(page, asset));
    const epub = await packageEpub({
      metadata,
      chapters,
      css: fixedLayoutCss(),
      assets: completePages.map((item) => item.asset),
      layout: "pre-paginated",
    });
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
  const renderedImagePairs = options.renderImageAsset
    ? (
        await Promise.all(
          imageCandidates.map(async (candidate) => ({
            candidate,
            asset: await options.renderImageAsset?.(candidate),
          })),
        )
      ).filter((pair): pair is { candidate: (typeof imageCandidates)[number]; asset: import("./types").EpubAsset } =>
        Boolean(pair.asset),
      )
    : [];
  const imageBlocks = buildImageBlocks(
    renderedImagePairs.map((pair) => pair.asset),
    renderedImagePairs.map((pair) => pair.candidate),
  );
  const structure = reconstructStructureFromPages(pages, imageBlocks);
  const metadata = buildMetadata(pdfData, structure.sections, options);
  const chapters = buildChapterFiles(structure.sections, renderSectionToXhtml);
  const epub = await packageEpub({
    metadata,
    chapters,
    css: renderDefaultCss(),
    assets: renderedImagePairs.map((pair) => pair.asset),
  });

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
