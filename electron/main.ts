import electron, {
  type BrowserWindow as ElectronBrowserWindow,
  type BrowserWindowConstructorOptions,
} from "electron";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { getCachedPdfBuffer } from "./services/pdfCache";
import { getPdfSource, registerPdfSource } from "./services/pdfSourceRegistry";
import { parseByteRange } from "./services/pdfByteRange";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import chokidar, { FSWatcher } from "chokidar";
import {
  addDocument,
  getAllDocuments,
  getAllDocumentCategories,
  getCategoryRepository,
  getDocumentMetadataRepository,
  getDocumentByHash,
  getLastDocument,
  getDocumentsForBackup,
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
  deleteDocument,
  getDocumentByPath,
  getSourceFolders,
} from "./local-database";
import {
  isPdfMagicBytesValid,
  toStoredMetadata,
  THUMBNAIL_EXTENSIONS,
  extractEpubMetadata as extractEpubMetadataMainThread,
  extractPdfMetadata as extractMetadataMainThread,
  getPdfPageCount as getPdfPageCountMainThread,
  validateCbzFile as validateCbzFileMainThread,
  type BookFileType,
} from "./services/document-processing";
import { deleteBook, openReadableFile as openReadableDocument } from "./services/document-service";
import { isReaderSupportedPath, ReaderOpenError } from "./services/reader-format-service";
import { WATCHER_IGNORED_PATTERNS } from "./services/watcher-ignores";
import { registerLinuxRecommendedApp } from "./services/linux-file-associations";
import {
  checkProcessingWorkers,
  convertPdfToEpubInWorker,
  convertViaLyceumInWorker,
  disposeProcessingWorkers,
  generateThumbnailInWorker,
  getProcessingWorkerDiagnostics,
  hashFile,
  inspectBookFile,
  exportOutputPreviewInWorker,
  runPdfToolInWorker,
  validateAzw3InWorker,
  buildApnxInWorker,
  inspectKindleBookInWorker,
  writeBookMetadataInWorker,
} from "./workers/processingClient";
import { registerPdfToolsHandlers } from "./handlers/pdf-tools.handler";
import {
  KINDLE_EMAIL_ACCEPTED_FORMATS,
  KindleEmailService,
  type KindleEmailSaveInput,
} from "./services/kindle-email";
import type { EditableBookMetadata } from "./services/book-file-metadata";
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
import { getCandidateVolumeRoots } from "./services/removable-volumes";
import { copyFileToVolume, ensureLinuxMtpEreadersMounted } from "./services/linux-mtp";
import { stripKindleFileNameSuffix, type KindleBookDetails } from "./services/kindle-book-inspector";
import { installContentSecurityPolicy } from "./app/security-policy";
import { resolvePdfjsAssetPath } from "./app/pdfjs-asset-path";
import { registerHabitHandlers } from "./handlers/habits.handler";
import { createSqliteHabitRepository } from "./infrastructure/sqlite-habit-repository";
import { registerBackupHandlers } from "./handlers/backup.handler";
import { registerCategoryHandlers } from "./handlers/categories.handler";
import { registerDictionaryHandlers } from "./handlers/dictionary.handler";
import { registerLanguageLearningHandlers } from "./handlers/language-learning.handler";
import { createSqliteLanguageLearningRepository } from "./infrastructure/sqlite-language-learning-repository";
import { createLanguageLearningService, translateWithMyMemory } from "./services/language-learning-service";
import { createLearningBackupService, isLearningBackup, type LearningBackupService } from "./services/language-learning-backup";
import { registerPlatformHandlers } from "./handlers/platform.handler";
import { registerWindowHandlers } from "./handlers/windows.handler";
import { registerFileDialogHandlers } from "./handlers/file-dialogs.handler";

const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  nativeTheme,
  protocol,
} = electron;
const require = createRequire(import.meta.url);

// Chromium only picks the system keyring on GNOME/KDE. On other Linux sessions
// (Hyprland, Sway, i3...) it falls back to "basic_text" and safeStorage reports
// encryption as unavailable, even when a Secret Service (gnome-keyring,
// KeePassXC) is running. Ask for libsecret explicitly; when no Secret Service
// exists, safeStorage still reports unavailable and secrets stay in memory only.
if (
  process.platform === "linux" &&
  !app.commandLine.hasSwitch("password-store") &&
  !/kde|plasma/i.test(`${process.env.XDG_CURRENT_DESKTOP || ""} ${process.env.DESKTOP_SESSION || ""}`)
) {
  app.commandLine.appendSwitch("password-store", "gnome-libsecret");
}
const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const __filename = fileURLToPath(import.meta.url);
Object.defineProperty(globalThis, "__filename", {
  value: __filename,
  configurable: true,
});
import crypto from "crypto";
import fs from "fs";
import { PDFDocument } from "pdf-lib";
import type { BookFormat, LyceumConversionOptions } from "../src/lib/lyceum";
import type { DocumentRecord, LibraryListResult } from "../src/types/LibraryTypes";
import type { ConversionRequestOptions } from "./workers/protocol";
import { OutputPreviewService, cleanupStaleOutputPreviews, type OutputPreviewRequest } from "./services/output-preview";
import { DARK_TOKENS, LIGHT_TOKENS } from "../src/theme/tokens";

const LYCEUM_KINDLE_AZW3_PROFILE = "kf8-tbs-20260627";
const bundledFromChunksDir = path.basename(__dirname) === "chunks";
process.env.APP_ROOT = path.resolve(__dirname, bundledFromChunksDir ? "../.." : "..");

const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
const PRELOAD_ENTRY = path.join(MAIN_DIST, "preload.cjs");
const APP_PROTOCOL = "lyceum";
const PASSWORD_RESET_DEEP_LINK_ROUTE = "/reset-password";
// NSIS/Windows may not preserve custom command-line arguments when launching
// the installed executable. The release smoke test sets this environment flag
// explicitly, while retaining the argument for local manual invocations.
const isPackagedSmokeTest = process.env.LYCEUM_SMOKE_TEST === "1" || process.argv.includes("--lyceum-smoke-test");

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, "public")
  : RENDERER_DIST;

if (VITE_DEV_SERVER_URL) {
  app.commandLine.appendSwitch(
    "disk-cache-dir",
    path.join(os.tmpdir(), `lyceum-electron-dev-cache-${process.pid}`),
  );
  app.commandLine.appendSwitch("disable-gpu-shader-disk-cache");
}

if (isPackagedSmokeTest) {
  // GitHub's Windows runner has no interactive desktop. These must be set
  // before app.whenReady() so Electron can initialize the real main process.
  app.commandLine.appendSwitch("headless");
  app.commandLine.appendSwitch("disable-gpu");
  app.commandLine.appendSwitch("disable-software-rasterizer");
}

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

function logStartupEnvironment() {
  const worker = getProcessingWorkerDiagnostics();
  console.info("[Startup] Environment", {
    platform: process.platform,
    arch: process.arch,
    release: process.getSystemVersion?.(),
    appVersion: app.getVersion(),
    packaged: app.isPackaged,
    resourcesPath: process.resourcesPath,
    appRoot: process.env.APP_ROOT,
    mainDirectory: __dirname,
    insideAsar: __dirname.includes("app.asar"),
    worker,
  });
}

function runStartupStage<T>(name: string, task: () => T): T {
  const startedAt = Date.now();
  try {
    return task();
  } finally {
    console.info(`[Startup] ${name} completed`, { durationMs: Date.now() - startedAt });
  }
}

function runBackgroundStartupStage(name: string, task: () => unknown | Promise<unknown>) {
  const startedAt = Date.now();
  void Promise.resolve()
    .then(task)
    .then(() => console.info(`[Startup] ${name} completed`, { durationMs: Date.now() - startedAt }))
    .catch((error) => console.error(`[Startup] ${name} failed`, {
      durationMs: Date.now() - startedAt,
      error,
    }));
}

