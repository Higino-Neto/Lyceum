import type {
  BookWithThumbnail,
  FolderInfo,
  LibraryFileTypeFilter,
  LibrarySortOption,
} from "../../../types/LibraryTypes";
import { classifyFolder, getTitleWithoutExtension } from "./folders";
import { calculateSimilarity } from "./search";

export type SpecialFolderType = "merged" | "collection";

export function isAbsoluteFolderPath(folderPath: string | null): boolean {
  return Boolean(
    folderPath
    && (/^[a-zA-Z]:[\\/]/.test(folderPath) || folderPath.startsWith("/") || folderPath.startsWith("\\\\")),
  );
}

export function getPathLeaf(folderPath?: string | null): string {
  return (folderPath || "").split(/[\\/]+/).filter(Boolean).at(-1) || "";
}

export function normalizeAbsoluteFolderPath(folderPath?: string | null): string {
  return (folderPath || "").replace(/\\/g, "/").replace(/\/+$/g, "").toLowerCase();
}

function stripSpecialFolderPrefix(name: string): string {
  return name.replace(/^_+/, "") || name;
}

function getSyntheticFolderId(folderPath: string): number {
  let hash = 0;
  for (let index = 0; index < folderPath.length; index++) {
    hash = ((hash << 5) - hash + folderPath.charCodeAt(index)) | 0;
  }
  return -Math.max(1, Math.abs(hash));
}

export function pickRepresentativeBook(books: BookWithThumbnail[]): BookWithThumbnail | undefined {
  return (
    books.find((book) => book.thumbnailPath && (book.fileType === "epub" || book.fileType === "pdf"))
    || books.find((book) => book.fileType === "epub" || book.fileType === "pdf")
    || books.find((book) => book.thumbnailPath || book.thumbnail)
    || books.find((book) => book.fileType === "epub")
    || books[0]
  );
}

export function buildSpecialFolderBook(
  folder: FolderInfo,
  documents: BookWithThumbnail[],
  folderType: SpecialFolderType,
): BookWithThumbnail {
  const variants = Array.from(
    new Map(documents.map((document) => [document.fileHash, document])).values(),
  );
  const representative = pickRepresentativeBook(variants);
  const folderPath = folder.fullPath || folder.path;
  const title = stripSpecialFolderPrefix(folder.name) || representative?.title || folder.name;

  return {
    ...(representative || {
      filePath: folderPath,
      currentPage: 0,
      currentZoom: null,
      currentScroll: null,
      annotations: null,
      thumbnailPath: null,
      numPages: 0,
      createdAt: new Date(0).toISOString(),
      lastOpenedAt: new Date(0).toISOString(),
      isSynced: 1,
      category: null,
      isFavorite: 0,
      rating: 0,
      notes: null,
      author: null,
      description: null,
      isbn: null,
      publisher: null,
      publishDate: null,
      fileSize: 0,
      processingStatus: "completed" as const,
      fileType: "lyceum" as const,
    }),
    id: getSyntheticFolderId(folderPath),
    title,
    fileHash: `${folderType}-folder:${normalizeAbsoluteFolderPath(folderPath)}`,
    folderPath,
    mergedBooks: variants,
    syntheticFolderPath: folder.path,
    syntheticFolderType: folderType,
  };
}

export function collectSpecialFoldersForDisplay(
  folders: FolderInfo[],
  includeNested: boolean,
): Array<{ folder: FolderInfo; type: SpecialFolderType }> {
  const result: Array<{ folder: FolderInfo; type: SpecialFolderType }> = [];

  const visit = (items: FolderInfo[]) => {
    for (const folder of items) {
      const folderType = classifyFolder(folder.name);
      if (folderType === "merged" || folderType === "collection") {
        result.push({ folder, type: folderType });
      }
      if (includeNested && folder.subfolders.length > 0) visit(folder.subfolders);
    }
  };

  visit(folders);
  return result;
}

function getBookSortTitle(book: BookWithThumbnail): string {
  return getTitleWithoutExtension(
    book.title || book.fileName || book.filePath || "",
    book.fileType,
  ).toLocaleLowerCase("pt-BR");
}

function getBookSortDate(book: BookWithThumbnail): number {
  const value = book.lastOpenedAt || book.updatedAt || book.importedAt || book.createdAt;
  const time = value ? new Date(value).getTime() : 0;
  return Number.isNaN(time) ? 0 : time;
}

export function sortBooksForLibraryView(
  books: BookWithThumbnail[],
  sortOption: LibrarySortOption,
): BookWithThumbnail[] {
  const indexed = books.map((book, index) => ({ book, index }));
  indexed.sort((left, right) => {
    const titleCompare = getBookSortTitle(left.book).localeCompare(
      getBookSortTitle(right.book),
      "pt-BR",
      { sensitivity: "base", numeric: true },
    );

    let result = 0;
    switch (sortOption) {
      case "title_desc": result = -titleCompare || right.book.id - left.book.id; break;
      case "recent":
      case "recent_desc": result = getBookSortDate(right.book) - getBookSortDate(left.book) || right.book.id - left.book.id; break;
      case "recent_asc": result = getBookSortDate(left.book) - getBookSortDate(right.book) || left.book.id - right.book.id; break;
      case "pages":
      case "pages_desc": result = (right.book.numPages || 0) - (left.book.numPages || 0) || titleCompare; break;
      case "pages_asc": result = (left.book.numPages || 0) - (right.book.numPages || 0) || titleCompare; break;
      case "size":
      case "size_desc": result = (right.book.fileSize || 0) - (left.book.fileSize || 0) || titleCompare; break;
      case "size_asc": result = (left.book.fileSize || 0) - (right.book.fileSize || 0) || titleCompare; break;
      case "title":
      case "title_asc":
      default: result = titleCompare || left.book.id - right.book.id; break;
    }

    return result || left.index - right.index;
  });
  return indexed.map(({ book }) => book);
}

export function matchesLibrarySearch(book: BookWithThumbnail, query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed) return true;

  return [book, ...(book.mergedBooks || [])].some((candidate) => {
    const haystack = [
      candidate.title,
      candidate.author,
      candidate.fileName,
      candidate.series,
      candidate.publisher,
    ].filter(Boolean).join(" ");
    return (
      haystack.toLocaleLowerCase("pt-BR").includes(trimmed.toLocaleLowerCase("pt-BR"))
      || calculateSimilarity(candidate.title || "", candidate.author || null, trimmed).matches
    );
  });
}

export function matchesLibraryFileTypes(
  book: BookWithThumbnail,
  filters: LibraryFileTypeFilter[],
): boolean {
  const activeFilters = filters.filter(
    (filter): filter is Exclude<LibraryFileTypeFilter, "all"> => filter !== "all",
  );
  if (activeFilters.length === 0) return true;
  const candidates = book.mergedBooks?.length ? book.mergedBooks : [book];
  return candidates.some(
    (candidate) => candidate.fileType ? activeFilters.includes(candidate.fileType) : false,
  );
}

export function getMergedBookSignature(group: BookWithThumbnail[]): string {
  return group.map((book) => [
    book.id,
    book.fileHash,
    book.title,
    book.filePath,
    book.thumbnail,
    book.thumbnailPath,
    book.numPages,
    book.fileType,
    book.fileSize,
    book.lastOpenedAt,
    book.createdAt,
    book.processingStatus,
    book.updatedAt,
  ].join("\u001f")).join("\u001e");
}
