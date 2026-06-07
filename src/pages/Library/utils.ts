import { FolderInfo } from "../../types/LibraryTypes";

export type FolderType = "normal" | "merged" | "collection";

export function classifyFolder(name: string): FolderType {
  if (name.startsWith("__")) return "collection";
  if (name.startsWith("_")) return "merged";
  return "normal";
}

export function classifyFolders(folders: FolderInfo[]): {
  normal: FolderInfo[];
  merged: FolderInfo[];
  collection: FolderInfo[];
} {
  const result = {
    normal: [] as FolderInfo[],
    merged: [] as FolderInfo[],
    collection: [] as FolderInfo[],
  };

  for (const folder of folders) {
    result[classifyFolder(folder.name)].push(folder);
  }

  return result;
}

export const LOCAL_BOOK_PREFIX = "local-";

export const getTitleWithoutExtension = (title: string, fileType?: string) => {
  if (fileType) {
    return title.replace(new RegExp(`\\.${fileType}$`, "i"), "");
  }
  return title.replace(/\.pdf$/i, "");
};

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
