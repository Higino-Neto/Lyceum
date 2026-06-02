import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import JSZip, { type JSZipObject } from "jszip";
import type sharpType from "sharp";
import { createManifest, mergeBookMetadata } from "../schema/manifest";
import type {
  ImportInput,
  ImportResult,
  LyceumComicContent,
  LyceumComicPage,
  LyceumImporter,
  LyceumTextualChapter,
  LyceumTextualResource,
} from "../schema/types";
import { escapeXml, buildTextualContent } from "../textual";
import { textualRelativePath } from "../package/paths";
import { writeLyceumPackageAsync } from "../package/write";

type SharpFactory = typeof sharpType;
const require = createRequire(import.meta.url);

export const CBZ_IMAGE_MEDIA_TYPES = new Map([
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".gif", "image/gif"],
  [".webp", "image/webp"],
  [".avif", "image/avif"],
]);

const IGNORED_FILE_NAMES = new Set(["thumbs.db", ".ds_store"]);
const collator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

let sharpFactoryPromise: Promise<SharpFactory> | null = null;

interface CbzPageEntry {
  entry: JSZipObject;
  zipPath: string;
  mediaType: string;
}

interface ParsedCbz {
  textual: ReturnType<typeof buildTextualContent>;
  comic: LyceumComicContent;
  warnings: string[];
  ignoredEntryCount: number;
}

async function getSharp(): Promise<SharpFactory> {
  sharpFactoryPromise ||= Promise.resolve(require("sharp") as SharpFactory);
  return sharpFactoryPromise;
}

function normalizeZipPath(value: string) {
  return value.replace(/\\/g, "/").replace(/^\/+/, "");
}

function isUnsafeZipPath(value: string) {
  if (!value || value.includes("\0") || path.isAbsolute(value) || /^[a-z]:/i.test(value)) {
    return true;
  }

  const normalized = value.replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  return parts.length === 0 || parts.some((part) => part === "." || part === "..");
}

function shouldIgnoreZipPath(value: string) {
  const normalized = normalizeZipPath(value);
  const parts = normalized.split("/").filter(Boolean);
  if (parts.some((part) => part === "__MACOSX" || part.startsWith("."))) return true;
  const fileName = parts.at(-1)?.toLowerCase() || "";
  return IGNORED_FILE_NAMES.has(fileName);
}

function mediaTypeForPath(value: string) {
  return CBZ_IMAGE_MEDIA_TYPES.get(path.posix.extname(value).toLowerCase()) || null;
}

function naturalComparePaths(a: string, b: string) {
  const aParts = normalizeZipPath(a).split("/");
  const bParts = normalizeZipPath(b).split("/");
  const length = Math.max(aParts.length, bParts.length);

  for (let index = 0; index < length; index += 1) {
    const left = aParts[index];
    const right = bParts[index];
    if (left === undefined) return -1;
    if (right === undefined) return 1;
    const compared = collator.compare(left, right);
    if (compared !== 0) return compared;
  }

  return collator.compare(a, b);
}

function safeId(value: string, fallback: string) {
  const id = value
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/^-+|-+$/g, "");
  return id || fallback;
}

