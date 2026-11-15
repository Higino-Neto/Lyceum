import type {
  KnowledgeRecord,
  KnowledgeSnapshot,
  KnowledgeState,
  LearningAnnotation,
  LearningReadingState,
  ReviewItem,
  ReviewLogEntry,
  FormKnowledgeRecord,
  KnowledgeBucket,
  KnowledgeMergeResult,
  LearningImportResult,
} from "../../core/language-learning/model";

/**
 * Renderer-side port for user learning data, bound to one user. Implemented
 * over `window.api` on desktop; tests can provide an in-memory version.
 */
export interface LearningClient {
  loadKnowledge(language: string): Promise<KnowledgeSnapshot>;
  setLemmaState(record: { language: string; key: string; state: KnowledgeState; label: string; translation?: string | null }): Promise<KnowledgeRecord>;
  setLemmaStates(records: Array<{ language: string; key: string; state: KnowledgeState; label: string }>): Promise<number>;
  /** Buckets of this user and of the signed-out profile, to detect vocabulary filed elsewhere. */
  knowledgeBuckets(): Promise<KnowledgeBucket[]>;
  mergeKnowledge(fromUserId: string, fromLanguage: string, toLanguage: string): Promise<KnowledgeMergeResult>;
  exportBackup(): Promise<{ success: true; path: string } | { success: false; error: string }>;
  importBackup(): Promise<({ success: true } & LearningImportResult) | { success: false; error: string }>;
  openBackupsFolder(): Promise<unknown>;
  setFormState(record: { language: string; key: string; form: string; state: KnowledgeState }): Promise<FormKnowledgeRecord>;
  clearFormState(language: string, key: string, form: string): Promise<void>;
  recordLookup(language: string, key: string, label: string): Promise<void>;
  setTranslation(language: string, key: string, label: string, translation: string | null): Promise<void>;
  listReviewItems(language?: string): Promise<ReviewItem[]>;
  upsertReviewItem(item: ReviewItem): Promise<void>;
  upsertReviewItems(items: ReviewItem[]): Promise<number>;
  deleteReviewItem(id: string): Promise<void>;
  logReview(entry: ReviewLogEntry): Promise<void>;
  listReviewLog(itemId?: string): Promise<ReviewLogEntry[]>;
  listAnnotations(documentId?: string): Promise<LearningAnnotation[]>;
  saveAnnotation(annotation: LearningAnnotation): Promise<void>;
  deleteAnnotation(id: string): Promise<void>;
  getReadingState(documentId: string): Promise<LearningReadingState | null>;
  saveReadingState(state: LearningReadingState): Promise<void>;
}

export const LOCAL_USER_ID = "local";

export function createDesktopLearningClient(userId: string): LearningClient {
  const api = window.api;
  return {
    loadKnowledge: (language) => api.languageLearningLoadKnowledge(userId, language),
    setLemmaState: (record) => api.languageLearningSetLemmaState(userId, record),
    setLemmaStates: (records) => api.languageLearningSetLemmaStates(userId, records),
    knowledgeBuckets: () => api.languageLearningKnowledgeBuckets(userId === LOCAL_USER_ID ? [userId] : [userId, LOCAL_USER_ID]),
    mergeKnowledge: (fromUserId, fromLanguage, toLanguage) => api.languageLearningMergeKnowledge(userId, fromUserId, fromLanguage, toLanguage),
    exportBackup: () => api.languageLearningExportBackup(userId),
    importBackup: () => api.languageLearningImportBackup(userId),
    openBackupsFolder: () => api.languageLearningOpenBackupsFolder(userId),
    setFormState: (record) => api.languageLearningSetFormState(userId, record),
    clearFormState: (language, key, form) => api.languageLearningClearFormState(userId, language, key, form),
    recordLookup: (language, key, label) => api.languageLearningRecordLookup(userId, language, key, label),
    setTranslation: (language, key, label, translation) => api.languageLearningSetTranslation(userId, language, key, label, translation),
    listReviewItems: (language) => api.languageLearningListReviewItems(userId, language),
    upsertReviewItem: (item) => api.languageLearningUpsertReviewItem(userId, item),
    upsertReviewItems: (items) => api.languageLearningUpsertReviewItems(userId, items),
    deleteReviewItem: (id) => api.languageLearningDeleteReviewItem(userId, id),
    logReview: (entry) => api.languageLearningLogReview(userId, entry),
    listReviewLog: (itemId) => api.languageLearningListReviewLog(userId, itemId),
    listAnnotations: (documentId) => api.languageLearningListAnnotations(userId, documentId),
    saveAnnotation: (annotation) => api.languageLearningSaveAnnotation(userId, annotation),
    deleteAnnotation: (id) => api.languageLearningDeleteAnnotation(userId, id),
    getReadingState: (documentId) => api.languageLearningGetReadingState(userId, documentId),
    saveReadingState: (state) => api.languageLearningSaveReadingState(userId, state),
  };
}
