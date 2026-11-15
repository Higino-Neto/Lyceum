import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  dueItems,
  effectiveState,
  TOKEN_FLAG_NUMBER,
  type DifficultWord,
  type GrammarAnalysis,
  type KnowledgeState,
  type LearningAnnotation,
} from "../../../../core/language-learning";
import {
  loadLanguageOverride,
  loadLearningSettings,
  saveLanguageOverride,
  saveLearningSettings,
  type LearningReaderSettings,
} from "../../../../features/language-learning/settings";
import { createDefaultTranslationService } from "../../../../features/language-learning/translation";
import { useTranslation } from "../../../../i18n";
import { useLearningSession } from "./useLearningSession";
import { ReadingSurface, type ScrollTarget, type SurfaceDecorations } from "./ReadingSurface";
import { InspectorPanel, type InspectorSelection } from "./InspectorPanel";
import { LearningPanel, RecoveryNotice, type LearningTab } from "./LearningPanel";
import { LearningToolbar } from "./LearningToolbar";
import { WordMenu, type WordMenuAction } from "./WordMenu";
import { AnnotationComposer, type AnnotationDraftTarget } from "./AnnotationComposer";
import { useNarration } from "./useNarration";
import { DictionaryOfferContext, dynamicT, type DictionaryOfferValue } from "./uiHelpers";
import { useResizablePanel } from "../../../../hooks/useResizablePanel";
import PanelResizeHandle from "../../../../components/ui/PanelResizeHandle";
import "./lyceumReader.css";

interface LyceumLearningViewerProps {
  fileHash: string;
  fileName: string;
  filePath?: string;
}

const STATE_KEYS: Record<string, KnowledgeState> = { "1": "unknown", "2": "learning", "3": "known", "4": "ignored" };
const NARROW_LAYOUT = 980;

function interfaceLanguage(code: string | undefined) {
  return (code ?? "en").toLowerCase().split("-")[0] || "en";
}

function isEditable(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  return Boolean(element && (element.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName)));
}