async function showOpenDialogSafe(options: Electron.OpenDialogOptions): Promise<Electron.OpenDialogReturnValue> {
  try {
    return await dialog.showOpenDialog(options);
  } catch (error) {
    console.warn("[DesktopIntegration] File dialog is unavailable; continuing without it.", {
      platform: process.platform,
      desktop: process.env.XDG_CURRENT_DESKTOP || process.env.DESKTOP_SESSION || undefined,
      error: error instanceof Error ? error.message : String(error),
    });
    return { canceled: true, filePaths: [] };
  }
}

async function inspectOnWorker(filePath: string, fileType: "pdf" | "epub" | "cbz") {
  try {
    return await inspectBookFile({ filePath, fileType, includeMetadata: true });
  } catch (error) {
    console.warn(`[Main] Worker inspection failed for ${path.basename(filePath)}; using fallback:`, error);
    return null;
  }
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

async function openReadableFile(filePath: string) {
  const document = await openReadableDocument(filePath);
  if (document?.fileType === "pdf") registerPdfSource(document.fileHash, document.readerPath);
  return document;
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
  await ensureLinuxMtpEreadersMounted();
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

interface UsbBookDetailsCacheEntry {
  details: KindleBookDetails;
  thumbnailPath?: string;
}

const USB_KINDLE_TYPES = new Set(["kfx", "azw3", "azw", "mobi", "prc"]);
const USB_DETAILS_CACHE_FILE = () => path.join(app.getPath("userData"), "usb-book-details.json");
let usbDetailsCache: Map<string, UsbBookDetailsCacheEntry> | null = null;
let usbDetailsCacheSaveTimer: NodeJS.Timeout | null = null;

function getUsbDetailsCache(): Map<string, UsbBookDetailsCacheEntry> {
  if (usbDetailsCache) return usbDetailsCache;
  try {
    const raw = JSON.parse(fs.readFileSync(USB_DETAILS_CACHE_FILE(), "utf8")) as Record<string, UsbBookDetailsCacheEntry>;
    usbDetailsCache = new Map(Object.entries(raw));
  } catch {
    usbDetailsCache = new Map();
  }
  return usbDetailsCache;
}

function scheduleUsbDetailsCacheSave() {
  if (usbDetailsCacheSaveTimer) clearTimeout(usbDetailsCacheSaveTimer);
  usbDetailsCacheSaveTimer = setTimeout(() => {
    usbDetailsCacheSaveTimer = null;
    try {
      const entries = Array.from(getUsbDetailsCache().entries()).slice(-2000);
      fs.writeFileSync(USB_DETAILS_CACHE_FILE(), JSON.stringify(Object.fromEntries(entries)));
    } catch (error) {
      console.warn("[usb] Nao foi possivel salvar o cache de metadados:", error);
    }
  }, 1000);
}

/**
 * Title, author and cover of a book on a device. Keyed by path + mtime + size,
 * so each book is read once (reading over MTP is slow) and re-read only when
 * the file changes. Thumbnails live in THUMBNAILS_DIR to be served by thumb://.
 */
async function getUsbBookDetails(
  filePath: string,
  fileType: string,
  stats: fs.Stats,
  device: UsbDeviceInfo,
): Promise<UsbBookDetailsCacheEntry> {
  const key = crypto.createHash("sha256").update(`usb-book|${filePath}|${stats.mtimeMs}|${stats.size}`).digest("hex");
  const cache = getUsbDetailsCache();
  const cached = cache.get(key);
  if (cached && (!cached.thumbnailPath || fs.existsSync(cached.thumbnailPath))) return cached;

  let entry: UsbBookDetailsCacheEntry = { details: {} };
  try {
    if (USB_KINDLE_TYPES.has(fileType)) {
      const result = await inspectKindleBookInWorker({
        filePath,
        fileType,
        thumbnailPath: path.join(THUMBNAILS_DIR(), `${key}-thumb.webp`),
        deviceRoot: device.rootPath,
      });
      if (result.error) console.warn(`[usb] ${path.basename(filePath)}: ${result.error}`);
      entry = { details: result.details, thumbnailPath: result.thumbnailPath };
    } else if (fileType === "pdf" || fileType === "epub" || fileType === "cbz") {
      const thumbnailPath = await generateThumbnailInWorker(filePath, key, {
        thumbnailsDir: THUMBNAILS_DIR(),
        fileType: fileType as BookFileType,
        logPrefix: "[usb]",
      });
      entry = { details: {}, thumbnailPath: thumbnailPath || undefined };
    }
  } catch (error) {
    console.warn(`[usb] Falha ao ler ${path.basename(filePath)}:`, error);
  }
  cache.set(key, entry);
  scheduleUsbDetailsCacheSave();
  return entry;
}

async function buildUsbBookRecord(
  filePath: string,
  device: UsbDeviceInfo,
  index: number,
): Promise<DocumentRecord> {
  const stats = fs.statSync(filePath);
  const fileType = getUsbBookFileType(filePath) || "pdf";
  const inferred = parseTitleAndAuthorFromFileName(
    path.join(path.dirname(filePath), stripKindleFileNameSuffix(path.basename(filePath, path.extname(filePath))) + path.extname(filePath)),
  );
  const sidecar = getUsbBookSidecarMetadata(filePath);
  const embedded = await getUsbBookDetails(filePath, fileType, stats, device);
  const fileHash = `usb:${crypto
    .createHash("sha1")
    .update(`${device.id}|${filePath}|${stats.mtimeMs}|${stats.size}`)
    .digest("hex")}`;

  const details = embedded.details;
  let title = details.title || sidecar.title || inferred.title;
  let author = details.author || sidecar.author || inferred.author;
  let publisher: string | null = details.publisher || null;
  let publishDate: string | null = details.publishDate || null;
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
    thumbnailPath: embedded.thumbnailPath || null,
    numPages,
    createdAt: timestamp,
    lastOpenedAt: timestamp,
    isSynced: 0,
    category: device.name,
    isFavorite: 0,
    rating: 0,
    notes: null,
    author,
    description: details.description || `Encontrado em ${device.name}`,
    isbn: details.isbn || null,
    publisher,
    publishDate,
    language: details.language || null,
    identifier: null,
    asin: details.asin || null,
    subject: details.subject || null,
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
  await ensureLinuxMtpEreadersMounted();
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

  const sort = query.sort || "recent_desc";
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
  await ensureLinuxMtpEreadersMounted();
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
  onProgress?: KindleSendProgress,
  signal?: AbortSignal,
): Promise<{
  success: boolean;
  filePath?: string;
  fileName?: string;
  converted?: boolean;
  sourceFormat?: BookFormat;
  error?: string;
  /** APNX sidecar to copy into "<book>.sdr/" on the device. */
  apnxPath?: string;
  pageCount?: number;
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

    onProgress?.(0.5, "Gerando numeros de pagina");
    const apnx = await buildDirectCopyApnx(localPath, sourceFormat, book, options);
    return {
      success: true,
      filePath: localPath,
      fileName: createKindleOutputName(book, sourceFormat),
      converted: false,
      sourceFormat,
      ...apnx,
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
          identifier: kindleIdentity,
          asin: kindleIdentity,
        }
      : {
          title,
          author: book.author || undefined,
          // Never default: the book's own language (from its OPF) must win
          // over a guess, or a French book is tagged Portuguese on the Kindle.
          language: book.language || undefined,
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
    conversionOptions: {
      ...options.conversionOptions,
      pageNumbers: options.pageNumbers || options.conversionOptions?.pageNumbers || "auto",
      printPageCount: book.printPageCount || undefined,
      charsPerPage: options.charsPerPage ?? options.conversionOptions?.charsPerPage,
    },
  }, {
    signal,
    onProgress: onProgress
      ? (progress, message) => onProgress(0.05 + Math.min(1, Math.max(0, progress)) * 0.75, message || "Convertendo para AZW3")
      : undefined,
  });

  // The AZW3 exporter writes "<name>.apnx" next to the book when it has pages.
  const apnxPath = outputPath.replace(/\.[^./\\]+$/, "") + ".apnx";
  const hasApnx = options.pageNumbers !== "off" && fs.existsSync(apnxPath);

  return {
    success: true,
    filePath: outputPath,
    fileName: outputName,
    converted: true,
    sourceFormat,
    ...(hasApnx ? { apnxPath, pageCount: readApnxPageCount(apnxPath) } : {}),
  };
}

/** Page count stored in an APNX file (u16 right after the content header). */
function readApnxPageCount(apnxPath: string): number | undefined {
  try {
    const data = fs.readFileSync(apnxPath);
    const contentLength = data.readUInt32BE(8);
    return data.readUInt16BE(12 + contentLength + 4);
  } catch {
    return undefined;
  }
}

/**
 * MOBI/AZW3 files copied as-is get an estimated APNX (or one spread over the
 * print page count when known), generated off the main thread.
 */
async function buildDirectCopyApnx(
  localPath: string,
  sourceFormat: BookFormat,
  book: KindleSendBookInput,
  options: KindleSendOptions,
): Promise<{ apnxPath?: string; pageCount?: number }> {
  if (options.pageNumbers === "off") return {};
  if (!["azw3", "azw", "mobi", "prc"].includes(sourceFormat)) return {};
  // A book converted by Lyceum already has its real pages next to it.
  const sidecar = localPath.replace(/\.[^./\\]+$/, "") + ".apnx";
  if (fs.existsSync(sidecar)) return { apnxPath: sidecar, pageCount: readApnxPageCount(sidecar) };
  const { fileHash } = await hashFile(localPath);
  const tempDir = path.join(app.getPath("temp"), "lyceum-kindle-apnx", fileHash);
  fs.mkdirSync(tempDir, { recursive: true });
  const result = await buildApnxInWorker({
    filePath: localPath,
    outputPath: path.join(tempDir, "book.apnx"),
    pageNumbers: options.pageNumbers || "auto",
    printPageCount: book.printPageCount || undefined,
    charsPerPage: options.charsPerPage,
  });
  if (!result.written || !result.apnxPath) {
    if (result.reason && result.reason !== "disabled") console.warn("[kindle] APNX nao gerado:", result.reason);
    return {};
  }
  return { apnxPath: result.apnxPath, pageCount: result.pageCount };
}

const KINDLE_LIBRARY_THUMB_TYPES = new Set(["azw3", "azw", "mobi", "prc"]);

/**
 * Sideloaded books typed EBOK get a blank 60x40 placeholder in the Kindle
 * library: the device expects to download the cover from Amazon. Writing our
 * own system/thumbnails/thumbnail_<ASIN>_<TYPE>_portrait.jpg shows the real
 * cover (the book's embedded cover, falling back to the Lyceum cover).
 */
async function copyKindleLibraryThumbnail(
  bookPath: string,
  fileHash: string,
  device: KindleSendDevice,
): Promise<boolean> {
  if (device.kind !== "kindle") return false;
  const fileType = path.extname(bookPath).slice(1).toLowerCase();
  if (!KINDLE_LIBRARY_THUMB_TYPES.has(fileType)) return false;
  const lyceumCover = getDocumentByHash(fileHash)?.thumbnailPath || undefined;
  const tempDir = path.join(app.getPath("temp"), "lyceum-kindle-thumbs");
  fs.mkdirSync(tempDir, { recursive: true });
  const result = await inspectKindleBookInWorker({
    filePath: bookPath,
    fileType,
    thumbnailPath: path.join(tempDir, `${crypto.randomUUID()}.jpg`),
    thumbnailFormat: "kindle-jpeg",
    fallbackImagePath: lyceumCover,
  });
  const asin = result.details.asin;
  if (!result.thumbnailPath || !asin) return false;
  try {
    const name = `thumbnail_${asin}_${result.details.cdeType || "EBOK"}_portrait.jpg`;
    if (device.isMtp) {
      return (await copyFileToMtpKindle(result.thumbnailPath, device, ["system", "thumbnails"], name)).success;
    }
    if (!device.rootPath) return false;
    const dir = path.join(device.rootPath, "system", "thumbnails");
    if (!fs.existsSync(dir)) return false;
    const target = path.join(dir, name);
    // The Kindle may already have written its placeholder: replace it.
    if (fs.existsSync(target)) fs.rmSync(target, { force: true });
    await copyFileToVolume(result.thumbnailPath, target);
    return true;
  } finally {
    fs.rmSync(result.thumbnailPath, { force: true });
  }
}

/**
 * Copies an APNX sidecar to "<dir>/<book>.sdr/<book>.apnx", next to the book
 * that was just copied (using its final, possibly de-duplicated, name).
 */
async function copyApnxToKindle(
  apnxPath: string,
  device: KindleSendDevice,
  destinationParts: string[],
  bookOutputName: string,
): Promise<boolean> {
  const baseName = bookOutputName.replace(/\.[^.]+$/, "");
  const sdrParts = [...destinationParts, `${baseName}.sdr`];
  if (device.isMtp) {
    const copied = await copyFileToMtpKindle(apnxPath, device, sdrParts, `${baseName}.apnx`);
    return copied.success;
  }
  if (!device.rootPath) return false;
  const sdrDir = path.join(device.rootPath, ...sdrParts);
  fs.mkdirSync(sdrDir, { recursive: true });
  const target = path.join(sdrDir, `${baseName}.apnx`);
  await copyFileToVolume(apnxPath, target);
  return fs.statSync(target).size === fs.statSync(apnxPath).size;
}

/**
 * Prepares a book for Amazon's Send to Kindle e-mail service, which accepts
 * EPUB and PDF but rejects AZW3/MOBI/KFX. CBZ is converted to PDF (keeps the
 * page images intact). The library metadata is stamped into a temporary copy so
 * the Kindle shows the edited title/author even if the original file could not
 * be updated.
 */
async function prepareKindleEmailFile(
  book: KindleSendBookInput,
  options: { preserveMetadata?: boolean; convertPdfToEpub?: boolean },
): Promise<{ success: boolean; filePath?: string; fileName?: string; converted?: boolean; error?: string }> {
  const { inferBookFormatFromPath } = await loadLyceumConversionModule();
  const localPath = book.filePath.startsWith("::") ? await copyWindowsMtpBookToTemp(book.filePath) : book.filePath;
  if (!localPath || !fs.existsSync(localPath)) {
    return { success: false, error: "Arquivo de origem nao encontrado no disco" };
  }
  const sourceFormat = inferBookFormatFromPath(localPath) || book.fileType || null;
  if (!sourceFormat) return { success: false, error: "Formato de origem nao suportado" };

  const targetFormat: BookFormat | null =
    sourceFormat === "cbz" ? "pdf"
      : sourceFormat === "pdf" && options.convertPdfToEpub ? "epub"
        : sourceFormat === "txt" || sourceFormat === "html" ? "epub"
          : null;
  if (!targetFormat && !KINDLE_EMAIL_ACCEPTED_FORMATS.has(sourceFormat)) {
    return {
      success: false,
      error: `A Amazon nao aceita ${sourceFormat.toUpperCase()} por e-mail. Use o envio por USB.`,
    };
  }

  const { fileHash: sourceHash } = await hashFile(localPath);
  const tempDir = path.join(app.getPath("temp"), "lyceum-kindle-email", sourceHash.slice(0, 16));
  await fs.promises.mkdir(tempDir, { recursive: true });
  const outputFormat = targetFormat || sourceFormat;
  const fileName = createKindleOutputName(book, outputFormat);
  const outputPath = path.join(tempDir, fileName);
  const title = path.basename(book.title || book.fileName || localPath, path.extname(book.title || book.fileName || localPath));
  const metadata: EditableBookMetadata = {
    title,
    author: book.author || undefined,
    language: book.language || undefined,
    publisher: book.publisher || undefined,
    description: book.description || undefined,
    publishDate: book.publishDate || undefined,
    identifier: book.identifier || undefined,
    asin: book.asin || undefined,
    subject: book.subject || undefined,
    series: book.series || undefined,
    seriesIndex: book.seriesIndex || undefined,
    authorSort: book.authorSort || undefined,
    titleSort: book.titleSort || undefined,
  };

  if (targetFormat) {
    await convertViaLyceumInWorker({
      sourcePath: localPath,
      sourceFormat,
      targetFormat,
      packageRoot: getLyceumPackageRoot(`kindle-email-${sourceHash}`),
      outputPath,
      // The source's own language wins when the library has none.
      metadata: options.preserveMetadata === false ? { title } : metadata,
      pdfImageTempDir: sourceFormat === "pdf"
        ? path.join(app.getPath("temp"), "lyceum-pdf-to-epub-images", `kindle-email-${sourceHash}`)
        : undefined,
    });
    return { success: true, filePath: outputPath, fileName, converted: true };
  }

  await fs.promises.copyFile(localPath, outputPath);
  if (options.preserveMetadata !== false && (sourceFormat === "epub" || sourceFormat === "pdf")) {
    const stamped = await writeBookMetadataInWorker(outputPath, sourceFormat, metadata).catch(() => null);
    if (stamped && !stamped.fileResult.success) {
      console.warn("[kindle:email] Could not stamp metadata on the copy:", stamped.fileResult.error);
    }
  }
  return { success: true, filePath: outputPath, fileName, converted: false };
}

async function copyFileToFilesystemKindle(
  sourcePath: string,
  device: KindleSendDevice,
  destinationParts: string[],
  fileName: string,
): Promise<KindleCopyResult> {
  if (!device.rootPath) {
    return { success: false, error: "Dispositivo USB invalido" };
  }

  const targetDir = path.join(device.rootPath, ...destinationParts);
  fs.mkdirSync(targetDir, { recursive: true });
  const targetPath = getUniquePathInDir(targetDir, fileName);
  const sourceBytes = fs.statSync(sourcePath).size;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      // gvfs MTP mounts (newer Kindles on Linux) need `gio copy`.
      await copyFileToVolume(sourcePath, targetPath);
    } catch (error) {
      if (attempt === 2) {
        return {
          success: false,
          verified: false,
          bytes: sourceBytes,
          error: error instanceof Error ? error.message : "Falha ao copiar para o dispositivo",
        };
      }
      continue;
    }
    const copiedBytes = fs.existsSync(targetPath) ? fs.statSync(targetPath).size : -1;
    if (copiedBytes === sourceBytes) {
      return {
        success: true,
        outputPath: targetPath,
        outputName: path.basename(targetPath),
        verified: true,
        bytes: copiedBytes,
        note: attempt > 1 ? "Copia verificada apos uma nova tentativa" : "Copia verificada por tamanho",
      };
    }

    if (fs.existsSync(targetPath)) fs.unlinkSync(targetPath);
  }

  return {
    success: false,
    verified: false,
    bytes: sourceBytes,
    error: "A copia terminou com tamanho diferente do arquivo de origem",
  };
}

