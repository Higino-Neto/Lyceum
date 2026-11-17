import { useCallback, useMemo } from "react";
import { createDesktopLearningClient, LOCAL_USER_ID, type LearningClient } from "../../../../features/language-learning/learningClient";
import { useAuth } from "../../../../contexts/AuthContext";
import { useLearningSessionCore, type LearningDocumentOpener } from "./useLearningSessionCore";

export type {
  LearningSession,
  ReviewContext,
  SaveStatus,
  SessionStatus,
  StrayBucket,
  OpenedLearningDocument,
  LearningDocumentOpener,
} from "./useLearningSessionCore";

export interface LearningSessionInput {
  fileHash: string;
  filePath?: string;
  language: string | null;
}

export function useLearningUserId() {
  const { user } = useAuth();
  return user?.id ?? LOCAL_USER_ID;
}

/** Desktop session: the main process prepares the document and owns the SQLite vocabulary. */
export function useLearningSession({ fileHash, filePath, language }: LearningSessionInput) {
  const userId = useLearningUserId();
  const client: LearningClient = useMemo(() => createDesktopLearningClient(userId), [userId]);
  const open = useCallback<LearningDocumentOpener>(async (onProgress) => {
    if (!filePath) throw new Error("FILE_NOT_FOUND");
    const unsubscribe = window.api.onLanguageLearningProgress?.((data) => {
      if (data.fileHash === fileHash) onProgress(data.progress, data.stage);
    });
    try {
      const result = await window.api.languageLearningOpen({ filePath, fileHash, language: language ?? undefined });
      if (!result.success) throw new Error("error" in result ? result.error : "UNKNOWN");
      return { document: result.document, metadataLanguage: result.metadataLanguage };
    } finally {
      unsubscribe?.();
    }
  }, [fileHash, filePath, language]);
  return useLearningSessionCore({ userId, client, open });
}
