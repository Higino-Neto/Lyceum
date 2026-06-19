import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import useReadingSession from "./hooks/useReadingSession";
import ReadingSessionCompletedModal from "./components/ReadingSessionCompletedModal";
import PdfViewer from "./components/pdf-reader/Viewer";
import {
  normalizePdfRenderer,
  type PdfRenderer,
} from "./components/pdf-reader/pdfRenderer";
import EpubViewer from "./components/epub-reader/Viewer";
import { TabProvider, useTabContext } from "../../contexts/TabContext";
import TabBar from "../../components/tabs/TabBar";
import { FileType } from "../../types/DocumentTab";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { softFadeUp, springFast, subtleScale } from "../../utils/motionPresets";

export interface ReadingLaunchState {
  fileBuffer?: ArrayBuffer;
  fileHash?: string;
  fileName?: string;
  filePath?: string;
  fileType?: FileType;
  pdfRenderer?: PdfRenderer;
  source?: "library" | "local";
  libraryDocumentId?: string;
  navigationId?: string;
}

const processedNavigationIds = new Set<string>();

function isFocusModeActive(): boolean {
  try {
    return localStorage.getItem("lyceum-focus-mode") === "true";
  } catch {
    return false;
  }
}

function inferFileType(fileName?: string, fileType?: FileType): FileType {
  if (fileType) {
    return fileType;
  }

  const extension = fileName?.toLowerCase().split(".").pop();
  return extension === "epub" ? "epub" : "pdf";
}

function ReadingContent() {
  const reduceMotion = useReducedMotion();
  const session = useReadingSession();
  const { activeTab, setPdfRenderer } = useTabContext();
  const [activeType, setActiveType] = useState<"pdf" | "epub" | null>(null);
  const [isFocusMode, setIsFocusMode] = useState(false);

  useEffect(() => {
    const checkFocusMode = () => {
      const focusMode = isFocusModeActive();
      setIsFocusMode(focusMode && activeType === "epub");
    };

    checkFocusMode();
    const interval = setInterval(checkFocusMode, 500);
    return () => clearInterval(interval);
  }, [activeType]);


  useEffect(() => {
    setActiveType(activeTab?.fileType ?? null);
  }, [activeTab]);

  const renderViewer = () => {
    if (!activeTab) {
      return null;
    }

    if (activeTab.loadError) {
      return (
        <div className="flex h-full items-center justify-center px-6 text-center text-zinc-400">
          <div className="space-y-2">
            <p className="text-base text-zinc-200">Nao foi possivel reabrir esta aba.</p>
            <p className="text-sm text-zinc-500">{activeTab.loadError}</p>
          </div>
        </div>
      );
    }

    if (!activeTab.buffer || activeTab.isLoading) {
      return (
        <div className="flex h-full items-center justify-center text-zinc-500">
          Carregando {activeTab.fileType.toUpperCase()}...
        </div>
      );
    }

    if (activeTab.fileType === "epub") {
      return (
        <EpubViewer
          epubData={activeTab.buffer}
          fileHash={activeTab.fileHash}
          fileName={activeTab.fileName}
        />
      );
    }

    return (
      <PdfViewer
        pdfData={activeTab.buffer}
        fileHash={activeTab.fileHash}
        fileName={activeTab.fileName}
        renderer={normalizePdfRenderer(activeTab.pdfRenderer)}
        onRendererChange={(renderer) => setPdfRenderer(activeTab.id, renderer)}
        hasSessionStarted={session.sessionStart}
        hasSessionFinished={session.sessionFinish}
        onReadingInfo={session.handleReadingInfo}
        onTotalBookPages={() => {}}
      />
    );
  };

  const hasOpenTab = Boolean(activeTab);
  const hasLoadedContent = Boolean(activeTab?.buffer);

  return (
    <>
      {session.showModal && (
        <ReadingSessionCompletedModal
          session={session.session}
          totalBookPages={0}
          onReset={session.handleReset}
          onClose={() => session.setShowModal(false)}
          onSubmit={session.handleSubmit}
        />
      )}

      <motion.div
        className="h-full bg-zinc-950 text-zinc-100"
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: reduceMotion ? 0 : 0.16 }}
      >
        <div className="flex h-full flex-col p-2">
          <AnimatePresence initial={false}>
          {!isFocusMode && (
            <motion.header
              className="flex items-center justify-between"
              initial={reduceMotion ? false : { opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
              transition={springFast}
            >
              {/* <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 pl-6">
                  <BookOpenText size={32} className="text-zinc-300" />
                </div>
              </div> */}

              {/* <div className="flex items-center gap-2">
                {hasLoadedContent && (
                  <ReadingSessionTimer
                    fileName={activeTab?.fileName || ""}
                    onSessionStart={session.handleSessionStart}
                    onSessionData={session.handleSessionData}
                    onSessionFinish={session.handleTimerDone}
                    onTimerDone={session.handleTimerDone}
                  />
                )}
              </div> */}
            </motion.header>
          )}
          </AnimatePresence>

          {hasOpenTab ? (
            <motion.section
              className="flex-1 min-h-0 overflow-hidden rounded-sm border border-zinc-800 bg-zinc-900 shadow-xl"
              layout
              variants={reduceMotion ? undefined : subtleScale}
              initial={reduceMotion ? false : "hidden"}
              animate="visible"
              transition={reduceMotion ? { duration: 0 } : springFast}
            >
              {renderViewer()}
            </motion.section>
          ) : (
            <motion.section
              className="overflow-hidden rounded-sm border border-zinc-800 bg-zinc-900 shadow-xl"
              variants={reduceMotion ? undefined : softFadeUp}
              initial={reduceMotion ? false : "hidden"}
              animate="visible"
              transition={reduceMotion ? { duration: 0 } : springFast}
            >
              <motion.div
                className="p-4 text-sm text-zinc-500"
                initial={reduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: reduceMotion ? 0 : 0.08 }}
              >
                Abra um PDF ou EPUB para comecar a leitura.
              </motion.div>
            </motion.section>
          )}
        </div>
      </motion.div>
    </>
  );
}

