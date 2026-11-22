import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  BookOpenCheck,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Loader2,
  Settings2,
  Volume2,
} from "lucide-react";
import {
  effectiveState,
  TOKEN_FLAG_NUMBER,
  TOKEN_FLAG_PROPER_NOUN_CANDIDATE,
  type DifficultWord,
  type GrammarAnalysis,
  type KnowledgeState,
  type LearningAnnotation,
} from "../../core/language-learning";
import {
  loadLanguageOverride,
  loadLearningSettings,
  saveLanguageOverride,
  saveLearningSettings,
  type LearningReaderSettings,
} from "../../features/language-learning/settings";
import { createDefaultTranslationService } from "../../features/language-learning/translation";
import { prepareLearningDocumentInBrowser, type BrowserLearningFormat } from "../../features/language-learning/browser/prepareInBrowser";
import { getCurrentSession } from "../../lib/supabaseAuth";
import { useTranslation } from "../../i18n";
import { LOCAL_USER_ID } from "../../features/language-learning/learningClient";
import { useLearningSessionCore, type LearningDocumentOpener } from "../../pages/ReadingPage/components/lyceum-reader/useLearningSessionCore";
import { ReadingSurface, type ScrollTarget, type SurfaceDecorations } from "../../pages/ReadingPage/components/lyceum-reader/ReadingSurface";
import { InspectorPanel, type InspectorSelection } from "../../pages/ReadingPage/components/lyceum-reader/InspectorPanel";
import { RecoveryNotice, type LearningTab } from "../../pages/ReadingPage/components/lyceum-reader/LearningPanel";
import { MobileLearningHub } from "./MobileLearningHub";
import { AnnotationComposer, type AnnotationDraftTarget } from "../../pages/ReadingPage/components/lyceum-reader/AnnotationComposer";
import { useNarration } from "../../pages/ReadingPage/components/lyceum-reader/useNarration";
import { DictionaryOfferContext, dynamicT, type DictionaryOfferValue } from "../../pages/ReadingPage/components/lyceum-reader/uiHelpers";
import "../../pages/ReadingPage/components/lyceum-reader/lyceumReader.css";
import MobileSheet from "../MobileSheet";
import { BACK_EVENT } from "../useBackNavigation";
import { getMobileLearningClient } from "./learningRuntime";
import { WordSheet } from "./WordSheet";
import { LearningSettingsSheet } from "./LearningSettingsSheet";
import type { MobileBook } from "../types";
import { canReadAsLyceum } from "./learningSupport";

interface MobileLearningReaderProps {
  book: MobileBook;
  loadBytes(): Promise<Uint8Array>;
  onBack(): void;
  /** Reopens the book in its own reader (EPUB, PDF, TXT); remembered per book. */
  onOpenOriginal?(): void;
}

/** Near the top of the chapter the chrome always shows. */
const CHROME_ALWAYS_VISIBLE_PX = 48;
/** Downward travel that hides the chrome, and upward travel that brings it back. */
const CHROME_HIDE_AFTER_PX = 32;
const CHROME_SHOW_AFTER_PX = 14;
/** The header floats over the text; the text starts below it and slides under it. */
const HEADER_INSET = "calc(env(safe-area-inset-top) + 3.625rem)";

function learningFormatOf(book: Pick<MobileBook, "fileType">): BrowserLearningFormat | null {
  return canReadAsLyceum(book) ? book.fileType : null;
}

function interfaceLanguage(code: string | undefined) {
  return (code ?? "pt").toLowerCase().split("-")[0] || "pt";
}

