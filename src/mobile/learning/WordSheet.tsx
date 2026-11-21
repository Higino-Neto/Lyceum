import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Download, Maximize2, NotebookPen, Pencil, ScanText, Volume2, X } from "lucide-react";
import { effectiveState, lemmaState, sentenceText, type KnowledgeState } from "../../core/language-learning";
import { RELATION_ORDER, type PackEntry } from "../../core/dictionary-packs";
import type { LearningReaderSettings } from "../../features/language-learning/settings";
import type { TranslationService } from "../../features/language-learning/translation";
import { useTranslation } from "../../i18n";
import type { LearningSession } from "../../pages/ReadingPage/components/lyceum-reader/useLearningSessionCore";
import { useTranslationLookup } from "../../pages/ReadingPage/components/lyceum-reader/useTranslationLookup";
import { useDictionaryPackEntry } from "../../pages/ReadingPage/components/lyceum-reader/useDictionaryPackEntry";
import { entryRelation, playAudio, useDictionaryTag } from "../../pages/ReadingPage/components/lyceum-reader/dictionaryUi";
import { STATE_ORDER, dynamicT, posLabel, stateLabelKey } from "../../pages/ReadingPage/components/lyceum-reader/uiHelpers";
import type { AnnotationDraftTarget } from "../../pages/ReadingPage/components/lyceum-reader/AnnotationComposer";
import type { InspectorSelection } from "../../pages/ReadingPage/components/lyceum-reader/InspectorPanel";
import type { ScrollTarget } from "../../pages/ReadingPage/components/lyceum-reader/ReadingSurface";

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
  /** Opens the full inspector (sentence analysis, expressions…) for a selection. */
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

function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-2">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground-subtle">{children}</h3>
      {aside}
    </div>
  );
}

function Chips({ words, lang, tone = "plain" }: { words: string[]; lang?: string; tone?: "plain" | "primary" }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {words.map((word) => (
        <span
          key={word}
          lang={lang}
          className={`rounded-full px-3 py-1 text-[13px] ${tone === "primary" ? "bg-primary-muted font-medium text-primary" : "border border-border bg-surface-muted text-foreground"}`}
        >
          {word}
        </span>
      ))}
    </div>
  );
}

