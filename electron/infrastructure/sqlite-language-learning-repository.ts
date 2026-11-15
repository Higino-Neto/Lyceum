import type Database from "better-sqlite3";
import {
  isKnowledgeState,
  type FormKnowledgeRecord,
  type KnowledgeRecord,
  type KnowledgeSnapshot,
  type LanguageLearningRepository,
  type LearningAnnotation,
  type LearningReadingState,
  type ReviewItem,
  type ReviewLogEntry,
  type ExerciseType,
  type AnnotationTarget,
  type KnowledgeBucket,
  type LearningBackup,
  LEARNING_BACKUP_SCHEMA,
} from "../../src/core/language-learning/model";
import { formKey } from "../../src/core/language-learning/knowledge";

interface KnowledgeRow {
  language: string;
  key: string;
  state: string;
  label: string;
  translation: string | null;
  note: string | null;
  lookupCount: number;
  updatedAt: string;
}

interface FormRow {
  language: string;
  key: string;
  form: string;
  state: string;
  updatedAt: string;
}

interface ReadingRow {
  documentId: string;
  chapterId: string;
  blockId: string | null;
  progress: number;
  completedChapters: string;
  secondsRead: number;
  sessions: number;
  updatedAt: string;
}

interface ReviewLogRow {
  itemId: string;
  reviewedAt: string;
  grade: number;
  exercise: string;
  correct: number;
  intervalBefore: number;
  intervalAfter: number;
}

function toKnowledge(row: KnowledgeRow): KnowledgeRecord {
  return {
    language: row.language,
    key: row.key,
    state: isKnowledgeState(row.state) ? row.state : "unknown",
    label: row.label,
    translation: row.translation,
    note: row.note,
    lookupCount: row.lookupCount,
    updatedAt: row.updatedAt,
  };
}