async function copyFileToMtpKindle(
  sourcePath: string,
  device: KindleSendDevice,
  destinationParts: string[],
  fileName: string,
): Promise<KindleCopyResult> {
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
$staleBefore = (Get-Date).AddDays(-7)
if (Test-Path -LiteralPath $stagingRoot) {
  Get-ChildItem -LiteralPath $stagingRoot -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.LastWriteTime -lt $staleBefore } |
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
}
$stagingDir = Join-Path $stagingRoot ([System.Guid]::NewGuid().ToString('N'))
$stagingPath = Join-Path $stagingDir $targetName
$expectedBytes = [int64](Get-Item -LiteralPath $sourcePath).Length

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
      $reportedBytes = 0
      try { $reportedBytes = [int64]$child.Size } catch { $reportedBytes = 0 }
      if ($reportedBytes -gt 0 -and $reportedBytes -ne $expectedBytes) { continue }
      $verified = $reportedBytes -eq $expectedBytes
      if ($verified -and (Test-Path -LiteralPath $stagingDir)) {
        Remove-Item -LiteralPath $stagingDir -Recurse -Force
      }
      [PSCustomObject]@{
        success = $true
        outputName = $targetName
        outputPath = (($parts -join '/') + '/' + $targetName)
        verified = $verified
        bytes = $expectedBytes
        note = $(if ($verified) { 'Copia MTP verificada por tamanho' } else { 'Arquivo detectado no Kindle; tamanho MTP indisponivel. Staging preservado para concluir a transferencia.' })
      } | ConvertTo-Json -Depth 4
      exit
    }
  }
  Start-Sleep -Milliseconds 250
}

