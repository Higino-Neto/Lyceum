import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import useReadingSession from "./hooks/useReadingSession";
import ReadingSessionCompletedModal from "./components/ReadingSessionCompletedModal";
import PdfViewer from "./components/pdf-reader/Viewer";
import EpubViewer from "./components/epub-reader/Viewer";
import { TabProvider, useTabContext } from "../../contexts/TabContext";
import TabBar from "../../components/tabs/TabBar";
import { FileType } from "../../types/DocumentTab";

interface ReadingRouteState {
  fileBuffer?: ArrayBuffer;
  fileHash?: string;
  fileName?: string;
  filePath?: string;
  fileType?: FileType;
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
  const location = useLocation();
  const navigate = useNavigate();
  const routeState = (location.state as ReadingRouteState | null) ?? null;
  const session = useReadingSession();
  const { activeTab, addTab } = useTabContext();
  const [activeType, setActiveType] = useState<"pdf" | "epub" | null>(null);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const navigationId = routeState?.navigationId;

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
    if (!routeState?.fileHash) {
      return;
    }

    if (navigationId && processedNavigationIds.has(navigationId)) {
      navigate(`${location.pathname}${location.search}`, {
        replace: true,
        state: null,
      });
      return;
    }

    if (navigationId) {
      processedNavigationIds.add(navigationId);
    }

    addTab(
      routeState.fileHash,
      routeState.fileName || "Livro sem nome",
      inferFileType(routeState.fileName, routeState.fileType),
      {
        buffer: routeState.fileBuffer,
        filePath: routeState.filePath,
        source: routeState.source || "local",
        libraryDocumentId: routeState.libraryDocumentId,
      }
    );

    navigate(`${location.pathname}${location.search}`, {
      replace: true,
      state: null,
    });
  }, [addTab, location.pathname, location.search, navigate, navigationId, routeState]);

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

      <div className="h-full bg-zinc-950 text-zinc-100">
        <div className="flex h-full flex-col p-2">
          {!isFocusMode && (
            <header className="flex items-center justify-between">
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
            </header>
          )}

          {hasOpenTab ? (
            <section className="flex-1 min-h-0 overflow-hidden rounded-sm border border-zinc-800 bg-zinc-900 shadow-xl">
              {renderViewer()}
            </section>
          ) : (
            <section className="overflow-hidden rounded-sm border border-zinc-800 bg-zinc-900 shadow-xl">
              <div className="p-4 text-sm text-zinc-500">
                Abra um PDF ou EPUB para comecar a leitura.
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}

function TabBarWithContent() {
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
  }, [handleReadingShortcut]);

  return (
    <div className="flex h-full flex-col bg-zinc-950">
      <div className="px-2 pt-2">
        <TabBar onOpenFile={handleOpenFile} />
      </div>
      <div className="flex-1 overflow-hidden">
        <ReadingContent />
      </div>
    </div>
  );
}

export default function ReadingPage() {
  const location = useLocation();
  const searchParams = useMemo(
    () => new URLSearchParams(location.search),
    [location.search]
  );

  const mode = searchParams.get("mode");
  const detached = mode === "detached";
  const fileHash = searchParams.get("fileHash");
  const fileType = searchParams.get("fileType");
  const fileName = searchParams.get("fileName");

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
      source: detachedSource,
    };
  }, [detached, fileHash, fileName, fileType, searchParams]);

  return (
    <TabProvider scope={detached ? "detached" : "main"} initialTab={initialTab}>
      <TabBarWithContent />
    </TabProvider>
  );
}
