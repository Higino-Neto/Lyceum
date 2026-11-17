import type { LanguageLearningRepository, LearningBackup, LearningImportResult } from "../../core/language-learning/model";
import { isLearningBackup } from "../../core/language-learning/model";
import { LOCAL_USER_ID, type LearningClient } from "./learningClient";

/**
 * Platform services around a synchronous repository living in the renderer
 * (the WebView builds keep vocabulary in memory and persist it themselves).
 */
export interface RepositoryLearningHost {
  repository(): Promise<LanguageLearningRepository>;
  /** Resolves when the writes made so far are durable. */
  flush(): Promise<void>;
  /** Called after each durable write (e.g. to schedule an automatic backup). */
  afterWrite?(userId: string): void;
  saveBackupFile(userId: string, backup: LearningBackup): Promise<string>;
  /** Lets the user choose a backup file; resolves with its parsed JSON, or null if cancelled. */
  pickBackupFile(): Promise<unknown | null>;
  openBackupsFolder?(userId: string): Promise<unknown>;
}

/** {@link LearningClient} over a renderer-side repository, bound to one user. */
export function createRepositoryLearningClient(host: RepositoryLearningHost, userId: string): LearningClient {
  async function read<T>(run: (repo: LanguageLearningRepository) => T): Promise<T> {
    return run(await host.repository());
  }
  async function write<T>(run: (repo: LanguageLearningRepository) => T): Promise<T> {
    const result = run(await host.repository());
    await host.flush();
    host.afterWrite?.(userId);
    return result;
  }

  return {
    loadKnowledge: (language) => read((repo) => repo.loadKnowledge(userId, language)),
    setLemmaState: (record) => write((repo) => repo.setLemmaState(userId, record)),
    setLemmaStates: (records) => write((repo) => repo.setLemmaStates(userId, records)),
    knowledgeBuckets: () => read((repo) => repo.listKnowledgeBuckets(userId === LOCAL_USER_ID ? [userId] : [userId, LOCAL_USER_ID])),
    mergeKnowledge: (fromUserId, fromLanguage, toLanguage) =>
      write((repo) => repo.mergeKnowledge(userId, { userId: fromUserId, language: fromLanguage }, toLanguage)),
    async exportBackup() {
      try {
        const backup = await read((repo) => repo.exportUserData(userId));
        return { success: true as const, path: await host.saveBackupFile(userId, backup) };
      } catch (error) {
        return { success: false as const, error: error instanceof Error ? error.message : String(error) };
      }
    },
    async importBackup(): Promise<({ success: true } & LearningImportResult) | { success: false; error: string }> {
      try {
        const raw = await host.pickBackupFile();
        if (raw === null) return { success: false, error: "CANCELLED" };
        if (!isLearningBackup(raw)) return { success: false, error: "INVALID_BACKUP" };
        const result = await write((repo) => repo.importUserData(userId, raw));
        return { success: true, ...result };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    },
    openBackupsFolder: () => host.openBackupsFolder?.(userId) ?? Promise.resolve(null),
    setFormState: (record) => write((repo) => repo.setFormState(userId, record)),
    clearFormState: (language, key, form) => write((repo) => repo.clearFormState(userId, language, key, form)),
    recordLookup: (language, key, label) => write((repo) => repo.recordLookup(userId, language, key, label)),
    setTranslation: (language, key, label, translation) => write((repo) => repo.setTranslation(userId, language, key, label, translation)),
    listReviewItems: (language) => read((repo) => repo.listReviewItems(userId, language)),
    upsertReviewItem: (item) => write((repo) => repo.upsertReviewItem(userId, item)),
    upsertReviewItems: (items) => write((repo) => repo.upsertReviewItems(userId, items)),
    deleteReviewItem: (id) => write((repo) => repo.deleteReviewItem(userId, id)),
    logReview: (entry) => write((repo) => repo.logReview(userId, entry)),
    listReviewLog: (itemId) => read((repo) => repo.listReviewLog(userId, itemId)),
    listAnnotations: (documentId) => read((repo) => repo.listAnnotations(userId, documentId)),
    saveAnnotation: (annotation) => write((repo) => repo.saveAnnotation(userId, annotation)),
    deleteAnnotation: (id) => write((repo) => repo.deleteAnnotation(userId, id)),
    getReadingState: (documentId) => read((repo) => repo.getReadingState(userId, documentId)),
    saveReadingState: (state) => write((repo) => repo.saveReadingState(userId, state)),
  };
}
