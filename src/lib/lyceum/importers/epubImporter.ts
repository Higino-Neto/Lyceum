import fs from "node:fs";
import path from "node:path";
import JSZip, { type JSZipObject } from "jszip";
import { createManifest, mergeBookMetadata } from "../schema/manifest";
import type {
  ImportInput,
  ImportResult,
  LyceumImporter,
  LyceumTextualChapter,
} from "../schema/types";
import { buildTextualContent, extractBodyHtml, stripHtml, wrapTextAsXhtml } from "../textual";
import { writeLyceumPackage } from "../package/write";

interface ManifestItem {
  id: string;
  href: string;
  mediaType: string;
  properties: string;
}

function normalizeZipPath(value: string) {
  return value.replace(/\\/g, "/").replace(/^\/+/, "");
}

function dirname(value: string) {
  const normalized = normalizeZipPath(value);
  const index = normalized.lastIndexOf("/");
  return index >= 0 ? normalized.slice(0, index + 1) : "";
}

function resolveZipPath(baseDirectory: string, href: string) {
  const cleanHref = href.split("#")[0].split("?")[0];
  const decodedHref = decodeURIComponent(cleanHref);
  const parts = `${baseDirectory}${decodedHref}`.split("/");
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

function getAttribute(value: string, attribute: string): string | null {
  const pattern = new RegExp(`\\b${attribute}\\s*=\\s*["']([^"']+)["']`, "i");
  return value.match(pattern)?.[1] || null;
}

function getTagText(value: string, tagName: string): string | undefined {
  const pattern = new RegExp(`<[^:>]*(?::)?${tagName}[^>]*>([\\s\\S]*?)<\\/[^:>]*(?::)?${tagName}>`, "i");
  const text = value.match(pattern)?.[1];
  const cleaned = text ? stripHtml(text) : "";
  return cleaned || undefined;
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
  return /xhtml|html/i.test(item.mediaType) || /\.(xhtml|html?)$/i.test(item.href);
}

function isNavigationDocument(item: ManifestItem) {
  return /\bnav\b/i.test(item.properties) || /(^|\/)(toc|nav|navigation)\.(xhtml|html?)$/i.test(item.href);
}

async function parseEpubToTextual(zip: JSZip) {
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
  const seenPaths = new Set<string>();

  const addChapter = async (item: ManifestItem) => {
    if (!isContentDocument(item) || isNavigationDocument(item)) return;

    const chapterPath = resolveZipPath(baseDirectory, item.href);
    if (seenPaths.has(chapterPath)) return;

    const chapter = await getEntryText(zip, chapterPath);
    if (!chapter) {
      warnings.push(`Capitulo nao encontrado: ${chapterPath}`);
      return;
    }

    const text = stripHtml(extractBodyHtml(chapter));
    if (!text) {
      warnings.push(`Capitulo sem texto legivel: ${chapterPath}`);
      return;
    }

    const index = chapters.length + 1;
    const title = getTagText(chapter, "title") || `Capitulo ${index}`;
    chapters.push({
      id: `chapter-${String(index).padStart(3, "0")}`,
      href: `chapter-${String(index).padStart(3, "0")}.xhtml`,
      title,
      xhtml: wrapTextAsXhtml(title, [text]),
    });
    seenPaths.add(chapterPath);
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

  return {
    metadata: {
      title: getTagText(opf, "title"),
      author: getTagText(opf, "creator"),
      language: getTagText(opf, "language"),
      identifier: getTagText(opf, "identifier"),
      publisher: getTagText(opf, "publisher"),
      description: getTagText(opf, "description"),
    },
    textual: buildTextualContent(chapters),
    warnings,
  };
}

export class EpubImporter implements LyceumImporter {
  inputFormat = "epub" as const;

  async import(input: ImportInput): Promise<ImportResult> {
    const zip = await JSZip.loadAsync(fs.readFileSync(input.sourcePath));
    const parsed = await parseEpubToTextual(zip);
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
    const pkg = writeLyceumPackage({
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
          wordCount: parsed.textual.fulltext.split(/\s+/).filter(Boolean).length,
        },
      },
    };
  }
}

