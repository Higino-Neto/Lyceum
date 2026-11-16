import type { IpcMain } from "electron";
import {
  isKnowledgeState,
  type AnnotationTarget,
  type ExerciseType,
  type LanguageLearningRepository,
  type LearningAnnotation,
  type LearningReadingState,
  type LinguisticDocument,
  type ReviewItem,
  type ReviewLogEntry,
  type LearningImportResult,
} from "../../src/core/language-learning/model";
import { nonEmptyString, record, stringArray } from "../ipc/validation";

export interface OpenLearningDocumentInput {
  filePath: string;
  fileHash: string;
  language?: string;
  force?: boolean;
}

export interface OpenLearningDocumentResult {
  document: LinguisticDocument;
  packageRoot: string;
  language: string;
  metadataLanguage: string | null;
  detectedLanguage?: string | null;
  reused: boolean;
}

export interface LanguageLearningHandlerDependencies {
  repository: LanguageLearningRepository;
  openDocument(input: OpenLearningDocumentInput): Promise<OpenLearningDocumentResult>;
  /** Optional online translation (opt-in in the renderer settings). */
  translateOnline?(text: string, source: string, target: string): Promise<string>;
  /** Called after every change to a user's learning data (automatic backups). */
  onUserDataChanged?(userId: string): void;
  backups?: {
    exportToFile(userId: string): Promise<string | null>;
    importFromFile(userId: string): Promise<LearningImportResult | null>;
    openFolder(userId: string): Promise<void>;
    /** Where backups live, when they were last written and the extra mirror folder. */
    status?(userId: string): LearningBackupStatusView;
    /** Lets the user pick an extra folder (e.g. synced cloud folder) mirroring the backups. */
    chooseMirror?(userId: string): Promise<LearningBackupStatusView | null>;
    clearMirror?(userId: string): LearningBackupStatusView;
  };
}

export interface LearningBackupStatusView {
  directory: string;
  mirrorDirectory: string | null;
  lastBackupAt: number | null;
  lastMirrorAt: number | null;
  mirrorError: string | null;
  dailyCopies: number;
}

export const MAX_ONLINE_TRANSLATION_LENGTH = 500;

const ANNOTATION_TARGETS: AnnotationTarget[] = ["token", "expression", "sentence", "block"];
const EXERCISES: ExerciseType[] = ["recognition", "recall", "cloze", "listening", "production"];

function userId(value: unknown) {
  return nonEmptyString(value, "userId", 200);
}

function language(value: unknown) {
  return nonEmptyString(value, "language", 16);
}

function key(value: unknown) {
  return nonEmptyString(value, "key", 300);
}

function finiteNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${field} must be a finite number`);
  return value;
}

function knowledgeState(value: unknown) {
  if (!isKnowledgeState(value)) throw new Error("state must be a knowledge state");
  return value;
}

/** Free text that may be empty; null/undefined become null. */
function freeText(value: unknown, field: string, max = 4000): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new Error(`${field} must be a string`);
  if (value.length > max) throw new Error(`${field} must contain at most ${max} characters`);
  const trimmed = value.trim();
  return trimmed || null;
}

function optionalText(value: unknown, field: string, max = 4000) {
  return value === undefined ? undefined : freeText(value, field, max);
}

function validLemmaRecord(input: Record<string, unknown>) {
  return {
    language: language(input.language),
    key: key(input.key),
    state: knowledgeState(input.state),
    label: nonEmptyString(input.label, "label", 300),
    translation: optionalText(input.translation, "translation", 2000),
    note: optionalText(input.note, "note"),
  };
}

function validReviewItem(value: unknown): ReviewItem {
  const item = record(value, "item");
  const itemType = item.itemType === "expression" ? "expression" : "lexeme";
  return {
    id: nonEmptyString(item.id, "item.id", 400),
    language: language(item.language),
    key: key(item.key),
    itemType,
    label: nonEmptyString(item.label, "item.label", 300),
    translation: freeText(item.translation, "item.translation", 2000),
    context: freeText(item.context, "item.context", 4000),
    contextForm: freeText(item.contextForm, "item.contextForm", 300),
    documentId: freeText(item.documentId, "item.documentId", 300),
    sentenceId: freeText(item.sentenceId, "item.sentenceId", 300),
    easeFactor: finiteNumber(item.easeFactor, "item.easeFactor"),
    intervalDays: finiteNumber(item.intervalDays, "item.intervalDays"),
    repetitions: finiteNumber(item.repetitions, "item.repetitions"),
    lapses: finiteNumber(item.lapses, "item.lapses"),
    dueAt: nonEmptyString(item.dueAt, "item.dueAt", 40),
    createdAt: nonEmptyString(item.createdAt, "item.createdAt", 40),
    lastReviewedAt: freeText(item.lastReviewedAt, "item.lastReviewedAt", 40),
  };
}

function validReviewLog(value: unknown): ReviewLogEntry {
  const entry = record(value, "entry");
  if (!EXERCISES.includes(entry.exercise as ExerciseType)) throw new Error("entry.exercise is invalid");
  return {
    itemId: nonEmptyString(entry.itemId, "entry.itemId", 400),
    reviewedAt: nonEmptyString(entry.reviewedAt, "entry.reviewedAt", 40),
    grade: finiteNumber(entry.grade, "entry.grade"),
    exercise: entry.exercise as ExerciseType,
    correct: entry.correct === true,
    intervalBefore: finiteNumber(entry.intervalBefore, "entry.intervalBefore"),
    intervalAfter: finiteNumber(entry.intervalAfter, "entry.intervalAfter"),
  };
}

function validAnnotation(value: unknown): LearningAnnotation {
  const annotation = record(value, "annotation");
  if (!ANNOTATION_TARGETS.includes(annotation.targetType as AnnotationTarget)) throw new Error("annotation.targetType is invalid");
  return {
    id: nonEmptyString(annotation.id, "annotation.id", 200),
    documentId: nonEmptyString(annotation.documentId, "annotation.documentId", 300),
    targetType: annotation.targetType as AnnotationTarget,
    targetId: nonEmptyString(annotation.targetId, "annotation.targetId", 300),
    chapterId: nonEmptyString(annotation.chapterId, "annotation.chapterId", 300),
    quote: nonEmptyString(annotation.quote, "annotation.quote", 8000),
    note: freeText(annotation.note, "annotation.note", 8000) ?? "",
    category: freeText(annotation.category, "annotation.category", 80) ?? "",
    createdAt: nonEmptyString(annotation.createdAt, "annotation.createdAt", 40),
    updatedAt: nonEmptyString(annotation.updatedAt, "annotation.updatedAt", 40),
  };
}

function validReadingState(value: unknown): LearningReadingState {
  const state = record(value, "state");
  return {
    documentId: nonEmptyString(state.documentId, "state.documentId", 300),
    chapterId: nonEmptyString(state.chapterId, "state.chapterId", 300),
    blockId: freeText(state.blockId, "state.blockId", 300),
    progress: Math.max(0, Math.min(1, finiteNumber(state.progress, "state.progress"))),
    completedChapters: stringArray(state.completedChapters ?? [], "state.completedChapters", 5000),
    secondsRead: Math.max(0, Math.round(finiteNumber(state.secondsRead, "state.secondsRead"))),
    sessions: Math.max(0, Math.round(finiteNumber(state.sessions, "state.sessions"))),
    updatedAt: nonEmptyString(state.updatedAt, "state.updatedAt", 40),
  };
}

export function registerLanguageLearningHandlers(ipcMain: IpcMain, dependencies: LanguageLearningHandlerDependencies) {
  const { repository } = dependencies;
  /** Runs a mutation for a user and notifies the backup service. */
  const track = <T>(rawUser: unknown, run: (user: string) => T): T => {
    const user = userId(rawUser);
    const result = run(user);
    dependencies.onUserDataChanged?.(user);
    return result;
  };

  ipcMain.handle("language-learning:open", async (_, rawInput: unknown) => {
    const input = record(rawInput, "input");
    try {
      const result = await dependencies.openDocument({
        filePath: nonEmptyString(input.filePath, "filePath", 4096),
        fileHash: nonEmptyString(input.fileHash, "fileHash", 200),
        language: input.language === undefined || input.language === null ? undefined : language(input.language),
        force: input.force === true,
      });
      return { success: true as const, ...result };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false as const, error: message };
    }
  });

  ipcMain.handle("language-learning:translate-online", async (_, rawText: unknown, rawSource: unknown, rawTarget: unknown) => {
    if (!dependencies.translateOnline) return { success: false as const, error: "UNAVAILABLE" };
    try {
      const text = nonEmptyString(rawText, "text", MAX_ONLINE_TRANSLATION_LENGTH);
      const translation = await dependencies.translateOnline(text, language(rawSource), language(rawTarget));
      return { success: true as const, translation };
    } catch (error) {
      return { success: false as const, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle("language-learning:load-knowledge", (_, rawUser: unknown, rawLanguage: unknown) =>
    repository.loadKnowledge(userId(rawUser), language(rawLanguage)));

  ipcMain.handle("language-learning:set-lemma-state", (_, rawUser: unknown, rawRecord: unknown) => {
    const input = record(rawRecord, "record");
    const valid = validLemmaRecord(input);
    return track(rawUser, (user) => repository.setLemmaState(user, valid));
  });

  ipcMain.handle("language-learning:set-lemma-states", (_, rawUser: unknown, rawRecords: unknown) => {
    if (!Array.isArray(rawRecords) || rawRecords.length > 50_000) throw new Error("records must be an array of at most 50000 items");
    const valid = rawRecords.map((item) => validLemmaRecord(record(item, "record")));
    return track(rawUser, (user) => repository.setLemmaStates(user, valid));
  });

  ipcMain.handle("language-learning:set-form-state", (_, rawUser: unknown, rawRecord: unknown) => {
    const input = record(rawRecord, "record");
    const valid = {
      language: language(input.language),
      key: key(input.key),
      form: nonEmptyString(input.form, "form", 300),
      state: knowledgeState(input.state),
    };
    return track(rawUser, (user) => repository.setFormState(user, valid));
  });

  ipcMain.handle("language-learning:clear-form-state", (_, rawUser: unknown, rawLanguage: unknown, rawKey: unknown, rawForm: unknown) =>
    track(rawUser, (user) => repository.clearFormState(user, language(rawLanguage), key(rawKey), nonEmptyString(rawForm, "form", 300))));

  ipcMain.handle("language-learning:record-lookup", (_, rawUser: unknown, rawLanguage: unknown, rawKey: unknown, rawLabel: unknown) =>
    repository.recordLookup(userId(rawUser), language(rawLanguage), key(rawKey), nonEmptyString(rawLabel, "label", 300)));

  ipcMain.handle("language-learning:set-translation", (_, rawUser: unknown, rawLanguage: unknown, rawKey: unknown, rawLabel: unknown, rawTranslation: unknown) =>
    track(rawUser, (user) => repository.setTranslation(
      user, language(rawLanguage), key(rawKey), nonEmptyString(rawLabel, "label", 300),
      freeText(rawTranslation, "translation", 2000),
    )));

  ipcMain.handle("language-learning:knowledge-buckets", (_, rawUsers: unknown) =>
    repository.listKnowledgeBuckets(stringArray(rawUsers, "userIds", 10).map(userId)));

  ipcMain.handle("language-learning:merge-knowledge", (_, rawUser: unknown, rawFromUser: unknown, rawFromLanguage: unknown, rawToLanguage: unknown) =>
    track(rawUser, (user) => {
      const fromUser = userId(rawFromUser);
      const result = repository.mergeKnowledge(user, { userId: fromUser, language: language(rawFromLanguage) }, language(rawToLanguage));
      if (fromUser !== user) dependencies.onUserDataChanged?.(fromUser);
      return result;
    }));

  ipcMain.handle("language-learning:list-review-items", (_, rawUser: unknown, rawLanguage?: unknown) =>
    repository.listReviewItems(userId(rawUser), rawLanguage === undefined || rawLanguage === null ? undefined : language(rawLanguage)));

  ipcMain.handle("language-learning:upsert-review-item", (_, rawUser: unknown, rawItem: unknown) => {
    const item = validReviewItem(rawItem);
    return track(rawUser, (user) => repository.upsertReviewItem(user, item));
  });

  ipcMain.handle("language-learning:upsert-review-items", (_, rawUser: unknown, rawItems: unknown) => {
    if (!Array.isArray(rawItems) || rawItems.length > 50_000) throw new Error("items must be an array of at most 50000 items");
    const items = rawItems.map(validReviewItem);
    return track(rawUser, (user) => repository.upsertReviewItems(user, items));
  });

  ipcMain.handle("language-learning:delete-review-item", (_, rawUser: unknown, rawId: unknown) =>
    track(rawUser, (user) => repository.deleteReviewItem(user, nonEmptyString(rawId, "id", 400))));

  ipcMain.handle("language-learning:log-review", (_, rawUser: unknown, rawEntry: unknown) => {
    const entry = validReviewLog(rawEntry);
    return track(rawUser, (user) => repository.logReview(user, entry));
  });

  ipcMain.handle("language-learning:list-review-log", (_, rawUser: unknown, rawItemId?: unknown) =>
    repository.listReviewLog(userId(rawUser), rawItemId === undefined || rawItemId === null ? undefined : nonEmptyString(rawItemId, "itemId", 400)));

  ipcMain.handle("language-learning:list-annotations", (_, rawUser: unknown, rawDocumentId?: unknown) =>
    repository.listAnnotations(userId(rawUser), rawDocumentId === undefined || rawDocumentId === null ? undefined : nonEmptyString(rawDocumentId, "documentId", 300)));

  ipcMain.handle("language-learning:save-annotation", (_, rawUser: unknown, rawAnnotation: unknown) => {
    const annotation = validAnnotation(rawAnnotation);
    return track(rawUser, (user) => repository.saveAnnotation(user, annotation));
  });

  ipcMain.handle("language-learning:delete-annotation", (_, rawUser: unknown, rawId: unknown) =>
    track(rawUser, (user) => repository.deleteAnnotation(user, nonEmptyString(rawId, "id", 200))));

  ipcMain.handle("language-learning:get-reading-state", (_, rawUser: unknown, rawDocumentId: unknown) =>
    repository.getReadingState(userId(rawUser), nonEmptyString(rawDocumentId, "documentId", 300)));

  ipcMain.handle("language-learning:save-reading-state", (_, rawUser: unknown, rawState: unknown) => {
    const state = validReadingState(rawState);
    return track(rawUser, (user) => repository.saveReadingState(user, state));
  });

  ipcMain.handle("language-learning:export-backup", async (_, rawUser: unknown) => {
    if (!dependencies.backups) return { success: false as const, error: "UNAVAILABLE" };
    try {
      const path = await dependencies.backups.exportToFile(userId(rawUser));
      return path ? { success: true as const, path } : { success: false as const, error: "CANCELLED" };
    } catch (error) {
      return { success: false as const, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle("language-learning:import-backup", async (_, rawUser: unknown) => {
    if (!dependencies.backups) return { success: false as const, error: "UNAVAILABLE" };
    try {
      const user = userId(rawUser);
      const result = await dependencies.backups.importFromFile(user);
      if (!result) return { success: false as const, error: "CANCELLED" };
      dependencies.onUserDataChanged?.(user);
      return { success: true as const, ...result };
    } catch (error) {
      return { success: false as const, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle("language-learning:open-backups-folder", async (_, rawUser: unknown) => {
    if (!dependencies.backups) return { success: false as const, error: "UNAVAILABLE" };
    await dependencies.backups.openFolder(userId(rawUser));
    return { success: true as const };
  });

  ipcMain.handle("language-learning:backup-status", (_, rawUser: unknown) => {
    if (!dependencies.backups?.status) return { success: false as const, error: "UNAVAILABLE" };
    return { success: true as const, status: dependencies.backups.status(userId(rawUser)) };
  });

  ipcMain.handle("language-learning:choose-backup-mirror", async (_, rawUser: unknown) => {
    if (!dependencies.backups?.chooseMirror) return { success: false as const, error: "UNAVAILABLE" };
    try {
      const status = await dependencies.backups.chooseMirror(userId(rawUser));
      return status ? { success: true as const, status } : { success: false as const, error: "CANCELLED" };
    } catch (error) {
      return { success: false as const, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle("language-learning:clear-backup-mirror", (_, rawUser: unknown) => {
    if (!dependencies.backups?.clearMirror) return { success: false as const, error: "UNAVAILABLE" };
    return { success: true as const, status: dependencies.backups.clearMirror(userId(rawUser)) };
  });
}
