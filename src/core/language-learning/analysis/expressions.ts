import type { ExpressionPattern } from "../languages/types";

export interface MatchableToken {
  lower: string;
  lemmaLower: string;
}

const DEFAULT_MAX_SPAN = 12;

export type FormMatcher = (lowerForm: string, lemma: string) => boolean;

function partMatches(part: string, token: MatchableToken, reflexives: ReadonlySet<string>, formMatcher?: FormMatcher) {
  if (part === "{refl}") return reflexives.has(token.lower);
  return token.lemmaLower === part || token.lower === part || (formMatcher?.(token.lower, part) ?? false);
}

function chunkPositions(chunk: string[], tokens: MatchableToken[], reflexives: ReadonlySet<string>, formMatcher?: FormMatcher): number[] {
  const positions: number[] = [];
  for (let start = 0; start + chunk.length <= tokens.length; start += 1) {
    let ok = true;
    for (let offset = 0; offset < chunk.length; offset += 1) {
      const token = tokens[start + offset];
      const part = chunk[offset];
      if (!token || part === undefined || !partMatches(part, token, reflexives, formMatcher)) {
        ok = false;
        break;
      }
    }
    if (ok) positions.push(start);
  }
  return positions;
}

/**
 * Finds the best realisation of a multi-word pattern in one sentence.
 * Chunks are contiguous; chunks can be separated by other words (German
 * verb brackets, English phrasal verbs with objects) and, unless the
 * pattern is ordered, appear in any order. Matching is lemma-based, never
 * substring-based. Returns the matched token indexes or null.
 */
export function matchExpression(
  pattern: ExpressionPattern,
  tokens: MatchableToken[],
  reflexives: ReadonlySet<string> = new Set(),
  formMatcher?: FormMatcher,
): number[] | null {
  const positions = pattern.chunks.map((chunk) => chunkPositions(chunk, tokens, reflexives, formMatcher));
  if (positions.some((list) => list.length === 0)) return null;
  const maxSpan = pattern.maxSpan ?? DEFAULT_MAX_SPAN;

  let best: number[] | null = null;
  let bestSpan = Number.POSITIVE_INFINITY;

  const visit = (chunkIndex: number, chosen: number[]) => {
    if (chunkIndex === pattern.chunks.length) {
      const indexes: number[] = [];
      chosen.forEach((start, i) => {
        const length = pattern.chunks[i]?.length ?? 0;
        for (let k = 0; k < length; k += 1) indexes.push(start + k);
      });
      if (new Set(indexes).size !== indexes.length) return;
      if (pattern.ordered) {
        for (let i = 1; i < chosen.length; i += 1) {
          if ((chosen[i] ?? 0) <= (chosen[i - 1] ?? 0)) return;
        }
      }
      const min = Math.min(...indexes);
      const max = Math.max(...indexes);
      const span = max - min;
      if (span <= maxSpan && span < bestSpan) {
        bestSpan = span;
        best = indexes.sort((a, b) => a - b);
      }
      return;
    }
    for (const start of positions[chunkIndex] ?? []) {
      chosen.push(start);
      visit(chunkIndex + 1, chosen);
      chosen.pop();
    }
  };

  // Bound the search for pathological inputs.
  const combinations = positions.reduce((product, list) => product * list.length, 1);
  if (combinations > 5000) return null;
  visit(0, []);
  return best;
}
