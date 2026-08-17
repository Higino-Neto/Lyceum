import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  DocumentTab,
  FileType,
  PdfRenderer,
  PersistedDocumentTab,
} from "../types/DocumentTab";

const STORAGE_KEY = "document_tabs";
const DEFAULT_PDF_RENDERER: PdfRenderer = "pdfjs";

// Keep at most this many decoded book buffers alive in React state at once.
// The active tab is always kept; the remaining slots cover the most recently
// used tabs so switching between a few books stays instant while memory stays
// bounded regardless of how many tabs the user opens.
const MAX_STATE_BUFFERS = 3;
// Module-level cache of decoded buffers keyed by file hash. Unlike React state
// this survives tab switches, so re-activating a book reuses its bytes instead
// of re-reading the file from disk and re-cloning it over IPC.
const MAX_CACHED_BUFFERS = 6;

class BookBufferCache {
  private entries = new Map<string, ArrayBuffer>();

  constructor(private readonly capacity: number) {}

  get(fileHash: string): ArrayBuffer | undefined {
    const buffer = this.entries.get(fileHash);
    if (buffer === undefined) {
      return undefined;
    }

    this.entries.delete(fileHash);
    this.entries.set(fileHash, buffer);
    return buffer;
  }

  set(fileHash: string, buffer: ArrayBuffer): void {
    if (this.entries.has(fileHash)) {
      this.entries.delete(fileHash);
    }

    this.entries.set(fileHash, buffer);

    while (this.entries.size > this.capacity) {
      const oldest = this.entries.keys().next().value as string | undefined;
      if (oldest === undefined) {
        break;
      }
      this.entries.delete(oldest);
    }
  }
}

const bookBufferCache = new BookBufferCache(MAX_CACHED_BUFFERS);

function evictExcessBuffers(
  tabs: DocumentTab[],
  activeTabId: string,
  recentlyActive: string[],
): DocumentTab[] {
  const synced = syncTabState(tabs, activeTabId);
  const keep = new Set<string>([activeTabId]);

  for (const id of recentlyActive) {
    if (keep.size >= MAX_STATE_BUFFERS) {
      break;
    }
    keep.add(id);
  }

  let changed = false;
  const next = synced.map((tab) => {
    if (tab.buffer && !keep.has(tab.id)) {
      changed = true;
      return { ...tab, buffer: undefined };
    }
    return tab;
  });

  return changed ? next : synced;
}

type TabScope = "main" | "detached" | "preview";

interface OpenFileResult {
  fileHash: string;
  fileName: string;
  fileType: FileType;
  filePath?: string;
  buffer?: ArrayBuffer;
}

interface InitialTabData {
  fileHash: string;
  fileName: string;
  fileType: FileType;
  filePath?: string;
  libraryDocumentId?: string;
  pdfRenderer?: PdfRenderer;
  source?: "library" | "local";
}

interface PersistedTabsState {
  tabs: PersistedDocumentTab[];
  activeTabId: string | null;
}

interface TabContextValue {
  tabs: DocumentTab[];
  activeTabId: string | null;
  activeTab: DocumentTab | null;
  addTab: (
    fileHash: string,
    fileName: string,
    fileType: FileType,
    options?: {
      buffer?: ArrayBuffer;
      filePath?: string;
      libraryDocumentId?: string;
      pdfRenderer?: PdfRenderer;
      source?: "library" | "local";
    }
  ) => string;
  removeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  reorderTabs: (activeId: string, overId: string) => void;
  detachTab: (tabId: string) => Promise<void>;
  updateTabBuffer: (tabId: string, buffer: ArrayBuffer) => void;
  getTabById: (tabId: string) => DocumentTab | undefined;
  openPdfFile: () => Promise<OpenFileResult | undefined>;
  openEpubFile: () => Promise<OpenFileResult | undefined>;
  openReadableFile: () => Promise<OpenFileResult | undefined>;
}

interface TabProviderProps {
  children: React.ReactNode;
  scope?: TabScope;
  initialTab?: InitialTabData | null;
}

const TabContext = createContext<TabContextValue | null>(null);

