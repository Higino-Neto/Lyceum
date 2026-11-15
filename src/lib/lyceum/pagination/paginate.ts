import { JSDOM } from "jsdom";
import type {
  LyceumConversionOptions,
  LyceumPageMap,
  LyceumPageTarget,
  LyceumTextualChapter,
  LyceumTextualContent,
} from "../schema/types";
import {
  DEFAULT_CHARS_PER_PAGE,
  EPUB_NS,
  PAGE_ANCHOR_PREFIX,
  XHTML_NS,
  pageAnchorId,
} from "./pageAnchors";

export interface PaginateOptions {
  mode: "target-count" | "estimate";
  /** Required for "target-count". */
  printPageCount?: number;
  /** Used by "estimate". Defaults to {@link DEFAULT_CHARS_PER_PAGE}. */
  charsPerPage?: number;
}

const SKIPPED_TEXT_PARENTS = new Set(["script", "style", "head", "title"]);
const MAX_PAGES = 65535; // APNX stores the page count as u16.

interface ParsedChapter {
  chapter: LyceumTextualChapter;
  dom: JSDOM | null;
  textNodes: Text[];
  /** Visible character count per text node (whitespace runs count as one). */
  nodeLengths: number[];
  start: number;
  length: number;
}

function isWhitespace(char: string): boolean {
  return /\s/.test(char);
}

/** Visible length: every non-space character plus one per whitespace run. */
export function visibleLength(text: string): number {
  let count = 0;
  let inSpace = false;
  for (const char of text) {
    if (isWhitespace(char)) {
      if (!inSpace) count += 1;
      inSpace = true;
    } else {
      count += 1;
      inSpace = false;
    }
  }
  return count;
}

/**
 * Raw UTF-16 offset in `text` where the visible character number `target`
 * begins, snapped forward to the start of the next word so a page never starts
 * mid-word.
 */
function rawOffsetForVisible(text: string, target: number): number {
  let count = 0;
  let inSpace = false;
  let offset = 0;
  for (; offset < text.length && count < target; offset += 1) {
    const char = text[offset];
    if (isWhitespace(char)) {
      if (!inSpace) count += 1;
      inSpace = true;
    } else {
      count += 1;
      inSpace = false;
    }
  }
  if (offset === 0) return 0;
  // Mid-word: advance to the end of the word, then past the whitespace run.
  while (offset < text.length && !isWhitespace(text[offset]) && !isWhitespace(text[offset - 1])) offset += 1;
  while (offset < text.length && isWhitespace(text[offset])) offset += 1;
  return offset;
}

function collectTextNodes(document: Document): Text[] {
  const body = document.body || document.getElementsByTagName("body")[0];
  if (!body) return [];
  const walker = document.createTreeWalker(body, 4 /* NodeFilter.SHOW_TEXT */);
  const nodes: Text[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const parent = node.parentElement?.localName.toLowerCase();
    if (parent && SKIPPED_TEXT_PARENTS.has(parent)) continue;
    if (!node.nodeValue || !node.nodeValue.length) continue;
    nodes.push(node as Text);
  }
  return nodes;
}

function removeGeneratedAnchors(document: Document) {
  for (const element of Array.from(document.querySelectorAll(`[id^="${PAGE_ANCHOR_PREFIX}"]`))) {
    if (!element.textContent) element.remove();
  }
}

function parseChapter(chapter: LyceumTextualChapter, start: number): ParsedChapter {
  let dom: JSDOM | null = null;
  try {
    dom = new JSDOM(chapter.xhtml, { contentType: "application/xhtml+xml" });
    if (dom.window.document.getElementsByTagName("parsererror").length > 0) dom = null;
  } catch {
    dom = null;
  }
  if (!dom) return { chapter, dom: null, textNodes: [], nodeLengths: [], start, length: 0 };

  removeGeneratedAnchors(dom.window.document);
  const textNodes = collectTextNodes(dom.window.document);
  const nodeLengths = textNodes.map((node) => visibleLength(node.nodeValue || ""));
  const length = nodeLengths.reduce((sum, value) => sum + value, 0);
  return { chapter, dom, textNodes, nodeLengths, start, length };
}

function createAnchor(document: Document, label: string): Element {
  const span = document.createElementNS(XHTML_NS, "span");
  span.setAttribute("id", pageAnchorId(label));
  span.setAttributeNS(EPUB_NS, "epub:type", "pagebreak");
  span.setAttribute("role", "doc-pagebreak");
  span.setAttribute("aria-label", label);
  span.setAttribute("title", label);
  return span;
}

function serialize(dom: JSDOM): string {
  const document = dom.window.document;
  const root = document.documentElement;
  if (!root.getAttribute("xmlns:epub")) {
    root.setAttributeNS("http://www.w3.org/2000/xmlns/", "xmlns:epub", EPUB_NS);
  }
  const serialized = new dom.window.XMLSerializer().serializeToString(root);
  return `<?xml version="1.0" encoding="utf-8"?>\n<!DOCTYPE html>\n${serialized}`;
}

