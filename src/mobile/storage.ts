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
    id: "demo_cry_of_honor",
    title: "A Cry of Honor",
    author: "Morgan Rice",
    fileName: "a-cry-of-honor.epub",
    fileType: "epub",
    thumbnailKey: "cry-of-honor",
    importedAt: demoImportedAt,
    currentPage: 18,
    totalPages: 54,
    minutesRead: 128,
    category: "Literature",
    isFavorite: false,
    notes: "",
  },
  {
    id: "demo_dream_of_mortals",
    title: "A dream of mortals",
    author: "Morgan Rice",
    fileName: "a-dream-of-mortals.pdf",
    fileType: "pdf",
    thumbnailKey: "dream-of-mortals",
    importedAt: demoImportedAt,
    currentPage: 31,
    totalPages: 193,
    minutesRead: 74,
    category: "Literature",
    isFavorite: false,
    notes: "",
  },
  {
    id: "demo_fate_of_dragons",
    title: "A Fate of Dragons",
    author: "Morgan Rice",
    fileName: "a-fate-of-dragons.pdf",
    fileType: "pdf",
    thumbnailKey: "fate-of-dragons",
    importedAt: demoImportedAt,
    currentPage: 50,
    totalPages: 147,
    minutesRead: 96,
    category: "Literature",
    isFavorite: false,
    notes: "",
  },
  {
    id: "demo_a_nuvem",
    title: "A nuvem",
    author: "Neal Shusterman",
    fileName: "a-nuvem.pdf",
    fileType: "pdf",
    thumbnailKey: "a-nuvem",
    importedAt: demoImportedAt,
    currentPage: 42,
    totalPages: 364,
    minutesRead: 112,
    category: "Literature",
    isFavorite: false,
    notes: "",
  },
  {
    id: "demo_rule_of_queens",
    title: "A rule of queens",
    author: "Morgan Rice",
    fileName: "a-rule-of-queens.pdf",
    fileType: "pdf",
    thumbnailKey: "rule-of-queens",
    importedAt: demoImportedAt,
    currentPage: 22,
    totalPages: 208,
    minutesRead: 60,
    category: "Literature",
    isFavorite: false,
    notes: "",
  },
  {
    id: "demo_ultima_suposicao",
    title: "A Ultima Suposicao",
    author: "Eli Goldratt",
    fileName: "a-ultima-suposicao.pdf",
    fileType: "pdf",
    thumbnailKey: "ultima-suposicao",
    importedAt: demoImportedAt,
    currentPage: 9,
    totalPages: 128,
    minutesRead: 22,
    category: "Literature",
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
