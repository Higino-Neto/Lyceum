import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SessionPdfData } from "../../../../types/ReadingTypes";
import useReadingStatePersistence from "../../hooks/useReadingStatePersistence";
import useSessionTracker from "../../hooks/useSessionTracker";
import { createPdfJsViewerUrl } from "./pdfRenderer";
import { useChapterTracker, type ChapterTrackerChannelOptions } from "./chapters/useChapterTracker";
import ChapterSidebar from "./chapters/ChapterSidebar";
import { AnimatePresence, motion } from "motion/react";
import AnnotationPanel from "./annotations/AnnotationPanel";
import type { PdfSelectionPayload, PdfSelectionRect } from "../../../../types/AnnotationTypes";
import {
  CMD_NAVIGATE,
  CMD_RESTORE,
  CMD_SET_ANNOTATIONS_STATE,
  CMD_SET_CHAPTERS_STATE,
  CMD_SET_HIGHLIGHTS,
  CMD_SET_STRINGS,
  CMD_SET_THEME,
  EVT_DOCUMENT_READY,
  EVT_CREATE_CONCEPT,
  EVT_RESTORE_COMPLETE,
  EVT_STATE_CHANGED,
  EVT_TOGGLE_ANNOTATIONS,
  EVT_TOGGLE_CHAPTERS,
  EVT_EXPORT_PAGES,
  EVT_REQUEST_EXERCISE_PAGES,
  parsePdfViewerMessage,
  postToPdfViewer,
  type PdfViewerEvent,
  type PdfViewState,
} from "./pdfBridgeProtocol";
import { useAppSettings } from "../../../../contexts/AppSettingsContext";
import {
  SEMANTIC_TOKEN_NAMES,
  resolveThemeTokens,
} from "../../../../theme/tokens";

import { CMD_SET_BOOK_LANDMARKS, type BookLandmark } from "../../../../core/pdf-reader-core/contract";
import { translate, useTranslation } from "../../../../i18n";
import { usePagePicking } from "./usePagePicking";

interface PdfJsViewerProps {
  fileHash: string;
  fileName?: string;
  filePath?: string;
  hasSessionStarted: boolean;
  hasSessionFinished: boolean;
  onTotalBookPages: (totalBookPages: number) => void;
  onReadingInfo: (data: SessionPdfData) => void;
  showChapters?: boolean;
  onToggleChapters?: () => void;
  onCloseChapters?: () => void;
}

const SAVE_NOW_INTERVAL_MS = 15000;

function toReadingState(state: PdfViewState) {
  return {
    currentPage: state.page,
    currentZoom: state.currentScale,
    currentScroll: state.scrollTop,
  };
}

