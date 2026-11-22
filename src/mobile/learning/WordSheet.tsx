import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import {
  BookOpenText, Check, CheckCheck, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Download, Layers, NotebookPen, Pencil, Play, ScanText, Volume2, X,
} from "lucide-react";
import toast from "react-hot-toast";
import { effectiveState, lemmaState, sentenceText, TOKEN_FLAG_LEMMA_ESTIMATED, TOKEN_FLAG_PROPER_NOUN_CANDIDATE, type KnowledgeState } from "../../core/language-learning";
import { packKey, RELATION_ORDER, type PackEntry } from "../../core/dictionary-packs";
import type { LearningReaderSettings } from "../../features/language-learning/settings";
import type { TranslationService } from "../../features/language-learning/translation";
import { useTranslation } from "../../i18n";
import type { LearningSession } from "../../pages/ReadingPage/components/lyceum-reader/useLearningSessionCore";
import { useTranslationLookup } from "../../pages/ReadingPage/components/lyceum-reader/useTranslationLookup";
import { useDictionaryPackEntry } from "../../pages/ReadingPage/components/lyceum-reader/useDictionaryPackEntry";
import { entryRelation, playAudio, useDictionaryTag } from "../../pages/ReadingPage/components/lyceum-reader/dictionaryUi";
import { STATE_ORDER, dynamicT, posLabel, stateLabelKey } from "../../pages/ReadingPage/components/lyceum-reader/uiHelpers";
import { FeatureList } from "../../pages/ReadingPage/components/lyceum-reader/parts";
import type { AnnotationDraftTarget } from "../../pages/ReadingPage/components/lyceum-reader/AnnotationComposer";
import type { InspectorSelection } from "../../pages/ReadingPage/components/lyceum-reader/InspectorPanel";
import type { ScrollTarget } from "../../pages/ReadingPage/components/lyceum-reader/ReadingSurface";
import { BACK_EVENT } from "../useBackNavigation";
import { inflectionSet, markAllInflectionsPlan } from "./wordInflections";

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
  /** Opens the inspector for a sentence or an expression. */
  onInspect(selection: InspectorSelection): void;
  onNavigate(target: Omit<ScrollTarget, "nonce">, chapterIndex: number): void;
  onNote(target: AnnotationDraftTarget): void;
  /** Opens the dictionary manager (shown when no translation source is installed). */
  onManageDictionaries(): void;
  onClose(): void;
}

/** Distance (px) a collapsed sheet must be pulled up to open the details. */
const EXPAND_PULL = 36;
const COLLAPSE_PULL = 80;
const CLOSE_PULL = 70;
const DRAG_SLOP = 6;
const EXAMPLES_PAGE = 4;
const FORMS_COLLAPSED = 12;

