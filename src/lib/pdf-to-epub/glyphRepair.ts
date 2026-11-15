import type { PageModel } from "./types";

/**
 * Repairs ligature glyphs that PDFs expose as Private Use Area characters.
 *
 * Fonts often draw "Th", "fi", "ft"... as a single glyph without a Unicode
 * mapping, so pdf.js returns a PUA code point (U+E000-U+F8FF) that renders as
 * nothing ("e next room" instead of "The next room"). The code differs from
 * font to font, so instead of a fixed table every PUA code is resolved against
 * the document itself: the candidate ligature that turns the most affected
 * words into words that also appear normally in the same book wins.
 */

const CANDIDATES = ["Th", "fi", "fl", "ff", "ffi", "ffl", "ft", "fj", "st", "ct", "tt", "fb", "fh", "fk", "Qu", "Ty", "Ta", "Te", "To", "Wh"];
const PUA = /[-]/;
const PUA_GLOBAL = /[-]/g;
const WORD = /[\p{L}\p{M}-'’]+/gu;
const MIN_MATCHES = 2;
const MIN_MATCH_RATIO = 0.25;

export type GlyphRepairMap = Map<string, string>;

function wordsOf(text: string): string[] {
  return text.match(WORD) || [];
}

/** Builds the PUA -> ligature map from all text of the document. */
export function buildGlyphRepairMap(texts: string[]): GlyphRepairMap {
  const dictionary = new Map<string, number>();
  const affected = new Map<string, string[]>();

  for (const text of texts) {
    for (const word of wordsOf(text)) {
      if (PUA.test(word)) {
        for (const code of new Set(word.match(PUA_GLOBAL) || [])) {
          const list = affected.get(code) || [];
          list.push(word);
          affected.set(code, list);
        }
        continue;
      }
      const lower = word.toLowerCase();
      dictionary.set(lower, (dictionary.get(lower) || 0) + 1);
    }
  }

  const map: GlyphRepairMap = new Map();
  for (const [code, words] of affected) {
    let best: { candidate: string; matches: number } | null = null;
    for (const candidate of CANDIDATES) {
      let matches = 0;
      for (const word of words) {
        // Words with other unresolved PUA codes cannot be checked yet.
        const replaced = word.split(code).join(candidate);
        if (PUA.test(replaced)) continue;
        if (dictionary.has(replaced.toLowerCase())) matches += 1;
      }
      if (!best || matches > best.matches) best = { candidate, matches };
    }
    if (best && best.matches >= MIN_MATCHES && best.matches >= words.length * MIN_MATCH_RATIO) {
      map.set(code, best.candidate);
    }
  }
  return map;
}

/**
 * Replaces mapped PUA glyphs. A ligature keeps its capital form ("Th") only
 * when it starts a word; inside a word it is lower-cased ("other").
 */
export function applyGlyphRepair(text: string, map: GlyphRepairMap): string {
  if (map.size === 0 || !PUA.test(text)) return text;
  return text.replace(PUA_GLOBAL, (code, offset: number) => {
    const candidate = map.get(code);
    if (!candidate) return code;
    const previous = offset > 0 ? text[offset - 1] : "";
    const insideWord = /[\p{L}\p{M}]/u.test(previous);
    return insideWord ? candidate.toLowerCase() : candidate;
  });
}

/** Repairs token and line text of parsed pages in place; returns the map used. */
export function repairPrivateUseGlyphs(pages: PageModel[]): GlyphRepairMap {
  const map = buildGlyphRepairMap(pages.flatMap((page) => page.lines.map((line) => line.text)));
  if (map.size === 0) return map;
  for (const page of pages) {
    for (const token of page.tokens) token.text = applyGlyphRepair(token.text, map);
    const lines = new Set([...page.lines, ...(page.orderedLines || [])]);
    for (const line of lines) {
      line.text = applyGlyphRepair(line.text, map);
      for (const token of line.tokens) token.text = applyGlyphRepair(token.text, map);
    }
  }
  return map;
}
