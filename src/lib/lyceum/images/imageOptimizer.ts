import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import type sharpType from "sharp";
import { textualResourcePath } from "../package/paths";
import type { LyceumConversionOptions, LyceumPackage, LyceumTextualResource } from "../schema/types";
import {
  DEFAULT_CUSTOM_IMAGE_SETTINGS,
  IMAGE_DIMENSION_LIMITS,
  IMAGE_QUALITY_LIMITS,
  KINDLE_IMAGE_PRESETS,
  isKindleImagePreset,
} from "./imagePresets";

type SharpFactory = typeof sharpType;
const require = createRequire(import.meta.url);
let sharpFactoryPromise: Promise<SharpFactory> | null = null;

async function getSharp(): Promise<SharpFactory> {
  sharpFactoryPromise ||= Promise.resolve(require("sharp") as SharpFactory);
  return sharpFactoryPromise;
}

export interface ImageOptimizationSettings {
  /** null = keep the original dimensions. */
  maxWidth: number | null;
  maxHeight: number | null;
  quality: number;
  grayscale: boolean;
}

export interface OptimizedImage {
  data: Buffer;
  mediaType: string;
  width: number;
  height: number;
  changed: boolean;
}

const OPTIMIZABLE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"]);
const GRAYSCALE_ONLY_QUALITY = 90;

function clamp(value: unknown, min: number, max: number, fallback: number) {
  const numeric = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.round(Math.min(max, Math.max(min, numeric)));
}

/** Returns null when the user left images untouched (the default). */
export function resolveImageSettings(options?: LyceumConversionOptions | null): ImageOptimizationSettings | null {
  if (!options) return null;
  const preset = options.imagePreset ?? "original";
  const grayscale = options.imageGrayscale === true;

  if (preset === "original") {
    return grayscale
      ? { maxWidth: null, maxHeight: null, quality: GRAYSCALE_ONLY_QUALITY, grayscale: true }
      : null;
  }

  const defaults = isKindleImagePreset(preset) ? KINDLE_IMAGE_PRESETS[preset] : DEFAULT_CUSTOM_IMAGE_SETTINGS;
  return {
    maxWidth: clamp(options.imageMaxWidth, IMAGE_DIMENSION_LIMITS.min, IMAGE_DIMENSION_LIMITS.max, defaults.maxWidth),
    maxHeight: clamp(options.imageMaxHeight, IMAGE_DIMENSION_LIMITS.min, IMAGE_DIMENSION_LIMITS.max, defaults.maxHeight),
    quality: clamp(options.imageQuality, IMAGE_QUALITY_LIMITS.min, IMAGE_QUALITY_LIMITS.max, defaults.quality),
    grayscale,
  };
}

export function canOptimizeMediaType(mediaType: string) {
  return OPTIMIZABLE_TYPES.has(mediaType.toLowerCase());
}

export async function optimizeImageBytes(
  input: Uint8Array | Buffer,
  mediaType: string,
  settings: ImageOptimizationSettings,
): Promise<OptimizedImage> {
  const sharp = await getSharp();
  const original = Buffer.isBuffer(input) ? input : Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  const metadata = await sharp(original, { animated: false }).metadata();
  const originalWidth = metadata.width || 0;
  const originalHeight = metadata.height || 0;

  const needsResize = settings.maxWidth !== null && settings.maxHeight !== null
    && (originalWidth > settings.maxWidth || originalHeight > settings.maxHeight);

  let pipeline = sharp(original, { animated: false }).rotate();
  if (needsResize) {
    pipeline = pipeline.resize({
      width: settings.maxWidth!,
      height: settings.maxHeight!,
      fit: "inside",
      withoutEnlargement: true,
    });
  }
  // toColourspace("b-w") emits a true single-channel image (grayscale() alone keeps 3 sRGB channels).
  if (settings.grayscale) pipeline = pipeline.grayscale().toColourspace("b-w");

  const hasAlpha = Boolean(metadata.hasAlpha);
  const { data, info } = hasAlpha
    ? await pipeline.png({ compressionLevel: 9, palette: true, quality: settings.quality }).toBuffer({ resolveWithObject: true })
    : await pipeline.jpeg({ quality: settings.quality, mozjpeg: true }).toBuffer({ resolveWithObject: true });
  const outputType = hasAlpha ? "image/png" : "image/jpeg";

  // Never make an image heavier when nothing structural changed (no resize, same colour mode).
  const normalizedType = mediaType.toLowerCase();
  const pdfSafe = normalizedType === "image/jpeg" || normalizedType === "image/png";
  if (!needsResize && !settings.grayscale && data.byteLength >= original.byteLength && pdfSafe) {
    return { data: original, mediaType: normalizedType, width: originalWidth, height: originalHeight, changed: false };
  }

  return { data, mediaType: outputType, width: info.width, height: info.height, changed: true };
}

function extensionForMediaType(mediaType: string) {
  return mediaType === "image/png" ? ".png" : ".jpg";
}

