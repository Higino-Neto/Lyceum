import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import type {
  MobileBook,
  MobileFileType,
  MobileLibraryFolder,
  MobileLibraryState,
  MobileSourceFolder,
} from "./types";

export const MOBILE_SCHEMA_VERSION = 4;
const STORAGE_KEY = "lyceum_mobile_library_state";
const STORAGE_BACKUP_KEY = "lyceum_mobile_library_state_backup";
const LEGACY_STORAGE_KEY = "lyceum_mobile_mvp_state";
const DEFAULT_CATEGORIES = ["Geral", "Ficcao", "Tecnologia", "Filosofia", "Idiomas", "Academico"];

export function makeMobileId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export const emptyMobileState = (): MobileLibraryState => ({
  schemaVersion: MOBILE_SCHEMA_VERSION,
  books: [],
  folders: [],
  sourceFolders: [],
  categories: [...DEFAULT_CATEGORIES],
});

function normalizeBook(value: Partial<MobileBook>): MobileBook | null {
  if (!value.id || !value.fileName || !value.title) return null;
  const fileType = value.fileType;
  if (fileType !== "pdf" && fileType !== "epub" && fileType !== "txt") return null;

  return {
    id: value.id,
    title: value.title,
    author: value.author,
    description: value.description,
    isbn: value.isbn,
    publisher: value.publisher,
    publishDate: value.publishDate,
    fileName: value.fileName,
    fileType,
    dataUrl: value.storagePath ? undefined : value.dataUrl,
    storagePath: value.storagePath,
    mimeType: value.mimeType,
    fileSize: value.fileSize,
    folderId: value.folderId,
    sourceFolderId: value.sourceFolderId,
    sourceRelativePath: value.sourceRelativePath,
    thumbnailKey: value.thumbnailKey,
    thumbnailPath: value.thumbnailPath,
    thumbnailUrl: value.thumbnailUrl,
    thumbnailSource: value.thumbnailSource,
    thumbnailExtractAttempted: value.thumbnailExtractAttempted,
    importedAt: value.importedAt || new Date().toISOString(),
    updatedAt: value.updatedAt,
    lastOpenedAt: value.lastOpenedAt,
    currentPage: Math.max(1, Number(value.currentPage) || 1),
    totalPages: Math.max(1, Number(value.totalPages) || 1),
    progressPercent: Math.min(100, Math.max(0, Number(value.progressPercent) || 0)),
    epubLocation: value.epubLocation,
    textScrollPercent: Math.min(100, Math.max(0, Number(value.textScrollPercent) || 0)),
    currentZoom: value.currentZoom,
    category: value.category || "Geral",
    isFavorite: Boolean(value.isFavorite),
    rating: Math.min(5, Math.max(0, Number(value.rating) || 0)),
    notes: value.notes || "",
  };
}

export function migrateMobileState(value: unknown): MobileLibraryState {
  if (!value || typeof value !== "object") return emptyMobileState();
  const parsed = value as Partial<MobileLibraryState>;
  const books = Array.isArray(parsed.books)
    ? parsed.books
      .map((book) => normalizeBook(book))
      .filter((book): book is MobileBook => Boolean(book))
      .filter((book) => !book.id.startsWith("demo_") || Boolean(book.storagePath || book.dataUrl))
    : [];
  const folderCandidates = Array.isArray(parsed.folders)
    ? parsed.folders.filter((folder): folder is MobileLibraryFolder => Boolean(folder?.id && folder?.name))
    : [];
  const folders = folderCandidates
    .filter((folder, index) => folderCandidates.findIndex((candidate) => candidate.id === folder.id) === index)
    .map((folder) => ({ ...folder, name: folder.name.trim() }))
    .filter((folder) => Boolean(folder.name));
  const folderIds = new Set(folders.map((folder) => folder.id));
  const parentById = new Map(folders.map((folder) => [folder.id, folder.parentId]));
  for (const folder of folders) {
    if (!folder.parentId || !folderIds.has(folder.parentId) || folder.parentId === folder.id) {
      folder.parentId = undefined;
      continue;
    }
    const visited = new Set([folder.id]);
    let parentId: string | undefined = folder.parentId;
    while (parentId) {
      if (visited.has(parentId)) {
        folder.parentId = undefined;
        break;
      }
      visited.add(parentId);
      parentId = parentById.get(parentId);
    }
  }
  const sourceFolders = Array.isArray(parsed.sourceFolders)
    ? parsed.sourceFolders
      .filter((folder): folder is MobileSourceFolder => Boolean(folder?.id && folder?.name))
      .filter((folder, index, items) => items.findIndex((candidate) => candidate.id === folder.id) === index)
    : [];
  const categories = Array.from(new Set([
    ...DEFAULT_CATEGORIES,
    ...(Array.isArray(parsed.categories) ? parsed.categories : []),
    ...books.map((book) => book.category),
  ].filter(Boolean)));

  return {
    schemaVersion: MOBILE_SCHEMA_VERSION,
    books: books.map((book) => ({
      ...book,
      folderId: book.folderId && folderIds.has(book.folderId) ? book.folderId : undefined,
      sourceFolderId: book.sourceFolderId && sourceFolders.some((folder) => folder.id === book.sourceFolderId)
        ? book.sourceFolderId
        : undefined,
    })),
    folders,
    sourceFolders,
    categories,
    selectedBookId: books.some((book) => book.id === parsed.selectedBookId) ? parsed.selectedBookId : books[0]?.id,
    selectedFolderId: folders.some((folder) => folder.id === parsed.selectedFolderId) ? parsed.selectedFolderId : undefined,
  };
}