/** Visible-character offsets (in book space) where each page starts. */
export function computePageStarts(totalLength: number, options: PaginateOptions): number[] {
  if (totalLength <= 0) return [];
  let count: number;
  if (options.mode === "target-count") {
    count = Math.floor(options.printPageCount || 0);
    if (count <= 0) return [];
  } else {
    const perPage = Math.max(200, Math.floor(options.charsPerPage || DEFAULT_CHARS_PER_PAGE));
    count = Math.max(1, Math.ceil(totalLength / perPage));
  }
  count = Math.min(count, MAX_PAGES);
  // Page k (0-based) starts at floor(k * L / N): always increasing for N <= L
  // and never stuck at zero, unlike a fixed integer chars-per-page step.
  return Array.from({ length: count }, (_, index) => Math.floor((index * totalLength) / count));
}

/**
 * Inserts page-start markers into the chapters and returns the updated content
 * with a page map. Existing generated markers are replaced, so it is safe to
 * run more than once. Returns the input untouched when there is no text.
 */
export function paginateTextual(textual: LyceumTextualContent, options: PaginateOptions): LyceumTextualContent {
  let cursor = 0;
  const parsed = textual.chapters.map((chapter) => {
    const result = parseChapter(chapter, cursor);
    cursor += result.length;
    return result;
  });
  const starts = computePageStarts(cursor, options);
  if (starts.length === 0) return textual;

  const pages: LyceumPageTarget[] = [];
  // Group insertions per text node so they can be applied back-to-front.
  const insertions = new Map<ParsedChapter, Map<number, { offset: number; label: string }[]>>();

  starts.forEach((start, index) => {
    const label = String(index + 1);
    const chapter = parsed.find((item) => item.dom && start >= item.start && start < item.start + item.length)
      || [...parsed].reverse().find((item) => item.dom && item.length > 0);
    if (!chapter) return;

    let local = Math.max(0, start - chapter.start);
    let nodeIndex = 0;
    while (nodeIndex < chapter.nodeLengths.length - 1 && local >= chapter.nodeLengths[nodeIndex]) {
      local -= chapter.nodeLengths[nodeIndex];
      nodeIndex += 1;
    }
    const text = chapter.textNodes[nodeIndex]?.nodeValue || "";
    const offset = rawOffsetForVisible(text, local);
    const byNode = insertions.get(chapter) || new Map();
    const list = byNode.get(nodeIndex) || [];
    list.push({ offset, label });
    byNode.set(nodeIndex, list);
    insertions.set(chapter, byNode);
    pages.push({ label, href: chapter.chapter.href, anchorId: pageAnchorId(label) });
  });

  const updated = new Map<LyceumTextualChapter, string>();
  for (const [chapter, byNode] of insertions) {
    const document = chapter.dom!.window.document;
    for (const [nodeIndex, list] of byNode) {
      const node = chapter.textNodes[nodeIndex];
      // Back-to-front keeps earlier offsets valid after each split.
      const ordered = [...list].sort((a, b) => b.offset - a.offset);
      for (const { offset, label } of ordered) {
        const anchor = createAnchor(document, label);
        const length = node.nodeValue?.length || 0;
        if (offset <= 0) node.parentNode?.insertBefore(anchor, node);
        else if (offset >= length) node.parentNode?.insertBefore(anchor, node.nextSibling);
        else node.parentNode?.insertBefore(anchor, node.splitText(offset));
      }
    }
    updated.set(chapter.chapter, serialize(chapter.dom!));
  }

  const pageMap: LyceumPageMap = {
    source: options.mode,
    pages,
    ...(options.mode === "target-count" && options.printPageCount ? { printPageCount: Math.floor(options.printPageCount) } : {}),
  };

  return {
    ...textual,
    chapters: textual.chapters.map((chapter) => (
      updated.has(chapter) ? { ...chapter, xhtml: updated.get(chapter)! } : chapter
    )),
    pageMap,
  };
}

/**
 * Decides which page map an export should carry, following the "auto"
 * priority: publisher/PDF pages > print page count > estimate.
 */
export function resolvePageMap(
  textual: LyceumTextualContent,
  options: Pick<LyceumConversionOptions, "pageNumbers" | "printPageCount" | "charsPerPage"> = {},
): LyceumTextualContent {
  const mode = options.pageNumbers || "auto";
  if (mode === "off") {
    if (!textual.pageMap) return textual;
    const rest = { ...textual };
    delete rest.pageMap;
    return rest;
  }

  const realPages = textual.pageMap && (textual.pageMap.source === "publisher" || textual.pageMap.source === "pdf");
  if (mode === "auto" && realPages) return textual;

  const printPageCount = options.printPageCount && options.printPageCount > 0 ? options.printPageCount : undefined;
  if ((mode === "target-count" || mode === "auto") && printPageCount) {
    return paginateTextual(textual, { mode: "target-count", printPageCount });
  }
  if (mode === "auto" && textual.pageMap) return textual;
  return paginateTextual(textual, { mode: "estimate", charsPerPage: options.charsPerPage });
}
