export const EPUB_NS = "http://www.idpf.org/2007/ops";
export const XHTML_NS = "http://www.w3.org/1999/xhtml";

/** Prefix of the ids Lyceum generates for page-start markers. */
export const PAGE_ANCHOR_PREFIX = "lyceum-pg-";

/**
 * Typical printed book density (~300 words of ~6 characters including spaces).
 * Used when no real pages and no print page count are available.
 */
export const DEFAULT_CHARS_PER_PAGE = 1800;

export function pageAnchorId(label: string | number): string {
  const safe = String(label).trim().replace(/[^A-Za-z0-9_-]+/g, "-") || "x";
  return `${PAGE_ANCHOR_PREFIX}${safe}`;
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Empty inline page-start marker following EPUB 3 SSV / DPUB-ARIA.
 * Uses an explicit end tag so it is also safe for HTML parsers.
 */
export function pageAnchorHtml(label: string, id = pageAnchorId(label)): string {
  const safeLabel = escapeAttribute(label);
  return `<span id="${escapeAttribute(id)}" epub:type="pagebreak" role="doc-pagebreak" aria-label="${safeLabel}" title="${safeLabel}"></span>`;
}

/** Matches one page-start marker (either serialization form). */
export const PAGE_ANCHOR_PATTERN = /<span\b[^>]*\bpagebreak\b[^>]*?(?:\/>|>\s*<\/span>)/gi;
