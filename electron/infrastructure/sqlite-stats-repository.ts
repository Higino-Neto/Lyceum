import type Database from "better-sqlite3";
import type { LanguageSummary, LibraryBookRef, LibrarySummary } from "../../src/types/StatsTypes";

/** Lexicon of an analysed learning document (from its linguistic index). */
export interface LearningDocumentLexicon {
  documentId: string;
  fileHash: string | null;
  title: string;
  language: string;
  tokens: number;
  lexicon: Array<{ key: string; count: number }>;
}

export interface StatsRepository {
  librarySummary(now?: Date): LibrarySummary;
  languageSummary(userId: string, documents: readonly LearningDocumentLexicon[], now?: Date): LanguageSummary;
  /**
   * Records today's known/learning totals per language. Strictly additive:
   * it only writes `ll_knowledge_daily` and never touches vocabulary rows.
   */
  snapshotKnowledge(userId: string, now?: Date): void;
}

function localDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

function tableExists(db: Database.Database, table: string): boolean {
  return db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table) !== undefined;
}

/** Library rows that count as books (files marked "not a book" are excluded). */
const BOOKS = "documents WHERE COALESCE(readingStatus, '') <> 'not_a_book'";

const BOOK_REF_COLUMNS = `id, fileHash, title, author, COALESCE(currentPage, 1) AS currentPage,
  COALESCE(numPages, 0) AS numPages, lastOpenedAt, thumbnailPath, bookId, readingStatus`;

function splitSubjects(value: string): string[] {
  return value
    .split(/[,;|]/)
    .map((part) => part.trim())
    .filter((part) => part.length > 1 && part.length < 60);
}

