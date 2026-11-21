import { Download, Maximize2, NotebookPen, Volume2, X } from "lucide-react";
import { effectiveState, type KnowledgeState } from "../../core/language-learning";
import type { LearningReaderSettings } from "../../features/language-learning/settings";
import type { TranslationService } from "../../features/language-learning/translation";
import { useTranslation } from "../../i18n";
import type { LearningSession } from "../../pages/ReadingPage/components/lyceum-reader/useLearningSessionCore";
import { useTranslationLookup } from "../../pages/ReadingPage/components/lyceum-reader/useTranslationLookup";
import { useDictionaryPackEntry } from "../../pages/ReadingPage/components/lyceum-reader/useDictionaryPackEntry";
import { STATE_ORDER, posLabel, stateLabelKey } from "../../pages/ReadingPage/components/lyceum-reader/uiHelpers";
import type { AnnotationDraftTarget } from "../../pages/ReadingPage/components/lyceum-reader/AnnotationComposer";

const STATE_STYLE: Record<KnowledgeState, { idle: string; active: string }> = {
  unknown: { idle: "text-info", active: "border-info bg-info/15 text-info" },
  learning: { idle: "text-warning", active: "border-warning bg-warning/15 text-warning" },
  known: { idle: "text-success", active: "border-success bg-success/15 text-success" },
  ignored: { idle: "text-foreground-subtle", active: "border-foreground-subtle bg-surface-muted text-foreground" },
};

interface WordSheetProps {
  session: LearningSession;
  ordinal: number;
  settings: LearningReaderSettings;
  translationService: TranslationService;
  translationRevision: number;
  speechAvailable: boolean;
  onState(state: KnowledgeState): void;
  onSpeak(text: string): void;
  onDetails(): void;
  onNote(target: AnnotationDraftTarget): void;
  /** Opens the dictionary manager (shown when no translation source is installed). */
  onManageDictionaries(): void;
  onClose(): void;
}

/**
 * Compact word card docked at the bottom while reading: translation, the four
 * knowledge states as large targets, audio, note and a way into the full
 * inspector. It never covers more than the lower part of the page.
 */
export function WordSheet({ session, ordinal, settings, translationService, translationRevision, speechAvailable, onState, onSpeak, onDetails, onNote, onManageDictionaries, onClose }: WordSheetProps) {
  const { t } = useTranslation();
  const { document, index, snapshot } = session;
  const resolved = index?.resolve(ordinal) ?? null;
  const entry = resolved && document ? document.lexicon[resolved.tuple[2]] : undefined;
  const form = resolved && document ? document.forms[resolved.tuple[3]] : undefined;
  const surface = resolved ? resolved.block.text.slice(resolved.tuple[0], resolved.tuple[1]) : "";
  const record = entry ? snapshot.lemmas[entry.key] : undefined;
  const state = entry && form ? effectiveState(snapshot, entry.key, form.form) : "unknown";
  const lookup = useTranslationLookup(
    translationService, entry?.lemma ?? null, document?.language ?? "und", settings.nativeLanguage, "word", Boolean(entry), translationRevision, surface || null,
  );
  const pack = useDictionaryPackEntry(entry ? surface || null : null, entry?.lemma ?? null, document?.language ?? "und", settings.nativeLanguage, translationRevision);
  const packEntry = pack.status === "done" && pack.result?.found ? pack.result.entries[0] : undefined;
  if (!resolved || !entry) return null;
  const pos = posLabel(t, entry.pos);

  return (
    <div className="mobile-sheet absolute inset-x-0 bottom-0 z-30 rounded-t-3xl border border-border bg-surface px-5 pb-[max(14px,env(safe-area-inset-bottom))] pt-3 shadow-2xl" role="dialog" aria-label={surface}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-serif text-2xl font-semibold text-foreground" lang={document?.language}>{surface}</p>
          <p className="mt-0.5 truncate text-xs text-foreground-subtle">
            {entry.lemma !== surface ? <span lang={document?.language}>{entry.lemma}</span> : null}
            {entry.lemma !== surface && pos ? " · " : null}
            {pos}
            {packEntry?.ipa[0] ? <span className="ml-1.5 font-mono">{packEntry.ipa[0]}</span> : null}
          </p>
        </div>
        {speechAvailable && (
          <button type="button" onClick={() => onSpeak(surface)} aria-label={t("mobile:learning.listen")} className="grid h-11 w-11 place-items-center rounded-full text-foreground-muted active:bg-surface-muted">
            <Volume2 size={20} />
          </button>
        )}
        <button type="button" onClick={onClose} aria-label={t("learning:actions.close")} className="grid h-11 w-11 place-items-center rounded-full text-foreground-muted active:bg-surface-muted">
          <X size={20} />
        </button>
      </div>

      <div className="mt-2 min-h-[2.75rem] text-[15px] leading-6 text-foreground">
        {record?.translation ? (
          <p><span className="mr-1.5 text-[11px] uppercase tracking-wider text-foreground-subtle">{t("learning:translation.yours")}</span>{record.translation}</p>
        ) : null}
        {lookup.status === "loading" && <p className="text-sm text-foreground-subtle">{t("learning:translation.loading")}</p>}
        {lookup.status === "ok" && (
          <p className={record?.translation ? "mt-1 text-sm text-foreground-muted" : ""}>
            {lookup.result.text}
            {lookup.result.alternatives.length > 0 && <span className="text-foreground-subtle"> · {lookup.result.alternatives.slice(0, 3).join(", ")}</span>}
          </p>
        )}
        {lookup.status === "error" && !record?.translation && <p className="text-sm text-foreground-subtle">{t("learning:translation.failed")}</p>}
        {lookup.status === "unavailable" && !record?.translation && (
          <button type="button" onClick={onManageDictionaries} className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-border px-3 py-2.5 text-left text-sm text-foreground-muted active:bg-surface-muted">
            <Download size={18} className="flex-shrink-0 text-primary" />
            <span>{t("mobile:learning.noDictionary")} <span className="font-semibold text-primary">{t("mobile:learning.chooseDictionary")}</span></span>
          </button>
        )}
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2" role="radiogroup" aria-label={t("mobile:learning.wordState")}>
        {STATE_ORDER.map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={state === value}
            onClick={() => onState(value)}
            className={`min-h-12 rounded-2xl border px-1 text-[12px] font-semibold transition-transform active:scale-95 ${state === value ? STATE_STYLE[value].active : `border-border bg-surface-muted ${STATE_STYLE[value].idle}`}`}
          >
            {t(stateLabelKey(value))}
          </button>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => onNote({ targetType: "token", targetId: resolved.tokenId, quote: surface, chapterId: resolved.chapterId })}
          className="mobile-choice flex flex-1 items-center justify-center gap-2 text-sm"
        >
          <NotebookPen size={16} />
          {t("mobile:learning.note")}
        </button>
        <button type="button" onClick={onDetails} className="mobile-choice flex flex-1 items-center justify-center gap-2 text-sm">
          <Maximize2 size={16} />
          {t("mobile:learning.details")}
        </button>
      </div>
    </div>
  );
}