[PSCustomObject]@{ success = $false; error = 'Tempo esgotado ao confirmar a copia no Kindle; staging preservado para diagnostico' } | ConvertTo-Json -Depth 4
`;

  try {
    const result = (await runWindowsPowerShellJson<{
      success: boolean;
      outputName?: string;
      outputPath?: string;
      verified?: boolean;
      bytes?: number;
      note?: string;
      error?: string;
    }>(script))[0];

    if (result?.success) {
      return {
        success: true,
        outputName: result.outputName,
        outputPath: result.outputPath,
        verified: result.verified === true,
        bytes: result.bytes,
        note: result.note,
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

/**
 * Converts (when needed) and copies one book to the Kindle with its page
 * numbers (APNX) and library cover, reporting each step.
 */
async function sendOneBookToKindle(
  book: KindleSendBookInput,
  device: KindleSendDevice,
  options: KindleSendOptions,
  onProgress?: KindleSendProgress,
  signal?: AbortSignal,
): Promise<KindleSendItemResult> {
  try {
    onProgress?.(0.02, "Preparando");
    const prepared = await prepareKindleTransferFile(book, options, onProgress, signal);
    if (!prepared.success || !prepared.filePath || !prepared.fileName) {
      return {
        fileHash: book.fileHash,
        title: book.title,
        success: false,
        status: "error",
        error: prepared.error || "Nao foi possivel preparar o arquivo",
      };
    }

    onProgress?.(0.84, "Copiando para o Kindle");
    const destinationParts = getKindleDestinationParts(options, book.author);
    const copied = device.isMtp
      ? await copyFileToMtpKindle(prepared.filePath, device, destinationParts, prepared.fileName)
      : await copyFileToFilesystemKindle(prepared.filePath, device, destinationParts, prepared.fileName);

    if (copied.success) {
      onProgress?.(0.92, "Gravando capa na biblioteca do Kindle");
      try {
        await copyKindleLibraryThumbnail(prepared.filePath, book.fileHash, device);
      } catch (error) {
        console.warn("[kindle] Falha ao gravar a capa na biblioteca do Kindle:", error);
      }
    }

    let pageCount: number | undefined;
    if (copied.success && prepared.apnxPath) {
      onProgress?.(0.96, "Gravando numeros de pagina");
      try {
        const apnxCopied = await copyApnxToKindle(
          prepared.apnxPath,
          device,
          destinationParts,
          copied.outputName || prepared.fileName,
        );
        if (apnxCopied) pageCount = prepared.pageCount;
      } catch (error) {
        console.warn("[kindle] Falha ao copiar APNX:", error);
      }
    }

    onProgress?.(1, copied.success ? "Enviado" : copied.error || "Falha ao copiar");
    return {
      fileHash: book.fileHash,
      title: book.title,
      success: copied.success,
      status: copied.success
        ? prepared.converted ? "converted" : "sent"
        : "error",
      sourcePath: prepared.filePath,
      outputName: copied.outputName,
      outputPath: copied.outputPath,
      verified: copied.verified,
      bytes: copied.bytes,
      note: copied.note,
      error: copied.error,
      pageCount,
    };
  } catch (error) {
    if (signal?.aborted) {
      return { fileHash: book.fileHash, title: book.title, success: false, status: "error", error: "Envio cancelado" };
    }
    return {
      fileHash: book.fileHash,
      title: book.title,
      success: false,
      status: "error",
      error: error instanceof Error ? error.message : "Erro ao enviar para o Kindle",
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
    results.push(await sendOneBookToKindle(book, device, options, (progress, message) => {
      win?.webContents.send("kindle:send-progress", { fileHash: book.fileHash, progress, message });
    }));
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
        updateMetadata(fileHash, toStoredMetadata(metadata));
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
          updateMetadata(fileHash, toStoredMetadata(metadata));
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
    ignorePermissionErrors: true,
    ignored: WATCHER_IGNORED_PATTERNS,
    awaitWriteFinish: {
      stabilityThreshold: 1000,
      pollInterval: 100,
    },
  });

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

function ensureLibraryFolder() {
  const libraryPath = path.join(app.getPath("userData"), "library");

  if (!fs.existsSync(libraryPath)) {
    fs.mkdirSync(libraryPath, { recursive: true });
  }

  return libraryPath;
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
  /** Page count of the printed edition, used to spread real page numbers. */
  printPageCount?: number | null;
}

type KindlePageNumbersMode = "auto" | "off" | "target-count" | "estimate";

interface KindleSendOptions {
  deviceId?: string;
  books: KindleSendBookInput[];
  convertToAzw3?: boolean;
  preserveMetadata?: boolean;
  organizeByAuthor?: boolean;
  destination?: string;
  /** Real page numbers via an APNX sidecar (USB only). Defaults to "auto". */
  pageNumbers?: KindlePageNumbersMode;
  charsPerPage?: number;
  /** Conversion settings (layout, images, fonts, Kindle profile...) for AZW3 output. */
  conversionOptions?: LyceumConversionOptions;
}

type KindleSendProgress = (progress: number, message: string) => void;

interface KindleSendItemResult {
  fileHash: string;
  title: string;
  success: boolean;
  status: "sent" | "converted" | "skipped" | "error";
  outputName?: string;
  outputPath?: string;
  sourcePath?: string;
  verified?: boolean;
  bytes?: number;
  note?: string;
  error?: string;
  /** Number of real pages written to the APNX sidecar, when one was copied. */
  pageCount?: number;
}

interface KindleCopyResult {
  success: boolean;
  outputPath?: string;
  outputName?: string;
  verified?: boolean;
  bytes?: number;
  note?: string;
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
  // The Electron protocol bypasses Vite. In dev, serve the Lyceum overlay
  // from source so the iframe sees the same edits as the HMR watcher.
  return resolvePdfjsAssetPath(
    requestUrl,
    getPdfjsAssetsRoot(),
    VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT!, "resources", "pdfjs-viewer") : undefined,
  );
}

async function createLocalFileResponse(
  filePath: string,
  contentType?: string,
  request?: Electron.ProtocolRequest,
): Promise<Electron.ProtocolResponse> {
  const headers: Record<string, string> = {};
  if (contentType) {
    headers["Content-Type"] = contentType;
  }
  headers["Access-Control-Allow-Origin"] = "*";
  headers["Cross-Origin-Resource-Policy"] = "cross-origin";
  headers["Accept-Ranges"] = "bytes";

  const stat = await fs.promises.stat(filePath);
  const fileSize = stat.size;
  headers["Content-Length"] = String(fileSize);

  const rangeHeader = Object.entries(request?.headers ?? {}).find(
    ([name]) => name.toLowerCase() === "range",
  )?.[1] ?? null;
  const range = parseByteRange(rangeHeader, fileSize);
  if (range && "unsatisfiable" in range) {
    return {
      statusCode: 416,
      headers: { "Content-Range": `bytes */${fileSize}` },
    };
  }
  if (range && "start" in range) {
    const { start, end } = range;

    const length = end - start + 1;
    headers["Content-Range"] = `bytes ${start}-${end}/${fileSize}`;
    headers["Content-Length"] = String(length);
    return { data: fs.createReadStream(filePath, { start, end }), statusCode: 206, headers };
  }

  return { data: fs.createReadStream(filePath), statusCode: 200, headers };
}

async function handlePdfjsAssetRequest(request: Electron.ProtocolRequest): Promise<Electron.ProtocolResponse> {
  const assetPath = getPdfjsAssetPath(request.url);
  if (!assetPath || !fs.existsSync(assetPath) || !fs.statSync(assetPath).isFile()) {
    return { statusCode: 404 };
  }

  const contentType =
    PDFJS_ASSET_MIME_TYPES[path.extname(assetPath).toLowerCase()] ||
    "application/octet-stream";

  const response = await createLocalFileResponse(assetPath, contentType, request);
  if (VITE_DEV_SERVER_URL) {
    response.headers = { ...response.headers, "Cache-Control": "no-store" };
  }
  return response;
}

const lyceumPdfDiagnosed = new Set<string>();

function parseLyceumPdfHash(requestUrl: string): string | null {
  try {
    const url = new URL(requestUrl);
    const candidate = path.basename(url.pathname, ".pdf") || url.hostname.replace(/\.pdf$/i, "");
    return SHA256_HEX_PATTERN.test(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

async function handleLyceumPdfRequest(request: Electron.ProtocolRequest): Promise<Electron.ProtocolResponse> {
  const fileHash = parseLyceumPdfHash(request.url);
  if (!fileHash) {
    return { statusCode: 404 };
  }

  if (!lyceumPdfDiagnosed.has(fileHash)) {
    const openedPath = getPdfSource(fileHash);
    const sourcePreview = openedPath && fs.existsSync(openedPath)
      ? `path=${openedPath}`
      : `buffer=${getCachedPdfBuffer(fileHash)?.length ?? "none"}`;
    try {
      const size = openedPath && fs.existsSync(openedPath)
        ? (await fs.promises.stat(openedPath)).size
        : getCachedPdfBuffer(fileHash)?.length ?? 0;
      console.warn(`[lyceum-pdf] serving ${fileHash} -> ${sourcePreview} size=${size}`);
    } catch {
      console.warn(`[lyceum-pdf] serving ${fileHash} -> ${sourcePreview} size=unknown`);
    }
    lyceumPdfDiagnosed.add(fileHash);
  }

  const openedPath = getPdfSource(fileHash);
  if (openedPath && fs.existsSync(openedPath)) {
    return createLocalFileResponse(openedPath, "application/pdf", request);
  }

  // Fall back to an in-memory buffer when no source file is available.
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

  return { statusCode: 404 };
}

function createLocalFileResponseFromBuffer(
  buffer: Buffer,
  request?: Electron.ProtocolRequest,
): Electron.ProtocolResponse {
  const headers: Record<string, string> = {
    "Content-Type": "application/pdf",
    "Access-Control-Allow-Origin": "*",
    "Cross-Origin-Resource-Policy": "cross-origin",
    "Accept-Ranges": "bytes",
  };

  const fileSize = buffer.length;
  headers["Content-Length"] = String(fileSize);

  const rangeHeader = Object.entries(request?.headers ?? {}).find(
    ([name]) => name.toLowerCase() === "range",
  )?.[1] ?? null;
  const range = parseByteRange(rangeHeader, fileSize);
  if (range && "unsatisfiable" in range) {
    return {
      statusCode: 416,
      headers: { "Content-Range": `bytes */${fileSize}` },
    };
  }
  if (range && "start" in range) {
    const { start, end } = range;

    const slice = buffer.subarray(start, end + 1);
    headers["Content-Range"] = `bytes ${start}-${end}/${fileSize}`;
    headers["Content-Length"] = String(slice.length);
    return { data: slice, statusCode: 206, headers };
  }

  return { data: buffer, statusCode: 200, headers };
}

/**
 * Native window chrome color used before the renderer paints. The preference
 * can be "system", so the main process can only follow the OS here; explicit
 * light/dark preferences are applied by the pre-paint script in index.html.
 */
function getWindowBackgroundColor(): string {
  return nativeTheme.shouldUseDarkColors
    ? DARK_TOKENS.background
    : LIGHT_TOKENS.background;
}

function createAppWindow(
  options: BrowserWindowConstructorOptions = {}
) {
  const appWindow = new BrowserWindow({
    icon: process.platform === "win32"
      ? path.join(process.env.VITE_PUBLIC!, "logo.ico")
      : path.join(process.env.APP_ROOT!, "resources", "icons", "icon_512.png"),
    title: "Lyceum",
    width: 1200,
    height: 800,
    frame: false,
    show: false,
    backgroundColor: getWindowBackgroundColor(),
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

  // Avoid showing an unpainted window (dark default flashing for light users).
  // If the event never fires (for example a load failure), the window stays
  // hidden so the error can be diagnosed without a blank frame.
  appWindow.once("ready-to-show", () => {
    appWindow.show();
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
    const isDefaultApp = (process as NodeJS.Process & { defaultApp?: boolean }).defaultApp;
    if (isDefaultApp && process.argv.length >= 2) {
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

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
    setUpdateWindow(null);
  }
});

let languageLearningBackups: LearningBackupService | null = null;

app.on("before-quit", () => {
  languageLearningBackups?.flush();
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



ipcMain.handle("usb:get-devices", async () => {
  await ensureLinuxMtpEreadersMounted();
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

    if (!isReaderSupportedPath(localPath)) {
      return { success: false, error: "Invalid file type" };
    }

    const document = await openReadableFile(localPath);
    if (!document) {
      return { success: false, error: "NÃ£o foi possÃ­vel abrir o livro" };
    }

    return document.fileType === "pdf"
      ? { success: true, ...document, fileBuffer: undefined }
      : { success: true, ...document };
  } catch (error) {
    console.error("[usb:open-book] Error:", error);
    if (error instanceof ReaderOpenError) {
      return { success: false, error: error.message, readerErrorCode: error.code };
    }
    return { success: false, error: String(error) };
  }
});

ipcMain.handle("kindle:list-devices", async () => {
  return listKindleSendDevices();
});

/** Sanitizes renderer-provided Kindle send options. */
function normalizeKindleSendOptions(options: KindleSendOptions): KindleSendOptions {
  return {
    ...options,
    books: Array.isArray(options?.books) ? options.books : [],
    convertToAzw3: options?.convertToAzw3 ?? true,
    preserveMetadata: options?.preserveMetadata ?? true,
    organizeByAuthor: options?.organizeByAuthor ?? false,
    destination: options?.destination || "documents/Downloads",
    pageNumbers: (["auto", "off", "target-count", "estimate"] as const).includes(options?.pageNumbers as KindlePageNumbersMode)
      ? options.pageNumbers
      : "auto",
    charsPerPage: Number.isFinite(options?.charsPerPage) && Number(options.charsPerPage) >= 200
      ? Math.min(20000, Math.floor(Number(options.charsPerPage)))
      : undefined,
    conversionOptions: options?.conversionOptions && typeof options.conversionOptions === "object"
      ? options.conversionOptions
      : undefined,
  };
}

ipcMain.handle("kindle:send-books", async (_, options: KindleSendOptions) => {
  return sendBooksToKindle(normalizeKindleSendOptions(options));
});

/**
 * Sends one book from the conversion queue: progress goes to the same
 * "conversion:progress" channel (by jobId) and "conversion:cancel" stops it.
 */
ipcMain.handle("kindle:send-book", async (_, input: KindleSendOptions & { book: KindleSendBookInput; jobId?: string }) => {
  const options = normalizeKindleSendOptions({ ...input, books: input?.book ? [input.book] : [] });
  const book = options.books[0];
  if (!book) return { success: false, error: "Livro invalido" };
  const devices = await listKindleSendDevices();
  const device = options.deviceId ? devices.find((candidate) => candidate.id === options.deviceId) : devices[0];
  if (!device) return { success: false, error: "Nenhum Kindle conectado foi encontrado" };
  const onProgress: KindleSendProgress | undefined = input.jobId
    ? (progress, message) => win?.webContents.send("conversion:progress", { jobId: input.jobId, progress, message })
    : undefined;
  return runTrackedConversion(input.jobId, async (signal) => {
    const result = await sendOneBookToKindle(book, device, options, onProgress, signal);
    win?.webContents.send("usb:devices-updated");
    return { ...result, deviceName: device.name };
  });
});

let kindleEmailService: KindleEmailService | null = null;
function getKindleEmailService() {
  kindleEmailService ||= new KindleEmailService(
    path.join(app.getPath("userData"), "kindle-email.json"),
    electron.safeStorage,
    {
      // Desktop OAuth client from Google Cloud Console; a runtime env var overrides the build-time value.
      googleClient: {
        clientId: process.env.LYCEUM_GOOGLE_CLIENT_ID || import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID || "",
        clientSecret: process.env.LYCEUM_GOOGLE_CLIENT_SECRET || import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_SECRET || undefined,
      },
      openBrowser: (url) => electron.shell.openExternal(url),
    },
  );
  return kindleEmailService;
}

ipcMain.handle("kindle-email:connect-google", async () => {
  try {
    return { success: true, config: await getKindleEmailService().connectGoogle() };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Falha no login com Google" };
  } finally {
    // Bring Lyceum back to the front after the browser round-trip.
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  }
});

ipcMain.handle("kindle-email:cancel-google", () => {
  getKindleEmailService().cancelGoogleSignIn();
  return true;
});

ipcMain.handle("kindle-email:disconnect-google", async () => {
  return getKindleEmailService().disconnectGoogle();
});

ipcMain.handle("kindle-email:get-config", () => getKindleEmailService().getPublicConfig());

ipcMain.handle("kindle-email:save-config", (_, input: KindleEmailSaveInput) => {
  try {
    return { success: true, config: getKindleEmailService().save(input || {}) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Configuracao invalida" };
  }
});

ipcMain.handle("kindle-email:verify", async () => {
  try {
    await getKindleEmailService().verify();
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Falha ao conectar" };
  }
});

ipcMain.handle("kindle-email:send-books", async (_, options: {
  books: KindleSendBookInput[];
  preserveMetadata?: boolean;
  convertPdfToEpub?: boolean;
}) => {
  const service = getKindleEmailService();
  const books = Array.isArray(options?.books) ? options.books : [];
  const results: KindleSendItemResult[] = [];
  for (const book of books) {
    try {
      const prepared = await prepareKindleEmailFile(book, {
        preserveMetadata: options?.preserveMetadata ?? true,
        convertPdfToEpub: options?.convertPdfToEpub ?? false,
      });
      if (!prepared.success || !prepared.filePath || !prepared.fileName) {
        results.push({ fileHash: book.fileHash, title: book.title, success: false, status: "error", error: prepared.error || "Nao foi possivel preparar o arquivo" });
        continue;
      }
      const sent = await service.send({ filePath: prepared.filePath, fileName: prepared.fileName }, book.title);
      results.push({
        fileHash: book.fileHash,
        title: book.title,
        success: true,
        status: prepared.converted ? "converted" : "sent",
        outputName: prepared.fileName,
        bytes: sent.bytes,
        verified: false,
        note: "E-mail aceito pelo servidor. A Amazon entrega no Kindle em alguns minutos se o remetente estiver aprovado.",
      });
    } catch (error) {
      results.push({
        fileHash: book.fileHash,
        title: book.title,
        success: false,
        status: "error",
        error: error instanceof Error ? error.message : "Erro ao enviar por e-mail",
      });
    }
  }
  const sent = results.filter((result) => result.success).length;
  return { success: sent === results.length, sent, failed: results.length - sent, results };
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
        language: doc.language || undefined, // the source file's own language wins
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
    // Files picked from disk are not in the library: carry the metadata embedded in the file itself.
    const { readBookMetadataFromFile } = await import("./services/book-file-metadata");
    const embedded = await readBookMetadataFromFile(localPath, sourceFormat);
    outputPath = createUniqueConvertedPath(localPath, targetFormat, requestOptions.outputDirectory);
    const conversionPayload = {
      sourcePath: localPath,
      sourceFormat,
      targetFormat,
      packageRoot: getLyceumPackageRoot(sourceHash),
      outputPath,
      metadata: {
        ...embedded,
        title: embedded.title || sourceTitle,
        language: embedded.language || undefined,
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

let outputPreviewService: OutputPreviewService | null = null;
let outputPreviewSessionReady = false;
function getOutputPreviewService() {
  outputPreviewService ||= new OutputPreviewService({
    tempRoot: app.getPath("temp"),
    exportSlice: (input) => exportOutputPreviewInWorker(input),
    printHtmlToPdf: (htmlPath, outputPath, options) => printHtmlToPdf(htmlPath, outputPath, options),
    renderPdfPage: async (pdfPath, pageNumber) => {
      const response = await runPdfToolInWorker({ operation: "thumbnails", input: { filePath: pdfPath, pages: [pageNumber], maxDimension: 1600 } });
      const thumb = response.operation === "thumbnails" ? response.thumbnails[0] : undefined;
      return thumb ? { dataUrl: thumb.dataUrl, width: thumb.width, height: thumb.height } : null;
    },
    createWindow: (options) => new BrowserWindow(options),
    previewSession: () => {
      // Book content is rendered offline: anything that is not a local file is blocked.
      const previewSession = electron.session.fromPartition("lyceum-output-preview");
      if (!outputPreviewSessionReady) {
        outputPreviewSessionReady = true;
        previewSession.webRequest.onBeforeRequest((details, callback) => {
          callback({ cancel: !/^(file|data|blob):/i.test(details.url) });
        });
      }
      return previewSession;
    },
  });
  return outputPreviewService;
}

async function runOutputPreview(sourcePath: string, sourceFormat: BookFormat, request: OutputPreviewRequest) {
  try {
    const safeRequest: OutputPreviewRequest = {
      targetFormat: request?.targetFormat,
      conversionOptions: request?.conversionOptions,
      segmentIndex: Math.max(0, Math.floor(Number(request?.segmentIndex) || 0)),
      page: Math.max(1, Math.floor(Number(request?.page) || 1)),
    };
    return { success: true, preview: await getOutputPreviewService().render(sourcePath, sourceFormat, safeRequest) };
  } catch (error) {
    console.error("[conversion:output-preview] Error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Erro ao gerar a pre-visualizacao" };
  }
}

ipcMain.handle("conversion:output-preview", async (_, fileHash: string, request: OutputPreviewRequest) => {
  const { inferBookFormatFromPath } = await loadLyceumConversionModule();
  const doc = getDocumentByHash(fileHash);
  if (!doc?.filePath || !fs.existsSync(doc.filePath)) {
    return { success: false, error: "Arquivo de origem nao encontrado no disco" };
  }
  const sourceFormat = inferBookFormatFromPath(doc.filePath) || doc.fileType;
  return runOutputPreview(doc.filePath, sourceFormat, request);
});

ipcMain.handle("conversion:output-preview-file", async (_, filePath: string, request: OutputPreviewRequest) => {
  const { inferBookFormatFromPath } = await loadLyceumConversionModule();
  const localPath = filePath.startsWith("::") ? await copyWindowsMtpBookToTemp(filePath) : filePath;
  if (!localPath || !fs.existsSync(localPath)) {
    return { success: false, error: "Arquivo de origem nao encontrado no disco" };
  }
  const sourceFormat = inferBookFormatFromPath(localPath);
  if (!sourceFormat) return { success: false, error: "Formato de origem nao suportado" };
  return runOutputPreview(localPath, sourceFormat, request);
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
        language: doc.language || undefined, // the source file's own language wins
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

ipcMain.handle("dialog:import-pdf", async (_, targetFolder: string | null, action: "move" | "copy" = "copy") => {
  const result = await showOpenDialogSafe({
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





registerFileDialogHandlers(ipcMain, {
  showOpenDialog: showOpenDialogSafe,
  openReadableFile,
});

registerPdfToolsHandlers(ipcMain, {
  showOpenDialog: showOpenDialogSafe,
  showSaveDialog: (options) => (win ? dialog.showSaveDialog(win, options) : dialog.showSaveDialog(options)),
  runPdfTool: (request, onProgress) => runPdfToolInWorker(request, { onProgress }),
  sendProgress: (payload) => win?.webContents.send("tools:progress", payload),
  showInFolder: (filePath) => electron.shell.showItemInFolder(filePath),
});

registerWindowHandlers(ipcMain, {
  resolveWindow: (event) => BrowserWindow.fromWebContents(event.sender),
  openReadingWindow: (data) => {
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
  },
});





ipcMain.handle("auth:consume-deep-link-params", () => {
  const params = pendingAuthDeepLinkParams;
  pendingAuthDeepLinkParams = null;
  return params;
});

registerUpdateHandlers(ipcMain);

const gotTheLock = app.requestSingleInstanceLock();

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

    const filePath = commandLine.slice(1).find(
      (arg) => !arg.startsWith("-") && isReaderSupportedPath(arg)
    );
    
    console.log("[Main] File path found from commandLine:", filePath);
    
    if (filePath && fs.existsSync(filePath)) {
      const document = await openReadableFile(filePath);
      if (document) {
        win?.webContents.send("file-opened", document.fileType === "pdf"
          ? { ...document, fileBuffer: undefined }
          : document);
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

  if (!isReaderSupportedPath(filePath)) {
    console.error("[Main] Invalid file type:", filePath);
    return;
  }

  console.log("[Main] Opening file:", { filePath });

  try {
    const document = await openReadableFile(filePath);
    if (document) {
      win.webContents.send("file-opened", document.fileType === "pdf"
        ? { ...document, fileBuffer: undefined }
        : document);
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
  (arg) => !arg.startsWith("-") && isReaderSupportedPath(arg)
);

protocol.registerSchemesAsPrivileged([
  { scheme: "thumb", privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
  { scheme: "img-preview", privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
  { scheme: "lyceum-pdfjs", privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
  { scheme: "lyceum-pdf", privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
  { scheme: "pdf-resource", privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
]);

app.on("child-process-gone", (_, details) => {
  const level = details.reason === "clean-exit" ? "info" : "warn";
  console[level]("[Main] Electron child process exited", {
    type: details.type,
    reason: details.reason,
    exitCode: details.exitCode,
    serviceName: details.serviceName,
    name: details.name,
  });
});

function parseThumbUrlHash(requestUrl: string): string {
  const url = new URL(requestUrl);
  return (url.hostname || url.pathname.replace(/^\/+/, "")).replace(/\/+$/, "");
}

function registerStreamProtocol(
  scheme: string,
  handler: (request: Electron.ProtocolRequest) => Electron.ProtocolResponse | Promise<Electron.ProtocolResponse>,
) {
  const registered = protocol.registerStreamProtocol(scheme, (request, callback) => {
    void Promise.resolve(handler(request))
      .then(callback)
      .catch((error) => {
        console.error(`[Protocol] ${scheme}: request failed`, error);
        callback({ statusCode: 500 });
      });
  });
  if (!registered) {
    throw new Error(`Could not register ${scheme}: protocol handler`);
  }
}

async function runPackagedSmokeTest() {
  const reportPath = process.env.LYCEUM_SMOKE_TEST_REPORT;
  const smokeStageTimeoutMs = 20_000;
  const report: Record<string, unknown> = {
    platform: process.platform,
    arch: process.arch,
    osVersion: process.getSystemVersion?.(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    appVersion: app.getVersion(),
  };

  const writeReport = () => {
    if (reportPath) fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  };

  const runSmokeStage = async <T>(name: string, task: () => Promise<T> | T): Promise<T> => {
    report.stage = name;
    writeReport();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        Promise.resolve().then(task),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new Error(`Smoke test stage timed out after ${smokeStageTimeoutMs} ms: ${name}`)), smokeStageTimeoutMs);
        }),
      ]);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  };

  try {
    await runSmokeStage("SQLite", () => runStartupStage("SQLite smoke test", () => initDatabase()));
    await runSmokeStage("library directory", () => runStartupStage("library directory smoke test", () => ensureLibraryFolder()));

    type SmokeSharp = ((input: {
      create: { width: number; height: number; channels: 4; background: string };
    }) => { png(): { toBuffer(): Promise<Buffer> } }) & { versions?: Record<string, string> };
    const sharp = require("sharp") as SmokeSharp;
    await runSmokeStage("sharp", () => sharp({
      create: { width: 1, height: 1, channels: 4, background: "#000000" },
    }).png().toBuffer());
    report.sharp = sharp.versions?.sharp ?? "loaded";

    await runSmokeStage("canvas", async () => {
      const canvas = await import("@napi-rs/canvas");
      canvas.createCanvas(1, 1).getContext("2d").fillRect(0, 0, 1, 1);
    });
    report.canvas = "loaded";

    await runSmokeStage("processing worker health check", () => checkProcessingWorkers());
    const smokePdfPath = path.join(app.getPath("userData"), "compatibility-smoke.pdf");
    const smokePdf = await PDFDocument.create();
    smokePdf.addPage([72, 72]);
    fs.writeFileSync(smokePdfPath, await smokePdf.save());
    try {
      const inspection = await runSmokeStage("processing worker PDF inspection", () => inspectBookFile({
        filePath: smokePdfPath,
        fileType: "pdf",
        includeMetadata: true,
      }));
      if (inspection.numPages !== 1) {
        throw new Error(`PDF worker returned ${inspection.numPages} pages for the one-page smoke document`);
      }
    } finally {
      fs.rmSync(smokePdfPath, { force: true });
    }
    report.processingWorker = "ready (PDF parsed)";
    report.ok = true;
    delete report.stage;
    console.info("[SmokeTest] PASS", report);
    writeReport();
    disposeProcessingWorkers();
    app.exit(0);
  } catch (error) {
    report.ok = false;
    report.error = error instanceof Error ? error.stack ?? error.message : String(error);
    console.error("[SmokeTest] FAIL", report);
    writeReport();
    disposeProcessingWorkers();
    app.exit(1);
  }
}

app.whenReady().then(async () => {
  logStartupEnvironment();

  void registerLinuxRecommendedApp();
  void cleanupStaleOutputPreviews(app.getPath("temp"));

  if (isPackagedSmokeTest) {
    await runPackagedSmokeTest();
    return;
  }

  registerStreamProtocol("thumb", (request) => {
    const fileHash = parseThumbUrlHash(request.url);
    if (!SHA256_HEX_PATTERN.test(fileHash)) {
      return { statusCode: 404 };
    }
    const thumbPath = findThumbnailByHash(THUMBNAILS_DIR(), fileHash);
    if (!thumbPath) {
      return { statusCode: 404 };
    }
    return createLocalFileResponse(thumbPath);
  });

  registerStreamProtocol("img-preview", async (request) => {
    try {
      const filePath = decodeURIComponent(request.url.replace(/^img-preview:/, ""));
      const ext = path.extname(filePath).toLowerCase();
      const mimeType = ext === ".png" ? "image/png" : ext === ".gif" ? "image/gif" : "image/jpeg";
      return await createLocalFileResponse(filePath, mimeType, request);
    } catch {
      return { statusCode: 404 };
    }
  });

  registerStreamProtocol("lyceum-pdfjs", (request) => {
    return handlePdfjsAssetRequest(request);
  });

  registerStreamProtocol("lyceum-pdf", (request) => {
    return handleLyceumPdfRequest(request);
  });

  registerStreamProtocol("pdf-resource", async (request) => {
    const filePath = request.url.replace(/^pdf-resource:\/\//, "");
    return createLocalFileResponse(decodeURIComponent(filePath), "application/pdf", request);
  });

  installContentSecurityPolicy(
    electron.session.defaultSession,
    Boolean(process.env.VITE_DEV_SERVER_URL),
  );

  const database = runStartupStage("SQLite initialization", () => initDatabase());
  runStartupStage("library directory initialization", () => ensureLibraryFolder());
  const habits = createSqliteHabitRepository(database);
  const categories = getCategoryRepository();
  registerHabitHandlers(ipcMain, habits);
  registerBackupHandlers(ipcMain, habits, categories, {
    listDocuments: getDocumentsForBackup,
    listDocumentCategories: getAllDocumentCategories,
  });
  registerCategoryHandlers(ipcMain, categories);
  registerDictionaryHandlers(ipcMain, () => win);
  const languageLearning = createLanguageLearningService({
    cacheRoot: path.join(app.getPath("userData"), "language-learning"),
    emitProgress: (payload) => win?.webContents.send("language-learning:progress", payload),
  });
  const languageLearningRepository = createSqliteLanguageLearningRepository(database);
  const learningBackups = createLearningBackupService({
    repository: languageLearningRepository,
    directory: path.join(app.getPath("userData"), "language-learning", "backups"),
  });
  languageLearningBackups = learningBackups;
  registerLanguageLearningHandlers(ipcMain, {
    repository: languageLearningRepository,
    openDocument: (input) => languageLearning.openDocument(input),
    translateOnline: (text, source, target) => translateWithMyMemory(text, source, target),
    onUserDataChanged: (userId) => learningBackups.schedule(userId),
    backups: {
      async exportToFile(userId) {
        const options = {
          defaultPath: `lyceum-vocabulary-${new Date().toISOString().slice(0, 10)}.json`,
          filters: [{ name: "JSON", extensions: ["json"] }],
        };
        const result = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options);
        if (result.canceled || !result.filePath) return null;
        await fs.promises.writeFile(result.filePath, JSON.stringify(languageLearningRepository.exportUserData(userId), null, 2), "utf8");
        return result.filePath;
      },
      async importFromFile(userId) {
        const options = {
          properties: ["openFile" as const],
          defaultPath: learningBackups.directoryFor(userId),
          filters: [{ name: "JSON", extensions: ["json"] }],
        };
        const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options);
        const file = result.filePaths[0];
        if (result.canceled || !file) return null;
        const parsed: unknown = JSON.parse(await fs.promises.readFile(file, "utf8"));
        if (!isLearningBackup(parsed)) throw new Error("INVALID_BACKUP");
        learningBackups.writeBackup(userId);
        return languageLearningRepository.importUserData(userId, parsed);
      },
      async openFolder(userId) {
        const directory = learningBackups.directoryFor(userId);
        await fs.promises.mkdir(directory, { recursive: true });
        await electron.shell.openPath(directory);
      },
    },
  });
  registerPlatformHandlers(ipcMain);

  // Keep native window backgrounds aligned when the OS theme changes while a
  // window is open. The renderer owns explicit light/dark preferences.
  nativeTheme.on("updated", () => {
    const background = getWindowBackgroundColor();
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) {
        window.setBackgroundColor(background);
      }
    }
  });

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
  registerBookHandlers(getDocumentMetadataRepository());
  registerLibraryHandlers();

  const startSecondaryServices = () => setImmediate(() => {
    runBackgroundStartupStage("processing worker health check", async () => {
      await checkProcessingWorkers();
      console.info("[Main] Processing workers are ready.");
    });
    runBackgroundStartupStage("file watcher", () => setupFileWatcher());
    runBackgroundStartupStage("USB watcher", () => setupUsbDeviceWatcher());
    runBackgroundStartupStage("category import", () => categories.importFromFolders());
    runBackgroundStartupStage("update check", () => checkForAppUpdates());
    runBackgroundStartupStage("library scan", () => queueLibraryScan());
  });

  if (win?.webContents.isLoading()) win.webContents.once("did-finish-load", startSecondaryServices);
  else startSecondaryServices();

  if (!initialAuthRoute && startupFile) {
    console.log("[Main] Startup file detected, waiting for window to load...");
    win?.webContents.once("did-finish-load", () => {
      console.log("[Main] Window loaded, now calling handleFileArg...");
      handleFileArg(startupFile);
    });
  }
});
