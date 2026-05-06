import JSZip, { JSZipObject } from "jszip";
import type { NavItem } from "../types";

export interface InternalEpubChapter {
  id: string;
  href: string;
  label: string;
  html: string;
  text: string;
  linear: boolean;
}

export interface InternalEpubBook {
  title: string;
  chapters: InternalEpubChapter[];
  toc: NavItem[];
  cssText: string;
  objectUrls: string[];
}

interface ManifestItem {
  id: string;
  href: string;
  mediaType: string;
  properties: string;
}

interface SpineItem {
  idref: string;
  linear: boolean;
}

interface ParserContext {
  zip: JSZip;
  manifestByPath: Map<string, ManifestItem>;
  objectUrlCache: Map<string, string>;
  objectUrls: string[];
}

const XML_MIME = "application/xml";
const XHTML_MIME = "application/xhtml+xml";
const HTML_MIME = "text/html";
const XLINK_NS = "http://www.w3.org/1999/xlink";

function parseXml(source: string, label: string) {
  const doc = new DOMParser().parseFromString(source, XML_MIME);
  const error = doc.querySelector("parsererror");

  if (error) {
    throw new Error(`EPUB invalido: nao foi possivel ler ${label}.`);
  }

  return doc;
}

function parseHtml(source: string) {
  return new DOMParser().parseFromString(source, HTML_MIME);
}

function getElementsByLocalName(root: ParentNode, localName: string) {
  return Array.from(root.querySelectorAll("*")).filter(
    (element) => element.localName.toLowerCase() === localName.toLowerCase(),
  );
}

function getDirectChildrenByLocalName(element: Element | null | undefined, localName: string) {
  if (!element) return [];

  return Array.from(element.children).filter(
    (child) => child.localName.toLowerCase() === localName.toLowerCase(),
  );
}

function getFirstByLocalName(root: ParentNode, localName: string) {
  return getElementsByLocalName(root, localName)[0] || null;
}

function decodePath(path: string) {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

function normalizePath(path: string) {
  const cleanPath = decodePath(path)
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");
  const parts: string[] = [];

  for (const part of cleanPath.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      parts.pop();
      continue;
    }
    parts.push(part);
  }

  return parts.join("/");
}

function splitHref(value: string) {
  const [withoutHash, ...hashParts] = value.split("#");
  const [pathPart] = withoutHash.split("?");

  return {
    path: pathPart,
    hash: hashParts.join("#"),
  };
}

function getDirectory(path: string) {
  const normalized = normalizePath(path);
  const index = normalized.lastIndexOf("/");
  return index >= 0 ? normalized.slice(0, index) : "";
}

export function resolveEpubHref(fromPath: string, href: string) {
  const trimmed = href.trim();
  if (!trimmed || isExternalUrl(trimmed)) {
    return trimmed;
  }

  const { path, hash } = splitHref(trimmed);
  const basePath = path
    ? normalizePath(`${getDirectory(fromPath)}/${path}`)
    : normalizePath(fromPath);

  return hash ? `${basePath}#${hash}` : basePath;
}

export function normalizeEpubPath(value: string) {
  return normalizePath(splitHref(value).path || value);
}

function isExternalUrl(value: string) {
  return /^(?:https?:|mailto:|tel:|data:|blob:)/i.test(value);
}

function isUnsafeUrl(value: string) {
  return /^\s*javascript:/i.test(value);
}

function getZipFile(zip: JSZip, path: string): JSZipObject | null {
  const normalized = normalizeEpubPath(path);
  return (
    zip.file(normalized) ||
    zip.file(decodePath(normalized)) ||
    zip.file(normalized.replace(/%20/g, " ")) ||
    null
  );
}

async function readZipText(zip: JSZip, path: string, label = path) {
  const file = getZipFile(zip, path);
  if (!file) {
    throw new Error(`EPUB invalido: arquivo ausente (${label}).`);
  }

  return file.async("text");
}

function inferMimeType(path: string) {
  const extension = path.toLowerCase().split(".").pop();

  switch (extension) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "gif":
      return "image/gif";
    case "svg":
      return "image/svg+xml";
    case "webp":
      return "image/webp";
    case "avif":
      return "image/avif";
    case "css":
      return "text/css";
    case "otf":
      return "font/otf";
    case "ttf":
      return "font/ttf";
    case "woff":
      return "font/woff";
    case "woff2":
      return "font/woff2";
    case "mp3":
      return "audio/mpeg";
    case "mp4":
      return "video/mp4";
    default:
      return "application/octet-stream";
  }
}

