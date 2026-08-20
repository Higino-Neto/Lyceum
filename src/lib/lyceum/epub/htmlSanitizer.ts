import { JSDOM } from "jsdom";
import {
  extractBodyHtml,
  isPlaceholderTitle,
  stripHtml,
  wrapTextAsXhtml,
} from "../textual";
import { decodeTextBytes } from "./containerParser";

export interface SanitizedHtmlDocument {
  xhtml: string;
  title?: string;
  headingTitle?: string;
}

const ACTIVE_TAGS = new Set(["script", "form", "object", "embed", "iframe", "video", "audio", "source", "track", "input", "button", "select", "textarea"]);

export function decodeHtmlBytes(bytes: Uint8Array | ArrayBuffer) {
  return decodeTextBytes(bytes);
}

function documentTitle(document: Document) {
  return stripHtml(document.querySelector("title")?.textContent || "") || undefined;
}

function firstHeading(document: Document) {
  return stripHtml(document.querySelector("h1,h2,h3,h4,h5,h6")?.textContent || "") || undefined;
}

function removeActiveContent(document: Document) {
  for (const element of Array.from(document.querySelectorAll("*"))) {
    if (ACTIVE_TAGS.has(element.localName.toLowerCase())) {
      element.remove();
      continue;
    }

    for (const attribute of Array.from(element.attributes)) {
      if (/^on/i.test(attribute.name)) {
        element.removeAttribute(attribute.name);
      }
    }
  }
}

function ensureDocument(rawHtml: string, title: string) {
  if (/<html\b/i.test(rawHtml)) return rawHtml;
  return wrapTextAsXhtml(title, [stripHtml(rawHtml) || rawHtml]);
}

function ensureXhtmlNamespaces(document: Document, rawHtml: string) {
  const root = document.documentElement;
  // XMLSerializer emits the HTML element namespace itself. Keeping the parsed
  // xmlns attribute would serialize a duplicate attribute and invalidate XML.
  root.removeAttribute("xmlns");
  if (/\bepub:/i.test(rawHtml) && !root.getAttribute("xmlns:epub")) {
    root.setAttribute("xmlns:epub", "http://www.idpf.org/2007/ops");
  }
  if (/\bxlink:/i.test(rawHtml) && !root.getAttribute("xmlns:xlink")) {
    root.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  }
}

function normalizeTitle(document: Document, title: string, replaceExisting: boolean) {
  const head = document.head;
  let titleElement = head.querySelector("title");
  if (!titleElement) {
    titleElement = document.createElement("title");
    head.prepend(titleElement);
  }
  if (replaceExisting || !titleElement.textContent?.trim()) titleElement.textContent = title;

  const firstBodyElement = Array.from(document.body?.children || []).find((element) => (
    !["script", "style", "link", "meta"].includes(element.localName.toLowerCase())
  ));
  const heading = firstBodyElement?.matches("h1,h2,h3,h4,h5,h6")
    ? firstBodyElement
    : firstBodyElement?.querySelector("h1,h2,h3,h4,h5,h6");
  if (heading && isPlaceholderTitle(stripHtml(heading.textContent || ""))) heading.textContent = title;
}

function serializeXhtml(dom: JSDOM) {
  const serializer = new dom.window.XMLSerializer();
  const serialized = serializer.serializeToString(dom.window.document.documentElement);
  return `<?xml version="1.0" encoding="utf-8"?>\n<!DOCTYPE html>\n${serialized}`;
}

export function validateXhtmlDocument(xhtml: string, label = "Documento XHTML") {
  try {
    const parsed = new JSDOM(xhtml, { contentType: "application/xhtml+xml" });
    const root = parsed.window.document.documentElement;
    if (!root || root.localName.toLowerCase() !== "html") {
      return { valid: false as const, error: `${label}: elemento raiz <html> ausente.` };
    }
    return { valid: true as const };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { valid: false as const, error: `${label}: XML invalido (${detail}).` };
  }
}

export function assertValidXhtmlDocument(xhtml: string, label?: string) {
  const validation = validateXhtmlDocument(xhtml, label);
  if (!validation.valid) throw new Error(validation.error);
}

export function sanitizeHtmlDocument(rawHtml: string, title: string): SanitizedHtmlDocument {
  const prepared = ensureDocument(rawHtml, title);
  const dom = new JSDOM(prepared, { contentType: "text/html" });
  const document = dom.window.document;
  const htmlTitle = documentTitle(document);
  const headingTitle = firstHeading(document);
  removeActiveContent(document);
  ensureXhtmlNamespaces(document, rawHtml);
  normalizeTitle(document, title, isPlaceholderTitle(htmlTitle));
  const xhtml = serializeXhtml(dom);
  assertValidXhtmlDocument(xhtml, title);

  return {
    xhtml,
    title: htmlTitle,
    headingTitle,
  };
}

export function hasMeaningfulHtmlContent(xhtml: string) {
  return Boolean(stripHtml(extractBodyHtml(xhtml)))
    || /<(img|svg|math|table|figure|ruby|blockquote)\b/i.test(xhtml);
}
