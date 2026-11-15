import { getTitleWithoutExtension } from "./folders";
import { normalizeText } from "./search";

/**
 * Near-duplicate detection for the library (the "Find Duplicates" idea from
 * Calibre's plugin, reimplemented). Exact copies cannot exist because files
 * are keyed by SHA-256, so this looks for the same book under different
 * files: same ISBN, same normalized title with compatible authors, or a very
 * similar title by the same author.
 */

export type DuplicateReason = "isbn" | "sameTitle" | "similarTitle";

export interface DuplicateCandidate {
  fileHash: string;
  title: string;
  author?: string | null;
  isbn?: string | null;
  identifier?: string | null;
  fileType?: string | null;
  filePath?: string | null;
  bookId?: string | null;
}

export interface DuplicateGroup<T extends DuplicateCandidate = DuplicateCandidate> {
  /** Stable while the group's members do not change; used to dismiss it. */
  key: string;
  books: T[];
  reasons: DuplicateReason[];
}

const LEADING_ARTICLES = new Set([
  "the", "a", "an", "o", "os", "as", "um", "uma", "el", "la", "los", "las", "le", "les", "der", "die", "das", "il", "lo",
]);
const NOISE_TOKENS = new Set(["ebook", "epub", "pdf", "mobi", "azw3", "retail", "kindle", "edition", "edicao", "ed"]);
const FUZZY_THRESHOLD = 0.86;
const MAX_FUZZY_BLOCK = 400;

export function normalizeDuplicateTitle(title: string, fileType?: string | null): string {
  const withoutExtension = getTitleWithoutExtension(title || "", fileType ?? undefined);
  const mainTitle = withoutExtension
    .replace(/[([{][^)\]}]*[)\]}]/g, " ")
    .split(/\s[:–—]\s|:\s|\s-\s/)[0];
  const tokens = normalizeText(mainTitle)
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((token) => token && !NOISE_TOKENS.has(token));
  while (tokens.length > 1 && LEADING_ARTICLES.has(tokens[0])) tokens.shift();
  return tokens.join(" ");
}

function authorTokens(author: string | null | undefined): Set<string> {
  if (!author) return new Set();
  return new Set(
    normalizeText(author)
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((token) => token.length >= 3 && token !== "and"),
  );
}

/** Unknown authors never block a match; known ones must share a name token. */
export function authorsCompatible(left: string | null | undefined, right: string | null | undefined): boolean {
  const leftTokens = authorTokens(left);
  const rightTokens = authorTokens(right);
  if (leftTokens.size === 0 || rightTokens.size === 0) return true;
  for (const token of leftTokens) if (rightTokens.has(token)) return true;
  return false;
}

export function normalizeIsbn(value: string | null | undefined): string | null {
  if (!value) return null;
  const compact = value.toUpperCase().replace(/[^0-9X]/g, "");
  if (/^\d{13}$/.test(compact) && (compact.startsWith("978") || compact.startsWith("979"))) return compact;
  if (/^\d{9}[\dX]$/.test(compact)) {
    const core = `978${compact.slice(0, 9)}`;
    const sum = core.split("").reduce((total, digit, index) => total + Number(digit) * (index % 2 ? 3 : 1), 0);
    return `${core}${(10 - (sum % 10)) % 10}`;
  }
  return null;
}

function bigrams(value: string): Map<string, number> {
  const compact = value.replace(/\s+/g, " ");
  const grams = new Map<string, number>();
  for (let index = 0; index < compact.length - 1; index += 1) {
    const gram = compact.slice(index, index + 2);
    grams.set(gram, (grams.get(gram) || 0) + 1);
  }
  return grams;
}

/** Sørensen–Dice similarity on character bigrams (0..1). */
export function titleSimilarity(left: string, right: string): number {
  if (left === right) return 1;
  if (left.length < 2 || right.length < 2) return 0;
  const leftGrams = bigrams(left);
  const rightGrams = bigrams(right);
  let overlap = 0;
  let leftTotal = 0;
  let rightTotal = 0;
  for (const count of leftGrams.values()) leftTotal += count;
  for (const [gram, count] of rightGrams) {
    rightTotal += count;
    overlap += Math.min(count, leftGrams.get(gram) || 0);
  }
  return (2 * overlap) / (leftTotal + rightTotal);
}

class UnionFind {
  private readonly parent: number[];

  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, index) => index);
  }

  find(index: number): number {
    let root = index;
    while (this.parent[root] !== root) root = this.parent[root];
    let cursor = index;
    while (this.parent[cursor] !== root) {
      const next = this.parent[cursor];
      this.parent[cursor] = root;
      cursor = next;
    }
    return root;
  }

  union(left: number, right: number) {
    const leftRoot = this.find(left);
    const rightRoot = this.find(right);
    if (leftRoot !== rightRoot) this.parent[rightRoot] = leftRoot;
  }
}

function isbnOf(book: DuplicateCandidate) {
  return normalizeIsbn(book.isbn) || normalizeIsbn(book.identifier);
}

export function duplicateGroupKey(books: DuplicateCandidate[]): string {
  return books.map((book) => book.fileHash).sort().join("|");
}

