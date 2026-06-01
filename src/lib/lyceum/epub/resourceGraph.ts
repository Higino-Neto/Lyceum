import path from "node:path";
import { JSDOM } from "jsdom";
import type JSZip from "jszip";
import type { LyceumTextualResource } from "../schema/types";
import { textualRelativePath } from "../package/paths";
import type { ParsedOpf, ParsedOpfManifestItem } from "./opfParser";
import { extractCssReferences } from "./cssSanitizer";

export interface EpubResourceGraphItem extends ParsedOpfManifestItem {
  zipPath: string;
  packageHref: string;
  referencedBy: string[];
  isLinearSpine: boolean;
  isExtraSpine: boolean;
  fallbackChain: string[];
}

export interface EpubResourceGraph {
  items: Map<string, EpubResourceGraphItem>;
  itemsByZipPath: Map<string, EpubResourceGraphItem>;
  linearSpineItems: EpubResourceGraphItem[];
  extraSpineItems: EpubResourceGraphItem[];
  warnings: string[];
  coverPageHref?: string;
}

export type ReadTextEntry = (zipPath: string) => Promise<string | null>;

export function normalizeZipPath(value: string) {
  return value.replace(/\\/g, "/").replace(/^\/+/, "");
}

export function splitHref(value: string) {
  const match = value.match(/^([^#?]*)([?#].*)?$/);
  return {
    pathname: match?.[1] || "",
    suffix: match?.[2] || "",
  };
}

export function dirname(value: string) {
  const normalized = normalizeZipPath(value);
  const index = normalized.lastIndexOf("/");
  return index >= 0 ? normalized.slice(0, index + 1) : "";
}

export function decodeHrefPath(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function resolveZipPath(baseDirectory: string, href: string) {
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

export function hrefRelativeToOpf(baseDirectory: string, zipPath: string) {
  const normalizedBase = normalizeZipPath(baseDirectory);
  const normalizedPath = normalizeZipPath(zipPath);
  return normalizedBase && normalizedPath.startsWith(normalizedBase)
    ? normalizedPath.slice(normalizedBase.length)
    : normalizedPath;
}

export function inferMediaType(href: string) {
  const ext = path.posix.extname(splitHref(href).pathname).toLowerCase();
  return new Map([
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
  ]).get(ext) || "application/octet-stream";
}

function fallbackChain(item: ParsedOpfManifestItem, manifest: Map<string, ParsedOpfManifestItem>) {
  const chain: string[] = [];
  const seen = new Set<string>();
  let current = item;
  while (current.fallback && !seen.has(current.fallback)) {
    seen.add(current.fallback);
    chain.push(current.fallback);
    const next = manifest.get(current.fallback);
    if (!next) break;
    current = next;
  }
  return chain;
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

function rawAttribute(element: Element, name: string) {
  return element.getAttribute(name) || "";
}

function srcsetUrls(value: string) {
  return value
    .split(",")
    .map((candidate) => candidate.trim().split(/\s+/)[0])
    .filter(Boolean);
}

function htmlReferences(html: string) {
  const references = new Set<string>();
  const dom = new JSDOM(html, { contentType: "text/html" });
  const document = dom.window.document;

  for (const element of Array.from(document.querySelectorAll("img, image, source"))) {
    const src = rawAttribute(element, "src") || rawAttribute(element, "href") || rawAttribute(element, "xlink:href");
    if (src) references.add(src);
    const srcset = rawAttribute(element, "srcset");
    if (srcset) srcsetUrls(srcset).forEach((item) => references.add(item));
  }

  for (const element of Array.from(document.querySelectorAll("picture source, object[data], link[href], style"))) {
    const href = rawAttribute(element, "href") || rawAttribute(element, "data");
    if (href) references.add(href);
    if (element.localName === "style") {
      extractCssReferences(element.textContent || "").forEach((item) => references.add(item));
    }
  }

  for (const element of Array.from(document.querySelectorAll("[style]"))) {
    extractCssReferences(rawAttribute(element, "style")).forEach((item) => references.add(item));
  }

  return [...references];
}

function isExternalHref(href: string) {
  return !href || href.startsWith("#") || /^[a-z][a-z0-9+.-]*:/i.test(href);
}

function itemForResolvedPath(graph: EpubResourceGraph, zipPath: string) {
  return graph.itemsByZipPath.get(normalizeZipPath(zipPath).toLowerCase());
}

function markReference(graph: EpubResourceGraph, fromZipPath: string, ref: string) {
  if (isExternalHref(ref)) return;
  const targetZipPath = resolveZipPath(dirname(fromZipPath), ref);
  const target = itemForResolvedPath(graph, targetZipPath);
  if (!target) {
    graph.warnings.push(`Recurso referenciado nao esta no manifesto: ${targetZipPath}`);
    return;
  }
  target.referencedBy.push(fromZipPath);
}

async function collectReferences(graph: EpubResourceGraph, readText: ReadTextEntry) {
  for (const item of graph.items.values()) {
    if (/xhtml|html/i.test(item.mediaType) || /\.(xhtml|html?)$/i.test(item.href)) {
      const html = await readText(item.zipPath);
      if (!html) {
        graph.warnings.push(`Documento HTML nao encontrado para grafo de recursos: ${item.zipPath}`);
        continue;
      }
      htmlReferences(html).forEach((ref) => markReference(graph, item.zipPath, ref));
    } else if (item.mediaType === "text/css" || /\.css$/i.test(item.href)) {
      const css = await readText(item.zipPath);
      if (!css) {
        graph.warnings.push(`CSS nao encontrado para grafo de recursos: ${item.zipPath}`);
        continue;
      }
      extractCssReferences(css).forEach((ref) => markReference(graph, item.zipPath, ref));
    }
  }
}

export async function buildResourceGraph(args: {
  opf: ParsedOpf;
  opfPath: string;
  readText: ReadTextEntry;
}): Promise<EpubResourceGraph> {
  const baseDirectory = dirname(args.opfPath);
  const usedHrefs = new Set<string>();
  const graph: EpubResourceGraph = {
    items: new Map(),
    itemsByZipPath: new Map(),
    linearSpineItems: [],
    extraSpineItems: [],
    warnings: [],
  };
  const spineById = new Map(args.opf.spine.map((item) => [item.idref, item]));

  for (const item of args.opf.manifest.values()) {
    const zipPath = resolveZipPath(baseDirectory, item.href);
    const packageHref = uniqueHref(hrefRelativeToOpf(baseDirectory, zipPath), usedHrefs, `resources/${item.id || "resource"}`);
    const spineItem = spineById.get(item.id);
    const graphItem: EpubResourceGraphItem = {
      ...item,
      zipPath,
      packageHref,
      referencedBy: [],
      isLinearSpine: Boolean(spineItem?.linear),
      isExtraSpine: Boolean(spineItem && !spineItem.linear),
      fallbackChain: fallbackChain(item, args.opf.manifest),
    };
    graph.items.set(item.id, graphItem);
    graph.itemsByZipPath.set(zipPath.toLowerCase(), graphItem);
  }

  for (const spineItem of args.opf.spine) {
    const item = graph.items.get(spineItem.idref);
    if (!item) {
      graph.warnings.push(`Spine referencia item ausente no manifesto: ${spineItem.idref}`);
      continue;
    }
    if (spineItem.linear) graph.linearSpineItems.push(item);
    else graph.extraSpineItems.push(item);
  }

  await collectReferences(graph, args.readText);

  const coverGuide = args.opf.guide.find((reference) => reference.type.toLowerCase() === "cover");
  if (coverGuide) {
    graph.coverPageHref = textualRelativePath(hrefRelativeToOpf(baseDirectory, resolveZipPath(baseDirectory, coverGuide.href)), "cover.xhtml");
  }

  for (const item of graph.items.values()) {
    if (item.fallback && !graph.items.has(item.fallback)) {
      graph.warnings.push(`Fallback ausente para ${item.id}: ${item.fallback}`);
    }
  }

  return graph;
}

export function markExtraResourceProperties(resource: LyceumTextualResource, item: EpubResourceGraphItem) {
  const properties = new Set((resource.properties || "").split(/\s+/).filter(Boolean));
  if (item.isExtraSpine) properties.add("extra");
  if (item.isExtraSpine) properties.add("linear-no");
  if (item.fallbackChain.length > 0) properties.add("has-fallback");
  return {
    ...resource,
    properties: [...properties].join(" ") || undefined,
  };
}
