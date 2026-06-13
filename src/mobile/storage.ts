import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import type {
  MobileBook,
  MobileFileType,
  MobileHabit,
  MobileLibraryFolder,
  MobileLibraryState,
  MobileReadingSession,
  MobileSourceFolder,
  MobileStats,
} from "./types";

export const MOBILE_SCHEMA_VERSION = 2;
const STORAGE_KEY = "lyceum_mobile_mvp_state";
const DEFAULT_CATEGORIES = ["Geral", "Ficcao", "Tecnologia", "Filosofia", "Idiomas", "Academico"];

const localDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

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
  sessions: [],
  habits: [],
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
    minutesRead: Math.max(0, Number(value.minutesRead) || 0),
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
  const folders = Array.isArray(parsed.folders) ? parsed.folders.filter((folder): folder is MobileLibraryFolder => Boolean(folder?.id && folder?.name)) : [];
  const sourceFolders = Array.isArray(parsed.sourceFolders)
    ? parsed.sourceFolders.filter((folder): folder is MobileSourceFolder => Boolean(folder?.id && folder?.name))
    : [];
  const categories = Array.from(new Set([
    ...DEFAULT_CATEGORIES,
    ...(Array.isArray(parsed.categories) ? parsed.categories : []),
    ...books.map((book) => book.category),
  ].filter(Boolean)));

  return {
    schemaVersion: MOBILE_SCHEMA_VERSION,
    books,
    folders,
    sourceFolders,
    categories,
    sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
    habits: Array.isArray(parsed.habits) ? parsed.habits : [],
    selectedBookId: books.some((book) => book.id === parsed.selectedBookId) ? parsed.selectedBookId : books[0]?.id,
    selectedFolderId: folders.some((folder) => folder.id === parsed.selectedFolderId) ? parsed.selectedFolderId : undefined,
  };
}

export function loadMobileState(): MobileLibraryState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? migrateMobileState(JSON.parse(raw)) : emptyMobileState();
  } catch {
    return emptyMobileState();
  }
}

export async function hydrateMobileState() {
  if (!Capacitor.isNativePlatform()) return loadMobileState();
  try {
    const { value } = await Preferences.get({ key: STORAGE_KEY });
    const state = value ? migrateMobileState(JSON.parse(value)) : loadMobileState();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return state;
  } catch {
    return loadMobileState();
  }
}

export function saveMobileState(state: MobileLibraryState) {
  const normalized = migrateMobileState(state);
  const serialized = JSON.stringify(normalized);
  try {
    localStorage.setItem(STORAGE_KEY, serialized);
  } catch {
    // Preferences remains the durable native repository if the web mirror is full.
  }
  if (Capacitor.isNativePlatform()) {
    void Preferences.set({ key: STORAGE_KEY, value: serialized });
  }
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

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Falha ao ler arquivo"));
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
    minutesRead: 0,
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

export function createSession(
  book: MobileBook,
  minutes: number,
  pages: number,
  details: Partial<MobileReadingSession> = {},
): MobileReadingSession {
  return {
    id: makeMobileId("session"),
    bookId: book.id,
    title: book.title,
    date: new Date().toISOString(),
    minutes,
    pages,
    ...details,
  };
}

export function createHabit(name: string): MobileHabit {
  return { id: makeMobileId("habit"), name, targetDays: [0, 1, 2, 3, 4, 5, 6], completions: {} };
}

export function calculateStats(state: MobileLibraryState): MobileStats {
  const pagesRead = state.sessions.reduce((total, session) => total + session.pages, 0);
  const minutesRead = state.sessions.reduce((total, session) => total + session.minutes, 0);
  const today = localDateKey();
  const finishedHabitsToday = state.habits.filter((habit) => habit.completions[today]).length;
  return { books: state.books.length, pagesRead, minutesRead, currentStreak: calculateReadingStreak(state.sessions), finishedHabitsToday };
}

export function calculateReadingStreak(sessions: MobileReadingSession[]) {
  const dates = new Set(sessions.map((session) => localDateKey(new Date(session.date))));
  let streak = 0;
  const cursor = new Date();
  while (dates.has(localDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(value));
}

export function getTodayKey() {
  return localDateKey();
}
