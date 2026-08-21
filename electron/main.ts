import electron, {
  type BrowserWindow as ElectronBrowserWindow,
  type BrowserWindowConstructorOptions,
  type IpcMainInvokeEvent,
  net,
} from "electron";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { cachePdfBuffer, getCachedPdfBuffer } from "./services/pdfCache";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import chokidar, { FSWatcher } from "chokidar";
import {
  addDocument,
  getAllDocuments,
  getDocumentByHash,
  getLastDocument,
  initDatabase,
  updateDocumentPath,
  updateDocumentNumPages,
  updateDocumentSyncStatus,
  updateLastOpened,
  updateReadingState,
  updateThumbnailPath,
  updateMetadata,
  updateProcessingStatus,
  updateFileSize,
  updateTitle,
  deleteDocument,
  createCategory,
  updateCategory,
  deleteCategory,
  getAllCategories,
  getCategoryById,
  getCategoriesForDocument,
  getCategoriesForDocumentByHash,
  setDocumentCategories,
  addCategoryToDocument,
  removeCategoryFromDocument,
  getCategoryColors,
  importCategoriesFromFolders,
  getDocumentByPath,
  getDocumentsForBackup,
  getAllHabits,
  getHabitById,
  addHabit,
  updateHabit,
  deleteHabit,
  getHabitCompletions,
  getAllHabitCompletions,
setHabitCompletion,
  deleteHabitCompletion,
  getAllDocumentCategories,
  getDocumentByFilePath,
  getSourceFolders,
} from "./local-database";
import {
  initBackupClient,
  backupAllDocuments,
  backupAllHabits,
  backupAllCategories,
  setBackupSession,
  clearBackupSession,
} from "./backup";
import { dictionaryManager } from "./dictionary-manager";
import { quickLookup } from "./lookup-engine";
import { closeAllStorage } from "./dictionary-storage";
import {
  isPdfMagicBytesValid,
  THUMBNAIL_EXTENSIONS,
  extractEpubMetadata as extractEpubMetadataMainThread,
  extractPdfMetadata as extractMetadataMainThread,
  getCbzPageCount as getCbzPageCountMainThread,
  getEpubChapterCount as getEpubChapterCountMainThread,
  getPdfPageCount as getPdfPageCountMainThread,
  validateCbzFile as validateCbzFileMainThread,
  type BookFileType,
} from "./services/document-processing";
import { deleteBook } from "./services/document-service";
import {
  checkProcessingWorkers,
  convertPdfToEpubInWorker,
  convertViaLyceumInWorker,
  disposeProcessingWorkers,
  generateThumbnailInWorker,
  hashFile,
  inspectBookFile,
  openAndProcess as openAndProcessInWorker,
  validateAzw3InWorker,
} from "./workers/processingClient";
import { registerBookHandlers, setWindow as setBooksWindow } from "./handlers/books.handler";
import {
  registerLibraryHandlers,
  setFileWatcherRefresh,
  setWindow as setLibraryWindow,
} from "./handlers/library.handler";
import {
  scanLibrary as queueLibraryScan,
  setLibraryChangeEmitter,
} from "./services/library-service";
import {
  checkForAppUpdates,
  initializeUpdateService,
  registerUpdateHandlers,
  setUpdateWindow,
} from "./services/update-service";

const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  protocol,
  session,
} = electron;
const require = createRequire(import.meta.url);
const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const __filename = fileURLToPath(import.meta.url);
(globalThis as any).__filename = __filename;
import crypto from "crypto";
import fs from "fs";
import { PDFDocument } from "pdf-lib";
import type { BookFormat, LyceumConversionOptions } from "../src/lib/lyceum";
import type { ConversionRequestOptions } from "./workers/protocol";

const LYCEUM_KINDLE_AZW3_PROFILE = "kf8-tbs-20260627";
const bundledFromChunksDir = path.basename(__dirname) === "chunks";
process.env.APP_ROOT = path.resolve(__dirname, bundledFromChunksDir ? "../.." : "..");

const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
const PRELOAD_ENTRY = path.join(MAIN_DIST, "preload.cjs");
const APP_PROTOCOL = "lyceum";
const PASSWORD_RESET_DEEP_LINK_ROUTE = "/reset-password";

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, "public")
  : RENDERER_DIST;

let win: ElectronBrowserWindow | null = null;
let fileWatcher: FSWatcher | null = null;
let pendingAuthDeepLink: string | null = null;
const activeConversionControllers = new Map<string, AbortController>();
const knownConversionOutputs = new Map<string, string>();

function throwIfConversionAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("Conversao cancelada", "AbortError");
}
let pendingAuthDeepLinkParams: Record<string, string> | null = null;

type LyceumConversionModule = typeof import("../src/lib/lyceum");

let lyceumConversionModulePromise: Promise<LyceumConversionModule> | null = null;

function isPathInside(basePath: string, targetPath: string): boolean {
  const relative = path.relative(path.resolve(basePath), path.resolve(targetPath));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}
function loadLyceumConversionModule(): Promise<LyceumConversionModule> {
  lyceumConversionModulePromise ||= import("../src/lib/lyceum");
  return lyceumConversionModulePromise;
}

const THUMBNAILS_DIR = () => path.join(app.getPath("userData"), "thumbnails");
const LIBRARY_PATH = () => path.join(app.getPath("userData"), "library");
const USER_DATA_PATH = () => app.getPath("userData");
const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/i;
const USB_SCAN_INTERVAL_MS = 4000;

async function inspectOnWorker(filePath: string, fileType: "pdf" | "epub" | "cbz") {
  try {
    return await inspectBookFile({ filePath, fileType, includeMetadata: true });
  } catch (error) {
    console.warn(`[Main] Worker inspection failed for ${path.basename(filePath)}; using fallback:`, error);
    return null;
  }
}

async function getPdfPageCount(filePath: string) {
  return (await inspectOnWorker(filePath, "pdf"))?.numPages ?? getPdfPageCountMainThread(filePath);
}

async function getEpubChapterCount(filePath: string) {
  return (await inspectOnWorker(filePath, "epub"))?.numPages ?? getEpubChapterCountMainThread(filePath);
}

async function getCbzPageCount(filePath: string) {
  return (await inspectOnWorker(filePath, "cbz"))?.numPages ?? getCbzPageCountMainThread(filePath);
}

async function extractMetadata(filePath: string) {
  const metadata = (await inspectOnWorker(filePath, "pdf"))?.metadata;
  return metadata ?? extractMetadataMainThread(filePath);
}

async function extractEpubMetadata(filePath: string) {
  const metadata = (await inspectOnWorker(filePath, "epub"))?.metadata;
  return metadata ?? extractEpubMetadataMainThread(filePath);
}

async function validateCbzFile(filePath: string) {
  const inspected = await inspectOnWorker(filePath, "cbz");
  if (inspected) return { pageCount: inspected.numPages || 1 };
  return validateCbzFileMainThread(filePath);
}

const USB_BOOK_EXTENSIONS = [
  ".pdf",
  ".epub",
  ".mobi",
  ".azw",
  ".azw3",
  ".azw4",
  ".kfx",
  ".prc",
  ".txt",
];
const EREADER_MARKERS = [
  "documents",
  "audible",
  "system",
  "kindle",
  ".kobo",
  "digital editions",
  ".adobe-digital-editions",
  "books",
];
const PDFJS_ASSET_MIME_TYPES: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".bcmap": "application/octet-stream",
  ".ftl": "text/plain; charset=utf-8",
  ".pfb": "application/octet-stream",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

interface FolderInfo {
  name: string;
  path: string;
  fullPath: string;
  bookCount: number;
  subfolders: FolderInfo[];
}

