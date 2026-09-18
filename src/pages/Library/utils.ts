import { FolderInfo } from "../../types/LibraryTypes";

export {
  classifyFolder,
  classifyFolders,
  getTitleWithoutExtension,
  type FolderType,
} from "../../features/library/model/folders";
export {
  calculateSimilarity,
  normalizeText,
  tokenize,
} from "../../features/library/model/search";

export const LOCAL_BOOK_PREFIX = "local-";

export function getFileTypeLabel(fileType?: string, filePath?: string): string {
  const inferredType =
    fileType || filePath?.split(".").pop()?.toLowerCase() || "arquivo";
  return inferredType.toUpperCase();
}

export function formatPageCount(numPages: number, fileType?: string): string {
  const unit = fileType === "epub" ? "cap." : "pags.";
  return `${numPages || 0} ${unit}`;
}

export function getBookFolderLabel(filePath?: string | null): string {
  if (!filePath) return "Sem pasta";

  const normalizedPath = filePath.replace(/\\/g, "/");
  const parts = normalizedPath.split("/").filter(Boolean);
  const fileName = parts.at(-1);
  const folderParts = fileName ? parts.slice(0, -1) : parts;
  const libraryIndex = folderParts.findIndex(
    (part) => part.toLowerCase() === "library",
  );
  const relativeFolders =
    libraryIndex >= 0 ? folderParts.slice(libraryIndex + 1) : folderParts.slice(-1);

  if (relativeFolders.length === 0) return "Raiz";
  return relativeFolders.join(" / ");
}

export function formatFileSize(bytes?: number): string {
  if (!bytes) return "-";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export function formatShortDate(dateStr?: string | null): string {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("pt-BR");
}

export function normalizeFolderPath(folderPath?: string | null): string {
  return (folderPath || "")
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "");
}

export function folderPathsEqual(
  first?: string | null,
  second?: string | null,
): boolean {
  return normalizeFolderPath(first) === normalizeFolderPath(second);
}

export function findFolderTrail(
  folders: FolderInfo[],
  folderPath?: string | null,
): FolderInfo[] {
  const targetPath = normalizeFolderPath(folderPath);
  if (!targetPath) return [];

  const visit = (items: FolderInfo[]): FolderInfo[] | null => {
    for (const item of items) {
      if (folderPathsEqual(item.path, targetPath)) {
        return [item];
      }

      const childTrail = visit(item.subfolders);
      if (childTrail) {
        return [item, ...childTrail];
      }
    }

    return null;
  };

  return visit(folders) || [];
}

export function getFolderChildren(
  folders: FolderInfo[],
  folderPath?: string | null,
): FolderInfo[] {
  const normalizedPath = normalizeFolderPath(folderPath);
  if (!normalizedPath) return folders;

  return findFolderTrail(folders, normalizedPath).at(-1)?.subfolders || [];
}

export interface FolderBreadcrumb {
  label: string;
  path: string | null;
}

export function getFolderBreadcrumbs(
  folders: FolderInfo[],
  folderPath?: string | null,
): FolderBreadcrumb[] {
  const breadcrumbs: FolderBreadcrumb[] = [{ label: "Raiz", path: null }];
  const trail = findFolderTrail(folders, folderPath);

  if (trail.length > 0) {
    return [
      ...breadcrumbs,
      ...trail.map((folder) => ({
        label: folder.name,
        path: folder.path,
      })),
    ];
  }

  const segments = normalizeFolderPath(folderPath).split("/").filter(Boolean);
  return [
    ...breadcrumbs,
    ...segments.map((segment, index) => ({
      label: segment,
      path: segments.slice(0, index + 1).join("/"),
    })),
  ];
}

export function getParentFolderPath(
  folders: FolderInfo[],
  folderPath?: string | null,
): string | null {
  const trail = findFolderTrail(folders, folderPath);
  if (trail.length > 1) return trail.at(-2)?.path || null;
  if (trail.length === 1) return null;

  const segments = normalizeFolderPath(folderPath).split("/").filter(Boolean);
  if (segments.length <= 1) return null;
  return segments.slice(0, -1).join("/");
}

export function getFolderBookCount(folder: FolderInfo): number {
  return Math.max(0, folder.bookCount || 0);
}