export default function PdfJsViewer({
  fileHash,
  fileName,
  filePath,
  hasSessionStarted,
  hasSessionFinished,
  onTotalBookPages,
  onReadingInfo,
  showChapters = false,
  onToggleChapters,
  onCloseChapters,
}: PdfJsViewerProps) {
  const { t } = useTranslation();
  const { effectiveTheme, settings } = useAppSettings();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const lastStateRef = useRef<PdfViewState | null>(null);
  const devRestoreStateRef = useRef<PdfViewState | null>(null);
  const restoreStartedRef = useRef(false);
  const restoreCompletedRef = useRef(false);
  const restoreGenRef = useRef(0);
  const viewerSubscribersRef = useRef(new Set<(data: PdfViewerEvent) => void>());
  const [currentPage, setCurrentPage] = useState(1);
  const [currentPageConceptCount, setCurrentPageConceptCount] = useState(0);
  const [showAnnotations, setShowAnnotations] = useState(false);
  const [pendingSelection, setPendingSelection] = useState<PdfSelectionPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [documentReady, setDocumentReady] = useState(false);
  const [viewerRevision, setViewerRevision] = useState(0);
  const { loadState, saveNow, scheduleSave } = useReadingStatePersistence(fileHash);

  const viewerUrls = useMemo(
    () => createPdfJsViewerUrl({ fileHash, fileName }),
    [fileHash, fileName],
  );

  const sourceUrl = viewerUrls?.sourceUrl ?? "";

  const postToViewer = useCallback((type: string, payload: Record<string, unknown> = {}) => {
    postToPdfViewer(iframeRef.current?.contentWindow, type, payload);
  }, []);

  const viewerTheme = useMemo(() => {
    const tokens = resolveThemeTokens(effectiveTheme, settings.accentColor);
    return {
      theme: effectiveTheme,
      colors: Object.fromEntries(
        SEMANTIC_TOKEN_NAMES.map((name) => [name, tokens[name]]),
      ),
    };
  }, [effectiveTheme, settings.accentColor]);

  const bookEdgeStrings = useMemo(() => ({
    edgeAriaLabel: t("pdf:bookEdge.edgeAriaLabel"),
    edgeTitle: t("pdf:bookEdge.edgeTitle"),
    dialogTitle: t("pdf:bookEdge.dialogTitle"),
    closeLabel: t("pdf:bookEdge.closeLabel"),
    gridAriaLabel: t("pdf:bookEdge.gridAriaLabel"),
    closeLookAriaLabel: t("pdf:bookEdge.closeLookAriaLabel"),
    bookmarkAdd: t("pdf:bookEdge.bookmarkAdd"),
    bookmarkRemove: t("pdf:bookEdge.bookmarkRemove"),
    openPage: t("pdf:bookEdge.openPage"),
    previous: t("pdf:bookEdge.previous"),
    next: t("pdf:bookEdge.next"),
    help: t("pdf:bookEdge.help"),
    contextFallback: t("pdf:bookEdge.contextFallback"),
    contextPage: t("pdf:bookEdge.contextPage", { page: "{{page}}" }),
    range: t("pdf:bookEdge.range", { from: "{{from}}", to: "{{to}}", total: "{{total}}", selected: "{{selected}}" }),
    selection: t("pdf:bookEdge.selection"),
    inspectPage: t("pdf:bookEdge.inspectPage", { page: "{{page}}" }),
    marked: t("pdf:bookEdge.marked"),
    loading: t("pdf:bookEdge.loading"),
    loadError: t("pdf:bookEdge.loadError"),
    previewPage: t("pdf:bookEdge.previewPage", { page: "{{page}}" }),
    bookmarkSavedSession: t("pdf:bookEdge.bookmarkSavedSession"),
    landmarkNote: t("pdf:bookEdge.landmarkNote", { page: "{{page}}" }),
    landmarkHighlight: t("pdf:bookEdge.landmarkHighlight", { page: "{{page}}" }),
    bookmarkTitle: t("pdf:bookEdge.bookmarkTitle", { page: "{{page}}" }),
    pickHint: t("pdf:bookEdge.pickHint"),
    pickSummary: t("pdf:bookEdge.pickSummary", { count: "{{count}}", ranges: "{{ranges}}" }),
    pickClear: t("pdf:bookEdge.pickClear"),
    pickExport: t("pdf:bookEdge.pickExport"),
    pickExercises: t("pdf:bookEdge.pickExercises"),
    pickAdd: t("pdf:bookEdge.pickAdd"),
    pickRemove: t("pdf:bookEdge.pickRemove"),
    pickBusyExport: t("pdf:bookEdge.pickBusyExport"),
    pickBusyExercises: t("pdf:bookEdge.pickBusyExercises"),
    pickedLabel: t("pdf:bookEdge.pickedLabel"),
  }), [t]);

  const syncViewerTheme = useCallback(() => {
    postToViewer(CMD_SET_THEME, viewerTheme);
  }, [postToViewer, viewerTheme]);

  const syncBookEdgeStrings = useCallback(() => {
    postToViewer(CMD_SET_STRINGS, { bookEdge: bookEdgeStrings });
  }, [postToViewer, bookEdgeStrings]);

  const { syncPickState, exportPages, pickExercises } = usePagePicking({ filePath, fileName, postToViewer });

  const subscribeToViewerEvents = useCallback((handler: (data: PdfViewerEvent) => void) => {
    viewerSubscribersRef.current.add(handler);
    return () => {
      viewerSubscribersRef.current.delete(handler);
    };
  }, []);

  const viewerChannel = useMemo<ChapterTrackerChannelOptions>(
    () => ({ postToViewer, subscribeToViewerEvents }),
    [postToViewer, subscribeToViewerEvents],
  );

  const syncChapterButtonState = useCallback(() => {
    postToViewer(CMD_SET_CHAPTERS_STATE, { open: showChapters });
  }, [postToViewer, showChapters]);

  const syncAnnotationButtonState = useCallback(() => {
    postToViewer(CMD_SET_ANNOTATIONS_STATE, {
      open: showAnnotations,
      count: currentPageConceptCount,
    });
  }, [currentPageConceptCount, postToViewer, showAnnotations]);

  const syncKeyConceptHighlights = useCallback((highlights: Array<{ id: string; title: string; rects: PdfSelectionRect[] }>) => {
    postToViewer(CMD_SET_HIGHLIGHTS, { highlights });
  }, [postToViewer]);

  const handleChapterNavigate = useCallback(() => {
    restoreGenRef.current += 1;
  }, []);

  const chapterTracker = useChapterTracker(
    sourceUrl,
    fileHash,
    viewerChannel,
    documentReady,
    handleChapterNavigate,
  );

  const goToPage = useCallback(
    (page: number) => {
      if (!page || !sourceUrl) {
        return;
      }
      restoreGenRef.current += 1;
      postToViewer(CMD_NAVIGATE, { page });
      setCurrentPage(page);
    },
    [postToViewer, sourceUrl],
  );

  const restoreViewerState = useCallback(async () => {
    if (!sourceUrl || restoreStartedRef.current) {
      return;
    }

    restoreStartedRef.current = true;

    try {
      const snapshot = devRestoreStateRef.current;
      devRestoreStateRef.current = null;
      const saved = snapshot ? toReadingState(snapshot) : await loadState();
      postToViewer(CMD_RESTORE, {
        page: saved.currentPage,
        currentScale: saved.currentZoom,
        scrollTop: saved.currentScroll,
      });
    } catch (error) {
      restoreCompletedRef.current = true;
      if (import.meta.env.DEV) {
        console.warn("[PDF.js] Failed to restore viewer state:", error);
      }
    }
  }, [loadState, postToViewer, sourceUrl]);

  const handleSessionFinished = useCallback(
    (info: { initialPage: number; finalPage: number }) => {
      onReadingInfo({
        totalWords: 0,
        initialPage: info.initialPage,
        finalPage: info.finalPage,
      });
    },
    [onReadingInfo],
  );

  useSessionTracker(
    hasSessionStarted,
    hasSessionFinished,
    currentPage,
    handleSessionFinished,
  );

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const data = parsePdfViewerMessage(event, iframeRef.current?.contentWindow);
      if (!data) {
        return;
      }

      viewerSubscribersRef.current.forEach((handler) => handler(data));

      if (data.type === EVT_TOGGLE_CHAPTERS) {
        onToggleChapters?.();
      } else if (data.type === EVT_TOGGLE_ANNOTATIONS) {
        setShowAnnotations((value) => !value);
      } else if (data.type === EVT_CREATE_CONCEPT) {
        if (data.payload.text.trim()) {
          setPendingSelection(data.payload);
          setCurrentPage(data.payload.page);
          setShowAnnotations(true);
        }
      } else if (data.type === EVT_EXPORT_PAGES) {
        void exportPages(data.pages);
      } else if (data.type === EVT_REQUEST_EXERCISE_PAGES) {
        void pickExercises();
      } else if (data.type === EVT_RESTORE_COMPLETE) {
        restoreCompletedRef.current = true;
      } else if (data.type === "lyceum-pdfjs:ready") {
        syncViewerTheme();
        syncBookEdgeStrings();
        syncPickState();
        syncChapterButtonState();
        syncAnnotationButtonState();
      } else if (data.type === EVT_DOCUMENT_READY) {
        syncViewerTheme();
        syncBookEdgeStrings();
        syncPickState();
        setDocumentReady(true);
        void restoreViewerState();
      } else if (data.type === EVT_STATE_CHANGED) {
        lastStateRef.current = data.state;
        setCurrentPage(data.state.page);
        if (data.state.totalPages > 0) onTotalBookPages(data.state.totalPages);
        if (restoreCompletedRef.current) scheduleSave(toReadingState(data.state));
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [exportPages, onToggleChapters, onTotalBookPages, pickExercises, restoreViewerState, scheduleSave, syncAnnotationButtonState, syncBookEdgeStrings, syncChapterButtonState, syncPickState, syncViewerTheme]);

  useEffect(() => {
    syncViewerTheme();
  }, [syncViewerTheme]);

  useEffect(() => {
    syncBookEdgeStrings();
  }, [syncBookEdgeStrings]);

  useEffect(() => {
    syncChapterButtonState();
  }, [syncChapterButtonState]);

  useEffect(() => {
    syncAnnotationButtonState();
  }, [syncAnnotationButtonState]);

  useEffect(() => {
    const hot = import.meta.hot;
    if (!hot) return;
    const refreshViewer = () => {
      devRestoreStateRef.current = lastStateRef.current;
      restoreStartedRef.current = false;
      restoreCompletedRef.current = false;
      setDocumentReady(false);
      setViewerRevision((revision) => revision + 1);
    };
    hot.on("lyceum:pdfjs-overlay-changed", refreshViewer);
    return () => hot.off("lyceum:pdfjs-overlay-changed", refreshViewer);
  }, []);

  useEffect(() => {
    if (!documentReady || !window.api?.getConceptGraph) return;
    let cancelled = false;
    let revision = 0;
    const refresh = async () => {
      const request = ++revision;
      try {
        const result = await window.api.getConceptGraph(fileHash);
        if (cancelled || request !== revision || !result.success || !result.payload) return;
        const landmarks: BookLandmark[] = result.payload.concepts.flatMap(concept => [
          ...(concept.highlightJson ? [{ page: concept.page, kind: "highlight" as const }] : []),
          ...(concept.note ? [{ page: concept.page, kind: "note" as const }] : []),
        ]);
        postToViewer(CMD_SET_BOOK_LANDMARKS, { landmarks });
      } catch { /* Landmarks must not prevent reading. */ }
    };
    const onUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ bookId?: string }>).detail;
      if (!detail?.bookId || detail.bookId === fileHash) void refresh();
    };
    void refresh();
    window.addEventListener("lyceum:annotations-updated", onUpdate);
    return () => { cancelled = true; window.removeEventListener("lyceum:annotations-updated", onUpdate); };
  }, [documentReady, fileHash, postToViewer]);

  useEffect(() => {
    if (!fileHash || !currentPage || !window.api?.getPageKeyConcepts) {
      setCurrentPageConceptCount(0);
      return;
    }

    let cancelled = false;
    const refreshCount = async () => {
      const result = await window.api.getPageKeyConcepts(fileHash, currentPage);
      if (!cancelled) {
        setCurrentPageConceptCount(result.success && result.payload ? result.payload.length : 0);
      }
    };

    void refreshCount();
    const handleUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ bookId?: string }>).detail;
      if (!detail?.bookId || detail.bookId === fileHash) {
        void refreshCount();
      }
    };
    window.addEventListener("lyceum:annotations-updated", handleUpdated);

    return () => {
      cancelled = true;
      window.removeEventListener("lyceum:annotations-updated", handleUpdated);
    };
  }, [currentPage, fileHash]);

  useEffect(() => {
    restoreStartedRef.current = false;
    restoreCompletedRef.current = false;
    lastStateRef.current = null;
    devRestoreStateRef.current = null;
    setDocumentReady(false);
    setCurrentPage(1);
    setCurrentPageConceptCount(0);
    setShowAnnotations(false);
    setPendingSelection(null);
    setLoadError(null);
  }, [fileHash, sourceUrl]);

  useEffect(() => {
    if (!sourceUrl) {
      return;
    }

    const saveInterval = setInterval(() => {
      const state = lastStateRef.current;
      if (state && restoreCompletedRef.current) void saveNow(toReadingState(state));
    }, SAVE_NOW_INTERVAL_MS);

    const handleBeforeUnload = () => {
      const state = lastStateRef.current;
      if (state && restoreCompletedRef.current) {
        void saveNow(toReadingState(state));
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      clearInterval(saveInterval);
      window.removeEventListener("beforeunload", handleBeforeUnload);

      const state = lastStateRef.current;
      if (state && restoreCompletedRef.current) {
        void saveNow(toReadingState(state));
      }
    };
  }, [saveNow, sourceUrl]);

  if (!viewerUrls) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-sm text-foreground-muted">
        translate("pdf:viewer.secureUrlFailed")
      </div>
    );
  }

  const viewerUrl = new URL(viewerUrls.viewerUrl);
  if (import.meta.env.DEV) viewerUrl.searchParams.set("devrev", String(viewerRevision));

  return (
    <div className="relative flex h-full w-full bg-background">
      <AnimatePresence initial={false}>
        {showChapters && (
          <motion.div
            key="pdf-chapters"
            className="h-full flex-shrink-0 overflow-hidden"
            initial={{ opacity: 0, x: -24, width: 0 }}
            animate={{ opacity: 1, x: 0, width: "auto" }}
            exit={{ opacity: 0, x: -18, width: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 36, mass: 0.8 }}
          >
            <ChapterSidebar tracker={chapterTracker} onClose={() => onCloseChapters?.()} />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative min-w-0 flex-1">
        {loadError && (
          <div className="absolute inset-x-4 top-4 z-10 rounded-sm border border-destructive/70 bg-destructive px-3 py-2 text-sm text-destructive-foreground shadow-lg">
            {loadError}
          </div>
        )}

        <iframe
          ref={iframeRef}
          key={viewerUrl.toString()}
          src={viewerUrl.toString()}
          title={
            fileName
              ? t("pdf:viewer.frameTitle", { name: fileName })
              : t("pdf:viewer.frameTitleNoName")
          }
          className="h-full w-full border-0 bg-background"
          sandbox="allow-scripts allow-same-origin allow-downloads"
          onLoad={() => {
            syncViewerTheme();
            syncBookEdgeStrings();
            syncChapterButtonState();
            syncAnnotationButtonState();
          }}
          onError={() => {
            setLoadError(translate("pdf:viewer.loadFailed"));
          }}
        />
      </div>

      <AnimatePresence initial={false}>
        {showAnnotations && (
          <motion.div
            key="pdf-annotations"
            className="h-full flex-shrink-0 overflow-hidden"
            initial={{ opacity: 0, x: 24, width: 0 }}
            animate={{ opacity: 1, x: 0, width: "auto" }}
            exit={{ opacity: 0, x: 18, width: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 36, mass: 0.8 }}
          >
            <AnnotationPanel
              bookId={fileHash}
              currentPage={currentPage}
              totalPages={lastStateRef.current?.totalPages ?? 0}
              chapters={chapterTracker.outline}
              initialSelection={pendingSelection}
              onSelectionConsumed={() => setPendingSelection(null)}
              onHighlightsChange={syncKeyConceptHighlights}
              onClose={() => setShowAnnotations(false)}
              onGoToPage={goToPage}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
