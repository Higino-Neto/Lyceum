import { useNavigate } from "react-router-dom";
import {
  useState,
  useEffect,
  useCallback,
  useDeferredValue,
  useMemo,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  BookOpen,
  CheckSquare,
  Copy,
  FolderOpen,
  GitMerge,
  LayoutGrid,
  Layers,
  List,
  Move,
  PanelLeft,
  PanelLeftClose,
  RefreshCw,
  Send,
  Trash2,
  Usb,
  X,
} from "lucide-react";
import {
  BookDetailPanel,
  FileTypeFilter,
  FilterBar,
  FolderGrid,
  FolderPathBar,
  FolderTree,
  LibraryReadingPreviewPane,
  SectionTabs,
  SortOption,
} from "./components";
import BookGrid, { type GridDensity } from "./components/BookGrid";
import KindleSendPanel from "./components/KindleSendPanel";
import useBooks from "./useBooks";
import ImportBookDialog from "../../components/ImportBookDialog";
import { BookWithThumbnail, FolderInfo, LibrarySection } from "../../types/LibraryTypes";
import toast from "react-hot-toast";
import { DocumentRecord } from "../../types/ReadingTypes";
import {
  getBookFolderLabel,
  getFileTypeLabel,
  getFolderChildren,
  classifyFolder,
  classifyFolders,
  calculateSimilarity,
  normalizeFolderPath,
  getTitleWithoutExtension,
} from "./utils";
import { useConversionQueue } from "../../contexts/ConversionQueueContext";
import { useAppSettings } from "../../contexts/AppSettingsContext";
import { LibraryProvider, useLibraryContext } from "../../contexts/LibraryContext";
import { useFolderDragDrop } from "../../hooks/useFolderDragDrop";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import useMediaQuery from "../../hooks/useMediaQuery";
import type { ReadingLaunchState } from "../ReadingPage/ReadingPage";

interface UsbLibraryApi {
  onUsbDevicesUpdated?: (callback: () => void) => () => void;
  openUsbBook: (filePath: string) => Promise<OpenBookResult>;
  scanUsbBooks?: () => Promise<unknown>;
}

interface OpenBookResult {
  success?: boolean;
  error?: string;
  message?: string;
  foundAt?: string;
  fileBuffer?: ArrayBuffer;
  fileHash?: string;
  fileName?: string;
  filePath?: string;
  fileType?: string;
}

function isAbsoluteFolderPath(folderPath: string | null): boolean {
  return Boolean(folderPath && (/^[a-zA-Z]:[\\/]/.test(folderPath) || folderPath.startsWith("/") || folderPath.startsWith("\\\\")));
}

function getPathLeaf(folderPath?: string | null): string {
  return (folderPath || "").split(/[\\/]+/).filter(Boolean).at(-1) || "";
}

function normalizeAbsoluteFolderPath(folderPath?: string | null): string {
  return (folderPath || "")
    .replace(/\\/g, "/")
    .replace(/\/+$/g, "")
    .toLowerCase();
}

function stripSpecialFolderPrefix(name: string): string {
  return name.replace(/^_+/, "") || name;
}

function getSyntheticFolderId(folderPath: string): number {
  let hash = 0;
  for (let index = 0; index < folderPath.length; index++) {
    hash = ((hash << 5) - hash + folderPath.charCodeAt(index)) | 0;
  }
  return -Math.max(1, Math.abs(hash));
}

function isDocumentDirectlyInFolder(
  book: BookWithThumbnail,
  folder: FolderInfo,
): boolean {
  return (
    normalizeAbsoluteFolderPath(book.folderPath) ===
    normalizeAbsoluteFolderPath(folder.fullPath)
  );
}

function pickRepresentativeBook(books: BookWithThumbnail[]) {
  return (
    books.find((book) => book.thumbnailPath && (book.fileType === "epub" || book.fileType === "pdf")) ||
    books.find((book) => book.fileType === "epub" || book.fileType === "pdf") ||
    books.find((book) => book.thumbnailPath || book.thumbnail) ||
    books.find((book) => book.fileType === "epub") ||
    books[0]
  );
}

function buildSpecialFolderBook(
  folder: FolderInfo,
  documents: BookWithThumbnail[],
  folderType: "merged" | "collection",
): BookWithThumbnail | null {
  const directDocuments = documents.filter((document) =>
    isDocumentDirectlyInFolder(document, folder),
  );
  const variants = directDocuments.length > 0 ? directDocuments : documents;
  const representative = pickRepresentativeBook(variants);
  const folderPath = folder.fullPath || folder.path;
  const title = stripSpecialFolderPrefix(folder.name) || representative?.title || folder.name;
  const syntheticFileHash = `${folderType}-folder:${normalizeAbsoluteFolderPath(folderPath)}`;

  return {
    ...(representative || {
      filePath: folderPath,
      currentPage: 0,
      currentZoom: null,
      currentScroll: null,
      annotations: null,
      thumbnailPath: null,
      numPages: 0,
      createdAt: new Date(0).toISOString(),
      lastOpenedAt: new Date(0).toISOString(),
      isSynced: 1,
      category: null,
      isFavorite: 0,
      rating: 0,
      notes: null,
      author: null,
      description: null,
      isbn: null,
      publisher: null,
      publishDate: null,
      fileSize: 0,
      processingStatus: "completed" as const,
      fileType: "lyceum" as const,
    }),
    id: getSyntheticFolderId(folderPath),
    title,
    fileHash: syntheticFileHash,
    folderPath,
    mergedBooks: variants,
    syntheticFolderPath: folder.path,
    syntheticFolderType: folderType,
  };
}

function collectSpecialFoldersForDisplay(
  folders: FolderInfo[],
  includeNested: boolean,
): Array<{ folder: FolderInfo; type: "merged" | "collection" }> {
  const result: Array<{ folder: FolderInfo; type: "merged" | "collection" }> = [];

  const visit = (items: FolderInfo[]) => {
    for (const folder of items) {
      const folderType = classifyFolder(folder.name);
      if (folderType === "merged" || folderType === "collection") {
        result.push({ folder, type: folderType });
      }

      if (includeNested && folder.subfolders.length > 0) {
        visit(folder.subfolders);
      }
    }
  };

  visit(folders);
  return result;
}

function getBookSortTitle(book: BookWithThumbnail): string {
  return getTitleWithoutExtension(book.title || book.fileName || book.filePath || "", book.fileType)
    .toLocaleLowerCase("pt-BR");
}

function getBookSortDate(book: BookWithThumbnail): number {
  const value = book.lastOpenedAt || book.updatedAt || book.importedAt || book.createdAt;
  const time = value ? new Date(value).getTime() : 0;
  return Number.isNaN(time) ? 0 : time;
}

function sortBooksForLibraryView(
  books: BookWithThumbnail[],
  sortOption: SortOption,
): BookWithThumbnail[] {
  const indexed = books.map((book, index) => ({ book, index }));
  indexed.sort((left, right) => {
    const titleCompare = getBookSortTitle(left.book).localeCompare(
      getBookSortTitle(right.book),
      "pt-BR",
      { sensitivity: "base", numeric: true },
    );

    let result = 0;
    switch (sortOption) {
      case "title_desc":
        result = -titleCompare || right.book.id - left.book.id;
        break;
      case "recent_desc":
        result = getBookSortDate(right.book) - getBookSortDate(left.book) || right.book.id - left.book.id;
        break;
      case "recent_asc":
        result = getBookSortDate(left.book) - getBookSortDate(right.book) || left.book.id - right.book.id;
        break;
      case "pages_desc":
        result = (right.book.numPages || 0) - (left.book.numPages || 0) || titleCompare;
        break;
      case "pages_asc":
        result = (left.book.numPages || 0) - (right.book.numPages || 0) || titleCompare;
        break;
      case "size_desc":
        result = (right.book.fileSize || 0) - (left.book.fileSize || 0) || titleCompare;
        break;
      case "size_asc":
        result = (left.book.fileSize || 0) - (right.book.fileSize || 0) || titleCompare;
        break;
      case "title_asc":
      default:
        result = titleCompare || left.book.id - right.book.id;
        break;
    }

    return result || left.index - right.index;
  });
  return indexed.map((item) => item.book);
}

function matchesLibrarySearch(book: BookWithThumbnail, query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed) return true;

  const candidates = [
    book,
    ...(book.mergedBooks || []),
  ];

  return candidates.some((candidate) => {
    const haystack = [
      candidate.title,
      candidate.author,
      candidate.fileName,
      candidate.series,
      candidate.publisher,
    ]
      .filter(Boolean)
      .join(" ");
    return (
      haystack.toLocaleLowerCase("pt-BR").includes(trimmed.toLocaleLowerCase("pt-BR")) ||
      calculateSimilarity(candidate.title || "", candidate.author || null, trimmed).matches
    );
  });
}

function matchesLibraryFileTypes(
  book: BookWithThumbnail,
  filters: FileTypeFilter[],
): boolean {
  const activeFilters = filters.filter((
    filter,
  ): filter is Exclude<FileTypeFilter, "all"> => filter !== "all");
  if (activeFilters.length === 0) return true;
  const candidates = book.mergedBooks?.length ? book.mergedBooks : [book];
  return candidates.some((candidate) => (
    candidate.fileType
      ? activeFilters.includes(candidate.fileType as Exclude<FileTypeFilter, "all">)
      : false
  ));
}