function Disclosure({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-border">
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex min-h-12 w-full items-center justify-between text-left text-sm font-medium text-foreground active:bg-surface-muted">
        {title}
        <ChevronDown size={18} className={`text-foreground-subtle transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="pb-3">{children}</div>}
    </div>
  );
}

/**
 * Word card docked at the bottom while reading. Collapsed it shows the word,
 * its translation and the four knowledge states; pulling it up (or tapping
 * the handle) opens the details, ordered by how often a reader needs them:
 * occurrences in the book, synonyms, translations and meanings first, then
 * the book's sentences and forms, and finally relations, inflections and
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
  const occurrences = useMemo(() => (index && lexeme >= 0 ? index.lexemeOccurrences(lexeme) : []), [index, lexeme]);
  const position = occurrences.indexOf(ordinal);
  const forms = useMemo(() => (index && lexeme >= 0 ? index.formsOfLexeme(lexeme) : []), [index, lexeme]);
  const chapterCount = useMemo(
    () => (index && resolved ? index.lexemeOccurrences(lexeme, { chapterIndex: resolved.chapterIndex }).length : 0),
    [index, lexeme, resolved],
  );
  const examples = useMemo(() => {
    if (!index || !resolved) return [];
    const result: Array<{ ordinal: number; text: string; start: number; end: number; chapterIndex: number }> = [];
    const seen = new Set<string>([resolved.sentence.id]);
    for (const other of occurrences) {
      const target = index.resolve(other);
      if (!target || seen.has(target.sentence.id)) continue;
      seen.add(target.sentence.id);
      result.push({
        ordinal: other,
        text: sentenceText(target.block, target.sentence),
        start: target.tuple[0] - target.sentence.start,
        end: target.tuple[1] - target.sentence.start,
        chapterIndex: target.chapterIndex,
      });
      if (result.length >= 3) break;
    }
    return result;
  }, [index, occurrences, resolved]);

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
    setMaxHeight(Math.round((parent?.clientHeight ?? window.innerHeight) * 0.9));
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
  useLayoutEffect(measure, [measure, lookup.status, record?.translation, main?.ipa]);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [ordinal]);
  useEffect(() => {
    if (!expanded) if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [expanded]);

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

  if (!resolved || !entry || !document) return null;

  const pos = posLabel(t, entry.pos);
  const ipa = main?.ipa[0];
  const recording = main?.audio[0]?.url;
  const synonyms = main ? entryRelation(main, "synonyms") : [];
  const antonyms = main ? entryRelation(main, "antonyms", 10) : [];
  const translations = [...new Set((main?.translations ?? []).map((translation) => translation.word))];
  const relatedGroups = main ? RELATION_ORDER.filter((name) => !["synonyms", "antonyms"].includes(name) && main.relations[name]?.length) : [];
  const meanings = main ? main.senses.filter((sense) => !sense.formOf?.length || main.senses.length === 1) : [];

  const go = (target: number) => {
    const destination = index?.resolve(target);
    if (!destination) return;
    setExpanded(false);
    onNavigate({ ordinal: target, flash: true }, destination.chapterIndex);
  };
  const pronounce = () => {
    if (recording) {
      void playAudio(recording).then((played) => {
        if (!played && speechAvailable) onSpeak(surface);
      });
    } else onSpeak(surface);
  };

  return (
    <>
      {expanded && <div className="mobile-sheet-backdrop absolute inset-0 z-20 bg-black/35" onClick={() => setExpanded(false)} aria-hidden />}
      <div
        ref={sheetRef}
        className="mobile-sheet absolute inset-x-0 bottom-0 z-30 flex flex-col overflow-hidden rounded-t-3xl border border-border bg-surface px-5 pb-[max(14px,env(safe-area-inset-bottom))] shadow-2xl"
        style={{ height, maxHeight: maxHeight || "90%", transition: dragHeight === null ? "height 240ms cubic-bezier(.2,.8,.2,1)" : "none", touchAction: expanded ? "auto" : "none" }}
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
          className="mx-auto flex h-6 w-20 flex-shrink-0 items-center justify-center"
          style={{ touchAction: "none" }}
        >
          <span className="h-1.5 w-10 rounded-full bg-border-strong" />
        </button>

        {/* Header: always visible */}
        <div className="flex flex-shrink-0 items-start gap-2" style={{ touchAction: "none" }}>
          <div className="min-w-0 flex-1">
            <p className="truncate font-serif text-2xl font-semibold text-foreground" lang={language}>{surface}</p>
            <p className="mt-0.5 truncate text-xs text-foreground-subtle">
              {entry.lemma !== surface ? <span lang={language}>{entry.lemma}</span> : null}
              {entry.lemma !== surface && pos ? " · " : null}
              {pos}
              {ipa ? <span className="ml-1.5 font-mono">{ipa}</span> : null}
            </p>
          </div>
          {(recording || speechAvailable) && (
            <button type="button" onClick={pronounce} aria-label={t("mobile:learning.word.pronounce")} className="grid h-11 w-11 place-items-center rounded-full text-foreground-muted active:bg-surface-muted">
              <Volume2 size={20} />
            </button>
          )}
          <button type="button" onClick={() => onNote({ targetType: "token", targetId: resolved.tokenId, quote: surface, chapterId: resolved.chapterId })} aria-label={t("mobile:learning.note")} className="grid h-11 w-11 place-items-center rounded-full text-foreground-muted active:bg-surface-muted">
            <NotebookPen size={19} />
          </button>
          <button type="button" onClick={onClose} aria-label={t("learning:actions.close")} className="grid h-11 w-11 place-items-center rounded-full text-foreground-muted active:bg-surface-muted">
            <X size={20} />
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

          {/* Knowledge state */}
          <div className="mt-3 grid grid-cols-4 gap-2" role="radiogroup" aria-label={t("mobile:learning.wordState")}>
            {STATE_ORDER.map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={state === value}
                onClick={() => onState(value)}
                className={`min-h-12 min-w-0 rounded-2xl border px-0.5 text-[11px] font-semibold leading-tight tracking-tight transition-transform active:scale-95 ${state === value ? STATE_STYLE[value].active : `border-border bg-surface-muted ${STATE_STYLE[value].idle}`}`}
              >
                {t(stateLabelKey(value))}
              </button>
            ))}
          </div>
          </div>

          {/* Details: revealed by pulling the sheet up */}
          <div className={`pt-5 transition-opacity ${expanded || dragHeight !== null ? "opacity-100" : "opacity-0"}`}>
            <section className="rounded-2xl bg-surface-muted p-3">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-xl font-semibold tabular-nums text-foreground">{entry.count}</p>
                  <p className="text-[11px] text-foreground-subtle">{t("mobile:learning.word.inBook")}</p>
                </div>
                <div>
                  <p className="text-xl font-semibold tabular-nums text-foreground">{chapterCount}</p>
                  <p className="text-[11px] text-foreground-subtle">{t("mobile:learning.word.inChapter")}</p>
                </div>
                <div>
                  <p className="text-xl font-semibold tabular-nums text-foreground">{form?.count ?? 0}</p>
                  <p className="truncate text-[11px] text-foreground-subtle" lang={language}>“{surface}”</p>
                </div>
              </div>
              {occurrences.length > 1 && (
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-2">
                  <button type="button" onClick={() => go(occurrences[(position - 1 + occurrences.length) % occurrences.length] ?? ordinal)} aria-label={t("learning:inspector.previousOccurrence")} className="grid h-10 w-10 place-items-center rounded-full text-foreground-muted active:bg-surface">
                    <ChevronLeft size={20} />
                  </button>
                  <span className="text-xs tabular-nums text-foreground-muted">{t("mobile:learning.word.occurrence", { position: position + 1, total: occurrences.length })}</span>
                  <button type="button" onClick={() => go(occurrences[(position + 1) % occurrences.length] ?? ordinal)} aria-label={t("learning:inspector.nextOccurrence")} className="grid h-10 w-10 place-items-center rounded-full text-foreground-muted active:bg-surface">
                    <ChevronRight size={20} />
                  </button>
                </div>
              )}
            </section>

            {pack.status === "no-pack" && (
              <button type="button" onClick={onManageDictionaries} className="mt-4 flex w-full items-center gap-3 rounded-2xl border border-dashed border-border px-3 py-3 text-left text-sm text-foreground-muted active:bg-surface-muted">
                <Download size={18} className="flex-shrink-0 text-primary" />
                {t("mobile:learning.word.noDetails")}
              </button>
            )}

            {synonyms.length > 0 && (
              <section className="mt-5">
                <SectionTitle>{t("mobile:learning.word.synonyms")}</SectionTitle>
                <Chips words={synonyms} lang={language} />
              </section>
            )}
            {antonyms.length > 0 && (
              <section className="mt-4">
                <SectionTitle>{t("mobile:learning.word.antonyms")}</SectionTitle>
                <Chips words={antonyms} lang={language} />
              </section>
            )}

            {translations.length > 3 && (
              <section className="mt-5">
                <SectionTitle>{t("mobile:learning.word.translations")}</SectionTitle>
                <Chips words={translations.slice(0, 16)} lang={settings.nativeLanguage} tone="primary" />
              </section>
            )}

            {main && meanings.length > 0 && (
              <section className="mt-5">
                <SectionTitle aside={main.matchedForm ? (
                  <span className="truncate text-[11px] text-foreground-muted">
                    {main.matchedForm.tags.map(tag).join(", ")} · <span lang={language}>{main.word}</span>
                  </span>
                ) : undefined}>
                  {t("mobile:learning.word.meanings")}
                </SectionTitle>
                <Meanings entry={main} lang={language} />
              </section>
            )}

            {examples.length > 0 && (
              <section className="mt-5">
                <SectionTitle>{t("mobile:learning.word.inThisBook")}</SectionTitle>
                <ul className="space-y-1">
                  {examples.map((example) => (
                    <li key={example.ordinal}>
                      <button type="button" onClick={() => go(example.ordinal)} className="w-full rounded-xl px-2 py-2 text-left font-serif text-[14px] leading-relaxed text-foreground-muted active:bg-surface-muted" lang={language}>
                        {example.text.slice(0, example.start)}
                        <mark className="rounded bg-primary/15 px-0.5 text-foreground">{example.text.slice(example.start, example.end)}</mark>
                        {example.text.slice(example.end)}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {forms.length > 1 && form && (
              <section className="mt-5">
                <SectionTitle>{t("mobile:learning.word.formsInBook")}</SectionTitle>
                <div className="flex flex-wrap gap-1.5">
                  {forms.slice(0, 20).map((formId) => {
                    const item = document.forms[formId];
                    if (!item) return null;
                    return (
                      <span key={formId} lang={language} className={`rounded-full border px-3 py-1 text-[13px] ${formId === formIndex ? "border-primary text-foreground" : "border-border text-foreground-muted"}`}>
                        {item.form} <span className="text-foreground-subtle">{item.count}</span>
                      </span>
                    );
                  })}
                </div>
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
              </section>
            )}

            <section className="mt-5">
              <SectionTitle>{t("mobile:learning.word.yourTranslation")}</SectionTitle>
              <YourTranslation
                key={entry.key}
                value={record?.translation ?? ""}
                suggestion={lookup.status === "ok" ? lookup.result.text : ""}
                onSave={(value) => void session.saveTranslation(entry.key, entry.lemma, value || null)}
              />
            </section>

            <div className="mt-5">
              {main && relatedGroups.length > 0 && (
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
              {main && main.forms.length > 0 && (
                <Disclosure title={t("learning:dictionary.forms")}>
                  <table className="w-full text-sm">
                    <tbody>
                      {main.forms.slice(0, 48).map((item, row) => (
                        <tr key={`${item.form}-${row}`} className="border-b border-border/60 last:border-0">
                          <td className="py-1.5 pr-3 text-foreground" lang={language}>{item.form}</td>
                          <td className="py-1.5 text-xs text-foreground-subtle">{item.tags.map(tag).join(", ")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Disclosure>
              )}
              {main?.etymology && (
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
                        </p>
                        {other.translations.length > 0 && <p className="mt-0.5 text-sm text-primary">{other.translations.slice(0, 6).map((item) => item.word).join(", ")}</p>}
                        <Meanings entry={other} lang={language} compact />
                      </div>
                    ))}
                  </div>
                </Disclosure>
              )}
              <div className="flex gap-2 border-t border-border pt-3">
                <button type="button" onClick={() => onInspect({ type: "sentence", sentenceId: resolved.sentence.id })} className="mobile-choice flex flex-1 items-center justify-center gap-2 text-sm">
                  <ScanText size={16} />
                  {t("learning:inspector.analyzeSentence")}
                </button>
                <button type="button" onClick={() => onInspect({ type: "word", ordinal })} className="mobile-choice flex flex-1 items-center justify-center gap-2 text-sm">
                  <Maximize2 size={16} />
                  {t("mobile:learning.word.fullInspector")}
                </button>
              </div>
              {main && <p className="pb-2 pt-4 text-center text-[10px] text-foreground-subtle">{t("learning:dictionary.attribution")}</p>}
            </div>
          </div>
        </div>

      </div>
    </>
  );
}

const MEANINGS_COLLAPSED = 3;

function Meanings({ entry, lang, compact }: { entry: PackEntry; lang: string; compact?: boolean }) {
  const { t } = useTranslation();
  const tag = useDictionaryTag();
  const [all, setAll] = useState(false);
  const senses = entry.senses.filter((sense) => !sense.formOf?.length || entry.senses.length === 1);
  const limit = compact ? 2 : MEANINGS_COLLAPSED;
  const visible = all ? senses : senses.slice(0, limit);
  return (
    <>
      <ol className="space-y-2.5">
        {visible.map((sense, row) => (
          <li key={`${sense.gloss}-${row}`} className="flex gap-2.5">
            <span className="mt-0.5 grid h-5 w-5 flex-shrink-0 place-items-center rounded-full bg-surface-muted text-[11px] font-semibold text-foreground-subtle">{row + 1}</span>
            <div className="min-w-0 text-[14px] leading-snug text-foreground">
              {sense.tags.length > 0 && (
                <span className="mr-1 text-[10px] uppercase tracking-wide text-foreground-subtle">{sense.tags.slice(0, 3).map(tag).join(" · ")}</span>
              )}
              {sense.gloss}
              {!compact && sense.examples[0] && (
                <p className="mt-1 font-serif text-[13px] italic text-foreground-muted" lang={lang}>
                  {sense.examples[0].text}
                  {sense.examples[0].translation && <span className="not-italic text-foreground-subtle"> — {sense.examples[0].translation}</span>}
                </p>
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
        className="flex min-h-12 w-full items-center gap-3 rounded-2xl border border-border px-3 text-left text-sm active:bg-surface-muted"
      >
        <Pencil size={16} className="flex-shrink-0 text-foreground-subtle" />
        <span className={value ? "text-foreground" : "text-foreground-muted"}>{value || t("learning:translation.addYours")}</span>
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
