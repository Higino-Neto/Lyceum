import { decodeTextBytes } from "../../../lib/lyceum/epub/textDecoding";
import { splitTextChapters } from "../../../lib/lyceum/importers/txtChapters";

/** A chapter as XHTML, before block extraction (which runs in the worker). */
export interface RawChapter {
  id: string;
  href: string;
  title: string;
  xhtml: string;
}

export interface RawBook {
  title: string;
  metadataLanguage: string | null;
  chapters: RawChapter[];
}

function dirname(path: string) {
  const index = path.lastIndexOf("/");
  return index >= 0 ? path.slice(0, index + 1) : "";
}

/** Resolves an href relative to a zip directory; drops fragments and `..` escapes. */
export function resolveZipPath(base: string, href: string) {
  const clean = href.split("#")[0]!.split("?")[0]!;
  let decoded = clean;
  try {
    decoded = decodeURIComponent(clean);
  } catch {
    /* keep the raw href */
  }
  const parts: string[] = [];
  for (const part of `${base}${decoded}`.replace(/\\/g, "/").split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return parts.join("/");
}

function parseXml(text: string): Document {
  return new DOMParser().parseFromString(text, "application/xml");
}

function byLocalName(root: ParentNode, name: string): Element[] {
  return Array.from((root as Element | Document).getElementsByTagName("*")).filter((element) => element.localName === name);
}

function cleanText(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function safeId(value: string, fallback: string) {
  const id = value.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return id || fallback;
}

/**
 * Reads an EPUB (2 or 3) in the browser: spine order, chapter titles from the
 * EPUB 3 nav or the EPUB 2 NCX, title and language from the OPF.
 */
export async function readEpubChapters(bytes: Uint8Array, fallbackTitle: string): Promise<RawBook> {
  const { default: JSZip } = await import("jszip");
  let zip: InstanceType<typeof JSZip>;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch {
    // Not a zip at all: a truncated download or a file renamed to .epub.
    throw new Error("INVALID_FILE");
  }
  const read = async (path: string) => {
    const file = zip.file(path) ?? Object.values(zip.files).find((entry) => entry.name.toLowerCase() === path.toLowerCase()) ?? null;
    return file ? decodeTextBytes(await file.async("uint8array")) : null;
  };

  const container = await read("META-INF/container.xml");
  const opfPath = container ? byLocalName(parseXml(container), "rootfile")[0]?.getAttribute("full-path") : null;
  const opfText = opfPath ? await read(opfPath) : null;
  if (!opfPath || !opfText) throw new Error("NO_TEXTUAL_CONTENT");
  const opf = parseXml(opfText);
  const base = dirname(opfPath);

  const manifest = new Map<string, { href: string; mediaType: string; properties: string }>();
  for (const item of byLocalName(opf, "item")) {
    const id = item.getAttribute("id");
    const href = item.getAttribute("href");
    if (id && href) manifest.set(id, { href: resolveZipPath(base, href), mediaType: item.getAttribute("media-type") ?? "", properties: item.getAttribute("properties") ?? "" });
  }

  const titles = new Map<string, string>();
  const remember = (path: string, title: string) => {
    if (title && !titles.has(path)) titles.set(path, title);
  };
  const nav = [...manifest.values()].find((item) => /\bnav\b/.test(item.properties));
  const navText = nav ? await read(nav.href) : null;
  if (nav && navText) {
    const doc = new DOMParser().parseFromString(navText, "text/html");
    const navs = Array.from(doc.querySelectorAll("nav"));
    const toc = navs.find((element) => /\btoc\b/.test(element.getAttribute("epub:type") ?? element.getAttribute("type") ?? "")) ?? navs[0];
    toc?.querySelectorAll("a[href]").forEach((link) => remember(resolveZipPath(dirname(nav.href), link.getAttribute("href") ?? ""), cleanText(link.textContent)));
  }
  if (titles.size === 0) {
    const spineToc = byLocalName(opf, "spine")[0]?.getAttribute("toc");
    const ncx = (spineToc ? manifest.get(spineToc) : undefined) ?? [...manifest.values()].find((item) => item.mediaType === "application/x-dtbncx+xml");
    const ncxText = ncx ? await read(ncx.href) : null;
    if (ncx && ncxText) {
      for (const point of byLocalName(parseXml(ncxText), "navPoint")) {
        const label = byLocalName(point, "text")[0]?.textContent;
        const src = byLocalName(point, "content")[0]?.getAttribute("src");
        if (src) remember(resolveZipPath(dirname(ncx.href), src), cleanText(label));
      }
    }
  }

  const chapters: RawChapter[] = [];
  const itemrefs = byLocalName(opf, "itemref").filter((ref) => ref.getAttribute("linear") !== "no");
  for (const [index, ref] of itemrefs.entries()) {
    const idref = ref.getAttribute("idref") ?? "";
    const item = manifest.get(idref);
    if (!item || !/x?html/i.test(item.mediaType || item.href)) continue;
    const xhtml = await read(item.href);
    if (!xhtml) continue;
    chapters.push({
      id: safeId(idref, `chapter-${index + 1}`),
      href: item.href,
      title: titles.get(item.href) ?? "",
      xhtml,
    });
  }
  // Untitled spine items are numbered after the titled ones are known.
  chapters.forEach((chapter, index) => {
    if (!chapter.title) chapter.title = String(index + 1);
  });
  if (chapters.length === 0) throw new Error("NO_TEXTUAL_CONTENT");

  return {
    title: cleanText(byLocalName(opf, "title")[0]?.textContent) || fallbackTitle,
    metadataLanguage: cleanText(byLocalName(opf, "language")[0]?.textContent) || null,
    chapters,
  };
}

export function readTextChapters(bytes: Uint8Array, title: string): RawBook {
  const text = decodeTextBytes(bytes);
  return {
    title,
    metadataLanguage: null,
    chapters: splitTextChapters(text, title).map((chapter) => ({ id: chapter.id, href: chapter.href, title: chapter.title, xhtml: chapter.xhtml })),
  };
}
