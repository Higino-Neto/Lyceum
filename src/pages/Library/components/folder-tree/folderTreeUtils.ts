import type { FolderInfo } from "../../../../types/LibraryTypes";
import type { DocumentRecord } from "../../../../types/ReadingTypes";
import { classifyFolder } from "../../utils";
import type { FlatFolderNode, FolderTreeListItem } from "./types";

export function normalizeAbsolutePath(value: string) {
  return value.replace(/\\/g, "/").replace(/\/+$/g, "").toLowerCase();
}

export function isAbsoluteLike(value: string) {
  return /^[a-zA-Z]:[\\/]/.test(value) || value.startsWith("/") || value.startsWith("\\\\");
}

export function visibleFolders(folders: FolderInfo[]) {
  return folders
    .filter((folder) => !folder.name.startsWith(".") && classifyFolder(folder.name) === "normal")
    .map((folder) => ({
      ...folder,
      subfolders: visibleFolders(folder.subfolders),
    }));
}

export function countDocsInFolder(
  folderPath: string | null,
  libraryPath: string,
  documents: DocumentRecord[],
  includeNested = true,
) {
  if (!libraryPath || documents.length === 0) return 0;

  const targetPath = folderPath
    ? isAbsoluteLike(folderPath)
      ? folderPath
      : `${libraryPath}\\${folderPath.replace(/\//g, "\\")}`
    : libraryPath;
  const normalizedTarget = normalizeAbsolutePath(targetPath);

  return documents.filter((doc) => {
    if (!doc.filePath) return false;
    const normalizedFilePath = normalizeAbsolutePath(doc.filePath);
    const lastSlash = normalizedFilePath.lastIndexOf("/");
    const docDir = lastSlash >= 0 ? normalizedFilePath.slice(0, lastSlash) : normalizedFilePath;
    return includeNested
      ? docDir === normalizedTarget || docDir.startsWith(`${normalizedTarget}/`)
      : docDir === normalizedTarget;
  }).length;
}

export function filterFolders(folders: FolderInfo[], searchTerm: string): FolderInfo[] {
  if (!searchTerm) return folders;
  const term = searchTerm.toLowerCase();

  return folders
    .map((folder) => {
      const matchingSubfolders = filterFolders(folder.subfolders, term);
      if (folder.name.toLowerCase().includes(term) || matchingSubfolders.length > 0) {
        return { ...folder, subfolders: matchingSubfolders };
      }
      return null;
    })
    .filter((folder): folder is FolderInfo => Boolean(folder));
}

export function flattenTree(
  folders: FolderInfo[],
  expandedPaths: Set<string>,
  depth = 0,
  sourceRootPaths = new Set<string>(),
): FlatFolderNode[] {
  const nodes: FlatFolderNode[] = [];

  for (const folder of visibleFolders(folders)) {
    const isExpanded = expandedPaths.has(folder.path);
    const isSourceRoot = sourceRootPaths.has(normalizeAbsolutePath(folder.fullPath));
    nodes.push({
      folder,
      depth,
      isExpanded,
      sourcePathLabel: isSourceRoot ? folder.fullPath : undefined,
    });

    if (isExpanded && folder.subfolders.length > 0) {
      nodes.push(...flattenTree(folder.subfolders, expandedPaths, depth + 1, sourceRootPaths));
    }
  }

  return nodes;
}

export function collectExpandablePaths(folders: FolderInfo[]) {
  const paths = new Set<string>();
  const visit = (items: FolderInfo[]) => {
    for (const folder of visibleFolders(items)) {
      if (folder.subfolders.length > 0) {
        paths.add(folder.path);
        visit(folder.subfolders);
      }
    }
  };
  visit(folders);
  return paths;
}

export function updateFolderChildren(
  folders: FolderInfo[],
  folderPath: string,
  children: FolderInfo[],
): FolderInfo[] {
  return folders.map((folder) => {
    if (folder.path === folderPath) {
      return {
        ...folder,
        subfolders: visibleFolders(children),
        hasChildren: children.length > 0,
        isLoaded: true,
      };
    }

    if (folder.subfolders.length === 0) return folder;
    return { ...folder, subfolders: updateFolderChildren(folder.subfolders, folderPath, children) };
  });
}

export function withCreateRows(
  nodes: FlatFolderNode[],
  creatingFolderAt: string | null,
): FolderTreeListItem[] {
  const items: FolderTreeListItem[] = [];
  for (const node of nodes) {
    items.push({ kind: "folder", node });
    if (creatingFolderAt === node.folder.path) {
      items.push({ kind: "create", parentPath: node.folder.path, depth: node.depth + 1 });
    }
  }
  return items;
}
