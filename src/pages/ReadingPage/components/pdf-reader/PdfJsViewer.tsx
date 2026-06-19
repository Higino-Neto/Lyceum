import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SessionPdfData } from "../../../../types/ReadingTypes";
import useReadingStatePersistence from "../../hooks/useReadingStatePersistence";
import useSessionTracker from "../../hooks/useSessionTracker";
import { createPdfJsViewerUrl } from "./pdfRenderer";

interface PdfJsViewerProps {
  pdfData: ArrayBuffer;
  fileHash: string;
  fileName?: string;
  hasSessionStarted: boolean;
  hasSessionFinished: boolean;
  onTotalBookPages: (totalBookPages: number) => void;
  onReadingInfo: (data: SessionPdfData) => void;
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
}: PdfJsViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const lastStateRef = useRef<NativePdfViewerState | null>(null);
  const restoreStartedRef = useRef(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { loadState, saveNow, scheduleSave } = useReadingStatePersistence(fileHash);

  const viewerUrls = useMemo(
    () => createPdfJsViewerUrl({ fileHash, fileName }),
    [fileHash, fileName],
  );

  const sourceUrl = viewerUrls?.sourceUrl ?? "";

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

    try {
      const saved = await loadState();
      await window.api.applyNativePdfViewerState(sourceUrl, {
        page: saved.currentPage,
        currentScale: saved.currentZoom,
        scrollTop: saved.currentScroll,
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
    restoreStartedRef.current = false;
    lastStateRef.current = null;
    setCurrentPage(1);
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
    <div className="relative h-full w-full bg-zinc-950">
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
        }}
        onError={() => {
          setLoadError("O Mozilla PDF.js Viewer nao conseguiu carregar.");
        }}
      />
    </div>
  );
}
