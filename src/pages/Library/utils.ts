export const LOCAL_BOOK_PREFIX = "local-";

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[-_\s]+/g, " ")
    .trim();
}

export function tokenize(text: string): string[] {
  return normalizeText(text).split(" ").filter((t) => t.length > 0);
}

function levenshteinSimilarity(s1: string, s2: string): number {
  if (s1.length === 0 || s2.length === 0) return 0;
  if (s1 === s2) return 1;

  const len1 = s1.length;
  const len2 = s2.length;
  const matrix: number[][] = Array(len2 + 1)
    .fill(null)
    .map(() => Array(len1 + 1).fill(0));

  for (let i = 0; i <= len1; i++) matrix[0][i] = i;
  for (let j = 0; j <= len2; j++) matrix[j][0] = j;

  for (let i = 1; i <= len2; i++) {
    for (let j = 1; j <= len1; j++) {
      const cost = s1[j - 1] === s2[i - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  const maxLen = Math.max(len1, len2);
  return 1 - matrix[len2][len1] / maxLen;
}

export function calculateSimilarity(
  title: string,
  author: string | null,
  query: string,
  threshold = 0.2
): { score: number; matches: boolean } {
  const normalizedQuery = normalizeText(query);
  const queryTokens = tokenize(query);

  if (queryTokens.length === 0) return { score: 0, matches: false };

  const normalizedTitle = normalizeText(title);
  const normalizedAuthor = author ? normalizeText(author) : "";

  let maxScore = 0;

  for (const token of queryTokens) {
    if (token.length < 2) continue;

    let tokenScore = 0;

    if (
      normalizedTitle === token ||
      normalizedTitle.startsWith(token) ||
      normalizedTitle.endsWith(token)
    ) {
      tokenScore = 1;
    } else if (normalizedTitle.includes(token)) {
      const position = normalizedTitle.indexOf(token);
      if (position < 5) {
        tokenScore = 0.95;
      } else if (position < normalizedTitle.length / 2) {
        tokenScore = 0.85;
      } else {
        tokenScore = 0.75;
      }
    } else if (
      normalizedAuthor &&
      (normalizedAuthor === token || normalizedAuthor.includes(token))
    ) {
      tokenScore = 0.7;
    } else {
      const levenshteinScore = levenshteinSimilarity(token, normalizedTitle);
      tokenScore = levenshteinScore * 0.6;
    }

    maxScore = Math.max(maxScore, tokenScore);
  }

  const allTokensMatch = queryTokens.every(
    (token) =>
      normalizedTitle.includes(token) ||
      (normalizedAuthor && normalizedAuthor.includes(token))
  );
  if (allTokensMatch) {
    maxScore = Math.max(maxScore, 0.9);
  }

  return {
    score: maxScore,
    matches: maxScore > threshold,
  };
}