function resourceBytes(resource: LyceumTextualResource, rootPath: string): Buffer | null {
  if (resource.data instanceof ArrayBuffer) return Buffer.from(resource.data);
  if (resource.data) return Buffer.from(resource.data.buffer, resource.data.byteOffset, resource.data.byteLength);
  try {
    return fs.readFileSync(textualResourcePath(rootPath, resource.href));
  } catch {
    return null;
  }
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Replaces file-name references (src="../images/a.png", url(a.png), …) when only the extension changed. */
function replaceFileReferences(text: string, renames: Map<string, string>) {
  let output = text;
  for (const [oldName, newName] of renames) {
    const pattern = new RegExp(`(^|[/"'(=\\s])${escapeRegExp(oldName)}(?=$|["')#?\\s])`, "g");
    output = output.replace(pattern, `$1${newName}`);
  }
  return output;
}

function uniqueRenamedHref(href: string, extension: string, used: Set<string>) {
  const parsed = path.posix.parse(href);
  const base = parsed.dir ? `${parsed.dir}/${parsed.name}` : parsed.name;
  let candidate = `${base}${extension}`;
  let counter = 2;
  while (used.has(candidate.toLowerCase())) {
    candidate = `${base}-${counter}${extension}`;
    counter += 1;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, worker: (item: T, index: number) => Promise<R>) {
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index] as T, index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

export interface PackageImageOptimizationResult {
  pkg: LyceumPackage;
  optimizedCount: number;
  originalBytes: number;
  optimizedBytes: number;
  warnings: string[];
}

export async function optimizePackageImages(
  pkg: LyceumPackage,
  settings: ImageOptimizationSettings,
  onProgress?: (progress: number, message: string) => void,
): Promise<PackageImageOptimizationResult> {
  const resources = pkg.textual?.resources || [];
  const targets = resources
    .map((resource, index) => ({ resource, index }))
    .filter(({ resource }) => canOptimizeMediaType(resource.mediaType));

  if (!pkg.textual || targets.length === 0) {
    return { pkg, optimizedCount: 0, originalBytes: 0, optimizedBytes: 0, warnings: [] };
  }

  const warnings: string[] = [];
  const nextResources = [...resources];
  const usedHrefs = new Set(resources.map((resource) => resource.href.toLowerCase()));
  const hrefRenames = new Map<string, string>();
  const fileNameRenames = new Map<string, string>();
  const dimensions = new Map<string, { width: number; height: number; mediaType: string; byteLength: number }>();
  let optimizedCount = 0;
  let originalBytes = 0;
  let optimizedBytes = 0;
  let done = 0;

  await mapWithConcurrency(targets, 4, async ({ resource, index }) => {
    const data = resourceBytes(resource, pkg.rootPath);
    try {
      if (!data) return;
      originalBytes += data.byteLength;
      const result = await optimizeImageBytes(data, resource.mediaType, settings);
      optimizedBytes += result.data.byteLength;
      if (!result.changed) {
        nextResources[index] = { ...resource, data };
        dimensions.set(resource.href.toLowerCase(), { width: result.width, height: result.height, mediaType: resource.mediaType, byteLength: data.byteLength });
        return;
      }

      let href = resource.href;
      const wantedExtension = extensionForMediaType(result.mediaType);
      const currentExtension = path.posix.extname(href).toLowerCase();
      const extensionMatches = currentExtension === wantedExtension || (wantedExtension === ".jpg" && currentExtension === ".jpeg");
      if (!extensionMatches) {
        usedHrefs.delete(href.toLowerCase());
        href = uniqueRenamedHref(resource.href, wantedExtension, usedHrefs);
        hrefRenames.set(resource.href, href);
        fileNameRenames.set(path.posix.basename(resource.href), path.posix.basename(href));
      }

      nextResources[index] = { ...resource, href, mediaType: result.mediaType, data: result.data };
      dimensions.set(resource.href.toLowerCase(), { width: result.width, height: result.height, mediaType: result.mediaType, byteLength: result.data.byteLength });
      optimizedCount += 1;
    } catch (error) {
      if (data) optimizedBytes += data.byteLength;
      warnings.push(`Imagem ${resource.href} mantida sem otimizacao (${error instanceof Error ? error.message : "erro desconhecido"}).`);
    } finally {
      done += 1;
      onProgress?.(done / targets.length, `Otimizando imagens (${done}/${targets.length})`);
    }
  });

  const renameHref = (href?: string) => (href && hrefRenames.get(href)) || href;
  const chapters = fileNameRenames.size
    ? pkg.textual.chapters.map((chapter) => ({ ...chapter, xhtml: replaceFileReferences(chapter.xhtml, fileNameRenames) }))
    : pkg.textual.chapters;

  // CSS / XHTML stored as resources may also point at renamed images.
  const finalResources = fileNameRenames.size
    ? nextResources.map((resource) => {
      const type = resource.mediaType.toLowerCase();
      if (type !== "text/css" && type !== "application/xhtml+xml") return resource;
      const bytes = resourceBytes(resource, pkg.rootPath);
      if (!bytes) return resource;
      return { ...resource, data: Buffer.from(replaceFileReferences(bytes.toString("utf8"), fileNameRenames), "utf8") };
    })
    : nextResources;

  const comic = pkg.comic
    ? {
      ...pkg.comic,
      pages: pkg.comic.pages.map((page) => {
        const info = page.resourceHref ? dimensions.get(page.resourceHref.toLowerCase()) : undefined;
        return {
          ...page,
          resourceHref: renameHref(page.resourceHref),
          ...(info ? { width: info.width, height: info.height, mediaType: info.mediaType, byteLength: info.byteLength } : {}),
        };
      }),
    }
    : undefined;
  if (comic) comic.totalBytes = comic.pages.reduce((sum, page) => sum + (page.byteLength || 0), 0);

  return {
    pkg: {
      ...pkg,
      metadata: { ...pkg.metadata, coverHref: renameHref(pkg.metadata.coverHref) },
      textual: { ...pkg.textual, chapters, resources: finalResources },
      comic,
    },
    optimizedCount,
    originalBytes,
    optimizedBytes,
    warnings,
  };
}