function isPathWithin(basePath: string, targetPath: string): boolean {
  const relative = path.relative(path.resolve(basePath), path.resolve(targetPath));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function assertPathWithin(basePath: string, targetPath: string, errorMessage: string): string {
  const resolvedPath = path.resolve(targetPath);
  if (!isPathWithin(basePath, resolvedPath)) {
    throw new Error(errorMessage);
  }
  return resolvedPath;
}

function isSafeRelativePath(targetPath: string): boolean {
  if (!targetPath || path.isAbsolute(targetPath)) {
    return false;
  }

  const parts = targetPath.split(/[\\/]+/).filter(Boolean);
  return parts.length > 0 && parts.every((part) => part !== "." && part !== "..");
}

function resolveLibraryRelativePath(targetPath: string | null | undefined): string {
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

function sanitizeFolderName(folderName: string): string {
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

function inferFileTypeFromPath(
  filePath?: string | null,
  fallback: "pdf" | "epub" = "pdf"
): "pdf" | "epub" {
  if (!filePath) {
    return fallback;
  }

  return filePath.toLowerCase().endsWith(".epub") ? "epub" : "pdf";
}

function toReadableFileType(fileType?: string | null): "pdf" | "epub" {
  return fileType === "epub" ? "epub" : "pdf";
}

function moveFileAcrossDevices(sourcePath: string, targetPath: string): void {
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

function getUniqueFilePath(targetDir: string, fileName: string): string {
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
    uniquePath = path.join(targetDir, `${cleanBase} (${counter})${ext}`);
    counter += 1;
  } while (fs.existsSync(uniquePath));

  return uniquePath;
}

function getUniqueDirPath(targetDir: string, folderName: string): string {
  const destPath = path.join(targetDir, folderName);
  if (!fs.existsSync(destPath)) {
    return destPath;
  }

  const nameHasSuffix = /^(.+)\s\((\d+)\)$/.exec(folderName);
  const cleanBase = nameHasSuffix ? nameHasSuffix[1] : folderName;
  let counter = nameHasSuffix ? parseInt(nameHasSuffix[2], 10) : 1;

  let uniquePath: string;
  do {
    uniquePath = path.join(targetDir, `${cleanBase} (${counter})`);
    counter += 1;
  } while (fs.existsSync(uniquePath));

  return uniquePath;
}

async function openReadableFile(filePath: string): Promise<(DocumentRecord & { fileBuffer: ArrayBuffer; fileType: "pdf" | "epub"; title: string }) | null> {
  const fileType = inferFileTypeFromPath(filePath);
  const title = path.basename(filePath, path.extname(filePath));
  const processed = await openAndProcessInWorker({
    filePath,
    fileType,
    thumbnailsDir: THUMBNAILS_DIR(),
  });
  const { fileHash, buffer: fileBuffer, thumbnailPath, numPages } = processed;

  const existingByPath = getDocumentByFilePath(filePath);
  if (existingByPath) {
    updateLastOpened(existingByPath.fileHash);
    return { ...existingByPath, filePath, fileBuffer, fileType, title };
  }

  const existingByHash = getDocumentByHash(fileHash);
  if (existingByHash) {
    updateLastOpened(existingByHash.fileHash);
    cachePdfBuffer(fileHash, fileBuffer);
    return { ...existingByHash, filePath, fileBuffer, fileType, title };
  }

  addDocument(title, filePath, fileHash, thumbnailPath || undefined, numPages || 1, fileType);

  const doc = getDocumentByHash(fileHash);
  if (!doc) {
    return null;
  }

  cachePdfBuffer(fileHash, fileBuffer);
  return { ...doc, filePath, fileBuffer, fileType, title };
}

function getAllPdfFiles(dir: string): string[] {
  let results: string[] = [];

  if (!fs.existsSync(dir)) return results;

  const list = fs.readdirSync(dir, { withFileTypes: true });

  for (const file of list) {
    const fullPath = path.join(dir, file.name);

    if (file.isDirectory()) {
      results = results.concat(getAllBookFiles(fullPath));
    } else if (file.isFile()) {
      const fileName = file.name.toLowerCase();
      if ((fileName.endsWith(".pdf") || fileName.endsWith(".epub") || fileName.endsWith(".cbz")) && !fileName.includes(".tmp")) {
        results.push(fullPath);
      }
    }
  }

  return results;
}

function getAllBookFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const list = fs.readdirSync(dir, { withFileTypes: true });

  for (const file of list) {
    const fullPath = path.join(dir, file.name);

    if (file.isDirectory()) {
      results.push(...getAllBookFiles(fullPath));
    } else if (file.isFile()) {
      const fileName = file.name.toLowerCase();
      if ((fileName.endsWith(".pdf") || fileName.endsWith(".epub") || fileName.endsWith(".cbz")) && !fileName.includes(".tmp")) {
        results.push(fullPath);
      }
    }
  }

  return results;
}

function safeReadDir(dir: string): fs.Dirent[] {
  try {
    return fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

function isDirectory(targetPath: string): boolean {
  try {
    return fs.existsSync(targetPath) && fs.statSync(targetPath).isDirectory();
  } catch {
    return false;
  }
}

function getCandidateVolumeRoots(): string[] {
  if (process.platform === "win32") {
    return "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
      .split("")
      .map((letter) => `${letter}:\\`)
      .filter((root) => isDirectory(root));
  }

  const roots = new Set<string>();
  const username = os.userInfo().username;
  const parentDirs = [
    "/Volumes",
    path.join("/media", username),
    path.join("/run/media", username),
    "/mnt",
  ];

  for (const parentDir of parentDirs) {
    for (const item of safeReadDir(parentDir)) {
      if (item.isDirectory()) {
        roots.add(path.join(parentDir, item.name));
      }
    }
  }

  return Array.from(roots).filter((root) => isDirectory(root));
}

function getReadableRootNames(rootPath: string): Set<string> {
  return new Set(safeReadDir(rootPath).map((item) => item.name.toLowerCase()));
}

function recognizeEreaderRoot(rootPath: string): UsbDeviceInfo | null {
  const names = getReadableRootNames(rootPath);
  const hasMarker = EREADER_MARKERS.some((marker) => names.has(marker));
  const hasKindleShape =
    names.has("documents") &&
    (names.has("system") || names.has("audible") || names.has("fonts"));
  const hasKoboShape = names.has(".kobo") || names.has("digital editions");

  if (!hasMarker && !hasKindleShape && !hasKoboShape) {
    return null;
  }

  const kind: UsbDeviceInfo["kind"] = hasKoboShape
    ? "kobo"
    : hasKindleShape
      ? "kindle"
      : "ereader";
  const rootLabel = rootPath.replace(/[\\/]+$/, "") || rootPath;
  const fallbackName = process.platform === "win32"
    ? rootLabel
    : path.basename(rootLabel);

  return {
    id: crypto.createHash("sha1").update(path.resolve(rootPath)).digest("hex"),
    name: kind === "kindle" ? `Kindle (${fallbackName})` : kind === "kobo" ? `Kobo (${fallbackName})` : `E-reader (${fallbackName})`,
    rootPath,
    kind,
  };
}

function scanUsbDevices(): UsbDeviceInfo[] {
  return getCandidateVolumeRoots()
    .map(recognizeEreaderRoot)
    .filter((device): device is UsbDeviceInfo => Boolean(device));
}

function getUsbBookSearchRoots(device: UsbDeviceInfo): string[] {
  const preferred = [
    "documents",
    "Books",
    "books",
    "Digital Editions",
  ]
    .map((folder) => path.join(device.rootPath, folder))
    .filter((folder) => isDirectory(folder));

  return preferred.length > 0 ? preferred : [device.rootPath];
}

function getUsbBookFileType(filePath: string): string | null {
  const lowerPath = filePath.toLowerCase();
  if (lowerPath.endsWith(".kepub.epub")) return "epub";
  const extension = path.extname(lowerPath);
  return USB_BOOK_EXTENSIONS.includes(extension) ? extension.slice(1) : null;
}

function collectUsbBookFiles(dir: string, maxDepth = 7): string[] {
  const results: string[] = [];
  const seen = new Set<string>();
  const skipDirs = new Set([".trash", ".trashes", ".spotlight-v100", ".fseventsd"]);

  const walk = (currentDir: string, depth: number) => {
    if (depth > maxDepth || seen.has(currentDir)) return;
    seen.add(currentDir);

    for (const item of safeReadDir(currentDir)) {
      const fullPath = path.join(currentDir, item.name);
      if (item.isDirectory()) {
        const lowerName = item.name.toLowerCase();
        if (skipDirs.has(lowerName) || lowerName.endsWith(".sdr")) continue;
        walk(fullPath, depth + 1);
      } else if (item.isFile() && getUsbBookFileType(fullPath)) {
        results.push(fullPath);
      }
    }
  };

  walk(dir, 0);
  return results;
}

function parseTitleAndAuthorFromFileName(filePath: string): { title: string; author: string | null } {
  const fileName = path.basename(filePath)
    .replace(/\.kepub\.epub$/i, "")
    .replace(/\.(pdf|epub|mobi|azw|azw3|azw4|kfx|prc|txt)$/i, "");
  const parts = fileName.split(/\s+-\s+/).map((part) => part.trim()).filter(Boolean);

  if (parts.length >= 2) {
    return { title: parts.slice(1).join(" - "), author: parts[0] };
  }

  return { title: fileName || path.basename(filePath), author: null };
}

function getUsbBookSidecarMetadata(filePath: string): { title?: string; author?: string } {
  const dir = path.dirname(filePath);
  const baseName = path.basename(filePath, path.extname(filePath));
  const sdrDir = path.join(dir, `${baseName}.sdr`);

  if (!isDirectory(sdrDir)) return {};

  const jsonFile = safeReadDir(sdrDir)
    .filter((item) => item.isFile() && item.name.toLowerCase().endsWith(".json"))
    .map((item) => path.join(sdrDir, item.name))[0];

  if (!jsonFile) return {};

  try {
    const data = JSON.parse(fs.readFileSync(jsonFile, "utf8"));
    const author = Array.isArray(data.authors) ? data.authors.join(", ") : data.author;
    return {
      title: typeof data.title === "string" ? data.title : undefined,
      author: typeof author === "string" ? author : undefined,
    };
  } catch {
    return {};
  }
}

function parseJsonArray<T>(raw: string): T[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  const parsed = JSON.parse(trimmed);
  return Array.isArray(parsed) ? parsed : [parsed];
}

async function runWindowsPowerShellJson<T>(script: string): Promise<T[]> {
  if (process.platform !== "win32") return [];

  const { stdout } = await execFileAsync(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script],
    {
      windowsHide: true,
      maxBuffer: 1024 * 1024 * 16,
      timeout: 45_000,
    },
  );

  return parseJsonArray<T>(stdout);
}

async function getWindowsMtpBooks(): Promise<WindowsMtpBookEntry[]> {
  const extensions = USB_BOOK_EXTENSIONS.map((extension) => extension.slice(1)).join("|");
  const script = `
$ErrorActionPreference = 'SilentlyContinue'
$shell = New-Object -ComObject Shell.Application
$computer = $shell.Namespace(17)
$rows = New-Object System.Collections.Generic.List[object]
$skipFolders = @('.cache', 'dictionaries', '.trash', '.trashes')
$bookPattern = '\\.(${extensions})$'

function Add-BooksFromFolder($folderItem, [string]$relativePath, [string]$deviceName, [string]$devicePath, [int]$depth) {
  if ($depth -gt 8 -or $null -eq $folderItem) { return }
  $folder = $folderItem.GetFolder
  if ($null -eq $folder) { return }

  foreach ($child in $folder.Items()) {
    $name = [string]$child.Name
    if ([string]::IsNullOrWhiteSpace($name)) { continue }
    $nextPath = if ([string]::IsNullOrWhiteSpace($relativePath)) { $name } else { "$relativePath/$name" }

    if ($child.IsFolder) {
      $lower = $name.ToLowerInvariant()
      if ($skipFolders -contains $lower -or $lower.EndsWith('.sdr')) { continue }
      Add-BooksFromFolder $child $nextPath $deviceName $devicePath ($depth + 1)
      continue
    }

    if ($name -match $bookPattern) {
      $ext = [System.IO.Path]::GetExtension($name).TrimStart('.').ToLowerInvariant()
      $modified = $null
      try {
        if ($child.ModifyDate) {
          $modified = ([DateTime]$child.ModifyDate).ToUniversalTime().ToString('o')
        }
      } catch {}

      $rows.Add([PSCustomObject]@{
        deviceName = $deviceName
        devicePath = $devicePath
        name = $name
        path = [string]$child.Path
        relativePath = $nextPath
        fileType = $ext
        size = [int64]$child.Size
        modifiedAt = $modified
      })
    }
  }
}

foreach ($device in $computer.Items()) {
  if (-not $device.IsFolder) { continue }
  $devicePath = [string]$device.Path
  if ($devicePath -match '^[A-Z]:\\\\?$') { continue }

  $deviceName = [string]$device.Name
  $storageItems = @($device.GetFolder.Items() | Where-Object { $_.IsFolder })
  foreach ($storage in $storageItems) {
    $roots = @($storage.GetFolder.Items() | Where-Object { $_.IsFolder -and ($_.Name -in @('documents','Books','books','Digital Editions')) })
    if ($roots.Count -eq 0) { $roots = @($storage) }
    foreach ($root in $roots) {
      Add-BooksFromFolder $root '' $deviceName $devicePath 0
    }
  }
}

$rows | ConvertTo-Json -Depth 4
`;

  try {
    return await runWindowsPowerShellJson<WindowsMtpBookEntry>(script);
  } catch (error) {
    console.error("[usb:list-mtp-books] Error:", error);
    return [];
  }
}

async function getWindowsMtpDeviceSignatures(): Promise<string[]> {
  const script = `
$ErrorActionPreference = 'SilentlyContinue'
$shell = New-Object -ComObject Shell.Application
$computer = $shell.Namespace(17)
$computer.Items() |
  Where-Object { $_.IsFolder -and ([string]$_.Path -notmatch '^[A-Z]:\\\\?$') } |
  ForEach-Object { [PSCustomObject]@{ name = [string]$_.Name; path = [string]$_.Path } } |
  ConvertTo-Json -Depth 3
`;

  try {
    return (await runWindowsPowerShellJson<{ name: string; path: string }>(script))
      .map((device) => `${device.name}:${device.path}`)
      .sort();
  } catch {
    return [];
  }
}

async function getWindowsMtpEreaderDevices(): Promise<WindowsMtpDeviceEntry[]> {
  const script = `
$ErrorActionPreference = 'SilentlyContinue'
$shell = New-Object -ComObject Shell.Application
$computer = $shell.Namespace(17)
$rows = New-Object System.Collections.Generic.List[object]

foreach ($device in $computer.Items()) {
  if (-not $device.IsFolder) { continue }
  $devicePath = [string]$device.Path
  if ($devicePath -match '^[A-Z]:\\\\?$') { continue }

  $deviceName = [string]$device.Name
  foreach ($storage in @($device.GetFolder.Items() | Where-Object { $_.IsFolder })) {
    $names = @{}
    foreach ($child in @($storage.GetFolder.Items())) {
      $names[[string]$child.Name.ToLowerInvariant()] = $true
    }

    $hasKindleShape = $names.ContainsKey('documents') -and ($names.ContainsKey('system') -or $names.ContainsKey('audible') -or $names.ContainsKey('fonts'))
    $hasKoboShape = $names.ContainsKey('.kobo') -or $names.ContainsKey('digital editions')
    if (-not $hasKindleShape -and -not $hasKoboShape -and -not $deviceName.ToLowerInvariant().Contains('kindle')) { continue }

    $kind = if ($hasKoboShape) { 'kobo' } elseif ($hasKindleShape -or $deviceName.ToLowerInvariant().Contains('kindle')) { 'kindle' } else { 'ereader' }
    $rows.Add([PSCustomObject]@{
      name = $deviceName
      devicePath = $devicePath
      storageName = [string]$storage.Name
      kind = $kind
    })
  }
}

$rows | ConvertTo-Json -Depth 4
`;

  try {
    return await runWindowsPowerShellJson<WindowsMtpDeviceEntry>(script);
  } catch (error) {
    console.error("[kindle:list-mtp-devices] Error:", error);
    return [];
  }
}

async function getUsbDeviceSignature(): Promise<string> {
  const filesystemDevices = scanUsbDevices()
    .map((device) => `${device.id}:${device.rootPath}`)
    .sort();
  const mtpDevices = await getWindowsMtpDeviceSignatures();
  return [...filesystemDevices, ...mtpDevices].join("|");
}

function buildWindowsMtpBookRecord(entry: WindowsMtpBookEntry, index: number): DocumentRecord {
  const inferred = parseTitleAndAuthorFromFileName(entry.name);
  const timestamp = entry.modifiedAt || new Date().toISOString();
  const fileHash = `mtp:${crypto
    .createHash("sha1")
    .update(`${entry.devicePath}|${entry.path}|${entry.name}`)
    .digest("hex")}`;

  return {
    id: -10_000 - index,
    title: inferred.title,
    filePath: entry.path,
    fileHash,
    fileName: entry.name,
    folderPath: `${entry.deviceName}/${path.dirname(entry.relativePath).replace(/\\/g, "/")}`,
    fileMtime: Date.parse(timestamp) || null,
    currentPage: 1,
    currentZoom: null,
    currentScroll: null,
    annotations: null,
    thumbnailPath: null,
    numPages: 0,
    createdAt: timestamp,
    lastOpenedAt: timestamp,
    isSynced: 0,
    category: entry.deviceName,
    isFavorite: 0,
    rating: 0,
    notes: null,
    author: inferred.author,
    description: `Encontrado em ${entry.deviceName}`,
    isbn: null,
    publisher: null,
    publishDate: null,
    language: null,
    identifier: null,
    asin: null,
    subject: null,
    series: null,
    seriesIndex: null,
    authorSort: null,
    titleSort: null,
    fileSize: entry.size || 0,
    processingStatus: "completed",
    bookId: null,
    fileType: entry.fileType as DocumentRecord["fileType"],
    importedAt: timestamp,
    updatedAt: timestamp,
  };
}

function escapePowerShellSingleQuoted(value: string): string {
  return value.replace(/'/g, "''");
}

async function copyWindowsMtpBookToTemp(itemPath: string): Promise<string | null> {
  if (process.platform !== "win32" || !itemPath.startsWith("::")) {
    return null;
  }

  const safeItemPath = escapePowerShellSingleQuoted(itemPath);
  const tempDir = path.join(app.getPath("temp"), "lyceum-mtp-books");
  fs.mkdirSync(tempDir, { recursive: true });
  const safeTempDir = escapePowerShellSingleQuoted(tempDir);
  const script = `
$ErrorActionPreference = 'SilentlyContinue'
$targetPath = '${safeItemPath}'
$destination = '${safeTempDir}'
$shell = New-Object -ComObject Shell.Application
$computer = $shell.Namespace(17)
$found = $null

function Find-ItemByPath($folderItem, [string]$needle, [int]$depth) {
  if ($depth -gt 10 -or $null -eq $folderItem -or $script:found) { return }
  if ([string]$folderItem.Path -eq $needle) {
    $script:found = $folderItem
    return
  }

  if (-not $folderItem.IsFolder) { return }
  $folder = $folderItem.GetFolder
  if ($null -eq $folder) { return }

  foreach ($child in $folder.Items()) {
    if ([string]$child.Path -eq $needle) {
      $script:found = $child
      return
    }

    if ($child.IsFolder) {
      Find-ItemByPath $child $needle ($depth + 1)
      if ($script:found) { return }
    }
  }
}

foreach ($device in $computer.Items()) {
  if ($device.IsFolder) {
    Find-ItemByPath $device $targetPath 0
    if ($found) { break }
  }
}

if ($null -eq $found) {
  [PSCustomObject]@{ success = $false; error = 'Arquivo não encontrado no dispositivo' } | ConvertTo-Json -Depth 3
  exit
}

$destFolder = $shell.Namespace($destination)
$destFile = Join-Path $destination $found.Name
if (Test-Path -LiteralPath $destFile) { Remove-Item -LiteralPath $destFile -Force }
$destFolder.CopyHere($found, 16)

for ($i = 0; $i -lt 120; $i++) {
  if (Test-Path -LiteralPath $destFile) {
    [PSCustomObject]@{ success = $true; filePath = $destFile } | ConvertTo-Json -Depth 3
    exit
  }
  Start-Sleep -Milliseconds 250
}

[PSCustomObject]@{ success = $false; error = 'Tempo esgotado ao copiar do dispositivo' } | ConvertTo-Json -Depth 3
`;

  try {
    const result = (await runWindowsPowerShellJson<{ success: boolean; filePath?: string; error?: string }>(script))[0];
    if (result?.success && result.filePath) {
      return result.filePath;
    }
    console.error("[usb:copy-mtp-book] Error:", result?.error);
    return null;
  } catch (error) {
    console.error("[usb:copy-mtp-book] Error:", error);
    return null;
  }
}

async function buildUsbBookRecord(
  filePath: string,
  device: UsbDeviceInfo,
  index: number,
): Promise<DocumentRecord> {
  const stats = fs.statSync(filePath);
  const fileType = getUsbBookFileType(filePath) || "pdf";
  const inferred = parseTitleAndAuthorFromFileName(filePath);
  const sidecar = getUsbBookSidecarMetadata(filePath);
  const fileHash = `usb:${crypto
    .createHash("sha1")
    .update(`${device.id}|${filePath}|${stats.mtimeMs}|${stats.size}`)
    .digest("hex")}`;

  let title = sidecar.title || inferred.title;
  let author = sidecar.author || inferred.author;
  let publisher: string | null = null;
  let publishDate: string | null = null;
  let numPages = 0;

  if (fileType === "pdf") {
    const inspected = await inspectBookFile({ filePath, fileType: "pdf", includeMetadata: true });
    const metadata = inspected.metadata as Awaited<ReturnType<typeof extractMetadata>> | undefined;
    title = metadata?.title || title;
    author = metadata?.author || author;
    publisher = metadata?.producer || null;
    publishDate = metadata?.creationDate || null;
    numPages = inspected.numPages || 1;
  } else if (fileType === "epub") {
    const inspected = await inspectBookFile({ filePath, fileType: "epub", includeMetadata: true });
    const metadata = inspected.metadata as Awaited<ReturnType<typeof extractEpubMetadata>> | undefined;
    title = metadata?.title || title;
    author = metadata?.author || author;
    publisher = metadata?.producer || null;
    publishDate = metadata?.creationDate || null;
    numPages = inspected.numPages || 1;
  }

  const timestamp = new Date(stats.mtimeMs).toISOString();

  return {
    id: -1 - index,
    title,
    filePath,
    fileHash,
    fileName: path.basename(filePath),
    folderPath: path.dirname(filePath),
    fileMtime: Math.round(stats.mtimeMs),
    currentPage: 1,
    currentZoom: null,
    currentScroll: null,
    annotations: null,
    thumbnailPath: null,
    numPages,
    createdAt: timestamp,
    lastOpenedAt: timestamp,
    isSynced: 0,
    category: device.name,
    isFavorite: 0,
    rating: 0,
    notes: null,
    author,
    description: `Encontrado em ${device.name}`,
    isbn: null,
    publisher,
    publishDate,
    language: null,
    identifier: null,
    asin: null,
    subject: null,
    series: null,
    seriesIndex: null,
    authorSort: null,
    titleSort: null,
    fileSize: stats.size,
    processingStatus: "completed",
    bookId: null,
    fileType: fileType as DocumentRecord["fileType"],
    importedAt: timestamp,
    updatedAt: timestamp,
  };
}

async function listUsbBooks(query: UsbBookListQuery = {}): Promise<LibraryListResult> {
  const limit = Math.min(Math.max(query.limit ?? 80, 1), 200);
  const offset = Math.max(query.offset ?? 0, 0);
  const devices = scanUsbDevices();
  const mtpEntries = await getWindowsMtpBooks();
  const files = devices.flatMap((device) =>
    getUsbBookSearchRoots(device)
      .flatMap((root) => collectUsbBookFiles(root))
      .map((filePath) => ({ filePath, device })),
  );
  const uniqueFiles = Array.from(
    new Map(files.map((entry) => [path.resolve(entry.filePath).toLowerCase(), entry])).values(),
  );
  const search = (query.search || "").trim().toLowerCase();

  if (query.countOnly) {
    const fsTotal = uniqueFiles.filter(({ filePath, device }) => {
      const fileType = getUsbBookFileType(filePath);
      if (query.fileType && query.fileType !== "all" && fileType !== query.fileType) {
        return false;
      }

      if (!search) return true;

      return [filePath, path.basename(filePath), fileType, device.name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search));
    }).length;
    const mtpTotal = mtpEntries.filter((entry) => {
      if (query.fileType && query.fileType !== "all" && entry.fileType !== query.fileType) {
        return false;
      }

      if (!search) return true;

      return [entry.name, entry.relativePath, entry.fileType, entry.deviceName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search));
    }).length;

    return {
      items: [],
      total: fsTotal + mtpTotal,
      limit,
      offset,
      hasMore: false,
    };
  }

  const fsRecords = await Promise.all(
    uniqueFiles.map((entry, index) => buildUsbBookRecord(entry.filePath, entry.device, index)),
  );
  const mtpRecords = mtpEntries.map((entry, index) => buildWindowsMtpBookRecord(entry, index));
  const records = [...fsRecords, ...mtpRecords];

  let filtered = records.filter((book) => {
    if (query.fileType && query.fileType !== "all" && book.fileType !== query.fileType) {
      return false;
    }

    if (!search) return true;

    return [
      book.title,
      book.author,
      book.fileName,
      book.folderPath,
      book.fileType,
      book.category,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(search));
  });

  const sort = query.sort || "title_asc";
  filtered = filtered.sort((a, b) => {
    const titleCompare = a.title.localeCompare(b.title, "pt-BR", { sensitivity: "base" });
    if (sort === "title_desc") return -titleCompare;
    if (sort === "recent_desc") return (b.fileMtime || 0) - (a.fileMtime || 0);
    if (sort === "recent_asc") return (a.fileMtime || 0) - (b.fileMtime || 0);
    if (sort === "pages_desc") return (b.numPages || 0) - (a.numPages || 0) || titleCompare;
    if (sort === "pages_asc") return (a.numPages || 0) - (b.numPages || 0) || titleCompare;
    if (sort === "size_desc") return (b.fileSize || 0) - (a.fileSize || 0) || titleCompare;
    if (sort === "size_asc") return (a.fileSize || 0) - (b.fileSize || 0) || titleCompare;
    return titleCompare;
  });

  const items = filtered.slice(offset, offset + limit);

  return {
    items,
    total: filtered.length,
    limit,
    offset,
    hasMore: offset + items.length < filtered.length,
  };
}

async function listKindleSendDevices(): Promise<KindleSendDevice[]> {
  const fsDevices = scanUsbDevices().map((device) => ({
    id: `fs:${device.id}`,
    name: device.name,
    kind: device.kind,
    isMtp: false,
    rootPath: device.rootPath,
    destinationLabel: path.join(device.rootPath, "documents", "Downloads"),
  } satisfies KindleSendDevice));

  const mtpDevices = (await getWindowsMtpEreaderDevices()).map((device) => {
    const id = `mtp:${crypto.createHash("sha1").update(`${device.devicePath}|${device.storageName}`).digest("hex")}`;
    return {
      id,
      name: device.name,
      kind: device.kind,
      isMtp: true,
      devicePath: device.devicePath,
      storageName: device.storageName,
      destinationLabel: `${device.name}/${device.storageName}/documents/Downloads`,
    } satisfies KindleSendDevice;
  });

  return [...mtpDevices, ...fsDevices];
}

function sanitizeKindleFileName(value: string, fallback = "Lyceum Book"): string {
  const clean = value
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const safe = clean || fallback;
  return safe.length > 120 ? safe.slice(0, 120).trim() : safe;
}

function kindleAuthorFolder(author?: string | null): string {
  return sanitizeKindleFileName(author || "Autores desconhecidos", "Autores desconhecidos");
}

function getKindleDestinationParts(options: Pick<KindleSendOptions, "destination" | "organizeByAuthor">, author?: string | null): string[] {
  const base = (options.destination || "documents/Downloads")
    .replace(/^[/\\]+/, "")
    .split(/[\\/]+/)
    .map((part) => sanitizeKindleFileName(part))
    .filter(Boolean);

  const parts = base.length > 0 ? base : ["documents", "Downloads"];
  if (options.organizeByAuthor) {
    parts.push(kindleAuthorFolder(author));
  }

  return parts;
}

function createKindleOutputName(book: KindleSendBookInput, targetFormat: BookFormat): string {
  const baseTitle = sanitizeKindleFileName(
    book.title || book.fileName || path.basename(book.filePath, path.extname(book.filePath)),
  );
  const author = book.author ? sanitizeKindleFileName(book.author) : "";
  const stem = author ? `${author} - ${baseTitle}` : baseTitle;
  return `${sanitizeKindleFileName(stem)}.${targetFormat}`;
}

function appendKindleOutputSuffix(fileName: string, suffix: string): string {
  const ext = path.extname(fileName);
  const baseName = path.basename(fileName, ext);
  return sanitizeKindleFileName(`${baseName} ${suffix}`) + ext;
}

function getUniquePathInDir(targetDir: string, fileName: string): string {
  const ext = path.extname(fileName);
  const baseName = path.basename(fileName, ext);
  let candidate = path.join(targetDir, fileName);
  let index = 2;

  while (fs.existsSync(candidate)) {
    candidate = path.join(targetDir, `${baseName} (${index})${ext}`);
    index += 1;
  }

  return candidate;
}

async function prepareKindleTransferFile(
  book: KindleSendBookInput,
  options: KindleSendOptions,
): Promise<{
  success: boolean;
  filePath?: string;
  fileName?: string;
  converted?: boolean;
  sourceFormat?: BookFormat;
  error?: string;
}> {
  const {
    inferBookFormatFromPath,
  } = await loadLyceumConversionModule();
  const localPath = book.filePath.startsWith("::")
    ? await copyWindowsMtpBookToTemp(book.filePath)
    : book.filePath;

  if (!localPath) {
    return { success: false, error: "Nao foi possivel acessar o arquivo de origem" };
  }

  if (!fs.existsSync(localPath)) {
    return { success: false, error: "Arquivo de origem nao encontrado no disco" };
  }

  const sourceFormat = inferBookFormatFromPath(localPath) || book.fileType || null;
  if (!sourceFormat) {
    return { success: false, error: "Formato de origem nao suportado" };
  }

  const convertibleToAzw3 = new Set<BookFormat>(["pdf", "epub", "txt", "html", "cbz"]);
  const kindleDirectFormats = new Set<BookFormat>(["azw3", "azw", "mobi", "prc", "kfx", "pdf", "txt"]);
  const shouldConvert = Boolean(
    options.convertToAzw3 &&
    sourceFormat !== "azw3" &&
    convertibleToAzw3.has(sourceFormat),
  );

  if (!shouldConvert) {
    if (!kindleDirectFormats.has(sourceFormat)) {
      return {
        success: false,
        error: "Este formato precisa ser convertido para AZW3 antes do envio por USB",
        sourceFormat,
      };
    }

    if (sourceFormat === "azw3") {
      const validation = await validateAzw3InWorker(localPath);
      if (!validation.valid) {
        return {
          success: false,
          error: `AZW3 invalido: ${validation.errors.join("; ")}`,
          sourceFormat,
        };
      }
    }

    return {
      success: true,
      filePath: localPath,
      fileName: createKindleOutputName(book, sourceFormat),
      converted: false,
      sourceFormat,
    };
  }

  const { fileHash: sourceHash } = await hashFile(localPath);
  const tempDir = path.join(app.getPath("temp"), "lyceum-kindle-send", sourceHash);
  fs.mkdirSync(tempDir, { recursive: true });

  const kindleIdentity = `LYCEUM-${sourceHash.slice(0, 12)}-${LYCEUM_KINDLE_AZW3_PROFILE}`;
  const outputName = appendKindleOutputSuffix(
    createKindleOutputName(book, "azw3"),
    `[${LYCEUM_KINDLE_AZW3_PROFILE}-${sourceHash.slice(0, 8)}]`,
  );
  const outputPath = getUniquePathInDir(tempDir, outputName);
  const title = path.basename(book.title || book.fileName || localPath, path.extname(book.title || book.fileName || localPath));

  await convertViaLyceumInWorker({
    sourcePath: localPath,
    sourceFormat,
    targetFormat: "azw3",
    packageRoot: getLyceumPackageRoot(`kindle-${sourceHash}`),
    outputPath,
    metadata: options.preserveMetadata === false
      ? {
          title,
          language: "pt-BR",
          identifier: kindleIdentity,
          asin: kindleIdentity,
        }
      : {
          title,
          author: book.author || undefined,
          language: book.language || "pt-BR",
          publisher: book.publisher || undefined,
          description: book.description || undefined,
          publishDate: book.publishDate || undefined,
          identifier: book.identifier || kindleIdentity,
          asin: kindleIdentity,
          subject: book.subject || undefined,
          series: book.series || undefined,
          seriesIndex: book.seriesIndex || undefined,
          authorSort: book.authorSort || undefined,
          titleSort: book.titleSort || undefined,
        },
    pdfImageTempDir: sourceFormat === "pdf"
      ? path.join(app.getPath("temp"), "lyceum-pdf-to-epub-images", `kindle-${sourceHash}`)
      : undefined,
  });

  return {
    success: true,
    filePath: outputPath,
    fileName: outputName,
    converted: true,
    sourceFormat,
  };
}

async function copyFileToFilesystemKindle(
  sourcePath: string,
  device: KindleSendDevice,
  destinationParts: string[],
  fileName: string,
): Promise<{ success: boolean; outputPath?: string; outputName?: string; error?: string }> {
  if (!device.rootPath) {
    return { success: false, error: "Dispositivo USB invalido" };
  }

  const targetDir = path.join(device.rootPath, ...destinationParts);
  fs.mkdirSync(targetDir, { recursive: true });
  const targetPath = getUniquePathInDir(targetDir, fileName);
  fs.copyFileSync(sourcePath, targetPath);

  return {
    success: true,
    outputPath: targetPath,
    outputName: path.basename(targetPath),
  };
}

async function copyFileToMtpKindle(
  sourcePath: string,
  device: KindleSendDevice,
  destinationParts: string[],
  fileName: string,
): Promise<{ success: boolean; outputPath?: string; outputName?: string; error?: string }> {
  if (process.platform !== "win32" || !device.devicePath || !device.storageName) {
    return { success: false, error: "Dispositivo MTP invalido" };
  }

  const safeSourcePath = escapePowerShellSingleQuoted(sourcePath);
  const safeDevicePath = escapePowerShellSingleQuoted(device.devicePath);
  const safeStorageName = escapePowerShellSingleQuoted(device.storageName);
  const safeFileName = escapePowerShellSingleQuoted(fileName);
  const partsLiteral = destinationParts
    .map((part) => `'${escapePowerShellSingleQuoted(part)}'`)
    .join(",");

  const script = `
$ErrorActionPreference = 'SilentlyContinue'
$sourcePath = '${safeSourcePath}'
$devicePath = '${safeDevicePath}'
$storageName = '${safeStorageName}'
$fileName = '${safeFileName}'
$parts = @(${partsLiteral})
$shell = New-Object -ComObject Shell.Application
$computer = $shell.Namespace(17)
$device = $null

foreach ($candidate in $computer.Items()) {
  if ([string]$candidate.Path -eq $devicePath) {
    $device = $candidate
    break
  }
}

if ($null -eq $device) {
  [PSCustomObject]@{ success = $false; error = 'Kindle nao encontrado' } | ConvertTo-Json -Depth 4
  exit
}

$storage = $null
foreach ($candidate in @($device.GetFolder.Items() | Where-Object { $_.IsFolder })) {
  if ([string]$candidate.Name -eq $storageName) {
    $storage = $candidate
    break
  }
}

if ($null -eq $storage) {
  [PSCustomObject]@{ success = $false; error = 'Armazenamento interno nao encontrado' } | ConvertTo-Json -Depth 4
  exit
}

function Get-OrCreateFolder($folderItem, [string]$name) {
  $folder = $folderItem.GetFolder
  foreach ($child in @($folder.Items() | Where-Object { $_.IsFolder })) {
    if ([string]$child.Name -eq $name) { return $child }
  }

  try { $folder.NewFolder($name) } catch {}
  for ($i = 0; $i -lt 40; $i++) {
    foreach ($child in @($folder.Items() | Where-Object { $_.IsFolder })) {
      if ([string]$child.Name -eq $name) { return $child }
    }
    Start-Sleep -Milliseconds 250
  }

  return $null
}

$target = $storage
foreach ($part in $parts) {
  if ([string]::IsNullOrWhiteSpace($part)) { continue }
  $target = Get-OrCreateFolder $target $part
  if ($null -eq $target) {
    [PSCustomObject]@{ success = $false; error = "Nao foi possivel criar/acessar a pasta $part" } | ConvertTo-Json -Depth 4
    exit
  }
}

$targetFolder = $target.GetFolder
$existing = @{}
foreach ($child in @($targetFolder.Items())) {
  $existing[[string]$child.Name.ToLowerInvariant()] = $true
}

$base = [System.IO.Path]::GetFileNameWithoutExtension($fileName)
$ext = [System.IO.Path]::GetExtension($fileName)
$targetName = $fileName
$index = 2
while ($existing.ContainsKey($targetName.ToLowerInvariant())) {
  $targetName = "$base ($index)$ext"
  $index += 1
}

$stagingRoot = Join-Path ([System.IO.Path]::GetTempPath()) 'lyceum-kindle-mtp'
$stagingDir = Join-Path $stagingRoot ([System.Guid]::NewGuid().ToString('N'))
$stagingPath = Join-Path $stagingDir $targetName

try {
  New-Item -ItemType Directory -Path $stagingDir -Force | Out-Null
  Copy-Item -LiteralPath $sourcePath -Destination $stagingPath -Force
} catch {
  [PSCustomObject]@{ success = $false; error = 'Nao foi possivel preparar o arquivo temporario para MTP' } | ConvertTo-Json -Depth 4
  exit
}

$sourceFolder = $shell.Namespace($stagingDir)
if ($null -eq $sourceFolder) {
  if (Test-Path -LiteralPath $stagingDir) { Remove-Item -LiteralPath $stagingDir -Recurse -Force }
  [PSCustomObject]@{ success = $false; error = 'Pasta temporaria de envio nao encontrada' } | ConvertTo-Json -Depth 4
  exit
}

$sourceItem = $sourceFolder.ParseName($targetName)
if ($null -eq $sourceItem) {
  if (Test-Path -LiteralPath $stagingDir) { Remove-Item -LiteralPath $stagingDir -Recurse -Force }
  [PSCustomObject]@{ success = $false; error = 'Arquivo temporario de envio nao encontrado' } | ConvertTo-Json -Depth 4
  exit
}

$targetFolder.CopyHere($sourceItem, 16)

for ($i = 0; $i -lt 240; $i++) {
  foreach ($child in @($targetFolder.Items())) {
    if ([string]$child.Name -eq $targetName) {
      if (Test-Path -LiteralPath $stagingDir) { Remove-Item -LiteralPath $stagingDir -Recurse -Force }
      [PSCustomObject]@{
        success = $true
        outputName = $targetName
        outputPath = (($parts -join '/') + '/' + $targetName)
      } | ConvertTo-Json -Depth 4
      exit
    }
  }
  Start-Sleep -Milliseconds 250
}

if (Test-Path -LiteralPath $stagingDir) { Remove-Item -LiteralPath $stagingDir -Recurse -Force }
[PSCustomObject]@{ success = $false; error = 'Tempo esgotado ao copiar para o Kindle' } | ConvertTo-Json -Depth 4
`;

  try {
    const result = (await runWindowsPowerShellJson<{
      success: boolean;
      outputName?: string;
      outputPath?: string;
      error?: string;
    }>(script))[0];

    if (result?.success) {
      return {
        success: true,
        outputName: result.outputName,
        outputPath: result.outputPath,
      };
    }

    return { success: false, error: result?.error || "Erro ao copiar para o Kindle" };
  } catch (error) {
    console.error("[kindle:copy-mtp] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro ao copiar para o Kindle",
    };
  }
}

async function sendBooksToKindle(options: KindleSendOptions): Promise<{
  success: boolean;
  device?: KindleSendDevice;
  sent: number;
  failed: number;
  results: KindleSendItemResult[];
  error?: string;
}> {
  const devices = await listKindleSendDevices();
  const device = options.deviceId
    ? devices.find((candidate) => candidate.id === options.deviceId)
    : devices[0];

  if (!device) {
    return {
      success: false,
      sent: 0,
      failed: options.books.length,
      results: [],
      error: "Nenhum Kindle conectado foi encontrado",
    };
  }

  const results: KindleSendItemResult[] = [];

  for (const book of options.books) {
    try {
      const prepared = await prepareKindleTransferFile(book, options);
      if (!prepared.success || !prepared.filePath || !prepared.fileName) {
        results.push({
          fileHash: book.fileHash,
          title: book.title,
          success: false,
          status: "error",
          error: prepared.error || "Nao foi possivel preparar o arquivo",
        });
        continue;
      }

      const destinationParts = getKindleDestinationParts(options, book.author);
      const copied = device.isMtp
        ? await copyFileToMtpKindle(prepared.filePath, device, destinationParts, prepared.fileName)
        : await copyFileToFilesystemKindle(prepared.filePath, device, destinationParts, prepared.fileName);

      results.push({
        fileHash: book.fileHash,
        title: book.title,
        success: copied.success,
        status: copied.success
          ? prepared.converted ? "converted" : "sent"
          : "error",
        sourcePath: prepared.filePath,
        outputName: copied.outputName,
        outputPath: copied.outputPath,
        error: copied.error,
      });
    } catch (error) {
      results.push({
        fileHash: book.fileHash,
        title: book.title,
        success: false,
        status: "error",
        error: error instanceof Error ? error.message : "Erro ao enviar para o Kindle",
      });
    }
  }

  const sent = results.filter((result) => result.success).length;
  const failed = results.length - sent;
  win?.webContents.send("usb:devices-updated");

  return {
    success: failed === 0,
    device,
    sent,
    failed,
    results,
  };
}

function setupUsbDeviceWatcher() {
  let checking = false;
  const emitIfChanged = async () => {
    if (checking) return;
    checking = true;

    const signature = await getUsbDeviceSignature();

    if (signature !== lastUsbDeviceSignature) {
      lastUsbDeviceSignature = signature;
      win?.webContents.send("usb:devices-updated");
    }

    checking = false;
  };

  void emitIfChanged();
  if (usbDeviceWatcher) {
    clearInterval(usbDeviceWatcher);
  }
  usbDeviceWatcher = setInterval(() => void emitIfChanged(), USB_SCAN_INTERVAL_MS);
}

function getFolderStructure(libraryPath: string): FolderInfo[] {
  if (!fs.existsSync(libraryPath)) return [];

  const buildTree = (dirPath: string, relativeTo: string): FolderInfo[] => {
    if (!fs.existsSync(dirPath)) return [];

    const items = fs.readdirSync(dirPath, { withFileTypes: true });
    const folders: FolderInfo[] = [];

    for (const item of items) {
      if (item.isDirectory() && !item.name.startsWith(".")) {
        const itemFullPath = path.join(dirPath, item.name);
        const relativePath = path.relative(relativeTo, itemFullPath);
        
        const bookFiles = getAllBookFiles(itemFullPath);
        if (bookFiles.length === 0) continue;
        
        folders.push({
          name: item.name,
          path: relativePath,
          fullPath: itemFullPath,
          bookCount: bookFiles.length,
          subfolders: buildTree(itemFullPath, relativeTo),
        });
      }
    }

    return folders.sort((a, b) => a.name.localeCompare(b.name));
  };

  return buildTree(libraryPath, libraryPath);
}

function getAllFoldersFlat(libraryPath: string): string[] {
  const folders: string[] = [];
  
  const scan = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      if (item.isDirectory() && !item.name.startsWith(".")) {
        const fullPath = path.join(dir, item.name);
        const relativePath = path.relative(libraryPath, fullPath);
        folders.push(relativePath);
        scan(fullPath);
      }
    }
  };
  
  scan(libraryPath);
  return folders.sort((a, b) => a.localeCompare(b));
}

