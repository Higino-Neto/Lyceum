import type {
  MobileBook,
  MobileFileType,
  MobileHabit,
  MobileLibraryState,
  MobileReadingSession,
  MobileStats,
} from "./types";

const STORAGE_KEY = "lyceum_mobile_mvp_state";

const todayKey = () => new Date().toISOString().slice(0, 10);

function makeId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

const demoHabits: MobileHabit[] = [
  {
    id: "habit_daily_reading",
    name: "Ler por 20 minutos",
    targetDays: [0, 1, 2, 3, 4, 5, 6],
    completions: {},
  },
  {
    id: "habit_review_notes",
    name: "Revisar notas",
    targetDays: [1, 3, 5],
    completions: {},
  },
];

const demoImportedAt = "2026-05-18T09:41:00.000Z";

const demoBooks: MobileBook[] = [
  {
    id: "demo_crime_castigo",
    title: "Crime e Castigo",
    author: "Fiodor Dostoievski",
    fileName: "crime-e-castigo.pdf",
    fileType: "pdf",
    thumbnailKey: "crime-castigo",
    importedAt: demoImportedAt,
    currentPage: 210,
    totalPages: 552,
    minutesRead: 128,
    category: "Literatura",
    isFavorite: false,
    notes: "",
  },
  {
    id: "demo_essencialismo",
    title: "Essencialismo",
    author: "Greg McKeown",
    fileName: "essencialismo.pdf",
    fileType: "pdf",
    thumbnailKey: "essencialismo",
    importedAt: demoImportedAt,
    currentPage: 174,
    totalPages: 268,
    minutesRead: 74,
    category: "Produtividade",
    isFavorite: false,
    notes: "",
  },
  {
    id: "demo_habitos_atomicos",
    title: "Habitos Atomicos",
    author: "James Clear",
    fileName: "habitos-atomicos.epub",
    fileType: "epub",
    thumbnailKey: "habitos-atomicos",
    importedAt: demoImportedAt,
    currentPage: 234,
    totalPages: 325,
    minutesRead: 96,
    category: "Desenvolvimento",
    isFavorite: false,
    notes: "",
  },
  {
    id: "demo_sapiens",
    title: "Sapiens",
    author: "Yuval Noah Harari",
    fileName: "sapiens.pdf",
    fileType: "pdf",
    thumbnailKey: "sapiens",
    importedAt: demoImportedAt,
    currentPage: 108,
    totalPages: 450,
    minutesRead: 112,
    category: "Historia",
    isFavorite: false,
    notes: "",
  },
  {
    id: "demo_pai_rico",
    title: "Pai Rico, Pai Pobre",
    author: "Robert Kiyosaki",
    fileName: "pai-rico-pai-pobre.pdf",
    fileType: "pdf",
    thumbnailKey: "pai-rico",
    importedAt: demoImportedAt,
    currentPage: 81,
    totalPages: 336,
    minutesRead: 60,
    category: "Financas",
    isFavorite: false,
    notes: "",
  },
  {
    id: "demo_mindset",
    title: "Mindset",
    author: "Carol S. Dweck",
    fileName: "mindset.epub",
    fileType: "epub",
    thumbnailKey: "mindset",
    importedAt: demoImportedAt,
    currentPage: 96,
    totalPages: 320,
    minutesRead: 22,
    category: "Psicologia",
    isFavorite: false,
    notes: "",
  },
  {
    id: "demo_ultima_supersticao",
    title: "A Ultima Supersticao",
    author: "Daniel Rops",
    fileName: "a-ultima-supersticao.epub",
    fileType: "epub",
    thumbnailKey: "ultima-supersticao",
    importedAt: demoImportedAt,
    currentPage: 108,
    totalPages: 312,
    minutesRead: 140,
    category: "Non-fiction",
    isFavorite: false,
    notes: "",
  },
  {
    id: "demo_common_sense_guide",
    title: "A Common-Sense Guide",
    author: "Jay Wengrow",
    fileName: "a-common-sense-guide.pdf",
    fileType: "pdf",
    thumbnailKey: "common-sense-guide",
    importedAt: demoImportedAt,
    currentPage: 17,
    totalPages: 256,
    minutesRead: 48,
    category: "Technology",
    isFavorite: false,
    notes: "",
  },
  {
    id: "demo_aristotle_revenge",
    title: "Aristotle's Revenge",
    author: "Edward Feser",
    fileName: "aristotles-revenge.epub",
    fileType: "epub",
    thumbnailKey: "aristotles-revenge",
    importedAt: demoImportedAt,
    currentPage: 48,
    totalPages: 300,
    minutesRead: 85,
    category: "Philosophy",
    isFavorite: false,
    notes: "",
  },
  {
    id: "demo_karamazov",
    title: "Os Irmaos Karamazov",
    author: "Fyodor Dostoevsky",
    fileName: "os-irmaos-karamazov.epub",
    fileType: "epub",
    thumbnailKey: "karamazov",
    importedAt: demoImportedAt,
    currentPage: 278,
    totalPages: 818,
    minutesRead: 340,
    category: "Literature",
    isFavorite: true,
    notes: "",
  },
];

