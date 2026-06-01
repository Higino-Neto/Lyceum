export type MetadataSearchSource = "openlibrary" | "google" | "loc";
export type MetadataSearchField = "title" | "author" | "isbn";
export type MetadataSearchScope = MetadataSearchSource | "all";

export interface BookMetadataCandidate {
  id: string;
  source: MetadataSearchSource;
  sourceLabel: string;
  title: string;
  subtitle?: string;
  authors: string[];
  publisher?: string;
  publishedDate?: string;
  language?: string;
  isbn10?: string;
  isbn13?: string;
  pageCount?: number;
  categories: string[];
  description?: string;
  thumbnailUrl?: string;
  externalUrl?: string;
}

export interface BookMetadataSearchResponse {
  results: BookMetadataCandidate[];
  warnings: string[];
}

const SOURCE_LABELS: Record<MetadataSearchSource, string> = {
  openlibrary: "Open Library",
  google: "Google Books",
  loc: "Library of Congress",
};

function cleanText(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.replace(/\s+/g, " ").trim();
    return trimmed || undefined;
  }
  return undefined;
}

function cleanArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(cleanText)
    .filter((item): item is string => Boolean(item));
}

function uniq(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function normalizeLanguage(value: unknown): string | undefined {
  if (Array.isArray(value)) return normalizeLanguage(value[0]);
  const text = cleanText(value);
  if (!text) return undefined;
  const lower = text.toLowerCase();
  if (lower === "por" || lower === "portuguese") return "pt-BR";
  if (lower === "eng" || lower === "english") return "en";
  if (lower === "spa" || lower === "spanish") return "es";
  if (lower === "fre" || lower === "fra" || lower === "french") return "fr";
  return text;
}

function normalizeIsbn(value: unknown) {
  const items = cleanArray(value).map((item) => item.replace(/[^0-9Xx]/g, "").toUpperCase());
  return {
    isbn10: items.find((item) => item.length === 10),
    isbn13: items.find((item) => item.length === 13),
  };
}

function secureImageUrl(value: unknown): string | undefined {
  const text = cleanText(value);
  if (!text) return undefined;
  return text.startsWith("http://") ? `https://${text.slice(7)}` : text;
}

function buildOpenLibraryUrl(query: string, field: MetadataSearchField, limit: number) {
  const params = new URLSearchParams({
    limit: String(limit),
    fields: [
      "key",
      "title",
      "subtitle",
      "author_name",
      "cover_i",
      "first_publish_year",
      "publish_date",
      "language",
      "isbn",
      "publisher",
      "subject",
      "number_of_pages_median",
    ].join(","),
  });
  params.set(field === "isbn" ? "isbn" : field === "author" ? "author" : "title", query);
  return `https://openlibrary.org/search.json?${params.toString()}`;
}

function mapOpenLibraryBook(book: any): BookMetadataCandidate | null {
  const title = cleanText(book.title);
  if (!title) return null;
  const isbns = normalizeIsbn(book.isbn);
  const coverId = typeof book.cover_i === "number" ? book.cover_i : undefined;
  const publishedDate = cleanText(book.publish_date?.[0]) || cleanText(book.first_publish_year?.toString());
  return {
    id: `openlibrary:${book.key || title}`,
    source: "openlibrary",
    sourceLabel: SOURCE_LABELS.openlibrary,
    title,
    subtitle: cleanText(book.subtitle),
    authors: cleanArray(book.author_name),
    publisher: cleanText(book.publisher?.[0]),
    publishedDate,
    language: normalizeLanguage(book.language),
    isbn10: isbns.isbn10,
    isbn13: isbns.isbn13,
    pageCount: typeof book.number_of_pages_median === "number" ? book.number_of_pages_median : undefined,
    categories: cleanArray(book.subject).slice(0, 6),
    thumbnailUrl: coverId
      ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`
      : isbns.isbn13
        ? `https://covers.openlibrary.org/b/isbn/${isbns.isbn13}-L.jpg`
        : undefined,
    externalUrl: book.key ? `https://openlibrary.org${book.key}` : undefined,
  };
}

function buildGoogleBooksUrl(query: string, field: MetadataSearchField, limit: number) {
  const searchQuery = field === "isbn"
    ? `isbn:${query}`
    : field === "author"
      ? `inauthor:${query}`
      : `intitle:${query}`;
  const params = new URLSearchParams({
    q: searchQuery,
    maxResults: String(Math.min(limit, 40)),
    printType: "books",
  });
  return `https://www.googleapis.com/books/v1/volumes?${params.toString()}`;
}

function mapGoogleBook(item: any): BookMetadataCandidate | null {
  const info = item.volumeInfo || {};
  const title = cleanText(info.title);
  if (!title) return null;
  const identifiers = Array.isArray(info.industryIdentifiers)
    ? info.industryIdentifiers.map((entry: any) => entry?.identifier)
    : [];
  const isbns = normalizeIsbn(identifiers);
  const imageLinks = info.imageLinks || {};
  return {
    id: `google:${item.id || title}`,
    source: "google",
    sourceLabel: SOURCE_LABELS.google,
    title,
    subtitle: cleanText(info.subtitle),
    authors: cleanArray(info.authors),
    publisher: cleanText(info.publisher),
    publishedDate: cleanText(info.publishedDate),
    language: normalizeLanguage(info.language),
    isbn10: isbns.isbn10,
    isbn13: isbns.isbn13,
    pageCount: typeof info.pageCount === "number" ? info.pageCount : undefined,
    categories: cleanArray(info.categories),
    description: cleanText(info.description),
    thumbnailUrl: secureImageUrl(imageLinks.extraLarge || imageLinks.large || imageLinks.medium || imageLinks.thumbnail),
    externalUrl: cleanText(info.infoLink),
  };
}

function buildLocUrl(query: string, field: MetadataSearchField, limit: number) {
  const cleanQuery = field === "isbn" ? query.replace(/[^0-9Xx]/g, "") : `"${query.replace(/"/g, " ")}"`;
  const params = new URLSearchParams({
    version: "1.1",
    operation: "searchRetrieve",
    query: cleanQuery,
    startRecord: "1",
    maximumRecords: String(limit),
    recordSchema: "mods",
  });
  return `http://lx2.loc.gov:210/LCDB?${params.toString()}`;
}

function decodeXmlText(value: string) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'");
}

