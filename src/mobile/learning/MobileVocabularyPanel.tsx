import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Download, GraduationCap, Upload } from "lucide-react";
import { getActiveLocale, useTranslation } from "../../i18n";
import { getCurrentSession } from "../../lib/supabaseAuth";
import { LOCAL_USER_ID } from "../../features/language-learning/learningClient";
import { getMobileLearningClient, vocabularySummary } from "./learningRuntime";
import { VocabularySyncCard } from "../../features/device-sync/VocabularySyncCard";

function languageName(code: string) {
  try {
    return new Intl.DisplayNames([getActiveLocale()], { type: "language" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** Profile section: vocabulary per language, manual export and import (desktop-compatible JSON). */
export default function MobileVocabularyPanel() {
  const { t } = useTranslation();
  const [userId, setUserId] = useState<string | null>(null);
  const [summary, setSummary] = useState<Array<{ language: string; known: number; learning: number }> | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async (id: string) => {
    setSummary(await vocabularySummary(id).catch(() => []));
  }, []);

  useEffect(() => {
    let cancelled = false;
    void getCurrentSession().catch(() => null).then((session) => {
      if (cancelled) return;
      const id = session?.user.id ?? LOCAL_USER_ID;
      setUserId(id);
      void refresh(id);
    });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const exportVocabulary = async () => {
    if (!userId) return;
    setBusy(true);
    const result = await getMobileLearningClient(userId).exportBackup();
    setBusy(false);
    if (result.success) toast.success(t("mobile:learning.exported", { path: result.path }));
    else toast.error(t("mobile:learning.exportFailed"));
  };

  const importVocabulary = async () => {
    if (!userId) return;
    setBusy(true);
    const result = await getMobileLearningClient(userId).importBackup();
    setBusy(false);
    if ("error" in result) {
      if (result.error === "CANCELLED") toast(t("mobile:learning.importCancelled"));
      else toast.error(result.error === "INVALID_BACKUP" ? t("mobile:learning.importInvalid") : result.error);
      return;
    }
    toast.success(t("mobile:learning.imported", { count: result.knowledge }));
    void refresh(userId);
  };

  return (
    <section className="space-y-3 rounded-xl border border-border bg-surface p-4">
      <h2 className="flex items-center gap-2 font-semibold"><GraduationCap size={18} className="text-primary" />{t("mobile:learning.profileTitle")}</h2>
      <p className="text-sm text-foreground-muted">{t("mobile:learning.profileBody")}</p>
      {summary && summary.length === 0 && <p className="text-sm text-foreground-subtle">{t("mobile:learning.profileEmpty")}</p>}
      {summary && summary.length > 0 && (
        <ul className="space-y-1 text-sm text-foreground">
          {summary.map((entry) => (
            <li key={entry.language}>{t("mobile:learning.profileCounts", { language: languageName(entry.language), known: entry.known, learning: entry.learning })}</li>
          ))}
        </ul>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" disabled={busy} onClick={() => void exportVocabulary()} className="mobile-choice flex items-center justify-center gap-2 px-3"><Download size={16} />{t("mobile:learning.exportVocabulary")}</button>
        <button type="button" disabled={busy} onClick={() => void importVocabulary()} className="mobile-choice flex items-center justify-center gap-2 px-3"><Upload size={16} />{t("mobile:learning.importVocabulary")}</button>
      </div>
      <div className="border-t border-border pt-3">
        <VocabularySyncCard
          signedIn={Boolean(userId && userId !== LOCAL_USER_ID)}
          buttonClassName="mobile-choice flex w-full items-center justify-center gap-2 px-3"
          onSynced={() => { if (userId) void refresh(userId); }}
        />
      </div>
    </section>
  );
}