async function createResourceUrl(context: ParserContext, path: string) {
  const normalized = normalizeEpubPath(path);
  if (!normalized) return null;

  const cached = context.objectUrlCache.get(normalized);
  if (cached) {
    return cached;
  }

  const file = getZipFile(context.zip, normalized);
  if (!file) {
    return null;
  }

  const mimeType =
    context.manifestByPath.get(normalized)?.mediaType || inferMimeType(normalized);

  if (typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
    const blob = await file.async("blob");
    const typedBlob = blob.type === mimeType ? blob : new Blob([blob], { type: mimeType });
    const objectUrl = URL.createObjectURL(typedBlob);
    context.objectUrlCache.set(normalized, objectUrl);
    context.objectUrls.push(objectUrl);
    return objectUrl;
  }

  const base64 = await file.async("base64");
  const dataUrl = `data:${mimeType};base64,${base64}`;
  context.objectUrlCache.set(normalized, dataUrl);
  return dataUrl;
}

async function rewriteCssUrls(context: ParserContext, cssPath: string, cssText: string) {
  const urlPattern = /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi;
  let result = "";
  let lastIndex = 0;

  for (const match of cssText.matchAll(urlPattern)) {
    const fullMatch = match[0];
    const rawUrl = match[2]?.trim() || "";
    const index = match.index ?? 0;

    result += cssText.slice(lastIndex, index);

    if (!rawUrl || isExternalUrl(rawUrl) || isUnsafeUrl(rawUrl)) {
      result += isUnsafeUrl(rawUrl) ? "url(\"\")" : fullMatch;
      lastIndex = index + fullMatch.length;
      continue;
    }

    const resolved = resolveEpubHref(cssPath, rawUrl);
    const objectUrl = await createResourceUrl(context, resolved);
    result += objectUrl ? `url("${objectUrl}")` : "url(\"\")";
    lastIndex = index + fullMatch.length;
  }

  result += cssText.slice(lastIndex);
  return result;
}

function isHtmlMediaType(mediaType: string) {
  const normalized = mediaType.toLowerCase();
  return [XHTML_MIME, HTML_MIME, "application/xml", "text/xml"].some((type) =>
    normalized.startsWith(type),
  );
}

function getElementText(element: Element | null | undefined) {
  return (element?.textContent || "").replace(/\s+/g, " ").trim();
}

function getAttribute(element: Element, name: string) {
  return element.getAttribute(name) || element.getAttributeNS(XLINK_NS, name) || "";
}

function buildManifest(opfDocument: Document, opfPath: string) {
  const manifestElement = getFirstByLocalName(opfDocument, "manifest");
  const manifestItems = getDirectChildrenByLocalName(manifestElement, "item");
  const manifestById = new Map<string, ManifestItem>();
  const manifestByPath = new Map<string, ManifestItem>();

  manifestItems.forEach((element) => {
    const id = element.getAttribute("id") || "";
    const href = element.getAttribute("href") || "";
    if (!id || !href) return;

    const item: ManifestItem = {
      id,
      href: normalizeEpubPath(resolveEpubHref(opfPath, href)),
      mediaType: element.getAttribute("media-type") || "",
      properties: element.getAttribute("properties") || "",
    };

    manifestById.set(id, item);
    manifestByPath.set(item.href, item);
  });

  return { manifestById, manifestByPath };
}

function buildSpine(opfDocument: Document) {
  const spineElement = getFirstByLocalName(opfDocument, "spine");
  const itemRefs = getDirectChildrenByLocalName(spineElement, "itemref");

  return itemRefs
    .map<SpineItem>((element) => ({
      idref: element.getAttribute("idref") || "",
      linear: element.getAttribute("linear") !== "no",
    }))
    .filter((item) => Boolean(item.idref));
}

function getBookTitle(opfDocument: Document) {
  return getElementText(getFirstByLocalName(opfDocument, "title")) || "EPUB";
}

function findTocNavElement(navDocument: Document) {
  const navElements = Array.from(navDocument.getElementsByTagName("nav"));

  return (
    navElements.find((nav) => {
      const type = `${nav.getAttribute("epub:type") || ""} ${nav.getAttribute("type") || ""}`;
      return /\btoc\b/i.test(type);
    }) ||
    navElements[0] ||
    null
  );
}

function findFirstDirectLabelElement(li: Element) {
  return Array.from(li.children).find((child) => {
    const name = child.localName.toLowerCase();
    return name === "a" || name === "span";
  }) || null;
}

