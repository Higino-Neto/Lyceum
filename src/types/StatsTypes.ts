/** Aggregated local-library statistics for the dashboard (desktop only). */
export interface LibraryBookRef {
  id: number;
  fileHash: string;
  title: string;
  author: string | null;
  currentPage: number;
  numPages: number;
  lastOpenedAt: string | null;
  thumbnailPath: string | null;
  bookId: string | null;
  readingStatus: string | null;
}

export interface LibrarySummary {
  totals: {
    books: number;
    pages: number;
    bytes: number;
    pagesRead: number;
    backlogPages: number;
    finished: number;
    favorites: number;
    annotations: number;
  };
  status: {
    none: number;
    wantToRead: number;
    reading: number;
    paused: number;
    read: number;
    started: number;
  };
  formats: Array<{ format: string; count: number }>;
  subjects: Array<{ name: string; count: number }>;
  authors: Array<{ name: string; count: number; pages: number }>;
  /** Last 24 months, oldest first. */
  growth: Array<{ month: string; added: number; finished: number }>;
  ratings: Array<{ rating: number; count: number }>;
  topRated: Array<{ id: number; title: string; author: string | null; rating: number }>;
  finishedThisYear: number;
  continueReading: LibraryBookRef[];
  forgotten: LibraryBookRef[];
  inProgress: LibraryBookRef[];
  recentAnnotations: Array<{
    kind: "concept" | "learning";
    id: string;
    title: string;
    note: string | null;
    bookTitle: string | null;
    createdAt: string;
  }>;
  conceptGraph: {
    nodes: Array<{ id: string; title: string; bookId: string; bookTitle: string; degree: number }>;
    edges: Array<{ source: string; target: string; kind: "relation" | "shared" }>;
  };
}

export interface LanguageStateCount {
  language: string;
  known: number;
  learning: number;
  unknown: number;
  ignored: number;
  lookups: number;
  reviewItems: number;
}

export interface LanguageSummary {
  languages: LanguageStateCount[];
  /** Daily totals per language, oldest first. */
  history: Array<{ date: string; language: string; known: number; learning: number }>;
  stubborn: Array<{ language: string; key: string; label: string; translation: string | null; lookupCount: number; state: string }>;
  coverage: Array<{
    documentId: string;
    fileHash: string | null;
    title: string;
    language: string;
    /** Share (0–1) of non-ignored word occurrences whose lemma is known. */
    known: number;
    learning: number;
    tokens: number;
    lexemes: number;
  }>;
  wordsByBook: Array<{ documentId: string; title: string; language: string; saved: number }>;
}
