import fs from "node:fs";

export interface RenderPdfPageOptions {
  scale?: number;
  maxDimension?: number;
}

export interface RenderedPdfPage {
  data: Buffer;
  width: number;
  height: number;
  pageCount: number;
}

let pdfJsPromise: Promise<typeof import("pdfjs-dist/legacy/build/pdf.mjs")> | null = null;
let canvasPromise: Promise<typeof import("@napi-rs/canvas")> | null = null;

async function loadCanvas() {
  try {
    canvasPromise ||= import("@napi-rs/canvas");
    return await canvasPromise;
  } catch (error) {
    canvasPromise = null;
    throw new Error(
      `Nao foi possivel carregar o renderer nativo de thumbnails PDF: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

async function loadPdfJs() {
  const { DOMMatrix, ImageData, Path2D } = await loadCanvas();
  if (!("DOMMatrix" in globalThis)) {
    Object.defineProperty(globalThis, "DOMMatrix", { configurable: true, value: DOMMatrix });
  }
  if (!("ImageData" in globalThis)) {
    Object.defineProperty(globalThis, "ImageData", { configurable: true, value: ImageData });
  }
  if (!("Path2D" in globalThis)) {
    Object.defineProperty(globalThis, "Path2D", { configurable: true, value: Path2D });
  }
  pdfJsPromise ||= import("pdfjs-dist/legacy/build/pdf.mjs");
  return pdfJsPromise;
}

export async function renderPdfPageToPng(
  pdfPath: string,
  pageNumber: number,
  options: RenderPdfPageOptions = {},
): Promise<RenderedPdfPage> {
  if (!Number.isInteger(pageNumber) || pageNumber < 1) {
    throw new Error(`Numero de pagina PDF invalido: ${pageNumber}`);
  }

  const pdfjs = await loadPdfJs();
  const { createCanvas } = await loadCanvas();
  const bytes = new Uint8Array(await fs.promises.readFile(pdfPath));
  const loadingTask = pdfjs.getDocument({
    data: bytes,
    isEvalSupported: false,
    useSystemFonts: true,
  });
  const document = await loadingTask.promise;

  try {
    if (pageNumber > document.numPages) {
      throw new Error(`Pagina ${pageNumber} nao existe no PDF (${document.numPages} paginas)`);
    }

    const page = await document.getPage(pageNumber);
    try {
      const requestedScale = Math.max(0.1, options.scale ?? 2);
      const initialViewport = page.getViewport({ scale: requestedScale });
      const maxDimension = Math.max(256, options.maxDimension ?? 3200);
      const dimensionScale = Math.min(
        1,
        maxDimension / Math.max(initialViewport.width, initialViewport.height),
      );
      const viewport = dimensionScale < 1
        ? page.getViewport({ scale: requestedScale * dimensionScale })
        : initialViewport;
      const width = Math.max(1, Math.ceil(viewport.width));
      const height = Math.max(1, Math.ceil(viewport.height));
      const canvas = createCanvas(width, height);
      const canvasContext = canvas.getContext("2d");

      await page.render({
        canvasContext: canvasContext as unknown as CanvasRenderingContext2D,
        viewport,
        background: "#ffffff",
      }).promise;

      return {
        data: canvas.toBuffer("image/png"),
        width,
        height,
        pageCount: document.numPages,
      };
    } finally {
      page.cleanup();
    }
  } finally {
    await document.destroy();
  }
}

/**
 * Renders several pages while parsing the document only once — used for page
 * thumbnails, where reopening the PDF per page would dominate the cost.
 * Pages outside the document are skipped.
 */
export async function renderPdfPagesToPng(
  pdfPath: string,
  pageNumbers: number[],
  options: RenderPdfPageOptions = {},
): Promise<Array<RenderedPdfPage & { pageNumber: number }>> {
  const pdfjs = await loadPdfJs();
  const { createCanvas } = await loadCanvas();
  const bytes = new Uint8Array(await fs.promises.readFile(pdfPath));
  const document = await pdfjs.getDocument({ data: bytes, isEvalSupported: false, useSystemFonts: true }).promise;
  const results: Array<RenderedPdfPage & { pageNumber: number }> = [];

  try {
    for (const pageNumber of pageNumbers) {
      if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > document.numPages) continue;
      const page = await document.getPage(pageNumber);
      try {
        const initialViewport = page.getViewport({ scale: Math.max(0.1, options.scale ?? 1) });
        const maxDimension = Math.max(64, options.maxDimension ?? 512);
        const fit = Math.min(1, maxDimension / Math.max(initialViewport.width, initialViewport.height));
        const viewport = fit < 1 ? page.getViewport({ scale: Math.max(0.1, options.scale ?? 1) * fit }) : initialViewport;
        const width = Math.max(1, Math.ceil(viewport.width));
        const height = Math.max(1, Math.ceil(viewport.height));
        const canvas = createCanvas(width, height);
        await page.render({
          canvasContext: canvas.getContext("2d") as unknown as CanvasRenderingContext2D,
          viewport,
          background: "#ffffff",
        }).promise;
        results.push({ pageNumber, data: canvas.toBuffer("image/png"), width, height, pageCount: document.numPages });
      } finally {
        page.cleanup();
      }
    }
  } finally {
    await document.destroy();
  }
  return results;
}