function parseStoredState(raw: string | null | undefined) {
  if (!raw) return null;
  try {
    return migrateMobileState(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function loadMobileState(): MobileLibraryState {
  try {
    return parseStoredState(localStorage.getItem(STORAGE_KEY))
      || parseStoredState(localStorage.getItem(STORAGE_BACKUP_KEY))
      || parseStoredState(localStorage.getItem(LEGACY_STORAGE_KEY))
      || emptyMobileState();
  } catch {
    return emptyMobileState();
  }
}

export async function hydrateMobileState() {
  if (!Capacitor.isNativePlatform()) return loadMobileState();
  try {
    const [current, backup, legacy] = await Promise.all([
      Preferences.get({ key: STORAGE_KEY }),
      Preferences.get({ key: STORAGE_BACKUP_KEY }),
      Preferences.get({ key: LEGACY_STORAGE_KEY }),
    ]);
    const state = parseStoredState(current.value)
      || parseStoredState(backup.value)
      || parseStoredState(legacy.value)
      || loadMobileState();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return state;
  } catch {
    return loadMobileState();
  }
}

let persistenceQueue: Promise<void> = Promise.resolve();
let lastPersistedState = "";

export function saveMobileState(state: MobileLibraryState): Promise<void> {
  const normalized = migrateMobileState(state);
  const serialized = JSON.stringify(normalized);
  if (serialized === lastPersistedState) return persistenceQueue;
  lastPersistedState = serialized;
  let browserError: unknown;
  try {
    const previous = localStorage.getItem(STORAGE_KEY);
    if (previous && previous !== serialized) localStorage.setItem(STORAGE_BACKUP_KEY, previous);
    localStorage.setItem(STORAGE_KEY, serialized);
  } catch (error) {
    browserError = error;
    // Preferences remains the durable native repository if the web mirror is full.
  }
  if (Capacitor.isNativePlatform()) {
    persistenceQueue = persistenceQueue.catch(() => undefined).then(async () => {
      const previous = await Preferences.get({ key: STORAGE_KEY });
      if (previous.value && previous.value !== serialized) {
        await Preferences.set({ key: STORAGE_BACKUP_KEY, value: previous.value });
      }
      await Preferences.set({ key: STORAGE_KEY, value: serialized });
    }).catch((error) => {
      if (lastPersistedState === serialized) lastPersistedState = "";
      throw error;
    });
  } else if (browserError) {
    lastPersistedState = "";
    return Promise.reject(browserError);
  }
  return persistenceQueue;
}

export function inferFileType(file: File): MobileFileType | null {
  const name = file.name.toLowerCase();
  if (file.type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (file.type === "application/epub+zip" || name.endsWith(".epub")) return "epub";
  if (file.type.startsWith("text/plain") || name.endsWith(".txt")) return "txt";
  return null;
}

export function guessTitle(fileName: string) {
  return fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim() || "Livro importado";
}

export function readFileAsDataUrl(
  file: File,
  options: { onProgress?: (loaded: number, total: number) => void; signal?: AbortSignal } = {},
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const abort = () => reader.abort();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Falha ao ler arquivo"));
    reader.onabort = () => reject(new DOMException("Importacao cancelada", "AbortError"));
    reader.onprogress = (event) => options.onProgress?.(event.loaded, event.lengthComputable ? event.total : file.size);
    reader.onloadend = () => options.signal?.removeEventListener("abort", abort);
    if (options.signal?.aborted) {
      reject(new DOMException("Importacao cancelada", "AbortError"));
      return;
    }
    options.signal?.addEventListener("abort", abort, { once: true });
    reader.readAsDataURL(file);
  });
}

export function createBookFromFile(file: File, dataUrl: string, folderId?: string): MobileBook {
  const fileType = inferFileType(file);
  if (!fileType) throw new Error(`Formato nao suportado: ${file.name}`);
  const id = makeMobileId("book");
  return {
    id,
    title: guessTitle(file.name),
    fileName: file.name,
    fileType,
    dataUrl,
    mimeType: file.type || undefined,
    fileSize: file.size,
    folderId,
    thumbnailKey: `generated-${id}`,
    importedAt: new Date().toISOString(),
    currentPage: 1,
    totalPages: 1,
    progressPercent: 0,
    textScrollPercent: 0,
    category: "Geral",
    isFavorite: false,
    rating: 0,
    notes: "",
  };
}

export function createFolder(name: string, parentId?: string): MobileLibraryFolder {
  return { id: makeMobileId("folder"), name: name.trim(), parentId, createdAt: new Date().toISOString() };
}

export function createSourceFolder(name: string, count: number): MobileSourceFolder {
  const now = new Date().toISOString();
  return { id: makeMobileId("source"), name: name.trim(), createdAt: now, lastImportedAt: now, lastFileCount: count };
}