function getBooksInFolder(folderPath: string | null): DocumentRecord[] {
  const libraryPath = LIBRARY_PATH();
  const allDocs = getAllDocuments();
  
  if (folderPath === null) {
    return allDocs.filter(d => d.filePath && d.filePath.startsWith(libraryPath));
  }
  
  const targetPath = path.join(libraryPath, folderPath);
  return allDocs.filter(d => {
    if (!d.filePath) return false;
    const docDir = path.dirname(d.filePath);
    return docDir === targetPath || docDir.startsWith(targetPath + path.sep);
  });
}

async function processFile(filePath: string): Promise<void> {
  try {
    if (!fs.existsSync(filePath)) return;

    const lowerPath = filePath.toLowerCase();
    const isPdf = lowerPath.endsWith(".pdf");
    const isEpub = lowerPath.endsWith(".epub");
    const isCbz = lowerPath.endsWith(".cbz");
    const isAzw3 = lowerPath.endsWith(".azw3");
    const isKfx = lowerPath.endsWith(".kfx");
    if (!isPdf && !isEpub && !isCbz && !isAzw3 && !isKfx) return;
    const fileType: BookFileType = isCbz ? "cbz" : isEpub ? "epub" : isAzw3 ? "azw3" : isKfx ? "kfx" : "pdf";

    // First check if document exists by path (handles file modifications that change hash)
    const existingByPath = getDocumentByPath(filePath);
    
    const inspection = await inspectBookFile({
      filePath,
      fileType,
      thumbnailsDir: THUMBNAILS_DIR(),
      includeMetadata: true,
      includeThumbnail: true,
    });
    const { fileHash, numPages = 1, metadata, thumbnailPath } = inspection;
    const existing = existingByPath || getDocumentByHash(fileHash);

    // If document exists with same path but different hash (file was modified), update the hash
    if (existingByPath && existingByPath.fileHash !== fileHash) {
      // Update the document with new hash but keep the same record
      updateDocumentPath(fileHash, filePath);
    }

    if (existing && existing.processingStatus === "completed") {
      // Only generate thumbnail if missing; never force-delete existing ones
      if (thumbnailPath) {
        updateThumbnailPath(fileHash, thumbnailPath);
      } else if (isPdf && !isPdfMagicBytesValid(filePath)) {
        console.warn(`[Main] PDF appears corrupted: ${filePath}`);
        updateProcessingStatus(fileHash, "failed");
        win?.webContents.send("library:updated");
      }
      updateDocumentNumPages(fileHash, numPages);
      return;
    }

    if (existing && existing.processingStatus === "failed" && isPdf && !isPdfMagicBytesValid(filePath)) {
      win?.webContents.send("library:updated");
      return;
    }

    if (existing) {
      updateProcessingStatus(fileHash, "processing");
    }

    const sourceRoot = getSourceFolders().find((folder) => isPathInside(folder.path, filePath));
    const rootPath = sourceRoot?.path || LIBRARY_PATH();
    const relativePath = path.relative(rootPath, filePath);
    const pathParts = relativePath.split(path.sep);
    const category = pathParts.length > 1 ? pathParts[0] : null;

    const stats = { size: inspection.fileSize };

    if (existing) {
      if (thumbnailPath) {
        updateThumbnailPath(fileHash, thumbnailPath);
      }
      updateFileSize(fileHash, stats.size);
      if (metadata) {
        updateMetadata(fileHash, {
          title: metadata.title,
          author: metadata.author,
          publisher: metadata.producer,
          publishDate: metadata.creationDate,
        });
      }
      updateProcessingStatus(fileHash, "completed");
    } else {
      const ext = isCbz ? ".cbz" : isEpub ? ".epub" : ".pdf";
      const title = path.basename(filePath, ext);
      addDocument(
        title,
        filePath,
        fileHash,
        thumbnailPath || undefined,
        numPages || 1,
        fileType,
      );
      
      const newDoc = getDocumentByHash(fileHash);
      if (newDoc) {
        updateFileSize(fileHash, stats.size);
        if (metadata) {
          updateMetadata(fileHash, {
            title: metadata.title,
            author: metadata.author,
            publisher: metadata.producer,
            publishDate: metadata.creationDate,
          });
        }
        updateDocumentSyncStatus(fileHash, true, category || undefined);
        updateProcessingStatus(fileHash, "completed");
      }
    }
    
    win?.webContents.send("library:updated");
  } catch (error) {
    console.error("[Main] Error processing file:", error);
    const { fileHash } = await hashFile(filePath);
    const existing = getDocumentByHash(fileHash);
    if (existing) {
      updateProcessingStatus(fileHash, "failed");
    }
  }
}

