import { useCallback, useEffect, useState } from "react";
import { FolderSearch, HardDrive, LoaderCircle, ShieldCheck, Sparkles, X } from "lucide-react";
import toast from "react-hot-toast";
import AnimatedModal from "../../../../components/ui/AnimatedModal";
import { useTranslation } from "../../../../i18n";
import { readSmartSearchConsent, writeSmartSearchConsent, type SmartSearchConsent } from "./smartSearchConsent";

type Suggestion = { path: string; bookCount: number; ebookCount: number; pdfCount: number; recommended?: boolean };

/**
 * Opt-in "smart search": with the user's permission, scans the home folder
 * locally and suggests folders full of books to add as source folders.
 */
export default function SourceFolderSuggestionsDialog({
  open,
  onClose,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: () => Promise<void> | void;
}) {
  const { t } = useTranslation();
  const [consent, setConsent] = useState<SmartSearchConsent>(readSmartSearchConsent);
  const [scanning, setScanning] = useState(false);
  const [adding, setAdding] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  const [truncated, setTruncated] = useState(false);

  const scan = useCallback(async () => {
    if (!window.api?.suggestSourceFolders) return;
    setScanning(true);
    setSuggestions(null);
    try {
      const result = await window.api.suggestSourceFolders();
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setSuggestions(result.suggestions);
      setChecked(new Set(result.suggestions.filter((item) => item.recommended !== false).map((item) => item.path)));
      setTruncated(result.truncated);
    } finally {
      setScanning(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const current = readSmartSearchConsent();
    setConsent(current);
    if (current === "granted") void scan();
  }, [open, scan]);

  const allow = () => {
    writeSmartSearchConsent("granted");
    setConsent("granted");
    void scan();
  };

  const decline = () => {
    writeSmartSearchConsent("declined");
    setConsent("declined");
    onClose();
  };

  const addSelected = async () => {
    if (!window.api?.addSourceFolder || checked.size === 0) return;
    setAdding(true);
    let added = 0;
    try {
      for (const folderPath of checked) {
        const result = await window.api.addSourceFolder(folderPath);
        if (result.success) added += 1;
      }
    } finally {
      setAdding(false);
    }
    if (added > 0) toast.success(t("library:smartSearch.added", { count: added }));
    await onAdded();
    onClose();
  };

  const toggle = (folderPath: string) => {
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(folderPath)) next.delete(folderPath);
      else next.add(folderPath);
      return next;
    });
  };

  return (
    <AnimatedModal
      open={open}
      ariaLabelledBy="smart-search-title"
      onBackdropClick={onClose}
      className="mx-4 flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-sm border border-border bg-surface shadow-2xl"
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-primary" />
          <h2 id="smart-search-title" className="text-sm font-semibold text-foreground">
            {t("library:smartSearch.title")}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("common:actions.close")}
          className="rounded-sm p-1.5 text-foreground-muted hover:bg-surface-muted hover:text-foreground"
        >
          <X size={16} />
        </button>
      </div>

      {consent !== "granted" ? (
        <div className="space-y-4 p-4">
          <p className="text-sm leading-6 text-foreground-muted">{t("library:smartSearch.consentMessage")}</p>
          <p className="flex items-start gap-2 rounded-sm bg-surface-muted px-3 py-2 text-xs leading-5 text-foreground-muted">
            <ShieldCheck size={14} className="mt-0.5 flex-shrink-0 text-primary" />
            {t("library:smartSearch.privacy")}
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={decline} className="h-9 rounded-sm px-3 text-sm text-foreground-muted hover:bg-surface-muted hover:text-foreground">
              {t("library:smartSearch.notNow")}
            </button>
            <button type="button" onClick={allow} autoFocus className="h-9 rounded-sm bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover">
              {t("library:smartSearch.allow")}
            </button>
          </div>
        </div>
      ) : scanning ? (
        <div className="flex flex-col items-center justify-center gap-3 px-4 py-12 text-sm text-foreground-muted">
          <LoaderCircle size={22} className="animate-spin text-primary" />
          {t("library:smartSearch.scanning")}
        </div>
      ) : suggestions && suggestions.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center text-sm text-foreground-subtle">
          <FolderSearch size={22} />
          {t("library:smartSearch.none")}
        </div>
      ) : suggestions ? (
        <>
          <p className="px-4 pt-3 text-xs text-foreground-subtle">
            {t("library:smartSearch.found", { count: suggestions.length })}
            {truncated && ` ${t("library:smartSearch.truncated")}`}
          </p>
          <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-2">
            {suggestions.map((item) => (
              <li key={item.path}>
                <label className="flex cursor-pointer items-center gap-3 rounded-sm px-2 py-2 hover:bg-surface-muted">
                  <input
                    type="checkbox"
                    checked={checked.has(item.path)}
                    onChange={() => toggle(item.path)}
                    className="h-4 w-4 accent-primary"
                  />
                  <HardDrive size={15} className="flex-shrink-0 text-foreground-subtle" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-foreground" title={item.path}>
                      {item.path.split(/[/\\]/).pop()}
                    </span>
                    <span className="block truncate text-[11px] text-foreground-subtle" title={item.path}>{item.path}</span>
                  </span>
                  <span className="flex-shrink-0 text-xs tabular-nums text-foreground-muted">
                    {t("library:smartSearch.books", { count: item.bookCount })}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3">
            <button type="button" onClick={() => void scan()} className="h-9 rounded-sm px-3 text-sm text-foreground-muted hover:bg-surface-muted hover:text-foreground">
              {t("library:smartSearch.rescan")}
            </button>
            <button
              type="button"
              disabled={adding || checked.size === 0}
              onClick={() => void addSelected()}
              className="h-9 rounded-sm bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
            >
              {t("library:smartSearch.addSelected", { count: checked.size })}
            </button>
          </div>
        </>
      ) : null}
    </AnimatedModal>
  );
}
