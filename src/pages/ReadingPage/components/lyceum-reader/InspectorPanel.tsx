import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft, ChevronRight, Eye, Layers, StickyNote, Volume2, X, ScanText,
} from "lucide-react";
import {
  analyzeSentenceStructure,
  buildTokenViews,
  effectiveState,
  lemmaState,
  sentenceText,
  TOKEN_FLAG_LEMMA_ESTIMATED,
  TOKEN_FLAG_PROPER_NOUN_CANDIDATE,
  type GrammarAnalysis,
  type KnowledgeState,
} from "../../../../core/language-learning";
import type { TranslationService } from "../../../../features/language-learning/translation";
import type { LearningReaderSettings } from "../../../../features/language-learning/settings";
import { useTranslation } from "../../../../i18n";
import type { LearningSession } from "./useLearningSession";
import { DictionaryOffer } from "./DictionaryOffer";
import { DictionaryEntryPanel } from "./DictionaryEntryPanel";
import { useTranslationLookup, type LookupState } from "./useTranslationLookup";
import { FeatureList, IconButton, Section, StateControl } from "./parts";
import { dynamicT, posLabel } from "./uiHelpers";
import type { ScrollTarget } from "./ReadingSurface";

export type InspectorSelection =
  | { type: "word"; ordinal: number }
  | { type: "expression"; expression: number; sentenceId: string }
  | { type: "sentence"; sentenceId: string }
  | { type: "range"; start: number; end: number };

interface InspectorProps {
  session: LearningSession;
  selection: InspectorSelection;
  settings: LearningReaderSettings;
  translationService: TranslationService;
  translationRevision: number;
  speechAvailable: boolean;
  grammarHighlight: boolean;
  onSelect(selection: InspectorSelection): void;
  onNavigate(target: Omit<ScrollTarget, "nonce">, chapterIndex: number): void;
  onSpeak(text: string): void;
  onGrammarHighlight(roles: GrammarAnalysis | null, sentenceId: string | null): void;
  onAnnotate(target: { targetType: "token" | "expression" | "sentence" | "block"; targetId: string; quote: string; chapterId: string }): void;
  onClose(): void;
}

function TranslationBlock({ state, progressive, offerDictionary }: { state: LookupState; progressive?: boolean; offerDictionary?: boolean }) {
  const { t } = useTranslation();
  const [revealed, setRevealed] = useState(!progressive);
  useEffect(() => setRevealed(!progressive), [progressive, state]);
  if (state.status === "idle") return null;
  if (state.status === "loading") return <p className="text-xs text-foreground-subtle">{t("learning:translation.loading")}</p>;
  if (state.status === "unavailable") {
    return (
      <div>
        <p className="text-xs text-foreground-subtle">{t("learning:translation.unavailable")}</p>
        {offerDictionary && <DictionaryOffer />}
      </div>
    );
  }
  if (state.status === "error") {
    return <p className="text-xs text-foreground-subtle">{t("learning:translation.failed")}</p>;
  }
  return (
    <div className="space-y-1">
      <p
        className={`text-sm text-foreground ${revealed ? "" : "lx-progressive-mask"}`}
        onClick={() => setRevealed(true)}
        title={revealed ? undefined : t("learning:translation.reveal")}
      >
        {state.result.text}
      </p>
      {revealed && state.result.alternatives.length > 0 && (
        <p className="text-xs text-foreground-muted">{state.result.alternatives.join(", ")}</p>
      )}
      <p className="text-[11px] uppercase tracking-wide text-foreground-subtle">
        {dynamicT(t, `learning:providers.${state.result.providerId}`, undefined, state.result.providerId)}
        {state.result.language ? ` · ${state.result.language}` : ""}
      </p>
    </div>
  );
}

function highlightSentence(text: string, start: number, end: number) {
  return (
    <>
      {text.slice(0, start)}
      <mark className="rounded-sm bg-primary-muted px-0.5 text-foreground">{text.slice(start, end)}</mark>
      {text.slice(end)}
    </>
  );
}

