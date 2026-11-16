import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { AlertTriangle, CloudUpload, FolderOpen, RotateCcw, Unlink } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage, useTranslation } from "../../i18n";
import { LOCAL_USER_ID, createDesktopLearningClient } from "./learningClient";

interface BackupStatus {
  directory: string;
  mirrorDirectory: string | null;
  lastBackupAt: number | null;
  lastMirrorAt: number | null;
  mirrorError: string | null;
  dailyCopies: number;
}

type StatusResult = { success: true; status: BackupStatus } | { success: false; error: string };

interface VocabularyBackupApi {
  languageLearningBackupStatus?: (userId: string) => Promise<StatusResult>;
  languageLearningChooseBackupMirror?: (userId: string) => Promise<StatusResult>;
  languageLearningClearBackupMirror?: (userId: string) => Promise<StatusResult>;
}

function backupApi(): VocabularyBackupApi {
  return (window.api || {}) as unknown as VocabularyBackupApi;
}

/**
 * Vocabulary backups in Settings > Backups. Backups are written automatically
 * after every change; this shows where, when, and lets the user add an extra
 * folder (synced cloud or external drive) so a lost disk cannot erase them.
 */
export function VocabularyBackupSection() {
  const { t } = useTranslation();
  const { locale } = useLanguage();
  const { user } = useAuth();
  const userId = user?.id ?? LOCAL_USER_ID;
  const [status, setStatus] = useState<BackupStatus | null>(null);

  const refresh = useCallback(async () => {
    const result = await backupApi().languageLearningBackupStatus?.(userId);
    if (result && "status" in result) setStatus(result.status);
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!backupApi().languageLearningBackupStatus) return null;

  const client = createDesktopLearningClient(userId);
  const formatDate = (value: number | null) => (value ? new Date(value).toLocaleString(locale) : null);

  const chooseMirror = async () => {
    const result = await backupApi().languageLearningChooseBackupMirror?.(userId);
    if (result && "status" in result) {
      setStatus(result.status);
      toast.success(t("settings:backups.vocabulary.mirrorSaved"));
    } else if (result && "error" in result && result.error !== "CANCELLED") {
      toast.error(t("settings:backups.vocabulary.mirrorFailed"));
    }
  };

  const clearMirror = async () => {
    const result = await backupApi().languageLearningClearBackupMirror?.(userId);
    if (result && "status" in result) setStatus(result.status);
  };

  const restore = async () => {
    const result = await client.importBackup();
    if ("knowledge" in result) {
      toast.success(t("settings:backups.vocabulary.restored", { count: result.knowledge }));
      void refresh();
    } else if ("error" in result && result.error !== "CANCELLED") {
      toast.error(t("settings:backups.vocabulary.restoreFailed"));
    }
  };

  const buttonClass = "inline-flex h-9 items-center gap-2 rounded border border-border-strong bg-surface px-3 text-sm text-foreground hover:bg-surface-muted";

  return (
    <div className="space-y-3 rounded border border-border p-3" data-testid="vocabulary-backup">
      <p className="text-sm text-foreground">
        {status?.lastBackupAt
          ? t("settings:backups.vocabulary.lastBackup", { date: formatDate(status.lastBackupAt), count: status.dailyCopies })
          : t("settings:backups.vocabulary.noBackupYet")}
      </p>
      <div className="text-xs text-foreground-subtle">
        {status?.mirrorDirectory ? (
          <p>
            {t("settings:backups.vocabulary.mirrorAt", { path: status.mirrorDirectory })}
            {status.lastMirrorAt ? ` · ${t("settings:backups.vocabulary.mirrorUpdated", { date: formatDate(status.lastMirrorAt) })}` : ""}
          </p>
        ) : (
          <p className="flex items-center gap-1.5 text-warning">
            <AlertTriangle size={13} />
            {t("settings:backups.vocabulary.noMirror")}
          </p>
        )}
        {status?.mirrorError && (
          <p className="mt-1 text-destructive">{t("settings:backups.vocabulary.mirrorError", { error: status.mirrorError })}</p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void chooseMirror()} className={buttonClass}>
          <CloudUpload size={14} />
          {status?.mirrorDirectory ? t("settings:backups.vocabulary.changeMirror") : t("settings:backups.vocabulary.chooseMirror")}
        </button>
        {status?.mirrorDirectory && (
          <button type="button" onClick={() => void clearMirror()} className={buttonClass}>
            <Unlink size={14} />
            {t("settings:backups.vocabulary.removeMirror")}
          </button>
        )}
        <button type="button" onClick={() => void client.openBackupsFolder()} className={buttonClass}>
          <FolderOpen size={14} />
          {t("settings:backups.vocabulary.openFolder")}
        </button>
        <button type="button" onClick={() => void restore()} className={buttonClass}>
          <RotateCcw size={14} />
          {t("settings:backups.vocabulary.restore")}
        </button>
      </div>
    </div>
  );
}