function parseNavList(listElement: Element | null, navPath: string, level = 0): NavItem[] {
  if (!listElement) return [];

  return getDirectChildrenByLocalName(listElement, "li")
    .map((li, index) => {
      const labelElement = findFirstDirectLabelElement(li);
      const nestedList = getDirectChildrenByLocalName(li, "ol")[0] || null;
      const href = labelElement?.localName.toLowerCase() === "a"
        ? getAttribute(labelElement, "href")
        : "";
      const resolvedHref = href ? resolveEpubHref(navPath, href) : "";
      const label = getElementText(labelElement) || `Secao ${index + 1}`;
      const id = li.getAttribute("id") || resolvedHref || `nav-${level}-${index}`;

      return {
        id,
        label,
        href: resolvedHref,
        subitems: parseNavList(nestedList, navPath, level + 1),
      };
    })
    .filter((item) => item.href || item.subitems?.length);
}

async function parseNavToc(context: ParserContext, navItem: ManifestItem | undefined) {
  if (!navItem) return [];

  try {
    const navText = await readZipText(context.zip, navItem.href, "nav.xhtml");
    const navDocument = parseHtml(navText);
    const navElement = findTocNavElement(navDocument);
    const listElement = navElement
      ? getDirectChildrenByLocalName(navElement, "ol")[0] || navElement.querySelector("ol")
      : null;

    return parseNavList(listElement, navItem.href);
  } catch {
    return [];
  }
}

function parseNcxNavPoints(navPointElements: Element[], ncxPath: string, level = 0): NavItem[] {
  return navPointElements.map((navPoint, index) => {
    const label = getElementText(getFirstByLocalName(navPoint, "text")) || `Secao ${index + 1}`;
    const content = getFirstByLocalName(navPoint, "content");
    const src = content?.getAttribute("src") || "";
    const childPoints = getDirectChildrenByLocalName(navPoint, "navPoint");

    return {
      id: navPoint.getAttribute("id") || `ncx-${level}-${index}`,
      label,
      href: src ? resolveEpubHref(ncxPath, src) : "",
      subitems: parseNcxNavPoints(childPoints, ncxPath, level + 1),
    };
  });
}

async function parseNcxToc(context: ParserContext, ncxItem: ManifestItem | undefined) {
  if (!ncxItem) return [];

  try {
    const ncxText = await readZipText(context.zip, ncxItem.href, "toc.ncx");
    const ncxDocument = parseXml(ncxText, "toc.ncx");
    const navMap = getFirstByLocalName(ncxDocument, "navMap");
    return parseNcxNavPoints(getDirectChildrenByLocalName(navMap, "navPoint"), ncxItem.href);
  } catch {
    return [];
  }
}

async function sanitizeElement(context: ParserContext, chapterPath: string, element: Element) {
  const tagName = element.localName.toLowerCase();

  if (["script", "iframe", "object", "embed", "form", "input", "button", "textarea", "select"].includes(tagName)) {
    element.remove();
    return;
  }

  if (tagName === "link") {
    element.remove();
    return;
  }

  if (["img", "image", "video"].includes(tagName)) {
    element.setAttribute("loading", "lazy");
    element.setAttribute("decoding", "async");
  }

  for (const attribute of Array.from(element.attributes)) {
    const attributeName = attribute.name;
    const normalizedName = attributeName.toLowerCase();
    const value = attribute.value || "";

    if (normalizedName.startsWith("on")) {
      element.removeAttribute(attributeName);
      continue;
    }

    if (normalizedName === "srcset") {
      element.removeAttribute(attributeName);
      continue;
    }

    if (normalizedName === "style") {
      element.setAttribute("style", await rewriteCssUrls(context, chapterPath, value));
      continue;
    }

    if (normalizedName === "href" && tagName === "a") {
      if (!value || isUnsafeUrl(value)) {
        element.removeAttribute(attributeName);
        continue;
      }

      if (/^https?:/i.test(value)) {
        element.setAttribute("target", "_blank");
        element.setAttribute("rel", "noreferrer");
        continue;
      }

      if (/^(?:mailto:|tel:)/i.test(value)) {
        continue;
      }

      const resolved = resolveEpubHref(chapterPath, value);
      element.setAttribute("href", "#");
      element.setAttribute("data-epub-href", resolved);
      continue;
    }

    const isMediaSource =
      normalizedName === "src" ||
      normalizedName === "poster" ||
      ((normalizedName === "href" || normalizedName === "xlink:href") && tagName === "image");

    if (isMediaSource) {
      if (!value || isUnsafeUrl(value) || /^https?:/i.test(value)) {
        element.removeAttribute(attributeName);
        continue;
      }

      if (isExternalUrl(value)) {
        continue;
      }

      const resolved = resolveEpubHref(chapterPath, value);
      const objectUrl = await createResourceUrl(context, resolved);

      if (objectUrl) {
        if (normalizedName === "xlink:href") {
          element.setAttributeNS(XLINK_NS, attributeName, objectUrl);
        } else {
          element.setAttribute(attributeName, objectUrl);
        }
      } else {
        element.removeAttribute(attributeName);
      }
    }
  }
}

