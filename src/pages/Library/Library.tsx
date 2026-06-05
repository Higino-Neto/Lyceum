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
  SectionTabs,
  SortOption,
} from "./components";
import BookGrid, { type GridDensity } from "./components/BookGrid";
import KindleSendPanel from "./components/KindleSendPanel";
import useBooks from "./useBooks";
import ImportBookDialog from "../../components/ImportBookDialog";
import { BookWithThumbnail, FolderInfo, LibrarySection, WatchFolderInfo } from "../../types/LibraryTypes";
import toast from "react-hot-toast";
import { DocumentRecord } from "../../types/ReadingTypes";
import {
  getBookFolderLabel,
  getFileTypeLabel,
  getFolderChildren,
  normalizeFolderPath,
  getTitleWithoutExtension,
} from "./utils";
import { useConversionQueue } from "../../contexts/ConversionQueueContext";
import { useAppSettings } from "../../contexts/AppSettingsContext";

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

export default function Library() {
  const navigate = useNavigate();
  const { prepareBooks } = useConversionQueue();
  const { settings } = useAppSettings();
  const electronApiAvailable = !!window.api?.listBooks;

  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [gridDensity, setGridDensity] = useState<GridDensity>("comfortable");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("title_asc");
  const [fileTypeFilter, setFileTypeFilter] = useState<FileTypeFilter>("all");
  const [activeSection, setActiveSection] = useState<LibrarySection>("synced");

  const [selectedBook, setSelectedBook] = useState<BookWithThumbnail | null>(
    null,
  );
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const [detailPanelWidth, setDetailPanelWidth] = useState(320);
  const [localDocuments, setLocalDocuments] = useState<DocumentRecord[]>([]);
  const [libraryFolders, setLibraryFolders] = useState<string[]>([]);
  const [folderStructure, setFolderStructure] = useState<FolderInfo[]>([]);
  const [watchFolderPaths, setWatchFolderPaths] = useState<Set<string>>(new Set());
  const [globalRecentBooks, setGlobalRecentBooks] = useState<BookWithThumbnail[]>([]);
  const [draggingBookHashes, setDraggingBookHashes] = useState<string[]>([]);
  const [selectedHashes, setSelectedHashes] = useState<Set<string>>(new Set());
  const [selectedBookMap, setSelectedBookMap] = useState<Map<string, BookWithThumbnail>>(
    new Map(),
  );
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [confirmMergeBooks, setConfirmMergeBooks] = useState(false);
  const [bulkDeleteFileAlso, setBulkDeleteFileAlso] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
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

  const bookQuery = useMemo(
    () => ({
      section: activeSection,
      search: deferredSearch,
      sort,
      fileType: fileTypeFilter,
      folderPath: activeSection === "usb" ? null : selectedFolder ?? "",
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

  const loadLibraryFolders = useCallback(async () => {
    if (!electronApiAvailable) return;
    try {
      const [structure, folders] = await Promise.all([
        window.api.getFolderStructure(),
        window.api.getAllFolders(),
      ]);
      setFolderStructure(
        structure.filter((folder: FolderInfo) => !folder.name.startsWith(".")),
      );
      setLibraryFolders(folders);
    } catch (error) {
      console.error("Error loading library folders:", error);
    }
  }, [electronApiAvailable]);

  const loadWatchFolderPaths = useCallback(async () => {
    if (!electronApiAvailable || !window.api.getWatchFolders) return;
    try {
      const folders = await window.api.getWatchFolders();
      setWatchFolderPaths(new Set(folders.map((wf: WatchFolderInfo) => wf.path)));
    } catch (error) {
      console.error("Error loading watch folder paths:", error);
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
      loadLibraryFolders(),
      loadGlobalRecentBooks(),
      loadWatchFolderPaths(),
    ]);
  }, [loadGlobalRecentBooks, loadLibraryFolders, loadLocalDocs, loadWatchFolderPaths, refreshBooks]);

  useEffect(() => {
    if (!electronApiAvailable || !window.api.onLibraryUpdated) return;
    const unsubscribe = window.api.onLibraryUpdated(refreshLibraryState);
    return () => unsubscribe();
  }, [electronApiAvailable, refreshLibraryState]);

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

  const handleFolderSelect = useCallback((folderPath: string | null) => {
    setSelectedFolder(folderPath);
    setSelectedBook(null);
    setKindlePanelOpen(false);
    if (folderPath && watchFolderPaths.has(folderPath)) {
      setActiveSection("unsynced");
    } else if (folderPath === null) {
      const isWatchRoot = watchFolderPaths.size > 0;
      if (!isWatchRoot) setActiveSection("synced");
    }
  }, [watchFolderPaths]);

  const startPaneResize = (
    pane: "sidebar" | "details",
    event: ReactPointerEvent,
  ) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const startX = event.clientX;
    const startWidth = pane === "sidebar" ? sidebarWidth : detailPanelWidth;
    const shellRect =
      document.querySelector("[data-library-shell]")?.getBoundingClientRect() ??
      document.body.getBoundingClientRect();
    const minWidth = pane === "sidebar" ? 220 : 300;
    const maxWidth = pane === "sidebar"
      ? 420
      : Math.max(360, Math.min(760, shellRect.width - 420));
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handleMove = (moveEvent: PointerEvent) => {
      const nextWidth = pane === "details"
        ? Math.min(maxWidth, Math.max(minWidth, shellRect.right - moveEvent.clientX))
        : Math.min(
            maxWidth,
            Math.max(minWidth, startWidth + moveEvent.clientX - startX),
          );

      if (pane === "sidebar") {
        setSidebarWidth(nextWidth);
      } else {
        setDetailPanelWidth(nextWidth);
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

  const handleOpen = async (filePath: string, fileHash?: string) => {
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
      return;
    }

    if (!result) {
      toast.error("Erro ao abrir o arquivo");
      return;
    }

    if ("error" in result) {
      toast.error(result.message || "Erro ao abrir o arquivo");
      return;
    }

    if (result.foundAt && result.foundAt !== filePath) {
      toast.success("Livro encontrado em nova localização");
      refreshBooks();
    }

    navigate("/reading", {
      state: {
        fileBuffer: result.fileBuffer,
        fileHash: result.fileHash,
        fileName: result.fileName || filePath.split(/[/\\]/).pop(),
        filePath: result.foundAt || result.filePath || filePath,
        fileType:
          result.fileType ||
          (filePath.toLowerCase().endsWith(".epub") ? "epub" : "pdf"),
        source: isUsbBook ? "local" : "library",
        navigationId: crypto.randomUUID(),
      },
    });
  };

  const handleBookClick = (book: BookWithThumbnail) => {
    setSelectedBook(book);
  };

  const handleBookDeleted = () => {
    setSelectedBook(null);
    refreshLibraryState();
  };

  const handleDeleteBook = async (fileHash: string): Promise<boolean> => {
    const result = await window.api.deleteBook(fileHash, false);
    if (result.success) {
      await refreshLibraryState();
      return true;
    }
    toast.error(result.error || "Erro ao remover livro");
    return false;
  };

  const handleMoveBook = async (
    fileHash: string,
    targetFolder: string | null,
  ): Promise<boolean> => {
    const book = books.find(
      (candidate) => candidate.fileHash === fileHash,
    );

    if (book && book.isSynced !== 1) {
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

    const result = await window.api.moveBook(fileHash, targetFolder);
    if (result.success) {
      await refreshLibraryState();
      return true;
    }

    toast.error(result.error || "Erro ao mover livro");
    return false;
  };

  const openSyncDialog = (fileHash: string, action: "move" | "copy") => {
    setSyncTargetFolder(selectedFolder || libraryFolders[0] || "");
    setSyncDialog({ fileHash, action });
  };

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

    for (const fileHash of fileHashes) {
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

    const result = await window.api.createFolder(
      folderName,
      createFolderDialog.parentPath,
    );

    if (result.success) {
      toast.success("Pasta criada");
      closeCreateFolderDialog();
      await refreshLibraryState();
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
      const newName = folderActionDialog.value.trim();
      if (!newName) {
        toast.error("Informe o nome da pasta");
        return;
      }

      const result = await window.api.renameFolder(
        folderActionDialog.folder.fullPath,
        newName,
      );

      if (result.success) {
        toast.success("Pasta renomeada");
        closeFolderActionDialog();
        await refreshLibraryState();
      } else {
        toast.error(result.error || "Erro ao renomear pasta");
      }
      return;
    }

    const result = await window.api.deleteFolder(
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
      await refreshLibraryState();
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

  const toggleSelection = (book: BookWithThumbnail) => {
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
  };

  const handleContextSelect = (book: BookWithThumbnail) => {
    setSelectedHashes((previous) => new Set(previous).add(book.fileHash));
    setSelectedBookMap((previous) => new Map(previous).set(book.fileHash, book));
  };

  const handleBookDragStart = (fileHash: string) => {
    if (selectedHashes.has(fileHash)) {
      setDraggingBookHashes(Array.from(selectedHashes));
      return;
    }

    setDraggingBookHashes([fileHash]);
  };

  const clearSelection = () => {
    setSelectedHashes(new Set());
    setSelectedBookMap(new Map());
    setDraggingBookHashes([]);
  };

  const selectedBooks = useMemo(
    () => Array.from(selectedBookMap.values()),
    [selectedBookMap],
  );
  const visibleFolders = useMemo(
    () =>
      activeSection === "usb"
        ? []
        : getFolderChildren(folderStructure, selectedFolder),
    [activeSection, folderStructure, selectedFolder],
  );

  const displayBooks = useMemo(() => {
    if (activeSection === "usb") return books;

    const grouped = new Map<string, BookWithThumbnail[]>();
    const orderedKeys: string[] = [];

    for (const book of books) {
      const groupKey = book.bookId || book.fileHash;
      if (!grouped.has(groupKey)) {
        grouped.set(groupKey, []);
        orderedKeys.push(groupKey);
      }
      grouped.get(groupKey)?.push(book);
    }

    return orderedKeys.map((groupKey) => {
      const group = grouped.get(groupKey) || [];
      const representative =
        group.find((book) => book.thumbnailPath && (book.fileType === "epub" || book.fileType === "pdf")) ||
        group.find((book) => book.fileType === "epub" || book.fileType === "pdf") ||
        group.find((book) => book.thumbnailPath) ||
        group.find((book) => book.fileType === "epub") ||
        group[0];
      return group.length > 1
        ? { ...representative, mergedBooks: group }
        : representative;
    });
  }, [activeSection, books]);

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
    <section className="mb-5 border-b border-zinc-800 pb-4">
      <FolderPathBar
        folders={folderStructure}
        selectedFolder={selectedFolder}
        onFolderSelect={handleFolderSelect}
        onCreateFolder={openCreateFolderDialog}
        onImportBook={handleImportBook}
      />
      <FolderGrid
        folders={visibleFolders}
        onFolderSelect={handleFolderSelect}
        books={displayBooks}
        selectedFolder={selectedFolder}
        draggingBookHashes={draggingBookHashes}
        onCreateFolder={openCreateFolderDialog}
        onImportBook={handleImportBook}
        onRenameFolder={openRenameFolderDialog}
        onDeleteFolder={openDeleteFolderDialog}
        onMoveBook={handleMoveBook}
        onMoveBooks={handleMoveBooks}
      />
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
    if (kindlePanelOpen && selectedBooks.length === 0) {
      setKindlePanelOpen(false);
    }
  }, [kindlePanelOpen, selectedBooks.length]);

  const selectAllFiltered = () => {
    setSelectedHashes(new Set(displayBooks.map((book) => book.fileHash)));
    setSelectedBookMap(new Map(displayBooks.map((book) => [book.fileHash, book])));
  };

  const openConversionWithSelection = () => {
    if (selectedBooks.length === 0) return;
    prepareBooks(selectedBooks);
    navigate("/conversion");
  };

  const openKindlePanel = () => {
    if (selectedBooks.length === 0) return;
    setSelectedBook(null);
    setKindlePanelOpen(true);
  };

  const runBulkRegenerateThumbnails = async () => {
    if (selectedHashes.size === 0) return;
    setBulkBusy(true);
    let generated = 0;
    let failed = 0;

    for (const fileHash of selectedHashes) {
      const result = await window.api.regenerateThumbnail(fileHash);
      if (result.success) generated++;
      else failed++;
    }

    setBulkBusy(false);
    await refreshLibraryState();
    toast.success(`${generated} thumbnail${generated !== 1 ? "s" : ""} regenerada${generated !== 1 ? "s" : ""}`);
    if (failed > 0) toast.error(`${failed} thumbnail${failed !== 1 ? "s" : ""} com erro`);
  };

  const runMergeBooks = async () => {
    if (selectedBooks.length < 2) return;
    setBulkBusy(true);
    try {
      const fileHashes = Array.from(
        new Set(
          selectedBooks.flatMap((book) =>
            book.mergedBooks?.length
              ? book.mergedBooks.map((variant) => variant.fileHash)
              : [book.fileHash],
          ),
        ),
      );
      const result = await window.api.mergeBooks(fileHashes);
      if (result.success) {
        toast.success(
          `${result.mergedCount} arquivo${result.mergedCount !== 1 ? "s" : ""} mesclado${result.mergedCount !== 1 ? "s" : ""} como um livro`,
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

  const runBulkDelete = async () => {
    setBulkBusy(true);
    let removed = 0;
    let failed = 0;

    for (const fileHash of selectedHashes) {
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
    <div className="lyceum-page-library flex h-full min-h-0 overflow-hidden bg-zinc-950 p-2 text-zinc-100">
      {showSidebar && (
        <aside className="lyceum-library-sidebar relative h-full flex-shrink-0 overflow-hidden rounded-sm border border-zinc-800 bg-zinc-900/50"
          style={{ width: sidebarWidth }}
        >
          <div className="h-full overflow-y-auto">
            <FolderTree
              selectedFolder={selectedFolder}
              onFolderSelect={handleFolderSelect}
              localDocuments={localDocuments}
              folderStructure={folderStructure}
              includeSubfolders={settings.showSubfolderBooks}
              onFoldersChanged={refreshLibraryState}
              onMoveBook={handleMoveBook}
              onMoveBooks={handleMoveBooks}
              draggingBookHashes={draggingBookHashes}
              onImportBook={handleImportBook}
            />
          </div>
          <button
            type="button"
            onPointerDown={(event) => startPaneResize("sidebar", event)}
            className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-transparent hover:bg-green-500/70"
            title="Redimensionar painel de pastas"
          />
        </aside>
      )}

      <div
        data-library-shell
        className="lyceum-library-shell ml-2 flex h-full min-w-0 flex-1 overflow-hidden rounded-sm border border-zinc-800 bg-zinc-950"
      >
        <div className="flex h-full min-w-0 flex-1 flex-col">
          <header className="flex flex-shrink-0 items-center justify-between gap-4 border-b border-zinc-800 px-4 py-3">
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <BookOpen size={20} className="text-zinc-400" />
              <h1 className="text-base font-semibold tracking-tight">Biblioteca</h1>
              <span className="text-zinc-700">|</span>
              <span className="text-xs text-zinc-500">
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

            <div className="flex items-center gap-2">
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
            </div>
          </header>

          <main className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
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
                  disabled={selectedBooks.length === 0}
                  className="flex cursor-pointer items-center gap-2 rounded-sm bg-green-500 px-3 py-2 text-xs font-medium text-zinc-950 hover:bg-green-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Send size={14} />
                  Converter
                </button>
                {activeSection !== "usb" && (
                  <button
                    onClick={openKindlePanel}
                    disabled={selectedBooks.length === 0}
                    className="flex cursor-pointer items-center gap-2 rounded-sm border border-green-500/50 bg-green-500/10 px-3 py-2 text-xs font-medium text-green-200 hover:bg-green-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Usb size={14} />
                    Enviar para Kindle
                  </button>
                )}
                {activeSection !== "usb" && (
                  <button
                    onClick={() => setConfirmMergeBooks(true)}
                    disabled={bulkBusy || selectedBooks.length < 2}
                    className="flex cursor-pointer items-center gap-2 rounded-sm border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <GitMerge size={14} />
                    Mesclar livros
                  </button>
                )}
                <button
                  onClick={runBulkRegenerateThumbnails}
                  disabled={bulkBusy}
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
                books={displayBooks}
                viewMode={viewMode}
                gridDensity={gridDensity}
                onOpen={handleOpen}
                onSync={activeSection === "unsynced" ? openSyncDialog : undefined}
                onDelete={activeSection === "unsynced" ? handleDeleteBook : undefined}
                showSyncActions={activeSection === "unsynced"}
                onBookClick={handleBookClick}
                selectedBookId={selectedBook?.id}
                onDragStart={handleBookDragStart}
                onDragEnd={() => setDraggingBookHashes([])}
                selectionMode={selectedHashes.size > 0}
                selectedHashes={selectedHashes}
                selectedCount={selectedHashes.size}
                onToggleSelection={toggleSelection}
                onContextSelect={handleContextSelect}
                hasMore={hasMore}
                loadingMore={loadingMore}
                onLoadMore={fetchNextPage}
                topContent={bookGridTopContent}
              />
            )}
          </main>
        </div>

        {selectedBook && !kindlePanelOpen && (
          <aside className="lyceum-library-detail relative h-full flex-shrink-0 overflow-hidden border-l border-zinc-800 bg-zinc-900"
            style={{
              flexBasis: detailPanelWidth,
              width: detailPanelWidth,
              minWidth: 300,
              maxWidth: 760,
            }}
          >
            <button
              type="button"
              onPointerDown={(event) => startPaneResize("details", event)}
              className="absolute -left-1 top-0 z-20 h-full w-3 cursor-col-resize bg-transparent hover:bg-green-500/70"
              title="Redimensionar detalhes"
            />
            <div className="h-full overflow-y-auto">
            <BookDetailPanel
              book={selectedBook}
              onClose={() => setSelectedBook(null)}
              onOpenEmbed={async () => {
                if (!selectedBook.filePath) {
                  toast.error("Caminho do arquivo não encontrado");
                  return;
                }
                await handleOpen(selectedBook.filePath, selectedBook.fileHash);
              }}
              onDelete={handleBookDeleted}
              onRefresh={handleBookRefresh}
              readOnly={activeSection === "usb"}
            />
            </div>
          </aside>
        )}

      {kindlePanelOpen && (
        <KindleSendPanel
          books={selectedBooks}
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
                disabled={bulkBusy}
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
              Os arquivos continuarÃ£o separados, mas passarÃ£o a usar os mesmos
              metadados e a mesma capa na biblioteca. Ao abrir, vocÃª poderÃ¡
              escolher o formato.
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
                disabled={bulkBusy || selectedBooks.length < 2}
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
