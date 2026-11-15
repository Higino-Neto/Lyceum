import path from "node:path";
import { createManifest, mergeBookMetadata, mergeDefinedBookMetadata } from "../schema/manifest";
import type {
  BookFormat,
  ImportInput,
  ImportResult,
  LyceumBookMetadata,
  LyceumTextualChapter,
  LyceumTextualResource,
  LyceumTocItem,
} from "../schema/types";
import { buildTextualContent, escapeXml, stripHtml } from "../textual";
import { writeLyceumPackageAsync } from "../package/write";
import { sanitizeHtmlDocument } from "../epub/htmlSanitizer";

/**
 * Shared last step of the importers that turn a non-EPUB book (MOBI, DOCX,
 * FB2...) into HTML chapters. Callers emit chapters as HTML that lives in
 * `text/`, so images are referenced as `../images/...`.
 *
 * Internal links can be written two ways:
 * - `href="#anchor"`: the anchor id is looked up in every chapter, so a note
 *   in a later chapter resolves without the caller tracking files.
 * - `href="lyceum-chapter:3#anchor"`: an explicit chapter index (0-based), for
 *   formats whose ids are only unique per file (KF8).
 */
export interface AssembledChapter {
  title?: string;
  /** Full HTML document or a body fragment. */
  html: string;
}

export interface AssembledResource {
  href: string;
  mediaType: string;
  data: Uint8Array;
  isCover?: boolean;
}

export interface AssembledTocEntry {
  title: string;
  chapterIndex: number;
  anchor?: string;
  level: number;
}

export interface AssembledBook {
  metadata: Partial<LyceumBookMetadata>;
  chapters: AssembledChapter[];
  resources: AssembledResource[];
  /** Hrefs of CSS resources linked from every fragment chapter. */
  stylesheets?: string[];
  toc?: AssembledTocEntry[];
  warnings?: string[];
  stats?: Record<string, number | string | boolean>;
}

export const CHAPTER_LINK_PREFIX = "lyceum-chapter:";

function chapterHref(index: number) {
  return `text/chapter-${String(index + 1).padStart(3, "0")}.xhtml`;
}

function firstHeadingText(html: string): string {
  const match = /<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>/i.exec(html);
  return match ? stripHtml(match[1]).replace(/\s+/g, " ").trim() : "";
}

