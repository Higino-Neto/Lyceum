import { renderDefaultCss } from "../../pdf-to-epub/html";

export interface CssSanitizeOptions {
  resolveImport?: (href: string) => string | null | undefined;
  rewriteUrl?: (href: string) => string | null | undefined;
}

const SAFE_PROPERTIES = new Set([
  "font-family",
  "font-size",
  "font-style",
  "font-weight",
  "font-variant",
  "color",
  "background",
  "background-color",
  "margin",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "padding",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "text-indent",
  "text-align",
  "text-decoration",
  "line-height",
  "letter-spacing",
  "word-spacing",
  "page-break-before",
  "page-break-after",
  "page-break-inside",
  "widows",
  "orphans",
  "border",
  "border-top",
  "border-right",
  "border-bottom",
  "border-left",
  "border-color",
  "border-style",
  "border-width",
  "width",
  "height",
  "max-width",
  "max-height",
  "float",
  "display",
  "visibility",
  "border-collapse",
  "border-spacing",
  "vertical-align",
]);

const UNSAFE_VALUE_PATTERN = /\b(expression|javascript:|fixed|absolute|sticky|flex|grid|transform|transition|animation|filter|backdrop-filter|box-shadow|text-shadow|z-index)\b|[-\d.]+v[whminmax]\b/i;
const SAFE_DISPLAY_VALUES = new Set(["block", "inline", "inline-block", "none", "table", "table-row", "table-cell", "table-caption", "list-item"]);

function stripCssComments(css: string) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function inlineImports(css: string, options: CssSanitizeOptions) {
  return css.replace(/@import\s+(?:url\()?["']?([^"')\s]+)["']?\)?[^;]*;/gi, (_match, href: string) => {
    const imported = options.resolveImport?.(href);
    return imported ? sanitizeCss(imported, options).css : "";
  });
}

function rewriteUrls(value: string, options: CssSanitizeOptions) {
  return value.replace(/url\(\s*["']?([^"')]+)["']?\s*\)/gi, (match, href: string) => {
    const rewritten = options.rewriteUrl?.(href);
    return rewritten ? `url("${rewritten}")` : match;
  });
}

function safeDeclaration(property: string, value: string) {
  if (!SAFE_PROPERTIES.has(property)) return false;
  if (UNSAFE_VALUE_PATTERN.test(value)) return false;
  if (property === "float" && !/^(left|right|none)$/i.test(value.trim())) return false;
  if (property === "display" && !SAFE_DISPLAY_VALUES.has(value.trim().toLowerCase())) return false;
  return true;
}

function sanitizeRule(selector: string, body: string, options: CssSanitizeOptions) {
  const declarations = body
    .split(";")
    .map((declaration) => {
      const separator = declaration.indexOf(":");
      if (separator < 0) return "";
      const property = declaration.slice(0, separator).trim().toLowerCase();
      const value = rewriteUrls(declaration.slice(separator + 1).trim(), options);
      return property && value && safeDeclaration(property, value)
        ? `${property}: ${value}`
        : "";
    })
    .filter(Boolean);

  return declarations.length ? `${selector.trim()} { ${declarations.join("; ")}; }` : "";
}

export function sanitizeCss(css: string, options: CssSanitizeOptions = {}) {
  const warnings: string[] = [];
  const withoutComments = stripCssComments(css);
  const withImports = inlineImports(withoutComments, options);
  const sanitized = withImports.replace(/([^{}@]+)\{([^{}]*)\}/g, (_match, selector: string, body: string) => (
    sanitizeRule(selector, body, options)
  ));
  if (sanitized.length < withImports.length) {
    warnings.push("CSS inseguro ou incompativel com Kindle foi removido.");
  }
  return {
    css: sanitized.replace(/\s+/g, " ").trim(),
    warnings,
  };
}

export function extractCssReferences(css: string) {
  const references = new Set<string>();
  for (const match of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) {
    references.add(match[1]);
  }
  for (const match of css.matchAll(/@import\s+(?:url\()?["']?([^"')\s]+)["']?\)?/gi)) {
    references.add(match[1]);
  }
  return [...references];
}

export function renderKindleDefaultCss() {
  return renderDefaultCss();
}
