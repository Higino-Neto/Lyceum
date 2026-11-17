import { formKey } from "./knowledge";
import {
  LEARNING_BACKUP_SCHEMA,
  isKnowledgeState,
  type FormKnowledgeRecord,
  type KnowledgeBucket,
  type KnowledgeRecord,
  type KnowledgeSnapshot,
  type LanguageLearningRepository,
  type LearningAnnotation,
  type LearningBackup,
  type LearningReadingState,
  type ReviewItem,
  type ReviewLogEntry,
} from "./model";

/**
 * Pure in-memory implementation of {@link LanguageLearningRepository}.
 *
 * It mirrors the semantics of the desktop SQLite adapter
 * (`electron/infrastructure/sqlite-language-learning-repository.ts`) rule by
 * rule, and both run the same contract tests. Platforms without SQLite (the
 * Capacitor app) keep the rows here and persist every change reported through
 * `onChange` (write-behind), so the repository stays synchronous like the port.
 */

export type LearningStoreName = "knowledge" | "forms" | "reviewItems" | "reviewLog" | "annotations" | "readingStates";

export type StoredKnowledge = KnowledgeRecord & { userId: string };
export type StoredForm = FormKnowledgeRecord & { userId: string };
export type StoredReviewItem = ReviewItem & { userId: string };
export type StoredReviewLog = ReviewLogEntry & { userId: string };
export type StoredAnnotation = LearningAnnotation & { userId: string };
export type StoredReadingState = LearningReadingState & { userId: string };

export interface LearningRows {
  knowledge: StoredKnowledge[];
  forms: StoredForm[];
  reviewItems: StoredReviewItem[];
  reviewLog: StoredReviewLog[];
  annotations: StoredAnnotation[];
  readingStates: StoredReadingState[];
}

/** One persisted row changed (`value === null` means deleted). */
export interface LearningRowChange {
  store: LearningStoreName;
  id: string;
  value: unknown | null;
}

export interface MemoryRepositoryOptions {
  now?: () => string;
  initial?: Partial<LearningRows>;
  onChange?: (changes: LearningRowChange[]) => void;
}

const SEP = "\u0000";

/** Stable row ids; persistence layers use them as primary keys. */
export const learningRowId = {
  knowledge: (row: { userId: string; language: string; key: string }) => [row.userId, row.language, row.key].join(SEP),
  forms: (row: { userId: string; language: string; key: string; form: string }) => [row.userId, row.language, row.key, row.form].join(SEP),
  reviewItems: (row: { userId: string; id: string }) => [row.userId, row.id].join(SEP),
  reviewLog: (row: { userId: string; itemId: string; reviewedAt: string }) => [row.userId, row.itemId, row.reviewedAt].join(SEP),
  annotations: (row: { userId: string; id: string }) => [row.userId, row.id].join(SEP),
  readingStates: (row: { userId: string; documentId: string }) => [row.userId, row.documentId].join(SEP),
};

function strip<T extends { userId: string }>(row: T): Omit<T, "userId"> {
  const { userId: _userId, ...rest } = row;
  return rest;
}

function compare(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0;
}

export interface MemoryLanguageLearningRepository extends LanguageLearningRepository {
  /** Every row, for persistence snapshots and tests. */
  rows(): LearningRows;
}

