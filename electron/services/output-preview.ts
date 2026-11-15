import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import AdmZip from "adm-zip";
import type { BrowserWindow as BrowserWindowType, Session } from "electron";
import { PDFDocument } from "pdf-lib";
import type { BookFormat, LyceumConversionOptions } from "../../src/lib/lyceum";
import type { OutputPreviewExportInput, OutputPreviewExportResult } from "./output-preview-export";
import type { OutputPreviewRequest, OutputPreviewResult } from "./output-preview-types";

export type { OutputPreviewRequest, OutputPreviewResult } from "./output-preview-types";

export const OUTPUT_PREVIEW_TEMP_PREFIX = "lyceum-output-preview-";

export interface OutputPreviewDependencies {
  tempRoot: string;
  exportSlice(input: Omit<OutputPreviewExportInput, "renderImageAsset">): Promise<OutputPreviewExportResult>;
  printHtmlToPdf(htmlPath: string, outputPath: string, options: LyceumConversionOptions): Promise<void>;
  renderPdfPage(pdfPath: string, pageNumber: number): Promise<{ dataUrl: string; width: number; height: number } | null>;
  createWindow(options: Electron.BrowserWindowConstructorOptions): BrowserWindowType;
  previewSession(): Session;
}

interface CachedSlice {
  key: string;
  dir: string;
  result: OutputPreviewExportResult;
  /** Printed PDF (PDF targets) or the extracted chapter document (EPUB/HTML/TXT). */
  renderPath: string;
  pageCount?: number;
}

/** Reading screens in CSS pixels; Kindle sizes are the device resolution at 2x. */
const SCREENS: Record<string, { width: number; height: number; label: string }> = {
  epub: { width: 600, height: 800, label: "E-reader 6\"" },
  html: { width: 760, height: 1000, label: "HTML" },
  txt: { width: 760, height: 1000, label: "TXT" },
  "legacy-paperwhite": { width: 536, height: 724, label: "Kindle Paperwhite" },
  "kindle-compatible": { width: 600, height: 800, label: "Kindle" },
  "modern-kindle": { width: 618, height: 824, label: "Kindle Paperwhite (2021+)" },
  scribe: { width: 620, height: 827, label: "Kindle Scribe" },
};
const PAGE_MARGIN = { x: 32, y: 36 };
const CACHE_LIMIT = 4;
const PRINT_TIMEOUT_MS = 90_000;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function screenFor(request: OutputPreviewRequest) {
  if (request.targetFormat === "azw3" || request.targetFormat === "kfx") {
    return SCREENS[request.conversionOptions?.kindleProfile || "legacy-paperwhite"] ?? SCREENS["legacy-paperwhite"]!;
  }
  return SCREENS[request.targetFormat] ?? SCREENS.epub!;
}

/** Options that change the exported slice; the page number does not. */
function sliceKey(sourcePath: string, stats: fs.Stats, sourceFormat: BookFormat, request: OutputPreviewRequest) {
  return crypto
    .createHash("sha1")
    .update(JSON.stringify([path.resolve(sourcePath), stats.size, stats.mtimeMs, sourceFormat, request.targetFormat, request.segmentIndex, request.conversionOptions || {}]))
    .digest("hex");
}

function findChapterDocument(rootDir: string, chapterHref?: string) {
  const container = path.join(rootDir, "META-INF", "container.xml");
  const opfRelative = fs.existsSync(container)
    ? fs.readFileSync(container, "utf8").match(/full-path\s*=\s*["']([^"']+)["']/)?.[1]
    : undefined;
  if (!opfRelative) throw new Error("EPUB gerado sem OPF.");
  const opfPath = path.join(rootDir, ...opfRelative.split("/"));
  const opf = fs.readFileSync(opfPath, "utf8");
  const manifest = new Map<string, { href: string; properties: string }>();
  for (const match of opf.matchAll(/<item\b([^>]*)>/gi)) {
    const attrs = match[1] || "";
    const id = attrs.match(/\bid\s*=\s*["']([^"']+)["']/)?.[1];
    const href = attrs.match(/\bhref\s*=\s*["']([^"']+)["']/)?.[1];
    if (id && href) manifest.set(id, { href: decodeURIComponent(href), properties: attrs.match(/\bproperties\s*=\s*["']([^"']+)["']/)?.[1] || "" });
  }
  const spine = Array.from(opf.matchAll(/<itemref\b[^>]*\bidref\s*=\s*["']([^"']+)["']/gi))
    .map((match) => manifest.get(match[1] || ""))
    .filter((item): item is { href: string; properties: string } => Boolean(item));
  const wanted = chapterHref ? path.posix.basename(chapterHref.split("#")[0] || "").toLowerCase() : "";
  const chosen = spine.find((item) => wanted && path.posix.basename(item.href).toLowerCase() === wanted)
    ?? spine.find((item) => !item.properties.includes("nav") && !/cover/i.test(item.href))
    ?? spine[0];
  if (!chosen) throw new Error("EPUB gerado sem capitulos.");
  return path.join(path.dirname(opfPath), ...chosen.href.split("/"));
}

