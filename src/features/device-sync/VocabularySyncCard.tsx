import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import { useTranslation } from "../../i18n";
import { describeSyncError, getDeviceSyncStatus, runDeviceSync, subscribeDeviceSyncStatus } from "./syncController";

/** Status and "Sync now" for device sync; shared by desktop settings and the mobile profile. */
export function VocabularySyncCard({ signedIn, buttonClassName, onSynced }: { signedIn: boolean; buttonClassName: string; onSynced?: () => void }) {
  const { t, i18n } = useTranslation();
  const [status, setStatus] = useState(getDeviceSyncStatus);
  useEffect(() => subscribeDeviceSyncStatus(setStatus), []);

  const syncNow = async () => {
    try {
      await runDeviceSync({ vocabulary: "force" });
      const latest = getDeviceSyncStatus();
      if (latest.error) toast.error(t("sync:errors.generic", { error: latest.error }));
      else toast.success(t("sync:vocabulary.done"));
      onSynced?.();
    } catch (error) {
      toast.error(t("sync:errors.generic", { error: describeSyncError(error) }));
    }
  };

  const lastSync = status.lastVocabularySync
    ? t("sync:vocabulary.lastSync", { time: new Date(status.lastVocabularySync).toLocaleString(i18n.language) })
    : t("sync:vocabulary.never");

  return (
    <div className="space-y-2" data-testid="vocabulary-sync">
      <p className="text-sm font-semibold text-foreground">{t("sync:vocabulary.title")}</p>
      <p className="text-xs text-foreground-subtle">{signedIn ? t("sync:vocabulary.description") : t("sync:vocabulary.signInRequired")}</p>
      {signedIn && (
        <>
          <p className="text-xs text-foreground-muted">{lastSync}</p>
          {status.error && <p className="text-xs text-destructive">{status.error}</p>}
          <button type="button" disabled={status.syncing} onClick={() => void syncNow()} className={buttonClassName}>
            <RefreshCw size={14} className={status.syncing ? "animate-spin" : undefined} />
            {status.syncing ? t("sync:vocabulary.syncing") : t("sync:vocabulary.syncNow")}
          </button>
        </>
      )}
    </div>
  );
}