function setupFileWatcher() {
  const libraryPath = LIBRARY_PATH();
  const watchedPaths = [
    libraryPath,
    ...getSourceFolders()
      .map((folder) => folder.path)
      .filter((folderPath) => fs.existsSync(folderPath)),
  ];
  
  if (fileWatcher) {
    fileWatcher.close();
  }

  if (!fs.existsSync(libraryPath)) {
    fs.mkdirSync(libraryPath, { recursive: true });
  }

  fileWatcher = chokidar.watch(watchedPaths, {
    persistent: true,
    ignoreInitial: true,
    depth: 99,
    awaitWriteFinish: {
      stabilityThreshold: 1000,
      pollInterval: 100,
    },
  } as any);

  fileWatcher.on("add", (filePath) => {
    const isBook = [".pdf", ".epub", ".mobi", ".azw", ".azw3", ".azw4", ".kfx", ".prc", ".cbz"]
      .includes(path.extname(filePath).toLowerCase());
    if (isBook) {
      console.log("[Main] New book detected:", filePath);
      processFile(filePath);
    }
  });

  fileWatcher.on("unlink", async (filePath) => {
    const isBook = [".pdf", ".epub", ".mobi", ".azw", ".azw3", ".azw4", ".kfx", ".prc", ".cbz"]
      .includes(path.extname(filePath).toLowerCase());
    if (isBook) {
      console.log("[Main] Book removed:", filePath);
      // Try to find by path first (most reliable)
      const doc = getDocumentByPath(filePath);
      if (doc) {
        const result = deleteDocument(doc.fileHash);
        if (result.success) {
          console.log("[Main] Document deleted from DB:", doc.fileHash);
          win?.webContents.send("library:updated");
        }
        return;
      }
      // Fallback: try hash but handle errors gracefully
      try {
        if (fs.existsSync(filePath)) {
          return; // File still exists, maybe a rename
        }
        const { fileHash } = await hashFile(filePath);
        const result = deleteDocument(fileHash);
        if (result.success) {
          console.log("[Main] Document deleted from DB:", fileHash);
          win?.webContents.send("library:updated");
        }
      } catch (err) {
        // File doesn't exist or can't be read - ignore
        console.log("[Main] Could not process unlink event:", filePath);
      }
    }
  });

  fileWatcher.on("error", (error) => {
    console.error("[Main] File watcher error:", error);
  });

  console.log("[Main] File watcher setup for:", watchedPaths);
}

async function scanLibrary() {
  const roots = [
    LIBRARY_PATH(),
    ...getSourceFolders().map((folder) => folder.path),
  ].filter((rootPath) => fs.existsSync(rootPath));

  for (const rootPath of roots) {
    const bookFiles = getAllBookFiles(rootPath);

    for (const filePath of bookFiles) {
      try {
        const { fileHash } = await hashFile(filePath);
        const existing = getDocumentByHash(fileHash);

        if (existing && existing.filePath && existing.processingStatus === "completed" && path.resolve(existing.filePath).toLowerCase() === path.resolve(filePath).toLowerCase()) {
          continue;
        }

        await processFile(filePath);
      } catch (error) {
        console.error("Error scanning:", filePath, error);
      }
    }
  }
}

async function resyncLibrary(): Promise<{ added: number; removed: number; updated: number }> {
  const roots = [
    LIBRARY_PATH(),
    ...getSourceFolders().map((folder) => folder.path),
  ].filter((rootPath) => fs.existsSync(rootPath));
  let added = 0, removed = 0, updated = 0;

  if (roots.length === 0) {
    return { added: 0, removed: 0, updated: 0 };
  }

  const bookFiles = roots.flatMap((rootPath) => getAllBookFiles(rootPath));
  const bookFileSet = new Set(bookFiles.map(f => f.toLowerCase()));

  const allDocs = getAllDocuments();
  const docsInLibrary = allDocs.filter(d => d.filePath && d.isSynced === 1 && roots.some((rootPath) => isPathInside(rootPath, d.filePath)));

  for (const doc of docsInLibrary) {
    if (doc.filePath && !bookFileSet.has(doc.filePath.toLowerCase())) {
      console.log("[Main] Resync: book no longer exists, removing from DB:", doc.filePath);
      deleteDocument(doc.fileHash);
      removed++;
    }
  }

  const processInBatches = async (files: string[], batchSize: number) => {
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      await Promise.all(batch.map(async (filePath) => {
        try {
          const { fileHash } = await hashFile(filePath);
          const existing = getDocumentByHash(fileHash);

          if (!existing) {
            await processFile(filePath);
            added++;
          } else if (existing.filePath !== filePath) {
            updateDocumentPath(fileHash, filePath);
            updated++;
          }
        } catch (error) {
          console.error("[Main] Resync error:", filePath, error);
        }
      }));
    }
  };

  await processInBatches(bookFiles, 10);

  console.log(`[Main] Resync complete: added=${added}, removed=${removed}, updated=${updated}`);
  return { added, removed, updated };
}

function ensureLibraryFolder() {
  const libraryPath = path.join(app.getPath("userData"), "library");

  if (!fs.existsSync(libraryPath)) {
    fs.mkdirSync(libraryPath, { recursive: true });
  }

  return libraryPath;
}

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  return Uint8Array.from(buffer).buffer;
}

function createUniqueConvertedEpubPath(pdfPath: string): string {
  const directory = path.dirname(pdfPath);
  const baseName = path.basename(pdfPath, path.extname(pdfPath));
  let candidate = path.join(directory, `${baseName}-convertido.epub`);
  let index = 2;

  while (fs.existsSync(candidate)) {
    candidate = path.join(directory, `${baseName}-convertido-${index}.epub`);
    index += 1;
  }

  return candidate;
}

function createUniqueConvertedPath(sourcePath: string, targetFormat: BookFormat, outputDirectory?: string): string {
  const directory = outputDirectory ? path.resolve(outputDirectory) : path.dirname(sourcePath);
  const baseName = path.basename(sourcePath, path.extname(sourcePath));
  let candidate = path.join(directory, `${baseName}-convertido.${targetFormat}`);
  let index = 2;

  while (fs.existsSync(candidate)) {
    candidate = path.join(directory, `${baseName}-convertido-${index}.${targetFormat}`);
    index += 1;
  }

  return candidate;
}

function getLyceumPackageRoot(fileHash: string) {
  return path.join(app.getPath("userData"), "lyceum-packages", `${fileHash}.lyceum`);
}

interface UsbDeviceInfo {
  id: string;
  name: string;
  rootPath: string;
  kind: "kindle" | "kobo" | "ereader";
}

interface KindleSendDevice {
  id: string;
  name: string;
  kind: "kindle" | "kobo" | "ereader";
  isMtp: boolean;
  rootPath?: string;
  devicePath?: string;
  storageName?: string;
  destinationLabel: string;
}

interface KindleSendBookInput {
  fileHash: string;
  filePath: string;
  title: string;
  author?: string | null;
  fileType?: BookFormat | null;
  fileName?: string | null;
  publisher?: string | null;
  description?: string | null;
  publishDate?: string | null;
  language?: string | null;
  identifier?: string | null;
  asin?: string | null;
  subject?: string | null;
  series?: string | null;
  seriesIndex?: string | null;
  authorSort?: string | null;
  titleSort?: string | null;
}

interface KindleSendOptions {
  deviceId?: string;
  books: KindleSendBookInput[];
  convertToAzw3?: boolean;
  preserveMetadata?: boolean;
  organizeByAuthor?: boolean;
  destination?: string;
}

interface KindleSendItemResult {
  fileHash: string;
  title: string;
  success: boolean;
  status: "sent" | "converted" | "skipped" | "error";
  outputName?: string;
  outputPath?: string;
  sourcePath?: string;
  error?: string;
}

interface UsbBookListQuery {
  search?: string;
  fileType?: "all" | "pdf" | "epub";
  sort?: "title" | "recent" | "pages" | "size" | "title_asc" | "title_desc" | "recent_desc" | "recent_asc" | "pages_desc" | "pages_asc" | "size_desc" | "size_asc";
  limit?: number;
  offset?: number;
  countOnly?: boolean;
}

interface WindowsMtpBookEntry {
  deviceName: string;
  devicePath: string;
  name: string;
  path: string;
  relativePath: string;
  fileType: string;
  size: number;
  modifiedAt: string | null;
}