/**
 * Renders what the converted book will actually look like: the real exporter
 * output for one chapter, printed to PDF pages or laid out on an e-reader
 * screen and paginated, then captured as an image.
 */
export class OutputPreviewService {
  private readonly cache: CachedSlice[] = [];
  private readonly inflight = new Map<string, Promise<CachedSlice>>();

  constructor(private readonly deps: OutputPreviewDependencies) {}

  private get cacheRoot() {
    return path.join(this.deps.tempRoot, "lyceum-output-preview-packages");
  }

  async render(sourcePath: string, sourceFormat: BookFormat, request: OutputPreviewRequest): Promise<OutputPreviewResult> {
    if (request.targetFormat === "lyceum") throw new Error("O formato .lyceum nao tem pre-visualizacao de leitura.");
    const slice = await this.slice(sourcePath, sourceFormat, request);
    const screen = screenFor(request);
    const base = {
      segmentKind: slice.result.segmentKind,
      segmentIndex: slice.result.segmentIndex,
      segmentCount: slice.result.segmentCount,
      segmentTitle: slice.result.segmentTitle,
      approximate: request.targetFormat === "azw3" || request.targetFormat === "kfx",
    };

    if (request.targetFormat === "pdf") {
      const page = Math.min(Math.max(1, Math.floor(request.page)), slice.pageCount || 1);
      const rendered = await this.deps.renderPdfPage(slice.renderPath, page);
      if (!rendered) throw new Error("Nao foi possivel renderizar a pagina do PDF.");
      const pdfSize = request.conversionOptions?.pdfPageSize || "A4";
      return { ...base, ...rendered, page, pageCount: slice.pageCount || 1, viewport: { width: rendered.width, height: rendered.height, label: pdfSize } };
    }

    const captured = await this.captureScreen(slice, screen, request.page, slice.result.fixedLayout);
    return { ...base, ...captured, viewport: screen };
  }

  private async slice(sourcePath: string, sourceFormat: BookFormat, request: OutputPreviewRequest): Promise<CachedSlice> {
    const stats = await fs.promises.stat(sourcePath);
    const key = sliceKey(sourcePath, stats, sourceFormat, request);
    const cached = this.cache.find((entry) => entry.key === key && fs.existsSync(entry.renderPath));
    if (cached) return cached;
    const pending = this.inflight.get(key);
    if (pending) return pending;

    const job = this.buildSlice(key, sourcePath, sourceFormat, request).finally(() => this.inflight.delete(key));
    this.inflight.set(key, job);
    return job;
  }

  private async buildSlice(key: string, sourcePath: string, sourceFormat: BookFormat, request: OutputPreviewRequest): Promise<CachedSlice> {
    await fs.promises.mkdir(this.deps.tempRoot, { recursive: true });
    const dir = await fs.promises.mkdtemp(path.join(this.deps.tempRoot, OUTPUT_PREVIEW_TEMP_PREFIX));
    try {
      const result = await this.deps.exportSlice({
        sourcePath,
        sourceFormat,
        targetFormat: request.targetFormat as BookFormat,
        conversionOptions: request.conversionOptions,
        segmentIndex: request.segmentIndex,
        cacheRoot: this.cacheRoot,
        outputDir: path.join(dir, "export"),
      });

      let renderPath = result.outputPath;
      let pageCount: number | undefined;
      if (request.targetFormat === "pdf") {
        if (result.kind === "html") {
          renderPath = path.join(dir, "preview.pdf");
          await withTimeout(
            this.deps.printHtmlToPdf(result.outputPath, renderPath, request.conversionOptions || {}),
            PRINT_TIMEOUT_MS,
            "Tempo esgotado ao paginar o capitulo em PDF.",
          );
        }
        pageCount = (await PDFDocument.load(await fs.promises.readFile(renderPath), { updateMetadata: false })).getPageCount();
      } else if (result.kind === "epub") {
        const extracted = path.join(dir, "epub");
        new AdmZip(result.outputPath).extractAllTo(extracted, true);
        renderPath = findChapterDocument(extracted, result.chapterHref);
      } else if (result.kind === "txt") {
        renderPath = path.join(dir, "preview-txt.html");
        const text = await fs.promises.readFile(result.outputPath, "utf8");
        await fs.promises.writeFile(renderPath, `<!doctype html><html><head><meta charset="utf-8"><style>body{font:16px/1.5 monospace;white-space:pre-wrap;}</style></head><body>${escapeHtml(text)}</body></html>`);
      }

      const entry: CachedSlice = { key, dir, result, renderPath, pageCount };
      this.cache.unshift(entry);
      for (const evicted of this.cache.splice(CACHE_LIMIT)) {
        void fs.promises.rm(evicted.dir, { recursive: true, force: true }).catch(() => undefined);
      }
      return entry;
    } catch (error) {
      await fs.promises.rm(dir, { recursive: true, force: true }).catch(() => undefined);
      throw error;
    }
  }