export function useTabContext() {
  const context = useContext(TabContext);
  if (!context) {
    throw new Error("useTabContext must be used within TabProvider");
  }
  return context;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

function createTab(
  data: InitialTabData,
  options?: {
    id?: string;
    buffer?: ArrayBuffer;
    isActive?: boolean;
    position?: number;
    isLoading?: boolean;
    loadError?: string;
  }
): DocumentTab {
  return {
    id: options?.id ?? generateId(),
    fileHash: data.fileHash,
    fileName: data.fileName,
    fileType: data.fileType,
    filePath: data.filePath,
    libraryDocumentId: data.libraryDocumentId,
    pdfRenderer:
      data.fileType === "pdf"
        ? normalizePdfRenderer(data.pdfRenderer)
        : undefined,
    buffer: options?.buffer,
    position: options?.position ?? 0,
    isActive: options?.isActive ?? false,
    source: data.source ?? "local",
    isLoading: options?.isLoading ?? false,
    loadError: options?.loadError,
  };
}

function syncTabState(tabs: DocumentTab[], activeTabId: string | null): DocumentTab[] {
  return tabs.map((tab, index) => ({
    ...tab,
    position: index,
    isActive: activeTabId !== null && tab.id === activeTabId,
  }));
}

function inferTabFileType(
  filePath?: string,
  fileName?: string,
  fallback: FileType = "pdf"
): FileType {
  const value = (filePath || fileName || "").toLowerCase();
  if (value.endsWith(".epub")) {
    return "epub";
  }

  if (value.endsWith(".pdf")) {
    return "pdf";
  }

  return fallback;
}

function normalizePdfRenderer(value: unknown): PdfRenderer {
  return value === "pdfjs" ? "pdfjs" : DEFAULT_PDF_RENDERER;
}

function normalizePersistedTab(rawTab: unknown, index: number): PersistedDocumentTab | null {
  if (!rawTab || typeof rawTab !== "object") {
    return null;
  }

  const tab = rawTab as Partial<DocumentTab>;
  if (
    typeof tab.id !== "string" ||
    typeof tab.fileHash !== "string" ||
    typeof tab.fileName !== "string" ||
    (tab.fileType !== "pdf" && tab.fileType !== "epub")
  ) {
    return null;
  }

  return {
    id: tab.id,
    fileHash: tab.fileHash,
    fileName: tab.fileName,
    fileType: tab.fileType,
    filePath: typeof tab.filePath === "string" ? tab.filePath : undefined,
    libraryDocumentId:
      typeof tab.libraryDocumentId === "string" ? tab.libraryDocumentId : undefined,
    pdfRenderer:
      tab.fileType === "pdf" ? normalizePdfRenderer(tab.pdfRenderer) : undefined,
    position: typeof tab.position === "number" ? tab.position : index,
    source: tab.source === "library" ? "library" : "local",
  };
}

function loadTabsFromStorage(): PersistedTabsState {
  try {
    const stored = localStorage.getItem(`lyceum_${STORAGE_KEY}`);
    if (!stored) {
      return { tabs: [], activeTabId: null };
    }

    const parsed = JSON.parse(stored) as
      | PersistedTabsState
      | DocumentTab[]
      | null;

    const rawTabs = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.tabs)
        ? parsed.tabs
        : [];

    const tabs = rawTabs
      .map((tab, index) => normalizePersistedTab(tab, index))
      .filter((tab): tab is PersistedDocumentTab => tab !== null)
      .sort((left, right) => left.position - right.position);

    const rawActiveTabId =
      !Array.isArray(parsed) && parsed?.activeTabId && typeof parsed.activeTabId === "string"
        ? parsed.activeTabId
        : tabs.find((tab) => (tab as Partial<DocumentTab>).isActive)?.id ?? tabs[0]?.id ?? null;

    const activeTabId = tabs.some((tab) => tab.id === rawActiveTabId)
      ? rawActiveTabId
      : tabs[0]?.id ?? null;

    return { tabs, activeTabId };
  } catch (error) {
    console.warn("Failed to load tabs from storage:", error);
    return { tabs: [], activeTabId: null };
  }
}

