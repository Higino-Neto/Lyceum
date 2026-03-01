// ─── Tipos compartilhados entre os componentes de leitura ───────────────────

export type TimerState = "idle" | "running" | "paused" | "finished";

export type ReadingCategory =
  | "fiction"
  | "math"
  | "science"
  | "philosophy"
  | "computer_science"
  | "languages"
  | "other";

export interface SessionTimerData {
  id: string;
  sourceName: string;
  date: Date;
  category: string;
  spentTimeMinutes: number;
}

export interface SessionPdfData {
  totalWords: number;
  initialPage: number;
  finalPage: number;
}

/** Estado completo de uma sessão de leitura */
export interface ReadingSession {
  id: string;
  sourceName: string;
  date: Date;
  category: string;
  spentTimeMinutes: number;
  totalWords: number;
  initialPage: number;
  finalPage: number;
}

export interface DocumentRecord {
  id: number;
  title: string;
  filePath: string;
  fileHash: string;
  currentPage: number;
  currentZoom: number | null;
  currentScroll: number | null;
  annotations: string | null;
  thumbnailPath: string | null;
  numPages: number;
  createdAt: string;
  lastOpenedAt: string;
  isSynced: number;
  category: string | null;
}

/** Props do modal de sessão concluída */
export interface CompletedSessionModalData {
  id: string;
  sourceName: string;
  date: Date;
  category: string;
  spentTimeMinutes: number;
  totalWords: string;
  initialPage: string;
  finalPage: string;
  totalBookPages: number;
  // Dados históricos opcionais
  historicalAvgWpm?: number;
  historicalAvgPagesPerSession?: number;
  bookTotalPagesRead?: number;
  bookTotalMinutes?: number;
  sessionRank?: number;
  totalSessions?: number;
}

export const CATEGORY_LABELS: Record<string, string> = {
  math: "Matemática",
  science: "Ciências",
  history: "História",
  fiction: "Ficção",
  philosophy: "Filosofia",
  technology: "Tecnologia",
  biography: "Biografia",
  self_help: "Autoajuda",
  computer_science: "Computação/Docs",
  languages: "Idioma em Aprendizado",
  other: "Outro",
};

export const EMPTY_SESSION: ReadingSession = {
  id: "",
  sourceName: "",
  date: new Date(),
  category: "",
  spentTimeMinutes: 0,
  totalWords: 0,
  initialPage: 0,
  finalPage: 0,
};
