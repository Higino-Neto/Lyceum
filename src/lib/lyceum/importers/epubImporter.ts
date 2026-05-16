import fs from "node:fs";
import path from "node:path";
import JSZip, { type JSZipObject } from "jszip";
import { createManifest, mergeBookMetadata } from "../schema/manifest";
import type {
  ImportInput,
  ImportResult,
  LyceumBookMetadata,
  LyceumImporter,
  LyceumTextualChapter,
  LyceumTextualContent,
  LyceumTextualResource,
  LyceumTocItem,
} from "../schema/types";
import {
  buildTextualContent,
  extractBodyHtml,
  isPlaceholderTitle,
  normalizeHtmlEntitiesForXhtml,
  stripHtml,
  wrapTextAsXhtml,
} from "../textual";
import { textualRelativePath } from "../package/paths";
import { writeLyceumPackageAsync } from "../package/write";

interface ManifestItem {
  id: string;
  href: string;
  mediaType: string;
  properties: string;
}

interface ParsedNavigation {
  titlesByPath: Map<string, string>;
  toc: LyceumTocItem[];
}

interface ParsedEpub {
  metadata: Partial<LyceumBookMetadata>;
  textual: LyceumTextualContent;
  warnings: string[];
}

const XHTML_MEDIA_TYPE = "application/xhtml+xml";
const IMAGE_MEDIA_TYPES = new Map([
  [".avif", "image/avif"],
  [".bmp", "image/bmp"],
  [".gif", "image/gif"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
  [".css", "text/css"],
  [".otf", "font/otf"],
  [".ttf", "font/ttf"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
  [".mp3", "audio/mpeg"],
  [".mp4", "audio/mp4"],
]);

function normalizeZipPath(value: string) {
  return value.replace(/\\/g, "/").replace(/^\/+/, "");
}

function splitHref(value: string) {
  const match = value.match(/^([^#?]*)([?#].*)?$/);
  return {
    pathname: match?.[1] || "",
    suffix: match?.[2] || "",
  };
}

function dirname(value: string) {
  const normalized = normalizeZipPath(value);
  const index = normalized.lastIndexOf("/");
  return index >= 0 ? normalized.slice(0, index + 1) : "";
}

function decodeHrefPath(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function resolveZipPath(baseDirectory: string, href: string) {
  const cleanHref = decodeHrefPath(splitHref(href).pathname);
  const parts = `${baseDirectory}${cleanHref}`.split("/");
  const resolved: string[] = [];

  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") {
      resolved.pop();
    } else {
      resolved.push(part);
    }
  }

  return resolved.join("/");
}

function hrefRelativeToOpf(baseDirectory: string, zipPath: string) {
  const normalizedBase = normalizeZipPath(baseDirectory);
  const normalizedPath = normalizeZipPath(zipPath);
  return normalizedBase && normalizedPath.startsWith(normalizedBase)
    ? normalizedPath.slice(normalizedBase.length)
    : normalizedPath;
}

function getEntry(zip: JSZip, entryPath: string): JSZipObject | null {
  const normalized = normalizeZipPath(entryPath);
  return zip.file(normalized)
    || Object.values(zip.files).find((entry) => !entry.dir && normalizeZipPath(entry.name).toLowerCase() === normalized.toLowerCase())
    || null;
}

async function getEntryText(zip: JSZip, entryPath: string): Promise<string | null> {
  const entry = getEntry(zip, entryPath);
  return entry ? entry.async("text") : null;
}

async function getEntryBytes(zip: JSZip, entryPath: string): Promise<Uint8Array | null> {
  const entry = getEntry(zip, entryPath);
  return entry ? entry.async("uint8array") : null;
}

function getAttribute(value: string, attribute: string): string | null {
  const pattern = new RegExp(`\\b${attribute}\\s*=\\s*["']([^"']+)["']`, "i");
  return value.match(pattern)?.[1] || null;
}

function getTagText(value: string, tagName: string): string | undefined {
  const pattern = new RegExp(`<[^:>]*(?::)?${tagName}\\b[^>]*>([\\s\\S]*?)<\\/[^:>]*(?::)?${tagName}>`, "i");
  const text = value.match(pattern)?.[1];
  const cleaned = text ? stripHtml(text) : "";
  return cleaned || undefined;
}

function firstHeadingText(value: string): string | undefined {
  const heading = value.match(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/i)?.[1];
  const text = heading ? stripHtml(heading) : "";
  return text || undefined;
}

function parseManifest(opf: string): Map<string, ManifestItem> {
  const manifest = new Map<string, ManifestItem>();

  for (const match of opf.matchAll(/<item\b[^>]*>/gi)) {
    const item = match[0];
    const id = getAttribute(item, "id");
    const href = getAttribute(item, "href");
    const mediaType = getAttribute(item, "media-type") || "";
    const properties = getAttribute(item, "properties") || "";

    if (id && href) {
      manifest.set(id, { id, href, mediaType, properties });
    }
  }

  return manifest;
}

function isContentDocument(item: ManifestItem) {
  return /xhtml|html/i.test(item.mediaType) || /\.(xhtml|html?)$/i.test(splitHref(item.href).pathname);
}

function isNavigationDocument(item: ManifestItem) {
  return /\bnav\b/i.test(item.properties) || /(^|\/)(toc|nav|navigation)\.(xhtml|html?)$/i.test(splitHref(item.href).pathname);
}

function inferMediaType(href: string) {
  return IMAGE_MEDIA_TYPES.get(path.extname(splitHref(href).pathname).toLowerCase()) || "application/octet-stream";
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

function replaceOrInsertTitle(xhtml: string, title: string, replaceExisting: boolean) {
  if (/<title\b[^>]*>[\s\S]*?<\/title>/i.test(xhtml)) {
    return replaceExisting
      ? xhtml.replace(/<title\b[^>]*>[\s\S]*?<\/title>/i, `<title>${title}</title>`)
      : xhtml;
  }

  if (/<head\b[^>]*>/i.test(xhtml)) {
    return xhtml.replace(/<head\b[^>]*>/i, (match) => `${match}\n<title>${title}</title>`);
  }

  return xhtml.replace(/<html\b[^>]*>/i, (match) => `${match}\n<head><title>${title}</title></head>`);
}

function replaceLeadingPlaceholderHeading(xhtml: string, title: string) {
  return xhtml.replace(/(<body\b[^>]*>\s*(?:<[^>]+>\s*)*)<h([1-6])\b([^>]*)>([\s\S]*?)<\/h\2>/i, (match, prefix, level, attrs, heading) => {
    return isPlaceholderTitle(stripHtml(heading))
      ? `${prefix}<h${level}${attrs}>${title}</h${level}>`
      : match;
  });
}

function ensureXhtmlDocument(value: string, title: string) {
  if (/<html\b/i.test(value)) {
    let xhtml = value.trim();
    if (!/<html\b[^>]*\bxmlns\s*=/i.test(xhtml)) {
      xhtml = xhtml.replace(/<html\b/i, `<html xmlns="http://www.w3.org/1999/xhtml"`);
    }
    return xhtml;
  }

  return wrapTextAsXhtml(title, [stripHtml(value) || value]);
}

function normalizeChapterXhtml(rawXhtml: string, title: string, htmlTitle?: string) {
  const replaceExistingTitle = isPlaceholderTitle(htmlTitle);
  const escapedTitle = title
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  let xhtml = normalizeHtmlEntitiesForXhtml(ensureXhtmlDocument(rawXhtml, title));
  xhtml = replaceOrInsertTitle(xhtml, escapedTitle, replaceExistingTitle);
  xhtml = replaceLeadingPlaceholderHeading(xhtml, escapedTitle);
  return xhtml;
}

function hasMeaningfulContent(xhtml: string) {
  return Boolean(stripHtml(extractBodyHtml(xhtml)))
    || /<(img|svg|math|table|figure|video|audio)\b/i.test(xhtml);
}

function parseNavigationItems(nav: string, navDirectory: string, baseDirectory: string): ParsedNavigation {
  const titlesByPath = new Map<string, string>();
  const toc: LyceumTocItem[] = [];
  let olDepth = 0;
  let index = 0;
  const tokens = nav.matchAll(/<\/?ol\b[^>]*>|<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi);

  for (const token of tokens) {
    const raw = token[0];
    if (/^<ol\b/i.test(raw)) {
      olDepth += 1;
      continue;
    }
    if (/^<\/ol\b/i.test(raw)) {
      olDepth = Math.max(0, olDepth - 1);
      continue;
    }

    const href = token[1];
    const title = stripHtml(token[2]);
    if (!href || isPlaceholderTitle(title)) continue;

    const { suffix } = splitHref(href);
    const targetPath = resolveZipPath(navDirectory, href);
    const packageHref = `${textualRelativePath(hrefRelativeToOpf(baseDirectory, targetPath), `toc-${index + 1}.xhtml`)}${suffix}`;
    titlesByPath.set(targetPath.toLowerCase(), title);
    toc.push({
      id: `toc-${String(index + 1).padStart(3, "0")}`,
      href: packageHref,
      title,
      level: Math.max(1, olDepth),
    });
    index += 1;
  }

  return { titlesByPath, toc };
}

async function parseNavigation(zip: JSZip, baseDirectory: string, manifest: Map<string, ManifestItem>) {
  const titlesByPath = new Map<string, string>();
  const toc: LyceumTocItem[] = [];
  const navItems = [...manifest.values()].filter(isNavigationDocument);

  for (const item of navItems) {
    const navPath = resolveZipPath(baseDirectory, item.href);
    const nav = await getEntryText(zip, navPath);
    if (!nav) continue;

    const parsed = parseNavigationItems(nav, dirname(navPath), baseDirectory);
    for (const [targetPath, title] of parsed.titlesByPath) {
      titlesByPath.set(targetPath, title);
    }
    toc.push(...parsed.toc);
  }

  return { titlesByPath, toc };
}

function tocWithChapterIds(toc: LyceumTocItem[], chaptersByHref: Map<string, LyceumTextualChapter>) {
  return toc.map((item) => {
    const [hrefWithoutFragment] = item.href.split("#");
    const chapter = chaptersByHref.get(hrefWithoutFragment.toLowerCase());
    return {
      ...item,
      id: chapter?.id || item.id,
    };
  });
}

export async function parseEpubBufferToTextual(epubBuffer: Buffer | Uint8Array | ArrayBuffer): Promise<ParsedEpub> {
  const zip = await JSZip.loadAsync(epubBuffer);
  const container = await getEntryText(zip, "META-INF/container.xml");
  if (!container) {
    throw new Error("EPUB invalido: container.xml nao encontrado");
  }

  const rootfile = [...container.matchAll(/<rootfile\b[^>]*>/gi)]
    .map((match) => match[0])
    .find((item) => {
      const mediaType = getAttribute(item, "media-type") || "";
      return !mediaType || mediaType === "application/oebps-package+xml";
    });
  const opfPath = rootfile ? getAttribute(rootfile, "full-path") : null;
  if (!opfPath) {
    throw new Error("EPUB invalido: OPF nao encontrado");
  }

  const opf = await getEntryText(zip, opfPath);
  if (!opf) {
    throw new Error("Arquivo OPF do EPUB nao encontrado");
  }

  const baseDirectory = dirname(opfPath);
  const manifest = parseManifest(opf);
  const warnings: string[] = [];
  const chapters: LyceumTextualChapter[] = [];
  const resources: LyceumTextualResource[] = [];
  const usedHrefs = new Set<string>();
  const chapterZipPaths = new Set<string>();
  const navigation = await parseNavigation(zip, baseDirectory, manifest);

  const addChapter = async (item: ManifestItem) => {
    if (!isContentDocument(item) || isNavigationDocument(item)) return;

    const chapterPath = resolveZipPath(baseDirectory, item.href);
    if (chapterZipPaths.has(chapterPath.toLowerCase())) return;

    const chapter = await getEntryText(zip, chapterPath);
    if (!chapter) {
      warnings.push(`Capitulo nao encontrado: ${chapterPath}`);
      return;
    }

    const index = chapters.length + 1;
    const htmlTitle = getTagText(chapter, "title");
    const headingTitle = firstHeadingText(extractBodyHtml(chapter));
    const navTitle = navigation.titlesByPath.get(chapterPath.toLowerCase());
    const title = navTitle
      || (isPlaceholderTitle(htmlTitle) ? undefined : htmlTitle)
      || (isPlaceholderTitle(headingTitle) ? undefined : headingTitle)
      || `Capitulo ${index}`;
    const href = uniqueHref(item.href, usedHrefs, `text/chapter-${String(index).padStart(3, "0")}.xhtml`);
    const xhtml = normalizeChapterXhtml(chapter, title, htmlTitle);

    if (!hasMeaningfulContent(xhtml)) {
      warnings.push(`Capitulo sem conteudo exportavel: ${chapterPath}`);
      return;
    }

    chapters.push({
      id: safeId(item.id, `chapter-${String(index).padStart(3, "0")}`),
      href,
      title,
      xhtml,
      mediaType: item.mediaType || XHTML_MEDIA_TYPE,
      properties: item.properties || undefined,
    });
    chapterZipPaths.add(chapterPath.toLowerCase());
  };

  for (const match of opf.matchAll(/<itemref\b[^>]*>/gi)) {
    const itemref = match[0];
    const idref = getAttribute(itemref, "idref");
    const linear = getAttribute(itemref, "linear");
    const item = idref ? manifest.get(idref) : null;

    if (!item || linear?.toLowerCase() === "no") continue;
    await addChapter(item);
  }

  if (chapters.length === 0) {
    warnings.push("Spine ausente ou vazio; usando documentos HTML do manifesto.");
    for (const item of manifest.values()) {
      await addChapter(item);
    }
  }

  for (const item of manifest.values()) {
    const resourcePath = resolveZipPath(baseDirectory, item.href);
    const isChapter = chapterZipPaths.has(resourcePath.toLowerCase());
    if (isChapter || isNavigationDocument(item)) continue;

    const data = await getEntryBytes(zip, resourcePath);
    if (!data) {
      warnings.push(`Recurso nao encontrado: ${resourcePath}`);
      continue;
    }

    resources.push({
      id: safeId(item.id, `resource-${resources.length + 1}`),
      href: uniqueHref(item.href, usedHrefs, `resources/resource-${resources.length + 1}`),
      mediaType: item.mediaType || inferMediaType(item.href),
      properties: item.properties || undefined,
      data,
    });
  }

  const chaptersByHref = new Map(chapters.map((chapter) => [chapter.href.toLowerCase(), chapter]));
  const toc = tocWithChapterIds(navigation.toc, chaptersByHref).filter((item) => (
    chaptersByHref.has(item.href.split("#")[0].toLowerCase())
  ));

  return {
    metadata: {
      title: getTagText(opf, "title"),
      author: getTagText(opf, "creator"),
      language: getTagText(opf, "language"),
      identifier: getTagText(opf, "identifier"),
      publisher: getTagText(opf, "publisher"),
      description: getTagText(opf, "description"),
    },
    textual: buildTextualContent(chapters, {
      toc: toc.length ? toc : undefined,
      resources,
    }),
    warnings,
  };
}

export class EpubImporter implements LyceumImporter {
  inputFormat = "epub" as const;

  async import(input: ImportInput): Promise<ImportResult> {
    const parsed = await parseEpubBufferToTextual(await fs.promises.readFile(input.sourcePath));
    const fallbackTitle = path.basename(input.sourcePath, path.extname(input.sourcePath));
    const metadata = mergeBookMetadata(fallbackTitle, {
      ...parsed.metadata,
      ...input.metadata,
    });
    const manifest = createManifest({
      sourcePath: input.sourcePath,
      sourceFormat: "epub",
      metadata,
      primaryContentKind: "textual",
      contentKinds: ["textual"],
    });
    const pkg = await writeLyceumPackageAsync({
      rootPath: input.packageRoot,
      manifest,
      metadata,
      textual: parsed.textual,
      sourcePath: input.sourcePath,
    });

    return {
      package: pkg,
      report: {
        sourceFormat: "epub",
        contentKinds: ["textual"],
        warnings: parsed.warnings,
        stats: {
          chapterCount: parsed.textual.chapters.length,
          resourceCount: parsed.textual.resources?.length || 0,
          imageCount: parsed.textual.resources?.filter((resource) => resource.mediaType.startsWith("image/")).length || 0,
          stylesheetCount: parsed.textual.resources?.filter((resource) => resource.mediaType === "text/css").length || 0,
          wordCount: parsed.textual.fulltext.split(/\s+/).filter(Boolean).length,
        },
      },
    };
  }
}