function saveTabsToStorage(tabs: DocumentTab[], activeTabId: string | null): void {
  try {
    const persistedTabs: PersistedDocumentTab[] = tabs.map((tab, index) => ({
      id: tab.id,
      fileHash: tab.fileHash,
      fileName: tab.fileName,
      fileType: tab.fileType,
      filePath: tab.filePath,
      libraryDocumentId: tab.libraryDocumentId,
      pdfRenderer:
        tab.fileType === "pdf" ? normalizePdfRenderer(tab.pdfRenderer) : undefined,
      position: index,
      source: tab.source,
    }));

    const state: PersistedTabsState = {
      tabs: persistedTabs,
      activeTabId:
        activeTabId && persistedTabs.some((tab) => tab.id === activeTabId)
          ? activeTabId
          : persistedTabs[0]?.id ?? null,
    };

    localStorage.setItem(`lyceum_${STORAGE_KEY}`, JSON.stringify(state));
  } catch (error) {
    console.warn("Failed to save tabs to storage:", error);
  }
}

function createInitialState(scope: TabScope, initialTab?: InitialTabData | null) {
  if (scope !== "main") {
    if (!initialTab) {
      return {
        tabs: [] as DocumentTab[],
        activeTabId: null as string | null,
      };
    }

    const detachedTab = createTab(initialTab, {
      isActive: true,
      isLoading: true,
    });

    return {
      tabs: [detachedTab],
      activeTabId: detachedTab.id,
    };
  }

  const stored = loadTabsFromStorage();
  const tabs = syncTabState(
    stored.tabs.map((tab) =>
      createTab(tab, {
        id: tab.id,
        position: tab.position,
      })
    ),
    stored.activeTabId
  );

  return {
    tabs,
    activeTabId: stored.activeTabId,
  };
}