function parseStringArray(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

/** SQLite adapter for the language-learning port. The caller owns the connection. */
export function createSqliteLanguageLearningRepository(
  db: Database.Database,
  now: () => string = () => new Date().toISOString(),
): LanguageLearningRepository {
  const getKnowledge = db.prepare<[string, string, string], KnowledgeRow>(
    "SELECT language, key, state, label, translation, note, lookupCount, updatedAt FROM ll_knowledge WHERE userId = ? AND language = ? AND key = ?",
  );

  const repository: LanguageLearningRepository = {
    loadKnowledge(userId, language): KnowledgeSnapshot {
      const snapshot: KnowledgeSnapshot = { lemmas: {}, forms: {} };
      for (const row of db.prepare<[string, string], KnowledgeRow>(
        "SELECT language, key, state, label, translation, note, lookupCount, updatedAt FROM ll_knowledge WHERE userId = ? AND language = ?",
      ).all(userId, language)) {
        snapshot.lemmas[row.key] = toKnowledge(row);
      }
      for (const row of db.prepare<[string, string], FormRow>(
        "SELECT language, key, form, state, updatedAt FROM ll_form_knowledge WHERE userId = ? AND language = ?",
      ).all(userId, language)) {
        if (!isKnowledgeState(row.state)) continue;
        snapshot.forms[formKey(row.key, row.form)] = { ...row, state: row.state };
      }
      return snapshot;
    },

    setLemmaState(userId, record) {
      const updatedAt = now();
      db.prepare(`
        INSERT INTO ll_knowledge (userId, language, key, state, label, translation, note, lookupCount, updatedAt)
        VALUES (@userId, @language, @key, @state, @label, @translation, @note, 0, @updatedAt)
        ON CONFLICT(userId, language, key) DO UPDATE SET
          state = excluded.state,
          label = excluded.label,
          translation = COALESCE(excluded.translation, ll_knowledge.translation),
          note = COALESCE(excluded.note, ll_knowledge.note),
          updatedAt = excluded.updatedAt
      `).run({
        userId,
        language: record.language,
        key: record.key,
        state: record.state,
        label: record.label,
        translation: record.translation ?? null,
        note: record.note ?? null,
        updatedAt,
      });
      const row = getKnowledge.get(userId, record.language, record.key);
      if (!row) throw new Error("Knowledge record was not persisted");
      return toKnowledge(row);
    },

    setFormState(userId, record): FormKnowledgeRecord {
      const updatedAt = now();
      db.prepare(`
        INSERT INTO ll_form_knowledge (userId, language, key, form, state, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(userId, language, key, form) DO UPDATE SET state = excluded.state, updatedAt = excluded.updatedAt
      `).run(userId, record.language, record.key, record.form, record.state, updatedAt);
      return { ...record, updatedAt };
    },

    clearFormState(userId, language, key, form) {
      db.prepare("DELETE FROM ll_form_knowledge WHERE userId = ? AND language = ? AND key = ? AND form = ?")
        .run(userId, language, key, form);
    },

    recordLookup(userId, language, key, label) {
      db.prepare(`
        INSERT INTO ll_knowledge (userId, language, key, state, label, lookupCount, updatedAt)
        VALUES (?, ?, ?, 'unknown', ?, 1, ?)
        ON CONFLICT(userId, language, key) DO UPDATE SET lookupCount = ll_knowledge.lookupCount + 1
      `).run(userId, language, key, label, now());
    },

    setTranslation(userId, language, key, label, translation) {
      db.prepare(`
        INSERT INTO ll_knowledge (userId, language, key, state, label, translation, lookupCount, updatedAt)
        VALUES (?, ?, ?, 'unknown', ?, ?, 0, ?)
        ON CONFLICT(userId, language, key) DO UPDATE SET translation = excluded.translation, updatedAt = excluded.updatedAt
      `).run(userId, language, key, label, translation, now());
    },

    setLemmaStates(userId, records) {
      const statement = db.prepare(`
        INSERT INTO ll_knowledge (userId, language, key, state, label, translation, note, lookupCount, updatedAt)
        VALUES (@userId, @language, @key, @state, @label, @translation, @note, 0, @updatedAt)
        ON CONFLICT(userId, language, key) DO UPDATE SET
          state = excluded.state, label = excluded.label, updatedAt = excluded.updatedAt
      `);
      const updatedAt = now();
      const run = db.transaction(() => {
        for (const record of records) {
          statement.run({
            userId,
            language: record.language,
            key: record.key,
            state: record.state,
            label: record.label,
            translation: record.translation ?? null,
            note: record.note ?? null,
            updatedAt,
          });
        }
      });
      run();
      return records.length;
    },

    listKnowledgeBuckets(userIds): KnowledgeBucket[] {
      const buckets = new Map<string, KnowledgeBucket>();
      const statement = db.prepare<[string], { language: string; key: string }>(
        "SELECT language, key FROM ll_knowledge WHERE userId = ? AND (state <> 'unknown' OR translation IS NOT NULL) ORDER BY language",
      );
      for (const owner of new Set(userIds)) {
        for (const row of statement.all(owner)) {
          const id = `${owner}\u0000${row.language}`;
          let bucket = buckets.get(id);
          if (!bucket) {
            bucket = { userId: owner, language: row.language, count: 0, keys: [] };
            buckets.set(id, bucket);
          }
          bucket.count += 1;
          bucket.keys.push(row.key);
        }
      }
      return [...buckets.values()];
    },

    mergeKnowledge(userId, from, toLanguage) {
      if (from.userId === userId && from.language === toLanguage) return { moved: 0, merged: 0, reviewItems: 0 };
      let moved = 0;
      let merged = 0;
      let reviewItems = 0;
      const run = db.transaction(() => {
        const rows = db.prepare<[string, string], KnowledgeRow>(
          "SELECT language, key, state, label, translation, note, lookupCount, updatedAt FROM ll_knowledge WHERE userId = ? AND language = ?",
        ).all(from.userId, from.language);
        for (const row of rows) {
          const existing = getKnowledge.get(userId, toLanguage, row.key);
          if (!existing) {
            db.prepare(`INSERT INTO ll_knowledge (userId, language, key, state, label, translation, note, lookupCount, updatedAt)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(userId, toLanguage, row.key, row.state, row.label, row.translation, row.note, row.lookupCount, row.updatedAt);
            moved += 1;
          } else {
            const newer = row.updatedAt > existing.updatedAt ? row : existing;
            db.prepare(`UPDATE ll_knowledge SET state = ?, label = ?, translation = ?, note = ?, lookupCount = ?, updatedAt = ?
              WHERE userId = ? AND language = ? AND key = ?`).run(
              newer.state, newer.label, newer.translation ?? row.translation ?? existing.translation,
              newer.note ?? row.note ?? existing.note, row.lookupCount + existing.lookupCount, newer.updatedAt,
              userId, toLanguage, row.key,
            );
            merged += 1;
          }
        }
        db.prepare("DELETE FROM ll_knowledge WHERE userId = ? AND language = ?").run(from.userId, from.language);

        db.prepare(`INSERT OR IGNORE INTO ll_form_knowledge (userId, language, key, form, state, updatedAt)
          SELECT ?, ?, key, form, state, updatedAt FROM ll_form_knowledge WHERE userId = ? AND language = ?`)
          .run(userId, toLanguage, from.userId, from.language);
        db.prepare("DELETE FROM ll_form_knowledge WHERE userId = ? AND language = ?").run(from.userId, from.language);

        const items = db.prepare<[string, string], ReviewItem>(
          "SELECT id, language, key, itemType, label, translation, context, contextForm, documentId, sentenceId, easeFactor, intervalDays, repetitions, lapses, dueAt, createdAt, lastReviewedAt FROM ll_review_items WHERE userId = ? AND language = ?",
        ).all(from.userId, from.language);
        for (const item of items) {
          const id = item.id.startsWith(`${from.language}:`) ? `${toLanguage}:${item.id.slice(from.language.length + 1)}` : item.id;
          const exists = db.prepare("SELECT 1 FROM ll_review_items WHERE userId = ? AND (id = ? OR (language = ? AND key = ?))").get(userId, id, toLanguage, item.key);
          if (!exists) {
            db.prepare(`INSERT INTO ll_review_items (userId, id, language, key, itemType, label, translation, context, contextForm,
              documentId, sentenceId, easeFactor, intervalDays, repetitions, lapses, dueAt, createdAt, lastReviewedAt)
              VALUES (@userId, @id, @language, @key, @itemType, @label, @translation, @context, @contextForm,
              @documentId, @sentenceId, @easeFactor, @intervalDays, @repetitions, @lapses, @dueAt, @createdAt, @lastReviewedAt)`)
              .run({ ...item, userId, id, language: toLanguage });
            db.prepare("UPDATE ll_review_log SET userId = ?, itemId = ? WHERE userId = ? AND itemId = ?").run(userId, id, from.userId, item.id);
            reviewItems += 1;
          }
        }
        db.prepare("DELETE FROM ll_review_items WHERE userId = ? AND language = ?").run(from.userId, from.language);
      });
      run();
      return { moved, merged, reviewItems };
    },

    exportUserData(userId): LearningBackup {
      const reviewColumns = "id, language, key, itemType, label, translation, context, contextForm, documentId, sentenceId, easeFactor, intervalDays, repetitions, lapses, dueAt, createdAt, lastReviewedAt";
      return {
        schema: LEARNING_BACKUP_SCHEMA,
        version: 1,
        exportedAt: now(),
        knowledge: db.prepare<[string], KnowledgeRow>(
          "SELECT language, key, state, label, translation, note, lookupCount, updatedAt FROM ll_knowledge WHERE userId = ? ORDER BY language, key",
        ).all(userId).map(toKnowledge),
        forms: db.prepare<[string], FormRow>("SELECT language, key, form, state, updatedAt FROM ll_form_knowledge WHERE userId = ?").all(userId)
          .flatMap((row) => (isKnowledgeState(row.state) ? [{ ...row, state: row.state }] : [])),
        reviewItems: db.prepare<[string], ReviewItem>(`SELECT ${reviewColumns} FROM ll_review_items WHERE userId = ?`).all(userId),
        reviewLog: repository.listReviewLog(userId),
        annotations: repository.listAnnotations(userId),
        readingStates: db.prepare<[string], ReadingRow>(
          "SELECT documentId, chapterId, blockId, progress, completedChapters, secondsRead, sessions, updatedAt FROM ll_reading_state WHERE userId = ?",
        ).all(userId).map((row) => ({ ...row, completedChapters: parseStringArray(row.completedChapters) })),
      };
    },

    importUserData(userId, backup) {
      let knowledge = 0;
      let reviewItems = 0;
      let annotations = 0;
      const run = db.transaction(() => {
        for (const record of backup.knowledge) {
          const existing = getKnowledge.get(userId, record.language, record.key);
          if (existing && existing.updatedAt >= record.updatedAt) continue;
          db.prepare(`INSERT INTO ll_knowledge (userId, language, key, state, label, translation, note, lookupCount, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(userId, language, key) DO UPDATE SET state = excluded.state, label = excluded.label,
              translation = COALESCE(excluded.translation, ll_knowledge.translation), note = COALESCE(excluded.note, ll_knowledge.note),
              lookupCount = MAX(excluded.lookupCount, ll_knowledge.lookupCount), updatedAt = excluded.updatedAt`)
            .run(userId, record.language, record.key, record.state, record.label, record.translation, record.note, record.lookupCount, record.updatedAt);
          knowledge += 1;
        }
        for (const record of backup.forms) {
          db.prepare(`INSERT INTO ll_form_knowledge (userId, language, key, form, state, updatedAt) VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(userId, language, key, form) DO UPDATE SET state = excluded.state, updatedAt = excluded.updatedAt
            WHERE excluded.updatedAt > ll_form_knowledge.updatedAt`)
            .run(userId, record.language, record.key, record.form, record.state, record.updatedAt);
        }
        for (const item of backup.reviewItems) {
          const existing = db.prepare<[string, string], { lastReviewedAt: string | null }>(
            "SELECT lastReviewedAt FROM ll_review_items WHERE userId = ? AND id = ?",
          ).get(userId, item.id);
          if (existing && (existing.lastReviewedAt ?? "") >= (item.lastReviewedAt ?? "")) continue;
          repository.upsertReviewItem(userId, item);
          reviewItems += 1;
        }
        const hasLog = db.prepare("SELECT 1 FROM ll_review_log WHERE userId = ? AND itemId = ? AND reviewedAt = ?");
        for (const entry of backup.reviewLog) {
          if (!hasLog.get(userId, entry.itemId, entry.reviewedAt)) repository.logReview(userId, entry);
        }
        for (const annotation of backup.annotations) {
          const existing = db.prepare<[string, string], { updatedAt: string }>("SELECT updatedAt FROM ll_annotations WHERE userId = ? AND id = ?").get(userId, annotation.id);
          if (existing && existing.updatedAt >= annotation.updatedAt) continue;
          repository.saveAnnotation(userId, annotation);
          annotations += 1;
        }
        for (const state of backup.readingStates) {
          const existing = repository.getReadingState(userId, state.documentId);
          if (!existing || existing.updatedAt < state.updatedAt) repository.saveReadingState(userId, state);
        }
      });
      run();
      return { knowledge, reviewItems, annotations };
    },

    listReviewItems(userId, language) {
      const columns = "id, language, key, itemType, label, translation, context, contextForm, documentId, sentenceId, easeFactor, intervalDays, repetitions, lapses, dueAt, createdAt, lastReviewedAt";
      return language
        ? db.prepare<[string, string], ReviewItem>(`SELECT ${columns} FROM ll_review_items WHERE userId = ? AND language = ? ORDER BY dueAt`).all(userId, language)
        : db.prepare<[string], ReviewItem>(`SELECT ${columns} FROM ll_review_items WHERE userId = ? ORDER BY dueAt`).all(userId);
    },

    upsertReviewItem(userId, item) {
      db.prepare(`
        INSERT INTO ll_review_items (userId, id, language, key, itemType, label, translation, context, contextForm,
          documentId, sentenceId, easeFactor, intervalDays, repetitions, lapses, dueAt, createdAt, lastReviewedAt)
        VALUES (@userId, @id, @language, @key, @itemType, @label, @translation, @context, @contextForm,
          @documentId, @sentenceId, @easeFactor, @intervalDays, @repetitions, @lapses, @dueAt, @createdAt, @lastReviewedAt)
        ON CONFLICT(userId, id) DO UPDATE SET
          label = excluded.label, translation = excluded.translation, context = excluded.context,
          contextForm = excluded.contextForm, documentId = excluded.documentId, sentenceId = excluded.sentenceId,
          easeFactor = excluded.easeFactor, intervalDays = excluded.intervalDays, repetitions = excluded.repetitions,
          lapses = excluded.lapses, dueAt = excluded.dueAt, lastReviewedAt = excluded.lastReviewedAt
      `).run({ userId, ...item });
    },

    upsertReviewItems(userId, items) {
      const run = db.transaction(() => {
        for (const item of items) repository.upsertReviewItem(userId, item);
      });
      run();
      return items.length;
    },

    deleteReviewItem(userId, id) {
      db.prepare("DELETE FROM ll_review_items WHERE userId = ? AND id = ?").run(userId, id);
      db.prepare("DELETE FROM ll_review_log WHERE userId = ? AND itemId = ?").run(userId, id);
    },

    logReview(userId, entry) {
      db.prepare(`
        INSERT INTO ll_review_log (userId, itemId, reviewedAt, grade, exercise, correct, intervalBefore, intervalAfter)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(userId, entry.itemId, entry.reviewedAt, entry.grade, entry.exercise, entry.correct ? 1 : 0, entry.intervalBefore, entry.intervalAfter);
    },

    listReviewLog(userId, itemId): ReviewLogEntry[] {
      const rows = itemId
        ? db.prepare<[string, string], ReviewLogRow>("SELECT itemId, reviewedAt, grade, exercise, correct, intervalBefore, intervalAfter FROM ll_review_log WHERE userId = ? AND itemId = ? ORDER BY reviewedAt").all(userId, itemId)
        : db.prepare<[string], ReviewLogRow>("SELECT itemId, reviewedAt, grade, exercise, correct, intervalBefore, intervalAfter FROM ll_review_log WHERE userId = ? ORDER BY reviewedAt").all(userId);
      return rows.map((row) => ({ ...row, exercise: row.exercise as ExerciseType, correct: row.correct === 1 }));
    },

    listAnnotations(userId, documentId) {
      const rows = documentId
        ? db.prepare<[string, string], LearningAnnotation>("SELECT id, documentId, targetType, targetId, chapterId, quote, note, category, createdAt, updatedAt FROM ll_annotations WHERE userId = ? AND documentId = ? ORDER BY createdAt").all(userId, documentId)
        : db.prepare<[string], LearningAnnotation>("SELECT id, documentId, targetType, targetId, chapterId, quote, note, category, createdAt, updatedAt FROM ll_annotations WHERE userId = ? ORDER BY createdAt").all(userId);
      return rows.map((row) => ({ ...row, targetType: row.targetType as AnnotationTarget }));
    },

    saveAnnotation(userId, annotation) {
      db.prepare(`
        INSERT INTO ll_annotations (userId, id, documentId, targetType, targetId, chapterId, quote, note, category, createdAt, updatedAt)
        VALUES (@userId, @id, @documentId, @targetType, @targetId, @chapterId, @quote, @note, @category, @createdAt, @updatedAt)
        ON CONFLICT(userId, id) DO UPDATE SET note = excluded.note, category = excluded.category, updatedAt = excluded.updatedAt
      `).run({ userId, ...annotation });
    },

    deleteAnnotation(userId, id) {
      db.prepare("DELETE FROM ll_annotations WHERE userId = ? AND id = ?").run(userId, id);
    },

    getReadingState(userId, documentId): LearningReadingState | null {
      const row = db.prepare<[string, string], ReadingRow>(
        "SELECT documentId, chapterId, blockId, progress, completedChapters, secondsRead, sessions, updatedAt FROM ll_reading_state WHERE userId = ? AND documentId = ?",
      ).get(userId, documentId);
      return row ? { ...row, completedChapters: parseStringArray(row.completedChapters) } : null;
    },

    saveReadingState(userId, state) {
      db.prepare(`
        INSERT INTO ll_reading_state (userId, documentId, chapterId, blockId, progress, completedChapters, secondsRead, sessions, updatedAt)
        VALUES (@userId, @documentId, @chapterId, @blockId, @progress, @completedChapters, @secondsRead, @sessions, @updatedAt)
        ON CONFLICT(userId, documentId) DO UPDATE SET
          chapterId = excluded.chapterId, blockId = excluded.blockId, progress = excluded.progress,
          completedChapters = excluded.completedChapters, secondsRead = excluded.secondsRead,
          sessions = excluded.sessions, updatedAt = excluded.updatedAt
      `).run({ userId, ...state, completedChapters: JSON.stringify(state.completedChapters) });
    },
  };
  return repository;
}