async function sanitizeChapterHtml(context: ParserContext, chapterPath: string, source: string) {
  const document = parseHtml(source);
  const body = document.body || getFirstByLocalName(document, "body");
  if (!body) return { html: "", text: "" };

  for (const styleElement of Array.from(body.querySelectorAll("style"))) {
    styleElement.remove();
  }

  const elements = Array.from(body.querySelectorAll("*"));
  for (const element of elements) {
    await sanitizeElement(context, chapterPath, element);
  }

  return {
    html: body.innerHTML,
    text: body.textContent || "",
  };
}

function deriveFallbackToc(chapters: InternalEpubChapter[]): NavItem[] {
  return chapters.map((chapter, index) => ({
    id: `chapter-${index}`,
    label: chapter.label || `Capitulo ${index + 1}`,
    href: chapter.href,
  }));
}

async function buildBookCss(context: ParserContext, cssItems: ManifestItem[]) {
  const chunks: string[] = [];

  for (const item of cssItems) {
    try {
      const css = await readZipText(context.zip, item.href, item.href);
      chunks.push(await rewriteCssUrls(context, item.href, css));
    } catch {
      // Broken CSS should not block the book.
    }
  }

  return chunks.join("\n\n");
}

export async function parseInternalEpub(epubData: ArrayBuffer): Promise<InternalEpubBook> {
  const zip = await JSZip.loadAsync(epubData);
  const containerText = await readZipText(zip, "META-INF/container.xml", "container.xml");
  const containerDocument = parseXml(containerText, "container.xml");
  const rootFile = getFirstByLocalName(containerDocument, "rootfile");
  const opfPath = normalizeEpubPath(rootFile?.getAttribute("full-path") || "");

  if (!opfPath) {
    throw new Error("EPUB invalido: pacote OPF nao encontrado.");
  }

  const opfText = await readZipText(zip, opfPath, "package.opf");
  const opfDocument = parseXml(opfText, "package.opf");
  const { manifestById, manifestByPath } = buildManifest(opfDocument, opfPath);
  const context: ParserContext = {
    zip,
    manifestByPath,
    objectUrlCache: new Map(),
    objectUrls: [],
  };
  const spine = buildSpine(opfDocument);
  const manifestItems = Array.from(manifestById.values());
  const navItem = manifestItems.find((item) => /\bnav\b/i.test(item.properties));
  const ncxItem =
    manifestItems.find((item) => item.mediaType === "application/x-dtbncx+xml") ||
    manifestById.get(getFirstByLocalName(opfDocument, "spine")?.getAttribute("toc") || "");
  const cssText = await buildBookCss(
    context,
    manifestItems.filter((item) => item.mediaType === "text/css"),
  );

  const chapters: InternalEpubChapter[] = [];

  for (const [index, spineItem] of spine.entries()) {
    const manifestItem = manifestById.get(spineItem.idref);
    if (!manifestItem || !isHtmlMediaType(manifestItem.mediaType)) {
      continue;
    }

    try {
      const source = await readZipText(zip, manifestItem.href, manifestItem.href);
      const sanitized = await sanitizeChapterHtml(context, manifestItem.href, source);

      if (!sanitized.html.trim() && !sanitized.text.trim()) {
        continue;
      }

      chapters.push({
        id: manifestItem.id || `spine-${index}`,
        href: manifestItem.href,
        label: `Capitulo ${chapters.length + 1}`,
        html: sanitized.html,
        text: sanitized.text,
        linear: spineItem.linear,
      });
    } catch {
      // Keep loading the remaining spine if one chapter is malformed.
    }
  }

  const navToc = await parseNavToc(context, navItem);
  const toc = navToc.length ? navToc : await parseNcxToc(context, ncxItem);

  return {
    title: getBookTitle(opfDocument),
    chapters,
    toc: toc.length ? toc : deriveFallbackToc(chapters),
    cssText,
    objectUrls: context.objectUrls,
  };
}

export function releaseInternalEpubResources(book: InternalEpubBook | null) {
  if (!book || typeof URL === "undefined" || typeof URL.revokeObjectURL !== "function") {
    return;
  }

  book.objectUrls.forEach((url) => {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // Object URLs are best-effort cleanup.
    }
  });
}
