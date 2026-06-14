import fs from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";
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
import { buildTextualContent, isPlaceholderTitle, stripHtml } from "../textual";
import { textualRelativePath } from "../package/paths";
import { writeLyceumPackageAsync } from "../package/write";
import { decodeTextBytes, parseContainerXml, parseXmlDocument } from "../epub/containerParser";
import {
  hasManifestProperty,
  isContentDocument,
  isNavigationDocument,
  isNcxDocument,
  parseOpfDocument,
} from "../epub/opfParser";
import {
  buildResourceGraph,
  dirname,
  hrefRelativeToOpf,
  inferMediaType,
  markExtraResourceProperties,
  normalizeZipPath,
  resolveZipPath,
  splitHref,
  type EpubResourceGraphItem,
} from "../epub/resourceGraph";
import { hasMeaningfulHtmlContent, sanitizeHtmlDocument } from "../epub/htmlSanitizer";

interface ParsedNavigation {
  titlesByPath: Map<string, string>;
  toc: LyceumTocItem[];
  coverPageHref?: string;
}

interface ParsedEpub {
  metadata: Partial<LyceumBookMetadata>;
  textual: LyceumTextualContent;
  warnings: string[];
}

const XHTML_MEDIA_TYPE = "application/xhtml+xml";

function getEntry(zip: JSZip, entryPath: string): JSZipObject | null {
  const normalized = normalizeZipPath(entryPath);
  return zip.file(normalized)
    || Object.values(zip.files).find((entry) => !entry.dir && normalizeZipPath(entry.name).toLowerCase() === normalized.toLowerCase())
    || null;
}

async function getEntryBytes(zip: JSZip, entryPath: string): Promise<Uint8Array | null> {
  const entry = getEntry(zip, entryPath);
  return entry ? entry.async("uint8array") : null;
}

async function getEntryText(zip: JSZip, entryPath: string): Promise<string | null> {
  const bytes = await getEntryBytes(zip, entryPath);
  return bytes ? decodeTextBytes(bytes) : null;
}

function safeId(value: string, fallback: string) {
  const id = value
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/^-+|-+$/g, "");
  return id || fallback;
}

function appendManifestProperty(properties: string | undefined, property: string) {
  const parts = (properties || "").split(/\s+/).filter(Boolean);
  if (!property) return parts.join(" ");
  if (!parts.includes(property)) parts.push(property);
  return parts.join(" ");
}

function packageHrefForZipPath(baseDirectory: string, zipPath: string, fallback: string, suffix = "") {
  return `${textualRelativePath(hrefRelativeToOpf(baseDirectory, zipPath), fallback)}${suffix}`;
}

function attr(element: Element, name: string) {
  return element.getAttribute(name) || "";
}

function directElementChildren(element: Element, localName?: string) {
  return Array.from(element.children).filter((child) => !localName || child.localName === localName) as Element[];
}

function directFirst(element: Element, localName: string) {
  return directElementChildren(element, localName)[0] || null;
}

function navType(element: Element) {
  return attr(element, "epub:type") || attr(element, "type");
}

function parseNavList(args: {
  list: Element;
  level: number;
  navDirectory: string;
  baseDirectory: string;
  titlesByPath: Map<string, string>;
  toc: LyceumTocItem[];
}) {
  for (const li of directElementChildren(args.list, "li")) {
    const link = directElementChildren(li).find((child) => child.localName === "a") || null;
    if (link) {
      const href = attr(link, "href");
      const title = stripHtml(link.textContent || "");
      if (href && !isPlaceholderTitle(title)) {
        const { suffix } = splitHref(href);
        const targetPath = resolveZipPath(args.navDirectory, href);
        const packageHref = packageHrefForZipPath(args.baseDirectory, targetPath, `toc-${args.toc.length + 1}.xhtml`, suffix);
        args.titlesByPath.set(targetPath.toLowerCase(), title);
        args.toc.push({
          id: `toc-${String(args.toc.length + 1).padStart(3, "0")}`,
          href: packageHref,
          title,
          level: args.level,
        });
      }
    }

    for (const childList of directElementChildren(li, "ol")) {
      parseNavList({ ...args, list: childList, level: args.level + 1 });
    }
  }
}

function parseNavigationItems(nav: string, navDirectory: string, baseDirectory: string): ParsedNavigation {
  const document = new JSDOM(nav, { contentType: "text/html" }).window.document;
  const titlesByPath = new Map<string, string>();
  const toc: LyceumTocItem[] = [];
  let coverPageHref: string | undefined;
  const navElements = Array.from(document.querySelectorAll("nav")) as Element[];
  const tocNav = navElements.find((navElement) => /\btoc\b/i.test(navType(navElement))) || navElements[0];

  if (tocNav) {
    const list = tocNav.querySelector("ol");
    if (list) {
      parseNavList({ list, level: 1, navDirectory, baseDirectory, titlesByPath, toc });
    }
  }

  const landmarks = navElements.find((navElement) => /\blandmarks\b/i.test(navType(navElement)));
  const coverLink = landmarks
    ? Array.from(landmarks.querySelectorAll("a")).find((link) => /\bcover\b/i.test(navType(link)))
    : undefined;
  const coverHref = coverLink ? attr(coverLink, "href") : "";
  if (coverHref) {
    const { suffix } = splitHref(coverHref);
    const targetPath = resolveZipPath(navDirectory, coverHref);
    coverPageHref = packageHrefForZipPath(baseDirectory, targetPath, "cover.xhtml", suffix);
  }

  return { titlesByPath, toc, coverPageHref };
}