function RecentBookCard({ book, onClick }: { book: BookWithThumbnail; onClick: () => void }) {
  const [thumbnail, setThumbnail] = useState(book.thumbnail);

  useEffect(() => {
    let canceled = false;
    setThumbnail(book.thumbnail);

    if (!book.thumbnail && book.thumbnailPath) {
      window.api.getThumbnail(book.thumbnailPath).then((value: string | null) => {
        if (!canceled) setThumbnail(value || undefined);
      });
    }

    return () => { canceled = true; };
  }, [book.thumbnail, book.thumbnailPath]);

  return (
    <button
      type="button"
      onClick={onClick}
      className="lyceum-library-recent-book flex min-w-[210px] max-w-[260px] cursor-pointer items-center gap-2 rounded-sm border border-zinc-800 bg-zinc-900/60 px-2 py-1.5 text-left transition-colors hover:border-zinc-700 hover:bg-zinc-900"
    >
      <div className="flex h-9 w-7 flex-shrink-0 items-center justify-center overflow-hidden rounded-sm border border-zinc-800 bg-zinc-950">
        {thumbnail ? (
          <img src={thumbnail} alt={book.title} className="h-full w-full object-contain" />
        ) : (
          <span className="text-[9px] font-medium text-zinc-600">
            {getFileTypeLabel(book.fileType, book.filePath)}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-zinc-200">
          {getTitleWithoutExtension(book.title, book.fileType)}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-zinc-500">
          {getBookFolderLabel(book.filePath)}
        </p>
      </div>
    </button>
  );
}

interface MergedBookCacheEntry {
  representative: BookWithThumbnail;
  signature: string;
  value: BookWithThumbnail;
}

function getMergedBookSignature(group: BookWithThumbnail[]) {
  return group
    .map((book) => [
      book.id,
      book.fileHash,
      book.title,
      book.filePath,
      book.thumbnail,
      book.thumbnailPath,
      book.numPages,
      book.fileType,
      book.fileSize,
      book.lastOpenedAt,
      book.createdAt,
      book.processingStatus,
      book.updatedAt,
    ].join("\u001f"))
    .join("\u001e");
}

function LibraryContent() {
  const navigate = useNavigate();
  const { prepareBooks } = useConversionQueue();
  const { settings } = useAppSettings();
  const {
    folderStructure,
    selectedFolder,
    libraryRoots,
    libraryFolders,
    watchFolderPaths,
    refreshFolders,
    selectFolder,
    createFolder,
    renameFolder,
    deleteFolder,
    moveFolder,
    moveBook: moveBookInLibrary,
  } = useLibraryContext();
  const electronApiAvailable = !!window.api?.listBooks;

  const [viewMode, setViewMode] = useLocalStorage<"grid" | "list">("library_viewMode", "grid");
  const [gridDensity, setGridDensity] = useState<GridDensity>("comfortable");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useLocalStorage<SortOption>("library_sort", "title_asc");
  const [fileTypeFilter, setFileTypeFilter] = useState<FileTypeFilter[]>([]);
  const [activeSection, setActiveSection] = useLocalStorage<LibrarySection>("library_activeSection", "synced");

  const [selectedBook, setSelectedBook] = useState<BookWithThumbnail | null>(
    null,
  );
  const [showSidebar, setShowSidebar] = useLocalStorage("library_showSidebar", true);
  const [sidebarWidth, setSidebarWidth] = useLocalStorage("library_sidebarWidth", 256);
  const [detailPanelWidth, setDetailPanelWidth] = useLocalStorage("library_detailPanelWidth", 320);
  const [readingPreviewWidth, setReadingPreviewWidth] = useLocalStorage("library_readingPreviewWidth", 520);
  const [readingPreviewOpen, setReadingPreviewOpen] = useState(false);
  const [readingPreviewTab, setReadingPreviewTab] = useState<ReadingLaunchState | null>(null);
  const [localDocuments, setLocalDocuments] = useState<DocumentRecord[]>([]);
  const [globalRecentBooks, setGlobalRecentBooks] = useState<BookWithThumbnail[]>([]);
  const [specialFolderBooks, setSpecialFolderBooks] = useState<BookWithThumbnail[]>([]);
  const folderDragDrop = useFolderDragDrop();
  const mergedBookCacheRef = useRef(new Map<string, MergedBookCacheEntry>());
  const [selectedHashes, setSelectedHashes] = useState<Set<string>>(new Set());
  const [selectedBookMap, setSelectedBookMap] = useState<Map<string, BookWithThumbnail>>(
    new Map(),
  );
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [confirmMergeBooks, setConfirmMergeBooks] = useState(false);
  const [collectionDialog, setCollectionDialog] = useState({
    open: false,
    name: "",
  });
  const [bulkDeleteFileAlso, setBulkDeleteFileAlso] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [regeneratingAllThumbnails, setRegeneratingAllThumbnails] = useState(false);
  const [kindlePanelOpen, setKindlePanelOpen] = useState(false);
  const [syncDialog, setSyncDialog] = useState<{
    fileHash: string;
    action: "move" | "copy";
  } | null>(null);
  const [syncTargetFolder, setSyncTargetFolder] = useState("");
  const [importDialog, setImportDialog] = useState<{
    open: boolean;
    targetFolder: string | null;
    targetFolderName: string;
  }>({ open: false, targetFolder: null, targetFolderName: "" });
  const [createFolderDialog, setCreateFolderDialog] = useState<{
    open: boolean;
    parentPath: string | null;
    folderName: string;
  }>({ open: false, parentPath: null, folderName: "" });
  const [folderActionDialog, setFolderActionDialog] = useState<{
    mode: "rename" | "delete";
    folder: FolderInfo;
    value: string;
  } | null>(null);
  const deferredSearch = useDeferredValue(search);
  const sidebarIsDrawer = useMediaQuery("(max-width: 1279px)");
  const rightPanelsAreDrawer = useMediaQuery("(max-width: 1023px)");
  const compactHeader = useMediaQuery("(max-width: 639px)");
  const previousSidebarDrawerRef = useRef(sidebarIsDrawer);

  const bookQuery = useMemo(
    () => ({
      section: activeSection,
      search: deferredSearch,
      sort,
      fileType: fileTypeFilter.length === 0 ? "all" : fileTypeFilter.join(","),
      folderPath: activeSection === "usb" ? null : selectedFolder,
      includeSubfolders: settings.showSubfolderBooks,
    }),
    [
      activeSection,
      deferredSearch,
      fileTypeFilter,
      selectedFolder,
      settings.showSubfolderBooks,
      sort,
    ],
  );

  const {
    books,
    counts,
    hasMore,
    loading,
    loadingMore,
    handleSync,
    fetchNextPage,
    refreshBooks,
  } = useBooks(bookQuery);

  const loadLocalDocs = useCallback(async () => {
    if (!electronApiAvailable) return;
    try {
      const docs = await window.api.getDocuments();
      setLocalDocuments(docs);
    } catch (error) {
      console.error("Error loading local documents:", error);
    }
  }, [electronApiAvailable]);

  const loadGlobalRecentBooks = useCallback(async () => {
    if (!electronApiAvailable) return;
    try {
      const result = await window.api.listBooks({
        section: "all",
        search: "",
        sort: "recent_desc",
        fileType: "all",
        folderPath: null,
        limit: 80,
        offset: 0,
      });

      const recent = result.items
        .filter((book: BookWithThumbnail) => {
          const openedAt = new Date(book.lastOpenedAt).getTime();
          return (book.lastOpenedAt && !Number.isNaN(openedAt)) || book.currentPage > 0;
        })
        .slice(0, 8);

      setGlobalRecentBooks(recent);
    } catch (error) {
      console.error("Error loading recent books:", error);
      setGlobalRecentBooks([]);
    }
  }, [electronApiAvailable]);

  const refreshLibraryState = useCallback(async () => {
    await Promise.all([
      refreshBooks(),
      loadLocalDocs(),
      refreshFolders(),
      loadGlobalRecentBooks(),
    ]);
  }, [loadGlobalRecentBooks, loadLocalDocs, refreshBooks, refreshFolders]);

  useEffect(() => {
    if (!electronApiAvailable || !window.api.onLibraryUpdated) return;
    const unsubscribe = window.api.onLibraryUpdated(refreshLibraryState);
    return () => unsubscribe();
  }, [electronApiAvailable, refreshLibraryState]);

  useEffect(() => {
    if (!electronApiAvailable || !window.api.onLibraryNotification) return;
    const unsubscribe = window.api.onLibraryNotification((notification) => {
      if (notification.type === "error") {
        toast.error(notification.message);
      } else if (notification.type === "warning") {
        toast(notification.message, {
          icon: "⚠️",
          style: { background: "#1c1917", border: "1px solid #d97706", color: "#fbbf24" },
        });
      } else if (notification.type === "success") {
        toast.success(notification.message);
      }
    });
    return () => unsubscribe();
  }, [electronApiAvailable]);

  useEffect(() => {
    if (!electronApiAvailable) return;
    const onUsbDevicesUpdated = (window.api as unknown as UsbLibraryApi).onUsbDevicesUpdated;
    if (!onUsbDevicesUpdated) return;
    const unsubscribe = onUsbDevicesUpdated(refreshLibraryState);
    return () => unsubscribe();
  }, [electronApiAvailable, refreshLibraryState]);

  useEffect(() => {
    refreshLibraryState();
  }, [refreshLibraryState]);

  useEffect(() => {
    const wasDrawer = previousSidebarDrawerRef.current;
    if (sidebarIsDrawer && !wasDrawer) {
      setShowSidebar(false);
    } else if (!sidebarIsDrawer && wasDrawer) {
      setShowSidebar(true);
    }
    previousSidebarDrawerRef.current = sidebarIsDrawer;
  }, [setShowSidebar, sidebarIsDrawer]);

  const sourceRootPaths = useMemo(
    () =>
      libraryRoots
        .filter((root) => root.type === "source")
        .map((root) => root.path.replace(/\\/g, "/").replace(/\/+$/g, "").toLowerCase()),
    [libraryRoots],
  );

  const isSourceFolderPath = useCallback(
    (folderPath?: string | null) => {
      if (!folderPath) return false;
      const normalizedFolder = folderPath
        .replace(/\\/g, "/")
        .replace(/\/+$/g, "")
        .toLowerCase();
      return sourceRootPaths.some(
        (sourcePath) =>
          normalizedFolder === sourcePath ||
          normalizedFolder.startsWith(`${sourcePath}/`),
      );
    },
    [sourceRootPaths],
  );

  const handleFolderSelect = useCallback((folderPath: string | null) => {
    selectFolder(folderPath);
    setSelectedBook(null);
    setKindlePanelOpen(false);
    if (sidebarIsDrawer) {
      setShowSidebar(false);
    }
    if (folderPath && watchFolderPaths.has(folderPath)) {
      setActiveSection("unsynced");
    } else if (isSourceFolderPath(folderPath)) {
      setActiveSection("synced");
    } else if (folderPath === null) {
      const isWatchRoot = watchFolderPaths.size > 0;
      if (!isWatchRoot) setActiveSection("synced");
    }
  }, [isSourceFolderPath, selectFolder, setShowSidebar, sidebarIsDrawer, watchFolderPaths]);

  const startPaneResize = (
    pane: "sidebar" | "details" | "preview",
    event: ReactPointerEvent,
  ) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const startX = event.clientX;
    const startWidth =
      pane === "sidebar"
        ? sidebarWidth
        : pane === "details"
          ? detailPanelWidth
          : readingPreviewWidth;
    const shellRect =
      document.querySelector("[data-library-shell]")?.getBoundingClientRect() ??
      document.body.getBoundingClientRect();
    const previewRect =
      document.querySelector("[data-library-preview]")?.getBoundingClientRect();
    const detailsRightBoundary =
      pane === "details" && previewRect ? previewRect.left : shellRect.right;
    const availableWidth =
      pane === "details" ? detailsRightBoundary - shellRect.left : shellRect.width;
    const minWidth = pane === "sidebar" ? 220 : pane === "preview" ? 380 : 300;
    const maxWidth =
      pane === "sidebar"
        ? 420
        : pane === "preview"
          ? Math.max(minWidth, Math.min(900, shellRect.width - 420))
          : Math.max(minWidth, Math.min(760, availableWidth - 420));
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handleMove = (moveEvent: PointerEvent) => {
      const rightBoundary = pane === "details" ? detailsRightBoundary : shellRect.right;
      const nextWidth = pane === "details" || pane === "preview"
        ? Math.min(maxWidth, Math.max(minWidth, rightBoundary - moveEvent.clientX))
        : Math.min(
            maxWidth,
            Math.max(minWidth, startWidth + moveEvent.clientX - startX),
          );

      if (pane === "sidebar") {
        setSidebarWidth(nextWidth);
      } else if (pane === "details") {
        setDetailPanelWidth(nextWidth);
      } else {
        setReadingPreviewWidth(nextWidth);
      }
    };

    const handleUp = () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  };

  const openBookForReading = useCallback(async (
    filePath: string,
    fileHash?: string,
  ): Promise<ReadingLaunchState | null> => {
    const isUsbBook = activeSection === "usb";
    const result: OpenBookResult | null = isUsbBook
      ? await (window.api as unknown as UsbLibraryApi).openUsbBook(filePath)
      : await window.api.reopenPdf(filePath, fileHash);

    if (isUsbBook && result && "success" in result && !result.success) {
      toast.error(
        result.error === "Invalid file type"
          ? "Este formato ainda nÃ£o pode ser aberto no leitor"
          : result.error || "Erro ao abrir o arquivo",
      );
      return null;
    }

    if (!result) {
      toast.error("Erro ao abrir o arquivo");
      return null;
    }

    if ("error" in result) {
      toast.error(result.message || "Erro ao abrir o arquivo");
      return null;
    }

    if (result.foundAt && result.foundAt !== filePath) {
      toast.success("Livro encontrado em nova localização");
      refreshBooks();
    }

    return {
      fileBuffer: result.fileBuffer,
      fileHash: result.fileHash || fileHash || filePath,
      fileName: result.fileName || filePath.split(/[/\\]/).pop(),
      filePath: result.foundAt || result.filePath || filePath,
      fileType:
        result.fileType === "epub" || filePath.toLowerCase().endsWith(".epub")
          ? "epub"
          : "pdf",
      source: isUsbBook ? "local" : "library",
      navigationId: crypto.randomUUID(),
    };
  }, [activeSection, refreshBooks]);

  const handleOpen = useCallback(async (filePath: string, fileHash?: string) => {
    const launchState = await openBookForReading(filePath, fileHash);
    if (!launchState) {
      return;
    }

    navigate("/reading", { state: launchState });
  }, [navigate, openBookForReading]);

  const handleOpenPreview = useCallback(async (book: BookWithThumbnail) => {
    if (!book.filePath) {
      toast.error("Caminho do arquivo nÃ£o encontrado");
      return;
    }

    const launchState = await openBookForReading(book.filePath, book.fileHash);
    if (!launchState) {
      return;
    }

    setReadingPreviewOpen(true);
    setReadingPreviewTab(launchState);
    if (rightPanelsAreDrawer) {
      setSelectedBook(null);
    }
  }, [openBookForReading, rightPanelsAreDrawer]);

  const handleBookClick = useCallback((book: BookWithThumbnail) => {
    if (book.syntheticFolderType === "collection" && book.syntheticFolderPath) {
      handleFolderSelect(book.syntheticFolderPath);
      return;
    }

    setSelectedBook(book);
  }, [handleFolderSelect]);

  const cleanupConsumedCollections = useCallback(async (
    consumedBooks: BookWithThumbnail[],
    destinationPath?: string | null,
  ) => {
    const destination = normalizeFolderPath(destinationPath);
    const collectionPaths = Array.from(new Set(
      consumedBooks
        .filter((book) => book.syntheticFolderType === "collection" && book.syntheticFolderPath)
        .map((book) => book.syntheticFolderPath as string)
        .filter((folderPath) => normalizeFolderPath(folderPath) !== destination),
    ));

    for (const folderPath of collectionPaths) {
      const result = await deleteFolder(folderPath, true);
      if (!result.success) {
        console.warn("[Library] Could not delete consumed collection folder:", folderPath, result.error);
      }
    }
  }, [deleteFolder]);

  const findDisplayBookByHash = useCallback((fileHash: string) => (
    selectedBookMap.get(fileHash) ||
    specialFolderBooks.find((candidate) => candidate.fileHash === fileHash) ||
    books.find((candidate) => candidate.fileHash === fileHash)
  ), [books, selectedBookMap, specialFolderBooks]);

  const getConcreteFileHashesFromBooks = useCallback((
    items: BookWithThumbnail[],
  ) => Array.from(new Set(
    items.flatMap((book) =>
      book.mergedBooks?.length
        ? book.mergedBooks.map((variant) => variant.fileHash)
        : book.syntheticFolderType
          ? []
          : [book.fileHash],
    ),
  )), []);

  const handleBookDeleted = useCallback(() => {
    setSelectedBook(null);
    refreshLibraryState();
  }, [refreshLibraryState]);

  const handleDeleteBook = useCallback(async (fileHash: string): Promise<boolean> => {
    const result = await window.api.deleteBook(fileHash, false);
    if (result.success) {
      await refreshLibraryState();
      return true;
    }
    toast.error(result.error || "Erro ao remover livro");
    return false;
  }, [refreshLibraryState]);

  const handleMoveBook = async (
    fileHash: string,
    targetFolder: string | null,
  ): Promise<boolean> => {
    const book =
      selectedBookMap.get(fileHash) ||
      specialFolderBooks.find((candidate) => candidate.fileHash === fileHash) ||
      books.find((candidate) => candidate.fileHash === fileHash);

    if (
      book?.folderPath &&
      book.syntheticFolderType &&
      book.syntheticFolderPath
    ) {
      const result = await moveFolder(book.syntheticFolderPath, targetFolder);
      if (result.success) {
        await refreshLibraryState();
        return true;
      }

      toast.error(result.error || "Erro ao mover pasta especial");
      return false;
    }

    const mergedVariantCount = book?.bookId
      ? book.mergedBooks?.length || books.filter((candidate) => candidate.bookId === book.bookId).length
      : 0;

    if (book?.bookId && mergedVariantCount > 1 && window.api.moveMergedBook) {
      const result = await window.api.moveMergedBook(book.bookId, targetFolder);
      if (result.success) {
        await refreshLibraryState();
        return true;
      }

      toast.error(result.error || "Erro ao mover livro mesclado");
      return false;
    }

    if (book && book.isSynced !== 1 && !isAbsoluteFolderPath(targetFolder)) {
      const result = await window.api.syncDocument(
        fileHash,
        "move",
        targetFolder || undefined,
      );
      if (result.success) {
        await refreshLibraryState();
        return true;
      }

      toast.error(result.error || "Erro ao mover livro para a library");
      return false;
    }

    const result = await moveBookInLibrary(fileHash, targetFolder);
    if (result.success) {
      return true;
    }

    toast.error(result.error || "Erro ao mover livro");
    return false;
  };

  const openSyncDialog = useCallback((fileHash: string, action: "move" | "copy") => {
    setSyncTargetFolder(selectedFolder || libraryFolders[0] || "");
    setSyncDialog({ fileHash, action });
  }, [libraryFolders, selectedFolder]);

  const confirmSyncToLibrary = async () => {
    if (!syncDialog) return;

    await handleSync(
      syncDialog.fileHash,
      syncDialog.action,
      syncTargetFolder || undefined,
    );
    setSyncDialog(null);
    setSyncTargetFolder("");
    await refreshLibraryState();
  };

  const handleMoveBooks = async (
    fileHashes: string[],
    targetFolder: string | null,
  ): Promise<boolean> => {
    let moved = 0;
    let failed = 0;
    const movedBookIds = new Set<string>();

    for (const fileHash of fileHashes) {
      const book =
        selectedBookMap.get(fileHash) ||
        specialFolderBooks.find((candidate) => candidate.fileHash === fileHash) ||
        books.find((candidate) => candidate.fileHash === fileHash);
      const mergedFolderVariantCount = book?.mergedBooks?.length || 0;
      if (
        book?.folderPath &&
        book.syntheticFolderType &&
        book.syntheticFolderPath
      ) {
        const result = await moveFolder(book.syntheticFolderPath, targetFolder);
        if (result.success) {
          moved += Math.max(1, mergedFolderVariantCount);
        } else {
          failed += Math.max(1, mergedFolderVariantCount);
          toast.error(result.error || "Erro ao mover pasta especial");
        }
        continue;
      }

      const mergedVariantCount = book?.bookId
        ? book.mergedBooks?.length || books.filter((candidate) => candidate.bookId === book.bookId).length
        : 0;
      if (book?.bookId && mergedVariantCount > 1 && window.api.moveMergedBook) {
        if (movedBookIds.has(book.bookId)) continue;
        movedBookIds.add(book.bookId);
        const result = await window.api.moveMergedBook(book.bookId, targetFolder);
        if (result.success) {
          moved += mergedVariantCount;
        } else {
          failed += mergedVariantCount;
          toast.error(result.error || "Erro ao mover livro mesclado");
        }
        continue;
      }

      const success = await handleMoveBook(fileHash, targetFolder);
      if (success) {
        moved++;
      } else {
        failed++;
      }
    }

    await refreshLibraryState();

    if (moved > 0) {
      toast.success(
        `${moved} livro${moved !== 1 ? "s" : ""} movido${moved !== 1 ? "s" : ""}`,
      );
    }
    if (failed > 0) {
      toast.error(
        `${failed} item${failed !== 1 ? "s" : ""} não movido${failed !== 1 ? "s" : ""}`,
      );
    }

    return failed === 0;
  };

  const handleDropBooksOnBook = async (
    targetBook: BookWithThumbnail,
    sourceFileHashes: string[],
    action: "merge" | "collection",
  ) => {
    const sourceBooks = sourceFileHashes
      .map(findDisplayBookByHash)
      .filter((book): book is BookWithThumbnail => Boolean(book));
    const sourceConcreteFileHashes = getConcreteFileHashesFromBooks(sourceBooks);
    const targetFileHashes = getConcreteFileHashesFromBooks([targetBook]);
    const fileHashes = Array.from(
      new Set([...sourceConcreteFileHashes, ...targetFileHashes].filter(Boolean)),
    );

    if (fileHashes.length < 2) return;

    setBulkBusy(true);
    try {
      if (
        action === "merge" &&
        targetBook.syntheticFolderType === "merged" &&
        targetBook.syntheticFolderPath
      ) {
        await handleMoveBooks(sourceConcreteFileHashes, targetBook.syntheticFolderPath);
        await cleanupConsumedCollections(sourceBooks, targetBook.syntheticFolderPath);
        return;
      }

      if (
        action === "collection" &&
        targetBook.syntheticFolderType === "collection" &&
        targetBook.syntheticFolderPath
      ) {
        await handleMoveBooks(sourceConcreteFileHashes, targetBook.syntheticFolderPath);
        await cleanupConsumedCollections(sourceBooks, targetBook.syntheticFolderPath);
        return;
      }

      const result = action === "merge"
        ? window.api.mergeBooksIntoFolder
          ? await window.api.mergeBooksIntoFolder(fileHashes, selectedFolder)
          : await window.api.mergeBooks(fileHashes)
        : await window.api.createCollection(
            getTitleWithoutExtension(targetBook.title, targetBook.fileType),
            fileHashes,
            selectedFolder,
          );

      if (result.success) {
        if (action === "collection") {
          await cleanupConsumedCollections(
            [targetBook, ...sourceBooks],
            "folderPath" in result ? result.folderPath || null : null,
          );
        }
        toast.success(action === "merge" ? "Livros mesclados" : "Colecao criada");
        await refreshLibraryState();
      } else {
        toast.error(result.error || (action === "merge" ? "Erro ao mesclar livros" : "Erro ao criar colecao"));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao processar livros");
    } finally {
      folderDragDrop.clearDrag();
      setBulkBusy(false);
    }
  };

  const handleImportBook = async (targetFolder: string | null) => {
    setImportDialog({
      open: true,
      targetFolder,
      targetFolderName: targetFolder || "",
    });
  };

  const openCreateFolderDialog = (parentPath: string | null) => {
    setCreateFolderDialog({
      open: true,
      parentPath,
      folderName: "",
    });
  };

  const closeCreateFolderDialog = () => {
    setCreateFolderDialog({
      open: false,
      parentPath: null,
      folderName: "",
    });
  };

  const confirmCreateFolder = async () => {
    const folderName = createFolderDialog.folderName.trim();
    if (!folderName) {
      toast.error("Informe o nome da pasta");
      return;
    }

    const result = await createFolder(createFolderDialog.parentPath, folderName);

    if (result.success) {
      toast.success("Pasta criada");
      closeCreateFolderDialog();
    } else {
      toast.error(result.error || "Erro ao criar pasta");
    }
  };

  const openRenameFolderDialog = (folder: FolderInfo) => {
    setFolderActionDialog({
      mode: "rename",
      folder,
      value: folder.name,
    });
  };

  const openDeleteFolderDialog = (folder: FolderInfo) => {
    setFolderActionDialog({
      mode: "delete",
      folder,
      value: folder.name,
    });
  };

  const closeFolderActionDialog = () => {
    setFolderActionDialog(null);
  };

  const confirmFolderAction = async () => {
    if (!folderActionDialog) return;

    if (folderActionDialog.mode === "rename") {
      let newName = folderActionDialog.value.trim();
      if (!newName) {
        toast.error("Informe o nome da pasta");
        return;
      }
      const folderType = classifyFolder(folderActionDialog.folder.name);
      if (folderType === "collection" && !newName.startsWith("__")) {
        newName = `__${newName.replace(/^_+/, "")}`;
      } else if (folderType === "merged" && (newName.startsWith("__") || !newName.startsWith("_"))) {
        newName = `_${newName.replace(/^_+/, "")}`;
      }

      const result = await renameFolder(
        folderActionDialog.folder.fullPath,
        newName,
      );

      if (result.success) {
        toast.success("Pasta renomeada");
        closeFolderActionDialog();
      } else {
        toast.error(result.error || "Erro ao renomear pasta");
      }
      return;
    }

    const result = await deleteFolder(
      folderActionDialog.folder.fullPath,
      true,
    );

    if (result.success) {
      toast.success("Pasta excluida");
      const selected = normalizeFolderPath(selectedFolder);
      const deleted = normalizeFolderPath(folderActionDialog.folder.path);
      if (selected === deleted || selected.startsWith(`${deleted}/`)) {
        handleFolderSelect(null);
      }
      closeFolderActionDialog();
    } else {
      toast.error(result.error || "Erro ao excluir pasta");
    }
  };

  const handleImportConfirm = async (action: "move" | "copy") => {
    const { targetFolder } = importDialog;
    const result = await window.api.importPdf(targetFolder, action);

    setImportDialog({ open: false, targetFolder: null, targetFolderName: "" });

    if (result.canceled) return;

    if (result.success) {
      if (result.errors.length > 0) {
        toast.error(result.errors.join(", "));
      } else {
        toast.success(result.message);
      }
      refreshLibraryState();
    } else {
      toast.error(result.errors.join(", ") || "Erro ao importar livro");
    }
  };

  const handleBookRefresh = async () => {
    await refreshLibraryState();
    if (selectedBook) {
      const result = await window.api.listBooks({
        section: "all",
        search: selectedBook.title,
        limit: 10,
        offset: 0,
      });
      const updatedBook = result.items.find((book: BookWithThumbnail) => (
        book.fileHash === selectedBook.fileHash
      ));
      if (updatedBook) {
        const thumbnail = updatedBook.thumbnailPath
          ? await window.api.getThumbnail(updatedBook.thumbnailPath)
          : null;
        setSelectedBook({ ...updatedBook, thumbnail: thumbnail || undefined });
      } else {
        setSelectedBook(null);
      }
    }
  };

  const toggleSelection = useCallback((book: BookWithThumbnail) => {
    setSelectedHashes((previous) => {
      const next = new Set(previous);
      if (next.has(book.fileHash)) {
        next.delete(book.fileHash);
      } else {
        next.add(book.fileHash);
      }
      return next;
    });
    setSelectedBookMap((previous) => {
      const next = new Map(previous);
      if (next.has(book.fileHash)) {
        next.delete(book.fileHash);
      } else {
        next.set(book.fileHash, book);
      }
      return next;
    });
  }, []);

  const handleContextSelect = useCallback((book: BookWithThumbnail) => {
    setSelectedHashes((previous) => new Set(previous).add(book.fileHash));
    setSelectedBookMap((previous) => new Map(previous).set(book.fileHash, book));
  }, []);

  const handleBookDragStart = useCallback((fileHash: string) => {
    if (selectedHashes.has(fileHash)) {
      folderDragDrop.startBookDrag(Array.from(selectedHashes));
      return;
    }

    folderDragDrop.startBookDrag([fileHash]);
  }, [folderDragDrop, selectedHashes]);

  const clearSelection = useCallback(() => {
    setSelectedHashes(new Set());
    setSelectedBookMap(new Map());
    folderDragDrop.clearDrag();
  }, [folderDragDrop]);

  const handleBookDragEnd = useCallback(() => {
    folderDragDrop.clearDrag();
  }, [folderDragDrop]);

  const selectedBooks = useMemo(
    () => Array.from(selectedBookMap.values()),
    [selectedBookMap],
  );
  const selectedConcreteBooks = useMemo(
    () =>
      selectedBooks.flatMap((book) =>
        book.mergedBooks?.length
          ? book.mergedBooks
          : book.syntheticFolderType
            ? []
            : [book],
      ),
    [selectedBooks],
  );
  const visibleFolders = useMemo(
    () =>
      activeSection === "usb"
        ? []
        : getFolderChildren(folderStructure, selectedFolder),
    [activeSection, folderStructure, selectedFolder],
  );
  const unifiedLibraryView = settings.unifiedLibraryView && activeSection !== "usb";
  const classifiedVisibleFolders = useMemo(
    () => classifyFolders(visibleFolders),
    [visibleFolders],
  );
  const visibleSpecialFolders = useMemo(
    () => collectSpecialFoldersForDisplay(
      visibleFolders,
      settings.showSubfolderBooks,
    ),
    [settings.showSubfolderBooks, visibleFolders],
  );
  const currentFolderType = classifyFolder(getPathLeaf(selectedFolder));

  useEffect(() => {
    if (
      activeSection === "usb" ||
      visibleSpecialFolders.length === 0 ||
      !window.api?.getBooksInFolder
    ) {
      setSpecialFolderBooks([]);
      return;
    }

    let canceled = false;

    const loadSpecialFolders = async () => {
      const cards = await Promise.all(
        visibleSpecialFolders.map(async ({ folder, type }) => {
          const documents = await window.api.getBooksInFolder(folder.path);
          return buildSpecialFolderBook(
            folder,
            documents as BookWithThumbnail[],
            type,
          );
        }),
      );

      if (!canceled) {
        setSpecialFolderBooks(
          cards.filter((book): book is BookWithThumbnail => Boolean(book)),
        );
      }
    };

    void loadSpecialFolders();

    return () => {
      canceled = true;
    };
  }, [
    activeSection,
    visibleSpecialFolders,
  ]);

  const displayBooks = useMemo(() => {
    if (activeSection === "usb") return books;
    const filteredSpecialFolderBooks =
      activeSection === "synced"
        ? specialFolderBooks.filter((book) =>
            matchesLibrarySearch(book, deferredSearch) &&
            matchesLibraryFileTypes(book, fileTypeFilter),
          )
        : [];
    const collapsedSpecialFolderPaths = currentFolderType === "normal"
      ? new Set(
          visibleSpecialFolders.map(({ folder }) =>
            normalizeAbsoluteFolderPath(folder.fullPath),
          ),
        )
      : new Set<string>();
    const booksForDisplay =
      collapsedSpecialFolderPaths.size === 0
        ? books
        : books.filter(
            (book) => {
              const folderPath = normalizeAbsoluteFolderPath(book.folderPath);
              return !Array.from(collapsedSpecialFolderPaths).some(
                (collapsedPath) =>
                  folderPath === collapsedPath ||
                  folderPath.startsWith(`${collapsedPath}/`),
              );
            },
          );
    const booksForGrouping = sortBooksForLibraryView(
      [...booksForDisplay, ...filteredSpecialFolderBooks],
      sort,
    );

    const grouped = new Map<string, BookWithThumbnail[]>();
    const orderedKeys: string[] = [];

    for (const book of booksForGrouping) {
      const groupKey = book.syntheticFolderType
        ? book.fileHash
        : book.bookId || book.fileHash;
      if (!grouped.has(groupKey)) {
        grouped.set(groupKey, []);
        orderedKeys.push(groupKey);
      }
      grouped.get(groupKey)?.push(book);
    }

    const nextCache = new Map<string, MergedBookCacheEntry>();
    const result = orderedKeys.map((groupKey) => {
      const group = grouped.get(groupKey) || [];
      const representative = pickRepresentativeBook(group);
      if (group.length <= 1 || representative.syntheticFolderType) return representative;

      const signature = getMergedBookSignature(group);
      const cached = mergedBookCacheRef.current.get(groupKey);
      if (
        cached &&
        cached.representative === representative &&
        cached.signature === signature
      ) {
        nextCache.set(groupKey, cached);
        return cached.value;
      }

      const value = { ...representative, mergedBooks: group };
      nextCache.set(groupKey, { representative, signature, value });
      return value;
    });

    mergedBookCacheRef.current = nextCache;
    return result;
  }, [
    activeSection,
    books,
    currentFolderType,
    deferredSearch,
    fileTypeFilter,
    sort,
    specialFolderBooks,
    visibleSpecialFolders,
  ]);

  const bookGridBooks = displayBooks;

  const selectableDisplayBooks = bookGridBooks;

  const recentBooksSection = activeSection !== "usb" && globalRecentBooks.length > 0 ? (
    <section className="mb-4">
      <div className="mb-1.5 flex items-center justify-between">
        <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Continuar lendo
        </h2>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {globalRecentBooks.map((book) => (
          <RecentBookCard
            key={book.fileHash}
            book={book}
            onClick={() => handleOpen(book.filePath, book.fileHash)}
          />
        ))}
      </div>
    </section>
  ) : null;

  const folderExplorerSection = activeSection !== "usb" ? (
    <section className={unifiedLibraryView ? "mb-4" : "mb-5 border-b border-zinc-800 pb-4"}>
      <FolderPathBar
        folders={folderStructure}
        selectedFolder={selectedFolder}
        onFolderSelect={handleFolderSelect}
        onCreateFolder={openCreateFolderDialog}
        onImportBook={handleImportBook}
      />
      {!unifiedLibraryView && (
        <FolderGrid
          folders={classifiedVisibleFolders.normal}
          onFolderSelect={handleFolderSelect}
          books={displayBooks}
          selectedFolder={selectedFolder}
          draggingBookHashes={folderDragDrop.draggedBooks}
          onCreateFolder={openCreateFolderDialog}
          onImportBook={handleImportBook}
          onRenameFolder={openRenameFolderDialog}
          onDeleteFolder={openDeleteFolderDialog}
          onMoveBook={handleMoveBook}
          onMoveBooks={handleMoveBooks}
        />
      )}
    </section>
  ) : null;

  const bookGridTopContent = (
    <>
      {folderExplorerSection}
      {recentBooksSection && (
        <div className="mb-4 border-b border-zinc-800 pb-4">
          {recentBooksSection}
        </div>
      )}
    </>
  );

  useEffect(() => {
    if (kindlePanelOpen && selectedConcreteBooks.length === 0) {
      setKindlePanelOpen(false);
    }
  }, [kindlePanelOpen, selectedConcreteBooks.length]);

  const selectAllFiltered = () => {
    setSelectedHashes(new Set(selectableDisplayBooks.map((book) => book.fileHash)));
    setSelectedBookMap(new Map(selectableDisplayBooks.map((book) => [book.fileHash, book])));
  };

  const openConversionWithSelection = () => {
    if (selectedConcreteBooks.length === 0) return;
    prepareBooks(selectedConcreteBooks);
    navigate("/conversion");
  };

  const openKindlePanel = () => {
    if (selectedConcreteBooks.length === 0) return;
    setSelectedBook(null);
    setReadingPreviewOpen(false);
    setKindlePanelOpen(true);
  };

  const runBulkRegenerateThumbnails = async () => {
    if (selectedHashes.size === 0) return;
    setBulkBusy(true);
    let generated = 0;
    let failed = 0;

    for (const fileHash of getSelectedFileHashes()) {
      const result = await window.api.regenerateThumbnail(fileHash);
      if (result.success) generated++;
      else failed++;
    }

    setBulkBusy(false);
    await refreshLibraryState();
    toast.success(`${generated} thumbnail${generated !== 1 ? "s" : ""} regenerada${generated !== 1 ? "s" : ""}`);
    if (failed > 0) toast.error(`${failed} thumbnail${failed !== 1 ? "s" : ""} com erro`);
  };

  const runRegenerateAllThumbnails = async () => {
    if (!window.api?.regenerateAllThumbnails || regeneratingAllThumbnails) return;
    setRegeneratingAllThumbnails(true);
    try {
      const result = await window.api.regenerateAllThumbnails();
      toast.success(`${result.queued} thumbnail${result.queued !== 1 ? "s" : ""} na fila`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao enfileirar thumbnails");
    } finally {
      setRegeneratingAllThumbnails(false);
    }
  };

  const getSelectedFileHashes = () =>
    getConcreteFileHashesFromBooks(selectedConcreteBooks);

  const runMergeBooks = async () => {
    if (selectedConcreteBooks.length < 2) return;
    setBulkBusy(true);
    try {
      const fileHashes = getSelectedFileHashes();
      const result = window.api.mergeBooksIntoFolder
        ? await window.api.mergeBooksIntoFolder(fileHashes, selectedFolder)
        : await window.api.mergeBooks(fileHashes);
      if (result.success) {
        const mergedCount = "mergedCount" in result
          ? result.mergedCount || fileHashes.length
          : fileHashes.length;
        await cleanupConsumedCollections(
          selectedBooks,
          "folderPath" in result ? result.folderPath || null : null,
        );
        toast.success(
          `${mergedCount} arquivo${mergedCount !== 1 ? "s" : ""} mesclado${mergedCount !== 1 ? "s" : ""} em pasta _`,
        );
        clearSelection();
        setSelectedBook(null);
        setConfirmMergeBooks(false);
        await refreshLibraryState();
      } else {
        toast.error(result.error || "Erro ao mesclar livros");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao mesclar livros");
    } finally {
      setBulkBusy(false);
    }
  };

  const runCreateCollection = async () => {
    const name = collectionDialog.name.trim();
    if (!name) {
      toast.error("Informe o nome da colecao");
      return;
    }
    if (selectedConcreteBooks.length === 0) return;

    setBulkBusy(true);
    try {
      const fileHashes = getSelectedFileHashes();
      const result = await window.api.createCollection(name, fileHashes, selectedFolder);
      if (result.success) {
        await cleanupConsumedCollections(selectedBooks, result.folderPath || null);
        toast.success("Colecao criada");
        setCollectionDialog({ open: false, name: "" });
        clearSelection();
        setSelectedBook(null);
        await refreshLibraryState();
      } else {
        toast.error(result.error || "Erro ao criar colecao");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao criar colecao");
    } finally {
      setBulkBusy(false);
    }
  };

  const runBulkDelete = async () => {
    setBulkBusy(true);
    let removed = 0;
    let failed = 0;

    for (const fileHash of getSelectedFileHashes()) {
      const result = await window.api.deleteBook(fileHash, bulkDeleteFileAlso);
      if (result.success) removed++;
      else failed++;
    }

    setBulkBusy(false);
    setConfirmBulkDelete(false);
    setBulkDeleteFileAlso(false);
    clearSelection();
    setSelectedBook(null);
    await refreshLibraryState();
    if (bulkDeleteFileAlso) {
      toast.success(`${removed} livro${removed !== 1 ? "s" : ""} excluído${removed !== 1 ? "s" : ""} do disco`);
    } else {
      toast.success(`${removed} livro${removed !== 1 ? "s" : ""} removido${removed !== 1 ? "s" : ""} da biblioteca`);
    }
    if (failed > 0) toast.error(`${failed} item${failed !== 1 ? "s" : ""} não removido${failed !== 1 ? "s" : ""}`);
  };

  if (!electronApiAvailable) {
    return (
      <div className="lyceum-page-library flex h-full min-h-0 items-center justify-center bg-zinc-950 p-6 text-zinc-100">
        <div className="max-w-md rounded-sm border border-zinc-800 bg-zinc-900 p-5 text-sm text-zinc-300">
          <h1 className="mb-2 text-base font-semibold text-zinc-100">Backend do Electron indisponivel</h1>
          <p className="text-zinc-400">
            A biblioteca e as conversoes dependem do preload do Electron. Abra o app pelo processo Electron em vez do navegador em localhost.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="lyceum-page-library relative flex h-full min-h-0 overflow-hidden bg-zinc-950 p-1 text-zinc-100 xs:p-2">
      {showSidebar && (
        <aside
          className={`lyceum-library-sidebar h-full overflow-hidden rounded-sm border border-zinc-800 bg-zinc-900/95 ${
            sidebarIsDrawer
              ? "fixed bottom-2 left-2 top-2 z-50 shadow-2xl"
              : "relative flex-shrink-0 bg-zinc-900/50"
          }`}
          style={{ width: sidebarIsDrawer ? "min(88vw, 320px)" : sidebarWidth }}
        >
          <div className="h-full overflow-y-auto">
            <FolderTree
              selectedFolder={selectedFolder}
              onFolderSelect={handleFolderSelect}
              localDocuments={localDocuments}
              includeSubfolders={settings.showSubfolderBooks}
              onFoldersChanged={refreshLibraryState}
              onMoveBook={handleMoveBook}
              onMoveBooks={handleMoveBooks}
              draggingBookHashes={folderDragDrop.draggedBooks}
              onImportBook={handleImportBook}
            />
          </div>
          <button
            type="button"
            onPointerDown={(event) => startPaneResize("sidebar", event)}
            className={`absolute right-0 top-0 h-full w-1 cursor-col-resize bg-transparent hover:bg-green-500/70 ${
              sidebarIsDrawer ? "hidden" : ""
            }`}
            title="Redimensionar painel de pastas"
          />
        </aside>
      )}

      {showSidebar && sidebarIsDrawer && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/55"
          onClick={() => setShowSidebar(false)}
          aria-label="Fechar painel de pastas"
        />
      )}

      <div
        data-library-shell
        className={`lyceum-library-shell flex h-full min-w-0 flex-1 overflow-hidden rounded-sm border border-zinc-800 bg-zinc-950 ${
          showSidebar && !sidebarIsDrawer ? "ml-2" : ""
        }`}
      >
        <div className="flex h-full min-w-0 flex-1 flex-col">
          <header className="flex flex-shrink-0 flex-col gap-3 border-b border-zinc-800 px-2 py-3 sm:px-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
              <BookOpen size={20} className="text-zinc-400" />
              <h1 className="text-base font-semibold tracking-tight">Biblioteca</h1>
              <span className="hidden text-zinc-700 sm:inline">|</span>
              <span className="text-xs text-zinc-500 sm:whitespace-nowrap">
                {counts.synced + counts.unsynced + counts.usb} volumes
              </span>
              <SectionTabs
                activeSection={activeSection}
                onSectionChange={setActiveSection}
                syncedCount={counts.synced}
                unsyncedCount={counts.unsynced}
                usbCount={counts.usb}
              />
            </div>

            <div className="flex min-w-0 flex-wrap items-center gap-2 xl:justify-end">
              <button
                onClick={() => setShowSidebar(!showSidebar)}
                className="cursor-pointer rounded-sm bg-zinc-800 p-2 text-zinc-400 transition-colors hover:bg-zinc-700"
                title={
                  showSidebar
                    ? "Ocultar painel de pastas"
                    : "Mostrar painel de pastas"
                }
              >
                {showSidebar ? (
                  <PanelLeftClose size={18} />
                ) : (
                  <PanelLeft size={18} />
                )}
              </button>

              <button
                onClick={() =>
                  activeSection === "usb"
                    ? (window.api as unknown as UsbLibraryApi).scanUsbBooks?.()
                    : window.api.openLibraryFolder()
                }
                className="cursor-pointer rounded-sm bg-zinc-800 p-2 text-zinc-400 transition-colors hover:bg-zinc-700"
                title={
                  activeSection === "usb"
                    ? "Verificar dispositivos USB"
                    : "Abrir pasta da biblioteca"
                }
              >
                {activeSection === "usb" ? (
                  <Usb size={18} />
                ) : (
                  <FolderOpen size={18} />
                )}
              </button>

              <div className="flex items-center rounded-sm border border-zinc-800 bg-zinc-900 p-0.5">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`cursor-pointer rounded-sm p-1.5 ${
                    viewMode === "grid"
                      ? "bg-zinc-700 text-white"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                  title="Grade"
                >
                  <LayoutGrid size={14} />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`cursor-pointer rounded-sm p-1.5 ${
                    viewMode === "list"
                      ? "bg-zinc-700 text-white"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                  title="Lista"
                >
                  <List size={14} />
                </button>
              </div>

              {!compactHeader && (
              <div className="flex items-center rounded-sm border border-zinc-800 bg-zinc-900 p-0.5">
                {(
                  [
                    ["compact", "P"],
                    ["comfortable", "M"],
                    ["large", "G"],
                  ] as [GridDensity, string][]
                ).map(([density, label]) => (
                  <button
                    key={density}
                    onClick={() => setGridDensity(density)}
                    className={`h-7 w-7 cursor-pointer rounded-sm text-xs transition-colors ${
                      gridDensity === density
                        ? "bg-zinc-700 text-white"
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                    title={`Tamanho ${label}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              )}

              <button
                type="button"
                onClick={runRegenerateAllThumbnails}
                disabled={regeneratingAllThumbnails}
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-sm border border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
                title="Regenerar todas as thumbnails"
                aria-label="Regenerar todas as thumbnails"
              >
                <RefreshCw size={14} className={regeneratingAllThumbnails ? "animate-spin" : ""} />
              </button>
            </div>
          </header>

          <main className="flex min-h-0 flex-1 flex-col overflow-hidden p-2 sm:p-4">
            <div className="flex-shrink-0 border-zinc-900">
              <FilterBar
                search={search}
                onSearchChange={setSearch}
                sort={sort}
                onSortChange={setSort}
                fileType={fileTypeFilter}
                onFileTypeChange={setFileTypeFilter}
              />
            </div>

            {selectedHashes.size > 0 && (
              <div className="lyceum-selection-toolbar sticky top-0 z-20 mb-3 flex flex-wrap items-center gap-2 rounded-sm border border-zinc-800 bg-zinc-900/95 p-2.5 shadow-xl">
                <div className="flex items-center gap-2 text-sm text-zinc-200">
                  <CheckSquare size={16} className="text-green-400" />
                  {selectedHashes.size} selecionado
                  {selectedHashes.size !== 1 ? "s" : ""}
                </div>

                <button
                  onClick={selectAllFiltered}
                  className="cursor-pointer rounded-sm border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800"
                >
                  Selecionar todos
                </button>
                <button
                  onClick={openConversionWithSelection}
                  disabled={selectedConcreteBooks.length === 0}
                  className="flex cursor-pointer items-center gap-2 rounded-sm bg-green-500 px-3 py-2 text-xs font-medium text-zinc-950 hover:bg-green-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Send size={14} />
                  Converter
                </button>
                {activeSection !== "usb" && (
                  <button
                    onClick={openKindlePanel}
                    disabled={selectedConcreteBooks.length === 0}
                    className="flex cursor-pointer items-center gap-2 rounded-sm border border-green-500/50 bg-green-500/10 px-3 py-2 text-xs font-medium text-green-200 hover:bg-green-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Usb size={14} />
                    Enviar para Kindle
                  </button>
                )}
                {activeSection !== "usb" && (
                  <button
                    onClick={() => setConfirmMergeBooks(true)}
                    disabled={bulkBusy || selectedConcreteBooks.length < 2}
                    className="flex cursor-pointer items-center gap-2 rounded-sm border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <GitMerge size={14} />
                    Mesclar livros
                  </button>
                )}
                {activeSection !== "usb" && (
                  <button
                    onClick={() => setCollectionDialog({ open: true, name: "" })}
                    disabled={bulkBusy || selectedConcreteBooks.length === 0}
                    className="flex cursor-pointer items-center gap-2 rounded-sm border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Layers size={14} />
                    Criar colecao
                  </button>
                )}
                  <button
                    onClick={runBulkRegenerateThumbnails}
                    disabled={bulkBusy || selectedConcreteBooks.length === 0}
                  className="flex cursor-pointer items-center gap-2 rounded-sm bg-zinc-800 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-700 disabled:opacity-50"
                >
                  <RefreshCw size={14} className={bulkBusy ? "animate-spin" : ""} />
                  Thumbnails
                </button>
                <button
                  onClick={() => setConfirmBulkDelete(true)}
                  disabled={bulkBusy}
                  className="flex cursor-pointer items-center gap-2 rounded-sm bg-red-500/10 px-3 py-2 text-xs text-red-300 hover:bg-red-500/20 disabled:opacity-50"
                >
                  <Trash2 size={14} />
                  Remover
                </button>
                <button
                  onClick={clearSelection}
                  className="ml-auto cursor-pointer rounded-sm p-2 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
                  title="Sair da seleção"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            {loading ? (
              <div className="flex min-h-0 flex-1 items-center justify-center gap-2 text-sm text-zinc-500">
                <RefreshCw size={16} className="animate-spin" />
                Carregando biblioteca...
              </div>
            ) : (
              <BookGrid
                books={bookGridBooks}
                viewMode={viewMode}
                gridDensity={gridDensity}
                onOpen={handleOpen}
                onSync={activeSection === "unsynced" ? openSyncDialog : undefined}
                onDelete={activeSection === "unsynced" ? handleDeleteBook : undefined}
                showSyncActions={activeSection === "unsynced"}
                onBookClick={handleBookClick}
                selectedBookId={selectedBook?.id}
                onDragStart={handleBookDragStart}
                onDragEnd={handleBookDragEnd}
                selectionMode={selectedHashes.size > 0}
                selectedHashes={selectedHashes}
                selectedCount={selectedHashes.size}
                onToggleSelection={toggleSelection}
                onContextSelect={handleContextSelect}
                hasMore={hasMore}
                loadingMore={loadingMore}
                onLoadMore={fetchNextPage}
                topContent={bookGridTopContent}
                folders={unifiedLibraryView ? classifiedVisibleFolders.normal : undefined}
                onFolderSelect={unifiedLibraryView ? handleFolderSelect : undefined}
                selectedFolder={selectedFolder}
                draggingBookHashes={folderDragDrop.draggedBooks}
                onCreateFolder={openCreateFolderDialog}
                onImportBook={handleImportBook}
                onRenameFolder={openRenameFolderDialog}
                onDeleteFolder={openDeleteFolderDialog}
                onMoveBook={handleMoveBook}
                onMoveBooks={handleMoveBooks}
                onDropBooksOnBook={handleDropBooksOnBook}
              />
            )}
          </main>
        </div>

        {selectedBook && !kindlePanelOpen && rightPanelsAreDrawer && (
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/55"
            onClick={() => setSelectedBook(null)}
            aria-label="Fechar detalhes"
          />
        )}

        {selectedBook && !kindlePanelOpen && (
          <aside
            className={`lyceum-library-detail h-full overflow-hidden border-l border-zinc-800 bg-zinc-900 ${
              rightPanelsAreDrawer
                ? "fixed bottom-0 right-0 top-0 z-50 shadow-2xl"
                : "relative flex-shrink-0"
            }`}
            style={{
              flexBasis: rightPanelsAreDrawer ? undefined : detailPanelWidth,
              width: rightPanelsAreDrawer ? "min(92vw, 420px)" : detailPanelWidth,
              minWidth: rightPanelsAreDrawer ? 0 : 300,
              maxWidth: rightPanelsAreDrawer ? undefined : 760,
            }}
          >
            <button
              type="button"
              onPointerDown={(event) => startPaneResize("details", event)}
              className={`absolute -left-1 top-0 z-20 h-full w-3 cursor-col-resize bg-transparent hover:bg-green-500/70 ${
                rightPanelsAreDrawer ? "hidden" : ""
              }`}
              title="Redimensionar detalhes"
            />
            <div className="h-full overflow-y-auto">
            <BookDetailPanel
              book={selectedBook}
              onClose={() => setSelectedBook(null)}
              onOpenEmbed={async (bookToOpen = selectedBook) => {
                if (!bookToOpen.filePath) {
                  toast.error("Caminho do arquivo não encontrado");
                  return;
                }
                await handleOpen(bookToOpen.filePath, bookToOpen.fileHash);
              }}
              onOpenPreview={(bookToOpen = selectedBook) => {
                void handleOpenPreview(bookToOpen);
              }}
              onDelete={handleBookDeleted}
              onRefresh={handleBookRefresh}
              readOnly={activeSection === "usb"}
              previewOpen={readingPreviewOpen}
            />
            </div>
          </aside>
        )}

        {readingPreviewOpen && !kindlePanelOpen && rightPanelsAreDrawer && (
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/55"
            onClick={() => {
              setReadingPreviewOpen(false);
              setReadingPreviewTab(null);
            }}
            aria-label="Fechar previa"
          />
        )}

        {readingPreviewOpen && !kindlePanelOpen && (
          <LibraryReadingPreviewPane
            width={readingPreviewWidth}
            drawer={rightPanelsAreDrawer}
            incomingTab={readingPreviewTab}
            onIncomingTabConsumed={() => setReadingPreviewTab(null)}
            onClose={() => {
              setReadingPreviewOpen(false);
              setReadingPreviewTab(null);
            }}
            onResizeStart={(event) => startPaneResize("preview", event)}
          />
        )}

      {kindlePanelOpen && (
        <KindleSendPanel
          books={selectedConcreteBooks}
          onClose={() => setKindlePanelOpen(false)}
          onSent={refreshLibraryState}
        />
      )}
      </div>

      {createFolderDialog.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <form
            className="w-full max-w-md rounded-sm border border-zinc-800 bg-zinc-900 shadow-2xl"
            onSubmit={(event) => {
              event.preventDefault();
              confirmCreateFolder();
            }}
          >
            <div className="flex items-center gap-3 border-b border-zinc-800 px-4 py-3">
              <FolderOpen size={18} className="text-green-400" />
              <h2 className="text-sm font-semibold text-zinc-100">
                Nova pasta
              </h2>
            </div>

            <div className="space-y-3 p-4">
              <label className="block text-xs font-medium uppercase tracking-wide text-zinc-500">
                Nome da pasta
              </label>
              <input
                type="text"
                value={createFolderDialog.folderName}
                onChange={(event) =>
                  setCreateFolderDialog((current) => ({
                    ...current,
                    folderName: event.target.value,
                  }))
                }
                className="h-10 w-full rounded-sm border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-200 outline-none focus:border-green-500"
                autoFocus
              />
              <p className="text-xs text-zinc-600">
                Destino: {createFolderDialog.parentPath || "Biblioteca"}
              </p>
            </div>

            <div className="flex justify-end gap-2 border-t border-zinc-800 p-4">
              <button
                type="button"
                onClick={closeCreateFolderDialog}
                className="cursor-pointer rounded-sm px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="cursor-pointer rounded-sm bg-green-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-green-400"
              >
                Criar
              </button>
            </div>
          </form>
        </div>
      )}

      {collectionDialog.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <form
            className="w-full max-w-md rounded-sm border border-zinc-800 bg-zinc-900 shadow-2xl"
            onSubmit={(event) => {
              event.preventDefault();
              runCreateCollection();
            }}
          >
            <div className="flex items-center gap-3 border-b border-zinc-800 px-4 py-3">
              <Layers size={18} className="text-emerald-300" />
              <h2 className="text-sm font-semibold text-zinc-100">
                Nova colecao
              </h2>
            </div>

            <div className="space-y-3 p-4">
              <label className="block text-xs font-medium uppercase tracking-wide text-zinc-500">
                Nome da colecao
              </label>
              <input
                type="text"
                value={collectionDialog.name}
                onChange={(event) =>
                  setCollectionDialog((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                className="h-10 w-full rounded-sm border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-200 outline-none focus:border-green-500"
                autoFocus
              />
              <p className="text-xs text-zinc-600">
                {selectedBooks.length} item{selectedBooks.length !== 1 ? "s" : ""} selecionado{selectedBooks.length !== 1 ? "s" : ""}
              </p>
            </div>

            <div className="flex justify-end gap-2 border-t border-zinc-800 p-4">
              <button
                type="button"
                onClick={() => setCollectionDialog({ open: false, name: "" })}
                disabled={bulkBusy}
                className="cursor-pointer rounded-sm px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={bulkBusy || collectionDialog.name.trim().length === 0}
                className="cursor-pointer rounded-sm bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {bulkBusy ? "Criando..." : "Criar"}
              </button>
            </div>
          </form>
        </div>
      )}

      {folderActionDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <form
            className="w-full max-w-md rounded-sm border border-zinc-800 bg-zinc-900 shadow-2xl"
            onSubmit={(event) => {
              event.preventDefault();
              confirmFolderAction();
            }}
          >
            <div className="flex items-center gap-3 border-b border-zinc-800 px-4 py-3">
              {folderActionDialog.mode === "delete" ? (
                <Trash2 size={18} className="text-red-400" />
              ) : (
                <FolderOpen size={18} className="text-green-400" />
              )}
              <h2 className="text-sm font-semibold text-zinc-100">
                {folderActionDialog.mode === "delete"
                  ? "Excluir pasta"
                  : "Renomear pasta"}
              </h2>
            </div>

            <div className="space-y-3 p-4">
              {folderActionDialog.mode === "delete" ? (
                <>
                  <p className="text-sm text-zinc-400">
                    Tem certeza que deseja excluir a pasta{" "}
                    <span className="font-medium text-zinc-100">
                      "{folderActionDialog.folder.name}"
                    </span>
                    ?
                  </p>
                  <p className="text-xs text-zinc-600">
                    Esta pasta e todo o seu conteudo serao excluidos permanentemente.
                  </p>
                </>
              ) : (
                <>
                  <label className="block text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Nome da pasta
                  </label>
                  <input
                    type="text"
                    value={folderActionDialog.value}
                    onChange={(event) =>
                      setFolderActionDialog((current) =>
                        current
                          ? { ...current, value: event.target.value }
                          : current,
                      )
                    }
                    className="h-10 w-full rounded-sm border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-200 outline-none focus:border-green-500"
                    autoFocus
                  />
                </>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-zinc-800 p-4">
              <button
                type="button"
                onClick={closeFolderActionDialog}
                className="cursor-pointer rounded-sm px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className={`cursor-pointer rounded-sm px-4 py-2 text-sm font-medium ${
                  folderActionDialog.mode === "delete"
                    ? "bg-red-500 text-white hover:bg-red-400"
                    : "bg-green-500 text-zinc-950 hover:bg-green-400"
                }`}
              >
                {folderActionDialog.mode === "delete" ? "Excluir" : "Salvar"}
              </button>
            </div>
          </form>
        </div>
      )}

      <ImportBookDialog
        isOpen={importDialog.open}
        targetFolderName={importDialog.targetFolderName}
        onImport={handleImportConfirm}
        onClose={() =>
          setImportDialog({
            open: false,
            targetFolder: null,
            targetFolderName: "",
          })
        }
      />

      {confirmBulkDelete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-sm max-w-md w-full mx-4">
            <h3 className="text-base font-medium mb-2">Confirmar exclusão</h3>
            <p className="text-sm text-zinc-400 mb-4">
              Tem certeza que deseja remover {selectedBooks.length} livro{selectedBooks.length !== 1 ? "s" : ""} da biblioteca?
            </p>
            <label className="flex items-center gap-2 mb-4 text-sm text-zinc-300 cursor-pointer">
              <input
                type="checkbox"
                checked={bulkDeleteFileAlso}
                onChange={(e) => setBulkDeleteFileAlso(e.target.checked)}
                className="w-4 h-4 accent-green-500 cursor-pointer"
              />
              Também excluir arquivo{selectedBooks.length !== 1 ? "s" : ""} do disco
            </label>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setConfirmBulkDelete(false); setBulkDeleteFileAlso(false); }}
                className="cursor-pointer px-4 py-2 rounded-sm bg-zinc-800 hover:bg-zinc-700 text-sm transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={runBulkDelete}
                disabled={bulkBusy || selectedConcreteBooks.length === 0}
                className="cursor-pointer px-4 py-2 rounded-sm bg-red-600 hover:bg-red-500 text-zinc-800 text-sm font-medium transition-colors disabled:opacity-50"
              >
                {bulkBusy ? "Removendo..." : "Remover"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmMergeBooks && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-sm max-w-md w-full mx-4">
            <div className="mb-3 flex items-center gap-2">
              <GitMerge size={18} className="text-green-400" />
              <h3 className="text-base font-medium">Mesclar livros</h3>
            </div>
            <p className="text-sm text-zinc-400 mb-4">
              Os arquivos serao movidos para uma pasta iniciada por "_".
              A biblioteca mostrara essa pasta como um unico livro com variantes.
            </p>
            <div className="mb-4 rounded-sm border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-500">
              {selectedBooks.length} itens selecionados
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmMergeBooks(false)}
                disabled={bulkBusy}
                className="cursor-pointer px-4 py-2 rounded-sm bg-zinc-800 hover:bg-zinc-700 text-sm transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={runMergeBooks}
                disabled={bulkBusy || selectedConcreteBooks.length < 2}
                className="cursor-pointer px-4 py-2 rounded-sm bg-green-500 hover:bg-green-400 text-zinc-950 text-sm font-medium transition-colors disabled:opacity-50"
              >
                {bulkBusy ? "Mesclando..." : "Mesclar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {syncDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-sm border border-zinc-800 bg-zinc-900 shadow-2xl">
            <div className="flex items-center gap-3 border-b border-zinc-800 px-4 py-3">
              {syncDialog.action === "move" ? (
                <Move size={18} className="text-green-400" />
              ) : (
                <Copy size={18} className="text-green-400" />
              )}
              <h2 className="text-sm font-semibold text-zinc-100">
                {syncDialog.action === "move" ? "Mover" : "Copiar"} para a library
              </h2>
            </div>

            <div className="space-y-3 p-4">
              <label className="block text-xs font-medium uppercase tracking-wide text-zinc-500">
                Pasta destino
              </label>
              <select
                value={syncTargetFolder}
                onChange={(event) => setSyncTargetFolder(event.target.value)}
                className="h-10 w-full rounded-sm border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-200 outline-none focus:border-green-500"
              >
                <option value="">Raiz</option>
                {libraryFolders.map((folder) => (
                  <option key={folder} value={folder}>
                    {folder}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 border-t border-zinc-800 p-4">
              <button
                type="button"
                onClick={() => setSyncDialog(null)}
                className="cursor-pointer rounded-sm px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmSyncToLibrary}
                className="cursor-pointer rounded-sm bg-green-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-green-400"
              >
                {syncDialog.action === "move" ? "Mover" : "Copiar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Library() {
  return (
    <LibraryProvider>
      <LibraryContent />
    </LibraryProvider>
  );
}