function textFromXml(source: string, tag: string) {
  return cleanText(decodeXmlText(source.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"))?.[1] || "").replace(/<[^>]+>/g, " "));
}

function textsFromXml(source: string, tag: string) {
  return Array.from(source.matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi")))
    .map((match) => cleanText(decodeXmlText(match[1]).replace(/<[^>]+>/g, " ")))
    .filter((item): item is string => Boolean(item));
}

function attrValue(source: string, attr: string) {
  return source.match(new RegExp(`${attr}\\s*=\\s*["']([^"']+)["']`, "i"))?.[1];
}

function parsePageCountFromExtent(extent: string | undefined) {
  if (!extent) return undefined;
  const match = extent.match(/\b(\d{2,4})\s*(?:p\.|pages|pp\.)/i);
  if (!match) return undefined;
  const value = Number.parseInt(match[1], 10);
  return Number.isFinite(value) ? value : undefined;
}

function mapLocMods(mods: string, index: number): BookMetadataCandidate | null {
  const title = textFromXml(mods, "title");
  if (!title) return null;
  const nameBlocks = Array.from(mods.matchAll(/<name\b([^>]*)>([\s\S]*?)<\/name>/gi));
  const authors = nameBlocks
    .filter((match) => attrValue(match[1], "type") !== "conference")
    .map((match) => textFromXml(match[2], "namePart"))
    .filter((item): item is string => Boolean(item));
  const origin = mods.match(/<originInfo\b[^>]*>([\s\S]*?)<\/originInfo>/i)?.[1] || "";
  const identifiers = Array.from(mods.matchAll(/<identifier\b([^>]*)>([\s\S]*?)<\/identifier>/gi));
  const isbnValues = identifiers
    .filter((match) => attrValue(match[1], "type") === "isbn")
    .map((match) => decodeXmlText(match[2]));
  const lccn = identifiers.find((match) => attrValue(match[1], "type") === "lccn")?.[2];
  const isbns = normalizeIsbn(isbnValues);
  const recordId = textFromXml(mods, "recordIdentifier") || decodeXmlText(lccn || "") || String(index);

  return {
    id: `loc:${recordId}`,
    source: "loc",
    sourceLabel: SOURCE_LABELS.loc,
    title,
    authors: uniq(authors).slice(0, 4),
    publisher: textFromXml(origin, "agent"),
    publishedDate: textFromXml(origin, "dateIssued"),
    language: normalizeLanguage(textFromXml(mods, "languageTerm")),
    isbn10: isbns.isbn10,
    isbn13: isbns.isbn13,
    pageCount: parsePageCountFromExtent(textFromXml(mods, "extent")),
    categories: uniq([...textsFromXml(mods, "topic"), ...textsFromXml(mods, "genre")]).slice(0, 6),
    description: textFromXml(mods, "abstract") || textFromXml(mods, "note"),
    externalUrl: recordId ? `https://lccn.loc.gov/${encodeURIComponent(recordId)}` : undefined,
  };
}

async function fetchJson(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function fetchText(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

export async function searchBookMetadata(
  source: MetadataSearchSource,
  query: string,
  field: MetadataSearchField,
  limit = 12,
): Promise<BookMetadataCandidate[]> {
  const cleanQuery = query.trim();
  if (cleanQuery.length < 2) return [];

  if (source === "openlibrary") {
    const data = await fetchJson(buildOpenLibraryUrl(cleanQuery, field, limit));
    return (data.docs || []).map(mapOpenLibraryBook).filter(Boolean);
  }

  if (source === "google") {
    const data = await fetchJson(buildGoogleBooksUrl(cleanQuery, field, limit));
    return (data.items || []).map(mapGoogleBook).filter(Boolean);
  }

  const data = await fetchText(buildLocUrl(cleanQuery, field, limit));
  return Array.from(data.matchAll(/<mods\b[\s\S]*?<\/mods>/gi))
    .map((match, index) => mapLocMods(match[0], index))
    .filter(Boolean);
}

export async function searchBookMetadataSources(
  source: MetadataSearchScope,
  query: string,
  field: MetadataSearchField,
  limit = 12,
): Promise<BookMetadataSearchResponse> {
  const sources: MetadataSearchSource[] = source === "all"
    ? ["openlibrary", "google", "loc"]
    : [source];
  const settled = await Promise.allSettled(
    sources.map(async (item) => ({
      source: item,
      results: await searchBookMetadata(item, query, field, limit),
    })),
  );
  const warnings: string[] = [];
  const results: BookMetadataCandidate[] = [];

  settled.forEach((entry, index) => {
    if (entry.status === "fulfilled") {
      results.push(...entry.value.results);
      return;
    }
    warnings.push(`${SOURCE_LABELS[sources[index]]}: ${entry.reason instanceof Error ? entry.reason.message : String(entry.reason)}`);
  });

  return {
    results: dedupeMetadataCandidates(results),
    warnings,
  };
}

export function dedupeMetadataCandidates(candidates: BookMetadataCandidate[]) {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = [
      candidate.title.toLowerCase(),
      candidate.authors.join(",").toLowerCase(),
      candidate.isbn13 || candidate.isbn10 || "",
    ].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function candidateToEditableMetadata(candidate: BookMetadataCandidate) {
  return {
    title: candidate.title,
    author: candidate.authors.join(", "),
    description: candidate.description || "",
    isbn: candidate.isbn13 || candidate.isbn10 || "",
    publisher: candidate.publisher || "",
    publishDate: candidate.publishedDate || "",
    language: candidate.language || "",
    identifier: candidate.isbn13 || candidate.isbn10 || candidate.id,
    subject: uniq(candidate.categories).join(", "),
    titleSort: candidate.title,
    authorSort: candidate.authors.join(", "),
    pageCount: candidate.pageCount,
  };
}
