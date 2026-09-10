import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SessionPdfData } from "../../../../types/ReadingTypes";
import useReadingStatePersistence from "../../hooks/useReadingStatePersistence";
import useSessionTracker from "../../hooks/useSessionTracker";
import { createPdfJsViewerUrl } from "./pdfRenderer";
import { useChapterTracker } from "./chapters/useChapterTracker";
import ChapterSidebar from "./chapters/ChapterSidebar";
import { AnimatePresence, motion } from "motion/react";
import { BookMarked } from "lucide-react";
import AnnotationPanel from "./annotations/AnnotationPanel";

interface PdfJsViewerProps {
  pdfData: ArrayBuffer;
  fileHash: string;
  fileName?: string;
  hasSessionStarted: boolean;
  hasSessionFinished: boolean;
  onTotalBookPages: (totalBookPages: number) => void;
  onReadingInfo: (data: SessionPdfData) => void;
  showChapters?: boolean;
  onToggleChapters?: () => void;
  onCloseChapters?: () => void;
}

interface NativePdfViewerState {
  page: number;
  currentScale: number;
  scrollTop: number;
  totalPages: number;
  canAccess: boolean;
}

const POLL_INTERVAL_MS = 1200;
const SAVE_NOW_INTERVAL_MS = 15000;

function toReadingState(state: NativePdfViewerState) {
  return {
    currentPage: state.page,
    currentZoom: state.currentScale,
    currentScroll: state.scrollTop,
  };
}