function WordInspector({ session, selection, settings, translationService, translationRevision, speechAvailable, onSelect, onNavigate, onSpeak, onAnnotate }: InspectorProps & { selection: { type: "word"; ordinal: number } }) {
  const { t } = useTranslation();
  const { document, index, snapshot } = session;
  const resolved = index?.resolve(selection.ordinal) ?? null;
  const [scope, setScope] = useState<"lemma" | "form">("lemma");
  const [onlyForm, setOnlyForm] = useState(false);
  const [editingTranslation, setEditingTranslation] = useState(false);
  const [draft, setDraft] = useState("");

  const lexeme = resolved ? resolved.tuple[2] : -1;
  const formIndex = resolved ? resolved.tuple[3] : -1;
  const entry = document?.lexicon[lexeme];
  const form = document?.forms[formIndex];
  const surface = resolved ? resolved.block.text.slice(resolved.tuple[0], resolved.tuple[1]) : "";
  const record = entry ? snapshot.lemmas[entry.key] : undefined;
  const lookup = useTranslationLookup(
    translationService, entry?.lemma ?? null, document?.language ?? "und", settings.nativeLanguage, "word", Boolean(entry), translationRevision, surface || null,
  );

  useEffect(() => {
    setOnlyForm(false);
    setEditingTranslation(false);
  }, [selection.ordinal]);

  const occurrences = useMemo(() => {
    if (!index || lexeme < 0) return [];
    return scope === "lemma" ? index.lexemeOccurrences(lexeme) : index.formOccurrences(formIndex);
  }, [formIndex, index, lexeme, scope]);
  const position = occurrences.indexOf(selection.ordinal);
  const forms = useMemo(() => (index && lexeme >= 0 ? index.formsOfLexeme(lexeme) : []), [index, lexeme]);
  const chapterCount = useMemo(
    () => (index && resolved ? index.lexemeOccurrences(lexeme, { chapterIndex: resolved.chapterIndex }).length : 0),
    [index, lexeme, resolved],
  );
  const examples = useMemo(() => {
    if (!index || !resolved) return [];
    const result: Array<{ ordinal: number; text: string; start: number; end: number; chapterIndex: number }> = [];
    const seen = new Set<string>([resolved.sentence.id]);
    for (const ordinal of index.lexemeOccurrences(lexeme)) {
      const other = index.resolve(ordinal);
      if (!other || seen.has(other.sentence.id)) continue;
      seen.add(other.sentence.id);
      result.push({
        ordinal,
        text: sentenceText(other.block, other.sentence),
        start: other.tuple[0] - other.sentence.start,
        end: other.tuple[1] - other.sentence.start,
        chapterIndex: other.chapterIndex,
      });
      if (result.length >= 5) break;
    }
    return result;
  }, [index, lexeme, resolved]);
  const expressions = useMemo(() => {
    if (!document || !resolved) return [];
    return document.expressionOccurrences
      .filter((occurrence) => occurrence.sentenceId === resolved.sentence.id && occurrence.tokens.includes(resolved.tokenIndex))
      .map((occurrence) => ({ occurrence, entry: document.expressions[occurrence.expression] }))
      .filter((item) => item.entry);
  }, [document, resolved]);

  if (!document || !index || !resolved || !entry || !form) return null;

  const formOverride = snapshot.forms[`${entry.key}\u0000${form.form}`];
  const currentState: KnowledgeState = onlyForm || formOverride ? effectiveState(snapshot, entry.key, form.form) : lemmaState(snapshot, entry.key);
  const estimated = (resolved.tuple[4] & TOKEN_FLAG_LEMMA_ESTIMATED) !== 0 || entry.estimated;
  const properNoun = (resolved.tuple[4] & TOKEN_FLAG_PROPER_NOUN_CANDIDATE) !== 0;
  const inReview = currentState === "learning";
  const features = { ...(entry.features ?? {}), ...(form.features ?? {}) };
  const go = (ordinal: number) => {
    const target = index.resolve(ordinal);
    if (!target) return;
    onSelect({ type: "word", ordinal });
    onNavigate({ ordinal, flash: true }, target.chapterIndex);
  };

  const changeState = (state: KnowledgeState) => {
    const context = { sentenceId: resolved.sentence.id, contextForm: surface };
    if (onlyForm || formOverride) void session.setKnowledge(entry.key, entry.lemma, state, form.form, context);
    else void session.setKnowledge(entry.key, entry.lemma, state, undefined, context);
  };

  return (
    <div>
      <header className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="truncate font-serif text-2xl text-foreground" lang={document.language}>{surface}</h2>
            <p className="mt-0.5 text-xs text-foreground-muted">
              {entry.lemma.toLocaleLowerCase() !== surface.toLocaleLowerCase() && (
                <>
                  <span className="text-foreground-subtle">{t("learning:inspector.lemma")} </span>
                  <span className="text-foreground" lang={document.language}>{entry.lemma}</span>
                  {estimated && <span className="ml-1 text-foreground-subtle" title={t("learning:inspector.estimatedHint")}>({t("learning:inspector.estimated")})</span>}
                  {" · "}
                </>
              )}
              {posLabel(t, entry.pos) ?? t("learning:inspector.posUnknown")}
            </p>
          </div>
          {speechAvailable && (
            <IconButton label={t("learning:audio.pronounce")} onClick={() => onSpeak(surface)}>
              <Volume2 size={15} />
            </IconButton>
          )}
        </div>
        {properNoun && currentState === "unknown" && (
          <p className="mt-2 text-xs text-foreground-subtle">{t("learning:inspector.properNounHint")}</p>
        )}
        <div className="mt-3 space-y-2">
          <StateControl value={currentState} onChange={changeState} />
          {forms.length > 1 && (
            <label className="flex items-center gap-2 text-xs text-foreground-muted cursor-pointer">
              <input type="checkbox" className="accent-primary" checked={onlyForm || Boolean(formOverride)} onChange={(event) => {
                if (!event.target.checked && formOverride) void session.clearFormOverride(entry.key, form.form);
                setOnlyForm(event.target.checked);
              }} />
              {t("learning:inspector.onlyThisForm", { form: form.form })}
            </label>
          )}
          <div className="flex items-center gap-1.5">
            <p className="min-w-0 flex-1 text-xs text-foreground-subtle">
              {inReview ? t("learning:inspector.inReviewHint") : t("learning:inspector.learningHint")}
            </p>
            <IconButton label={t("learning:annotations.add")} onClick={() => onAnnotate({ targetType: "token", targetId: resolved.tokenId, quote: surface, chapterId: resolved.chapterId })}>
              <StickyNote size={14} />
            </IconButton>
            <IconButton label={t("learning:inspector.analyzeSentence")} onClick={() => onSelect({ type: "sentence", sentenceId: resolved.sentence.id })}>
              <ScanText size={14} />
            </IconButton>
          </div>
        </div>
      </header>

      <Section title={t("learning:inspector.translation")}>
        {record?.translation && !editingTranslation && (
          <div className="mb-2 flex items-start justify-between gap-2">
            <div>
              <p className="text-sm text-foreground">{record.translation}</p>
              <p className="text-[11px] uppercase tracking-wide text-foreground-subtle">{t("learning:translation.yours")}</p>
            </div>
            <button type="button" className="text-xs text-foreground-muted hover:text-foreground cursor-pointer" onClick={() => { setDraft(record.translation ?? ""); setEditingTranslation(true); }}>
              {t("learning:actions.edit")}
            </button>
          </div>
        )}
        {editingTranslation ? (
          <form
            className="mb-2 flex gap-1.5"
            onSubmit={(event) => {
              event.preventDefault();
              void session.saveTranslation(entry.key, entry.lemma, draft.trim() || null);
              setEditingTranslation(false);
            }}
          >
            <input
              autoFocus
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={t("learning:translation.placeholder")}
              className="h-8 min-w-0 flex-1 rounded-sm border border-input-border bg-input px-2 text-sm text-foreground focus:border-primary focus:outline-none"
            />
            <button type="submit" className="rounded-sm bg-primary px-2 text-xs font-semibold text-primary-foreground cursor-pointer">{t("learning:actions.save")}</button>
          </form>
        ) : !record?.translation && (
          <button type="button" className="mb-2 text-xs text-foreground-muted hover:text-foreground cursor-pointer" onClick={() => { setDraft(lookup.status === "ok" ? lookup.result.text : ""); setEditingTranslation(true); }}>
            + {t("learning:translation.addYours")}
          </button>
        )}
        <TranslationBlock state={lookup} offerDictionary />
      </Section>

      <Section title={t("learning:dictionary.title")}>
        <DictionaryEntryPanel form={surface || null} lemma={entry.lemma} lang={document.language} target={settings.nativeLanguage} revision={translationRevision} />
      </Section>

      {expressions.length > 0 && (
        <Section title={t("learning:inspector.expressions")}>
          <ul className="space-y-1">
            {expressions.map(({ occurrence, entry: expression }) => expression && (
              <li key={`${occurrence.expression}-${occurrence.tokens.join(",")}`}>
                <button
                  type="button"
                  onClick={() => onSelect({ type: "expression", expression: occurrence.expression, sentenceId: occurrence.sentenceId })}
                  className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-sm hover:bg-surface-muted cursor-pointer"
                >
                  <span className="text-foreground" lang={document.language}>{expression.label}</span>
                  <span className="text-[11px] text-foreground-subtle">{dynamicT(t, `learning:expressionKinds.${expression.kind}`, undefined, expression.kind)}</span>
                </button>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {Object.keys(features).length > 0 && (
        <Section title={t("learning:inspector.grammar")}>
          <FeatureList features={features} genderInferred={entry.features?.genderSource === "document"} />
        </Section>
      )}

      <Section title={t("learning:inspector.frequency")}>
        <dl className="space-y-1 text-xs">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-foreground-muted">
              {forms.length > 1
                ? t("learning:inspector.countLemma", { lemma: entry.lemma })
                : t("learning:inspector.countBook")}
            </dt>
            <dd className="font-semibold tabular-nums text-foreground">{entry.count}×</dd>
          </div>
          {forms.length > 1 && (
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-foreground-muted">{t("learning:inspector.countForm", { form: surface })}</dt>
              <dd className="font-semibold tabular-nums text-foreground">{form.count}×</dd>
            </div>
          )}
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-foreground-muted">{t("learning:inspector.countChapter")}</dt>
            <dd className="font-semibold tabular-nums text-foreground">{chapterCount}×</dd>
          </div>
        </dl>
        {forms.length > 1 && (
          <div className="mt-3">
            <p className="mb-1 text-xs text-foreground-subtle">{t("learning:inspector.formsInBook", { lemma: entry.lemma })}</p>
            <div className="flex flex-wrap gap-1">
              {forms.slice(0, 16).map((formId) => {
                const item = document.forms[formId];
                if (!item) return null;
                return (
                  <span key={formId} className={`rounded-sm border px-1.5 py-0.5 text-xs ${formId === formIndex ? "border-primary text-foreground" : "border-border text-foreground-muted"}`} lang={document.language}>
                    {item.form} <span className="text-foreground-subtle">{item.count}</span>
                  </span>
                );
              })}
            </div>
          </div>
        )}
        <div className="mt-3 flex items-center justify-between gap-2">
          {forms.length > 1 ? (
            <div className="flex min-w-0 rounded-sm border border-border p-0.5 text-xs" role="radiogroup" aria-label={t("learning:inspector.browse")}>
              {(["lemma", "form"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={scope === value}
                  onClick={() => setScope(value)}
                  className={`truncate rounded-[3px] px-2 py-0.5 cursor-pointer ${scope === value ? "bg-surface-muted text-foreground" : "text-foreground-muted hover:text-foreground"}`}
                >
                  {value === "lemma" ? t("learning:inspector.browseLemma", { lemma: entry.lemma }) : t("learning:inspector.browseForm", { form: surface })}
                </button>
              ))}
            </div>
          ) : (
            <span className="text-xs text-foreground-subtle">{t("learning:inspector.browse")}</span>
          )}
          <div className="flex flex-shrink-0 items-center gap-1 text-xs text-foreground-muted">
            <IconButton label={t("learning:inspector.previousOccurrence")} disabled={occurrences.length < 2} onClick={() => go(occurrences[(position - 1 + occurrences.length) % occurrences.length] ?? selection.ordinal)}>
              <ChevronLeft size={14} />
            </IconButton>
            <span className="tabular-nums">{position + 1} / {occurrences.length}</span>
            <IconButton label={t("learning:inspector.nextOccurrence")} disabled={occurrences.length < 2} onClick={() => go(occurrences[(position + 1) % occurrences.length] ?? selection.ordinal)}>
              <ChevronRight size={14} />
            </IconButton>
          </div>
        </div>
      </Section>

      {examples.length > 0 && (
        <Section title={t("learning:inspector.examples")}>
          <ul className="space-y-2">
            {examples.map((example) => (
              <li key={example.ordinal}>
                <button type="button" onClick={() => go(example.ordinal)} className="w-full rounded-sm p-1.5 text-left font-serif text-[13px] leading-relaxed text-foreground-muted hover:bg-surface-muted hover:text-foreground cursor-pointer" lang={document.language}>
                  {highlightSentence(example.text, example.start, example.end)}
                </button>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

function ExpressionInspector({ session, selection, settings, translationService, translationRevision, onNavigate, onSelect }: InspectorProps & { selection: { type: "expression"; expression: number; sentenceId: string } }) {
  const { t } = useTranslation();
  const { document, index, snapshot } = session;
  const expression = document?.expressions[selection.expression];
  const lookup = useTranslationLookup(translationService, expression?.label ?? null, document?.language ?? "und", settings.nativeLanguage, "sentence", Boolean(expression), translationRevision);
  const occurrences = useMemo(
    () => (document ? document.expressionOccurrences.filter((occurrence) => occurrence.expression === selection.expression) : []),
    [document, selection.expression],
  );
  if (!document || !index || !expression) return null;
  const reference = expression.glosses?.[settings.nativeLanguage] ?? expression.glosses?.en;
  const state = lemmaState(snapshot, expression.key);

  return (
    <div>
      <header className="pb-3">
        <p className="text-[11px] uppercase tracking-wider text-foreground-subtle">{dynamicT(t, `learning:expressionKinds.${expression.kind}`, undefined, expression.kind)}</p>
        <h2 className="font-serif text-2xl text-foreground" lang={document.language}>{expression.label}</h2>
        <div className="mt-3 space-y-2">
          <StateControl value={state} onChange={(next) => void session.setKnowledge(expression.key, expression.label, next, undefined, { sentenceId: selection.sentenceId, itemType: "expression" })} />
          <p className="text-xs text-foreground-subtle">
            {state === "learning" ? t("learning:inspector.inReviewHint") : t("learning:inspector.learningHint")}
          </p>
        </div>
      </header>
      <Section title={t("learning:inspector.translation")}>
        {reference && (
          <div className="mb-2">
            <p className="text-sm text-foreground">{reference}</p>
            <p className="text-[11px] uppercase tracking-wide text-foreground-subtle">{t("learning:translation.reference")}</p>
          </div>
        )}
        <TranslationBlock state={lookup} />
      </Section>
      {expression.note && (
        <Section title={t("learning:inspector.usage")}>
          <p className="text-xs leading-relaxed text-foreground-muted">{dynamicT(t, `learning:expressionNotes.${expression.note.replace(/^expr\./, "")}`, undefined, "")}</p>
        </Section>
      )}
      <Section title={t("learning:inspector.occurrencesCount", { count: occurrences.length })}>
        <ul className="space-y-2">
          {occurrences.slice(0, 30).map((occurrence, position) => {
            const located = index.sentence(occurrence.sentenceId);
            if (!located) return null;
            const firstOrdinal = index.firstOrdinalOf(occurrence.sentenceId) ?? 0;
            return (
              <li key={`${occurrence.sentenceId}-${position}`}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect({ type: "expression", expression: selection.expression, sentenceId: occurrence.sentenceId });
                    onNavigate({ ordinal: firstOrdinal + (occurrence.tokens[0] ?? 0), flash: true }, located.chapterIndex);
                  }}
                  className={`w-full rounded-sm p-1.5 text-left font-serif text-[13px] leading-relaxed hover:bg-surface-muted cursor-pointer ${occurrence.sentenceId === selection.sentenceId ? "text-foreground" : "text-foreground-muted"}`}
                  lang={document.language}
                >
                  {sentenceText(located.block, located.sentence)}
                </button>
              </li>
            );
          })}
        </ul>
      </Section>
    </div>
  );
}

function SentenceInspector({ session, selection, settings, translationService, translationRevision, speechAvailable, grammarHighlight, onSpeak, onGrammarHighlight, onAnnotate, onSelect }: InspectorProps & { selection: { type: "sentence"; sentenceId: string } }) {
  const { t } = useTranslation();
  const { document, index, module, snapshot } = session;
  const located = index?.sentence(selection.sentenceId) ?? null;
  const text = located ? sentenceText(located.block, located.sentence) : null;
  const [progressive, setProgressive] = useState(true);
  const lookup = useTranslationLookup(translationService, text, document?.language ?? "und", settings.nativeLanguage, "sentence", Boolean(text), translationRevision);
  const [paragraphRequested, setParagraphRequested] = useState(false);
  useEffect(() => setParagraphRequested(false), [selection.sentenceId]);
  const paragraphLookup = useTranslationLookup(translationService, located?.block.text ?? null, document?.language ?? "und", settings.nativeLanguage, "paragraph", paragraphRequested, translationRevision);
  const analysis = useMemo(
    () => (document && module && located ? analyzeSentenceStructure(module, document, located.block, located.sentence) : null),
    [document, located, module],
  );
  const views = useMemo(() => (document && located ? buildTokenViews(document, located.block, located.sentence) : []), [document, located]);

  useEffect(() => {
    onGrammarHighlight(grammarHighlight ? analysis : null, grammarHighlight ? selection.sentenceId : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysis, grammarHighlight, selection.sentenceId]);

  if (!document || !index || !located || !text) return null;
  const firstOrdinal = index.firstOrdinalOf(selection.sentenceId) ?? 0;
  const chapterId = document.chapters[located.chapterIndex]?.id ?? "";
  const tokenText = (indexes: number[]) => indexes.map((i) => views[i]?.text ?? "").join(" ");

  return (
    <div>
      <header className="pb-3">
        <p className="text-[11px] uppercase tracking-wider text-foreground-subtle">{t("learning:inspector.sentence")}</p>
        <p className="mt-1 font-serif text-[15px] leading-relaxed text-foreground" lang={document.language}>{text}</p>
        <div className="mt-2 flex gap-1">
          {speechAvailable && (
            <IconButton label={t("learning:audio.playSentence")} onClick={() => onSpeak(text)}><Volume2 size={14} /></IconButton>
          )}
          <IconButton label={t("learning:annotations.add")} onClick={() => onAnnotate({ targetType: "sentence", targetId: selection.sentenceId, quote: text, chapterId })}>
            <StickyNote size={14} />
          </IconButton>
          <IconButton label={t("learning:annotations.addParagraph")} onClick={() => onAnnotate({ targetType: "block", targetId: located.block.id, quote: located.block.text, chapterId })}>
            <Layers size={14} />
          </IconButton>
        </div>
      </header>

      <Section
        title={t("learning:inspector.translation")}
        aside={(
          <label className="flex items-center gap-1 text-[11px] text-foreground-muted cursor-pointer" title={t("learning:translation.progressiveHint")}>
            <input type="checkbox" className="accent-primary" checked={progressive} onChange={(event) => setProgressive(event.target.checked)} />
            <Eye size={11} /> {t("learning:translation.progressive")}
          </label>
        )}
      >
        <TranslationBlock state={lookup} progressive={progressive} />
        <div className="mt-3">
          <p className="mb-1 text-[11px] uppercase tracking-wide text-foreground-subtle">{t("learning:translation.literal")}</p>
          <p className="text-xs leading-relaxed">
            {views.map((view, i) => {
              const tuple = located.sentence.tokens[i];
              const entry = tuple ? document.lexicon[tuple[2]] : undefined;
              const gloss = entry ? snapshot.lemmas[entry.key]?.translation : null;
              return (
                <button key={i} type="button" onClick={() => onSelect({ type: "word", ordinal: firstOrdinal + i })} className="mr-1.5 inline-flex flex-col items-start align-top cursor-pointer hover:opacity-80">
                  <span className="text-foreground" lang={document.language}>{view.text}</span>
                  <span className={gloss ? "text-foreground-muted" : "text-foreground-subtle"}>{gloss ?? "·"}</span>
                </button>
              );
            })}
          </p>
          <p className="mt-1 text-[10px] text-foreground-subtle">{t("learning:translation.literalHint")}</p>
        </div>
        <div className="mt-3">
          {!paragraphRequested ? (
            <button type="button" className="text-xs text-foreground-muted hover:text-foreground cursor-pointer" onClick={() => setParagraphRequested(true)}>
              {t("learning:translation.translateParagraph")}
            </button>
          ) : (
            <>
              <p className="mb-1 text-[11px] uppercase tracking-wide text-foreground-subtle">{t("learning:translation.paragraph")}</p>
              <TranslationBlock state={paragraphLookup} progressive={progressive} />
            </>
          )}
        </div>
      </Section>

      <Section
        title={t("learning:grammar.title")}
        aside={analysis && (
          <label className="flex items-center gap-1 text-[11px] text-foreground-muted cursor-pointer">
            <input type="checkbox" className="accent-primary" checked={grammarHighlight} onChange={(event) => onGrammarHighlight(event.target.checked ? analysis : null, event.target.checked ? selection.sentenceId : null)} />
            {t("learning:grammar.highlight")}
          </label>
        )}
      >
        {!analysis ? (
          <p className="text-xs text-foreground-subtle">{t("learning:grammar.unavailable")}</p>
        ) : (
          <div className="space-y-3">
            <p className="text-[11px] text-foreground-subtle">{t("learning:grammar.disclaimer")}</p>
            {analysis.clauses.length > 1 && (
              <ul className="space-y-1">
                {analysis.clauses.map((clause, i) => (
                  <li key={i} className="text-xs">
                    <span className="text-foreground-subtle">{dynamicT(t, `learning:grammar.clauses.${clause.type}`, undefined, clause.type)}: </span>
                    <span className="text-foreground" lang={document.language}>{tokenText(Array.from({ length: clause.end - clause.start + 1 }, (_, k) => clause.start + k))}</span>
                  </li>
                ))}
              </ul>
            )}
            {analysis.roles.length > 0 && (
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                {analysis.roles.map((role, i) => (
                  <div key={i} className="contents">
                    <dt className="text-foreground-subtle">
                      {dynamicT(t, `learning:grammar.roles.${role.role}`, undefined, role.role)}
                      {role.confidence === "possible" && <span title={t("learning:grammar.possibleHint")}> ?</span>}
                    </dt>
                    <dd className="text-foreground" lang={document.language}>
                      {tokenText(role.tokens)}
                      {role.features?.case && <span className="ml-1 text-foreground-subtle">({dynamicT(t, `learning:values.${role.features.case}`, undefined, role.features.case)})</span>}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
            {[...analysis.notes, ...analysis.roles.flatMap((role) => (role.note ? [role.note] : []))].length > 0 && (
              <ul className="space-y-1.5">
                {dedupeNotes([...analysis.notes, ...analysis.roles.flatMap((role) => (role.note ? [role.note] : []))]).map((note, i) => (
                  <GrammarNoteItem key={i} code={note.code} params={note.params ?? {}} />
                ))}
              </ul>
            )}
          </div>
        )}
      </Section>
    </div>
  );
}

function dedupeNotes<T extends { code: string; params?: Record<string, string> }>(notes: T[]) {
  const seen = new Set<string>();
  return notes.filter((note) => {
    const key = `${note.code}|${JSON.stringify(note.params ?? {})}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function GrammarNoteItem({ code, params }: { code: string; params: Record<string, string> }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const base = code.replace(/^grammar\./, "").replace(/\./g, "_");
  const localizedParams = Object.fromEntries(Object.entries(params).map(([key, value]) => [key, dynamicT(t, `learning:values.${value}`, undefined, value)]));
  const title = dynamicT(t, `learning:grammarNotes.${base}.title`, localizedParams, code);
  const body = dynamicT(t, `learning:grammarNotes.${base}.body`, localizedParams, "");
  return (
    <li className="rounded-sm bg-background">
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left text-xs text-foreground cursor-pointer" aria-expanded={open}>
        {title}
        {body && (open ? <ChevronLeft size={12} className="-rotate-90" /> : <ChevronRight size={12} />)}
      </button>
      {open && body && <p className="px-2 pb-2 text-xs leading-relaxed text-foreground-muted">{body}</p>}
    </li>
  );
}

function RangeInspector({ session, selection, settings, translationService, translationRevision, speechAvailable, onSpeak, onSelect }: InspectorProps & { selection: { type: "range"; start: number; end: number } }) {
  const { t } = useTranslation();
  const { document, index } = session;
  const first = index?.resolve(selection.start);
  const last = index?.resolve(selection.end);
  const sameBlock = first && last && first.block.id === last.block.id;
  const text = sameBlock ? first.block.text.slice(first.tuple[0], last.tuple[1]) : null;
  const lookup = useTranslationLookup(translationService, text, document?.language ?? "und", settings.nativeLanguage, "sentence", Boolean(text), translationRevision);
  if (!document || !first || !text) return null;
  const sameSentence = last && last.sentence.id === first.sentence.id;
  const matching = sameSentence
    ? document.expressionOccurrences.find((occurrence) => occurrence.sentenceId === first.sentence.id
      && occurrence.tokens.every((token) => token >= first.tokenIndex && token <= last.tokenIndex))
    : undefined;
  return (
    <div>
      <header className="pb-3">
        <p className="text-[11px] uppercase tracking-wider text-foreground-subtle">{t("learning:inspector.phrase")}</p>
        <p className="mt-1 font-serif text-lg text-foreground" lang={document.language}>{text}</p>
        {speechAvailable && (
          <div className="mt-2"><IconButton label={t("learning:audio.pronounce")} onClick={() => onSpeak(text)}><Volume2 size={14} /></IconButton></div>
        )}
      </header>
      <Section title={t("learning:inspector.translation")}>
        <TranslationBlock state={lookup} />
      </Section>
      {matching && document.expressions[matching.expression] && (
        <Section title={t("learning:inspector.expressions")}>
          <button type="button" className="text-sm text-foreground hover:underline cursor-pointer" onClick={() => onSelect({ type: "expression", expression: matching.expression, sentenceId: matching.sentenceId })}>
            {document.expressions[matching.expression]?.label}
          </button>
        </Section>
      )}
    </div>
  );
}

export function InspectorPanel(props: InspectorProps) {
  const { t } = useTranslation();
  const { selection } = props;
  return (
    <aside className="flex h-full w-full flex-col border-l border-border bg-surface" aria-label={t("learning:inspector.title")}>
      <div className="flex h-10 flex-shrink-0 items-center justify-between border-b border-border px-3">
        <span className="text-xs font-semibold text-foreground-muted">{t("learning:inspector.title")}</span>
        <IconButton label={t("learning:actions.close")} onClick={props.onClose}><X size={14} /></IconButton>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {selection.type === "word" && <WordInspector {...props} selection={selection} />}
        {selection.type === "expression" && <ExpressionInspector {...props} selection={selection} />}
        {selection.type === "sentence" && <SentenceInspector {...props} selection={selection} />}
        {selection.type === "range" && <RangeInspector {...props} selection={selection} />}
      </div>
    </aside>
  );
}