export default function LyceumLearningViewer({ fileHash, fileName, filePath }: LyceumLearningViewerProps) {
  const { t, i18n } = useTranslation();
  const [settings, setSettings] = useState<LearningReaderSettings>(() => loadLearningSettings(interfaceLanguage(i18n.language)));
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const [languageOverride, setLanguageOverride] = useState<string | null>(() => loadLanguageOverride(fileHash));
  const session = useLearningSession({ fileHash, filePath, language: languageOverride });
  const { document, index, status } = session;

  const [chapterIndex, setChapterIndex] = useState(0);
  const [initialBlockId, setInitialBlockId] = useState<string | null>(null);
  const [chapterProgress, setChapterProgress] = useState(0);
  const [selection, setSelection] = useState<InspectorSelection | null>(null);
  const [menu, setMenu] = useState<{ ordinal: number; x: number; y: number } | null>(null);
  const [annotationDraft, setAnnotationDraft] = useState<AnnotationDraftTarget | null>(null);
  const [scrollTarget, setScrollTarget] = useState<ScrollTarget | null>(null);
  const [grammar, setGrammar] = useState<{ analysis: GrammarAnalysis; sentenceId: string } | null>(null);
  const [learningTab, setLearningTab] = useState<LearningTab>("words");
  const [narrow, setNarrow] = useState(false);
  const inspectorResize = useResizablePanel({ storageKey: "lyceum-learning-reader:inspector-width", defaultWidth: 340, minWidth: 280, maxWidth: 640, edge: "left" });
  const panelResize = useResizablePanel({ storageKey: "lyceum-learning-reader:panel-width", defaultWidth: 360, minWidth: 300, maxWidth: 760, edge: "left" });
  const rootRef = useRef<HTMLDivElement>(null);
  const lookedUp = useRef(new Set<string>());

  const translationService = useMemo(() => createDefaultTranslationService(() => settingsRef.current.onlineTranslation), []);
  // Retry lookups when the provider set changes (native language is a request input already).
  const [dictionaryRevision, setDictionaryRevision] = useState(0);
  const translationRevision = (settings.onlineTranslation ? 1 : 0) + dictionaryRevision * 2;

  const updateSettings = useCallback((patch: Partial<LearningReaderSettings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch };
      saveLearningSettings(next);
      return next;
    });
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setNarrow((entry?.contentRect.width ?? 1200) < NARROW_LAYOUT));
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  // Restore reading position once the document is ready.
  const restoredFor = useRef<string | null>(null);
  useEffect(() => {
    if (status !== "ready" || !document || !index || restoredFor.current === document.documentId) return;
    restoredFor.current = document.documentId;
    const state = session.readingState;
    const savedChapter = state ? document.chapters.findIndex((chapter) => chapter.id === state.chapterId) : -1;
    setChapterIndex(Math.max(0, savedChapter));
    setInitialBlockId(state?.blockId ?? null);
    setSelection(null);
  }, [document, index, session.readingState, status]);

  // Reading time and sessions (reading progress is separate from proficiency).
  const timing = useRef({ seconds: 0, sessionCounted: false });
  const positionRef = useRef<{ blockId: string | null; progress: number }>({ blockId: null, progress: 0 });
  const persistState = useCallback(() => {
    if (!document || !index) return;
    const chapter = document.chapters[chapterIndex];
    if (!chapter) return;
    const range = index.chapterRange(chapterIndex) ?? [0, 0];
    const overall = index.tokenCount > 0 ? (range[0] + (range[1] - range[0]) * positionRef.current.progress) / index.tokenCount : 0;
    const previous = session.readingState;
    const completed = new Set(previous?.completedChapters ?? []);
    if (positionRef.current.progress >= 0.95) completed.add(chapter.id);
    const next = {
      documentId: document.documentId,
      chapterId: chapter.id,
      blockId: positionRef.current.blockId,
      progress: Math.min(1, Math.max(0, overall)),
      completedChapters: [...completed],
      secondsRead: (previous?.secondsRead ?? 0) + timing.current.seconds,
      sessions: (previous?.sessions ?? 0) + (timing.current.sessionCounted ? 0 : 1),
      updatedAt: new Date().toISOString(),
    };
    timing.current = { seconds: 0, sessionCounted: true };
    session.setReadingState(next);
    session.client.saveReadingState(next).catch((error: unknown) => console.error("[LearningReader] progress", error));
  }, [chapterIndex, document, index, session]);
  const persistRef = useRef(persistState);
  persistRef.current = persistState;

  useEffect(() => {
    if (status !== "ready") return;
    const tick = window.setInterval(() => {
      if (window.document.visibilityState === "visible" && window.document.hasFocus()) timing.current.seconds += 15;
    }, 15_000);
    const save = window.setInterval(() => persistRef.current(), 60_000);
    return () => {
      window.clearInterval(tick);
      window.clearInterval(save);
      persistRef.current();
    };
  }, [status]);

  const savePositionTimer = useRef<number | null>(null);
  const handlePosition = useCallback((blockId: string | null, progress: number) => {
    positionRef.current = { blockId, progress };
    setChapterProgress(progress);
    if (savePositionTimer.current) window.clearTimeout(savePositionTimer.current);
    savePositionTimer.current = window.setTimeout(() => persistRef.current(), 1500);
  }, []);

  const goToChapter = useCallback((next: number, blockId: string | null = null) => {
    if (!document) return;
    const bounded = Math.max(0, Math.min(document.chapters.length - 1, next));
    persistRef.current();
    setInitialBlockId(blockId);
    setChapterIndex(bounded);
  }, [document]);

  const navigate = useCallback((target: Omit<ScrollTarget, "nonce">, targetChapter: number) => {
    if (targetChapter !== chapterIndex) goToChapter(targetChapter);
    setScrollTarget({ ...target, nonce: Date.now() });
  }, [chapterIndex, goToChapter]);

  const narration = useNarration({
    document,
    index,
    lang: session.module?.speechLang ?? null,
    rate: settings.speechRate,
    onFollow: (sentenceId, targetChapter) => navigate({ sentenceId }, targetChapter),
  });

  const snapshotRef = useRef(session.snapshot);
  snapshotRef.current = session.snapshot;

  const contextOf = useCallback((ordinal: number) => {
    const resolved = index?.resolve(ordinal);
    return resolved ? { sentenceId: resolved.sentence.id, contextForm: resolved.block.text.slice(resolved.tuple[0], resolved.tuple[1]) } : undefined;
  }, [index]);

  const setWordState = useCallback((ordinal: number, state: KnowledgeState) => {
    const resolved = index?.resolve(ordinal);
    const entry = resolved ? document?.lexicon[resolved.tuple[2]] : undefined;
    const form = resolved ? document?.forms[resolved.tuple[3]] : undefined;
    if (!entry || !form) return;
    const hasOverride = Boolean(snapshotRef.current.forms[`${entry.key}\u0000${form.form}`]);
    void session.setKnowledge(entry.key, entry.lemma, state, hasOverride ? form.form : undefined, contextOf(ordinal));
  }, [contextOf, document, index, session]);

  /**
   * Opens a word in the inspector. A click in the text (`fromText`) on an
   * unknown word also moves it to Learning (which puts it in the review
   * queue) when that setting is on; keyboard navigation and list clicks only
   * inspect.
   */
  const selectWord = useCallback((ordinal: number, options: { fromText?: boolean } = {}) => {
    setSelection({ type: "word", ordinal });
    if (!settingsRef.current.inspectorOpen) updateSettings({ inspectorOpen: true });
    const resolved = index?.resolve(ordinal);
    const entry = resolved ? document?.lexicon[resolved.tuple[2]] : undefined;
    const form = resolved ? document?.forms[resolved.tuple[3]] : undefined;
    if (!resolved || !entry || !form) return;
    if (!lookedUp.current.has(entry.key)) {
      lookedUp.current.add(entry.key);
      session.recordLookup(entry.key, entry.lemma);
    }
    const isNumber = (resolved.tuple[4] & TOKEN_FLAG_NUMBER) !== 0;
    if (options.fromText && settingsRef.current.autoLearnOnClick && settingsRef.current.learningMode && !isNumber
      && effectiveState(snapshotRef.current, entry.key, form.form) === "unknown") {
      setWordState(ordinal, "learning");
    }
  }, [document, index, session, setWordState, updateSettings]);

  /** Click in the text: Ctrl/Cmd+click marks the word Known without opening anything. */
  const handleWordClick = useCallback((ordinal: number, modifiers: { alt: boolean; ctrl: boolean }) => {
    if (modifiers.ctrl) {
      setWordState(ordinal, "known");
      return;
    }
    selectWord(ordinal, { fromText: true });
  }, [selectWord, setWordState]);

  const handleMenuAction = useCallback((action: WordMenuAction) => {
    if (!menu || !index) return;
    const resolved = index.resolve(menu.ordinal);
    if (!resolved) return;
    const surface = resolved.block.text.slice(resolved.tuple[0], resolved.tuple[1]);
    switch (action) {
      case "details":
        selectWord(menu.ordinal);
        break;
      case "copy":
        void navigator.clipboard?.writeText(surface);
        break;
      case "note":
        setAnnotationDraft({ targetType: "token", targetId: resolved.tokenId, quote: surface, chapterId: resolved.chapterId });
        break;
    }
  }, [index, menu, selectWord]);

  // Keyboard: 1-4 knowledge state, arrows move between words, Esc clears.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || isEditable(event.target) || annotationDraft) return;
      if (event.key === "Escape") {
        setSelection(null);
        setMenu(null);
        return;
      }
      if (selection?.type !== "word" || !index) return;
      const state = STATE_KEYS[event.key];
      if (state) {
        event.preventDefault();
        setWordState(selection.ordinal, state);
        return;
      }
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        const range = index.chapterRange(chapterIndex);
        if (!range) return;
        const next = selection.ordinal + (event.key === "ArrowRight" ? 1 : -1);
        if (next < range[0] || next >= range[1]) return;
        event.preventDefault();
        selectWord(next);
        setScrollTarget({ ordinal: next, nonce: Date.now() });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [annotationDraft, chapterIndex, index, selectWord, selection, setWordState]);

  const decorations: SurfaceDecorations = useMemo(() => {
    const result: SurfaceDecorations = {
      selectedOrdinal: null,
      relatedLexeme: null,
      expressionOrdinals: [],
      selectedSentenceId: null,
      speakingSentenceId: narration.sentenceId,
      speakingOrdinal: narration.wordOrdinal,
      grammarRoles: new Map(),
      annotatedIds: new Set(session.annotations.map((annotation) => annotation.targetId)),
    };
    if (selection?.type === "word" && index) {
      result.selectedOrdinal = selection.ordinal;
      result.relatedLexeme = index.resolve(selection.ordinal)?.tuple[2] ?? null;
    }
    if (selection?.type === "expression" && index && document) {
      const first = index.firstOrdinalOf(selection.sentenceId);
      const occurrence = document.expressionOccurrences.find((item) => item.expression === selection.expression && item.sentenceId === selection.sentenceId);
      if (first !== null && occurrence) result.expressionOrdinals = occurrence.tokens.map((token) => first + token);
    }
    if (selection?.type === "sentence") result.selectedSentenceId = selection.sentenceId;
    if (selection?.type === "range" && index) {
      for (let ordinal = selection.start; ordinal <= selection.end; ordinal += 1) result.expressionOrdinals.push(ordinal);
    }
    if (grammar && index) {
      const first = index.firstOrdinalOf(grammar.sentenceId) ?? 0;
      for (const role of grammar.analysis.roles) {
        for (const token of role.tokens) if (!result.grammarRoles.has(first + token)) result.grammarRoles.set(first + token, role.role);
      }
    }
    return result;
  }, [document, grammar, index, narration.sentenceId, narration.wordOrdinal, selection, session.annotations]);

  useEffect(() => {
    if (selection?.type !== "sentence") setGrammar(null);
  }, [selection]);

  const handleGrammarHighlight = useCallback((analysis: GrammarAnalysis | null, sentenceId: string | null) => {
    setGrammar(analysis && sentenceId ? { analysis, sentenceId } : null);
  }, []);

  const handleDifficultWord = useCallback((word: Pick<DifficultWord, "lexeme">) => {
    if (!index) return;
    const occurrences = index.lexemeOccurrences(word.lexeme);
    const range = index.chapterRange(chapterIndex);
    const ordinal = occurrences.find((o) => range && o >= range[0] && o < range[1]) ?? occurrences[0];
    if (ordinal === undefined) return;
    const resolved = index.resolve(ordinal);
    if (!resolved) return;
    selectWord(ordinal);
    navigate({ ordinal, flash: true }, resolved.chapterIndex);
  }, [chapterIndex, index, navigate, selectWord]);

  const handleAnnotationJump = useCallback((id: string) => {
    const annotation = session.annotations.find((item) => item.id === id);
    if (!annotation || !index || !document) return;
    const targetChapter = document.chapters.findIndex((chapter) => chapter.id === annotation.chapterId);
    if (targetChapter < 0) return;
    if (annotation.targetType === "token") {
      const ordinal = index.ordinalOfTokenId(annotation.targetId);
      if (ordinal !== null) navigate({ ordinal, flash: true }, targetChapter);
    } else if (annotation.targetType === "block") {
      navigate({ blockId: annotation.targetId, flash: true }, targetChapter);
    } else {
      navigate({ sentenceId: annotation.targetId, flash: true }, targetChapter);
    }
  }, [document, index, navigate, session.annotations]);

  const documentLanguage = document?.language ?? null;
  const dictionaryOffer = useMemo<DictionaryOfferValue | null>(() => (documentLanguage ? {
    source: documentLanguage,
    target: settings.nativeLanguage,
    onInstalled: () => {
      translationService.refresh();
      setDictionaryRevision((value) => value + 1);
    },
  } : null), [documentLanguage, settings.nativeLanguage, translationService]);

  const changeDocumentLanguage = useCallback((language: string) => {
    saveLanguageOverride(fileHash, language);
    restoredFor.current = null;
    setSelection(null);
    setLanguageOverride(language);
  }, [fileHash]);

  if (status === "loading") {
    const stage = session.progress.stage;
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-foreground-muted">
        <Loader2 size={20} className="animate-spin" />
        <p className="text-sm">{stage ? dynamicT(t, `learning:loading.${stage}`, undefined, t("learning:loading.preparing")) : t("learning:loading.preparing")}</p>
        {session.progress.value > 0 && (
          <div className="h-1 w-48 overflow-hidden rounded-full bg-surface-muted"><div className="h-full bg-primary transition-[width]" style={{ width: `${Math.round(session.progress.value * 100)}%` }} /></div>
        )}
        <p className="max-w-sm text-center text-xs text-foreground-subtle">{t("learning:loading.firstTimeHint", { name: fileName })}</p>
      </div>
    );
  }

  if (status === "error" || !document || !index) {
    const code = session.error ?? "UNKNOWN";
    const known = ["NO_TEXTUAL_CONTENT", "UNSUPPORTED_FORMAT", "FILE_NOT_FOUND"].find((value) => code.includes(value));
    return (
      <div className="flex h-full items-center justify-center px-6 text-center">
        <div className="max-w-md space-y-2">
          <p className="text-base text-foreground">{t("learning:errors.openTitle")}</p>
          <p className="text-sm text-foreground-muted">{known ? dynamicT(t, `learning:errors.${known}`, undefined, code) : code}</p>
          <button type="button" onClick={session.reload} className="mt-2 rounded-sm bg-surface-muted px-3 py-1.5 text-xs text-foreground hover:bg-border-strong cursor-pointer">{t("learning:actions.retry")}</button>
        </div>
      </div>
    );
  }

  const inspectorVisible = settings.inspectorOpen && selection !== null;
  const progressVisible = settings.progressPanelOpen;
  const panelClass = `relative flex-shrink-0 ${narrow ? "absolute inset-y-0 right-0 z-30 max-w-[92%] shadow-2xl" : ""}`;
  const menuResolved = menu ? index.resolve(menu.ordinal) : null;
  const menuEntry = menuResolved ? document.lexicon[menuResolved.tuple[2]] : undefined;
  const menuForm = menuResolved ? document.forms[menuResolved.tuple[3]] : undefined;
  const languageMismatch = session.metadataLanguage !== null && session.metadataLanguage !== document.language;
  const noLemmatization = !document.analyzer.capabilities.includes("lemmatization");

  return (
    <DictionaryOfferContext.Provider value={dictionaryOffer}>
    <div ref={rootRef} className="flex h-full flex-col bg-surface">
      <LearningToolbar
        document={document}
        chapterIndex={chapterIndex}
        chapterProgress={chapterProgress}
        settings={settings}
        onSettings={updateSettings}
        onChapter={(next) => goToChapter(next)}
        documentLanguage={document.language}
        onDocumentLanguage={changeDocumentLanguage}
        narration={{
          available: narration.available,
          status: narration.status,
          onPlay: () => {
            const start = selection?.type === "sentence" ? selection.sentenceId
              : selection?.type === "word" ? index.resolve(selection.ordinal)?.sentence.id
              : positionRef.current.blockId ? document.chapters[chapterIndex]?.blocks.find((block) => block.id === positionRef.current.blockId)?.sentences[0]?.id
              : document.chapters[chapterIndex]?.blocks[0]?.sentences[0]?.id;
            if (start) void narration.playFrom(start);
          },
          onPause: narration.pause,
          onResume: narration.resume,
          onStop: narration.stop,
          onRepeat: narration.repeat,
          onStep: narration.step,
        }}
        inspectorOpen={settings.inspectorOpen}
        progressOpen={settings.progressPanelOpen}
        dueCount={dueItems(session.activeReviewItems).length}
        saveStatus={session.saveStatus}
        onToggleInspector={() => updateSettings({ inspectorOpen: !settings.inspectorOpen })}
        onToggleProgress={() => updateSettings({ progressPanelOpen: !settings.progressPanelOpen })}
      />
      {(languageMismatch || noLemmatization) && settings.learningMode && (
        <div className="flex-shrink-0 border-b border-border bg-background px-3 py-1.5 text-[11px] text-foreground-subtle">
          {languageMismatch && t("learning:banners.languageOverride", { language: document.language, metadata: session.metadataLanguage ?? "" })}
          {languageMismatch && noLemmatization && " · "}
          {noLemmatization && t("learning:banners.limitedAnalysis")}
        </div>
      )}
      {!progressVisible && session.strayBuckets.length > 0 && (
        <div className="flex-shrink-0 border-b border-border"><RecoveryNotice session={session} /><div className="h-3" /></div>
      )}
      <div className="relative flex min-h-0 flex-1">
        <div className="min-w-0 flex-1">
          <ReadingSurface
            document={document}
            index={index}
            chapterIndex={chapterIndex}
            formStates={session.formStates}
            settings={settings}
            decorations={decorations}
            scrollTarget={scrollTarget}
            initialBlockId={initialBlockId}
            onWordClick={handleWordClick}
            onWordContextMenu={(ordinal, x, y) => setMenu({ ordinal, x, y })}
            onSentenceClick={(sentenceId) => {
              setSelection({ type: "sentence", sentenceId });
              if (!settingsRef.current.inspectorOpen) updateSettings({ inspectorOpen: true });
            }}
            onRangeSelect={(start, end) => {
              setSelection({ type: "range", start, end });
              if (!settingsRef.current.inspectorOpen) updateSettings({ inspectorOpen: true });
            }}
            onBackgroundClick={() => setSelection(null)}
            onPosition={handlePosition}
          />
        </div>
        {inspectorVisible && selection && (
          <div className={panelClass} style={{ width: inspectorResize.width }}>
            <PanelResizeHandle
              edge="left"
              label={t("learning:panel.resize")}
              width={inspectorResize.width}
              minWidth={280}
              maxWidth={640}
              isResizing={inspectorResize.isResizing}
              onPointerDown={inspectorResize.startResize}
              onKeyDown={inspectorResize.handleKeyDown}
            />
            <InspectorPanel
              session={session}
              selection={selection}
              settings={settings}
              translationService={translationService}
              translationRevision={translationRevision}
              speechAvailable={narration.available}
              grammarHighlight={grammar !== null}
              onSelect={setSelection}
              onNavigate={navigate}
              onSpeak={(text) => void narration.speakText(text)}
              onGrammarHighlight={handleGrammarHighlight}
              onAnnotate={setAnnotationDraft}
              onClose={() => setSelection(null)}
            />
          </div>
        )}
        {progressVisible && (!narrow || !inspectorVisible) && (
          <div className={panelClass} style={{ width: panelResize.width }}>
            <PanelResizeHandle
              edge="left"
              label={t("learning:panel.resize")}
              width={panelResize.width}
              minWidth={300}
              maxWidth={760}
              isResizing={panelResize.isResizing}
              onPointerDown={panelResize.startResize}
              onKeyDown={panelResize.handleKeyDown}
            />
            <LearningPanel
              session={session}
              settings={settings}
              chapterIndex={chapterIndex}
              tab={learningTab}
              speechAvailable={narration.available}
              onTab={setLearningTab}
              onWord={handleDifficultWord}
              onChapter={(next) => goToChapter(next)}
              onAnnotation={handleAnnotationJump}
              onSpeak={(text) => void narration.speakText(text)}
              onClose={() => updateSettings({ progressPanelOpen: false })}
            />
          </div>
        )}
      </div>
      {menu && menuResolved && menuEntry && menuForm && (
        <WordMenu
          x={menu.x}
          y={menu.y}
          word={menuResolved.block.text.slice(menuResolved.tuple[0], menuResolved.tuple[1])}
          state={effectiveState(session.snapshot, menuEntry.key, menuForm.form)}
          onState={(state) => setWordState(menu.ordinal, state)}
          onAction={handleMenuAction}
          onClose={() => setMenu(null)}
        />
      )}
      {annotationDraft && (
        <AnnotationComposer
          documentId={document.documentId}
          target={annotationDraft}
          categories={Array.from(new Set(session.annotations.map((annotation: LearningAnnotation) => annotation.category).filter(Boolean)))}
          onSave={(annotation) => {
            void session.saveAnnotation(annotation);
            setAnnotationDraft(null);
          }}
          onCancel={() => setAnnotationDraft(null)}
        />
      )}
    </div>
    </DictionaryOfferContext.Provider>
  );
}