  /** Lays the chapter out on a reader-sized screen using CSS columns (one column = one page). */
  private async captureScreen(slice: CachedSlice, screen: { width: number; height: number }, requestedPage: number, fixedLayout: boolean) {
    const scale = 2;
    // Rendered at 2x (window twice the size, zoom 2) so text is sharp while the CSS viewport stays the screen size.
    const window = this.deps.createWindow({
      show: false,
      width: screen.width * scale,
      height: screen.height * scale,
      useContentSize: true,
      backgroundColor: "#ffffff",
      webPreferences: {
        offscreen: true,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        session: this.deps.previewSession(),
        zoomFactor: scale,
      },
    });
    try {
      window.setContentSize(screen.width * scale, screen.height * scale);
      await window.loadURL(pathToFileURL(slice.renderPath).href);
      const css = fixedLayout
        ? `html,body{margin:0!important;padding:0!important;width:100vw!important;height:100vh!important;overflow:hidden!important;background:#fff!important;}
           body{display:flex!important;align-items:center;justify-content:center;}
           img,svg,body>*{max-width:100vw!important;max-height:100vh!important;object-fit:contain!important;}`
        : `html{margin:0!important;padding:0!important;width:100vw!important;height:100vh!important;overflow:hidden!important;background:#fff!important;}
           body{margin:0!important;box-sizing:border-box!important;height:100vh!important;padding:${PAGE_MARGIN.y}px ${PAGE_MARGIN.x}px!important;
             column-width:${screen.width - PAGE_MARGIN.x * 2}px!important;column-gap:${PAGE_MARGIN.x * 2}px!important;column-fill:auto!important;}
           img,svg,video{max-width:100%!important;max-height:${screen.height - PAGE_MARGIN.y * 2}px!important;object-fit:contain;break-inside:avoid;}`;
      await window.webContents.insertCSS(css, { cssOrigin: "user" });
      const pageCount = await window.webContents.executeJavaScript(`(async () => {
        await (document.fonts ? document.fonts.ready : Promise.resolve());
        await Promise.all(Array.from(document.images).map((image) => image.complete ? null : new Promise((resolve) => {
          image.addEventListener("load", resolve, { once: true });
          image.addEventListener("error", resolve, { once: true });
        })));
        const scroller = document.scrollingElement || document.documentElement;
        return Math.max(1, Math.ceil((scroller.scrollWidth - 1) / ${screen.width}));
      })()`, true) as number;
      const page = fixedLayout ? 1 : Math.min(Math.max(1, Math.floor(requestedPage)), pageCount);
      await window.webContents.executeJavaScript(`(() => {
        const scroller = document.scrollingElement || document.documentElement;
        scroller.scrollLeft = ${(page - 1) * screen.width};
        return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      })()`, true);
      const image = await window.webContents.capturePage();
      return {
        dataUrl: image.toDataURL(),
        width: image.getSize().width,
        height: image.getSize().height,
        page,
        pageCount: fixedLayout ? 1 : pageCount,
      };
    } finally {
      if (!window.isDestroyed()) window.destroy();
    }
  }

  dispose() {
    for (const entry of this.cache.splice(0)) {
      void fs.promises.rm(entry.dir, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}

/** Removes preview folders left behind by a crash. */
export async function cleanupStaleOutputPreviews(tempRoot: string) {
  const entries = await fs.promises.readdir(tempRoot, { withFileTypes: true }).catch(() => []);
  await Promise.all(entries
    .filter((entry) => entry.isDirectory() && (entry.name.startsWith(OUTPUT_PREVIEW_TEMP_PREFIX) || entry.name === "lyceum-output-preview-packages"))
    .map((entry) => fs.promises.rm(path.join(tempRoot, entry.name), { recursive: true, force: true }).catch(() => undefined)));
}