export const emptyMobileState = (): MobileLibraryState => ({
  books: demoBooks,
  sessions: [],
  habits: demoHabits,
  selectedBookId: demoBooks[0]?.id,
});

export function loadMobileState(): MobileLibraryState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyMobileState();
    const parsed = JSON.parse(raw) as MobileLibraryState;
    return {
      books: Array.isArray(parsed.books) ? parsed.books : [],
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      habits: Array.isArray(parsed.habits) && parsed.habits.length > 0 ? parsed.habits : demoHabits,
      selectedBookId: parsed.selectedBookId,
    };
  } catch {
    return emptyMobileState();
  }
}

export function saveMobileState(state: MobileLibraryState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Keep the in-memory session alive if browser storage is full.
  }
}

export function inferFileType(file: File): MobileFileType {
  const name = file.name.toLowerCase();
  if (file.type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (name.endsWith(".epub")) return "epub";
  if (file.type === "text/html" || name.endsWith(".html") || name.endsWith(".htm")) return "html";
  if (file.type.startsWith("text/") || name.endsWith(".txt")) return "txt";
  return "other";
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

export function createBookFromFile(file: File, dataUrl: string): MobileBook {
  const id = makeId("book");
  return {
    id,
    title: guessTitle(file.name),
    fileName: file.name,
    fileType: inferFileType(file),
    dataUrl,
    mimeType: file.type || undefined,
    fileSize: file.size,
    thumbnailKey: `generated-${id}`,
    importedAt: new Date().toISOString(),
    currentPage: 1,
    totalPages: 1,
    minutesRead: 0,
    category: "Geral",
    isFavorite: false,
    notes: "",
  };
}

export function createManualBook(title: string, author?: string): MobileBook {
  const id = makeId("book");
  return {
    id,
    title,
    author,
    fileName: `${title}.lyceum`,
    fileType: "other",
    thumbnailKey: `generated-${id}`,
    importedAt: new Date().toISOString(),
    currentPage: 1,
    totalPages: 1,
    minutesRead: 0,
    category: "Geral",
    isFavorite: false,
    notes: "",
  };
}

export function createSession(book: MobileBook, minutes: number, pages: number): MobileReadingSession {
  return {
    id: makeId("session"),
    bookId: book.id,
    title: book.title,
    date: new Date().toISOString(),
    minutes,
    pages,
  };
}

export function createHabit(name: string): MobileHabit {
  return {
    id: makeId("habit"),
    name,
    targetDays: [0, 1, 2, 3, 4, 5, 6],
    completions: {},
  };
}

export function calculateStats(state: MobileLibraryState): MobileStats {
  const pagesRead = state.sessions.reduce((total, session) => total + session.pages, 0);
  const minutesRead = state.sessions.reduce((total, session) => total + session.minutes, 0);
  const today = todayKey();
  const finishedHabitsToday = state.habits.filter((habit) => habit.completions[today]).length;

  return {
    books: state.books.length,
    pagesRead,
    minutesRead,
    currentStreak: calculateReadingStreak(state.sessions),
    finishedHabitsToday,
  };
}

export function calculateReadingStreak(sessions: MobileReadingSession[]) {
  const dates = new Set(sessions.map((session) => session.date.slice(0, 10)));
  let streak = 0;
  const cursor = new Date();

  while (dates.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

export function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
  }).format(new Date(value));
}

export function getTodayKey() {
  return todayKey();
}