function Card({ title, aside, icon, children }: { title?: string; aside?: ReactNode; icon?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-3 rounded-3xl border border-border bg-surface-muted/60 p-4">
      {title && (
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="flex min-w-0 items-center gap-2 text-[13px] font-semibold text-foreground">
            {icon && <span className="text-foreground-subtle">{icon}</span>}
            <span className="truncate">{title}</span>
          </h3>
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

function Chips({ words, lang, tone = "plain", onPick }: { words: string[]; lang?: string; tone?: "plain" | "primary"; onPick?(word: string): void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {words.map((word) => {
        const className = `rounded-full px-3 py-1.5 text-[13px] ${tone === "primary" ? "bg-primary-muted font-medium text-primary" : "border border-border bg-surface text-foreground"}`;
        return onPick ? (
          <button key={word} type="button" lang={lang} onClick={() => onPick(word)} className={`${className} transition-transform active:scale-95`}>{word}</button>
        ) : (
          <span key={word} lang={lang} className={className}>{word}</span>
        );
      })}
    </div>
  );
}

function Disclosure({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-border first:border-t-0">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="flex min-h-12 w-full items-center justify-between text-left text-sm font-medium text-foreground">
        {title}
        <ChevronDown size={18} className={`text-foreground-subtle transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="pb-3">{children}</div>}
    </div>
  );
}

function Stat({ value, label, lang }: { value: number; label: string; lang?: string }) {
  return (
    <div className="min-w-0" data-testid="word-stat">
      <p className="text-2xl font-semibold tabular-nums leading-tight text-foreground">{value}</p>
      <p className="truncate text-[11px] text-foreground-subtle" lang={lang}>{label}</p>
    </div>
  );
}

function vibrate() {
  if (navigator.vibrate) navigator.vibrate(10);
}

/**
 * Word card docked at the bottom while reading. Collapsed it shows the word,
 * pronunciation, translation, how often it appears and the four knowledge
 * states. Pulled up it becomes a full word page ordered by how often a reader
 * needs each part: translations and meanings first, then the word in this
 * book, its inflections, and finally pronunciation details, relations and
 * etymology.
 */
export function WordSheet({ session, ordinal, settings, translationService, translationRevision, speechAvailable, onState, onSpeak, onInspect, onNavigate, onNote, onManageDictionaries, onClose }: WordSheetProps) {
  const { t } = useTranslation();
  const tag = useDictionaryTag();
  const { document, index, snapshot } = session;
  const resolved = index?.resolve(ordinal) ?? null;
  const lexeme = resolved ? resolved.tuple[2] : -1;
  const formIndex = resolved ? resolved.tuple[3] : -1;
  const entry = document && lexeme >= 0 ? document.lexicon[lexeme] : undefined;
  const form = document && formIndex >= 0 ? document.forms[formIndex] : undefined;
  const surface = resolved ? resolved.block.text.slice(resolved.tuple[0], resolved.tuple[1]) : "";
  const language = document?.language ?? "und";
  const record = entry ? snapshot.lemmas[entry.key] : undefined;
  const formOverride = entry && form ? snapshot.forms[`${entry.key}\u0000${form.form}`] : undefined;
  const state = entry && form ? effectiveState(snapshot, entry.key, form.form) : "unknown";

  const lookup = useTranslationLookup(
    translationService, entry?.lemma ?? null, language, settings.nativeLanguage, "word", Boolean(entry), translationRevision, surface || null,
  );
  const pack = useDictionaryPackEntry(entry ? surface || null : null, entry?.lemma ?? null, language, settings.nativeLanguage, translationRevision);
  const packEntries = pack.status === "done" && pack.result?.found ? pack.result.entries : [];
  const main: PackEntry | undefined = packEntries[0];

  // --- Book statistics -----------------------------------------------------
  const inflections = useMemo(
    () => (document && index && lexeme >= 0 ? inflectionSet(document, index, lexeme, main) : { forms: [], occurrences: [], count: 0 }),
    [document, index, lexeme, main],
  );
  const [scope, setScope] = useState<"all" | "form">("all");
  const formOccurrences = useMemo(() => (index && formIndex >= 0 ? index.formOccurrences(formIndex) : []), [index, formIndex]);
  const occurrences = scope === "all" ? inflections.occurrences : formOccurrences;
  const position = occurrences.indexOf(ordinal);
  const chapterCount = useMemo(() => {
    if (!index || !resolved) return 0;
    const range = new Set(index.lexemeOccurrences(lexeme, { chapterIndex: resolved.chapterIndex }));
    for (const formId of inflections.forms) for (const item of index.formOccurrences(formId, { chapterIndex: resolved.chapterIndex })) range.add(item);
    return range.size;
  }, [index, inflections.forms, lexeme, resolved]);
  const [exampleLimit, setExampleLimit] = useState(EXAMPLES_PAGE);
  const examples = useMemo(() => {
    if (!index || !resolved) return { items: [], more: false };
    const items: Array<{ ordinal: number; text: string; start: number; end: number; chapterIndex: number }> = [];
    const seen = new Set<string>([resolved.sentence.id]);
    let more = false;
    for (const other of occurrences) {
      const target = index.resolve(other);
      if (!target || seen.has(target.sentence.id)) continue;
      if (items.length >= exampleLimit) {
        more = true;
        break;
      }
      seen.add(target.sentence.id);
      items.push({
        ordinal: other,
        text: sentenceText(target.block, target.sentence),
        start: target.tuple[0] - target.sentence.start,
        end: target.tuple[1] - target.sentence.start,
        chapterIndex: target.chapterIndex,
      });
    }
    return { items, more };
  }, [exampleLimit, index, occurrences, resolved]);
  const expressions = useMemo(() => {
    if (!document || !resolved) return [];
    return document.expressionOccurrences
      .filter((occurrence) => occurrence.sentenceId === resolved.sentence.id && occurrence.tokens.includes(resolved.tokenIndex))
      .map((occurrence) => ({ occurrence, entry: document.expressions[occurrence.expression] }))
      .filter((item) => item.entry);
  }, [document, resolved]);
  const plan = useMemo(
    () => (document && lexeme >= 0 ? markAllInflectionsPlan(document, snapshot, lexeme, inflections.forms) : { clearForms: [], setForms: [], allKnown: true }),
    [document, inflections.forms, lexeme, snapshot],
  );

  // --- Sheet geometry ------------------------------------------------------
  const sheetRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const peekRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const [peekHeight, setPeekHeight] = useState(0);
  const [maxHeight, setMaxHeight] = useState(0);
  const gesture = useRef<{ y: number; height: number; moved: boolean; pointer: number } | null>(null);

  const measure = useCallback(() => {
    const sheet = sheetRef.current;
    const peek = peekRef.current;
    if (!sheet || !peek) return;
    const padding = parseFloat(getComputedStyle(sheet).paddingBottom) || 14;
    // The peek block's own box: its height follows the translation wrapping and font loading.
    const top = peek.getBoundingClientRect().top - sheet.getBoundingClientRect().top + (peek.parentElement?.scrollTop ?? 0);
    setPeekHeight(Math.ceil(top + peek.offsetHeight + padding + 6));
    const parent = sheet.offsetParent as HTMLElement | null;
    setMaxHeight(Math.round((parent?.clientHeight ?? window.innerHeight) * 0.94));
  }, []);

  useLayoutEffect(() => {
    measure();
    const observer = new ResizeObserver(measure);
    if (sheetRef.current?.offsetParent) observer.observe(sheetRef.current.offsetParent);
    if (peekRef.current) observer.observe(peekRef.current);
    // Web fonts change line wrapping after the first layout.
    void window.document.fonts?.ready.then(measure).catch(() => undefined);
    return () => observer.disconnect();
  }, [measure]);
  // The translation arriving changes the collapsed height.
  useLayoutEffect(measure, [measure, lookup.status, record?.translation, main?.ipa, inflections.count]);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
    setExampleLimit(EXAMPLES_PAGE);
  }, [ordinal]);
  useEffect(() => {
    if (!expanded && bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [expanded]);
  useEffect(() => {
    setScope("all");
  }, [lexeme]);

  // Android back collapses the word page before closing the card.
  useEffect(() => {
    if (!expanded) return undefined;
    const onBack = (event: Event) => {
      if (event.defaultPrevented) return;
      event.preventDefault();
      setExpanded(false);
    };
    window.addEventListener(BACK_EVENT, onBack, { capture: true });
    return () => window.removeEventListener(BACK_EVENT, onBack, { capture: true });
  }, [expanded]);

  // --- Pronunciation -------------------------------------------------------
  const recording = main?.audio[0]?.url;
  const recordingMatchesSurface = Boolean(main && packKey(main.word) === packKey(surface));
  const canPronounce = Boolean(recording) || speechAvailable;
  const pronounce = useCallback(() => {
    // A recording of the lemma is wrong for an inflected form when speech can say the form itself.
    if (recording && (recordingMatchesSurface || !speechAvailable)) {
      void playAudio(recording).then((played) => {
        if (!played && speechAvailable) onSpeak(surface);
      });
    } else if (speechAvailable) onSpeak(surface);
  }, [onSpeak, recording, recordingMatchesSurface, speechAvailable, surface]);

  const autoPlayedFor = useRef<number | null>(null);
  useEffect(() => {
    if (!settings.autoPlayPronunciation || pack.status === "loading" || autoPlayedFor.current === ordinal || !entry) return;
    autoPlayedFor.current = ordinal;
    pronounce();
  }, [entry, ordinal, pack.status, pronounce, settings.autoPlayPronunciation]);

  const restingHeight = expanded ? maxHeight : peekHeight;
  const height = dragHeight ?? (restingHeight || undefined);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    // Expanded, only the header drags; the body scrolls.
    if (expanded && bodyRef.current?.contains(event.target as Node)) return;
    gesture.current = { y: event.clientY, height: sheetRef.current?.offsetHeight ?? restingHeight, moved: false, pointer: event.pointerId };
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = gesture.current;
    if (!current || current.pointer !== event.pointerId) return;
    const delta = current.y - event.clientY;
    if (!current.moved && Math.abs(delta) < DRAG_SLOP) return;
    if (!current.moved) {
      current.moved = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    setDragHeight(Math.max(peekHeight * 0.4, Math.min(maxHeight, current.height + delta)));
  };
  const onPointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = gesture.current;
    gesture.current = null;
    if (!current?.moved) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    const final = dragHeight ?? current.height;
    setDragHeight(null);
    if (!expanded) {
      if (final > peekHeight + EXPAND_PULL) setExpanded(true);
      else if (final < peekHeight - CLOSE_PULL) onClose();
    } else if (final < maxHeight - COLLAPSE_PULL) {
      setExpanded(final > (peekHeight + maxHeight) / 2);
    }
  };

  if (!resolved || !entry || !document || !form) return null;

  const pos = posLabel(t, entry.pos) ?? (main?.pos ? dynamicT(t, `learning:dictionary.pos.${main.pos}`, undefined, main.pos) : null);
  const ipa = main?.ipa[0];
  // The engine's lemma, or the dictionary's when the engine could not lemmatize an irregular form.
  const headLemma = packKey(entry.lemma) !== packKey(surface) ? entry.lemma : main && packKey(main.word) !== packKey(surface) ? main.word : null;
  const estimated = (resolved.tuple[4] & TOKEN_FLAG_LEMMA_ESTIMATED) !== 0 || entry.estimated;
  const properNoun = (resolved.tuple[4] & TOKEN_FLAG_PROPER_NOUN_CANDIDATE) !== 0;
  const synonyms = main ? entryRelation(main, "synonyms", 24) : [];
  const antonyms = main ? entryRelation(main, "antonyms", 12) : [];
  const translations = [...new Map((main?.translations ?? []).map((item) => [item.word, item])).values()];
  const relatedGroups = main ? RELATION_ORDER.filter((name) => !["synonyms", "antonyms"].includes(name) && main.relations[name]?.length) : [];
  const meanings = main ? main.senses.filter((sense) => !sense.formOf?.length || main.senses.length === 1) : [];
  const features = { ...(entry.features ?? {}), ...(form.features ?? {}) };
  const showDetails = expanded || dragHeight !== null;

  const go = (target: number) => {
    const destination = index?.resolve(target);
    if (!destination) return;
    setExpanded(false);
    onNavigate({ ordinal: target, flash: true }, destination.chapterIndex);
  };
  const changeState = (value: KnowledgeState) => {
    vibrate();
    onState(value);
  };
  const saveTranslation = (value: string) => void session.saveTranslation(entry.key, entry.lemma, value || null);
  const markAllKnown = async () => {
    vibrate();
    await session.setInflectionsState({ lemma: { key: entry.key, label: entry.lemma }, state: "known", clearForms: plan.clearForms, setForms: plan.setForms });
    toast.success(t("mobile:learning.word.allFormsMarked", { count: inflections.forms.length }));
  };

  return (
    <>
      {expanded && <div className="mobile-sheet-backdrop absolute inset-0 z-20 bg-black/40" onClick={() => setExpanded(false)} aria-hidden />}
      <div
        ref={sheetRef}
        className="mobile-sheet absolute inset-x-0 bottom-0 z-30 flex flex-col overflow-hidden rounded-t-[28px] border border-border bg-surface px-5 pb-[max(14px,env(safe-area-inset-bottom))] shadow-2xl"
        style={{ height, maxHeight: maxHeight || "94%", transition: dragHeight === null ? "height 260ms cubic-bezier(.2,.8,.2,1)" : "none", touchAction: expanded ? "auto" : "none" }}
        role="dialog"
        aria-label={surface}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
      >
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-label={expanded ? t("mobile:learning.word.collapse") : t("mobile:learning.word.expand")}
          aria-expanded={expanded}
          className="mx-auto flex h-6 w-24 flex-shrink-0 items-center justify-center"
          style={{ touchAction: "none" }}
        >
          <span className="h-1.5 w-10 rounded-full bg-border-strong" />
        </button>

        {/* Header: always visible, drags the sheet */}
        <div className="flex flex-shrink-0 items-start gap-1" style={{ touchAction: "none" }}>
          <div className="min-w-0 flex-1 pr-1">
            <p className="truncate font-serif text-[26px] font-semibold leading-tight text-foreground" lang={language}>{surface}</p>
            <p className="mt-0.5 truncate text-xs text-foreground-subtle">
              {headLemma ? <span className="text-foreground-muted" lang={language}>{headLemma}</span> : null}
              {headLemma && pos ? " · " : null}
              {pos}
              {ipa ? <span className="ml-1.5 font-mono">{ipa}</span> : null}
            </p>
          </div>
          {canPronounce && (
            <button type="button" onClick={pronounce} aria-label={t("mobile:learning.word.pronounce")} className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-full bg-primary-muted text-primary transition-transform active:scale-90">
              <Volume2 size={20} />
            </button>
          )}
          <button type="button" onClick={() => onNote({ targetType: "token", targetId: resolved.tokenId, quote: surface, chapterId: resolved.chapterId })} aria-label={t("mobile:learning.note")} className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-full text-foreground-muted active:bg-surface-muted">
            <NotebookPen size={19} />
          </button>
          <button type="button" onClick={expanded ? () => setExpanded(false) : onClose} aria-label={expanded ? t("mobile:learning.word.collapse") : t("learning:actions.close")} className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-full text-foreground-muted active:bg-surface-muted">
            {expanded ? <ChevronDown size={22} /> : <X size={20} />}
          </button>
        </div>

        <div ref={bodyRef} className={`min-h-0 flex-1 ${expanded ? "overflow-y-auto overscroll-contain" : "overflow-hidden"}`}>
          <div ref={peekRef}>
            {/* Translation */}
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

            {/* Occurrences in the book: all inflections and this exact form */}
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="mt-2 flex w-full items-center gap-2 text-left text-xs text-foreground-muted"
              data-testid="word-occurrences"
            >
              <span className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2.5 py-1">
                <Layers size={13} className="text-foreground-subtle" />
                <span className="font-semibold tabular-nums text-foreground">{inflections.count}×</span>
                {t("mobile:learning.word.allFormsShort")}
              </span>
              <span className="inline-flex min-w-0 items-center gap-1 rounded-full bg-surface-muted px-2.5 py-1">
                <span className="font-semibold tabular-nums text-foreground">{form.count}×</span>
                <span className="truncate" lang={language}>“{form.form}”</span>
              </span>
              {!expanded && <ChevronUp size={16} className="ml-auto flex-shrink-0 text-foreground-subtle" />}
            </button>

            {/* Knowledge state */}
            <div className="mt-3 grid grid-cols-4 gap-2" role="radiogroup" aria-label={t("mobile:learning.wordState")}>
              {STATE_ORDER.map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={state === value}
                  onClick={() => changeState(value)}
                  className={`min-h-12 min-w-0 rounded-2xl border px-0.5 text-[11px] font-semibold leading-tight tracking-tight transition-transform active:scale-95 ${state === value ? STATE_STYLE[value].active : `border-border bg-surface-muted ${STATE_STYLE[value].idle}`}`}
                >
                  {t(stateLabelKey(value))}
                </button>
              ))}
            </div>
          </div>

          {/* Word page: revealed by pulling the sheet up */}
          {showDetails && (
            <div className={`pb-4 pt-2 transition-opacity ${expanded ? "opacity-100" : "opacity-60"}`}>
              {properNoun && state === "unknown" && <p className="mt-3 px-1 text-xs text-foreground-subtle">{t("learning:inspector.properNounHint")}</p>}

              {/* 1. Translations: the most used part */}
              <Card title={t("mobile:learning.word.translations")}>
                <YourTranslation
                  key={entry.key}
                  value={record?.translation ?? ""}
                  suggestion={lookup.status === "ok" ? lookup.result.text : ""}
                  onSave={saveTranslation}
                />
                {translations.length > 0 && (
                  <>
                    <p className="mb-2 mt-3 text-[11px] text-foreground-subtle">{t("mobile:learning.word.tapToUse")}</p>
                    <Chips words={translations.slice(0, 18).map((item) => item.word)} lang={settings.nativeLanguage} tone="primary" onPick={(word) => { vibrate(); saveTranslation(word); toast.success(t("mobile:learning.word.translationSaved", { word })); }} />
                  </>
                )}
              </Card>

              {pack.status === "no-pack" && (
                <button type="button" onClick={onManageDictionaries} className="mt-3 flex w-full items-center gap-3 rounded-3xl border border-dashed border-border px-4 py-3.5 text-left text-sm text-foreground-muted active:bg-surface-muted">
                  <Download size={18} className="flex-shrink-0 text-primary" />
                  {t("mobile:learning.word.noDetails")}
                </button>
              )}
              {pack.status === "loading" && <div className="mobile-skeleton-block mt-3 h-28 rounded-3xl" aria-hidden />}

              {/* 2. Meanings */}
              {main && meanings.length > 0 && (
                <Card
                  title={t("mobile:learning.word.meanings")}
                  aside={main.matchedForm ? (
                    <span className="min-w-0 truncate text-[11px] text-foreground-muted">
                      {main.matchedForm.tags.map(tag).join(", ")} · <span lang={language}>{main.word}</span>
                    </span>
                  ) : undefined}
                >
                  {main.head && main.head !== main.word && <p className="mb-3 font-serif text-sm text-foreground-muted" lang={language}>{main.head}</p>}
                  <Meanings entry={main} lang={language} />
                </Card>
              )}

              {/* 3. Synonyms and antonyms */}
              {(synonyms.length > 0 || antonyms.length > 0) && (
                <Card>
                  {synonyms.length > 0 && (
                    <>
                      <p className="mb-2 text-[13px] font-semibold text-foreground">{t("mobile:learning.word.synonyms")}</p>
                      <Chips words={synonyms} lang={language} />
                    </>
                  )}
                  {antonyms.length > 0 && (
                    <>
                      <p className={`mb-2 text-[13px] font-semibold text-foreground ${synonyms.length ? "mt-4" : ""}`}>{t("mobile:learning.word.antonyms")}</p>
                      <Chips words={antonyms} lang={language} />
                    </>
                  )}
                </Card>
              )}

              {/* 4. The word in this book */}
              <Card title={t("mobile:learning.word.inThisBook")} icon={<BookOpenText size={15} />}>
                <div className="grid grid-cols-3 gap-2">
                  <Stat value={inflections.count} label={t("mobile:learning.word.allForms")} />
                  <Stat value={form.count} label={`“${form.form}”`} lang={language} />
                  <Stat value={chapterCount} label={t("mobile:learning.word.inChapter")} />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-1 rounded-2xl bg-surface p-1" role="radiogroup" aria-label={t("learning:inspector.browse")}>
                  {(["all", "form"] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={scope === value}
                      onClick={() => { setScope(value); setExampleLimit(EXAMPLES_PAGE); }}
                      className={`min-h-9 truncate rounded-xl px-2 text-xs font-semibold ${scope === value ? "bg-primary-muted text-primary" : "text-foreground-muted"}`}
                    >
                      {value === "all" ? t("mobile:learning.word.allForms") : <span lang={language}>“{form.form}”</span>}
                    </button>
                  ))}
                </div>
                {occurrences.length > 1 && (
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <button type="button" onClick={() => go(occurrences[(position - 1 + occurrences.length) % occurrences.length] ?? ordinal)} aria-label={t("learning:inspector.previousOccurrence")} className="grid h-11 w-11 place-items-center rounded-full text-foreground-muted active:bg-surface">
                      <ChevronLeft size={20} />
                    </button>
                    <span className="text-xs tabular-nums text-foreground-muted">
                      {t("mobile:learning.word.occurrence", { position: Math.max(1, position + 1), total: occurrences.length })}
                    </span>
                    <button type="button" onClick={() => go(occurrences[(position + 1) % occurrences.length] ?? ordinal)} aria-label={t("learning:inspector.nextOccurrence")} className="grid h-11 w-11 place-items-center rounded-full text-foreground-muted active:bg-surface">
                      <ChevronRight size={20} />
                    </button>
                  </div>
                )}
                {examples.items.length > 0 && (
                  <ul className="mt-2 divide-y divide-border/70">
                    {examples.items.map((example) => (
                      <li key={example.ordinal}>
                        <button type="button" onClick={() => go(example.ordinal)} className="w-full py-2.5 text-left font-serif text-[14px] leading-relaxed text-foreground-muted active:bg-surface" lang={language}>
                          {example.text.slice(0, example.start)}
                          <mark className="rounded bg-primary/15 px-0.5 text-foreground">{example.text.slice(example.start, example.end)}</mark>
                          {example.text.slice(example.end)}
                          <span className="ml-1.5 whitespace-nowrap font-sans text-[10px] text-foreground-subtle">· {t("mobile:learning.word.chapterShort", { number: example.chapterIndex + 1 })}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {examples.more && (
                  <button type="button" onClick={() => setExampleLimit((value) => value + 10)} className="mt-1 min-h-10 text-sm font-medium text-primary">
                    {t("mobile:learning.word.moreSentences")}
                  </button>
                )}
              </Card>

              {/* 5. Inflections */}
              <Card title={t("mobile:learning.word.inflections")} icon={<Layers size={15} />}>
                <button
                  type="button"
                  disabled={plan.allKnown}
                  onClick={() => void markAllKnown()}
                  className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-3 text-sm font-semibold transition-transform active:scale-[.98] ${plan.allKnown ? "border border-success/40 bg-success/10 text-success" : "bg-success text-success-foreground"}`}
                >
                  {plan.allKnown ? <Check size={17} /> : <CheckCheck size={17} />}
                  {plan.allKnown ? t("mobile:learning.word.allFormsKnown") : t("mobile:learning.word.markAllForms", { count: inflections.forms.length })}
                </button>
                <p className="mt-2 text-[11px] leading-snug text-foreground-subtle">{t("mobile:learning.word.markAllFormsHint")}</p>

                {inflections.forms.length > 0 && (
                  <>
                    <p className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground-subtle">{t("mobile:learning.word.formsInBook")}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {inflections.forms.slice(0, 30).map((formId) => {
                        const item = document.forms[formId];
                        const owner = item ? document.lexicon[item.lexeme] : undefined;
                        if (!item || !owner) return null;
                        const itemState = effectiveState(snapshot, owner.key, item.form);
                        return (
                          <span key={formId} lang={language} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[13px] ${formId === formIndex ? "border-primary text-foreground" : "border-border bg-surface text-foreground-muted"}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${STATE_DOT_CLASS[itemState]}`} />
                            {item.form}
                            <span className="text-foreground-subtle">{item.count}</span>
                          </span>
                        );
                      })}
                    </div>
                  </>
                )}
                {inflections.forms.length > 1 && (
                  <label className="mt-3 flex min-h-11 items-center gap-3 text-sm text-foreground-muted">
                    <input
                      type="checkbox"
                      className="h-5 w-5 accent-primary"
                      checked={Boolean(formOverride)}
                      onChange={(event) => {
                        const context = { sentenceId: resolved.sentence.id, contextForm: surface };
                        if (event.target.checked) void session.setKnowledge(entry.key, entry.lemma, lemmaState(snapshot, entry.key), form.form, context);
                        else void session.clearFormOverride(entry.key, form.form);
                      }}
                    />
                    {t("learning:inspector.onlyThisForm", { form: form.form })}
                  </label>
                )}
                {main && main.forms.length > 0 && <InflectionTable entry={main} lang={language} bookForms={inflections.forms.map((id) => document.forms[id]?.form ?? "")} />}
              </Card>

              {/* 6. Grammar and expressions of this occurrence */}
              {(expressions.length > 0 || Object.keys(features).length > 0 || estimated) && (
                <Card title={t("learning:inspector.grammar")}>
                  {estimated && <p className="mb-2 text-xs text-foreground-subtle">{t("learning:inspector.estimatedHint")}</p>}
                  {Object.keys(features).length > 0 && <FeatureList features={features} genderInferred={entry.features?.genderSource === "document"} />}
                  {expressions.length > 0 && (
                    <div className={Object.keys(features).length > 0 ? "mt-4" : ""}>
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground-subtle">{t("learning:inspector.expressions")}</p>
                      <ul>
                        {expressions.map(({ occurrence, entry: expression }) => expression && (
                          <li key={`${occurrence.expression}-${occurrence.tokens.join(",")}`}>
                            <button
                              type="button"
                              onClick={() => onInspect({ type: "expression", expression: occurrence.expression, sentenceId: occurrence.sentenceId })}
                              className="flex min-h-11 w-full items-center justify-between gap-2 text-left text-sm"
                            >
                              <span className="text-foreground" lang={language}>{expression.label}</span>
                              <span className="flex items-center gap-1 text-[11px] text-foreground-subtle">
                                {dynamicT(t, `learning:expressionKinds.${expression.kind}`, undefined, expression.kind)}
                                <ChevronRight size={14} />
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </Card>
              )}

              {/* 7. Pronunciation details */}
              {main && (main.ipa.length > 0 || main.audio.length > 0 || main.hyphenation) && (
                <Card title={t("mobile:learning.word.pronunciation")} icon={<Volume2 size={15} />}>
                  {main.ipa.length > 0 && (
                    <p className="font-mono text-[15px] text-foreground" lang={language}>{main.ipa.slice(0, 4).join(" · ")}</p>
                  )}
                  {main.hyphenation && <p className="mt-1 text-sm text-foreground-muted" lang={language}>{main.hyphenation.join("·")}</p>}
                  {main.audio.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {main.audio.slice(0, 6).map((item, row) => (
                        <button key={item.url} type="button" onClick={() => void playAudio(item.url)} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-border bg-surface px-3 text-[13px] text-foreground active:scale-95">
                          <Play size={13} className="text-primary" />
                          <span lang={language}>{main.word}</span>
                          <span className="text-foreground-subtle">{item.tags.length ? item.tags.slice(0, 2).map(tag).join(", ") : main.audio.length > 1 ? row + 1 : ""}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </Card>
              )}

              {/* 8. Less used: relations, etymology, other entries */}
              {main && (relatedGroups.length > 0 || main.etymology || packEntries.length > 1) && (
                <section className="mt-3 rounded-3xl border border-border bg-surface-muted/60 px-4">
                  {relatedGroups.length > 0 && (
                    <Disclosure title={t("mobile:learning.word.related")}>
                      <div className="space-y-3">
                        {relatedGroups.map((name) => (
                          <div key={name}>
                            <p className="mb-1.5 text-xs text-foreground-subtle">{dynamicT(t, `learning:dictionary.relations.${name}`)}</p>
                            <Chips words={main.relations[name]!.slice(0, 24)} lang={language} />
                          </div>
                        ))}
                      </div>
                    </Disclosure>
                  )}
                  {main.etymology && (
                    <Disclosure title={t("learning:dictionary.etymology")}>
                      <p className="whitespace-pre-line text-sm leading-relaxed text-foreground-muted">{main.etymology}</p>
                    </Disclosure>
                  )}
                  {packEntries.length > 1 && (
                    <Disclosure title={`${t("mobile:learning.word.otherEntries")} (${packEntries.length - 1})`}>
                      <div className="space-y-4">
                        {packEntries.slice(1).map((other, row) => (
                          <div key={`${other.word}-${other.pos}-${row}`}>
                            <p className="text-sm text-foreground">
                              <span className="font-serif font-semibold" lang={language}>{other.word}</span>
                              {other.pos && <span className="ml-2 text-xs text-foreground-muted">{dynamicT(t, `learning:dictionary.pos.${other.pos}`, undefined, other.pos)}</span>}
                              {other.ipa[0] && <span className="ml-2 font-mono text-xs text-foreground-subtle">{other.ipa[0]}</span>}
                            </p>
                            {other.translations.length > 0 && <p className="mt-0.5 text-sm text-primary">{other.translations.slice(0, 6).map((item) => item.word).join(", ")}</p>}
                            <Meanings entry={other} lang={language} compact />
                          </div>
                        ))}
                      </div>
                    </Disclosure>
                  )}
                </section>
              )}

              <button type="button" onClick={() => onInspect({ type: "sentence", sentenceId: resolved.sentence.id })} className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-border text-sm font-medium text-foreground active:bg-surface-muted">
                <ScanText size={16} />
                {t("learning:inspector.analyzeSentence")}
              </button>
              {main && <p className="pt-4 text-center text-[10px] text-foreground-subtle">{t("learning:dictionary.attribution")}</p>}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

const STATE_DOT_CLASS: Record<KnowledgeState, string> = {
  unknown: "bg-info",
  learning: "bg-warning",
  known: "bg-success",
  ignored: "bg-foreground-subtle",
};

const MEANINGS_COLLAPSED = 4;

function Meanings({ entry, lang, compact }: { entry: PackEntry; lang: string; compact?: boolean }) {
  const { t } = useTranslation();
  const tag = useDictionaryTag();
  const [all, setAll] = useState(false);
  const senses = entry.senses.filter((sense) => !sense.formOf?.length || entry.senses.length === 1);
  const limit = compact ? 2 : MEANINGS_COLLAPSED;
  const visible = all ? senses : senses.slice(0, limit);
  return (
    <>
      <ol className="space-y-3">
        {visible.map((sense, row) => (
          <li key={`${sense.gloss}-${row}`} className="flex gap-3">
            <span className="mt-0.5 grid h-5 w-5 flex-shrink-0 place-items-center rounded-full bg-surface text-[11px] font-semibold text-foreground-subtle">{row + 1}</span>
            <div className="min-w-0 text-[14px] leading-snug text-foreground">
              {sense.tags.length > 0 && (
                <span className="mr-1 text-[10px] uppercase tracking-wide text-foreground-subtle">{sense.tags.slice(0, 3).map(tag).join(" · ")}</span>
              )}
              {sense.gloss}
              {!compact && sense.examples.slice(0, 2).map((example, exampleRow) => (
                <p key={exampleRow} className="mt-1.5 border-l-2 border-border pl-2.5 font-serif text-[13px] italic text-foreground-muted" lang={lang}>
                  {example.text}
                  {example.translation && <span className="block not-italic text-foreground-subtle">{example.translation}</span>}
                </p>
              ))}
              {!compact && (sense.relations.synonyms?.length ?? 0) > 0 && (
                <p className="mt-1 text-[12px] text-foreground-subtle">≈ <span lang={lang}>{sense.relations.synonyms!.slice(0, 5).join(", ")}</span></p>
              )}
            </div>
          </li>
        ))}
      </ol>
      {senses.length > limit && (
        <button type="button" onClick={() => setAll((value) => !value)} className="mt-2 min-h-10 text-sm font-medium text-primary">
          {all ? t("learning:dictionary.showLess") : `${t("learning:dictionary.showMore")} (${senses.length - limit})`}
        </button>
      )}
    </>
  );
}

function InflectionTable({ entry, lang, bookForms }: { entry: PackEntry; lang: string; bookForms: string[] }) {
  const { t } = useTranslation();
  const tag = useDictionaryTag();
  const [all, setAll] = useState(false);
  const inBook = new Set(bookForms.map((item) => packKey(item)));
  const rows = entry.forms.filter((item) => !item.tags.includes("auxiliary"));
  const visible = all ? rows : rows.slice(0, FORMS_COLLAPSED);
  return (
    <div className="mt-4">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground-subtle">{t("mobile:learning.word.dictionaryForms", { word: entry.word })}</p>
      <ul className="divide-y divide-border/70">
        {visible.map((item, row) => {
          const present = inBook.has(packKey(item.form));
          return (
            <li key={`${item.form}-${row}`} className="flex min-h-10 items-center gap-3 py-1.5">
              <span className={`min-w-0 flex-shrink-0 text-[14px] ${present ? "font-semibold text-foreground" : "text-foreground"}`} lang={lang}>{item.form}</span>
              <span className="min-w-0 flex-1 text-right text-[11px] leading-tight text-foreground-subtle">{item.tags.map(tag).join(", ")}</span>
              {present && <span className="flex-shrink-0 rounded-full bg-primary-muted px-1.5 text-[10px] font-semibold text-primary">{t("mobile:learning.word.inBookBadge")}</span>}
            </li>
          );
        })}
      </ul>
      {rows.length > FORMS_COLLAPSED && (
        <button type="button" onClick={() => setAll((value) => !value)} className="mt-1 min-h-10 text-sm font-medium text-primary">
          {all ? t("learning:dictionary.showLess") : `${t("learning:dictionary.showMore")} (${rows.length - FORMS_COLLAPSED})`}
        </button>
      )}
    </div>
  );
}

function YourTranslation({ value, suggestion, onSave }: { value: string; suggestion: string; onSave(value: string): void }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(value || suggestion);
          setEditing(true);
        }}
        className="flex min-h-12 w-full items-center gap-3 rounded-2xl border border-border bg-surface px-3 text-left text-sm active:bg-surface-muted"
      >
        <Pencil size={16} className="flex-shrink-0 text-foreground-subtle" />
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] uppercase tracking-wider text-foreground-subtle">{t("mobile:learning.word.yourTranslation")}</span>
          <span className={value ? "text-foreground" : "text-foreground-muted"}>{value || t("learning:translation.addYours")}</span>
        </span>
      </button>
    );
  }
  return (
    <form
      className="flex gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(draft.trim());
        setEditing(false);
      }}
    >
      <input
        autoFocus
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder={t("learning:translation.placeholder")}
        className="h-12 min-w-0 flex-1 rounded-2xl border border-input-border bg-input px-3 text-[15px] text-foreground focus:border-primary focus:outline-none"
      />
      <button type="submit" className="rounded-2xl bg-primary px-4 text-sm font-semibold text-primary-foreground">{t("learning:actions.save")}</button>
    </form>
  );
}
