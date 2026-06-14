import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import electron from "electron";

const { app } = electron;

export const LIBRARY_PATH = () => path.join(app.getPath("userData"), "library");
export const USER_DATA_PATH = () => app.getPath("userData");
export const THUMBNAILS_DIR = () => path.join(app.getPath("userData"), "thumbnails");
export const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/i;
export const ALL_BOOK_EXTENSIONS = new Set([
  ".pdf", ".epub", ".mobi", ".azw", ".azw3", ".azw4",
  ".kfx", ".prc", ".txt", ".docx", ".html", ".cbz", ".lyceum",
]);

export function ensureLibraryFolder(): string {
  const libraryPath = LIBRARY_PATH();
  if (!fs.existsSync(libraryPath)) {
    fs.mkdirSync(libraryPath, { recursive: true });
  }
  return libraryPath;
}

export function generateFileHash(filePath: string): string {
  const fileBuffer = fs.readFileSync(filePath);
  const hash = crypto.createHash("sha256");
  hash.update(fileBuffer);
  return hash.digest("hex");
}

export function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  return Uint8Array.from(buffer).buffer;
}

export function isPathWithin(basePath: string, targetPath: string): boolean {
  const relative = path.relative(path.resolve(basePath), path.resolve(targetPath));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export function assertPathWithin(basePath: string, targetPath: string, errorMessage: string): string {
  const resolvedPath = path.resolve(targetPath);
  if (!isPathWithin(basePath, resolvedPath)) {
    throw new Error(errorMessage);
  }
  return resolvedPath;
}

export function isSafeRelativePath(targetPath: string): boolean {
  if (!targetPath || path.isAbsolute(targetPath)) {
    return false;
  }
  const parts = targetPath.split(/[\\/]+/).filter(Boolean);
  return parts.length > 0 && parts.every((part) => part !== "." && part !== "..");
}

export function resolveLibraryRelativePath(targetPath: string | null | undefined): string {
  const libraryPath = LIBRARY_PATH();
  if (!targetPath) {
    return libraryPath;
  }
  if (!isSafeRelativePath(targetPath)) {
    throw new Error("Caminho inválido");
  }
  return assertPathWithin(
    libraryPath,
    path.resolve(libraryPath, targetPath),
    "Caminho inválido",
  );
}

export function sanitizeFolderName(folderName: string): string {
  const trimmedName = folderName.trim();
  if (
    !trimmedName ||
    trimmedName === "." ||
    trimmedName === ".." ||
    /[\\/:*?"<>|]/.test(trimmedName)
  ) {
    throw new Error("Nome de pasta inválido");
  }
  return trimmedName;
}

export function moveFileAcrossDevices(sourcePath: string, targetPath: string): void {
  if (path.resolve(sourcePath) === path.resolve(targetPath)) {
    return;
  }
  try {
    fs.renameSync(sourcePath, targetPath);
  } catch (error: unknown) {
    const err = error as NodeJS.ErrnoException;
    if (err.code !== "EXDEV") {
      throw error;
    }
    fs.copyFileSync(sourcePath, targetPath);
    fs.unlinkSync(sourcePath);
  }
}

export function getUniqueFilePath(targetDir: string, fileName: string): string {
  const destPath = path.join(targetDir, fileName);
  if (!fs.existsSync(destPath)) {
    return destPath;
  }
  const ext = path.extname(fileName);
  const baseName = path.basename(fileName, ext);
  const nameHasSuffix = /^(.+)\s\((\d+)\)$/.exec(baseName);
  const cleanBase = nameHasSuffix ? nameHasSuffix[1] : baseName;
  let counter = nameHasSuffix ? parseInt(nameHasSuffix[2], 10) : 1;
  let uniquePath: string;
  do {
    counter++;
    uniquePath = path.join(targetDir, `${cleanBase} (${counter})${ext}`);
  } while (fs.existsSync(uniquePath));
  return uniquePath;
}

export function getUniqueDirPath(parentDir: string, folderName: string): string {
  const destPath = path.join(parentDir, folderName);
  if (!fs.existsSync(destPath)) {
    return destPath;
  }
  const nameHasSuffix = /^(.+)\s\((\d+)\)$/.exec(folderName);
  const cleanBase = nameHasSuffix ? nameHasSuffix[1] : folderName;
  let counter = nameHasSuffix ? parseInt(nameHasSuffix[2], 10) : 1;
  let uniquePath: string;
  do {
    counter++;
    uniquePath = path.join(parentDir, `${cleanBase} (${counter})`);
  } while (fs.existsSync(uniquePath));
  return uniquePath;
}

export function findFileByHash(fileHash: string, searchPaths: string[]): string | null {
  for (const searchPath of searchPaths) {
    if (!fs.existsSync(searchPath)) continue;
    const files = fs.readdirSync(searchPath, { withFileTypes: true });
    for (const file of files) {
      if (file.isDirectory()) {
        const found = findFileByHash(fileHash, [path.join(searchPath, file.name)]);
        if (found) return found;
        continue;
      }
      const fullPath = path.join(searchPath, file.name);
      try {
        const candidateHash = generateFileHash(fullPath);
        if (candidateHash === fileHash) {
          return fullPath;
        }
      } catch {
        continue;
      }
    }
  }
  return null;
}

export function getAllPdfFiles(dir: string): string[] {
  const results: string[] = [];
  const list = fs.readdirSync(dir);
  for (const item of list) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results.push(...getAllPdfFiles(fullPath));
    } else if (item.toLowerCase().endsWith(".pdf")) {
      results.push(fullPath);
    }
  }
  return results;
}

export function getAllBookFiles(dir: string): string[] {
  const results: string[] = [];
  const bookExtensions = new Set([
    ".pdf", ".epub", ".mobi", ".azw", ".azw3", ".azw4",
    ".kfx", ".prc", ".txt", ".docx", ".html", ".cbz", ".lyceum",
  ]);
  const list = fs.readdirSync(dir);
  for (const item of list) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results.push(...getAllBookFiles(fullPath));
    } else if (bookExtensions.has(path.extname(item).toLowerCase())) {
      results.push(fullPath);
    }
  }
  return results;
}

export function safeReadDir(dir: string): fs.Dirent[] {
  try {
    return fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

export function isDirectory(targetPath: string): boolean {
  try {
    return fs.statSync(targetPath).isDirectory();
  } catch {
    return false;
  }
}

export interface UniquePathOptions {
  suffix?: string;
  maxAttempts?: number;
}

export function toReadableFileType(fileType?: string | null): "pdf" | "epub" {
  return fileType === "epub" ? "epub" : "pdf";
}

export function inferFileTypeFromPath(
  filePath?: string | null,
  fallback: "pdf" | "epub" = "pdf"
): "pdf" | "epub" {
  if (!filePath) return fallback;
  return filePath.toLowerCase().endsWith(".epub") ? "epub" : "pdf";
}

export function inferBookFileTypeFromPath(
  filePath?: string | null,
  fallback = "pdf",
) {
  if (!filePath) return fallback;
  const extension = path.extname(filePath).toLowerCase().replace(/^\./, "");
  return extension || fallback;
}

export function getUniquePathInDir(targetDir: string, fileName: string): string {
  const destPath = path.join(targetDir, fileName);
  if (!fs.existsSync(destPath)) {
    return destPath;
  }
  const ext = path.extname(fileName);
  const baseName = path.basename(fileName, ext);
  let counter = 1;
  let uniquePath: string;
  do {
    counter++;
    uniquePath = path.join(targetDir, `${baseName} (${counter})${ext}`);
  } while (fs.existsSync(uniquePath));
  return uniquePath;
}
