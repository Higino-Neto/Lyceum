import { useNavigate } from "react-router-dom";
import {
  useState,
  useEffect,
  useCallback,
  useDeferredValue,
  useMemo,
  useRef,
  type DragEvent as ReactDragEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  BookOpen,
  CheckSquare,
  Copy,
  FolderOpen,
  GitMerge,
  LayoutGrid,
  List,
  Move,
  PanelLeft,
  PanelLeftClose,
  RefreshCw,
  Send,
  Trash2,
  Usb,
  Unlink,
  X,
  Shuffle,
  CopyCheck,
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
import DuplicateFinderDialog from "./components/DuplicateFinderDialog";
import { getBookFiles } from "./components/BookGrid/bookFiles";
import type { SelectionModifiers } from "./components/BookGrid/selectionModifiers";
import useBooks from "./useBooks";
import ImportBookDialog from "../../components/ImportBookDialog";
import { BookWithThumbnail, FolderInfo, LibrarySection, ReadingStatus } from "../../types/LibraryTypes";
import toast from "react-hot-toast";
import {
  getBookFolderLabel,
  getFileTypeLabel,
  getFolderChildren,
  normalizeFolderPath,
  getTitleWithoutExtension,
} from "./utils";
import { useConversionQueue } from "../../contexts/ConversionQueueContext";
import { useTranslation } from "../../i18n";
import { useAppSettings } from "../../contexts/AppSettingsContext";
import { LibraryProvider, useLibraryContext } from "../../contexts/LibraryContext";
import { useFolderDragDrop } from "../../hooks/useFolderDragDrop";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import useMediaQuery from "../../hooks/useMediaQuery";
import type { ReadingLaunchState } from "../ReadingPage/ReadingPage";
import type { PdfRenderer } from "../ReadingPage/components/pdf-reader/pdfRenderer";
import { createBookDragPreview } from "./utils/bookDragPreview";
import { buildLibraryQuery } from "../../features/library/application/libraryQuery";
import {
  buildDisplayBooks,
  isAbsoluteFolderPath,
  pickRepresentativeBook,
  type MergedBookCacheEntry,
} from "../../features/library/model/libraryView";
import { useLibraryEvents } from "../../features/library/ui/useLibraryEvents";
import {
  needsReaderConversion,
  readerErrorKey,
  readerFormatLabel,
} from "../../features/library/model/readerFormats";
import Select from "../../components/ui/Select";
import { LIBRARY_STATUS_SELECT_OPTIONS } from "../../lib/readingStatus";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

interface UsbLibraryApi {
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
  readerErrorCode?: string;
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
      className="lyceum-library-recent-book lyceum-interactive-row flex min-w-[210px] max-w-[260px] cursor-pointer items-center gap-2 rounded-sm border border-border bg-surface/60 px-2 py-1.5 text-left transition-colors hover:border-border-strong hover:bg-surface"
    >
      <div className="flex h-9 w-7 flex-shrink-0 items-center justify-center overflow-hidden rounded-sm border border-border bg-background">
        {thumbnail ? (
          <img src={thumbnail} alt={book.title} className="h-full w-full object-contain" />
        ) : (
          <span className="text-[9px] font-medium text-foreground-subtle">
            {getFileTypeLabel(book.fileType, book.filePath)}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-foreground">
          {getTitleWithoutExtension(book.title, book.fileType)}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-foreground-subtle">
          {getBookFolderLabel(book.filePath)}
        </p>
      </div>
    </button>
  );
}

function LibraryContent() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { prepareBooks } = useConversionQueue();
  const { settings } = useAppSettings();
  const osReducedMotion = useReducedMotion();
  const reduceMotion = Boolean(osReducedMotion || settings.reducedEffects);
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
    moveBook: moveBookInLibrary,
  } = useLibraryContext();
  const electronApiAvailable = !!window.api?.listBooks;

  const [viewMode, setViewMode] = useLocalStorage<"grid" | "list">("library_viewMode", "grid");
  const [gridDensity, setGridDensity] = useLocalStorage<GridDensity>("library_gridDensity", "comfortable");
  const [search, setSearch] = useState("");
  const [folderGridCollapsed, setFolderGridCollapsed] = useLocalStorage("library_folderGridCollapsed", false);
  const searchWasActiveRef = useRef(false);
  const [sort, setSort] = useLocalStorage<SortOption>("library_sort", "title_asc");
  const [fileTypeFilter, setFileTypeFilter] = useState<FileTypeFilter[]>([]);
  // Eye filters: which statuses are visible in the grid. By default books
  // marked "not a book" and untouched books ("unknown") are hidden.
  const [visibleStatuses, setVisibleStatuses] = useLocalStorage<ReadingStatus[]>(
    "library_visibleStatuses",
    ["reading", "want_to_read", "read", "paused"],
  );
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
  const [folderBookCounts, setFolderBookCounts] = useState<Record<string, number>>({});
  const [globalRecentBooks, setGlobalRecentBooks] = useState<BookWithThumbnail[]>([]);
  const folderDragDrop = useFolderDragDrop();
  const externalBookDragRef = useRef<{
    hashes: string[];
    preview?: string;
    nativeStarted: boolean;
  } | null>(null);
  const mergedBookCacheRef = useRef(new Map<string, MergedBookCacheEntry>());
  // Selection always holds concrete files, never display items: a merged book
  // card is only a shortcut for "all of its files". Every bulk action, shortcut
  // and drag reads from here, so no action can treat a merged book differently.
  const [selectedFileMap, setSelectedFileMap] = useState<Map<string, BookWithThumbnail>>(
    new Map(),
  );
  const selectedHashes = useMemo(() => new Set(selectedFileMap.keys()), [selectedFileMap]);
  const selectedFiles = useMemo(() => Array.from(selectedFileMap.values()), [selectedFileMap]);
  const displayBooksRef = useRef<BookWithThumbnail[]>([]);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [confirmMergeBooks, setConfirmMergeBooks] = useState(false);
  const [duplicatesOpen, setDuplicatesOpen] = useState(false);
  const [bulkDeleteFileAlso, setBulkDeleteFileAlso] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkStatus, setBulkStatus] = useState("");
  const [cutBookHashes, setCutBookHashes] = useState<string[]>([]);
  const [copiedBookHashes, setCopiedBookHashes] = useState<string[]>([]);
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

  useEffect(() => {
    const searchIsActive = deferredSearch.trim().length > 0;
    if (searchIsActive && !searchWasActiveRef.current) {
      setFolderGridCollapsed(true);
    }
    searchWasActiveRef.current = searchIsActive;
  }, [deferredSearch, setFolderGridCollapsed]);

  const bookQuery = useMemo(
    () => buildLibraryQuery({
      section: activeSection,
      search: deferredSearch,
      sort,
      fileTypes: fileTypeFilter,
      selectedFolder,
      includeSubfolders: settings.showSubfolderBooks,
      visibleStatuses,
    }),
    [
      activeSection,
      deferredSearch,
      fileTypeFilter,
      selectedFolder,
      settings.showSubfolderBooks,
      sort,
      visibleStatuses,
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

  const loadFolderBookCounts = useCallback(async () => {
    if (!electronApiAvailable) return;
    try {
      setFolderBookCounts(await window.api.getFolderBookCounts());
    } catch (error) {
      console.error("Error loading folder book counts:", error);
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
        limit: 16,
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
      loadFolderBookCounts(),
      refreshFolders(),
      loadGlobalRecentBooks(),
    ]);
  }, [loadFolderBookCounts, loadGlobalRecentBooks, refreshBooks, refreshFolders]);

  useLibraryEvents({
    enabled: electronApiAvailable,
    refresh: refreshLibraryState,
  });

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

  // The folder tree is the primary library navigation. Always expose it on
  // desktop startup; drawer-sized layouts keep their non-obstructive default.
  useEffect(() => {
    if (!sidebarIsDrawer) setShowSidebar(true);
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
    setSelectedFileMap(new Map());
    folderDragDrop.clearDrag();
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
  }, [folderDragDrop, isSourceFolderPath, selectFolder, setActiveSection, setShowSidebar, sidebarIsDrawer, watchFolderPaths]);

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
    pdfRenderer?: PdfRenderer,
  ): Promise<ReadingLaunchState | null> => {
    const isUsbBook = activeSection === "usb";
    // First open of a MOBI/DOCX/CBZ... builds a cached EPUB; say so instead of looking stuck.
    const preparingToast = needsReaderConversion(filePath)
      ? toast.loading(t("library:reader.preparing", { format: readerFormatLabel(filePath) }))
      : null;
    let result: OpenBookResult | null;
    try {
      result = isUsbBook
        ? await (window.api as unknown as UsbLibraryApi).openUsbBook(filePath)
        : await window.api.reopenPdf(filePath, fileHash, filePath.toLowerCase().endsWith(".pdf"));
    } finally {
      if (preparingToast) toast.dismiss(preparingToast);
    }
    const readerError = readerErrorKey(result?.readerErrorCode);

    if (isUsbBook && result && "success" in result && !result.success) {
      toast.error(
        readerError
          ? t(readerError)
          : result.error === "Invalid file type"
            ? t("library:toasts.formatNotOpenable")
            : result.error || t("library:toasts.openFileFailed"),
      );
      return null;
    }

    if (!result) {
      toast.error(t("library:toasts.openFileFailed"));
      return null;
    }

    if ("error" in result) {
      toast.error(readerError ? t(readerError) : result.message || t("library:toasts.openFileFailed"));
      return null;
    }

    if (result.foundAt && result.foundAt !== filePath) {
      toast.success(t("library:toasts.bookFoundElsewhere"));
      refreshBooks();
    }

    const fileType =
      result.fileType === "epub" || filePath.toLowerCase().endsWith(".epub")
        ? "epub"
        : "pdf";

    return {
      fileBuffer: result.fileBuffer,
      fileHash: result.fileHash || fileHash || filePath,
      fileName: result.fileName || filePath.split(/[/\\]/).pop(),
      filePath: result.foundAt || result.filePath || filePath,
      fileType,
      pdfRenderer: fileType === "pdf" ? pdfRenderer : undefined,
      source: isUsbBook ? "local" : "library",
      navigationId: crypto.randomUUID(),
    };
  }, [activeSection, refreshBooks, t]);

  const handleOpen = useCallback(async (
    filePath: string,
    fileHash?: string,
    pdfRenderer?: PdfRenderer,
  ) => {
    const launchState = await openBookForReading(filePath, fileHash, pdfRenderer);
    if (!launchState) {
      return;
    }

    navigate("/reading", { state: launchState });
  }, [navigate, openBookForReading]);

  /** Opens the book as a `.lyceum` language-learning edition in /reading. */
  const handleOpenForLearning = useCallback((book: BookWithThumbnail) => {
    if (!book.filePath || !book.fileHash) {
      toast.error(t("library:toasts.filePathNotFound"));
      return;
    }
    const launchState: ReadingLaunchState = {
      fileHash: book.fileHash,
      fileName: book.title || book.filePath.split(/[/\\]/).pop(),
      filePath: book.filePath,
      fileType: "lyceum",
      source: "library",
      navigationId: crypto.randomUUID(),
    };
    navigate("/reading", { state: launchState });
  }, [navigate, t]);

  const handleOpenPreview = useCallback(async (book: BookWithThumbnail) => {
    if (readingPreviewOpen) {
      setReadingPreviewOpen(false);
      setReadingPreviewTab(null);
      return;
    }
    if (!book.filePath) {
      toast.error(t("library:toasts.filePathNotFound"));
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
  }, [openBookForReading, readingPreviewOpen, rightPanelsAreDrawer, t]);

  const handleBookClick = useCallback((book: BookWithThumbnail) => {
    setSelectedBook(book);
  }, []);

  const findFileByHash = useCallback((fileHash: string) => (
    selectedFileMap.get(fileHash) ||
    books.find((candidate) => candidate.fileHash === fileHash) ||
    displayBooksRef.current
      .flatMap(getBookFiles)
      .find((candidate) => candidate.fileHash === fileHash)
  ), [books, selectedFileMap]);

  const handleBookDeleted = useCallback(async (deletedFileHash: string) => {
    const bookId = selectedBook?.bookId;
    if (bookId) {
      const variants = ((await window.api.getDocumentsByBookId(bookId)) as BookWithThumbnail[])
        .filter((variant) => variant.fileHash !== deletedFileHash);
      if (variants.length > 0) {
        const representative = pickRepresentativeBook(variants)!;
        setSelectedBook({ ...representative, mergedBooks: variants.length > 1 ? variants : undefined });
        await refreshLibraryState();
        return;
      }
    }

    setSelectedBook(null);
    await refreshLibraryState();
  }, [refreshLibraryState, selectedBook]);

  const handleDeleteBook = useCallback(async (fileHash: string): Promise<boolean> => {
    const result = await window.api.deleteBook(fileHash, false);
    if (result.success) {
      await refreshLibraryState();
      return true;
    }
    toast.error(result.error || t("library:toasts.deleteBookFailed"));
    return false;
  }, [refreshLibraryState, t]);

  const handleRemoveVariant = useCallback(async (variant: BookWithThumbnail): Promise<boolean> => {
    const result = await window.api.removeBookFromGroup(variant.fileHash);
    if (!result.success) {
      toast.error(result.error || t("library:toasts.removeFromGroupFailed"));
      return false;
    }
    await refreshLibraryState();
    return true;
  }, [refreshLibraryState, t]);

  /** Moves exactly one file. Merged books move file by file through the selection. */
  const handleMoveBook = async (
    fileHash: string,
    targetFolder: string | null,
  ): Promise<boolean> => {
    const book = findFileByHash(fileHash);

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

      toast.error(result.error || t("library:toasts.moveToLibraryFailed"));
      return false;
    }

    const result = await moveBookInLibrary(fileHash, targetFolder);
    if (result.success) {
      return true;
    }

    toast.error(result.error || t("library:toasts.moveBookFailed"));
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

    for (const fileHash of Array.from(new Set(fileHashes))) {
      if (await handleMoveBook(fileHash, targetFolder)) moved++;
      else failed++;
    }

    await refreshLibraryState();

    if (moved > 0) {
      toast.success(t("library:toasts.booksMoved", { count: moved }));
    }
    if (failed > 0) {
      toast.error(t("library:toasts.itemsNotMoved", { count: failed }));
    }

    return failed === 0;
  };

  const mergeFiles = async (fileHashes: string[]): Promise<boolean> => {
    const uniqueHashes = Array.from(new Set(fileHashes.filter(Boolean)));
    if (uniqueHashes.length < 2) return false;
    setBulkBusy(true);
    try {
      const result = await window.api.mergeBooks(uniqueHashes);
      if (!result.success) {
        toast.error(result.error || t("library:toasts.mergeBooksFailed"));
        return false;
      }
      toast.success(t("library:toasts.filesMerged", { count: result.mergedCount || uniqueHashes.length }));
      await refreshLibraryState();
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("library:toasts.mergeBooksFailed"));
      return false;
    } finally {
      setBulkBusy(false);
    }
  };

  const handleDropBooksOnBook = async (
    targetBook: BookWithThumbnail,
    sourceFileHashes: string[],
  ) => {
    try {
      await mergeFiles([
        ...sourceFileHashes,
        ...getBookFiles(targetBook).map((file) => file.fileHash),
      ]);
    } finally {
      folderDragDrop.clearDrag();
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
      toast.error(t("library:toasts.folderNameRequired"));
      return;
    }

    const result = await createFolder(createFolderDialog.parentPath, folderName);

    if (result.success) {
      toast.success(t("library:toasts.folderCreated"));
      closeCreateFolderDialog();
    } else {
      toast.error(result.error || t("library:toasts.createFolderFailed"));
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

  const handleUnmergeBook = async (book: BookWithThumbnail) => {
    if (!book.bookId) {
      toast.error(t("library:toasts.mergeWithoutId"));
      return;
    }
    const result = await window.api.unmergeBooks(book.bookId);
    if (!result.success) {
      toast.error(result.error || t("library:toasts.undoMergeFailed"));
      return;
    }
    toast.success(t("library:toasts.filesKept", { count: result.documents?.length || 0 }));
    setSelectedBook(null);
    clearSelection();
    await refreshLibraryState();
  };

  const closeFolderActionDialog = () => {
    setFolderActionDialog(null);
  };

  const confirmFolderAction = async () => {
    if (!folderActionDialog) return;

    if (folderActionDialog.mode === "rename") {
      const newName = folderActionDialog.value.trim();
      if (!newName) {
        toast.error(t("library:toasts.folderNameRequired"));
        return;
      }

      const result = await renameFolder(
        folderActionDialog.folder.fullPath,
        newName,
      );

      if (result.success) {
        toast.success(t("library:toasts.folderRenamed"));
        closeFolderActionDialog();
      } else {
        toast.error(result.error || t("library:toasts.renameFolderFailed"));
      }
      return;
    }

    const result = await deleteFolder(
      folderActionDialog.folder.fullPath,
      true,
    );

    if (result.success) {
      toast.success(t("library:toasts.folderDeleted"));
      const selected = normalizeFolderPath(selectedFolder);
      const deleted = normalizeFolderPath(folderActionDialog.folder.path);
      if (selected === deleted || selected.startsWith(`${deleted}/`)) {
        handleFolderSelect(null);
      }
      closeFolderActionDialog();
    } else {
      toast.error(result.error || t("library:toasts.deleteFolderFailed"));
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
      toast.error(result.errors.join(", ") || t("library:toasts.importBookFailed"));
    }
  };

  const handleBookRefresh = async (preferredFileHash?: string) => {
    await refreshLibraryState();
    if (!selectedBook) return;

    if (selectedBook.bookId) {
      const variants = (await window.api.getDocumentsByBookId(selectedBook.bookId)) as BookWithThumbnail[];
      if (variants.length === 0) {
        setSelectedBook(null);
        return;
      }
      const representative = variants.find((variant) => variant.fileHash === preferredFileHash) || pickRepresentativeBook(variants);
      setSelectedBook({ ...representative, mergedBooks: variants.length > 1 ? variants : undefined });
      return;
    }

    const updatedBook = await window.api.getBookById(selectedBook.id);
    if (!updatedBook) {
      setSelectedBook(null);
      return;
    }
    const thumbnail = updatedBook.thumbnailPath
      ? await window.api.getThumbnail(updatedBook.thumbnailPath)
      : null;
    setSelectedBook({ ...updatedBook, thumbnail: thumbnail || undefined });
  };

  // Anchor for Shift+click range selection (the last book clicked/toggled).
  const selectionAnchorRef = useRef<string | null>(null);

  /** Adds every book between the anchor and `book` (in display order). */
  const selectRangeTo = useCallback((book: BookWithThumbnail) => {
    const ordered = displayBooksRef.current;
    const anchorHash = selectionAnchorRef.current;
    const anchorIndex = anchorHash ? ordered.findIndex((candidate) => candidate.fileHash === anchorHash) : -1;
    const targetIndex = ordered.findIndex((candidate) => candidate.fileHash === book.fileHash);
    const range = anchorIndex < 0 || targetIndex < 0
      ? [book]
      : ordered.slice(Math.min(anchorIndex, targetIndex), Math.max(anchorIndex, targetIndex) + 1);
    setSelectedFileMap((previous) => {
      const next = new Map(previous);
      for (const item of range) {
        for (const file of getBookFiles(item)) next.set(file.fileHash, file);
      }
      return next;
    });
  }, []);

  /**
   * Card click in selection mode (or with Ctrl/Shift held): Ctrl toggles the
   * book, Shift selects the range from the last anchor, a plain click toggles.
   */
  const toggleSelection = useCallback((book: BookWithThumbnail, modifiers?: SelectionModifiers) => {
    if (modifiers?.shiftKey) {
      if (!selectionAnchorRef.current && selectedBook) selectionAnchorRef.current = selectedBook.fileHash;
      selectRangeTo(book);
      return;
    }
    selectionAnchorRef.current = book.fileHash;
    const files = getBookFiles(book);
    setSelectedFileMap((previous) => {
      const next = new Map(previous);
      // Ctrl+click on the first book while another one is open in the detail
      // panel starts the selection with both of them.
      if (modifiers?.ctrlKey && next.size === 0 && selectedBook && selectedBook.fileHash !== book.fileHash) {
        for (const file of getBookFiles(selectedBook)) next.set(file.fileHash, file);
      }
      const allSelected = files.every((file) => next.has(file.fileHash));
      for (const file of files) {
        if (allSelected) next.delete(file.fileHash);
        else next.set(file.fileHash, file);
      }
      return next;
    });
  }, [selectRangeTo, selectedBook]);

  /** Format chip click: selects or clears exactly one file of a merged book. */
  const toggleFileSelection = useCallback((file: BookWithThumbnail) => {
    setSelectedFileMap((previous) => {
      const next = new Map(previous);
      if (next.has(file.fileHash)) next.delete(file.fileHash);
      else next.set(file.fileHash, file);
      return next;
    });
  }, []);

  const handleContextSelect = useCallback((book: BookWithThumbnail, modifiers?: SelectionModifiers) => {
    if (modifiers?.shiftKey) {
      selectRangeTo(book);
      return;
    }
    if (modifiers?.ctrlKey) {
      toggleSelection(book, modifiers);
      return;
    }
    selectionAnchorRef.current = book.fileHash;
    setSelectedFileMap((previous) => {
      const next = new Map(previous);
      for (const file of getBookFiles(book)) next.set(file.fileHash, file);
      return next;
    });
  }, [selectRangeTo, toggleSelection]);

  const handleBookDragStart = useCallback((fileHash: string) => {
    const displayBook = displayBooksRef.current.find((book) => book.fileHash === fileHash);
    const bookFiles = displayBook ? getBookFiles(displayBook) : [];
    const dragsSelection = bookFiles.some((file) => selectedHashes.has(file.fileHash));
    const concreteHashes = dragsSelection
      ? Array.from(selectedHashes)
      : bookFiles.map((file) => file.fileHash);
    if (concreteHashes.length === 0) {
      toast.error(t("library:toasts.noFileToDrag"));
      return;
    }
    folderDragDrop.startBookDrag(concreteHashes);
    externalBookDragRef.current = {
      hashes: concreteHashes,
      preview: createBookDragPreview(concreteHashes.length),
      nativeStarted: false,
    };
  }, [folderDragDrop, selectedHashes, t]);

  const handleBookDragMove = useCallback((event: ReactDragEvent<HTMLDivElement>) => {
    const session = externalBookDragRef.current;
    if (!session || session.nativeStarted) return;

    const inset = 3;
    const inside = event.clientX > inset && event.clientY > inset &&
      event.clientX < window.innerWidth - inset && event.clientY < window.innerHeight - inset;
    if (inside) {
      return;
    }

    // Chromium reports (0, 0) for a native drag that has already crossed the
    // window boundary on Linux. The previous edge heuristic then missed the
    // hand-off unless the preceding drag event happened near an edge.
    // `inside === false` is itself the reliable boundary signal.

    session.nativeStarted = true;
    event.preventDefault();
    void window.api.startBookFileDrag?.(session.hashes, session.preview)
      .then((result) => {
        if (!result.success && result.error) toast.error(result.error);
      })
      .finally(() => {
        externalBookDragRef.current = null;
        folderDragDrop.clearDrag();
      });
  }, [folderDragDrop]);

  const clearSelection = useCallback(() => {
    setSelectedFileMap(new Map());
    folderDragDrop.clearDrag();
  }, [folderDragDrop]);

  const handleBookDragEnd = useCallback(() => {
    externalBookDragRef.current = null;
    folderDragDrop.clearDrag();
  }, [folderDragDrop]);

  useEffect(() => {
    const handleClipboardShortcuts = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, [contenteditable='true']")) return;
      if (!(event.ctrlKey || event.metaKey)) return;

      const concreteHashes = Array.from(selectedHashes);
      if (event.key.toLowerCase() === "c" && concreteHashes.length > 0) {
        event.preventDefault();
        setCopiedBookHashes(concreteHashes);
        setCutBookHashes([]);
        void window.api.copyBookFiles?.(concreteHashes).then((result) => {
          if (result?.success) {
            toast.success(
              t("library:toasts.filesCopied", { count: result.count }),
            );
          }
          else if (result?.error) toast.error(result.error);
        });
      } else if (event.key.toLowerCase() === "x" && concreteHashes.length > 0) {
        event.preventDefault();
        setCutBookHashes(concreteHashes);
        setCopiedBookHashes([]);
        toast.success(
          t("library:toasts.itemsReadyToMove", { count: concreteHashes.length }),
        );
      } else if (event.key.toLowerCase() === "v" && cutBookHashes.length > 0) {
        event.preventDefault();
        void handleMoveBooks(cutBookHashes, selectedFolder).then((success) => {
          if (success) {
            setCutBookHashes([]);
            clearSelection();
          }
        });
      } else if (event.key.toLowerCase() === "v" && copiedBookHashes.length > 0) {
        event.preventDefault();
        void window.api.copyBooks(copiedBookHashes, selectedFolder).then(async (result) => {
          if (result.copied > 0) {
            toast.success(
              t("library:toasts.booksCopied", { count: result.copied }),
            );
            await refreshLibraryState();
          }
          if (result.failed > 0) {
            toast.error(result.error || t("library:toasts.someBooksNotCopied"));
          }
        });
      }
    };
    window.addEventListener("keydown", handleClipboardShortcuts);
    return () => window.removeEventListener("keydown", handleClipboardShortcuts);
  }, [
    clearSelection,
    copiedBookHashes,
    cutBookHashes,
    handleMoveBooks,
    refreshLibraryState,
    selectedHashes,
    selectedFolder,
    t,
  ]);
  const visibleFolders = useMemo(
    () =>
      activeSection === "usb"
        ? []
        : getFolderChildren(folderStructure, selectedFolder),
    [activeSection, folderStructure, selectedFolder],
  );
  const unifiedLibraryView = settings.unifiedLibraryView && activeSection !== "usb";

  const displayBooks = useMemo(() => {
    const result = buildDisplayBooks({
      section: activeSection,
      books,
      search: deferredSearch,
      fileTypes: fileTypeFilter,
      readingStatuses: visibleStatuses,
      sort,
      previousCache: mergedBookCacheRef.current,
    });
    mergedBookCacheRef.current = result.cache;
    return result.books;
  }, [
    activeSection,
    books,
    deferredSearch,
    fileTypeFilter,
    visibleStatuses,
    sort,
  ]);
  displayBooksRef.current = displayBooks;

  const bookGridBooks = displayBooks;

  const selectableDisplayBooks = bookGridBooks;

  const recentBooksSection = activeSection !== "usb" && settings.continueReadingEnabled !== false && globalRecentBooks.length > 0 ? (
    <section className="mb-4">
      <div className="mb-1.5 flex items-center justify-between">
        <h2 className="text-xs font-medium uppercase tracking-wide text-foreground-subtle">
          {t("library:page.continueReading")}
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
    <section className={unifiedLibraryView ? "mb-4" : "mb-5 border-b border-border pb-4"}>
      <FolderPathBar
        folders={folderStructure}
        selectedFolder={selectedFolder}
        onFolderSelect={handleFolderSelect}
        onCreateFolder={openCreateFolderDialog}
        onImportBook={handleImportBook}
      />
      {!unifiedLibraryView && settings.folderGridEnabled !== false && (
        <FolderGrid
          folders={visibleFolders}
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
          collapsed={folderGridCollapsed}
          onCollapsedChange={setFolderGridCollapsed}
        />
      )}
    </section>
  ) : null;

  const bookGridTopContent = (
    <>
      {folderExplorerSection}
      {recentBooksSection && (
        <div className="mb-4 border-b border-border pb-4">
          {recentBooksSection}
        </div>
      )}
    </>
  );

  useEffect(() => {
    if (kindlePanelOpen && selectedFiles.length === 0) {
      setKindlePanelOpen(false);
    }
  }, [kindlePanelOpen, selectedFiles.length]);

  const selectAllFiltered = () => {
    setSelectedFileMap(new Map(
      selectableDisplayBooks.flatMap(getBookFiles).map((file) => [file.fileHash, file]),
    ));
  };

  const openConversionWithSelection = () => {
    if (selectedFiles.length === 0) return;
    prepareBooks(selectedFiles);
    window.dispatchEvent(new CustomEvent("lyceum:open-conversion"));
  };

  const openKindlePanel = () => {
    if (selectedFiles.length === 0) return;
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
    toast.success(t("library:toasts.thumbnailsRegenerated", { count: generated }));
    if (failed > 0) {
      toast.error(t("library:toasts.thumbnailsFailed", { count: failed }));
    }
  };

  const runRegenerateAllThumbnails = async () => {
    if (!window.api?.regenerateAllThumbnails || regeneratingAllThumbnails) return;
    setRegeneratingAllThumbnails(true);
    try {
      const result = await window.api.regenerateAllThumbnails();
      toast.success(
        t("library:toasts.thumbnailsQueued", { count: result.queued }),
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("library:toasts.queueThumbnailsFailed"),
      );
    } finally {
      setRegeneratingAllThumbnails(false);
    }
  };

  const getSelectedFileHashes = () => Array.from(selectedHashes);

  // Applies one reading status to every selected book (and to every variant of
  // a merged book), so a right-click multi-selection can be reclassified at once.
  const handleBulkStatusChange = async (value: string) => {
    const status = value as ReadingStatus;
    const fileHashes = getSelectedFileHashes();
    if (fileHashes.length === 0) return;
    setBulkStatus("");
    setBulkBusy(true);
    try {
      let failed = 0;
      for (const fileHash of fileHashes) {
        const result = await window.api.updateReadingStatus(fileHash, status);
        if (result && result.success === false) failed++;
      }
      await refreshLibraryState();
      if (selectedBook) await handleBookRefresh();
      if (failed > 0) toast.error(t("library:detail.updateStatusFailed"));
      else toast.success(t("library:page.bulkStatusUpdated"));
    } catch {
      toast.error(t("library:detail.updateStatusFailed"));
    } finally {
      setBulkBusy(false);
    }
  };

  const runMergeBooks = async () => {
    if (selectedFiles.length < 2) return;
    if (await mergeFiles(getSelectedFileHashes())) {
      clearSelection();
      setSelectedBook(null);
      setConfirmMergeBooks(false);
    }
  };

  /** Detaches each selected file from its merged book; files stay where they are. */
  const runSeparateSelected = async () => {
    const groupedFiles = selectedFiles.filter((file) => file.bookId);
    if (groupedFiles.length === 0) return;
    setBulkBusy(true);
    let failed = 0;
    try {
      for (const file of groupedFiles) {
        const result = await window.api.removeBookFromGroup(file.fileHash);
        if (!result.success) failed++;
      }
      await refreshLibraryState();
      if (selectedBook) await handleBookRefresh();
      if (failed > 0) toast.error(t("library:toasts.removeFromGroupFailed"));
      else toast.success(t("library:toasts.filesSeparated", { count: groupedFiles.length }));
      clearSelection();
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
      toast.success(
        t("library:toasts.booksDeletedFromDisk", { count: removed }),
      );
    } else {
      toast.success(
        t("library:toasts.booksRemovedFromLibrary", { count: removed }),
      );
    }
    if (failed > 0) {
      toast.error(t("library:toasts.itemsNotRemoved", { count: failed }));
    }
  };

  if (!electronApiAvailable) {
    return (
      <div className="lyceum-page-library flex h-full min-h-0 items-center justify-center bg-background p-6 text-foreground">
        <div className="max-w-md rounded-sm border border-border bg-surface p-5 text-sm text-foreground">
          <h1 className="mb-2 text-base font-semibold text-foreground">
            {t("library:page.electronUnavailable")}
          </h1>
          <p className="text-foreground-muted">
            {t("library:page.electronUnavailableHint")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="lyceum-page-library relative flex h-full min-h-0 overflow-hidden bg-background p-1 text-foreground xs:p-2">
      {showSidebar && (
        <aside
          className={`lyceum-library-sidebar h-full overflow-hidden rounded-sm border border-border bg-overlay ${
            sidebarIsDrawer
              ? "fixed bottom-2 left-2 top-2 z-50 shadow-2xl"
              : "relative flex-shrink-0 bg-surface/50"
          }`}
          style={{ width: sidebarIsDrawer ? "min(88vw, 320px)" : sidebarWidth }}
        >
          <div className="h-full overflow-y-auto">
            <FolderTree
              selectedFolder={selectedFolder}
              onFolderSelect={handleFolderSelect}
              folderBookCounts={folderBookCounts}
              includeSubfolders={settings.showSubfolderBooks}
              onFoldersChanged={refreshLibraryState}
              onMoveBook={handleMoveBook}
              onMoveBooks={handleMoveBooks}
              draggingBookHashes={folderDragDrop.draggedBooks}
              onImportBook={handleImportBook}
              visibleStatuses={visibleStatuses}
              onToggleStatus={(status) => {
                setVisibleStatuses((current) =>
                  current.includes(status)
                    ? current.filter((value) => value !== status)
                    : [...current, status],
                );
              }}
            />
          </div>
          <button
            type="button"
            onPointerDown={(event) => startPaneResize("sidebar", event)}
            className={`absolute right-0 top-0 h-full w-1 cursor-col-resize bg-transparent hover:bg-primary-hover ${
              sidebarIsDrawer ? "hidden" : ""
            }`}
            title={t("library:page.resizeFoldersPanel")}
          />
        </aside>
      )}

      {showSidebar && sidebarIsDrawer && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-backdrop"
          onClick={() => setShowSidebar(false)}
          aria-label={t("library:page.closeFoldersPanel")}
        />
      )}

      <div
        data-library-shell
        className={`lyceum-library-shell flex h-full min-w-0 flex-1 overflow-hidden rounded-sm border border-border bg-background ${
          showSidebar && !sidebarIsDrawer ? "ml-2" : ""
        }`}
      >
        <div className="flex h-full min-w-0 flex-1 flex-col">
          <header className="flex flex-shrink-0 flex-col gap-3 border-b border-border px-2 py-3 sm:px-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
              <BookOpen size={20} className="text-foreground-muted" />
              <h1 className="text-base font-semibold tracking-tight">
                {t("library:page.title")}
              </h1>
              <span className="hidden text-foreground sm:inline">|</span>
              <span className="text-xs text-foreground-subtle sm:whitespace-nowrap">
                {t("library:page.volumes", {
                  count: counts.synced + counts.unsynced + counts.usb,
                })}
              </span>
              <SectionTabs
                activeSection={activeSection}
                onSectionChange={(section) => {
                  setActiveSection(section);
                  setSelectedFileMap(new Map());
                  setSelectedBook(null);
                  folderDragDrop.clearDrag();
                  setKindlePanelOpen(false);
                }}
                syncedCount={counts.synced}
                unsyncedCount={counts.unsynced}
                usbCount={counts.usb}
              />
            </div>

            <div className="flex min-w-0 flex-wrap items-center gap-2 xl:justify-end">
              <button
                onClick={() => setShowSidebar(!showSidebar)}
                className="cursor-pointer rounded-sm bg-surface-muted p-2 text-foreground-muted transition-colors hover:bg-border-strong"
                title={
                  showSidebar
                    ? t("library:page.hideFoldersPanel")
                    : t("library:page.showFoldersPanel")
                }
              >
                {showSidebar ? (
                  <PanelLeftClose size={18} />
                ) : (
                  <PanelLeft size={18} />
                )}
              </button>

              <button
                onClick={() => {
                  if (activeSection === "usb") {
                    (window.api as unknown as UsbLibraryApi).scanUsbBooks?.();
                    return;
                  }
                  void window.api.openLibraryFolder().catch(() => {
                    // The main process already surfaces open failures; ignore here.
                  });
                }}
                className="cursor-pointer rounded-sm bg-surface-muted p-2 text-foreground-muted transition-colors hover:bg-border-strong"
                title={
                  activeSection === "usb"
                    ? t("library:page.scanUsb")
                    : t("library:page.openLibraryFolder")
                }
              >
                {activeSection === "usb" ? (
                  <Usb size={18} />
                ) : (
                  <FolderOpen size={18} />
                )}
              </button>

              <div className="flex items-center rounded-sm border border-border bg-surface p-0.5">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`cursor-pointer rounded-sm p-1.5 ${
                    viewMode === "grid"
                      ? "bg-border-strong text-foreground"
                      : "text-foreground-subtle hover:text-foreground"
                  }`}
                  title={t("library:page.viewGrid")}
                >
                  <LayoutGrid size={14} />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`cursor-pointer rounded-sm p-1.5 ${
                    viewMode === "list"
                      ? "bg-border-strong text-foreground"
                      : "text-foreground-subtle hover:text-foreground"
                  }`}
                  title={t("library:page.viewList")}
                >
                  <List size={14} />
                </button>
              </div>

              {!compactHeader && (
              <div className="flex items-center rounded-sm border border-border bg-surface p-0.5">
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
                        ? "bg-border-strong text-foreground"
                        : "text-foreground-subtle hover:text-foreground"
                    }`}
                    title={t("library:page.densitySize", { label })}
                  >
                    {label}
                  </button>
                ))}
              </div>
              )}

              {activeSection !== "usb" && (
                <button
                  type="button"
                  onClick={() => setDuplicatesOpen(true)}
                  className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-sm border border-border bg-surface text-foreground-muted hover:bg-surface-muted hover:text-foreground"
                  title={t("library:duplicates.open")}
                  aria-label={t("library:duplicates.open")}
                >
                  <CopyCheck size={14} />
                </button>
              )}

              <button
                type="button"
                onClick={runRegenerateAllThumbnails}
                disabled={regeneratingAllThumbnails}
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-sm border border-border bg-surface text-foreground-muted hover:bg-surface-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                title={t("library:page.regenerateAllThumbnails")}
                aria-label={t("library:page.regenerateAllThumbnails")}
              >
                <RefreshCw size={14} className={regeneratingAllThumbnails ? "animate-spin" : ""} />
              </button>
            </div>
          </header>

          <main className="flex min-h-0 flex-1 flex-col overflow-hidden p-2 sm:p-4">
            <div className="flex-shrink-0 border-border">
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
              <div className="lyceum-selection-toolbar sticky top-0 z-20 mb-3 flex flex-wrap items-center gap-2 rounded-sm border border-border bg-overlay p-2.5 shadow-xl">
                <div className="flex items-center gap-2 text-sm text-foreground">
                  <CheckSquare size={16} className="text-primary" />
                  {t("library:page.selectedFiles", { count: selectedHashes.size })}
                </div>

                {activeSection !== "usb" && (
                  <div className="flex items-center gap-2 rounded-sm border border-border bg-surface px-2 py-0.5">
                    <span className="whitespace-nowrap text-xs text-foreground-subtle">
                      {t("library:sections.readingStatus")}
                    </span>
                    <Select
                      value={bulkStatus || undefined}
                      onChange={handleBulkStatusChange}
                      disabled={bulkBusy || selectedFiles.length === 0}
                      items={LIBRARY_STATUS_SELECT_OPTIONS.map((option) => ({
                        value: option.value,
                        label: t(option.labelKey),
                      }))}
                      placeholder={t("library:page.setStatus")}
                    />
                  </div>
                )}

                <button
                  onClick={selectAllFiltered}
                  className="flex items-center gap-2 cursor-pointer rounded-sm border border-border bg-surface-muted px-3 py-2 text-xs text-foreground"
                >
                  <LayoutGrid size={14} />
                  {t("library:page.selectAll")}
                </button>
                <button
                  onClick={openConversionWithSelection}
                  disabled={selectedFiles.length === 0}
                  className="flex cursor-pointer items-center gap-2 rounded-sm bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Shuffle size={14} />
                  {t("library:page.convert")}
                </button>
                {activeSection !== "usb" && (
                  <button
                    onClick={openKindlePanel}
                    disabled={selectedFiles.length === 0}
                    className="flex cursor-pointer items-center gap-2 rounded-sm bg-surface-muted px-3 py-2 text-xs text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Send size={14} />
                    Kindle
                  </button>
                )}
                {activeSection !== "usb" && (
                  <button
                    onClick={() => setConfirmMergeBooks(true)}
                    disabled={bulkBusy || selectedFiles.length < 2}
                    className="flex cursor-pointer items-center gap-2 rounded-sm bg-surface-muted px-3 py-2 text-xs text-foreground hover:bg-border-strong disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <GitMerge size={14} />
                    {t("library:page.merge")}
                  </button>
                )}
                {activeSection !== "usb" && selectedFiles.some((file) => file.bookId) && (
                  <button
                    onClick={runSeparateSelected}
                    disabled={bulkBusy}
                    title={t("library:page.separateHint")}
                    className="flex cursor-pointer items-center gap-2 rounded-sm bg-surface-muted px-3 py-2 text-xs text-foreground hover:bg-border-strong disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Unlink size={14} />
                    {t("library:page.separate")}
                  </button>
                )}
                  <button
                    onClick={runBulkRegenerateThumbnails}
                    disabled={bulkBusy || selectedFiles.length === 0}
                  className="flex cursor-pointer items-center gap-2 rounded-sm bg-surface-muted px-3 py-2 text-xs text-foreground hover:bg-border-strong disabled:opacity-50"
                >
                  <RefreshCw size={14} className={bulkBusy ? "animate-spin" : ""} />
                  {t("library:page.thumbnails")}
                </button>
                <button
                  onClick={() => setConfirmBulkDelete(true)}
                  disabled={bulkBusy}
                  className="flex cursor-pointer items-center gap-2 rounded-sm bg-destructive-muted px-3 py-2 text-xs text-destructive hover:bg-destructive-muted disabled:opacity-50"
                >
                  <Trash2 size={14} />
                  {t("common:actions.remove")}
                </button>
                <button
                  onClick={clearSelection}
                  className="ml-auto cursor-pointer rounded-sm p-2 text-foreground-subtle hover:bg-surface-muted hover:text-foreground"
                  title={t("library:page.exitSelection")}
                >
                  <X size={16} />
                </button>
              </div>
            )}

            {loading ? (
              <div className="flex min-h-0 flex-1 items-center justify-center gap-2 text-sm text-foreground-subtle">
                <RefreshCw size={16} className="animate-spin" />
                {t("library:page.loading")}
              </div>
            ) : (
              <BookGrid
                books={bookGridBooks}
                viewMode={viewMode}
                gridDensity={gridDensity}
                sort={activeSection === "usb" ? undefined : sort}
                onSortChange={activeSection === "usb" ? undefined : (nextSort) => setSort(nextSort as SortOption)}
                onOpen={handleOpen}
                onSync={activeSection === "unsynced" ? openSyncDialog : undefined}
                onDelete={activeSection === "unsynced" ? handleDeleteBook : undefined}
                showSyncActions={activeSection === "unsynced"}
                onBookClick={handleBookClick}
                selectedBookId={selectedBook?.id}
                onDragStart={handleBookDragStart}
                onDragMove={handleBookDragMove}
                onDragEnd={handleBookDragEnd}
                selectionMode={selectedHashes.size > 0}
                selectedHashes={selectedHashes}
                selectedCount={selectedHashes.size}
                onToggleSelection={toggleSelection}
                onContextSelect={handleContextSelect}
                onToggleFile={toggleFileSelection}
                hasMore={hasMore}
                loadingMore={loadingMore}
                onLoadMore={fetchNextPage}
                topContent={bookGridTopContent}
                folders={unifiedLibraryView ? visibleFolders : undefined}
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

        <AnimatePresence initial={false}>
        {selectedBook && !kindlePanelOpen && rightPanelsAreDrawer && (
          <motion.button
            type="button"
            className="fixed inset-0 z-40 bg-backdrop"
            onClick={() => setSelectedBook(null)}
            aria-label={t("library:page.closeDetails")}
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.16 }}
          />
        )}
        </AnimatePresence>

        <AnimatePresence initial={false}>
        {selectedBook && !kindlePanelOpen && (
          <motion.aside
            className={`lyceum-library-detail h-full overflow-hidden border-l border-border bg-surface ${
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
            initial={reduceMotion ? false : { opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 20 }}
            transition={reduceMotion
              ? { duration: 0 }
              : { type: "spring", stiffness: 420, damping: 36, mass: 0.8 }}
          >
            <button
              type="button"
              onPointerDown={(event) => startPaneResize("details", event)}
              className={`absolute -left-1 top-0 z-20 h-full w-3 cursor-col-resize bg-transparent hover:bg-primary-hover ${
                rightPanelsAreDrawer ? "hidden" : ""
              }`}
              title={t("library:page.resizeDetails")}
            />
            <div className="h-full overflow-y-auto">
            <BookDetailPanel
              book={selectedBook}
              onClose={() => setSelectedBook(null)}
              onOpenReader={async (bookToOpen = selectedBook) => {
                if (!bookToOpen.filePath) {
                  toast.error(t("library:toasts.filePathNotFound"));
                  return;
                }
                await handleOpen(
                  bookToOpen.filePath,
                  bookToOpen.fileHash,
                  bookToOpen.fileType === "pdf" ? "pdfjs" : undefined,
                );
              }}
              onOpenPreview={(bookToOpen = selectedBook) => {
                void handleOpenPreview(bookToOpen);
              }}
              onOpenLearning={activeSection === "usb" ? undefined : (bookToOpen = selectedBook) => {
                handleOpenForLearning(bookToOpen);
              }}
              onConvert={(bookToConvert) => {
                prepareBooks([bookToConvert]);
                window.dispatchEvent(new CustomEvent("lyceum:open-conversion"));
              }}
              onDelete={handleBookDeleted}
              onDissolve={handleUnmergeBook}
              onRemoveVariant={handleRemoveVariant}
              onRefresh={handleBookRefresh}
              readOnly={activeSection === "usb"}
              previewOpen={readingPreviewOpen}
            />
            </div>
          </motion.aside>
        )}
        </AnimatePresence>

        <AnimatePresence initial={false}>
        {readingPreviewOpen && !kindlePanelOpen && rightPanelsAreDrawer && (
          <motion.button
            type="button"
            className="fixed inset-0 z-40 bg-backdrop"
            onClick={() => {
              setReadingPreviewOpen(false);
              setReadingPreviewTab(null);
            }}
            aria-label={t("library:page.closePreview")}
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.16 }}
          />
        )}
        </AnimatePresence>

        <AnimatePresence initial={false}>
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
        </AnimatePresence>

      {kindlePanelOpen && (
        <KindleSendPanel
          books={selectedFiles}
          onClose={() => setKindlePanelOpen(false)}
          onSent={refreshLibraryState}
        />
      )}
      </div>

      {createFolderDialog.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-backdrop px-4">
          <form
            className="w-full max-w-md rounded-sm border border-border bg-surface shadow-2xl"
            onSubmit={(event) => {
              event.preventDefault();
              confirmCreateFolder();
            }}
          >
            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
              <FolderOpen size={18} className="text-primary" />
              <h2 className="text-sm font-semibold text-foreground">
                {t("library:page.newFolder")}
              </h2>
            </div>

            <div className="space-y-3 p-4">
              <label className="block text-xs font-medium uppercase tracking-wide text-foreground-subtle">
                {t("library:page.folderName")}
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
                className="h-10 w-full rounded-sm border border-border-strong bg-background px-3 text-sm text-foreground outline-none focus:border-primary"
                autoFocus
              />
              <p className="text-xs text-foreground-subtle">
                {t("library:page.destination", {
                  path: createFolderDialog.parentPath || t("library:page.title"),
                })}
              </p>
            </div>

            <div className="flex justify-end gap-2 border-t border-border p-4">
              <button
                type="button"
                onClick={closeCreateFolderDialog}
                className="cursor-pointer rounded-sm px-4 py-2 text-sm text-foreground-muted hover:bg-surface-muted hover:text-foreground"
              >
                {t("common:actions.cancel")}
              </button>
              <button
                type="submit"
                className="cursor-pointer rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
              >
                {t("library:page.create")}
              </button>
            </div>
          </form>
        </div>
      )}

      {folderActionDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-backdrop px-4">
          <form
            className="w-full max-w-md rounded-sm border border-border bg-surface shadow-2xl"
            onSubmit={(event) => {
              event.preventDefault();
              confirmFolderAction();
            }}
          >
            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
              {folderActionDialog.mode === "delete" ? (
                <Trash2 size={18} className="text-destructive" />
              ) : (
                <FolderOpen size={18} className="text-primary" />
              )}
              <h2 className="text-sm font-semibold text-foreground">
                {folderActionDialog.mode === "delete"
                  ? t("library:page.deleteFolder")
                  : t("library:page.renameFolder")}
              </h2>
            </div>

            <div className="space-y-3 p-4">
              {folderActionDialog.mode === "delete" ? (
                <>
                  <p className="text-sm text-foreground-muted">
                    {t("library:page.deleteFolderConfirm", {
                      name: folderActionDialog.folder.name,
                    })}
                  </p>
                  <p className="text-xs text-foreground-subtle">
                    {t("library:page.deleteFolderWarning")}
                  </p>
                </>
              ) : (
                <>
                  <label className="block text-xs font-medium uppercase tracking-wide text-foreground-subtle">
                    {t("library:page.folderName")}
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
                    className="h-10 w-full rounded-sm border border-border-strong bg-background px-3 text-sm text-foreground outline-none focus:border-primary"
                    autoFocus
                  />
                </>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-border p-4">
              <button
                type="button"
                onClick={closeFolderActionDialog}
                className="cursor-pointer rounded-sm px-4 py-2 text-sm text-foreground-muted hover:bg-surface-muted hover:text-foreground"
              >
                {t("common:actions.cancel")}
              </button>
              <button
                type="submit"
                className={`cursor-pointer rounded-sm px-4 py-2 text-sm font-medium ${
                  folderActionDialog.mode === "delete"
                    ? "bg-destructive text-destructive-foreground hover:bg-destructive-hover"
                    : "bg-primary text-primary-foreground hover:bg-primary-hover"
                }`}
              >
                {folderActionDialog.mode === "delete"
                  ? t("common:actions.delete")
                  : t("common:actions.save")}
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

      <DuplicateFinderDialog
        open={duplicatesOpen}
        onClose={() => setDuplicatesOpen(false)}
        onLibraryChanged={refreshLibraryState}
      />

      {confirmBulkDelete && (
        <div className="fixed inset-0 bg-backdrop flex items-center justify-center z-50">
          <div className="bg-surface border border-border p-6 rounded-sm max-w-md w-full mx-4">
            <h3 className="text-base font-medium mb-2">
              {t("library:page.confirmDelete")}
            </h3>
            <p className="text-sm text-foreground-muted mb-4">
              {t("library:page.removeFromLibraryBody", {
                count: selectedFiles.length,
              })}
            </p>
            <label className="flex items-center gap-2 mb-4 text-sm text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={bulkDeleteFileAlso}
                onChange={(e) => setBulkDeleteFileAlso(e.target.checked)}
                className="w-4 h-4 accent-primary cursor-pointer"
              />
              {t("library:page.deleteFilesAlso", { count: selectedFiles.length })}
            </label>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setConfirmBulkDelete(false); setBulkDeleteFileAlso(false); }}
                className="cursor-pointer px-4 py-2 rounded-sm bg-surface-muted hover:bg-border-strong text-sm transition-colors"
              >
                {t("common:actions.cancel")}
              </button>
              <button
                onClick={runBulkDelete}
                disabled={bulkBusy || selectedFiles.length === 0}
                className="cursor-pointer px-4 py-2 rounded-sm bg-destructive hover:bg-destructive-hover text-destructive-foreground text-sm font-medium transition-colors disabled:opacity-50"
              >
                {bulkBusy
                  ? t("library:page.removing")
                  : t("common:actions.remove")}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmMergeBooks && (
        <div className="fixed inset-0 bg-backdrop flex items-center justify-center z-50">
          <div className="bg-surface border border-border p-6 rounded-sm max-w-md w-full mx-4">
            <div className="mb-3 flex items-center gap-2">
              <GitMerge size={18} className="text-primary" />
              <h3 className="text-base font-medium">
                {t("library:books.mergeBooks")}
              </h3>
            </div>
            <p className="text-sm text-foreground-muted mb-4">
              {t("library:page.mergeBooksBody")}
            </p>
            <div className="mb-4 rounded-sm border border-border bg-background px-3 py-2 text-xs text-foreground-subtle">
              {t("library:page.selectedFiles", { count: selectedFiles.length })}
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmMergeBooks(false)}
                disabled={bulkBusy}
                className="cursor-pointer px-4 py-2 rounded-sm bg-surface-muted hover:bg-border-strong text-sm transition-colors disabled:opacity-50"
              >
                {t("common:actions.cancel")}
              </button>
              <button
                onClick={runMergeBooks}
                disabled={bulkBusy || selectedFiles.length < 2}
                className="cursor-pointer px-4 py-2 rounded-sm bg-primary hover:bg-primary-hover text-primary-foreground text-sm font-medium transition-colors disabled:opacity-50"
              >
                {bulkBusy ? t("library:page.merging") : t("library:page.merge")}
              </button>
            </div>
          </div>
        </div>
      )}

      {syncDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-backdrop px-4">
          <div className="w-full max-w-md rounded-sm border border-border bg-surface shadow-2xl">
            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
              {syncDialog.action === "move" ? (
                <Move size={18} className="text-primary" />
              ) : (
                <Copy size={18} className="text-primary" />
              )}
              <h2 className="text-sm font-semibold text-foreground">
                {syncDialog.action === "move"
                  ? t("library:page.moveToLibrary")
                  : t("library:page.copyToLibrary")}
              </h2>
            </div>

            <div className="space-y-3 p-4">
              <label className="block text-xs font-medium uppercase tracking-wide text-foreground-subtle">
                {t("library:page.destinationFolder")}
              </label>
              <Select value={syncTargetFolder} onChange={setSyncTargetFolder} className="h-10 w-full text-sm" items={[{ value: "", label: t("library:page.root") }, ...libraryFolders.map((folder) => ({ value: folder, label: folder }))]} />
            </div>

            <div className="flex justify-end gap-2 border-t border-border p-4">
              <button
                type="button"
                onClick={() => setSyncDialog(null)}
                className="cursor-pointer rounded-sm px-4 py-2 text-sm text-foreground-muted hover:bg-surface-muted hover:text-foreground"
              >
                {t("common:actions.cancel")}
              </button>
              <button
                type="button"
                onClick={confirmSyncToLibrary}
                className="cursor-pointer rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
              >
                {syncDialog.action === "move"
                  ? t("library:page.move")
                  : t("library:page.copy")}
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
