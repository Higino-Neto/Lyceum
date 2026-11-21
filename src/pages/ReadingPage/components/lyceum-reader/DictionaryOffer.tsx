import { useContext, useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { useTranslation } from "../../../../i18n";
import { DictionaryOfferContext } from "./uiHelpers";
import { getLearningBridge } from "../../../../platform";

interface CatalogEntry {
  id: string;
  name: string;
  sourceLang: string;
  targetLang: string;
  size?: number;
  headwords?: number;
  isDownloaded?: boolean;
}

interface DictionaryApi {
  dictionaryGetIndex?: () => Promise<unknown>;
  dictionaryDownload?: (id: string) => Promise<{ success: boolean; error?: string }>;
  onDictionaryDownloadProgress?: (callback: (data: { dictId: string; progress: number }) => void) => () => void;
}

function dictionaryApi(): DictionaryApi | null {
  return getLearningBridge() as DictionaryApi | null;
}

const FALLBACK_TARGETS = ["en", "es", "fr", "de"];

/**
 * Shown when a word has no translation source: offers the offline dictionary
 * for the reading pair (or a dictionary into English) as a one-click download.
 */
export function DictionaryOffer() {
  const { t } = useTranslation();
  const offer = useContext(DictionaryOfferContext);
  const [entries, setEntries] = useState<CatalogEntry[] | null>(null);
  const [downloading, setDownloading] = useState<{ id: string; progress: number } | null>(null);

  useEffect(() => {
    const api = dictionaryApi();
    if (!offer || !api?.dictionaryGetIndex) return;
    let cancelled = false;
    api.dictionaryGetIndex().then((raw) => {
      if (cancelled || !Array.isArray(raw)) return;
      const catalog = raw as CatalogEntry[];
      const source = offer.source.toLowerCase().split(/[-_]/)[0];
      // Wiktionary packs (targetLang "*") translate into every pack language.
      const packs = catalog.filter((entry) => entry.sourceLang === source && entry.targetLang === "*");
      if (packs.length > 0) {
        setEntries(packs.filter((entry) => !entry.isDownloaded));
        return;
      }
      const exact = catalog.filter((entry) => entry.sourceLang === offer.source && entry.targetLang === offer.target);
      const fallback = catalog
        .filter((entry) => entry.sourceLang === offer.source && entry.targetLang !== offer.target && FALLBACK_TARGETS.includes(entry.targetLang))
        .sort((a, b) => FALLBACK_TARGETS.indexOf(a.targetLang) - FALLBACK_TARGETS.indexOf(b.targetLang))
        .slice(0, 2);
      setEntries([...exact, ...fallback].filter((entry) => !entry.isDownloaded));
    }).catch(() => setEntries([]));
    return () => {
      cancelled = true;
    };
  }, [offer]);

  useEffect(() => {
    if (!downloading) return;
    return dictionaryApi()?.onDictionaryDownloadProgress?.((data) => {
      if (data.dictId === downloading.id) setDownloading({ id: data.dictId, progress: data.progress });
    });
  }, [downloading?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!offer || !entries) return null;
  if (entries.length === 0) return <p className="mt-1 text-[11px] text-foreground-subtle">{t("learning:translation.noDictionaryForPair")}</p>;

  const download = async (entry: CatalogEntry) => {
    const api = dictionaryApi();
    if (!api?.dictionaryDownload) return;
    setDownloading({ id: entry.id, progress: 0 });
    try {
      const result = await api.dictionaryDownload(entry.id);
      if (!result.success) throw new Error(result.error ?? "download failed");
      toast.success(t("learning:translation.dictionaryReady"));
      offer.onInstalled();
    } catch (error) {
      console.error("[LearningReader] dictionary", error);
      toast.error(t("learning:translation.dictionaryFailed"));
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="mt-2 flex flex-col items-start gap-1">
      {entries.map((entry) => (
        <button
          key={entry.id}
          type="button"
          disabled={downloading !== null}
          onClick={() => void download(entry)}
          className="inline-flex items-center gap-1.5 rounded-sm border border-border px-2 py-1 text-xs text-foreground hover:border-primary disabled:opacity-60 cursor-pointer"
        >
          {downloading?.id === entry.id ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
          {downloading?.id === entry.id
            ? t("learning:translation.downloadingDictionary", { progress: Math.round(downloading.progress) })
            : t("learning:translation.downloadDictionary", { name: entry.name })}
          {entry.size ? <span className="text-foreground-subtle">{(entry.size / (1024 * 1024)).toFixed(1)} MB</span> : null}
        </button>
      ))}
    </div>
  );
}