function parseNcxNavPoint(args: {
  navPoint: Element;
  level: number;
  ncxDirectory: string;
  baseDirectory: string;
  titlesByPath: Map<string, string>;
  toc: LyceumTocItem[];
}) {
  const text = stripHtml(args.navPoint.querySelector("navLabel text")?.textContent || "");
  const href = args.navPoint.querySelector("content")?.getAttribute("src") || "";
  if (text && href) {
    const { suffix } = splitHref(href);
    const targetPath = resolveZipPath(args.ncxDirectory, href);
    const packageHref = packageHrefForZipPath(args.baseDirectory, targetPath, `toc-ncx-${args.toc.length + 1}.xhtml`, suffix);
    args.titlesByPath.set(targetPath.toLowerCase(), text);
    args.toc.push({
      id: safeId(attr(args.navPoint, "id"), `toc-ncx-${String(args.toc.length + 1).padStart(3, "0")}`),
      href: packageHref,
      title: text,
      level: args.level,
    });
  }

  for (const child of directElementChildren(args.navPoint, "navPoint")) {
    parseNcxNavPoint({ ...args, navPoint: child, level: args.level + 1 });
  }
}

function parseNcxNavMap(ncx: string, ncxDirectory: string, baseDirectory: string): ParsedNavigation {
  const titlesByPath = new Map<string, string>();
  const toc: LyceumTocItem[] = [];
  const document = parseXmlDocument(ncx, "NCX");
  const navMap = Array.from(document.getElementsByTagName("*")).find((element) => element.localName === "navMap");
  if (!navMap) return { titlesByPath, toc };

  for (const navPoint of directElementChildren(navMap, "navPoint")) {
    parseNcxNavPoint({ navPoint, level: 1, ncxDirectory, baseDirectory, titlesByPath, toc });
  }

  return { titlesByPath, toc };
}

