import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Check, Download, Loader2, Minus, Plus, Trash2 } from "lucide-react";
import { HORIZONTAL_MARGIN_LIMITS, LEARNING_LANGUAGES, type LearningReaderSettings } from "../../features/language-learning/settings";
import { baseLanguage } from "../../features/language-learning/translation";
import { getLearningBridge, type DictionaryCatalogEntry } from "../../platform";
import { getActiveLocale, useTranslation } from "../../i18n";
import MobileSheet from "../MobileSheet";
import { useMobileConfirm } from "../MobileConfirmDialog";
import { ReadingModeSwitch } from "../ReadingModeSwitch";

function languageName(code: string) {
  try {
    return new Intl.DisplayNames([getActiveLocale()], { type: "language" }).of(code) ?? code;
  } catch {
    return code;
  }
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange(value: boolean): void }) {
  return (
    <label className="flex min-h-12 items-start gap-3 py-2">
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        {hint && <span className="mt-0.5 block text-xs leading-5 text-foreground-subtle">{hint}</span>}
      </span>
      <input type="checkbox" className="mt-1 h-5 w-5 flex-shrink-0 accent-[var(--primary)]" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function Stepper({ label, value, display, onStep }: { label: string; value: number; display?: string; onStep(delta: -1 | 1): void }) {
  return (
    <div className="flex min-h-12 items-center gap-3 py-1">
      <span className="flex-1 text-sm font-medium text-foreground">{label}</span>
      <button type="button" onClick={() => onStep(-1)} aria-label={`${label} −`} className="grid h-11 w-11 place-items-center rounded-full border border-border text-foreground active:bg-surface-muted"><Minus size={18} /></button>
      <span className="w-10 text-center text-sm tabular-nums text-foreground">{display ?? value}</span>
      <button type="button" onClick={() => onStep(1)} aria-label={`${label} +`} className="grid h-11 w-11 place-items-center rounded-full border border-border text-foreground active:bg-surface-muted"><Plus size={18} /></button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-border py-3 last:border-b-0">
      <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-foreground-subtle">{title}</h3>
      {children}
    </section>
  );
}

/** Installed and suggested offline dictionaries for the book's language. */
function DictionaryManager({ source, target, onChanged }: { source: string; target: string; onChanged(): void }) {
  const { t } = useTranslation();
  const confirm = useMobileConfirm();
  const [entries, setEntries] = useState<DictionaryCatalogEntry[] | null>(null);
  const [busy, setBusy] = useState<{ id: string; progress: number } | null>(null);
  const [showAll, setShowAll] = useState(false);

  const reload = useCallback(async () => {
    const bridge = getLearningBridge();
    if (!bridge?.dictionaryGetIndex) return setEntries([]);
    const catalog = await bridge.dictionaryGetIndex();
    const from = baseLanguage(source);
    const relevant = catalog.filter((entry) => baseLanguage(entry.sourceLang) === from);
    // Installed first, then the reading pair, English, the app language and other widely used targets.
    const preferred = [baseLanguage(target), "en", baseLanguage(getActiveLocale()), "pt", "es", "fr", "de", "it"];
    const rank = (entry: DictionaryCatalogEntry) => {
      // The Wiktionary pack covers every pair and is far richer than the bilingual lists.
      if (entry.targetLang === "*") return -2;
      if (entry.isDownloaded) return -1;
      const position = preferred.indexOf(baseLanguage(entry.targetLang));
      return position >= 0 ? position : preferred.length;
    };
    setEntries(relevant.sort((a, b) => rank(a) - rank(b) || languageName(a.targetLang).localeCompare(languageName(b.targetLang))));
  }, [source, target]);

  useEffect(() => {
    void reload().catch(() => setEntries([]));
  }, [reload]);

  useEffect(() => {
    if (!busy) return;
    return getLearningBridge()?.onDictionaryDownloadProgress?.((data) => {
      if (data.dictId === busy.id) setBusy({ id: data.dictId, progress: data.progress });
    });
  }, [busy?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const download = async (entry: DictionaryCatalogEntry) => {
    const bridge = getLearningBridge();
    if (!bridge?.dictionaryDownload) return;
    setBusy({ id: entry.id, progress: 0 });
    const result = await bridge.dictionaryDownload(entry.id);
    setBusy(null);
    if (result.success) {
      toast.success(t("learning:translation.dictionaryReady"));
      onChanged();
    } else {
      toast.error(`${t("learning:translation.dictionaryFailed")}${result.error ? ` (${result.error})` : ""}`);
    }
    await reload();
  };

  const remove = async (entry: DictionaryCatalogEntry) => {
    if (!(await confirm(t("mobile:learning.removeDictionary", { name: entry.name })))) return;
    await getLearningBridge()?.dictionaryDelete?.(entry.id);
    onChanged();
    await reload();
  };

  if (!entries) return <p className="py-2 text-sm text-foreground-subtle">…</p>;
  if (entries.length === 0) return <p className="py-2 text-sm text-foreground-subtle">{t("learning:translation.noDictionaryForPair")}</p>;
  const visible = showAll ? entries : entries.slice(0, 4);
  return (
    <>
    <ul className="space-y-2 py-1">
      {visible.map((entry) => (
        <li key={entry.id} className="flex min-h-12 items-center gap-3 rounded-2xl border border-border bg-surface-muted px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{entry.targetLang === "*" ? entry.name : `${languageName(entry.sourceLang)} → ${languageName(entry.targetLang)}`}</p>
            <p className="text-xs text-foreground-subtle">
              {entry.headwords ? t("mobile:learning.headwords", { count: entry.headwords }) : entry.name}
              {entry.size ? ` · ${(entry.size / (1024 * 1024)).toFixed(1)} MB` : ""}
            </p>
          </div>
          {busy?.id === entry.id ? (
            <span className="flex items-center gap-1.5 text-xs text-primary"><Loader2 size={16} className="animate-spin" />{Math.round(busy.progress)}%</span>
          ) : entry.isDownloaded ? (
            <>
              <Check size={18} className="text-success" aria-label={t("mobile:learning.installed")} />
              <button type="button" onClick={() => void remove(entry)} aria-label={t("learning:actions.delete")} className="grid h-10 w-10 place-items-center rounded-full text-foreground-muted active:bg-surface">
                <Trash2 size={17} />
              </button>
            </>
          ) : (
            <button type="button" disabled={busy !== null} onClick={() => void download(entry)} className="flex h-10 items-center gap-1.5 rounded-full bg-primary-muted px-3 text-xs font-semibold text-primary disabled:opacity-50">
              <Download size={15} />
              {t("mobile:learning.download")}
            </button>
          )}
        </li>
      ))}
    </ul>
    {entries.length > visible.length && (
      <button type="button" onClick={() => setShowAll(true)} className="mt-1 min-h-11 w-full rounded-2xl text-sm font-semibold text-primary active:bg-surface-muted">
        {t("mobile:learning.showAllDictionaries", { count: entries.length })}
      </button>
    )}
    </>
  );
}

interface LearningSettingsSheetProps {
  open: boolean;
  settings: LearningReaderSettings;
  documentLanguage: string;
  onSettings(patch: Partial<LearningReaderSettings>): void;
  onDocumentLanguage(language: string): void;
  onDictionariesChanged(): void;
  /** Leaves .lyceum reading for the book's own format (remembered per book). */
  onOpenOriginal?(): void;
  originalFormatLabel?: string;
  onClose(): void;
}

export function LearningSettingsSheet({ open, settings, documentLanguage, onSettings, onDocumentLanguage, onDictionariesChanged, onOpenOriginal, originalFormatLabel, onClose }: LearningSettingsSheetProps) {
  const { t } = useTranslation();
  const fontStep = (delta: number) => onSettings({ fontSize: Math.min(32, Math.max(13, settings.fontSize + delta)) });
  const marginStep = (delta: number) => onSettings({
    horizontalMargin: Math.min(HORIZONTAL_MARGIN_LIMITS.max, Math.max(HORIZONTAL_MARGIN_LIMITS.min, settings.horizontalMargin + delta * HORIZONTAL_MARGIN_LIMITS.step)),
  });
  return (
    <MobileSheet open={open} size="full" title={t("learning:toolbar.settings")} onClose={onClose} closeLabel={t("learning:actions.close")}>
      {onOpenOriginal && (
        <section className="border-b border-border py-3">
          <ReadingModeSwitch mode="learning" formatLabel={originalFormatLabel ?? ""} onChange={(mode) => { if (mode === "reader") onOpenOriginal(); }} />
        </section>
      )}

      <Section title={t("mobile:learning.reading")}>
        <Stepper label={t("learning:settings.fontSize")} value={settings.fontSize} onStep={fontStep} />
        <Stepper label={t("mobile:learning.horizontalMargin")} value={settings.horizontalMargin} display={`${settings.horizontalMargin}`} onStep={marginStep} />
        <div className="py-1">
          <span className="text-sm font-medium text-foreground">{t("learning:settings.lineHeight")}</span>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {[1.45, 1.6, 1.75, 2].map((value) => (
              <button key={value} type="button" onClick={() => onSettings({ lineHeight: value })} className={`mobile-choice ${Math.abs(settings.lineHeight - value) < 0.01 ? "mobile-choice-active" : ""}`}>{value}</button>
            ))}
          </div>
        </div>
        <div className="py-1">
          <span className="text-sm font-medium text-foreground">{t("learning:settings.theme")}</span>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(["app", "sepia"] as const).map((theme) => (
              <button key={theme} type="button" onClick={() => onSettings({ theme })} className={`mobile-choice ${settings.theme === theme ? "mobile-choice-active" : ""}`}>{t(`learning:settings.themes.${theme}`)}</button>
            ))}
          </div>
        </div>
      </Section>

      <Section title={t("mobile:learning.vocabulary")}>
        <Toggle label={t("mobile:learning.learningMode")} hint={t("mobile:learning.learningModeHint")} checked={settings.learningMode} onChange={(learningMode) => onSettings({ learningMode })} />
        <Toggle label={t("learning:toolbar.highlights")} checked={settings.showHighlights} onChange={(showHighlights) => onSettings({ showHighlights })} />
        <Toggle label={t("learning:settings.highlightKnown")} checked={settings.highlightKnown} onChange={(highlightKnown) => onSettings({ highlightKnown })} />
        <Toggle label={t("mobile:learning.autoLearn")} hint={t("mobile:learning.autoLearnHint")} checked={settings.autoLearnOnClick} onChange={(autoLearnOnClick) => onSettings({ autoLearnOnClick })} />
        <Toggle label={t("mobile:learning.autoPlay")} hint={t("mobile:learning.autoPlayHint")} checked={settings.autoPlayPronunciation} onChange={(autoPlayPronunciation) => onSettings({ autoPlayPronunciation })} />
      </Section>

      <Section title={t("mobile:learning.languages")}>
        <label className="block py-1">
          <span className="text-sm font-medium text-foreground">{t("learning:settings.documentLanguage")}</span>
          <select className="mobile-field mobile-select mt-2" value={documentLanguage} onChange={(event) => onDocumentLanguage(event.target.value)}>
            {Array.from(new Set([documentLanguage, ...LEARNING_LANGUAGES])).map((code) => <option key={code} value={code}>{languageName(code)}</option>)}
          </select>
          <span className="mt-1 block text-xs text-foreground-subtle">{t("mobile:learning.documentLanguageHint")}</span>
        </label>
        <label className="block py-1">
          <span className="text-sm font-medium text-foreground">{t("learning:settings.nativeLanguage")}</span>
          <select className="mobile-field mobile-select mt-2" value={settings.nativeLanguage} onChange={(event) => onSettings({ nativeLanguage: event.target.value })}>
            {Array.from(new Set([settings.nativeLanguage, "pt", "en", "es", "fr", "de", "it"])).map((code) => <option key={code} value={code}>{languageName(code)}</option>)}
          </select>
        </label>
      </Section>

      <Section title={t("mobile:learning.dictionaries")}>
        <DictionaryManager source={documentLanguage} target={settings.nativeLanguage} onChanged={onDictionariesChanged} />
        <Toggle label={t("learning:settings.onlineTranslation")} hint={t("learning:settings.onlineTranslationHint")} checked={settings.onlineTranslation} onChange={(onlineTranslation) => onSettings({ onlineTranslation })} />
      </Section>
    </MobileSheet>
  );
}
