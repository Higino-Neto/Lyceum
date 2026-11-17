/**
 * Small, dependency-free fuzzy matcher shared by the renderer (command
 * palette, pickers) and the main process (typo-tolerant library search).
 *
 * - accent/case insensitive ("Algebra" finds "Álgebra")
 * - every query token must match some field (AND semantics)
 * - a token matches by exact word, word prefix, substring, initials
 *   ("gdp" → "Grande Dicionário Português") or a small typo
 *   (Damerau-Levenshtein ≤ 1 for 4–6 letters, ≤ 2 for longer words)
 * - fields carry weights so title hits outrank folder hits
 */

export interface FuzzyField {
  value: string | null | undefined;
  /** Relative importance (title ≈ 3, author ≈ 2, folder ≈ 0.5). */
  weight?: number;
}

export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function tokenizeSearchQuery(query: string): string[] {
  const normalized = normalizeSearchText(query);
  return normalized ? normalized.split(" ") : [];
}

/** Optimal string alignment distance with an early exit above `max`. */
export function boundedEditDistance(left: string, right: string, max: number): number {
  if (Math.abs(left.length - right.length) > max) return max + 1;
  const rows = left.length + 1;
  const cols = right.length + 1;
  let previousPrevious: number[] = [];
  let previous = Array.from({ length: cols }, (_, index) => index);
  for (let i = 1; i < rows; i += 1) {
    const current: number[] = [i];
    let rowMin = i;
    for (let j = 1; j < cols; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      let value = Math.min((previous[j] ?? 0) + 1, (current[j - 1] ?? 0) + 1, (previous[j - 1] ?? 0) + cost);
      if (i > 1 && j > 1 && left[i - 1] === right[j - 2] && left[i - 2] === right[j - 1]) {
        value = Math.min(value, (previousPrevious[j - 2] ?? 0) + 1);
      }
      current[j] = value;
      rowMin = Math.min(rowMin, value);
    }
    if (rowMin > max) return max + 1;
    previousPrevious = previous;
    previous = current;
  }
  return previous[cols - 1] ?? max + 1;
}

function typoBudget(token: string): number {
  if (token.length >= 7) return 2;
  if (token.length >= 4) return 1;
  return 0;
}

/** Score of one query token against one normalized field (0 = no match). */
function scoreToken(token: string, words: string[], text: string): number {
  let best = 0;
  for (const word of words) {
    if (word === token) return 1;
    if (word.startsWith(token)) best = Math.max(best, 0.85);
  }
  if (best > 0) return best;
  if (text.includes(token)) return 0.6;
  if (token.length >= 2 && token.length <= words.length) {
    const initials = words.map((word) => word[0]).join("");
    if (initials.includes(token)) return 0.5;
  }
  const budget = typoBudget(token);
  if (budget === 0) return 0;
  for (const word of words) {
    // Compare against the word, or its prefix of the same length (typo while typing).
    const candidates = word.length > token.length + budget ? [word.slice(0, token.length)] : [word];
    for (const candidate of candidates) {
      const distance = boundedEditDistance(token, candidate, budget);
      if (distance <= budget) best = Math.max(best, 0.45 - distance * 0.1);
    }
  }
  return best;
}

/**
 * Scores `fields` against the query. Returns 0 when any token is missing;
 * otherwise a positive score (higher is better).
 */
export function fuzzyScore(query: string | string[], fields: FuzzyField[]): number {
  const tokens = Array.isArray(query) ? query : tokenizeSearchQuery(query);
  if (tokens.length === 0) return 1;
  const prepared = fields
    .filter((field) => field.value)
    .map((field) => {
      const text = normalizeSearchText(String(field.value));
      return { text, words: text.split(" "), weight: field.weight ?? 1 };
    });
  if (prepared.length === 0) return 0;

  let total = 0;
  for (const token of tokens) {
    let tokenBest = 0;
    for (const field of prepared) {
      const value = scoreToken(token, field.words, field.text);
      if (value > 0) tokenBest = Math.max(tokenBest, value * field.weight);
    }
    if (tokenBest === 0) return 0;
    total += tokenBest;
  }
  // Prefer matches where the whole query appears together in a field.
  const joined = tokens.join(" ");
  if (tokens.length > 1 && prepared.some((field) => field.text.includes(joined))) total *= 1.25;
  return total;
}

/** Ranks items by fuzzy score, dropping non-matches. Stable for ties. */
export function fuzzyRank<T>(
  items: T[],
  query: string,
  fields: (item: T) => FuzzyField[],
  limit = Infinity,
): Array<{ item: T; score: number }> {
  const tokens = tokenizeSearchQuery(query);
  if (tokens.length === 0) return items.slice(0, limit).map((item) => ({ item, score: 1 }));
  const ranked: Array<{ item: T; score: number; index: number }> = [];
  items.forEach((item, index) => {
    const score = fuzzyScore(tokens, fields(item));
    if (score > 0) ranked.push({ item, score, index });
  });
  ranked.sort((left, right) => right.score - left.score || left.index - right.index);
  return ranked.slice(0, limit).map(({ item, score }) => ({ item, score }));
}
