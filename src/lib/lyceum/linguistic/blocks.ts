import type { BlockInput } from "../../../core/language-learning/analysis/analyzeDocument";
import type { LinguisticBlockKind } from "../../../core/language-learning/model";
import { decodeHtmlEntities, extractBodyHtml } from "../textual";

const BLOCK_TAGS = new Set([
  "p", "div", "section", "article", "aside", "header", "footer", "main", "blockquote", "li", "ul", "ol",
  "h1", "h2", "h3", "h4", "h5", "h6", "td", "th", "tr", "table", "dd", "dt", "dl", "figcaption", "figure", "pre", "hr",
]);
const SKIPPED_CONTENT = new Set(["script", "style", "head", "title", "rt", "rp", "svg", "math", "nav"]);
const VOID_TAGS = new Set(["br", "hr", "img", "meta", "link", "input", "wbr", "col", "area", "source"]);

function kindFor(stack: string[]): { kind: LinguisticBlockKind; level?: number } {
  for (let index = stack.length - 1; index >= 0; index -= 1) {
    const tag = stack[index] ?? "";
    const heading = /^h([1-6])$/.exec(tag);
    if (heading) return { kind: "heading", level: Number(heading[1]) };
    if (tag === "li" || tag === "dd" || tag === "dt") return { kind: "list-item" };
    if (tag === "blockquote") return { kind: "quote" };
  }
  return { kind: "paragraph" };
}

/**
 * Extracts readable blocks (headings, paragraphs, list items, quotes) from a
 * chapter's XHTML without a DOM. Inline markup is flattened into text; the
 * original XHTML is left untouched in the package.
 */
export function extractBlocksFromXhtml(xhtml: string): BlockInput[] {
  const body = extractBodyHtml(xhtml);
  const blocks: BlockInput[] = [];
  const stack: string[] = [];
  let skipDepth = 0;
  let buffer = "";

  const flush = () => {
    const text = decodeHtmlEntities(buffer).replace(/\s+/g, " ").trim();
    buffer = "";
    if (!text || !/[\p{L}\p{N}]/u.test(text)) return;
    blocks.push({ ...kindFor(stack), text });
  };

  const pattern = /<!--[\s\S]*?-->|<!\[CDATA\[([\s\S]*?)\]\]>|<(\/?)([a-zA-Z][\w:-]*)([^>]*?)(\/?)>|([^<]+)/g;
  for (const match of body.matchAll(pattern)) {
    const [, cdata, closing, rawTag, , selfClosing, text] = match;
    if (text !== undefined || cdata !== undefined) {
      if (skipDepth === 0) buffer += text ?? cdata ?? "";
      continue;
    }
    if (!rawTag) continue;
    const tag = rawTag.toLowerCase().replace(/^.*:/, "");

    if (SKIPPED_CONTENT.has(tag)) {
      if (closing) skipDepth = Math.max(0, skipDepth - 1);
      else if (!selfClosing) skipDepth += 1;
      continue;
    }
    if (skipDepth > 0) continue;

    if (tag === "br") {
      buffer += " ";
      continue;
    }
    if (!BLOCK_TAGS.has(tag)) continue;

    flush();
    if (closing) {
      const position = stack.lastIndexOf(tag);
      if (position >= 0) stack.splice(position);
    } else if (!selfClosing && !VOID_TAGS.has(tag)) {
      stack.push(tag);
    }
  }
  flush();
  return blocks;
}
