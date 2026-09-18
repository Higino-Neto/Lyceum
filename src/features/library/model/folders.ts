import type { FolderInfo } from "../../../types/LibraryTypes";

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

  for (const folder of folders) result[classifyFolder(folder.name)].push(folder);
  return result;
}

export function getTitleWithoutExtension(title: string, fileType?: string): string {
  return fileType ? title.replace(new RegExp(`\\.${fileType}$`, "i"), "") : title.replace(/\.pdf$/i, "");
}
