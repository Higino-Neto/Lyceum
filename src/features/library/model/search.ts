export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[-_\s]+/g, " ")
    .trim();
}

export function tokenize(text: string): string[] {
  return normalizeText(text).split(" ").filter((token) => token.length > 0);
}

function levenshteinSimilarity(first: string, second: string): number {
  if (first.length === 0 || second.length === 0) return 0;
  if (first === second) return 1;

  const matrix: number[][] = Array.from(
    { length: second.length + 1 },
    () => Array<number>(first.length + 1).fill(0),
  );

  for (let index = 0; index <= first.length; index++) matrix[0]![index] = index;
  for (let index = 0; index <= second.length; index++) matrix[index]![0] = index;

  for (let row = 1; row <= second.length; row++) {
    for (let column = 1; column <= first.length; column++) {
      const cost = first[column - 1] === second[row - 1] ? 0 : 1;
      matrix[row]![column] = Math.min(
        matrix[row - 1]![column]! + 1,
        matrix[row]![column - 1]! + 1,
        matrix[row - 1]![column - 1]! + cost,
      );
    }
  }

  return 1 - matrix[second.length]![first.length]! / Math.max(first.length, second.length);
}

export function calculateSimilarity(
  title: string,
  author: string | null,
  query: string,
  threshold = 0.2,
): { score: number; matches: boolean } {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return { score: 0, matches: false };

  const normalizedTitle = normalizeText(title);
  const normalizedAuthor = author ? normalizeText(author) : "";
  let maxScore = 0;

  for (const token of queryTokens) {
    if (token.length < 2) continue;

    let tokenScore = 0;
    if (
      normalizedTitle === token
      || normalizedTitle.startsWith(token)
      || normalizedTitle.endsWith(token)
    ) {
      tokenScore = 1;
    } else if (normalizedTitle.includes(token)) {
      const position = normalizedTitle.indexOf(token);
      tokenScore = position < 5 ? 0.95 : position < normalizedTitle.length / 2 ? 0.85 : 0.75;
    } else if (
      normalizedAuthor
      && (normalizedAuthor === token || normalizedAuthor.includes(token))
    ) {
      tokenScore = 0.7;
    } else {
      tokenScore = levenshteinSimilarity(token, normalizedTitle) * 0.6;
    }

    maxScore = Math.max(maxScore, tokenScore);
  }

  const allTokensMatch = queryTokens.every(
    (token) => normalizedTitle.includes(token) || normalizedAuthor.includes(token),
  );
  if (allTokensMatch) maxScore = Math.max(maxScore, 0.9);

  return { score: maxScore, matches: maxScore > threshold };
}