export function createSqliteStatsRepository(db: Database.Database): StatsRepository {
  const snapshotKnowledge = (userId: string, now = new Date()) => {
    const rows = db.prepare(`
      SELECT language,
             SUM(CASE WHEN state = 'known' THEN 1 ELSE 0 END) AS known,
             SUM(CASE WHEN state = 'learning' THEN 1 ELSE 0 END) AS learning
      FROM ll_knowledge WHERE userId = ? GROUP BY language
    `).all(userId) as Array<{ language: string; known: number; learning: number }>;
    const upsert = db.prepare(`
      INSERT INTO ll_knowledge_daily (userId, language, date, known, learning) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(userId, language, date) DO UPDATE SET known = excluded.known, learning = excluded.learning
    `);
    const date = localDate(now);
    db.transaction(() => {
      for (const row of rows) upsert.run(userId, row.language, date, row.known, row.learning);
    })();
  };

  return {
    snapshotKnowledge,
    librarySummary(now = new Date()) {
      const totals = db.prepare(`
        SELECT COUNT(*) AS books,
               COALESCE(SUM(numPages), 0) AS pages,
               COALESCE(SUM(fileSize), 0) AS bytes,
               COALESCE(SUM(CASE WHEN readingStatus = 'read' THEN numPages
                                 WHEN currentPage > 1 THEN MIN(currentPage, numPages) ELSE 0 END), 0) AS pagesRead,
               COALESCE(SUM(CASE WHEN readingStatus = 'read' THEN 0
                                 ELSE MAX(0, numPages - COALESCE(currentPage, 1)) END), 0) AS backlogPages,
               COALESCE(SUM(CASE WHEN readingStatus = 'read' THEN 1 ELSE 0 END), 0) AS finished,
               COALESCE(SUM(CASE WHEN isFavorite = 1 THEN 1 ELSE 0 END), 0) AS favorites,
               COALESCE(SUM(CASE WHEN readingStatus IN ('reading', 'paused', 'read') OR currentPage > 1 THEN 1 ELSE 0 END), 0) AS started
        FROM ${BOOKS}
      `).get() as LibrarySummary["totals"] & { started: number };

      const statusRows = db.prepare(`SELECT COALESCE(readingStatus, 'none') AS status, COUNT(*) AS count FROM ${BOOKS} GROUP BY 1`).all() as Array<{ status: string; count: number }>;
      const statusCount = (status: string) => statusRows.find((row) => row.status === status)?.count ?? 0;

      const formats = db.prepare(`SELECT LOWER(COALESCE(fileType, 'pdf')) AS format, COUNT(*) AS count FROM ${BOOKS} GROUP BY 1 ORDER BY 2 DESC`).all() as LibrarySummary["formats"];

      const subjectCounts = new Map<string, { name: string; count: number }>();
      for (const row of db.prepare(`SELECT subject FROM ${BOOKS} AND subject IS NOT NULL AND TRIM(subject) <> ''`).all() as Array<{ subject: string }>) {
        // Count each subject once per book even when the metadata repeats it.
        for (const name of new Set(splitSubjects(row.subject).map((part) => part.toLocaleLowerCase()))) {
          const original = splitSubjects(row.subject).find((part) => part.toLocaleLowerCase() === name) ?? name;
          const entry = subjectCounts.get(name) ?? { name: original, count: 0 };
          entry.count += 1;
          subjectCounts.set(name, entry);
        }
      }
      const subjects = [...subjectCounts.values()].sort((a, b) => b.count - a.count).slice(0, 16);

      const authors = db.prepare(`
        SELECT TRIM(author) AS name, COUNT(*) AS count, COALESCE(SUM(numPages), 0) AS pages
        FROM ${BOOKS} AND author IS NOT NULL AND TRIM(author) <> ''
        GROUP BY TRIM(author) COLLATE NOCASE ORDER BY count DESC, pages DESC LIMIT 10
      `).all() as LibrarySummary["authors"];

      const firstMonth = new Date(now.getFullYear(), now.getMonth() - 23, 1);
      const monthKeys = Array.from({ length: 24 }, (_, index) => {
        const date = new Date(firstMonth.getFullYear(), firstMonth.getMonth() + index, 1);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      });
      const added = new Map((db.prepare(`SELECT substr(COALESCE(importedAt, createdAt), 1, 7) AS month, COUNT(*) AS count FROM ${BOOKS} GROUP BY 1`).all() as Array<{ month: string; count: number }>).map((row) => [row.month, row.count]));
      const finishedByMonth = new Map((db.prepare(`SELECT substr(completedAt, 1, 7) AS month, COUNT(*) AS count FROM ${BOOKS} AND readingStatus = 'read' AND completedAt IS NOT NULL GROUP BY 1`).all() as Array<{ month: string; count: number }>).map((row) => [row.month, row.count]));
      const growth = monthKeys.map((month) => ({ month, added: added.get(month) ?? 0, finished: finishedByMonth.get(month) ?? 0 }));

      const ratings = db.prepare(`
        SELECT CAST(ROUND(rating) AS INTEGER) AS rating, COUNT(*) AS count
        FROM ${BOOKS} AND rating > 0 GROUP BY 1 ORDER BY 1
      `).all() as LibrarySummary["ratings"];
      const topRated = db.prepare(`SELECT id, title, author, rating FROM ${BOOKS} AND rating > 0 ORDER BY rating DESC, lastOpenedAt DESC LIMIT 5`).all() as LibrarySummary["topRated"];

      const year = String(now.getFullYear());
      const finishedThisYear = (db.prepare(`SELECT COUNT(*) AS count FROM ${BOOKS} AND readingStatus = 'read' AND substr(completedAt, 1, 4) = ?`).get(year) as { count: number }).count;

      const startedFilter = `AND COALESCE(readingStatus, '') NOT IN ('read', 'want_to_read')
        AND (readingStatus IN ('reading', 'paused') OR (currentPage > 1 AND currentPage < numPages))`;
      const continueReading = db.prepare(`SELECT ${BOOK_REF_COLUMNS} FROM ${BOOKS} ${startedFilter} ORDER BY lastOpenedAt DESC LIMIT 6`).all() as LibraryBookRef[];
      const forgottenBefore = localDate(addDays(now, -30));
      const forgotten = db.prepare(`
        SELECT ${BOOK_REF_COLUMNS} FROM ${BOOKS} ${startedFilter} AND COALESCE(readingStatus, '') <> 'paused'
          AND substr(lastOpenedAt, 1, 10) < ? ORDER BY lastOpenedAt ASC LIMIT 8
      `).all(forgottenBefore) as LibraryBookRef[];
      const inProgress = db.prepare(`SELECT ${BOOK_REF_COLUMNS} FROM ${BOOKS} ${startedFilter} AND numPages > 1 ORDER BY lastOpenedAt DESC LIMIT 40`).all() as LibraryBookRef[];

      const hasConcepts = tableExists(db, "key_concepts");
      const titleByBook = new Map<string, string>();
      const bookTitle = (bookId: string) => {
        if (!titleByBook.has(bookId)) {
          const row = db.prepare("SELECT title FROM documents WHERE fileHash = ? OR bookId = ? LIMIT 1").get(bookId, bookId) as { title: string } | undefined;
          titleByBook.set(bookId, row?.title ?? "");
        }
        return titleByBook.get(bookId) || null;
      };

      const recentAnnotations: LibrarySummary["recentAnnotations"] = [];
      let annotationCount = 0;
      if (hasConcepts) {
        annotationCount += (db.prepare("SELECT COUNT(*) AS count FROM key_concepts").get() as { count: number }).count;
        for (const row of db.prepare("SELECT id, bookId, title, note, excerpt, createdAt FROM key_concepts ORDER BY createdAt DESC LIMIT 10").all() as Array<{ id: string; bookId: string; title: string; note: string | null; excerpt: string | null; createdAt: string }>) {
          recentAnnotations.push({ kind: "concept", id: row.id, title: row.title, note: row.note || row.excerpt, bookTitle: bookTitle(row.bookId), createdAt: row.createdAt });
        }
      }
      if (tableExists(db, "ll_annotations")) {
        annotationCount += (db.prepare("SELECT COUNT(*) AS count FROM ll_annotations").get() as { count: number }).count;
        for (const row of db.prepare("SELECT id, quote, note, createdAt FROM ll_annotations ORDER BY createdAt DESC LIMIT 10").all() as Array<{ id: string; quote: string; note: string; createdAt: string }>) {
          recentAnnotations.push({ kind: "learning", id: row.id, title: row.quote, note: row.note || null, bookTitle: null, createdAt: row.createdAt });
        }
      }
      // SQLite CURRENT_TIMESTAMP ("YYYY-MM-DD HH:MM:SS") and ISO strings sort together once normalised.
      recentAnnotations.sort((a, b) => b.createdAt.replace(" ", "T").localeCompare(a.createdAt.replace(" ", "T")));

      const conceptGraph: LibrarySummary["conceptGraph"] = { nodes: [], edges: [] };
      if (hasConcepts && tableExists(db, "concept_relations")) {
        const concepts = db.prepare(`
          SELECT c.id, c.title, c.bookId,
                 (SELECT COUNT(*) FROM concept_relations r WHERE r.conceptAId = c.id OR r.conceptBId = c.id) AS degree
          FROM key_concepts c
        `).all() as Array<{ id: string; title: string; bookId: string; degree: number }>;
        const byTitle = new Map<string, typeof concepts>();
        for (const concept of concepts) {
          const key = concept.title.trim().toLocaleLowerCase();
          byTitle.set(key, [...(byTitle.get(key) ?? []), concept]);
        }
        // Concepts that share a title across different books bridge them.
        const shared: Array<{ source: string; target: string }> = [];
        for (const group of byTitle.values()) {
          for (let index = 1; index < group.length; index += 1) {
            const first = group[0];
            const other = group[index];
            if (first && other && first.bookId !== other.bookId) shared.push({ source: first.id, target: other.id });
          }
        }
        const sharedDegree = new Map<string, number>();
        for (const edge of shared) {
          sharedDegree.set(edge.source, (sharedDegree.get(edge.source) ?? 0) + 1);
          sharedDegree.set(edge.target, (sharedDegree.get(edge.target) ?? 0) + 1);
        }
        const selected = concepts
          .map((concept) => ({ ...concept, degree: concept.degree + (sharedDegree.get(concept.id) ?? 0) }))
          .sort((a, b) => b.degree - a.degree)
          .slice(0, 60);
        const ids = new Set(selected.map((concept) => concept.id));
        conceptGraph.nodes = selected.map((concept) => ({ ...concept, bookTitle: bookTitle(concept.bookId) ?? "" }));
        const relations = db.prepare("SELECT conceptAId AS source, conceptBId AS target FROM concept_relations").all() as Array<{ source: string; target: string }>;
        conceptGraph.edges = [
          ...relations.filter((edge) => ids.has(edge.source) && ids.has(edge.target)).map((edge) => ({ ...edge, kind: "relation" as const })),
          ...shared.filter((edge) => ids.has(edge.source) && ids.has(edge.target)).map((edge) => ({ ...edge, kind: "shared" as const })),
        ];
      }

      return {
        totals: {
          books: totals.books,
          pages: totals.pages,
          bytes: totals.bytes,
          pagesRead: totals.pagesRead,
          backlogPages: totals.backlogPages,
          finished: totals.finished,
          favorites: totals.favorites,
          annotations: annotationCount,
        },
        status: {
          none: statusCount("none") + statusCount("unknown"),
          wantToRead: statusCount("want_to_read"),
          reading: statusCount("reading"),
          paused: statusCount("paused"),
          read: statusCount("read"),
          started: totals.started,
        },
        formats,
        subjects,
        authors,
        growth,
        ratings,
        topRated,
        finishedThisYear,
        continueReading,
        forgotten,
        inProgress,
        recentAnnotations: recentAnnotations.slice(0, 10),
        conceptGraph,
      };
    },

    languageSummary(userId, documents, now = new Date()) {
      snapshotKnowledge(userId, now);
      const languages = db.prepare(`
        SELECT k.language,
               SUM(CASE WHEN k.state = 'known' THEN 1 ELSE 0 END) AS known,
               SUM(CASE WHEN k.state = 'learning' THEN 1 ELSE 0 END) AS learning,
               SUM(CASE WHEN k.state = 'unknown' THEN 1 ELSE 0 END) AS unknown,
               SUM(CASE WHEN k.state = 'ignored' THEN 1 ELSE 0 END) AS ignored,
               COALESCE(SUM(k.lookupCount), 0) AS lookups,
               (SELECT COUNT(*) FROM ll_review_items r WHERE r.userId = k.userId AND r.language = k.language) AS reviewItems
        FROM ll_knowledge k WHERE k.userId = ? GROUP BY k.language ORDER BY known DESC
      `).all(userId) as LanguageSummary["languages"];

      // History: real daily snapshots, back-filled before the first snapshot
      // with an estimate from when each current word last changed state.
      const snapshots = db.prepare("SELECT date, language, known, learning FROM ll_knowledge_daily WHERE userId = ? ORDER BY date").all(userId) as LanguageSummary["history"];
      const history: LanguageSummary["history"] = [];
      for (const { language } of languages) {
        const own = snapshots.filter((row) => row.language === language);
        const firstSnapshot = own[0]?.date ?? localDate(now);
        const changes = db.prepare(`
          SELECT substr(updatedAt, 1, 10) AS date,
                 SUM(CASE WHEN state = 'known' THEN 1 ELSE 0 END) AS known,
                 SUM(CASE WHEN state = 'learning' THEN 1 ELSE 0 END) AS learning
          FROM ll_knowledge WHERE userId = ? AND language = ? AND state IN ('known', 'learning')
          GROUP BY 1 ORDER BY 1
        `).all(userId, language) as Array<{ date: string; known: number; learning: number }>;
        const firstChange = changes[0]?.date;
        const start = firstChange && firstChange < firstSnapshot ? firstChange : firstSnapshot;
        const bySnapshot = new Map(own.map((row) => [row.date, row]));
        let known = 0;
        let learning = 0;
        let changeIndex = 0;
        let last: { known: number; learning: number } | null = null;
        const today = localDate(now);
        for (let cursor = new Date(`${start}T12:00:00`); localDate(cursor) <= today; cursor = addDays(cursor, 1)) {
          const date = localDate(cursor);
          while (changeIndex < changes.length && (changes[changeIndex]?.date ?? "") <= date) {
            known += changes[changeIndex]?.known ?? 0;
            learning += changes[changeIndex]?.learning ?? 0;
            changeIndex += 1;
          }
          const snapshot = bySnapshot.get(date);
          if (snapshot) last = snapshot;
          const value = date < firstSnapshot ? { known, learning } : (last ?? { known, learning });
          history.push({ date, language, known: value.known, learning: value.learning });
        }
      }

      const stubborn = db.prepare(`
        SELECT language, key, label, translation, lookupCount, state FROM ll_knowledge
        WHERE userId = ? AND state IN ('unknown', 'learning') AND lookupCount > 1
        ORDER BY lookupCount DESC, updatedAt DESC LIMIT 12
      `).all(userId) as LanguageSummary["stubborn"];

      const stateByLanguage = new Map<string, Map<string, string>>();
      const statesFor = (language: string) => {
        let states = stateByLanguage.get(language);
        if (!states) {
          const rows = db.prepare("SELECT key, state FROM ll_knowledge WHERE userId = ? AND language = ?").all(userId, language) as Array<{ key: string; state: string }>;
          states = new Map(rows.map((row) => [row.key, row.state]));
          stateByLanguage.set(language, states);
        }
        return states;
      };
      const coverage = documents.map((document) => {
        const states = statesFor(document.language);
        let total = 0;
        let known = 0;
        let learning = 0;
        for (const entry of document.lexicon) {
          const state = states.get(entry.key) ?? states.get(entry.key.split("#")[0] ?? entry.key);
          if (state === "ignored") continue;
          total += entry.count;
          if (state === "known") known += entry.count;
          else if (state === "learning") learning += entry.count;
        }
        return {
          documentId: document.documentId,
          fileHash: document.fileHash,
          title: document.title,
          language: document.language,
          known: total > 0 ? known / total : 0,
          learning: total > 0 ? learning / total : 0,
          tokens: document.tokens,
          lexemes: document.lexicon.length,
        };
      }).sort((a, b) => b.known - a.known);

      const titles = new Map(documents.map((document) => [document.documentId, document]));
      const wordsByBook = (db.prepare(`
        SELECT documentId, language, COUNT(*) AS saved FROM ll_review_items
        WHERE userId = ? AND documentId IS NOT NULL GROUP BY documentId, language ORDER BY saved DESC LIMIT 12
      `).all(userId) as Array<{ documentId: string; language: string; saved: number }>).map((row) => ({
        ...row,
        title: titles.get(row.documentId)?.title ?? row.documentId.replace(/^lyceum-/, "").replace(/-[a-z0-9]{8}$/, "").replace(/-/g, " "),
      }));

      return { languages, history, stubborn, coverage, wordsByBook };
    },
  };
}