function collectIds(html: string): string[] {
  const ids: string[] = [];
  const pattern = /\sid\s*=\s*["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html))) ids.push(match[1]);
  return ids;
}

function wrapFragment(title: string, body: string, stylesheets: string[]) {
  const links = stylesheets
    .map((href) => `<link rel="stylesheet" type="text/css" href="../${escapeXml(href)}" />`)
    .join("");
  return `<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml"><head><meta charset="utf-8" /><title>${escapeXml(title)}</title>${links}</head><body>${body}</body></html>`;
}

function rewriteLinks(
  html: string,
  ownIndex: number,
  anchorOwner: Map<string, number>,
  chapterCount: number,
) {
  return html.replace(/\shref\s*=\s*(["'])([^"']*)\1/gi, (match, quote: string, value: string) => {
    if (value.startsWith(CHAPTER_LINK_PREFIX)) {
      const [indexPart, anchor] = value.slice(CHAPTER_LINK_PREFIX.length).split("#", 2);
      const target = Math.min(Math.max(Number.parseInt(indexPart, 10) || 0, 0), chapterCount - 1);
      const file = target === ownIndex ? "" : path.posix.basename(chapterHref(target));
      const href = `${file}${anchor ? `#${anchor}` : ""}` || "#";
      return ` href=${quote}${escapeXml(href)}${quote}`;
    }
    if (value.startsWith("#") && value.length > 1) {
      const anchor = value.slice(1);
      const owner = anchorOwner.get(anchor);
      if (owner !== undefined && owner !== ownIndex) {
        return ` href=${quote}${path.posix.basename(chapterHref(owner))}#${escapeXml(anchor)}${quote}`;
      }
    }
    return match;
  });
}

function toXhtml(rawHtml: string, title: string, warnings: string[]) {
  try {
    return sanitizeHtmlDocument(rawHtml, title).xhtml;
  } catch (error) {
    warnings.push(`Capitulo "${title}" reduzido a texto: ${error instanceof Error ? error.message : String(error)}`);
    const text = stripHtml(rawHtml);
    return sanitizeHtmlDocument(wrapFragment(title, `<p>${escapeXml(text)}</p>`, []), title).xhtml;
  }
}

export async function writeAssembledBook(
  input: ImportInput,
  sourceFormat: BookFormat,
  book: AssembledBook,
): Promise<ImportResult> {
  const warnings = [...(book.warnings || [])];
  const fallbackTitle = path.basename(input.sourcePath, path.extname(input.sourcePath));
  const chapters = book.chapters.filter((chapter) => chapter.html.trim().length > 0);
  if (chapters.length === 0) chapters.push({ title: fallbackTitle, html: "<p></p>" });

  const resources: LyceumTextualResource[] = book.resources.map((resource, index) => ({
    id: `res-${String(index + 1).padStart(4, "0")}`,
    href: resource.href,
    mediaType: resource.mediaType,
    properties: resource.isCover ? "cover-image" : undefined,
    data: resource.data,
  }));
  const cover = resources.find((resource) => resource.properties === "cover-image");

  const extracted = mergeBookMetadata(fallbackTitle, {
    ...book.metadata,
    coverResourceId: cover?.id,
    coverHref: cover?.href,
  });
  const metadata = mergeDefinedBookMetadata(extracted, input.metadata);

  const anchorOwner = new Map<string, number>();
  chapters.forEach((chapter, index) => {
    for (const id of collectIds(chapter.html)) {
      if (!anchorOwner.has(id)) anchorOwner.set(id, index);
    }
  });

  const stylesheets = book.stylesheets || [];
  const textualChapters: LyceumTextualChapter[] = chapters.map((chapter, index) => {
    const title = chapter.title?.trim()
      || firstHeadingText(chapter.html)
      || (chapters.length === 1 ? metadata.title : `${metadata.title} ${index + 1}`);
    const linked = rewriteLinks(chapter.html, index, anchorOwner, chapters.length);
    const document = /<html\b/i.test(linked) ? linked : wrapFragment(title, linked, stylesheets);
    return {
      id: `chapter-${String(index + 1).padStart(3, "0")}`,
      href: chapterHref(index),
      title,
      xhtml: toXhtml(document, title, warnings),
      mediaType: "application/xhtml+xml",
    };
  });

  const toc: LyceumTocItem[] | undefined = book.toc?.length
    ? book.toc
      .filter((entry) => entry.chapterIndex >= 0 && entry.chapterIndex < textualChapters.length && entry.title.trim())
      .map((entry, index) => ({
        id: `toc-${String(index + 1).padStart(4, "0")}`,
        href: `${chapterHref(entry.chapterIndex)}${entry.anchor ? `#${entry.anchor}` : ""}`,
        title: entry.title.trim(),
        level: Math.max(1, entry.level),
      }))
    : undefined;

  const textual = buildTextualContent(textualChapters, {
    resources,
    toc: toc && toc.length > 0 ? toc : undefined,
  });
  const manifest = createManifest({
    sourcePath: input.sourcePath,
    sourceFormat,
    metadata,
    primaryContentKind: "textual",
    contentKinds: ["textual"],
  });
  const pkg = await writeLyceumPackageAsync({
    rootPath: input.packageRoot,
    manifest,
    metadata,
    textual,
    sourcePath: input.sourcePath,
  });

  return {
    package: pkg,
    report: {
      sourceFormat,
      contentKinds: ["textual"],
      warnings,
      stats: {
        chapterCount: textualChapters.length,
        resourceCount: resources.length,
        wordCount: textual.fulltext.split(/\s+/).filter(Boolean).length,
        ...book.stats,
      },
    },
  };
}

export function imageMediaType(data: Uint8Array): { mediaType: string; extension: string } | null {
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return { mediaType: "image/jpeg", extension: "jpg" };
  if (data.length >= 8 && data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47) return { mediaType: "image/png", extension: "png" };
  if (data.length >= 4 && data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x38) return { mediaType: "image/gif", extension: "gif" };
  if (data.length >= 12 && data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46
    && data[8] === 0x57 && data[9] === 0x45 && data[10] === 0x42 && data[11] === 0x50) return { mediaType: "image/webp", extension: "webp" };
  if (data.length >= 2 && data[0] === 0x42 && data[1] === 0x4d) return { mediaType: "image/bmp", extension: "bmp" };
  const head = new TextDecoder().decode(data.subarray(0, 256)).trimStart();
  if (head.startsWith("<svg") || (head.startsWith("<?xml") && head.includes("<svg"))) return { mediaType: "image/svg+xml", extension: "svg" };
  return null;
}
