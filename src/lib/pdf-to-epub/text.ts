import type { Line } from "./types";

const KNOWN_PREFIXES = /(?:anti|pre|pré|pos|pós|ex|vice|co|auto|semi)-$/i;

export function normalizeText(text: string) {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s+([,.;:!?%])/g, "$1")
    .replace(/([(¿¡])\s+/g, "$1")
    .trim();
}

export function sanitizeXmlText(value: string) {
  let sanitized = "";
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    const allowed = codePoint === 0x9
      || codePoint === 0xa
      || codePoint === 0xd
      || (codePoint >= 0x20 && codePoint <= 0xd7ff)
      || (codePoint >= 0xe000 && codePoint <= 0xfffd)
      || (codePoint >= 0x10000 && codePoint <= 0x10ffff);
    sanitized += allowed ? character : "\ufffd";
  }
  return sanitized;
}

function shouldRemoveTerminalHyphen(current: Line, next: Line, columnRight: number, columnWidth: number) {
  if (!/[A-Za-zÀ-ÿ]-$/.test(current.text)) return false;
  if (!/^[a-zà-ÿ]/.test(next.text.trim())) return false;
  if (KNOWN_PREFIXES.test(current.text.trim())) return false;
  if (current.right < columnRight - columnWidth * 0.1) return false;

  const wordBeforeHyphen = current.text.match(/([A-Za-zÀ-ÿ]+)-$/)?.[1] || "";
  return wordBeforeHyphen.length >= 3;
}

export function joinParagraphLines(lines: Line[], columnRight: number, columnWidth: number) {
  let text = "";

  lines.forEach((line, index) => {
    const cleanLine = normalizeText(line.text);
    if (index === 0) {
      text = cleanLine;
      return;
    }

    const previous = lines[index - 1];
    if (shouldRemoveTerminalHyphen(previous, line, columnRight, columnWidth)) {
      text = text.replace(/-\s*$/, "") + cleanLine;
      return;
    }

    text += ` ${cleanLine}`;
  });

  return normalizeText(text);
}

export function escapeXml(value: string) {
  return sanitizeXmlText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