interface WindowsMtpDeviceEntry {
  name: string;
  devicePath: string;
  storageName: string;
  kind: "kindle" | "kobo" | "ereader";
}

let usbDeviceWatcher: NodeJS.Timeout | null = null;
let lastUsbDeviceSignature = "";

function createUniqueConvertedPdfPath(epubPath: string): string {
  const directory = path.dirname(epubPath);
  const baseName = path.basename(epubPath, path.extname(epubPath));
  let candidate = path.join(directory, `${baseName}-convertido.pdf`);
  let index = 2;

  while (fs.existsSync(candidate)) {
    candidate = path.join(directory, `${baseName}-convertido-${index}.pdf`);
    index += 1;
  }

  return candidate;
}

interface NativePdfViewerState {
  page: number;
  currentScale: number;
  scrollTop: number;
  totalPages: number;
  canAccess: boolean;
}

interface NativePdfViewerRestoreState {
  page: number;
  currentScale?: number;
  scrollTop?: number;
  restore?: boolean;
}

function findNativePdfViewerFrame(
  sourceUrl: string,
  targetWindow: ElectronBrowserWindow | null = win,
) {
  if (!targetWindow || !sourceUrl) return null;

  const normalizedUrl = sourceUrl.replace(/#.*$/, "");
  
  const candidates = [
    sourceUrl,
    normalizedUrl,
    encodeURIComponent(sourceUrl),
    encodeURIComponent(normalizedUrl),
    encodeURIComponent(sourceUrl.replace(/#/g, "")),
  ];

  return (
    targetWindow.webContents.mainFrame.framesInSubtree.find((frame) => {
      const frameUrl = frame.url || "";
      return candidates.some((candidate) => candidate && frameUrl.includes(candidate));
    }) ?? null
  );
}

async function waitForNativePdfViewerFrame(
  sourceUrl: string,
  targetWindow: ElectronBrowserWindow | null = win,
  timeoutMs = 8000,
) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const frame = findNativePdfViewerFrame(sourceUrl, targetWindow);
    if (frame) {
      return frame;
    }

    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  return null;
}

async function getNativePdfViewerState(
  sourceUrl: string,
  targetWindow: ElectronBrowserWindow | null = win,
): Promise<NativePdfViewerState | null> {
  const frame = await waitForNativePdfViewerFrame(sourceUrl, targetWindow);
  if (!frame) return null;

  try {
    const result = (await frame.executeJavaScript(
      `
        (async () => {
          if (globalThis.LyceumPdfJs?.getState) {
            return await globalThis.LyceumPdfJs.getState();
          }

          const app = globalThis.PDFViewerApplication;
          if (!app) {
            return null;
          }

          try {
            await app.initializedPromise;
          } catch {}

          const viewer = app.pdfViewer;
          const container = viewer?.container;
          const page = Number(app.page ?? viewer?.currentPageNumber ?? 1);
          const currentScale = Number(viewer?.currentScale ?? 1);
          const scrollTop = Number(container?.scrollTop ?? 0);
          const totalPages = Number(app.pagesCount ?? viewer?.pagesCount ?? 0);

          return {
            page: Number.isFinite(page) && page > 0 ? page : 1,
            currentScale: Number.isFinite(currentScale) && currentScale > 0 ? currentScale : 1,
            scrollTop: Number.isFinite(scrollTop) && scrollTop >= 0 ? scrollTop : 0,
            totalPages: Number.isFinite(totalPages) && totalPages > 0 ? totalPages : 0,
            canAccess: true,
          };
        })();
      `,
      true,
    )) as NativePdfViewerState | null;

    return result ?? null;
  } catch (error) {
    console.error("[native-pdf-viewer:get-state] Error:", error);
    return null;
  }
}

interface PdfOutlineNode {
  title: string;
  page: number | null;
  items: PdfOutlineNode[];
}

async function getNativePdfOutline(
  sourceUrl: string,
  targetWindow: ElectronBrowserWindow | null = win,
): Promise<PdfOutlineNode[] | null> {
  const frame = await waitForNativePdfViewerFrame(sourceUrl, targetWindow);
  if (!frame) return null;

  try {
    const result = (await frame.executeJavaScript(
      `
        (async () => {
          const app = globalThis.PDFViewerApplication;
          if (!app) return null;
          try { await app.initializedPromise; } catch {}
          if (!app.pdfDocument) return null;

          const outline = await app.pdfDocument.getOutline().catch(() => null);
          if (!outline) return [];

          async function resolvePage(dest) {
            if (!dest) return null;
            try {
              let explicit = dest;
              if (typeof dest === "string") {
                explicit = await app.pdfDocument.getDestination(dest);
              }
              if (!Array.isArray(explicit) || explicit.length === 0) return null;
              const target = explicit[0];
              if (typeof target === "number") {
                return target + 1;
              }
              const pageIndex = await app.pdfDocument.getPageIndex(target);
              return Number.isInteger(pageIndex) ? pageIndex + 1 : null;
            } catch (e) { return null; }
          }

          async function walk(items) {
            const out = [];
            for (const item of items) {
              out.push({
                title: item.title || "(sem título)",
                page: await resolvePage(item.dest),
                items: item.items ? await walk(item.items) : [],
              });
            }
            return out;
          }

          return await walk(outline);
        })();
      `,
      true,
    )) as PdfOutlineNode[] | null;

    return result ?? null;
  } catch (error) {
    console.error("[native-pdf-viewer:get-outline] Error:", error);
    return null;
  }
}

async function applyNativePdfViewerState(
  sourceUrl: string,
  state: NativePdfViewerRestoreState,
  targetWindow: ElectronBrowserWindow | null = win,
  restore = false,
): Promise<NativePdfViewerState | null> {
  const frame = await waitForNativePdfViewerFrame(sourceUrl, targetWindow);
  if (!frame) return null;

  try {
    const payload = JSON.stringify({
      page: state.page,
      currentScale: state.currentScale,
      scrollTop: state.scrollTop,
      restore,
    });

    const result = (await frame.executeJavaScript(
      `
        (async () => {
          if (globalThis.LyceumPdfJs?.applyState) {
            return await globalThis.LyceumPdfJs.applyState(${payload}, { restore });
          }

          const app = globalThis.PDFViewerApplication;
          if (!app) {
            return null;
          }

          try {
            await app.initializedPromise;
          } catch {}

          const viewer = app.pdfViewer;
          const container = viewer?.container;
          const nextState = ${payload};

          if (Number.isFinite(nextState.page) && nextState.page > 0) {
            app.page = nextState.page;
          }

          if (viewer && Number.isFinite(nextState.currentScale) && nextState.currentScale > 0) {
            viewer.currentScale = nextState.currentScale;
          }

          if (container && Number.isFinite(nextState.scrollTop) && nextState.scrollTop >= 0) {
            await new Promise((resolve) => setTimeout(resolve, 100));
            container.scrollTop = nextState.scrollTop;
            await new Promise((resolve) => setTimeout(resolve, 50));
            container.scrollTop = nextState.scrollTop;
          }

          const page = Number(app.page ?? viewer?.currentPageNumber ?? nextState.page ?? 1);
          const currentScale = Number(viewer?.currentScale ?? nextState.currentScale ?? 1);
          const scrollTop = Number(container?.scrollTop ?? nextState.scrollTop ?? 0);
          const totalPages = Number(app.pagesCount ?? viewer?.pagesCount ?? 0);

          return {
            page: Number.isFinite(page) && page > 0 ? page : 1,
            currentScale: Number.isFinite(currentScale) && currentScale > 0 ? currentScale : 1,
            scrollTop: Number.isFinite(scrollTop) && scrollTop >= 0 ? scrollTop : 0,
            totalPages: Number.isFinite(totalPages) && totalPages > 0 ? totalPages : 0,
            canAccess: true,
          };
        })();
      `,
      true,
    )) as NativePdfViewerState | null;

    return result ?? null;
  } catch (error) {
    console.error("[native-pdf-viewer:apply-state] Error:", error);
    return null;
  }
}

async function generateThumbnail(
  filePath: string,
  fileHash: string,
  force = false,
  fileType: "pdf" | "epub" | "cbz" | "azw3" | "kfx" = "pdf",
): Promise<string | null> {
  return generateThumbnailInWorker(filePath, fileHash, {
    thumbnailsDir: THUMBNAILS_DIR(),
    force,
    fileType,
    logPrefix: "[Main]",
  });
}

function getThumbnailHashFromPath(thumbnailPath: string): string | null {
  const baseName = path.basename(thumbnailPath, path.extname(thumbnailPath));
  const [candidate] = baseName.split("-");
  return candidate && SHA256_HEX_PATTERN.test(candidate) ? candidate : null;
}

function findThumbnailByHash(thumbnailsDir: string, fileHash: string): string | null {
  if (!SHA256_HEX_PATTERN.test(fileHash) || !fs.existsSync(thumbnailsDir)) {
    return null;
  }

  const files = fs.readdirSync(thumbnailsDir);
  const match = files.find((file) => {
    const ext = path.extname(file).toLowerCase();
    return file.startsWith(`${fileHash}-`) && THUMBNAIL_EXTENSIONS.includes(ext);
  });

  return match ? path.join(thumbnailsDir, match) : null;
}

function resolveThumbnailUrl(thumbnailPath: string): string | null {
  if (!thumbnailPath) return null;

  const thumbnailsDir = THUMBNAILS_DIR();
  const normalizedThumbnailPath = path.resolve(thumbnailPath);

  if (!isPathWithin(thumbnailsDir, normalizedThumbnailPath)) {
    return null;
  }

  const hash = getThumbnailHashFromPath(normalizedThumbnailPath);
  if (!hash) return null;

  // Verify the file actually exists
  const existing = findThumbnailByHash(thumbnailsDir, hash);
  if (!existing) return null;

  return `thumb://${hash}`;
}

function getPdfjsAssetsRoot(): string {
  return path.join(process.env.VITE_PUBLIC!, "pdfjs");
}

function getPdfjsAssetPath(requestUrl: string): string | null {
  try {
    const url = new URL(requestUrl);
    const relativePath = decodeURIComponent(url.pathname.replace(/^\/+/, "")) || "viewer.html";
    if (!isSafeRelativePath(relativePath)) {
      return null;
    }

    const assetPath = path.resolve(getPdfjsAssetsRoot(), relativePath);
    return isPathWithin(getPdfjsAssetsRoot(), assetPath) ? assetPath : null;
  } catch {
    return null;
  }
}

async function createLocalFileResponse(
  filePath: string,
  contentType?: string,
  request?: Request,
): Promise<Response> {
  const headers = new Headers();
  if (contentType) {
    headers.set("Content-Type", contentType);
  }
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Cross-Origin-Resource-Policy", "cross-origin");
  headers.set("Accept-Ranges", "bytes");

  const stat = await fs.promises.stat(filePath);
  const fileSize = stat.size;
  headers.set("Content-Length", String(fileSize));

  const rangeHeader = request?.headers.get("range");
  const rangeMatch = rangeHeader && /bytes=(\d*)-(\d*)/.exec(rangeHeader);
  if (rangeMatch) {
    const start = rangeMatch[1] ? parseInt(rangeMatch[1], 10) : 0;
    const end = rangeMatch[2]
      ? parseInt(rangeMatch[2], 10)
      : fileSize - 1;

    if (
      Number.isNaN(start) ||
      Number.isNaN(end) ||
      start > end ||
      end >= fileSize
    ) {
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${fileSize}` },
      });
    }

    const length = end - start + 1;
    const chunk = Buffer.alloc(length);
    const fd = await fs.promises.open(filePath, "r");
    try {
      await fd.read(chunk, 0, length, start);
    } finally {
      await fd.close();
    }

    headers.set("Content-Range", `bytes ${start}-${end}/${fileSize}`);
    headers.set("Content-Length", String(length));
    return new Response(chunk, { status: 206, headers });
  }

  return new Response(await fs.promises.readFile(filePath), { headers });
}

async function handlePdfjsAssetRequest(request: Request): Promise<Response> {
  const assetPath = getPdfjsAssetPath(request.url);
  if (!assetPath || !fs.existsSync(assetPath) || !fs.statSync(assetPath).isFile()) {
    return new Response(null, { status: 404 });
  }

  const contentType =
    PDFJS_ASSET_MIME_TYPES[path.extname(assetPath).toLowerCase()] ||
    "application/octet-stream";

  return createLocalFileResponse(assetPath, contentType, request);
}

function parseLyceumPdfHash(requestUrl: string): string | null {
  try {
    const url = new URL(requestUrl);
    const candidate = path.basename(url.pathname, ".pdf") || url.hostname.replace(/\.pdf$/i, "");
    return SHA256_HEX_PATTERN.test(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

async function handleLyceumPdfRequest(request: Request): Promise<Response> {
  const fileHash = parseLyceumPdfHash(request.url);
  if (!fileHash) {
    return new Response(null, { status: 404 });
  }

  // Prefer the in-memory buffer that was read when the document was opened.
  // This mirrors how the previous renderer loaded the PDF directly from memory
  // and guarantees the bytes are served even when the database hash is stale or
  // the file is no longer resolvable by path on disk.
  const cachedBuffer = getCachedPdfBuffer(fileHash);
  if (cachedBuffer) {
    return createLocalFileResponseFromBuffer(cachedBuffer, request);
  }

  const document = getDocumentByHash(fileHash);
  if (document?.filePath && document.fileType === "pdf" && fs.existsSync(document.filePath)) {
    return createLocalFileResponse(document.filePath, "application/pdf", request);
  }

  // The database hash may be stale (e.g. the file was rewritten after a
  // metadata/cover edit, conversion, or a moved file). Fall back to locating
  // the file by its content hash on disk, mirroring reopenDocument's logic.
  const foundPath = await findFileByHash(fileHash, [LIBRARY_PATH(), USER_DATA_PATH()]);
  if (foundPath) {
    return createLocalFileResponse(foundPath, "application/pdf", request);
  }

  return new Response(null, { status: 404 });
}

function createLocalFileResponseFromBuffer(buffer: Buffer, request?: Request): Response {
  const headers = new Headers();
  headers.set("Content-Type", "application/pdf");
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Cross-Origin-Resource-Policy", "cross-origin");
  headers.set("Accept-Ranges", "bytes");

  const fileSize = buffer.length;
  headers.set("Content-Length", String(fileSize));

  const rangeHeader = request?.headers.get("range");
  const rangeMatch = rangeHeader && /bytes=(\d*)-(\d*)/.exec(rangeHeader);
  if (rangeMatch) {
    const start = rangeMatch[1] ? parseInt(rangeMatch[1], 10) : 0;
    const end = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : fileSize - 1;

    if (
      Number.isNaN(start) ||
      Number.isNaN(end) ||
      start > end ||
      end >= fileSize
    ) {
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${fileSize}` },
      });
    }

    const slice = buffer.subarray(start, end + 1);
    headers.set("Content-Range", `bytes ${start}-${end}/${fileSize}`);
    headers.set("Content-Length", String(slice.length));
    return new Response(new Uint8Array(slice), { status: 206, headers });
  }

  return new Response(new Uint8Array(buffer), { headers });
}

function createAppWindow(
  options: BrowserWindowConstructorOptions = {}
) {
  const appWindow = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC!, "logo.ico"),
    title: "Lyceum",
    width: 1200,
    height: 800,
    frame: false,
    backgroundColor: "#09090b",
    webPreferences: {
      preload: PRELOAD_ENTRY,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
    autoHideMenuBar: true,
    ...options,
  });

  appWindow.webContents.on("did-finish-load", () => {
    appWindow.webContents.setZoomFactor(1.0);
  });
  appWindow.webContents.on("before-input-event", (event, input) => {
    if (input.type === "keyDown" && (input.control || input.meta) && !input.alt) {
      const key = input.key.toLowerCase();

      if (key === "=" || key === "+") {
        event.preventDefault();
        const current = appWindow.webContents.getZoomFactor();
        appWindow.webContents.setZoomFactor(Math.min(3.0, current + 0.1));
        appWindow.webContents.send("zoom-factor-changed", appWindow.webContents.getZoomFactor());
        return;
      }

      if (key === "-") {
        event.preventDefault();
        const current = appWindow.webContents.getZoomFactor();
        appWindow.webContents.setZoomFactor(Math.max(0.3, current - 0.1));
        appWindow.webContents.send("zoom-factor-changed", appWindow.webContents.getZoomFactor());
        return;
      }

      if (key === "0" && !input.shift) {
        event.preventDefault();
        appWindow.webContents.setZoomFactor(1.0);
        appWindow.webContents.send("zoom-factor-changed", 1.0);
        return;
      }
    }

    if (!isReadingRouteUrl(appWindow.webContents.getURL())) {
      return;
    }

    if (input.type !== "keyDown" || (!input.control && !input.meta) || input.alt) {
      return;
    }

    const key = input.key.toLowerCase();
    const isTabShortcut =
      key === "w" ||
      key === "t" ||
      key === "tab" ||
      key === "pageup" ||
      key === "pagedown" ||
      /^[1-9]$/.test(key);

    if (!isTabShortcut) {
      return;
    }

    event.preventDefault();
    appWindow.webContents.send("reading-shortcut", {
      key,
      shift: input.shift,
    });
  });
  appWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  appWindow.webContents.on("will-navigate", (event) => {
    event.preventDefault();
  });

  return appWindow;
}