/** The account id (vocabulary is per user and per language, like desktop); signed out → "local". */
function useLearningUserId() {
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    getCurrentSession()
      .then((session) => {
        if (!cancelled) setUserId(session?.user.id ?? LOCAL_USER_ID);
      })
      .catch(() => {
        if (!cancelled) setUserId(LOCAL_USER_ID);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return userId;
}

export default function MobileLearningReader(props: MobileLearningReaderProps) {
  const userId = useLearningUserId();
  if (!userId) return <ReaderLoading />;
  return <LearningReader {...props} userId={userId} />;
}

function ReaderLoading({ label, progress, hint }: { label?: string; progress?: number; hint?: string }) {
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-3 bg-surface px-8 text-center text-foreground-muted">
      <Loader2 size={22} className="animate-spin text-primary" />
      {label && <p className="text-sm">{label}</p>}
      {progress !== undefined && progress > 0 && (
        <div className="h-1.5 w-56 overflow-hidden rounded-full bg-surface-muted">
          <div className="h-full bg-primary transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      )}
      {hint && <p className="max-w-xs text-xs text-foreground-subtle">{hint}</p>}
    </div>
  );
}

function LearningReader({ book, loadBytes, onBack, onOpenOriginal, userId }: MobileLearningReaderProps & { userId: string }) {
  const { t, i18n } = useTranslation();
  const cacheKey = book.contentHash || book.id;
  const format = learningFormatOf(book);
  const [settings, setSettings] = useState<LearningReaderSettings>(() => loadLearningSettings(interfaceLanguage(i18n.language)));
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const [languageOverride, setLanguageOverride] = useState<string | null>(() => loadLanguageOverride(cacheKey));
  const client = useMemo(() => getMobileLearningClient(userId), [userId]);
  const loadBytesRef = useRef(loadBytes);
  loadBytesRef.current = loadBytes;

  const open = useCallback<LearningDocumentOpener>(async (onProgress) => {
    if (!format) throw new Error("UNSUPPORTED_FORMAT");
    const result = await prepareLearningDocumentInBrowser({
      cacheKey,
      format,
      title: book.title,
      language: languageOverride,
      loadBytes: () => loadBytesRef.current(),
      onProgress,
      pageLabel: (from, to) => t("mobile:learning.pdfPages", { from, to }),
    });
    return { document: result.document, metadataLanguage: result.metadataLanguage };
  }, [book.title, cacheKey, format, languageOverride, t]);

  const session = useLearningSessionCore({ userId, client, open });
  const { document, index, status } = session;

  const [chapterIndex, setChapterIndex] = useState(0);
  const [initialBlockId, setInitialBlockId] = useState<string | null>(null);
  const [chapterProgress, setChapterProgress] = useState(0);
  const [selection, setSelection] = useState<InspectorSelection | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [sheet, setSheet] = useState<"chapters" | "vocabulary" | "settings" | null>(null);
  const [learningTab, setLearningTab] = useState<LearningTab>("words");
  const [annotationDraft, setAnnotationDraft] = useState<AnnotationDraftTarget | null>(null);
  const [scrollTarget, setScrollTarget] = useState<ScrollTarget | null>(null);
  const [grammar, setGrammar] = useState<{ analysis: GrammarAnalysis; sentenceId: string } | null>(null);
  const [chromeVisible, setChromeVisible] = useState(true);
  const lookedUp = useRef(new Set<string>());

  const translationService = useMemo(() => createDefaultTranslationService(() => settingsRef.current.onlineTranslation), []);
  const [dictionaryRevision, setDictionaryRevision] = useState(0);
  const translationRevision = (settings.onlineTranslation ? 1 : 0) + dictionaryRevision * 2;

  const updateSettings = useCallback((patch: Partial<LearningReaderSettings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch };
      saveLearningSettings(next);
      return next;
    });
  }, []);

  // Restore the reading position once the document is ready.
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

  // Reading position and time (separate from vocabulary knowledge).
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
      if (window.document.visibilityState === "visible") timing.current.seconds += 15;
    }, 15_000);
    const onHide = () => {
      if (window.document.visibilityState === "hidden") persistRef.current();
    };
    window.document.addEventListener("visibilitychange", onHide);
    return () => {
      window.clearInterval(tick);
      window.document.removeEventListener("visibilitychange", onHide);
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

  /**
   * Reading forward hides the chrome; a short scroll back brings it back. Works
   * in pixels (not chapter %), so long chapters need the same small gesture.
   */
  const scrollChrome = useRef({ last: 0, travel: 0 });
  const handleScrollOffset = useCallback((top: number) => {
    const state = scrollChrome.current;
    const delta = top - state.last;
    state.last = top;
    if (top <= CHROME_ALWAYS_VISIBLE_PX) {
      state.travel = 0;
      setChromeVisible(true);
      return;
    }
    if (delta === 0) return;
    if (Math.sign(delta) !== Math.sign(state.travel)) state.travel = 0;
    state.travel += delta;
    if (state.travel > CHROME_HIDE_AFTER_PX) setChromeVisible(false);
    else if (state.travel < -CHROME_SHOW_AFTER_PX) setChromeVisible(true);
  }, []);

  const goToChapter = useCallback((next: number, blockId: string | null = null) => {
    if (!document) return;
    const bounded = Math.max(0, Math.min(document.chapters.length - 1, next));
    persistRef.current();
    setSelection(null);
    setInitialBlockId(blockId);
    setChapterIndex(bounded);
    scrollChrome.current = { last: 0, travel: 0 };
    setChromeVisible(true);
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

  const selectWord = useCallback((ordinal: number, options: { fromText?: boolean } = {}) => {
    setSelection({ type: "word", ordinal });
    setDetailsOpen(false);
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
  }, [document, index, session, setWordState]);

  /** Tap inspects; double tap (reported as ctrl) marks Known without opening anything. */
  const handleWordClick = useCallback((ordinal: number, modifiers: { alt: boolean; ctrl: boolean }) => {
    if (modifiers.ctrl) {
      setWordState(ordinal, "known");
      if (navigator.vibrate) navigator.vibrate(12);
      return;
    }
    selectWord(ordinal, { fromText: true });
  }, [selectWord, setWordState]);

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
    if (selection?.type === "range") {
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

  const handleDifficultWord = useCallback((word: Pick<DifficultWord, "lexeme">) => {
    if (!index) return;
    const occurrences = index.lexemeOccurrences(word.lexeme);
    const range = index.chapterRange(chapterIndex);
    const ordinal = occurrences.find((o) => range && o >= range[0] && o < range[1]) ?? occurrences[0];
    if (ordinal === undefined) return;
    const resolved = index.resolve(ordinal);
    if (!resolved) return;
    setSheet(null);
    selectWord(ordinal);
    navigate({ ordinal, flash: true }, resolved.chapterIndex);
  }, [chapterIndex, index, navigate, selectWord]);

  const handleAnnotationJump = useCallback((id: string) => {
    const annotation = session.annotations.find((item) => item.id === id);
    if (!annotation || !index || !document) return;
    const targetChapter = document.chapters.findIndex((chapter) => chapter.id === annotation.chapterId);
    if (targetChapter < 0) return;
    setSheet(null);
    if (annotation.targetType === "token") {
      const ordinal = index.ordinalOfTokenId(annotation.targetId);
      if (ordinal !== null) navigate({ ordinal, flash: true }, targetChapter);
    } else if (annotation.targetType === "block") {
      navigate({ blockId: annotation.targetId, flash: true }, targetChapter);
    } else {
      navigate({ sentenceId: annotation.targetId, flash: true }, targetChapter);
    }
  }, [document, index, navigate, session.annotations]);

  /**
   * Words of this chapter still Unknown (no numbers, no likely names): the
   * ones the reader saw and did not tap. Marking them Known at the end of a
   * chapter is how vocabulary grows on a phone without tapping every word.
   */
  const untouchedWords = useMemo(() => {
    if (!document || !index || !settings.learningMode) return [];
    const chapter = document.chapters[chapterIndex];
    if (!chapter) return [];
    const result = new Map<string, string>();
    for (const block of chapter.blocks) {
      for (const sentence of block.sentences) {
        for (const [, , lexeme, form, flags] of sentence.tokens) {
          if (flags & (TOKEN_FLAG_NUMBER | TOKEN_FLAG_PROPER_NOUN_CANDIDATE)) continue;
          const entry = document.lexicon[lexeme];
          const surface = document.forms[form];
          if (!entry || !surface || result.has(entry.key)) continue;
          if (effectiveState(session.snapshot, entry.key, surface.form) === "unknown") result.set(entry.key, entry.lemma);
        }
      }
    }
    return [...result.entries()].map(([key, label]) => ({ key, label }));
  }, [chapterIndex, document, index, session.snapshot, settings.learningMode]);

  const markUntouchedKnown = useCallback(async () => {
    const entries = untouchedWords;
    if (entries.length === 0) return;
    await session.setManyStates(entries, "known");
    toast((toastItem) => (
      <span className="flex items-center gap-3 text-sm">
        {t("mobile:learning.markedKnown", { count: entries.length })}
        <button
          type="button"
          className="font-semibold text-primary"
          onClick={() => {
            toast.dismiss(toastItem.id);
            void session.setManyStates(entries, "unknown");
          }}
        >
          {t("mobile:learning.undo")}
        </button>
      </span>
    ), { duration: 6000 });
  }, [session, t, untouchedWords]);

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
    saveLanguageOverride(cacheKey, language);
    restoredFor.current = null;
    setSelection(null);
    setLanguageOverride(language);
  }, [cacheKey]);

  // Android back closes sheets and selections before leaving the reader.
  useEffect(() => {
    const onBackButton = (event: Event) => {
      if (event.defaultPrevented) return;
      if (annotationDraft) setAnnotationDraft(null);
      else if (sheet) setSheet(null);
      else if (detailsOpen) setDetailsOpen(false);
      else if (selection) setSelection(null);
      else return;
      event.preventDefault();
    };
    window.addEventListener(BACK_EVENT, onBackButton);
    return () => window.removeEventListener(BACK_EVENT, onBackButton);
  }, [annotationDraft, detailsOpen, selection, sheet]);

  if (status === "loading") {
    const stage = session.progress.stage;
    return (
      <ReaderLoading
        label={stage ? dynamicT(t, `learning:loading.${stage}`, undefined, t("learning:loading.preparing")) : t("learning:loading.preparing")}
        progress={session.progress.value}
        hint={t("mobile:learning.firstTimeHint", { name: book.title })}
      />
    );
  }

  if (status === "error" || !document || !index) {
    const code = session.error ?? "UNKNOWN";
    const known = ["NO_TEXTUAL_CONTENT", "UNSUPPORTED_FORMAT", "FILE_NOT_FOUND", "INVALID_FILE"].find((value) => code.includes(value));
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-3 bg-surface px-8 text-center">
        <p className="text-base font-semibold text-foreground">{t("learning:errors.openTitle")}</p>
        <p className="text-sm text-foreground-muted">{known ? dynamicT(t, `learning:errors.${known}`, undefined, code) : code}</p>
        <div className="mt-2 flex gap-2">
          <button type="button" onClick={onBack} className="mobile-choice px-4">{t("learning:actions.back")}</button>
          {onOpenOriginal && (
            <button type="button" onClick={onOpenOriginal} className="mobile-choice px-4">{t("mobile:readingMode.original", { format: book.fileType.toUpperCase() })}</button>
          )}
          <button type="button" onClick={session.reload} className="mobile-choice mobile-choice-active px-4">{t("learning:actions.retry")}</button>
        </div>
      </div>
    );
  }

  const chapter = document.chapters[chapterIndex];
  const languageMismatch = session.metadataLanguage !== null && session.metadataLanguage !== document.language;
  const wordSelection = selection?.type === "word" ? selection : null;
  const showInspector = selection !== null && (detailsOpen || selection.type !== "word");
  const isLastChapter = chapterIndex >= document.chapters.length - 1;

  const chapterFooter = (
    <div className="mt-10 space-y-3 border-t border-border pt-6 font-sans">
      {untouchedWords.length > 0 && (
        <button type="button" onClick={() => void markUntouchedKnown()} className="mobile-choice flex w-full items-center justify-center gap-2 px-4 py-3 text-sm">
          <BookOpenCheck size={18} className="text-success" />
          {t("mobile:learning.markRemainingKnown", { count: untouchedWords.length })}
        </button>
      )}
      {!isLastChapter && (
        <button type="button" onClick={() => goToChapter(chapterIndex + 1)} className="mobile-primary-button">
          {t("learning:toolbar.nextChapter")}
          <ChevronRight size={18} />
        </button>
      )}
      {untouchedWords.length > 0 && <p className="text-center text-xs text-foreground-subtle">{t("mobile:learning.markRemainingHint")}</p>}
    </div>
  );

  return (
    <DictionaryOfferContext.Provider value={dictionaryOffer}>
      <div className="relative flex h-dvh flex-col bg-surface">
        <header
          className={`absolute inset-x-0 top-0 z-20 border-b border-border bg-surface/95 pt-[env(safe-area-inset-top)] backdrop-blur transition-transform duration-200 ${chromeVisible ? "" : "-translate-y-full"}`}
        >
          <div className="flex h-14 items-center gap-1 px-1.5">
            <button type="button" onClick={onBack} aria-label={t("learning:actions.back")} className="grid h-11 w-11 place-items-center rounded-full text-foreground active:bg-surface-muted">
              <ChevronLeft size={22} />
            </button>
            <button type="button" onClick={() => setSheet("chapters")} className="min-w-0 flex-1 px-1 text-left">
              <p className="truncate text-sm font-semibold text-foreground">{document.title}</p>
              <p className="truncate text-xs text-foreground-subtle">{chapter?.title} · {chapterIndex + 1}/{document.chapters.length}</p>
            </button>
            {narration.available && (
              <button
                type="button"
                aria-label={t("mobile:learning.listen")}
                onClick={() => {
                  if (narration.status === "playing") narration.pause();
                  else if (narration.status === "paused") narration.resume();
                  else {
                    const start = positionRef.current.blockId
                      ? chapter?.blocks.find((block) => block.id === positionRef.current.blockId)?.sentences[0]?.id
                      : chapter?.blocks[0]?.sentences[0]?.id;
                    if (start) void narration.playFrom(start);
                  }
                }}
                className={`grid h-11 w-11 place-items-center rounded-full active:bg-surface-muted ${narration.status === "playing" ? "text-primary" : "text-foreground"}`}
              >
                <Volume2 size={20} />
              </button>
            )}
            <button type="button" onClick={() => setSheet("vocabulary")} aria-label={t("learning:toolbar.progress")} className="grid h-11 w-11 place-items-center rounded-full text-foreground active:bg-surface-muted">
              <GraduationCap size={20} />
            </button>
            <button type="button" onClick={() => setSheet("settings")} aria-label={t("learning:toolbar.settings")} className="grid h-11 w-11 place-items-center rounded-full text-foreground active:bg-surface-muted">
              <Settings2 size={20} />
            </button>
          </div>
          {(languageMismatch && settings.learningMode) && (
            <button type="button" onClick={() => setSheet("settings")} className="block w-full border-t border-border bg-background px-4 py-1.5 text-left text-[11px] text-foreground-subtle">
              {t("learning:banners.languageOverride", { language: document.language, metadata: session.metadataLanguage ?? "" })}
            </button>
          )}
          <div className="h-0.5 bg-surface-muted"><div className="h-full bg-primary/70" style={{ width: `${Math.round(chapterProgress * 100)}%` }} /></div>
        </header>

        {session.strayBuckets.length > 0 && (
          <div className="absolute inset-x-0 top-[calc(env(safe-area-inset-top)+3.75rem)] z-10"><RecoveryNotice session={session} /></div>
        )}

        <div className="min-h-0 flex-1">
          <ReadingSurface
            touch
            topInset={HEADER_INSET}
            onScrollOffset={handleScrollOffset}
            document={document}
            index={index}
            chapterIndex={chapterIndex}
            formStates={session.formStates}
            settings={settings}
            decorations={decorations}
            scrollTarget={scrollTarget}
            initialBlockId={initialBlockId}
            onWordClick={handleWordClick}
            onWordContextMenu={(ordinal) => {
              selectWord(ordinal);
              setDetailsOpen(true);
            }}
            onSentenceClick={(sentenceId) => setSelection({ type: "sentence", sentenceId })}
            onRangeSelect={(start, end) => setSelection({ type: "range", start, end })}
            onBackgroundClick={() => {
              if (selection) setSelection(null);
              else setChromeVisible((visible) => !visible);
            }}
            onPosition={handlePosition}
            footer={chapterFooter}
          />
        </div>

        {wordSelection && !detailsOpen && (
          <WordSheet
            session={session}
            ordinal={wordSelection.ordinal}
            settings={settings}
            translationService={translationService}
            translationRevision={translationRevision}
            speechAvailable={narration.available}
            onState={(state) => setWordState(wordSelection.ordinal, state)}
            onSpeak={(text) => void narration.speakText(text)}
            onInspect={(next) => {
              setSelection(next);
              setDetailsOpen(true);
            }}
            onNavigate={(target, targetChapter) => {
              // The card follows the occurrence it jumped to.
              if (target.ordinal !== undefined) setSelection({ type: "word", ordinal: target.ordinal });
              navigate(target, targetChapter);
            }}
            onNote={(target) => setAnnotationDraft(target)}
            onManageDictionaries={() => setSheet("settings")}
            onClose={() => setSelection(null)}
          />
        )}

        <MobileSheet open={showInspector} size="full" onClose={() => { setDetailsOpen(false); setSelection(null); }} closeLabel={t("learning:actions.close")}>
          {selection && (
            <div className="-mx-5 h-full">
              <InspectorPanel
                session={session}
                selection={selection}
                settings={settings}
                translationService={translationService}
                translationRevision={translationRevision}
                speechAvailable={narration.available}
                grammarHighlight={grammar !== null}
                onSelect={(next) => {
                  setSelection(next);
                  setDetailsOpen(true);
                }}
                onNavigate={(target, targetChapter) => {
                  setDetailsOpen(false);
                  navigate(target, targetChapter);
                }}
                onSpeak={(text) => void narration.speakText(text)}
                onGrammarHighlight={(analysis, sentenceId) => setGrammar(analysis && sentenceId ? { analysis, sentenceId } : null)}
                onAnnotate={setAnnotationDraft}
                onClose={() => { setDetailsOpen(false); setSelection(null); }}
              />
            </div>
          )}
        </MobileSheet>

        <MobileSheet open={sheet === "chapters"} size="full" title={t("learning:toolbar.contents")} onClose={() => setSheet(null)} closeLabel={t("learning:actions.close")}>
          <ol className="space-y-1 pb-4">
            {document.chapters.map((item, position) => {
              const done = session.readingState?.completedChapters.includes(item.id);
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSheet(null);
                      goToChapter(position);
                    }}
                    className={`flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 text-left text-sm ${position === chapterIndex ? "bg-primary-muted text-primary" : "text-foreground active:bg-surface-muted"}`}
                  >
                    <span className="w-7 flex-shrink-0 text-xs text-foreground-subtle">{position + 1}</span>
                    <span className="min-w-0 flex-1 truncate">{item.title}</span>
                    {done && <BookOpenCheck size={16} className="flex-shrink-0 text-success" />}
                  </button>
                </li>
              );
            })}
          </ol>
        </MobileSheet>

        <MobileSheet open={sheet === "vocabulary"} size="full" title={t("learning:panel.title")} onClose={() => setSheet(null)} closeLabel={t("learning:actions.close")}>
          <div className="-mx-5 h-[calc(92dvh-5.5rem)]">
            <MobileLearningHub
              session={session}
              settings={settings}
              chapterIndex={chapterIndex}
              tab={learningTab}
              speechAvailable={narration.available}
              onTab={setLearningTab}
              onWord={handleDifficultWord}
              onChapter={(next) => {
                setSheet(null);
                goToChapter(next);
              }}
              onAnnotation={handleAnnotationJump}
              onSpeak={(text) => void narration.speakText(text)}
            />
          </div>
        </MobileSheet>

        <LearningSettingsSheet
          open={sheet === "settings"}
          settings={settings}
          documentLanguage={document.language}
          onSettings={updateSettings}
          onDocumentLanguage={changeDocumentLanguage}
          onDictionariesChanged={() => {
            translationService.refresh();
            setDictionaryRevision((value) => value + 1);
          }}
          onOpenOriginal={onOpenOriginal ? () => {
            setSheet(null);
            persistRef.current();
            onOpenOriginal();
          } : undefined}
          originalFormatLabel={book.fileType.toUpperCase()}
          onClose={() => setSheet(null)}
        />

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

        {!chromeVisible && !selection && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center pb-[max(6px,env(safe-area-inset-bottom))]">
            <span className="rounded-full bg-surface/80 px-2.5 py-0.5 text-[10px] text-foreground-subtle backdrop-blur">{Math.round(chapterProgress * 100)}%</span>
          </div>
        )}
      </div>
    </DictionaryOfferContext.Provider>
  );
}