async function parseNavigation(zip: JSZip, baseDirectory: string, graphItems: EpubResourceGraphItem[]) {
  const titlesByPath = new Map<string, string>();
  const toc: LyceumTocItem[] = [];
  let coverPageHref: string | undefined;

  for (const item of graphItems.filter(isNavigationDocument)) {
    const nav = await getEntryText(zip, item.zipPath);
    if (!nav) continue;
    const parsed = parseNavigationItems(nav, dirname(item.zipPath), baseDirectory);
    for (const [targetPath, title] of parsed.titlesByPath) titlesByPath.set(targetPath, title);
    toc.push(...parsed.toc);
    coverPageHref ||= parsed.coverPageHref;
  }

  for (const item of graphItems.filter(isNcxDocument)) {
    const ncx = await getEntryText(zip, item.zipPath);
    if (!ncx) continue;
    const parsed = parseNcxNavMap(ncx, dirname(item.zipPath), baseDirectory);
    for (const [targetPath, title] of parsed.titlesByPath) {
      if (!titlesByPath.has(targetPath.toLowerCase())) titlesByPath.set(targetPath.toLowerCase(), title);
    }
    toc.push(...parsed.toc);
  }

  return { titlesByPath, toc, coverPageHref };
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

function chooseChapterTitle(args: {
  index: number;
  htmlTitle?: string;
  headingTitle?: string;
  navTitle?: string;
}) {
  return args.navTitle
    || (isPlaceholderTitle(args.htmlTitle) ? undefined : args.htmlTitle)
    || (isPlaceholderTitle(args.headingTitle) ? undefined : args.headingTitle)
    || `Capitulo ${args.index}`;
}

async function readItemBytesWithFallback(zip: JSZip, item: EpubResourceGraphItem, graphItems: Map<string, EpubResourceGraphItem>, warnings: string[]) {
  const data = await getEntryBytes(zip, item.zipPath);
  if (data) return { data, item };

  for (const fallbackId of item.fallbackChain) {
    const fallback = graphItems.get(fallbackId);
    if (!fallback) continue;
    const fallbackData = await getEntryBytes(zip, fallback.zipPath);
    if (fallbackData) {
      warnings.push(`Recurso ${item.zipPath} ausente; usando fallback ${fallback.zipPath}.`);
      return { data: fallbackData, item: fallback };
    }
  }

  warnings.push(`Recurso nao encontrado: ${item.zipPath}`);
  return null;
}

export async function parseEpubBufferToTextual(epubBuffer: Buffer | Uint8Array | ArrayBuffer): Promise<ParsedEpub> {
  const zip = await JSZip.loadAsync(epubBuffer);
  const container = await getEntryText(zip, "META-INF/container.xml");
  if (!container) throw new Error("EPUB invalido: container.xml nao encontrado");

  const parsedContainer = parseContainerXml(container);
  const opf = await getEntryText(zip, parsedContainer.opfPath);
  if (!opf) throw new Error("Arquivo OPF do EPUB nao encontrado");

  const parsedOpf = parseOpfDocument(opf);
  const baseDirectory = dirname(parsedContainer.opfPath);
  const warnings = [
    ...parsedContainer.warnings,
    ...parsedOpf.warnings,
  ];
  const graph = await buildResourceGraph({
    opf: parsedOpf,
    opfPath: parsedContainer.opfPath,
    readText: (zipPath) => getEntryText(zip, zipPath),
  });
  warnings.push(...graph.warnings);

  const graphItems = [...graph.items.values()];
  const navigation = await parseNavigation(zip, baseDirectory, graphItems);
  const chapters: LyceumTextualChapter[] = [];
  const resources: LyceumTextualResource[] = [];
  const chapterZipPaths = new Set<string>();

  const addChapter = async (item: EpubResourceGraphItem) => {
    if (!isContentDocument(item) || isNavigationDocument(item)) return;
    if (chapterZipPaths.has(item.zipPath.toLowerCase())) return;

    const rawChapter = await getEntryText(zip, item.zipPath);
    if (!rawChapter) {
      warnings.push(`Capitulo nao encontrado: ${item.zipPath}`);
      return;
    }

    const index = chapters.length + 1;
    const provisional = sanitizeHtmlDocument(rawChapter, `Capitulo ${index}`);
    const navTitle = navigation.titlesByPath.get(item.zipPath.toLowerCase());
    const title = chooseChapterTitle({
      index,
      htmlTitle: provisional.title,
      headingTitle: provisional.headingTitle,
      navTitle,
    });
    const sanitized = sanitizeHtmlDocument(rawChapter, title);

    if (!hasMeaningfulHtmlContent(sanitized.xhtml)) {
      warnings.push(`Capitulo sem conteudo exportavel: ${item.zipPath}`);
      return;
    }

    chapters.push({
      id: safeId(item.id, `chapter-${String(index).padStart(3, "0")}`),
      href: item.packageHref,
      title,
      xhtml: sanitized.xhtml,
      mediaType: item.mediaType || XHTML_MEDIA_TYPE,
      properties: item.properties || undefined,
    });
    chapterZipPaths.add(item.zipPath.toLowerCase());
  };

  for (const item of graph.linearSpineItems) {
    await addChapter(item);
  }

  if (chapters.length === 0) {
    warnings.push("Spine ausente ou vazio; usando documentos HTML do manifesto.");
    for (const item of graphItems) {
      await addChapter(item);
    }
  }

  for (const item of graphItems) {
    const isChapter = chapterZipPaths.has(item.zipPath.toLowerCase());
    if (isChapter || isNavigationDocument(item)) continue;

    const data = await readItemBytesWithFallback(zip, item, graph.items, warnings);
    if (!data) continue;

    const resolvedItem = data.item;
    const isCover = parsedOpf.metaCoverId === item.id || hasManifestProperty(item, "cover-image");
    const resource: LyceumTextualResource = {
      id: safeId(item.id, `resource-${resources.length + 1}`),
      href: item.packageHref,
      mediaType: resolvedItem.mediaType || inferMediaType(resolvedItem.href),
      properties: appendManifestProperty(item.properties || "", isCover ? "cover-image" : "") || undefined,
      data: data.data,
    };
    resources.push(markExtraResourceProperties(resource, item));
  }

  const hasCover = resources.some((resource) => resource.properties?.split(/\s+/).includes("cover-image"));
  if (!hasCover) {
    const firstImage = resources.find((resource) => resource.mediaType.startsWith("image/"));
    if (firstImage) {
      firstImage.properties = appendManifestProperty(firstImage.properties, "cover-image") || undefined;
    }
  }

  const chaptersByHref = new Map(chapters.map((chapter) => [chapter.href.toLowerCase(), chapter]));
  const toc = tocWithChapterIds(navigation.toc, chaptersByHref).filter((item) => (
    chaptersByHref.has(item.href.split("#")[0].toLowerCase())
  ));
  const coverResource = resources.find((resource) => resource.properties?.split(/\s+/).includes("cover-image"));

  return {
    metadata: {
      ...parsedOpf.metadata,
      coverResourceId: coverResource?.id,
      coverHref: coverResource?.href,
      coverPageHref: navigation.coverPageHref || graph.coverPageHref,
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
