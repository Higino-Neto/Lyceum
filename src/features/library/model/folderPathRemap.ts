/**
 * Folder paths in the renderer come in two shapes: relative to the managed
 * library root ("Fiction/French") or absolute (source folders). After a folder
 * is renamed or moved, anything that pointed at it or inside it — the current
 * selection, expanded tree rows — has to follow it, or the library suddenly
 * shows an empty, nonexistent folder.
 */
function normalize(value: string) {
  return value.replace(/\\/g, "/").replace(/\/+$/, "");
}

function isAbsolute(value: string) {
  return value.startsWith("/") || /^[a-zA-Z]:\//.test(value);
}

function sameOrInside(candidate: string, base: string, caseInsensitive: boolean) {
  const a = caseInsensitive ? candidate.toLowerCase() : candidate;
  const b = caseInsensitive ? base.toLowerCase() : base;
  return a === b || a.startsWith(`${b}/`);
}

/**
 * Returns where `folderPath` lives after `oldFullPath` became `newFullPath`,
 * in the same shape (relative or absolute) it was given, or `null` when it is
 * unaffected.
 */
export function remapFolderPath(
  folderPath: string | null,
  oldFullPath: string,
  newFullPath: string,
  libraryRootPath: string | null,
): string | null {
  if (!folderPath) return null;
  const root = libraryRootPath ? normalize(libraryRootPath) : "";
  const toAbsolute = (value: string) => (isAbsolute(value) || !root ? value : `${root}/${value}`);
  const oldFull = toAbsolute(normalize(oldFullPath));
  const newFull = toAbsolute(normalize(newFullPath));
  const input = normalize(folderPath);
  const relative = !isAbsolute(input);
  if (relative && !root) return null;
  const absolute = relative ? `${root}/${input}` : input;
  const caseInsensitive = /^[a-zA-Z]:\//.test(absolute);
  if (!sameOrInside(absolute, oldFull, caseInsensitive)) return null;

  const moved = `${newFull}${absolute.slice(oldFull.length)}`;
  if (!relative) return moved;
  if (!sameOrInside(moved, root, caseInsensitive) || moved.length === root.length) return null;
  return moved.slice(root.length + 1);
}

/** Window event fired after a folder is renamed or moved, for UI state keyed by folder path. */
export const FOLDER_RELOCATED_EVENT = "lyceum:folder-relocated";

export interface FolderRelocatedDetail {
  oldFullPath: string;
  newFullPath: string;
  libraryRootPath: string | null;
}