interface ReadingWorkspaceProps {
  incomingTab?: ReadingLaunchState | null;
  onIncomingTabConsumed?: () => void;
  enableShortcuts?: boolean;
  className?: string;
}

export function ReadingWorkspace({
  incomingTab = null,
  onIncomingTabConsumed,
  enableShortcuts = true,
  className = "",
}: ReadingWorkspaceProps) {
  const reduceMotion = useReducedMotion();
  const {
    tabs,
    activeTabId,
    addTab,
    openReadableFile,
    removeTab,
    setActiveTab,
  } = useTabContext();

  const handleOpenFile = useCallback(async () => {
    const result = await openReadableFile();
    if (!result) {
      return;
    }

    addTab(result.fileHash, result.fileName, result.fileType, {
      source: "local",
      filePath: result.filePath,
      buffer: result.buffer,
    });
  }, [addTab, openReadableFile]);

  useEffect(() => {
    if (!incomingTab?.fileHash) {
      return;
    }

    if (incomingTab.navigationId && processedNavigationIds.has(incomingTab.navigationId)) {
      onIncomingTabConsumed?.();
      return;
    }

    if (incomingTab.navigationId) {
      processedNavigationIds.add(incomingTab.navigationId);
    }

    addTab(
      incomingTab.fileHash,
      incomingTab.fileName || "Livro sem nome",
      inferFileType(incomingTab.fileName, incomingTab.fileType),
      {
        buffer: incomingTab.fileBuffer,
        filePath: incomingTab.filePath,
        source: incomingTab.source || "local",
        libraryDocumentId: incomingTab.libraryDocumentId,
        pdfRenderer: incomingTab.pdfRenderer,
      }
    );
    onIncomingTabConsumed?.();
  }, [addTab, incomingTab, onIncomingTabConsumed]);

  const activateTabByOffset = useCallback((offset: number) => {
    if (tabs.length === 0) {
      return;
    }

    const currentIndex = Math.max(
      tabs.findIndex((tab) => tab.id === activeTabId),
      0,
    );
    const nextIndex = (currentIndex + offset + tabs.length) % tabs.length;
    setActiveTab(tabs[nextIndex].id);
  }, [activeTabId, setActiveTab, tabs]);

  const activateTabByNumber = useCallback((key: string) => {
    if (tabs.length === 0) {
      return;
    }

    const targetIndex = key === "9"
      ? tabs.length - 1
      : Number.parseInt(key, 10) - 1;
    const targetTab = tabs[targetIndex];

    if (targetTab) {
      setActiveTab(targetTab.id);
    }
  }, [setActiveTab, tabs]);

  const handleReadingShortcut = useCallback((key: string, shift = false) => {
    const normalizedKey = key.toLowerCase();

    if (normalizedKey === "w") {
      if (activeTabId) {
        removeTab(activeTabId);
      }
      return;
    }

    if (normalizedKey === "t") {
      void handleOpenFile();
      return;
    }

    if (normalizedKey === "tab") {
      activateTabByOffset(shift ? -1 : 1);
      return;
    }

    if (normalizedKey === "pageup") {
      activateTabByOffset(-1);
      return;
    }

    if (normalizedKey === "pagedown") {
      activateTabByOffset(1);
      return;
    }

    if (/^[1-9]$/.test(normalizedKey)) {
      activateTabByNumber(normalizedKey);
    }
  }, [
    activeTabId,
    activateTabByNumber,
    activateTabByOffset,
    handleOpenFile,
    removeTab,
  ]);

  useEffect(() => {
    if (!enableShortcuts) {
      return;
    }

    const handledKeys = new Set(["w", "t", "tab", "pageup", "pagedown"]);
    const unsubscribe = window.api?.onReadingShortcut?.(
      (data: { key: string; shift?: boolean }) => {
        handleReadingShortcut(data.key, data.shift);
      },
    );

    const handleKeyDown = (event: KeyboardEvent) => {
      if ((!event.ctrlKey && !event.metaKey) || event.altKey) {
        return;
      }

      const key = event.key.toLowerCase();
      const isHandledShortcut = handledKeys.has(key) || /^[1-9]$/.test(key);

      if (!isHandledShortcut) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      handleReadingShortcut(key, event.shiftKey);
    };

    window.addEventListener("keydown", handleKeyDown, true);

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      unsubscribe?.();
    };
  }, [enableShortcuts, handleReadingShortcut]);

  return (
    <motion.div
      className={["flex h-full flex-col bg-zinc-950", className].filter(Boolean).join(" ")}
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduceMotion ? 0 : 0.16 }}
    >
      <motion.div
        className="px-2 pt-2"
        initial={reduceMotion ? false : { opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springFast}
      >
        <TabBar onOpenFile={handleOpenFile} />
      </motion.div>
      <div className="flex-1 overflow-hidden">
        <ReadingContent />
      </div>
    </motion.div>
  );
}