function uniqueHref(href: string, used: Set<string>, fallback: string) {
  const normalized = textualRelativePath(href, fallback);
  if (!used.has(normalized.toLowerCase())) {
    used.add(normalized.toLowerCase());
    return normalized;
  }

  const extension = path.posix.extname(normalized);
  const base = normalized.slice(0, normalized.length - extension.length);
  let index = 2;
  let candidate = `${base}-${index}${extension}`;
  while (used.has(candidate.toLowerCase())) {
    index += 1;
    candidate = `${base}-${index}${extension}`;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

function hasImageSignature(data: Uint8Array, mediaType: string) {
  const buffer = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  if (mediaType === "image/jpeg") {
    return data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  }
  if (mediaType === "image/png") {
    return data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47
      && data[4] === 0x0d && data[5] === 0x0a && data[6] === 0x1a && data[7] === 0x0a;
  }
  if (mediaType === "image/gif") {
    const signature = buffer.subarray(0, 6).toString("ascii");
    return signature === "GIF87a" || signature === "GIF89a";
  }
  if (mediaType === "image/webp") {
    return buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  }
  if (mediaType === "image/avif") {
    const brand = buffer.subarray(4, 12).toString("ascii");
    return brand.startsWith("ftyp") && /avi[f s]|mif1|msf1/.test(brand);
  }
  return false;
}

function pageTitle(index: number, zipPath: string) {
  return `Pagina ${index}: ${path.posix.basename(zipPath)}`;
}

function renderComicPageXhtml(args: {
  title: string;
  resourceHref: string;
  sourceHref: string;
}) {
  return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <title>${escapeXml(args.title)}</title>
  <style>
    body { margin: 0; padding: 0; text-align: center; background: #fff; }
    img { display: block; max-width: 100%; height: auto; margin: 0 auto; }
  </style>
</head>
<body>
  <figure id="page">
    <img src="${escapeXml(args.sourceHref)}" alt="${escapeXml(args.title)}" />
  </figure>
</body>
</html>`;
}

function collectPageEntries(zip: JSZip): { pages: CbzPageEntry[]; ignoredEntryCount: number } {
  const pages: CbzPageEntry[] = [];
  let ignoredEntryCount = 0;

  for (const entry of Object.values(zip.files)) {
    const originalName = typeof (entry as JSZipObject & { unsafeOriginalName?: unknown }).unsafeOriginalName === "string"
      ? (entry as JSZipObject & { unsafeOriginalName: string }).unsafeOriginalName
      : entry.name;
    const zipPath = normalizeZipPath(entry.name);
    if (entry.dir) continue;

    if (isUnsafeZipPath(originalName)) {
      throw new Error(`CBZ invalido: caminho inseguro dentro do arquivo (${originalName}).`);
    }

    if (shouldIgnoreZipPath(zipPath)) {
      ignoredEntryCount += 1;
      continue;
    }

    const mediaType = mediaTypeForPath(zipPath);
    if (!mediaType) {
      ignoredEntryCount += 1;
      continue;
    }

    pages.push({ entry, zipPath, mediaType });
  }

  pages.sort((a, b) => naturalComparePaths(a.zipPath, b.zipPath));
  return { pages, ignoredEntryCount };
}

export async function inspectCbzPageCount(sourcePath: string): Promise<number> {
  const zip = await JSZip.loadAsync(await fs.promises.readFile(sourcePath));
  return collectPageEntries(zip).pages.length;
}

export async function extractFirstCbzImage(sourcePath: string): Promise<{
  data: Uint8Array;
  mediaType: string;
  zipPath: string;
} | null> {
  const zip = await JSZip.loadAsync(await fs.promises.readFile(sourcePath));
  const first = collectPageEntries(zip).pages[0];
  if (!first) return null;
  return {
    data: await first.entry.async("uint8array"),
    mediaType: first.mediaType,
    zipPath: first.zipPath,
  };
}

export async function parseCbzBuffer(
  cbzBuffer: Buffer | Uint8Array | ArrayBuffer,
): Promise<ParsedCbz> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(cbzBuffer);
  } catch (error) {
    throw new Error(`CBZ invalido ou corrompido: ${error instanceof Error ? error.message : "nao foi possivel abrir o ZIP"}`);
  }

  const { pages, ignoredEntryCount } = collectPageEntries(zip);
  if (pages.length === 0) {
    throw new Error("CBZ invalido: nenhuma imagem suportada foi encontrada.");
  }

  const sharp = await getSharp();
  const chapters: LyceumTextualChapter[] = [];
  const resources: LyceumTextualResource[] = [];
  const comicPages: LyceumComicPage[] = [];
  const warnings: string[] = [];
  const usedHrefs = new Set<string>();
  let totalBytes = 0;

  for (const [index, page] of pages.entries()) {
    const pageNumber = index + 1;
    const fallbackId = `page-${String(pageNumber).padStart(4, "0")}`;
    const bytes = await page.entry.async("uint8array");
    if (!hasImageSignature(bytes, page.mediaType)) {
      throw new Error(`CBZ invalido: ${page.zipPath} tem extensao de imagem, mas a assinatura do arquivo nao confere.`);
    }

    let metadata: sharpType.Metadata;
    try {
      metadata = await sharp(Buffer.from(bytes), { animated: page.mediaType === "image/webp" || page.mediaType === "image/gif" }).metadata();
    } catch (error) {
      throw new Error(`CBZ invalido: a imagem ${page.zipPath} nao pode ser lida (${error instanceof Error ? error.message : "erro desconhecido"}).`);
    }

    const extension = path.posix.extname(page.zipPath).toLowerCase() || ".bin";
    const title = pageTitle(pageNumber, page.zipPath);
    const resourceHref = uniqueHref(
      `images/${fallbackId}${extension}`,
      usedHrefs,
      `images/${fallbackId}${extension}`,
    );
    const chapterHref = uniqueHref(
      `pages/${fallbackId}.xhtml`,
      usedHrefs,
      `pages/${fallbackId}.xhtml`,
    );
    const relativeImageHref = `../${resourceHref}`;
    const properties = pageNumber === 1 ? "cover-image" : undefined;

    resources.push({
      id: safeId(path.posix.basename(page.zipPath, extension), fallbackId),
      href: resourceHref,
      mediaType: page.mediaType,
      properties,
      data: bytes,
    });
    chapters.push({
      id: fallbackId,
      href: chapterHref,
      title,
      mediaType: "application/xhtml+xml",
      xhtml: renderComicPageXhtml({
        title,
        resourceHref,
        sourceHref: relativeImageHref,
      }),
    });
    comicPages.push({
      id: fallbackId,
      href: chapterHref,
      title,
      mediaType: page.mediaType,
      byteLength: bytes.byteLength,
      width: metadata.width,
      height: metadata.height,
      resourceHref,
      originalPath: page.zipPath,
    });
    totalBytes += bytes.byteLength;
  }

  return {
    textual: buildTextualContent(chapters, { resources }),
    comic: {
      pages: comicPages,
      pageCount: comicPages.length,
      totalBytes,
    },
    warnings,
    ignoredEntryCount,
  };
}

export class CbzImporter implements LyceumImporter {
  inputFormat = "cbz" as const;

  async import(input: ImportInput): Promise<ImportResult> {
    const stats = await fs.promises.stat(input.sourcePath);
    const parsed = await parseCbzBuffer(await fs.promises.readFile(input.sourcePath));
    const fallbackTitle = path.basename(input.sourcePath, path.extname(input.sourcePath));
    const metadata = mergeBookMetadata(fallbackTitle, {
      ...input.metadata,
      coverResourceId: input.metadata?.coverResourceId || parsed.textual.resources?.[0]?.id,
      coverHref: input.metadata?.coverHref || parsed.comic.pages[0]?.resourceHref,
      coverPageHref: input.metadata?.coverPageHref || parsed.comic.pages[0]?.href,
    });
    const manifest = createManifest({
      sourcePath: input.sourcePath,
      sourceFormat: "cbz",
      metadata,
      primaryContentKind: "comic",
      contentKinds: ["comic", "textual"],
    });
    const pkg = await writeLyceumPackageAsync({
      rootPath: input.packageRoot,
      manifest,
      metadata,
      textual: parsed.textual,
      comic: parsed.comic,
      sourcePath: input.sourcePath,
    });

    return {
      package: pkg,
      report: {
        sourceFormat: "cbz",
        contentKinds: ["comic", "textual"],
        warnings: parsed.warnings,
        stats: {
          format: "cbz",
          pageCount: parsed.comic.pageCount,
          imageCount: parsed.comic.pageCount,
          ignoredEntryCount: parsed.ignoredEntryCount,
          totalImageBytes: parsed.comic.totalBytes,
          sourceBytes: stats.size,
        },
      },
    };
  }
}