export function createMemoryLanguageLearningRepository(options: MemoryRepositoryOptions = {}): MemoryLanguageLearningRepository {
  const now = options.now ?? (() => new Date().toISOString());
  const knowledge = new Map<string, StoredKnowledge>();
  const forms = new Map<string, StoredForm>();
  const reviewItems = new Map<string, StoredReviewItem>();
  const reviewLog = new Map<string, StoredReviewLog>();
  const annotations = new Map<string, StoredAnnotation>();
  const readingStates = new Map<string, StoredReadingState>();

  for (const row of options.initial?.knowledge ?? []) knowledge.set(learningRowId.knowledge(row), { ...row });
  for (const row of options.initial?.forms ?? []) forms.set(learningRowId.forms(row), { ...row });
  for (const row of options.initial?.reviewItems ?? []) reviewItems.set(learningRowId.reviewItems(row), { ...row });
  for (const row of options.initial?.reviewLog ?? []) reviewLog.set(learningRowId.reviewLog(row), { ...row });
  for (const row of options.initial?.annotations ?? []) annotations.set(learningRowId.annotations(row), { ...row });
  for (const row of options.initial?.readingStates ?? []) readingStates.set(learningRowId.readingStates(row), { ...row });

  // Changes are batched per public call so persistence writes one transaction.
  let pending: LearningRowChange[] | null = null;
  let depth = 0;
  const emit = (change: LearningRowChange) => {
    if (pending) pending.push(change);
    else options.onChange?.([change]);
  };
  function transaction<T>(run: () => T): T {
    if (depth === 0) pending = [];
    depth += 1;
    try {
      return run();
    } finally {
      depth -= 1;
      if (depth === 0) {
        const changes = pending ?? [];
        pending = null;
        if (changes.length > 0) options.onChange?.(changes);
      }
    }
  }

  const put = {
    knowledge(row: StoredKnowledge) {
      const id = learningRowId.knowledge(row);
      knowledge.set(id, row);
      emit({ store: "knowledge", id, value: row });
    },
    form(row: StoredForm) {
      const id = learningRowId.forms(row);
      forms.set(id, row);
      emit({ store: "forms", id, value: row });
    },
    reviewItem(row: StoredReviewItem) {
      const id = learningRowId.reviewItems(row);
      reviewItems.set(id, row);
      emit({ store: "reviewItems", id, value: row });
    },
    reviewLog(row: StoredReviewLog) {
      const id = learningRowId.reviewLog(row);
      reviewLog.set(id, row);
      emit({ store: "reviewLog", id, value: row });
    },
    annotation(row: StoredAnnotation) {
      const id = learningRowId.annotations(row);
      annotations.set(id, row);
      emit({ store: "annotations", id, value: row });
    },
    readingState(row: StoredReadingState) {
      const id = learningRowId.readingStates(row);
      readingStates.set(id, row);
      emit({ store: "readingStates", id, value: row });
    },
  };
  function remove<T>(store: LearningStoreName, map: Map<string, T>, id: string) {
    if (map.delete(id)) emit({ store, id, value: null });
  }

  const getKnowledge = (userId: string, language: string, key: string) =>
    knowledge.get(learningRowId.knowledge({ userId, language, key }));

  const toKnowledge = (row: StoredKnowledge): KnowledgeRecord => ({
    language: row.language,
    key: row.key,
    state: isKnowledgeState(row.state) ? row.state : "unknown",
    label: row.label,
    translation: row.translation ?? null,
    note: row.note ?? null,
    lookupCount: row.lookupCount,
    updatedAt: row.updatedAt,
  });

  const repository: MemoryLanguageLearningRepository = {
    rows() {
      return {
        knowledge: [...knowledge.values()].map((row) => ({ ...row })),
        forms: [...forms.values()].map((row) => ({ ...row })),
        reviewItems: [...reviewItems.values()].map((row) => ({ ...row })),
        reviewLog: [...reviewLog.values()].map((row) => ({ ...row })),
        annotations: [...annotations.values()].map((row) => ({ ...row })),
        readingStates: [...readingStates.values()].map((row) => ({ ...row, completedChapters: [...row.completedChapters] })),
      };
    },

    loadKnowledge(userId, language): KnowledgeSnapshot {
      const snapshot: KnowledgeSnapshot = { lemmas: {}, forms: {} };
      for (const row of knowledge.values()) {
        if (row.userId === userId && row.language === language) snapshot.lemmas[row.key] = toKnowledge(row);
      }
      for (const row of forms.values()) {
        if (row.userId !== userId || row.language !== language || !isKnowledgeState(row.state)) continue;
        snapshot.forms[formKey(row.key, row.form)] = strip(row);
      }
      return snapshot;
    },

    setLemmaState(userId, record) {
      return transaction(() => {
        const existing = getKnowledge(userId, record.language, record.key);
        const row: StoredKnowledge = {
          userId,
          language: record.language,
          key: record.key,
          state: record.state,
          label: record.label,
          translation: record.translation ?? existing?.translation ?? null,
          note: record.note ?? existing?.note ?? null,
          lookupCount: existing?.lookupCount ?? 0,
          updatedAt: now(),
        };
        put.knowledge(row);
        return toKnowledge(row);
      });
    },

    setFormState(userId, record): FormKnowledgeRecord {
      return transaction(() => {
        const updatedAt = now();
        put.form({ userId, language: record.language, key: record.key, form: record.form, state: record.state, updatedAt });
        return { ...record, updatedAt };
      });
    },

    clearFormState(userId, language, key, form) {
      transaction(() => remove("forms", forms, learningRowId.forms({ userId, language, key, form })));
    },

    recordLookup(userId, language, key, label) {
      transaction(() => {
        const existing = getKnowledge(userId, language, key);
        if (existing) put.knowledge({ ...existing, lookupCount: existing.lookupCount + 1 });
        else put.knowledge({ userId, language, key, state: "unknown", label, translation: null, note: null, lookupCount: 1, updatedAt: now() });
      });
    },

    setTranslation(userId, language, key, label, translation) {
      transaction(() => {
        const existing = getKnowledge(userId, language, key);
        const updatedAt = now();
        if (existing) put.knowledge({ ...existing, translation, updatedAt });
        else put.knowledge({ userId, language, key, state: "unknown", label, translation, note: null, lookupCount: 0, updatedAt });
      });
    },

    setLemmaStates(userId, records) {
      return transaction(() => {
        const updatedAt = now();
        for (const record of records) {
          const existing = getKnowledge(userId, record.language, record.key);
          put.knowledge(existing
            ? { ...existing, state: record.state, label: record.label, updatedAt }
            : {
              userId, language: record.language, key: record.key, state: record.state, label: record.label,
              translation: record.translation ?? null, note: record.note ?? null, lookupCount: 0, updatedAt,
            });
        }
        return records.length;
      });
    },

    listKnowledgeBuckets(userIds): KnowledgeBucket[] {
      const buckets = new Map<string, KnowledgeBucket>();
      for (const owner of new Set(userIds)) {
        const rows = [...knowledge.values()]
          .filter((row) => row.userId === owner && (row.state !== "unknown" || row.translation !== null && row.translation !== undefined))
          .sort((a, b) => compare(a.language, b.language));
        for (const row of rows) {
          const id = `${owner}${SEP}${row.language}`;
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
      return transaction(() => {
        let moved = 0;
        let merged = 0;
        let movedItems = 0;
        const source = [...knowledge.values()].filter((row) => row.userId === from.userId && row.language === from.language);
        for (const row of source) {
          const existing = getKnowledge(userId, toLanguage, row.key);
          if (!existing) {
            put.knowledge({ ...row, userId, language: toLanguage });
            moved += 1;
          } else {
            const newer = row.updatedAt > existing.updatedAt ? row : existing;
            put.knowledge({
              ...existing,
              state: newer.state,
              label: newer.label,
              translation: newer.translation ?? row.translation ?? existing.translation ?? null,
              note: newer.note ?? row.note ?? existing.note ?? null,
              lookupCount: row.lookupCount + existing.lookupCount,
              updatedAt: newer.updatedAt,
            });
            merged += 1;
          }
        }
        for (const row of source) remove("knowledge", knowledge, learningRowId.knowledge(row));

        const sourceForms = [...forms.values()].filter((row) => row.userId === from.userId && row.language === from.language);
        for (const row of sourceForms) {
          const target = { ...row, userId, language: toLanguage };
          if (!forms.has(learningRowId.forms(target))) put.form(target);
        }
        for (const row of sourceForms) remove("forms", forms, learningRowId.forms(row));

        const sourceItems = [...reviewItems.values()].filter((row) => row.userId === from.userId && row.language === from.language);
        for (const item of sourceItems) {
          const id = item.id.startsWith(`${from.language}:`) ? `${toLanguage}:${item.id.slice(from.language.length + 1)}` : item.id;
          const exists = [...reviewItems.values()].some((row) => row.userId === userId
            && (row.id === id || (row.language === toLanguage && row.key === item.key)));
          if (exists) continue;
          put.reviewItem({ ...item, userId, id, language: toLanguage });
          for (const entry of [...reviewLog.values()]) {
            if (entry.userId !== from.userId || entry.itemId !== item.id) continue;
            remove("reviewLog", reviewLog, learningRowId.reviewLog(entry));
            put.reviewLog({ ...entry, userId, itemId: id });
          }
          movedItems += 1;
        }
        for (const item of sourceItems) remove("reviewItems", reviewItems, learningRowId.reviewItems(item));
        return { moved, merged, reviewItems: movedItems };
      });
    },

    exportUserData(userId): LearningBackup {
      return {
        schema: LEARNING_BACKUP_SCHEMA,
        version: 1,
        exportedAt: now(),
        knowledge: [...knowledge.values()]
          .filter((row) => row.userId === userId)
          .sort((a, b) => compare(a.language, b.language) || compare(a.key, b.key))
          .map(toKnowledge),
        forms: [...forms.values()].filter((row) => row.userId === userId && isKnowledgeState(row.state)).map(strip),
        reviewItems: [...reviewItems.values()].filter((row) => row.userId === userId).map(strip),
        reviewLog: repository.listReviewLog(userId),
        annotations: repository.listAnnotations(userId),
        readingStates: [...readingStates.values()]
          .filter((row) => row.userId === userId)
          .map((row) => ({ ...strip(row), completedChapters: [...row.completedChapters] })),
      };
    },

    importUserData(userId, backup) {
      return transaction(() => {
        let importedKnowledge = 0;
        let importedItems = 0;
        let importedAnnotations = 0;
        for (const record of backup.knowledge) {
          const existing = getKnowledge(userId, record.language, record.key);
          if (existing && existing.updatedAt >= record.updatedAt) continue;
          put.knowledge({
            userId,
            language: record.language,
            key: record.key,
            state: record.state,
            label: record.label,
            translation: record.translation ?? existing?.translation ?? null,
            note: record.note ?? existing?.note ?? null,
            lookupCount: Math.max(record.lookupCount ?? 0, existing?.lookupCount ?? 0),
            updatedAt: record.updatedAt,
          });
          importedKnowledge += 1;
        }
        for (const record of backup.forms) {
          const id = learningRowId.forms({ userId, ...record });
          const existing = forms.get(id);
          if (existing && !(record.updatedAt > existing.updatedAt)) continue;
          put.form({ userId, language: record.language, key: record.key, form: record.form, state: record.state, updatedAt: record.updatedAt });
        }
        for (const item of backup.reviewItems) {
          const existing = reviewItems.get(learningRowId.reviewItems({ userId, id: item.id }));
          if (existing && (existing.lastReviewedAt ?? "") >= (item.lastReviewedAt ?? "")) continue;
          repository.upsertReviewItem(userId, item);
          importedItems += 1;
        }
        for (const entry of backup.reviewLog) {
          if (!reviewLog.has(learningRowId.reviewLog({ userId, ...entry }))) repository.logReview(userId, entry);
        }
        for (const annotation of backup.annotations) {
          const existing = annotations.get(learningRowId.annotations({ userId, id: annotation.id }));
          if (existing && existing.updatedAt >= annotation.updatedAt) continue;
          repository.saveAnnotation(userId, annotation);
          importedAnnotations += 1;
        }
        for (const state of backup.readingStates) {
          const existing = repository.getReadingState(userId, state.documentId);
          if (!existing || existing.updatedAt < state.updatedAt) repository.saveReadingState(userId, state);
        }
        return { knowledge: importedKnowledge, reviewItems: importedItems, annotations: importedAnnotations };
      });
    },

    listReviewItems(userId, language) {
      return [...reviewItems.values()]
        .filter((row) => row.userId === userId && (!language || row.language === language))
        .sort((a, b) => compare(a.dueAt, b.dueAt))
        .map(strip);
    },

    upsertReviewItem(userId, item) {
      transaction(() => {
        const existing = reviewItems.get(learningRowId.reviewItems({ userId, id: item.id }));
        // Like SQLite's ON CONFLICT: identity columns (language, key, type, createdAt) are kept.
        put.reviewItem(existing
          ? {
            ...existing,
            label: item.label, translation: item.translation, context: item.context, contextForm: item.contextForm,
            documentId: item.documentId, sentenceId: item.sentenceId, easeFactor: item.easeFactor,
            intervalDays: item.intervalDays, repetitions: item.repetitions, lapses: item.lapses,
            dueAt: item.dueAt, lastReviewedAt: item.lastReviewedAt,
          }
          : { ...item, userId });
      });
    },

    upsertReviewItems(userId, items) {
      return transaction(() => {
        for (const item of items) repository.upsertReviewItem(userId, item);
        return items.length;
      });
    },

    deleteReviewItem(userId, id) {
      transaction(() => {
        remove("reviewItems", reviewItems, learningRowId.reviewItems({ userId, id }));
        for (const entry of [...reviewLog.values()]) {
          if (entry.userId === userId && entry.itemId === id) remove("reviewLog", reviewLog, learningRowId.reviewLog(entry));
        }
      });
    },

    logReview(userId, entry) {
      transaction(() => put.reviewLog({ ...entry, userId }));
    },

    listReviewLog(userId, itemId): ReviewLogEntry[] {
      return [...reviewLog.values()]
        .filter((row) => row.userId === userId && (!itemId || row.itemId === itemId))
        .sort((a, b) => compare(a.reviewedAt, b.reviewedAt))
        .map(strip);
    },

    listAnnotations(userId, documentId) {
      return [...annotations.values()]
        .filter((row) => row.userId === userId && (!documentId || row.documentId === documentId))
        .sort((a, b) => compare(a.createdAt, b.createdAt))
        .map(strip);
    },

    saveAnnotation(userId, annotation) {
      transaction(() => {
        const existing = annotations.get(learningRowId.annotations({ userId, id: annotation.id }));
        put.annotation(existing
          ? { ...existing, note: annotation.note, category: annotation.category, updatedAt: annotation.updatedAt }
          : { ...annotation, userId });
      });
    },

    deleteAnnotation(userId, id) {
      transaction(() => remove("annotations", annotations, learningRowId.annotations({ userId, id })));
    },

    getReadingState(userId, documentId): LearningReadingState | null {
      const row = readingStates.get(learningRowId.readingStates({ userId, documentId }));
      return row ? { ...strip(row), completedChapters: [...row.completedChapters] } : null;
    },

    saveReadingState(userId, state) {
      transaction(() => put.readingState({ ...state, completedChapters: [...state.completedChapters], userId }));
    },
  };
  return repository;
}