export function TabProvider({
  children,
  scope = "main",
  initialTab = null,
}: TabProviderProps) {
  const initialState = useMemo(() => createInitialState(scope, initialTab), [scope, initialTab]);
  const [tabs, setTabs] = useState<DocumentTab[]>(initialState.tabs);
  const [activeTabId, setActiveTabId] = useState<string | null>(initialState.activeTabId);
  const tabsRef = useRef<DocumentTab[]>(initialState.tabs);
  const activeTabIdRef = useRef<string | null>(initialState.activeTabId);
  const pendingLoadsRef = useRef<Set<string>>(new Set());
  const recentlyActiveRef = useRef<string[]>(
    initialState.activeTabId ? [initialState.activeTabId] : [],
  );

  useEffect(() => {
    tabsRef.current = tabs;
  }, [tabs]);

  useEffect(() => {
    activeTabIdRef.current = activeTabId;
  }, [activeTabId]);

  useEffect(() => {
    if (scope === "main") {
      saveTabsToStorage(tabs, activeTabId);
    }
  }, [activeTabId, scope, tabs]);

  useEffect(() => {
    return () => {
      if (scope === "main") {
        saveTabsToStorage(tabsRef.current, activeTabIdRef.current);
      }
    };
  }, [scope]);

  useEffect(() => {
    if (tabs.length === 0) {
      if (activeTabId !== null) {
        setActiveTabId(null);
      }
      return;
    }

    if (activeTabId && tabs.some((tab) => tab.id === activeTabId)) {
      return;
    }

    const fallbackTabId = tabs[tabs.length - 1]?.id ?? null;
    setActiveTabId(fallbackTabId);
    setTabs((previousTabs) => syncTabState(previousTabs, fallbackTabId));
  }, [activeTabId, tabs]);

  const activeTab = useMemo(() => {
    return tabs.find((tab) => tab.id === activeTabId) ?? null;
  }, [activeTabId, tabs]);

  const openPdfFile = useCallback(async () => {
    try {
      const document = await window.api.openPdf();
      if (!document) {
        return undefined;
      }

      return {
        fileHash: document.fileHash,
        fileName: document.title,
        fileType: "pdf" as const,
        filePath: document.filePath,
        buffer: document.fileBuffer,
      };
    } catch (error) {
      console.error("Error opening PDF:", error);
      return undefined;
    }
  }, []);

  const openEpubFile = useCallback(async () => {
    try {
      const document = await window.api.openEpub();
      if (!document) {
        return undefined;
      }

      return {
        fileHash: document.fileHash,
        fileName: document.title,
        fileType: "epub" as const,
        filePath: document.filePath,
        buffer: document.fileBuffer,
      };
    } catch (error) {
      console.error("Error opening EPUB:", error);
      return undefined;
    }
  }, []);

  const openReadableFile = useCallback(async () => {
    try {
      const document = await window.api.openReadableFile();
      if (!document) {
        return undefined;
      }

      const fileType: FileType = document.fileType === "epub" ? "epub" : "pdf";

      return {
        fileHash: document.fileHash,
        fileName: document.title,
        fileType,
        filePath: document.filePath,
        buffer: document.fileBuffer,
      };
    } catch (error) {
      console.error("Error opening readable file:", error);
      return undefined;
    }
  }, []);

  const addTab = useCallback(
    (
      fileHash: string,
      fileName: string,
      fileType: FileType,
      options?: {
        buffer?: ArrayBuffer;
        filePath?: string;
        libraryDocumentId?: string;
        pdfRenderer?: PdfRenderer;
        source?: "library" | "local";
      }
    ) => {
      const existingTab = tabsRef.current.find(
        (tab) => tab.fileHash === fileHash && tab.fileType === fileType
      );

      if (existingTab) {
        setActiveTabId(existingTab.id);
        recentlyActiveRef.current = [
          existingTab.id,
          ...recentlyActiveRef.current.filter((id) => id !== existingTab.id),
        ];
        setTabs((previousTabs) =>
          evictExcessBuffers(
            previousTabs.map((tab) =>
              tab.id === existingTab.id
                ? {
                    ...tab,
                    fileName,
                    filePath: options?.filePath ?? tab.filePath,
                    libraryDocumentId: options?.libraryDocumentId ?? tab.libraryDocumentId,
                    pdfRenderer:
                      fileType === "pdf"
                        ? normalizePdfRenderer(options?.pdfRenderer ?? tab.pdfRenderer)
                        : undefined,
                    source: options?.source ?? tab.source,
                    buffer: options?.buffer ?? tab.buffer,
                    isLoading: false,
                    loadError: undefined,
                  }
                : tab
            ),
            existingTab.id,
            recentlyActiveRef.current,
          )
        );
        return existingTab.id;
      }

      const newTab = createTab(
        {
          fileHash,
          fileName,
          fileType,
          filePath: options?.filePath,
          libraryDocumentId: options?.libraryDocumentId,
          pdfRenderer:
            fileType === "pdf" ? normalizePdfRenderer(options?.pdfRenderer) : undefined,
          source: options?.source,
        },
        {
          buffer: options?.buffer,
          isActive: true,
          isLoading: !options?.buffer,
        }
      );

      setActiveTabId(newTab.id);
      recentlyActiveRef.current = [
        newTab.id,
        ...recentlyActiveRef.current.filter((id) => id !== newTab.id),
      ];
      setTabs((previousTabs) =>
        evictExcessBuffers([...previousTabs, newTab], newTab.id, recentlyActiveRef.current),
      );

      return newTab.id;
    },
    []
  );

  const removeTab = useCallback((tabId: string) => {
    pendingLoadsRef.current.delete(tabId);

    const currentTabs = tabsRef.current;
    const nextTabs = currentTabs.filter((tab) => tab.id !== tabId);
    const nextActiveTabId =
      activeTabIdRef.current === tabId
        ? nextTabs[nextTabs.length - 1]?.id ?? null
        : activeTabIdRef.current;

    setActiveTabId(nextActiveTabId);
    setTabs(syncTabState(nextTabs, nextActiveTabId));
  }, []);

  const setActiveTab = useCallback((tabId: string) => {
    recentlyActiveRef.current = [
      tabId,
      ...recentlyActiveRef.current.filter((id) => id !== tabId),
    ];
    setActiveTabId(tabId);
    setTabs((previousTabs) => evictExcessBuffers(previousTabs, tabId, recentlyActiveRef.current));
  }, []);

  const reorderTabs = useCallback((activeId: string, overId: string) => {
    setTabs((previousTabs) => {
      const oldIndex = previousTabs.findIndex((tab) => tab.id === activeId);
      const newIndex = previousTabs.findIndex((tab) => tab.id === overId);

      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
        return previousTabs;
      }

      const reorderedTabs = [...previousTabs];
      const [removedTab] = reorderedTabs.splice(oldIndex, 1);
      reorderedTabs.splice(newIndex, 0, removedTab);

      return syncTabState(reorderedTabs, activeTabIdRef.current);
    });
  }, []);

  const detachTab = useCallback(async (tabId: string) => {
    const tab = tabsRef.current.find((candidate) => candidate.id === tabId);
    if (!tab || !window.api?.openInNewWindow) {
      return;
    }

    await window.api.openInNewWindow({
      fileHash: tab.fileHash,
      fileName: tab.fileName,
      fileType: tab.fileType,
      filePath: tab.filePath,
      libraryDocumentId: tab.libraryDocumentId,
      pdfRenderer: tab.pdfRenderer,
      source: tab.source,
    });

    removeTab(tabId);
  }, [removeTab]);

  const updateTabBuffer = useCallback((tabId: string, buffer: ArrayBuffer) => {
    setTabs((previousTabs) =>
      previousTabs.map((tab) =>
        tab.id === tabId
          ? {
              ...tab,
              buffer,
              isLoading: false,
              loadError: undefined,
            }
          : tab
      )
    );
  }, []);

  const getTabById = useCallback(
    (tabId: string) => tabsRef.current.find((tab) => tab.id === tabId),
    []
  );

  const hydrateTab = useCallback(async (tab: DocumentTab) => {
    if (!tab.fileHash) {
      return;
    }

    const cachedBuffer = bookBufferCache.get(tab.fileHash);
    if (cachedBuffer) {
      setTabs((previousTabs) =>
        previousTabs.map((candidate) =>
          candidate.id === tab.id
            ? {
                ...candidate,
                buffer: cachedBuffer,
                isLoading: false,
                loadError: undefined,
              }
            : candidate
        )
      );
      pendingLoadsRef.current.delete(tab.id);
      return;
    }

    setTabs((previousTabs) =>
      previousTabs.map((candidate) =>
        candidate.id === tab.id
          ? {
              ...candidate,
              isLoading: true,
              loadError: undefined,
            }
          : candidate
      )
    );

    try {
      const reopened = await window.api.openDocumentByHash(tab.fileHash);
      if (!reopened || "error" in reopened || !reopened.fileBuffer) {
        throw new Error("Nao foi possivel reabrir o documento");
      }

      bookBufferCache.set(tab.fileHash, reopened.fileBuffer);

      setTabs((previousTabs) =>
        previousTabs.map((candidate) =>
          candidate.id === tab.id
            ? {
                ...candidate,
                buffer: reopened.fileBuffer,
                fileName: reopened.fileName || candidate.fileName,
                fileType: inferTabFileType(
                  reopened.foundAt || reopened.filePath || candidate.filePath,
                  reopened.fileName || candidate.fileName,
                  candidate.fileType,
                ),
                filePath: reopened.foundAt || reopened.filePath || candidate.filePath,
                isLoading: false,
                loadError: undefined,
              }
            : candidate
        )
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Nao foi possivel carregar este arquivo";

      setTabs((previousTabs) =>
        previousTabs.map((candidate) =>
          candidate.id === tab.id
            ? {
                ...candidate,
                isLoading: false,
                loadError: message,
              }
            : candidate
        )
      );
    } finally {
      pendingLoadsRef.current.delete(tab.id);
    }
  }, []);

  useEffect(() => {
    const activeTab = tabs.find((tab) => tab.id === activeTabId);
    if (!activeTab || activeTab.buffer || activeTab.loadError) {
      return;
    }

    if (pendingLoadsRef.current.has(activeTab.id)) {
      return;
    }

    pendingLoadsRef.current.add(activeTab.id);
    void hydrateTab(activeTab);
  }, [hydrateTab, tabs, activeTabId]);

  const value: TabContextValue = {
    tabs,
    activeTabId,
    activeTab,
    addTab,
    removeTab,
    setActiveTab,
    reorderTabs,
    detachTab,
    updateTabBuffer,
    getTabById,
    openPdfFile,
    openEpubFile,
    openReadableFile,
  };

  return <TabContext.Provider value={value}>{children}</TabContext.Provider>;
}
