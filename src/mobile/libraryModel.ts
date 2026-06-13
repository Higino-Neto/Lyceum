import type {
  MobileBook,
  MobileFileType,
  MobileLibraryFolder,
  MobileLibraryScope,
  MobileLibrarySort,
  MobileSourceFolder,
} from "./types";
import { createFolder } from "./storage";

export interface MobileLibraryQuery {
  search: string;
  scope: MobileLibraryScope;
  fileType: "all" | MobileFileType;
  sort: MobileLibrarySort;
  folderId?: string;
  sourceFolderId?: string;
  favoritesOnly?: boolean;
}

export function getBookProgress(book: MobileBook) {
  if (book.fileType === "epub" || book.fileType === "txt") {
    return Math.round(book.progressPercent || book.textScrollPercent || 0);
  }
  if (book.totalPages <= 1) return 0;
  return Math.min(100, Math.max(0, Math.round((book.currentPage / book.totalPages) * 100)));
}

export function folderPath(folderId: string | undefined, folders: MobileLibraryFolder[]) {
  if (!folderId) return "Biblioteca";
  const names: string[] = [];
  const visited = new Set<string>();
  let current = folders.find((folder) => folder.id === folderId);
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    names.unshift(current.name);
    current = current.parentId ? folders.find((folder) => folder.id === current?.parentId) : undefined;
  }
  return names.join(" / ") || "Biblioteca";
}

export function descendantFolderIds(folderId: string, folders: MobileLibraryFolder[]) {
  const ids = new Set([folderId]);
  let changed = true;
  while (changed) {
    changed = false;
    folders.forEach((folder) => {
      if (folder.parentId && ids.has(folder.parentId) && !ids.has(folder.id)) {
        ids.add(folder.id);
        changed = true;
      }
    });
  }
  return ids;
}

export function queryMobileBooks(
  books: MobileBook[],
  folders: MobileLibraryFolder[],
  sourceFolders: MobileSourceFolder[],
  query: MobileLibraryQuery,
) {
  const normalized = query.search.trim().toLocaleLowerCase("pt-BR");
  const folderIds = query.folderId ? descendantFolderIds(query.folderId, folders) : null;
  const filtered = books.filter((book) => {
    if (query.scope === "managed" && book.sourceFolderId) return false;
    if (query.scope === "source" && !book.sourceFolderId) return false;
    if (query.fileType !== "all" && book.fileType !== query.fileType) return false;
    if (query.favoritesOnly && !book.isFavorite) return false;
    if (folderIds && (!book.folderId || !folderIds.has(book.folderId))) return false;
    if (query.sourceFolderId && book.sourceFolderId !== query.sourceFolderId) return false;
    if (!normalized) return true;
    const sourceName = sourceFolders.find((source) => source.id === book.sourceFolderId)?.name;
    const fields = [
      book.title,
      book.author,
      book.fileName,
      book.category,
      book.notes,
      book.description,
      folderPath(book.folderId, folders),
      sourceName,
    ];
    return fields.filter(Boolean).some((value) => String(value).toLocaleLowerCase("pt-BR").includes(normalized));
  });

  return filtered.sort((left, right) => {
    switch (query.sort) {
      case "title_desc":
        return right.title.localeCompare(left.title, "pt-BR");
      case "recent_desc":
        return String(right.lastOpenedAt || "").localeCompare(String(left.lastOpenedAt || ""));
      case "imported_desc":
        return right.importedAt.localeCompare(left.importedAt);
      case "progress_desc":
        return getBookProgress(right) - getBookProgress(left);
      case "size_desc":
        return (right.fileSize || 0) - (left.fileSize || 0);
      default:
        return left.title.localeCompare(right.title, "pt-BR");
    }
  });
}

export function findDuplicateBook(books: MobileBook[], file: File, sourceRelativePath?: string) {
  const normalizedName = file.name.toLocaleLowerCase("pt-BR");
  const normalizedRelative = sourceRelativePath?.replace(/\\/g, "/").toLocaleLowerCase("pt-BR");
  return books.find((book) => {
    if (normalizedRelative && book.sourceRelativePath?.toLocaleLowerCase("pt-BR") === normalizedRelative) return true;
    return book.fileName.toLocaleLowerCase("pt-BR") === normalizedName
      && Boolean(file.size)
      && book.fileSize === file.size;
  });
}

export function ensureFolderPath(
  pathParts: string[],
  folders: MobileLibraryFolder[],
  rootParentId?: string,
) {
  const nextFolders = [...folders];
  let parentId = rootParentId;
  for (const rawPart of pathParts) {
    const name = rawPart.trim();
    if (!name) continue;
    let folder = nextFolders.find((candidate) => candidate.parentId === parentId && candidate.name.toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR"));
    if (!folder) {
      folder = createFolder(name, parentId);
      nextFolders.push(folder);
    }
    parentId = folder.id;
  }
  return { folders: nextFolders, folderId: parentId };
}

export function sanitizeFolderName(name: string) {
  return name.replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim();
}

export function formatFileSize(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