function isReadingRouteUrl(currentUrl: string): boolean {
  try {
    const parsedUrl = new URL(currentUrl);
    return parsedUrl.pathname === "/reading" || parsedUrl.hash.startsWith("#/reading");
  } catch {
    return currentUrl.includes("/reading") || currentUrl.includes("#/reading");
  }
}

function appendUrlSearchParams(target: URLSearchParams, source: string) {
  if (!source.includes("=")) return;

  new URLSearchParams(source.replace(/^\?/, "")).forEach((value, key) => {
    target.set(key, value);
  });
}

function parseAuthDeepLink(rawUrl: string) {
  try {
    const parsedUrl = new URL(rawUrl);

    if (parsedUrl.protocol !== `${APP_PROTOCOL}:`) {
      return null;
    }

    const normalizedHost = parsedUrl.hostname.toLowerCase();
    const normalizedPath = parsedUrl.pathname.replace(/^\/+/, "").toLowerCase();
    const isPasswordResetLink =
      (normalizedHost === "auth" && normalizedPath === "reset-password") ||
      normalizedHost === "reset-password" ||
      normalizedPath === "reset-password";

    if (!isPasswordResetLink) {
      return null;
    }

    const params = new URLSearchParams(parsedUrl.search);
    const hash = parsedUrl.hash.replace(/^#/, "");

    if (hash) {
      const hashQuery = hash.includes("?") ? hash.slice(hash.indexOf("?") + 1) : hash;
      appendUrlSearchParams(params, hashQuery);
    }

    return {
      route: PASSWORD_RESET_DEEP_LINK_ROUTE,
      params: Object.fromEntries(params.entries()),
    };
  } catch {
    return null;
  }
}

function isAuthDeepLink(candidate: string) {
  return parseAuthDeepLink(candidate) !== null;
}

function registerDefaultAppProtocol() {
  try {
    if ((process as any).defaultApp && process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(APP_PROTOCOL, process.execPath, [
        path.resolve(process.argv[1]),
      ]);
      return;
    }

    app.setAsDefaultProtocolClient(APP_PROTOCOL);
  } catch (error) {
    console.error("[Main] Failed to register app protocol:", error);
  }
}

function loadRendererRoute(
  targetWindow: ElectronBrowserWindow,
  route = "/",
  params?: Record<string, string | undefined>
) {
  const searchParams = new URLSearchParams();

  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value) {
      searchParams.set(key, value);
    }
  });

  const queryString = searchParams.toString();

  if (VITE_DEV_SERVER_URL) {
    const url = new URL(VITE_DEV_SERVER_URL);
    url.pathname = route;
    url.search = queryString;
    targetWindow.loadURL(url.toString());
  } else {
    const hash = queryString ? `${route}?${queryString}` : route;
    targetWindow.loadFile(path.join(RENDERER_DIST, "index.html"), { hash });
  }
}

function createWindow(route = "/", params?: Record<string, string | undefined>) {
  win = createAppWindow();
  setUpdateWindow(win);
  win.maximize();
  loadRendererRoute(win, route, params);
}

function sendAuthDeepLinkToRenderer(
  targetWindow: ElectronBrowserWindow,
  deepLink: { route: string; params: Record<string, string> },
) {
  targetWindow.webContents.send("auth:deep-link", deepLink);
}

function handleAuthDeepLink(rawUrl: string) {
  const deepLink = parseAuthDeepLink(rawUrl);

  if (!deepLink) {
    return false;
  }

  pendingAuthDeepLinkParams = deepLink.params;

  if (!app.isReady()) {
    pendingAuthDeepLink = rawUrl;
    return true;
  }

  if (!win) {
    createWindow(deepLink.route, deepLink.params);
    return true;
  }

  if (win.isMinimized()) win.restore();
  win.focus();
  const targetWindow = win;
  targetWindow.webContents.once("did-finish-load", () => {
    sendAuthDeepLinkToRenderer(targetWindow, deepLink);
  });
  loadRendererRoute(targetWindow, deepLink.route, deepLink.params);
  return true;
}

function getTargetWindow(event: IpcMainInvokeEvent): ElectronBrowserWindow | null {
  return BrowserWindow.fromWebContents(event.sender);
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
    setUpdateWindow(null);
  }
});

app.on("before-quit", () => {
  disposeProcessingWorkers();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.handle("add-document", async (_, data) => {
  const { fileHash } = await hashFile(data.filePath);

  const existing = getDocumentByHash(fileHash);
  if (existing) return existing;

  return addDocument(data.title, data.filePath, fileHash, undefined, 1, "pdf");
});

ipcMain.handle("get-documents", () => {
  return getAllDocuments();
});



ipcMain.handle("usb:get-devices", () => {
  return scanUsbDevices();
});

ipcMain.handle("usb:list-books", (_, query: UsbBookListQuery) => {
  return listUsbBooks(query);
});

ipcMain.handle("usb:scan-books", async () => {
  lastUsbDeviceSignature = await getUsbDeviceSignature();
  win?.webContents.send("usb:devices-updated");
  return listUsbBooks();
});

ipcMain.handle("usb:open-book", async (_, filePath: string) => {
  try {
    const localPath = filePath.startsWith("::")
      ? await copyWindowsMtpBookToTemp(filePath)
      : filePath;

    if (!localPath) {
      return { success: false, error: "NÃ£o foi possÃ­vel acessar o arquivo no dispositivo" };
    }

    const isEpub = localPath.toLowerCase().endsWith(".epub");
    const isPdf = localPath.toLowerCase().endsWith(".pdf");
    if (!isEpub && !isPdf) {
      return { success: false, error: "Formato nÃ£o suportado no leitor" };
    }

    const document = await openReadableFile(localPath);
    if (!document) {
      return { success: false, error: "NÃ£o foi possÃ­vel abrir o livro" };
    }

    return { success: true, ...document };
  } catch (error) {
    console.error("[usb:open-book] Error:", error);
    return { success: false, error: String(error) };
  }
});

ipcMain.handle("kindle:list-devices", async () => {
  return listKindleSendDevices();
});

ipcMain.handle("kindle:send-books", async (_, options: KindleSendOptions) => {
  return sendBooksToKindle({
    ...options,
    books: Array.isArray(options?.books) ? options.books : [],
    convertToAzw3: options?.convertToAzw3 ?? true,
    preserveMetadata: options?.preserveMetadata ?? true,
    organizeByAuthor: options?.organizeByAuthor ?? false,
    destination: options?.destination || "documents/Downloads",
  });
});

ipcMain.handle("reading:save", (_, payload) => {
  const { fileHash, state } = payload ?? {};
  if (!fileHash || !state) return;

  const safeState = {
    currentPage: state.currentPage ?? 1,
    currentZoom: state.currentZoom ?? 1,
    currentScroll: state.currentScroll ?? 0,
    annotations: state.annotations ?? "[]",
  };

  updateReadingState(fileHash, safeState);
  updateLastOpened(fileHash);
  win?.webContents.send("library:updated");
});

ipcMain.handle("reading:get", (_, fileHash) => {
  return getDocumentByHash(fileHash);
});

ipcMain.handle("native-pdf-viewer:get-state", async (event, sourceUrl: string) => {
  try {
    return await getNativePdfViewerState(sourceUrl, getTargetWindow(event));
  } catch (error) {
    console.error("[native-pdf-viewer:get-state] IPC Error:", error);
    return null;
  }
});

ipcMain.handle(
  "native-pdf-viewer:apply-state",
  async (event, sourceUrl: string, state: NativePdfViewerRestoreState) => {
    if (!state) return null;

    try {
      return await applyNativePdfViewerState(sourceUrl, {
        page: state.page ?? 1,
        currentScale: state.currentScale ?? 1,
        scrollTop: state.scrollTop ?? 0,
      }, getTargetWindow(event), state.restore ?? false);
    } catch (error) {
      console.error("[native-pdf-viewer:apply-state] IPC Error:", error);
      return null;
    }
  },
);

ipcMain.handle("native-pdf-viewer:get-outline", async (event, sourceUrl: string) => {
  try {
    return await getNativePdfOutline(sourceUrl, getTargetWindow(event));
  } catch (error) {
    console.error("[native-pdf-viewer:get-outline] IPC Error:", error);
    return null;
  }
});

ipcMain.handle("dialog:open-pdf", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });
  if (result.canceled || !result.filePaths[0]) return null;
  return openReadableFile(result.filePaths[0]);
});

ipcMain.handle("dialog:open-epub", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [{ name: "EPUB", extensions: ["epub"] }],
  });
  if (result.canceled || !result.filePaths[0]) return null;
  return openReadableFile(result.filePaths[0]);
});

ipcMain.handle("dialog:open-readable-file", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [
      { name: "PDF e EPUB", extensions: ["pdf", "epub"] },
    ],
  });
  if (result.canceled || !result.filePaths[0]) return null;
  return openReadableFile(result.filePaths[0]);
});

ipcMain.handle("temp:get-pdf-file", async (_, fileBuffer: ArrayBuffer, fileHash: string) => {
  const tempDir = app.getPath("temp");
  const tempFilePath = path.join(tempDir, `${fileHash}.pdf`);
  
  try {
    await fs.promises.writeFile(tempFilePath, Buffer.from(fileBuffer));
    return tempFilePath;
  } catch (error) {
    console.error("[temp:get-pdf-file] Error:", error);
    return null;
  }
});

async function printHtmlToPdf(htmlPath: string, outputPath: string, options: LyceumConversionOptions = {}, signal?: AbortSignal) {
  const printer = new BrowserWindow({
    show: false,
    backgroundColor: "#ffffff",
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });

  const abortPrinter = () => {
    if (!printer.isDestroyed()) printer.destroy();
  };
  signal?.addEventListener("abort", abortPrinter, { once: true });

  try {
    throwIfConversionAborted(signal);
    await printer.loadURL(pathToFileURL(htmlPath).href);
    throwIfConversionAborted(signal);
    await printer.webContents.executeJavaScript(`Promise.all([
      document.fonts ? document.fonts.ready : Promise.resolve(),
      ...Array.from(document.images).map((image) => image.complete
        ? Promise.resolve()
        : new Promise((resolve) => {
            image.addEventListener('load', resolve, { once: true });
            image.addEventListener('error', resolve, { once: true });
          }))
    ])`, true);
    const pdf = await printer.webContents.printToPDF({
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: false,
      landscape: false,
      pageSize: options.pdfPageSize || "A4",
      generateTaggedPDF: true,
      generateDocumentOutline: options.pdfGenerateOutline !== false,
    });
    throwIfConversionAborted(signal);
    await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.promises.writeFile(outputPath, pdf);
  } catch (error) {
    if (signal?.aborted) throw new DOMException("Conversao cancelada", "AbortError");
    throw error;
  } finally {
    signal?.removeEventListener("abort", abortPrinter);
    if (!printer.isDestroyed()) printer.destroy();
  }
}

