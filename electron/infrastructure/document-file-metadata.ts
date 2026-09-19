import fs from "node:fs";
import path from "node:path";

export function getFileName(filePath: string | null | undefined): string | null {
  return filePath ? path.basename(filePath) : null;
}

export function getFolderPath(filePath: string | null | undefined): string | null {
  return filePath ? path.dirname(filePath).replace(/\\/g, "/") : null;
}

export function getFileMtime(filePath: string | null | undefined): number | null {
  if (!filePath) return null;
  try {
    return Math.round(fs.statSync(filePath).mtimeMs);
  } catch {
    return null;
  }
}