export function findDuplicateGroups<T extends DuplicateCandidate>(
  books: T[],
  options: { dismissedKeys?: Iterable<string> } = {},
): DuplicateGroup<T>[] {
  const dismissed = new Set(options.dismissedKeys || []);
  const unions = new UnionFind(books.length);
  const reasons = new Map<string, Set<DuplicateReason>>();
  const link = (left: number, right: number, reason: DuplicateReason) => {
    const leftBook = books[left];
    const rightBook = books[right];
    // Files already merged as formats of one book are not duplicates of each other.
    if (leftBook.bookId && leftBook.bookId === rightBook.bookId) return;
    unions.union(left, right);
    const pairKey = [leftBook.fileHash, rightBook.fileHash].sort().join("|");
    const set = reasons.get(pairKey) || new Set<DuplicateReason>();
    set.add(reason);
    reasons.set(pairKey, set);
  };

  const byIsbn = new Map<string, number[]>();
  const byTitle = new Map<string, number[]>();
  const normalizedTitles = books.map((book) => normalizeDuplicateTitle(book.title, book.fileType));
  books.forEach((book, index) => {
    const isbn = isbnOf(book);
    if (isbn) byIsbn.set(isbn, [...(byIsbn.get(isbn) || []), index]);
    const title = normalizedTitles[index];
    if (title.length >= 2) byTitle.set(title, [...(byTitle.get(title) || []), index]);
  });

  for (const indexes of byIsbn.values()) {
    for (let index = 1; index < indexes.length; index += 1) link(indexes[0], indexes[index], "isbn");
  }

  for (const indexes of byTitle.values()) {
    for (let left = 0; left < indexes.length; left += 1) {
      for (let right = left + 1; right < indexes.length; right += 1) {
        const leftBook = books[indexes[left]];
        const rightBook = books[indexes[right]];
        const leftIsbn = isbnOf(leftBook);
        const rightIsbn = isbnOf(rightBook);
        // Two different ISBNs mean two editions: keep them apart.
        if (leftIsbn && rightIsbn && leftIsbn !== rightIsbn) continue;
        if (authorsCompatible(leftBook.author, rightBook.author)) link(indexes[left], indexes[right], "sameTitle");
      }
    }
  }

  // Fuzzy pass, blocked by the first title word to stay near-linear on big libraries.
  const blocks = new Map<string, string[]>();
  for (const title of byTitle.keys()) {
    const firstWord = title.split(" ")[0];
    if (firstWord.length < 3) continue;
    blocks.set(firstWord, [...(blocks.get(firstWord) || []), title]);
  }
  for (const titles of blocks.values()) {
    if (titles.length < 2 || titles.length > MAX_FUZZY_BLOCK) continue;
    for (let left = 0; left < titles.length; left += 1) {
      for (let right = left + 1; right < titles.length; right += 1) {
        const leftTitle = titles[left];
        const rightTitle = titles[right];
        if (Math.min(leftTitle.length, rightTitle.length) < 6) continue;
        if (titleSimilarity(leftTitle, rightTitle) < FUZZY_THRESHOLD) continue;
        for (const leftIndex of byTitle.get(leftTitle)!) {
          for (const rightIndex of byTitle.get(rightTitle)!) {
            const leftBook = books[leftIndex];
            const rightBook = books[rightIndex];
            // A fuzzy match needs positive author evidence, not just "unknown".
            if (!leftBook.author || !rightBook.author) continue;
            const leftIsbn = isbnOf(leftBook);
            const rightIsbn = isbnOf(rightBook);
            if (leftIsbn && rightIsbn && leftIsbn !== rightIsbn) continue;
            if (authorsCompatible(leftBook.author, rightBook.author)) link(leftIndex, rightIndex, "similarTitle");
          }
        }
      }
    }
  }

  const grouped = new Map<number, number[]>();
  books.forEach((_, index) => {
    const root = unions.find(index);
    grouped.set(root, [...(grouped.get(root) || []), index]);
  });

  const groups: DuplicateGroup<T>[] = [];
  for (const indexes of grouped.values()) {
    if (indexes.length < 2) continue;
    const members = indexes.map((index) => books[index]);
    const distinctBooks = new Set(members.map((book) => book.bookId || book.fileHash));
    if (distinctBooks.size < 2) continue;
    const key = duplicateGroupKey(members);
    if (dismissed.has(key)) continue;
    const groupReasons = new Set<DuplicateReason>();
    for (let left = 0; left < members.length; left += 1) {
      for (let right = left + 1; right < members.length; right += 1) {
        const pair = reasons.get([members[left].fileHash, members[right].fileHash].sort().join("|"));
        pair?.forEach((reason) => groupReasons.add(reason));
      }
    }
    const order: DuplicateReason[] = ["isbn", "sameTitle", "similarTitle"];
    groups.push({ key, books: members, reasons: order.filter((reason) => groupReasons.has(reason)) });
  }

  const strength = (group: DuplicateGroup<T>) => (group.reasons.includes("isbn") ? 0 : group.reasons.includes("sameTitle") ? 1 : 2);
  return groups.sort((left, right) => (
    strength(left) - strength(right)
    || normalizedTitleOf(left).localeCompare(normalizedTitleOf(right))
  ));
}

function normalizedTitleOf(group: DuplicateGroup) {
  return normalizeDuplicateTitle(group.books[0]?.title || "", group.books[0]?.fileType);
}