async function convertTextualToPdfWithChromium(
  payload: Parameters<typeof convertViaLyceumInWorker>[0],
  signal?: AbortSignal,
  onProgress?: (progress: number, message?: string) => void,
) {
  const tempBase = path.join(app.getPath("temp"), "lyceum-print");
  await fs.promises.mkdir(tempBase, { recursive: true });
  const tempRoot = await fs.promises.mkdtemp(path.join(tempBase, "job-"));
  const htmlPath = path.join(tempRoot, "book.html");

  try {
    throwIfConversionAborted(signal);
    const prepared = await convertViaLyceumInWorker({
      ...payload,
      targetFormat: "html",
      outputPath: htmlPath,
      thumbnailsDir: undefined,
      conversionOptions: {
        ...payload.conversionOptions,
        htmlIncludeToc: false,
      },
    }, { signal, onProgress: (progress, message) => onProgress?.(progress * 0.7, message) });
    onProgress?.(0.76, "Paginando HTML no Chromium");
    await printHtmlToPdf(htmlPath, payload.outputPath, payload.conversionOptions, signal);
    onProgress?.(0.9, "Validando PDF gerado");
    throwIfConversionAborted(signal);
    const [hashed, pageCount] = await Promise.all([
      hashFile(payload.outputPath),
      getPdfPageCountMainThread(payload.outputPath, "[Chromium PDF]"),
    ]);
    const thumbnailPath = payload.thumbnailsDir
      ? await generateThumbnail(payload.outputPath, hashed.fileHash, false, "pdf")
      : null;
    const rendererWarning = "PDF paginado pelo Chromium com CSS, fontes, imagens e fundos preservados.";
    return {
      ...prepared,
      outputPath: payload.outputPath,
      ...hashed,
      thumbnailPath: thumbnailPath || undefined,
      numPages: pageCount,
      exportReport: {
        ...prepared.exportReport,
        outputFormat: "pdf" as const,
        warnings: [...(prepared.exportReport?.warnings || []), rendererWarning],
        stats: {
          ...(prepared.exportReport?.stats || {}),
          pageCount,
          renderer: "chromium",
          printBackground: true,
          fidelityMode: "browser-paginated",
        },
      },
      report: {
        ...prepared.report,
        pageCount,
        renderer: "chromium",
        printBackground: true,
        fidelityMode: "browser-paginated",
        warnings: [...(prepared.report?.warnings || []), rendererWarning],
      },
    };
  } finally {
    if (isPathInside(tempBase, tempRoot)) {
      await fs.promises.rm(tempRoot, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}

function shouldUseChromiumPdf(sourceFormat: BookFormat, targetFormat: BookFormat) {
  return targetFormat === "pdf" && (["epub", "html", "txt"] as BookFormat[]).includes(sourceFormat);
}

async function runGenericDocumentConversion(
  fileHash: string,
  targetFormat: BookFormat,
  requestOptions: ConversionRequestOptions = {},
  signal?: AbortSignal,
  onProgress?: (progress: number, message?: string) => void,
) {
  let outputPath: string | undefined;
  try {
    throwIfConversionAborted(signal);
    const { inferBookFormatFromPath } = await loadLyceumConversionModule();
    const doc = getDocumentByHash(fileHash);

    if (!doc || !doc.filePath) {
      return { success: false, error: "Livro nao encontrado na biblioteca" };
    }

    const sourceFormat = inferBookFormatFromPath(doc.filePath) || doc.fileType;
    if (sourceFormat === targetFormat) {
      return { success: false, error: "O formato de origem e destino sao iguais" };
    }

    if (!fs.existsSync(doc.filePath)) {
      return { success: false, error: "Arquivo de origem nao encontrado no disco" };
    }

    outputPath = createUniqueConvertedPath(doc.filePath, targetFormat, requestOptions.outputDirectory);
    const conversionPayload = {
      sourcePath: doc.filePath,
      sourceFormat,
      targetFormat,
      packageRoot: getLyceumPackageRoot(fileHash),
      outputPath,
      metadata: {
        title: doc.title ? path.basename(doc.title, path.extname(doc.title)) : path.basename(doc.filePath, path.extname(doc.filePath)),
        author: doc.author || undefined,
        language: doc.language || "pt-BR",
        publisher: doc.publisher || undefined,
        description: doc.description || undefined,
        publishDate: doc.publishDate || undefined,
        identifier: doc.identifier || undefined,
        asin: doc.asin || undefined,
        subject: doc.subject || undefined,
        series: doc.series || undefined,
        seriesIndex: doc.seriesIndex || undefined,
        authorSort: doc.authorSort || undefined,
        titleSort: doc.titleSort || undefined,
      },
      pdfImageTempDir: sourceFormat === "pdf"
        ? path.join(app.getPath("temp"), "lyceum-pdf-to-epub-images", fileHash)
        : undefined,
      thumbnailsDir: THUMBNAILS_DIR(),
      conversionOptions: requestOptions.conversionOptions,
    };
    const converted = shouldUseChromiumPdf(sourceFormat, targetFormat)
      ? await convertTextualToPdfWithChromium(conversionPayload, signal, onProgress)
      : await convertViaLyceumInWorker(conversionPayload, { signal, onProgress });
    throwIfConversionAborted(signal);

    const outputHash = converted.fileHash;
    const existing = getDocumentByHash(outputHash) || getDocumentByPath(outputPath);
    const outputFileType = targetFormat;
    const thumbnailPath = converted.thumbnailPath || null;
    const numPages = converted.numPages || 1;

    if (!existing) {
      addDocument(
        path.basename(outputPath, path.extname(outputPath)),
        outputPath,
        outputHash,
        thumbnailPath || undefined,
        numPages || 1,
        outputFileType,
        doc.isSynced ? 1 : 0,
      );
    }

    win?.webContents.send("library:updated");
    knownConversionOutputs.set(path.resolve(outputPath), outputHash);

    return {
      success: true,
      outputPath,
      fileHash: outputHash,
      fileSize: converted.fileSize,
      thumbnailPath: thumbnailPath || undefined,
      packageRoot: converted.packageRoot,
      report: converted.report,
    };
  } catch (error) {
    if (signal?.aborted) {
      if (outputPath) await fs.promises.rm(outputPath, { force: true }).catch(() => undefined);
      return { success: false, canceled: true, error: "Conversao cancelada" };
    }
    console.error("[conversion:run] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro ao converter livro",
    };
  }
}

async function runGenericFileConversion(
  sourcePath: string,
  targetFormat: BookFormat,
  requestOptions: ConversionRequestOptions = {},
  signal?: AbortSignal,
  onProgress?: (progress: number, message?: string) => void,
) {
  let outputPath: string | undefined;
  try {
    throwIfConversionAborted(signal);
    const { inferBookFormatFromPath } = await loadLyceumConversionModule();
    const localPath = sourcePath.startsWith("::")
      ? await copyWindowsMtpBookToTemp(sourcePath)
      : sourcePath;

    if (!localPath) {
      return { success: false, error: "Nao foi possivel acessar o arquivo de origem" };
    }

    if (!fs.existsSync(localPath)) {
      return { success: false, error: "Arquivo de origem nao encontrado no disco" };
    }

    const sourceFormat = inferBookFormatFromPath(localPath);
    if (!sourceFormat) {
      return { success: false, error: "Formato de origem nao suportado" };
    }

    if (sourceFormat === targetFormat) {
      return { success: false, error: "O formato de origem e destino sao iguais" };
    }

    const { fileHash: sourceHash } = await hashFile(localPath);
    const sourceTitle = path.basename(localPath, path.extname(localPath));
    outputPath = createUniqueConvertedPath(localPath, targetFormat, requestOptions.outputDirectory);
    const conversionPayload = {
      sourcePath: localPath,
      sourceFormat,
      targetFormat,
      packageRoot: getLyceumPackageRoot(sourceHash),
      outputPath,
      metadata: {
        title: sourceTitle,
        language: "pt-BR",
      },
      pdfImageTempDir: sourceFormat === "pdf"
        ? path.join(app.getPath("temp"), "lyceum-pdf-to-epub-images", sourceHash)
        : undefined,
      thumbnailsDir: THUMBNAILS_DIR(),
      conversionOptions: requestOptions.conversionOptions,
    };
    const converted = shouldUseChromiumPdf(sourceFormat, targetFormat)
      ? await convertTextualToPdfWithChromium(conversionPayload, signal, onProgress)
      : await convertViaLyceumInWorker(conversionPayload, { signal, onProgress });
    throwIfConversionAborted(signal);

    const outputHash = converted.fileHash;
    const existing = getDocumentByHash(outputHash) || getDocumentByPath(outputPath);
    const thumbnailPath = converted.thumbnailPath || null;
    const numPages = converted.numPages || 1;

    if (!existing) {
      addDocument(
        path.basename(outputPath, path.extname(outputPath)),
        outputPath,
        outputHash,
        thumbnailPath || undefined,
        numPages || 1,
        targetFormat,
        0,
      );
    }

    win?.webContents.send("library:updated");
    knownConversionOutputs.set(path.resolve(outputPath), outputHash);

    return {
      success: true,
      outputPath,
      fileHash: outputHash,
      fileSize: converted.fileSize,
      thumbnailPath: thumbnailPath || undefined,
      packageRoot: converted.packageRoot,
      report: converted.report,
    };
  } catch (error) {
    if (signal?.aborted) {
      if (outputPath) await fs.promises.rm(outputPath, { force: true }).catch(() => undefined);
      return { success: false, canceled: true, error: "Conversao cancelada" };
    }
    console.error("[conversion:run-file] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro ao converter arquivo",
    };
  }
}

ipcMain.handle("conversion:list-targets", async (_, fileHash: string) => {
  const {
    inferBookFormatFromPath,
    listTargetsForSourceFormat,
  } = await loadLyceumConversionModule();
  const doc = getDocumentByHash(fileHash);

  if (!doc?.filePath) {
    return { success: false, targets: [], error: "Livro nao encontrado na biblioteca" };
  }

  const sourceFormat = inferBookFormatFromPath(doc.filePath) || doc.fileType;
  return {
    success: true,
    sourceFormat,
    targets: listTargetsForSourceFormat(sourceFormat),
  };
});

async function runTrackedConversion<T>(
  jobId: string | undefined,
  action: (signal?: AbortSignal) => Promise<T>,
) {
  if (!jobId) return action();
  if (activeConversionControllers.has(jobId)) {
    return { success: false, error: "Esta conversao ja esta em andamento" } as T;
  }
  const controller = new AbortController();
  activeConversionControllers.set(jobId, controller);
  try {
    return await action(controller.signal);
  } finally {
    if (activeConversionControllers.get(jobId) === controller) {
      activeConversionControllers.delete(jobId);
    }
  }
}

ipcMain.handle("conversion:run", async (_, fileHash: string, targetFormat: BookFormat, requestOptions?: ConversionRequestOptions) => {
  const onProgress = requestOptions?.jobId
    ? (progress: number, message?: string) => win?.webContents.send("conversion:progress", { jobId: requestOptions.jobId, progress, message })
    : undefined;
  return runTrackedConversion(requestOptions?.jobId, (signal) =>
    runGenericDocumentConversion(fileHash, targetFormat, requestOptions, signal, onProgress));
});

ipcMain.handle("conversion:run-file", async (_, filePath: string, targetFormat: BookFormat, requestOptions?: ConversionRequestOptions) => {
  const onProgress = requestOptions?.jobId
    ? (progress: number, message?: string) => win?.webContents.send("conversion:progress", { jobId: requestOptions.jobId, progress, message })
    : undefined;
  return runTrackedConversion(requestOptions?.jobId, (signal) =>
    runGenericFileConversion(filePath, targetFormat, requestOptions, signal, onProgress));
});

ipcMain.handle("conversion:cancel", (_, jobId: string) => {
  const controller = activeConversionControllers.get(jobId);
  if (controller) controller.abort();
  return { success: true, active: Boolean(controller) };
});

ipcMain.handle("conversion:delete-output", async (_, outputPath: string, outputHash: string) => {
  try {
    const resolvedPath = path.resolve(outputPath);
    if (knownConversionOutputs.get(resolvedPath) !== outputHash) {
      return { success: false, error: "O arquivo nao pertence a uma conversao desta sessao" };
    }
    const documentAtPath = getDocumentByPath(resolvedPath);
    if (documentAtPath?.fileHash) {
      const deleted = deleteBook(documentAtPath.fileHash, true);
      if (!deleted.success) return deleted;
    } else {
      await fs.promises.rm(resolvedPath, { force: true });
    }
    knownConversionOutputs.delete(resolvedPath);
    win?.webContents.send("library:updated");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle("pdf:convert-to-epub", async (_, fileHash: string) => {
  try {
    const doc = getDocumentByHash(fileHash);

    if (!doc || !doc.filePath) {
      return { success: false, error: "PDF nÃ£o encontrado na biblioteca" };
    }

    if (!doc.filePath.toLowerCase().endsWith(".pdf")) {
      return { success: false, error: "A conversÃ£o estÃ¡ disponÃ­vel apenas para PDFs" };
    }

    if (!fs.existsSync(doc.filePath)) {
      return { success: false, error: "Arquivo PDF nÃ£o encontrado no disco" };
    }

    const outputPath = createUniqueConvertedEpubPath(doc.filePath);
    const converted = await convertPdfToEpubInWorker({
      sourcePath: doc.filePath,
      outputPath,
      thumbnailsDir: THUMBNAILS_DIR(),
      pdfImageTempDir: path.join(app.getPath("temp"), "lyceum-pdf-to-epub-images", fileHash),
      metadata: {
        title: doc.title ? path.basename(doc.title, path.extname(doc.title)) : path.basename(doc.filePath, ".pdf"),
        author: doc.author || undefined,
        language: doc.language || "pt-BR",
        publisher: doc.publisher || undefined,
        description: doc.description || undefined,
      },
    });
    const epubHash = converted.fileHash;
    const existing = getDocumentByHash(epubHash) || getDocumentByPath(outputPath);
    const thumbnailPath = converted.thumbnailPath;
    const numPages = converted.numPages || 1;

    if (!existing) {
      addDocument(
        path.basename(outputPath, ".epub"),
        outputPath,
        epubHash,
        thumbnailPath || undefined,
        numPages || Math.max(1, converted.report.sectionCount),
        "epub",
        doc.isSynced ? 1 : 0,
      );
    }

    win?.webContents.send("library:updated");

    return {
      success: true,
      outputPath,
      fileHash: epubHash,
      report: converted.report,
    };
  } catch (error) {
    console.error("[pdf:convert-to-epub] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro ao converter PDF para EPUB",
    };
  }
});

ipcMain.handle("epub:convert-to-pdf", async (_, fileHash: string) => {
  try {
    const doc = getDocumentByHash(fileHash);

    if (!doc || !doc.filePath) {
      return { success: false, error: "EPUB não encontrado na biblioteca" };
    }

    if (!doc.filePath.toLowerCase().endsWith(".epub")) {
      return { success: false, error: "A conversão está disponível apenas para EPUBs" };
    }

    if (!fs.existsSync(doc.filePath)) {
      return { success: false, error: "Arquivo EPUB não encontrado no disco" };
    }

    const outputPath = createUniqueConvertedPdfPath(doc.filePath);
    const converted = await convertTextualToPdfWithChromium({
      sourcePath: doc.filePath,
      sourceFormat: "epub",
      targetFormat: "pdf",
      packageRoot: getLyceumPackageRoot(fileHash),
      outputPath,
      thumbnailsDir: THUMBNAILS_DIR(),
      metadata: {
        title: doc.title ? path.basename(doc.title, path.extname(doc.title)) : path.basename(doc.filePath, ".epub"),
        author: doc.author || undefined,
      },
    });
    const pdfHash = converted.fileHash;
    const existing = getDocumentByHash(pdfHash) || getDocumentByPath(outputPath);
    const thumbnailPath = converted.thumbnailPath;

    if (!existing) {
      addDocument(
        path.basename(outputPath, ".pdf"),
        outputPath,
        pdfHash,
        thumbnailPath || undefined,
        converted.report.pageCount,
        "pdf",
        doc.isSynced ? 1 : 0,
      );
    }

    win?.webContents.send("library:updated");

    return {
      success: true,
      outputPath,
      fileHash: pdfHash,
      report: converted.report,
    };
  } catch (error) {
    console.error("[epub:convert-to-pdf] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro ao converter EPUB para PDF",
    };
  }
});

ipcMain.handle("dialog:open-image", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [{ name: "Images", extensions: ["jpg", "jpeg", "png"] }],
  });
  if (result.canceled || !result.filePaths[0]) return null;
  return result.filePaths[0];
});

ipcMain.handle("read-image-data-url", async (_, filePath: string) => {
  try {
    const buffer = await fs.promises.readFile(filePath);
    if (!buffer || buffer.length === 0) return { success: false, error: "Empty file" };
    const ext = path.extname(filePath).toLowerCase();
    const mimeType = ext === ".png" ? "image/png" : ext === ".gif" ? "image/gif" : "image/jpeg";
    return { success: true, data: `data:${mimeType};base64,${buffer.toString("base64")}` };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

ipcMain.handle("dialog:select-folder", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"],
  });
  return {
    canceled: result.canceled,
    filePaths: result.filePaths,
  };
});

ipcMain.handle("dialog:import-pdf", async (_, targetFolder: string | null, action: "move" | "copy" = "copy") => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile", "multiSelections"],
    filters: [{ name: "Livros", extensions: ["pdf", "epub", "cbz"] }],
  });
  
  if (result.canceled || result.filePaths.length === 0) {
    return { success: false, canceled: true };
  }

  try {
    const targetDir = resolveLibraryRelativePath(targetFolder);

    if (!fs.existsSync(targetDir)) {
      return { success: false, errors: ["Pasta de destino não existe"] };
    }

    const imported: string[] = [];
    const errors: string[] = [];

    for (const filePath of result.filePaths) {
      try {
        const fileName = path.basename(filePath);
        const destPath = getUniqueFilePath(targetDir, fileName);
        if (filePath.toLowerCase().endsWith(".cbz")) {
          await validateCbzFile(filePath);
        }

        if (action === "move") {
          moveFileAcrossDevices(filePath, destPath);
        } else {
          fs.copyFileSync(filePath, destPath);
        }
        imported.push(path.basename(destPath));
      } catch (err) {
        const error = err as Error & { code?: string };
        errors.push(`${path.basename(filePath)}: ${error.message}`);
      }
    }

    const actionWord = action === "move" ? "movido(s)" : "copiado(s)";
    return { 
      success: true, 
      imported, 
      errors,
      message: imported.length > 0 
        ? `${imported.length} livro(s) ${actionWord}` 
        : "Nenhum livro importado"
    };
  } catch (error) {
    return { success: false, errors: [error instanceof Error ? error.message : "Caminho inválido"] };
  }
});

ipcMain.handle("app:get-last-document", () => {
  return getLastDocument();
});

ipcMain.handle("thumbnail:get", async (_, thumbnailPath: string) => {
  try {
    return resolveThumbnailUrl(thumbnailPath);
  } catch (error) {
    console.error("[thumbnail:get] Error:", error);
    return null;
  }
});

ipcMain.handle("thumbnail:get-many", async (_, thumbnailPaths: string[]) => {
  const result: Record<string, string | null> = {};

  try {
    const uniquePaths = Array.from(new Set(thumbnailPaths)).slice(0, 96);

    for (const thumbnailPath of uniquePaths) {
      result[thumbnailPath] = resolveThumbnailUrl(thumbnailPath);
    }
  } catch (error) {
    console.error("[thumbnail:get-many] Error:", error);
  }

  return result;
});

async function findFileByHash(fileHash: string, searchPaths: string[]): Promise<string | null> {
  for (const searchPath of searchPaths) {
    if (!fs.existsSync(searchPath)) continue;
    
    const files = getAllPdfFiles(searchPath);
    for (const filePath of files) {
      try {
        const { fileHash: hash } = await hashFile(filePath);
        if (hash === fileHash) {
          return filePath;
        }
      } catch {
        continue;
      }
    }
  }
  return null;
}





ipcMain.handle("window:minimize", (event) => {
  getTargetWindow(event)?.minimize();
});

ipcMain.handle("window:maximize", (event) => {
  const targetWindow = getTargetWindow(event);
  if (!targetWindow) {
    return;
  }

  if (targetWindow.isMaximized()) {
    targetWindow.unmaximize();
  } else {
    targetWindow.maximize();
  }
});

ipcMain.handle("window:close", (event) => {
  getTargetWindow(event)?.close();
});

ipcMain.handle("window:isMaximized", (event) => {
  return getTargetWindow(event)?.isMaximized() ?? false;
});

