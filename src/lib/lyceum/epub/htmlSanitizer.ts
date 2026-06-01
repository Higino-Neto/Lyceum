import { JSDOM } from "jsdom";
import {
  extractBodyHtml,
  isPlaceholderTitle,
  normalizeHtmlEntitiesForXhtml,
  stripHtml,
  wrapTextAsXhtml,
  escapeXml,
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

function ensureXhtmlNamespace(xhtml: string) {
  if (!/<html\b/i.test(xhtml)) return xhtml;
  let normalized = xhtml;
  if (!/<html\b[^>]*\bxmlns\s*=/i.test(normalized)) {
    normalized = normalized.replace(/<html\b/i, `<html xmlns="http://www.w3.org/1999/xhtml"`);
  }
  return normalized;
}

function replaceOrInsertTitle(xhtml: string, title: string, replaceExisting: boolean) {
  const escapedTitle = escapeXml(title);
  if (/<title\b[^>]*>[\s\S]*?<\/title>/i.test(xhtml)) {
    return replaceExisting
      ? xhtml.replace(/<title\b[^>]*>[\s\S]*?<\/title>/i, `<title>${escapedTitle}</title>`)
      : xhtml;
  }

  if (/<head\b[^>]*>/i.test(xhtml)) {
    return xhtml.replace(/<head\b[^>]*>/i, (match) => `${match}\n<title>${escapedTitle}</title>`);
  }

  return xhtml.replace(/<html\b[^>]*>/i, (match) => `${match}\n<head><title>${escapedTitle}</title></head>`);
}

function replaceLeadingPlaceholderHeading(xhtml: string, title: string) {
  const escapedTitle = escapeXml(title);
  return xhtml.replace(/(<body\b[^>]*>\s*(?:<[^>]+>\s*)*)<h([1-6])\b([^>]*)>([\s\S]*?)<\/h\2>/i, (match, prefix, level, attrs, heading) => {
    return isPlaceholderTitle(stripHtml(heading))
      ? `${prefix}<h${level}${attrs}>${escapedTitle}</h${level}>`
      : match;
  });
}

export function sanitizeHtmlDocument(rawHtml: string, title: string): SanitizedHtmlDocument {
  const prepared = ensureDocument(rawHtml, title);
  const dom = new JSDOM(prepared, { contentType: "text/html" });
  const document = dom.window.document;
  const htmlTitle = documentTitle(document);
  const headingTitle = firstHeading(document);
  removeActiveContent(document);

  let xhtml = normalizeHtmlEntitiesForXhtml(ensureXhtmlNamespace(document.documentElement.outerHTML));
  xhtml = replaceOrInsertTitle(xhtml, title, isPlaceholderTitle(htmlTitle));
  xhtml = replaceLeadingPlaceholderHeading(xhtml, title);

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