export default function PdfJsViewer({
  fileHash,
  fileName,
  hasSessionStarted,
  hasSessionFinished,
  onTotalBookPages,
  onReadingInfo,
  showChapters = false,
  onToggleChapters,
  onCloseChapters,
}: PdfJsViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const lastStateRef = useRef<NativePdfViewerState | null>(null);
  const restoreStartedRef = useRef(false);
  const restoreGenRef = useRef(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [currentPageConceptCount, setCurrentPageConceptCount] = useState(0);
  const [showAnnotations, setShowAnnotations] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { loadState, saveNow, scheduleSave } = useReadingStatePersistence(fileHash);

  const viewerUrls = useMemo(
    () => createPdfJsViewerUrl({ fileHash, fileName }),
    [fileHash, fileName],
  );

  const sourceUrl = viewerUrls?.sourceUrl ?? "";
  const viewerOrigin = useMemo(() => {
    if (!viewerUrls?.viewerUrl) {
      return null;
    }

    try {
      const origin = new URL(viewerUrls.viewerUrl).origin;
      return origin === "null" ? null : origin;
    } catch {
      return null;
    }
  }, [viewerUrls?.viewerUrl]);

  const syncChapterButtonState = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage(
      {
        type: "lyceum-pdfjs:chapters-state",
        open: showChapters,
      },
      viewerOrigin ?? "*",
    );
  }, [showChapters, viewerOrigin]);

  const handleChapterNavigate = useCallback(() => {
    restoreGenRef.current += 1;
  }, []);

  const chapterTracker = useChapterTracker(sourceUrl, fileHash, handleChapterNavigate);

  const goToPage = useCallback(
    async (page: number) => {
      if (!page || !sourceUrl || !window.api?.applyNativePdfViewerState) {
        return;
      }
      restoreGenRef.current += 1;
      await window.api.applyNativePdfViewerState(sourceUrl, { page });
      setCurrentPage(page);
    },
    [sourceUrl],
  );

  const readViewerState = useCallback(async () => {
    if (!sourceUrl || !window.api?.getNativePdfViewerState) {
      return null;
    }

    const state = await window.api.getNativePdfViewerState(sourceUrl);
    if (!state?.canAccess) {
      return null;
    }

    lastStateRef.current = state;
    setCurrentPage(state.page);

    if (state.totalPages > 0) {
      onTotalBookPages(state.totalPages);
    }

    return state as NativePdfViewerState;
  }, [onTotalBookPages, sourceUrl]);

  const restoreViewerState = useCallback(async () => {
    if (
      !sourceUrl ||
      restoreStartedRef.current ||
      !window.api?.applyNativePdfViewerState
    ) {
      return;
    }

    restoreStartedRef.current = true;
    const gen = restoreGenRef.current;

    try {
      const saved = await loadState();
      if (gen !== restoreGenRef.current) {
        return;
      }
      await window.api.applyNativePdfViewerState(sourceUrl, {
        page: saved.currentPage,
        currentScale: saved.currentZoom,
        scrollTop: saved.currentScroll,
        restore: true,
      });
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn("[PDF.js] Failed to restore viewer state:", error);
      }
    }
  }, [loadState, sourceUrl]);

  const saveViewerState = useCallback(
    async (mode: "now" | "schedule") => {
      const state = await readViewerState();
      if (!state) {
        return;
      }

      const readingState = toReadingState(state);
      if (mode === "now") {
        await saveNow(readingState);
      } else {
        scheduleSave(readingState);
      }
    },
    [readViewerState, saveNow, scheduleSave],
  );

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
      if (event.source !== iframeRef.current?.contentWindow) {
        return;
      }

      const data = event.data;
      if (!data || typeof data !== "object") {
        return;
      }

      if (data.type === "lyceum-pdfjs:toggle-chapters") {
        onToggleChapters?.();
      } else if (data.type === "lyceum-pdfjs:ready") {
        syncChapterButtonState();
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onToggleChapters, syncChapterButtonState]);

  useEffect(() => {
    syncChapterButtonState();
  }, [syncChapterButtonState]);

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
    lastStateRef.current = null;
    setCurrentPage(1);
    setCurrentPageConceptCount(0);
    setShowAnnotations(false);
    setLoadError(null);
  }, [fileHash, sourceUrl]);

  useEffect(() => {
    if (!sourceUrl) {
      return;
    }

    const pollInterval = setInterval(() => {
      void saveViewerState("schedule");
    }, POLL_INTERVAL_MS);

    const saveInterval = setInterval(() => {
      void saveViewerState("now");
    }, SAVE_NOW_INTERVAL_MS);

    const handleBeforeUnload = () => {
      const state = lastStateRef.current;
      if (state) {
        void saveNow(toReadingState(state));
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      clearInterval(pollInterval);
      clearInterval(saveInterval);
      window.removeEventListener("beforeunload", handleBeforeUnload);

      const state = lastStateRef.current;
      if (state) {
        void saveNow(toReadingState(state));
      }
    };
  }, [saveNow, saveViewerState, sourceUrl]);

  if (!viewerUrls) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-sm text-zinc-400">
        Nao foi possivel criar uma URL segura para o PDF.js.
      </div>
    );
  }
  
  return (
    <div className="relative flex h-full w-full bg-zinc-950">
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
        <button
          type="button"
          onClick={() => setShowAnnotations((value) => !value)}
          className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-sm border border-zinc-800 bg-zinc-950/85 text-zinc-300 shadow-lg backdrop-blur transition hover:border-zinc-700 hover:bg-zinc-900 hover:text-zinc-100"
          title="Key concepts"
          aria-label="Key concepts"
        >
          <BookMarked size={17} />
          {currentPageConceptCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-semibold text-zinc-950">
              {Math.min(9, currentPageConceptCount)}
            </span>
          )}
        </button>
        {loadError && (
          <div className="absolute inset-x-4 top-4 z-10 rounded-sm border border-red-900/70 bg-red-950/90 px-3 py-2 text-sm text-red-100 shadow-lg">
            {loadError}
          </div>
        )}

        <iframe
          ref={iframeRef}
          key={viewerUrls.viewerUrl}
          src={viewerUrls.viewerUrl}
          title={fileName ? `${fileName} - PDF.js` : "Mozilla PDF.js Viewer"}
          className="h-full w-full border-0 bg-zinc-950"
          sandbox="allow-scripts allow-same-origin allow-downloads"
          onLoad={() => {
            void restoreViewerState();
            void saveViewerState("schedule");
            syncChapterButtonState();
          }}
          onError={() => {
            setLoadError("O Mozilla PDF.js Viewer nao conseguiu carregar.");
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
              onClose={() => setShowAnnotations(false)}
              onGoToPage={goToPage}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