ipcMain.handle(
  "window:open-new",
  async (
    _,
    data: {
      fileHash: string;
      fileName: string;
      fileType: "pdf" | "epub";
      filePath?: string;
      libraryDocumentId?: string;
      pdfRenderer?: "pdfjs";
      source?: "library" | "local";
    }
  ) => {
    const newWindow = createAppWindow({
      title: `${data.fileName} - Lyceum`,
    });

    loadRendererRoute(newWindow, "/reading", {
      mode: "detached",
      fileHash: data.fileHash,
      fileType: data.fileType,
      fileName: data.fileName,
      filePath: data.filePath,
      pdfRenderer: data.pdfRenderer,
      source: data.source,
      libraryDocumentId: data.libraryDocumentId,
    });
  }
);





ipcMain.handle("category:create", (_, name: string, color?: string) => {
  return createCategory(name, color);
});

ipcMain.handle("category:update", (_, id: number, name: string, color: string) => {
  return updateCategory(id, name, color);
});

ipcMain.handle("category:delete", (_, id: number) => {
  return deleteCategory(id);
});

ipcMain.handle("category:get-all", () => {
  return getAllCategories();
});

ipcMain.handle("category:get-by-id", (_, id: number) => {
  return getCategoryById(id);
});

ipcMain.handle("category:get-for-document", (_, documentId: number) => {
  return getCategoriesForDocument(documentId);
});

ipcMain.handle("category:get-for-document-by-hash", (_, fileHash: string) => {
  return getCategoriesForDocumentByHash(fileHash);
});

ipcMain.handle("category:set-for-document", (_, documentId: number, categoryIds: number[]) => {
  return setDocumentCategories(documentId, categoryIds);
});

ipcMain.handle("category:add-to-document", (_, documentId: number, categoryId: number) => {
  return addCategoryToDocument(documentId, categoryId);
});

ipcMain.handle("category:remove-from-document", (_, documentId: number, categoryId: number) => {
  return removeCategoryFromDocument(documentId, categoryId);
});

ipcMain.handle("category:get-colors", () => {
  return getCategoryColors();
});

ipcMain.handle("category:import-from-folders", () => {
  const count = importCategoriesFromFolders();
  return { imported: count };
});

ipcMain.handle("backup:init", (_, supabaseUrl: string, supabaseAnonKey: string) => {
  try {
    initBackupClient(supabaseUrl, supabaseAnonKey);
    console.log("[Backup] Supabase client initialized");
    return { success: true };
  } catch (error) {
    const err = error as Error & { message?: string };
    console.error("[Backup] Error initializing:", err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("backup:set-session", async (_, accessToken: string, refreshToken: string) => {
  try {
    return await setBackupSession(accessToken, refreshToken);
  } catch (error) {
    const err = error as Error & { message?: string };
    console.error("[Backup] Error setting session:", err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("backup:clear-session", async () => {
  try {
    return await clearBackupSession();
  } catch (error) {
    const err = error as Error & { message?: string };
    console.error("[Backup] Error clearing session:", err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("backup:all-documents", async () => {
  try {
    const docs = getDocumentsForBackup();
    const result = await backupAllDocuments(docs);
    console.log(`[Backup] Completed: ${result.success} succeeded, ${result.failed} failed`);
    return result;
  } catch (error) {
    const err = error as Error & { message?: string };
    console.error("[Backup] Error:", err);
    return { success: 0, failed: 0, errors: [err.message] };
  }
});

ipcMain.handle("backup:all-habits", async () => {
  try {
    const habits = getAllHabits();
    const completions = getAllHabitCompletions();
    const result = await backupAllHabits(habits, completions);
    console.log(`[Backup] Habits completed: ${result.success} succeeded, ${result.failed} failed`);
    return result;
  } catch (error) {
    const err = error as Error & { message?: string };
    console.error("[Backup] Habits error:", err);
    return { success: 0, failed: 0, errors: [err.message] };
  }
});

ipcMain.handle("backup:all-categories", async () => {
  try {
    const categories = getAllCategories();
    const documentCategories = getAllDocumentCategories();
    const result = await backupAllCategories(categories, documentCategories);
    console.log(`[Backup] Categories completed: ${result.success} succeeded, ${result.failed} failed`);
    return result;
  } catch (error) {
    const err = error as Error & { message?: string };
    console.error("[Backup] Categories error:", err);
    return { success: 0, failed: 0, errors: [err.message] };
  }
});

ipcMain.handle("habits:get-all", () => {
  return getAllHabits();
});

ipcMain.handle("habits:get-by-id", (_, id: string) => {
  return getHabitById(id);
});

ipcMain.handle("habits:add", (_, habit: { id: string; name: string; unit: string | null; valueMode: string }) => {
  addHabit(habit);
  return { success: true };
});

ipcMain.handle("habits:update", (_, id: string, updates: { name?: string; unit?: string | null; valueMode?: string }) => {
  updateHabit(id, updates);
  return { success: true };
});

ipcMain.handle("habits:delete", (_, id: string) => {
  deleteHabit(id);
  return { success: true };
});

ipcMain.handle("habits:get-completions", (_, habitId: string) => {
  return getHabitCompletions(habitId);
});

ipcMain.handle("habits:get-all-completions", () => {
  return getAllHabitCompletions();
});

ipcMain.handle("habits:set-completion", (_, habitId: string, dateKey: string, value: string | null) => {
  setHabitCompletion(habitId, dateKey, value);
  return { success: true };
});

ipcMain.handle("habits:delete-completion", (_, habitId: string, dateKey: string) => {
  deleteHabitCompletion(habitId, dateKey);
  return { success: true };
});

ipcMain.handle("settings:open-default-apps", async () => {
  const { shell } = require("electron");
  await shell.openExternal("ms-settings:defaultapps");
  return { success: true };
});

ipcMain.handle("dictionary:get-index", async () => {
  const index = await dictionaryManager.loadLocalIndex();
  return index.dictionaries;
});

ipcMain.handle("dictionary:fetch-index", async () => {
  const index = await dictionaryManager.fetchIndex();
  return index.dictionaries;
});

ipcMain.handle("dictionary:download", async (_, dictId: string) => {
  try {
    const progress = (p: number) => {
      win?.webContents.send("dictionary:download-progress", { dictId, progress: p });
    };
    await dictionaryManager.downloadDictionary(dictId, progress);
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

ipcMain.handle("dictionary:delete", async (_, dictId: string) => {
  // Close storage first before deleting
  closeAllStorage();
  const success = await dictionaryManager.deleteDictionary(dictId);
  return { success };
});

ipcMain.handle("dictionary:lookup", async (_, word: string, dictId: string = "eng-por") => {
  try {
    const result = await quickLookup(word, dictId);
    return result;
  } catch (error) {
    return { found: false, word, lemma: word, content: "", source: "fallback", error: String(error) };
  }
});

ipcMain.handle("dictionary:get-info", (_, dictId: string) => {
  const info = dictionaryManager.getDictionaryInfo(dictId);
  return info || null;
});

ipcMain.handle("zoom:in", () => {
  const win = BrowserWindow.getFocusedWindow();
  if (!win) return;
  const current = win.webContents.getZoomFactor();
  win.webContents.setZoomFactor(Math.min(3.0, current + 0.1));
  win.webContents.send("zoom-factor-changed", win.webContents.getZoomFactor());
});

ipcMain.handle("zoom:out", () => {
  const win = BrowserWindow.getFocusedWindow();
  if (!win) return;
  const current = win.webContents.getZoomFactor();
  win.webContents.setZoomFactor(Math.max(0.3, current - 0.1));
  win.webContents.send("zoom-factor-changed", win.webContents.getZoomFactor());
});

ipcMain.handle("zoom:reset", () => {
  const win = BrowserWindow.getFocusedWindow();
  if (!win) return;
  win.webContents.setZoomFactor(1.0);
  win.webContents.send("zoom-factor-changed", 1.0);
});

ipcMain.handle("zoom:get-factor", () => {
  const win = BrowserWindow.getFocusedWindow();
  return win?.webContents.getZoomFactor() ?? 1.0;
});

ipcMain.handle("zoom:set-factor", (_, factor: number) => {
  const win = BrowserWindow.getFocusedWindow();
  if (!win) return;
  win.webContents.setZoomFactor(Math.max(0.3, Math.min(3.0, factor)));
  win.webContents.send("zoom-factor-changed", win.webContents.getZoomFactor());
});

ipcMain.handle("auth:consume-deep-link-params", () => {
  const params = pendingAuthDeepLinkParams;
  pendingAuthDeepLinkParams = null;
  return params;
});

registerUpdateHandlers(ipcMain);

const gotTheLock = (app as any).requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", async (_, commandLine) => {
    console.log("[Main] second-instance event triggered", { commandLine });

    const authDeepLink = commandLine.find(isAuthDeepLink);
    if (authDeepLink && handleAuthDeepLink(authDeepLink)) {
      console.log("[Main] Handled auth deep link from second instance");
      return;
    }
    
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }

    const filePath = commandLine.find(
      (arg) => arg.toLowerCase().endsWith(".pdf") || arg.toLowerCase().endsWith(".epub")
    );
    
    console.log("[Main] File path found from commandLine:", filePath);
    
    if (filePath && fs.existsSync(filePath)) {
      const document = await openReadableFile(filePath);
      if (document) {
        win?.webContents.send("file-opened", document);
        console.log("[Main] Sent file-opened event to renderer");
      } else {
        console.log("[Main] Failed to open document:", filePath);
      }
    } else {
      console.log("[Main] File does not exist or path is invalid:", filePath);
    }
  });
}

registerDefaultAppProtocol();

app.on("open-url", (event, url) => {
  event.preventDefault();
  handleAuthDeepLink(url);
});

async function handleFileArg(filePath: string) {
  console.log("[Main] handleFileArg called with:", filePath);
  
  if (!win) {
    console.log("[Main] Window not ready, skipping");
    return;
  }
  
  if (!fs.existsSync(filePath)) {
    console.error("[Main] File not found:", filePath);
    return;
  }

  const isEpub = filePath.toLowerCase().endsWith(".epub");
  const isPdf = filePath.toLowerCase().endsWith(".pdf");
  if (!isEpub && !isPdf) {
    console.error("[Main] Invalid file type:", filePath);
    return;
  }

  console.log("[Main] Opening file:", { filePath, isEpub, isPdf });

  try {
    const document = await openReadableFile(filePath);
    if (document) {
      win.webContents.send("file-opened", document);
      return;
    }

    console.log("[Main] Failed to open document:", filePath);
  } catch (error) {
    console.error("[Main] Error opening startup file:", error);
  }
}

const startArgs = process.argv.slice(1);
const startupAuthDeepLink = startArgs.find(isAuthDeepLink);
const startupFile = startArgs.find(
  (arg) => arg.toLowerCase().endsWith(".pdf") || arg.toLowerCase().endsWith(".epub")
);

protocol.registerSchemesAsPrivileged([
  { scheme: "thumb", privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
  { scheme: "img-preview", privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
  { scheme: "lyceum-pdfjs", privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
  { scheme: "lyceum-pdf", privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
  { scheme: "pdf-resource", privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
]);

function parseThumbUrlHash(requestUrl: string): string {
  const url = new URL(requestUrl);
  return (url.hostname || url.pathname.replace(/^\/+/, "")).replace(/\/+$/, "");
}

app.whenReady().then(async () => {
  const fs = require("fs");

  void checkProcessingWorkers()
    .then(() => console.info("[Main] Processing workers are ready."))
    .catch((error) => console.error("[Main] Processing worker health check failed:", error));

  protocol.handle("thumb", (request) => {
    const fileHash = parseThumbUrlHash(request.url);
    if (!SHA256_HEX_PATTERN.test(fileHash)) {
      return new Response(null, { status: 404 });
    }
    const thumbPath = findThumbnailByHash(THUMBNAILS_DIR(), fileHash);
    if (!thumbPath) {
      return new Response(null, { status: 404 });
    }
    return net.fetch(pathToFileURL(thumbPath).toString());
  });

  protocol.handle("img-preview", async (request) => {
    try {
      const filePath = decodeURIComponent(request.url.replace(/^img-preview:/, ""));
      const buffer = await fs.promises.readFile(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const mimeType = ext === ".png" ? "image/png" : ext === ".gif" ? "image/gif" : "image/jpeg";
      return new Response(buffer, { headers: { "Content-Type": mimeType } });
    } catch {
      return new Response(null, { status: 404 });
    }
  });

  protocol.handle("lyceum-pdfjs", (request) => {
    return handlePdfjsAssetRequest(request);
  });

  protocol.handle("lyceum-pdf", (request) => {
    return handleLyceumPdfRequest(request);
  });

  protocol.handle("pdf-resource", async (request) => {
    const filePath = request.url.replace(/^pdf-resource:\/\//, "");
    const fileBuffer = await fs.promises.readFile(decodeURIComponent(filePath));
    return new Response(fileBuffer, { headers: { "Content-Type": "application/pdf" } });
  });

  const cspDev = "default-src 'self'; script-src 'self' 'unsafe-eval'; worker-src 'self' blob: lyceum-pdfjs:; frame-src 'self' blob: pdf-resource: lyceum-pdfjs: lyceum-pdf: thumb:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: thumb: img-preview: lyceum-pdfjs: https://*.supabase.co https://covers.openlibrary.org https://books.google.com https://*.googleusercontent.com https://www.loc.gov https://tile.loc.gov; font-src 'self' data: lyceum-pdfjs:; connect-src 'self' blob: lyceum-pdf: lyceum-pdfjs: http://localhost:* https://*.supabase.co https://openlibrary.org https://covers.openlibrary.org https://www.googleapis.com https://books.google.com https://www.loc.gov https://loc.gov ws: wss:; object-src 'none'; base-uri 'self';";
  const cspProd = "default-src 'self'; script-src 'self'; worker-src 'self' blob: lyceum-pdfjs:; frame-src 'self' blob: pdf-resource: lyceum-pdfjs: lyceum-pdf: thumb:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: thumb: img-preview: lyceum-pdfjs: https://*.supabase.co https://covers.openlibrary.org https://books.google.com https://*.googleusercontent.com https://www.loc.gov https://tile.loc.gov; font-src 'self' data: lyceum-pdfjs:; connect-src 'self' blob: lyceum-pdf: lyceum-pdfjs: https://*.supabase.co https://openlibrary.org https://covers.openlibrary.org https://www.googleapis.com https://books.google.com https://www.loc.gov https://loc.gov; object-src 'none'; base-uri 'self';";

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const url = details.url;
    if (url.startsWith("http://localhost") || url.startsWith("http://127.0.0.1")) {
      callback({ responseHeaders: details.responseHeaders });
      return;
    }
    if (url.startsWith("file://") || url.startsWith("pdf-resource://")) {
      callback({ responseHeaders: details.responseHeaders });
      return;
    }
    if (url.startsWith("blob:") || url.startsWith("data:")) {
      callback({ responseHeaders: details.responseHeaders });
      return;
    }
    const csp = process.env.VITE_DEV_SERVER_URL ? cspDev : cspProd;
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [csp],
      },
    });
  });

  initDatabase();
  ensureLibraryFolder();
  setupFileWatcher();
  setupUsbDeviceWatcher();

  importCategoriesFromFolders();

  const initialAuthDeepLink = pendingAuthDeepLink ?? startupAuthDeepLink;
  const initialAuthRoute = initialAuthDeepLink ? parseAuthDeepLink(initialAuthDeepLink) : null;
  if (initialAuthRoute) {
    pendingAuthDeepLinkParams = initialAuthRoute.params;
  }
  createWindow(initialAuthRoute?.route ?? "/", initialAuthRoute?.params);
  pendingAuthDeepLink = null;

  setUpdateWindow(win);
  initializeUpdateService();
  setBooksWindow(win);
  setLibraryWindow(win);
  setLibraryChangeEmitter(() => win?.webContents.send("library:updated"));
  setFileWatcherRefresh(setupFileWatcher);
  registerBookHandlers();
  registerLibraryHandlers();
  void checkForAppUpdates();

  void queueLibraryScan().catch((error) => {
    console.error("[Main] Background library scan failed:", error);
  });

  if (!initialAuthRoute && startupFile) {
    console.log("[Main] Startup file detected, waiting for window to load...");
    win?.webContents.once("did-finish-load", () => {
      console.log("[Main] Window loaded, now calling handleFileArg...");
      handleFileArg(startupFile);
    });
  }
});