export default function ReadingPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = useMemo(
    () => new URLSearchParams(location.search),
    [location.search]
  );
  const routeState = (location.state as ReadingLaunchState | null) ?? null;

  const mode = searchParams.get("mode");
  const detached = mode === "detached";
  const fileHash = searchParams.get("fileHash");
  const fileType = searchParams.get("fileType");
  const fileName = searchParams.get("fileName");
  const pdfRenderer = normalizePdfRenderer(searchParams.get("pdfRenderer"));

  const initialTab = useMemo(() => {
    if (!detached || !fileHash || (fileType !== "pdf" && fileType !== "epub")) {
      return null;
    }

    const detachedFileType: FileType = fileType === "epub" ? "epub" : "pdf";
    const detachedSource: "library" | "local" =
      searchParams.get("source") === "library" ? "library" : "local";

    return {
      fileHash,
      fileName: fileName || "Livro sem nome",
      fileType: detachedFileType,
      filePath: searchParams.get("filePath") || undefined,
      libraryDocumentId: searchParams.get("libraryDocumentId") || undefined,
      pdfRenderer,
      source: detachedSource,
    };
  }, [detached, fileHash, fileName, fileType, pdfRenderer, searchParams]);

  const handleRouteStateConsumed = useCallback(() => {
    navigate(`${location.pathname}${location.search}`, {
      replace: true,
      state: null,
    });
  }, [location.pathname, location.search, navigate]);

  return (
    <TabProvider scope={detached ? "detached" : "main"} initialTab={initialTab}>
      <ReadingWorkspace
        incomingTab={routeState}
        onIncomingTabConsumed={handleRouteStateConsumed}
      />
    </TabProvider>
  );
}
