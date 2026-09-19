// Characters that separate words for double-click selection. Apostrophes,
// hyphens and en/em dashes inside a word stay part of the word.
const SEPARATOR_CHARS = new Set(" \t\n\r\v\f.,;:!?()[]{}|<>«»“”‘’\"„…·/\\–—");

export function isWordCharacter(char: string | undefined): boolean {
  if (!char) {
    return false;
  }
  return !SEPARATOR_CHARS.has(char);
}

export interface WordBounds {
  start: number;
  end: number;
}

/**
 * Returns the word boundaries around `index` within `text`, inclusive-exclusive
 * (`text.slice(start, end)`). Tolerates being asked to point at a separator by
 * snapping to the previous word. Returns null for empty or separator-only text.
 */
export function findWordBounds(text: string, index: number): WordBounds | null {
  if (!text) {
    return null;
  }

  const length = text.length;
  let offset = Math.max(0, Math.min(length - 1, index));

  if (!isWordCharacter(text[offset]) && offset > 0) {
    offset -= 1;
  }
  if (!isWordCharacter(text[offset])) {
    return null;
  }

  let start = offset;
  let end = offset + 1;

  while (start > 0 && isWordCharacter(text[start - 1])) {
    start -= 1;
  }
  while (end < length && isWordCharacter(text[end])) {
    end += 1;
  }

  return { start, end };
}