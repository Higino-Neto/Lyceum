import { useNavigate } from "react-router-dom";
import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  BookOpen,
  CheckSquare,
  Copy,
  FolderOpen,
  LayoutGrid,
  List,
  Move,
  PanelLeft,
  PanelLeftClose,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import {
  BookDetailPanel,
  FileTypeFilter,
  FilterBar,
  FolderTree,
  SectionTabs,
  SortOption,
} from "./components";
import BookGrid, { type GridDensity } from "./components/BookGrid";
import useBooks from "./useBooks";
import ImportBookDialog from "../../components/ImportBookDialog";
import ConfirmDialog from "../../components/ConfirmDialog";
import { BookWithThumbnail } from "../../types/LibraryTypes";
import toast from "react-hot-toast";
import { DocumentRecord } from "../../types/ReadingTypes";
import {
  calculateSimilarity,
  formatPageCount,
  getBookFolderLabel,
  getFileTypeLabel,
  getTitleWithoutExtension,
  normalizeText,
} from "./utils";

export default function Library() {
  const navigate = useNavigate();

  const { syncedBooks, unsyncedBooks, handleSync, refreshBooks } = useBooks();

  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [gridDensity, setGridDensity] = useState<GridDensity>("comfortable");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("title");
  const [fileTypeFilter, setFileTypeFilter] = useState<FileTypeFilter>("all");
  const [activeSection, setActiveSection] = useState<"synced" | "unsynced">(
    "synced",
  );

  const [selectedBook, setSelectedBook] = useState<BookWithThumbnail | null>(
    null,
  );
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const [detailPanelWidth, setDetailPanelWidth] = useState(320);
  const [localDocuments, setLocalDocuments] = useState<DocumentRecord[]>([]);
  const [libraryFolders, setLibraryFolders] = useState<string[]>([]);
  const [draggingBookHashes, setDraggingBookHashes] = useState<string[]>([]);
  const [selectedHashes, setSelectedHashes] = useState<Set<string>>(new Set());
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
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

  const loadLocalDocs = useCallback(async () => {
    try {
      const docs = await window.api.getDocuments();
      setLocalDocuments(docs);
    } catch (error) {
      console.error("Error loading local documents:", error);
    }
  }, []);

  const loadLibraryFolders = useCallback(async () => {
    try {
      const folders = await window.api.getAllFolders();
      setLibraryFolders(folders);
    } catch (error) {
      console.error("Error loading library folders:", error);
    }
  }, []);

  const refreshLibraryState = useCallback(async () => {
    await Promise.all([refreshBooks(), loadLocalDocs(), loadLibraryFolders()]);
  }, [loadLibraryFolders, loadLocalDocs, refreshBooks]);

  useEffect(() => {
    const unsubscribe = window.api.onLibraryUpdated(refreshLibraryState);
    return () => unsubscribe();
  }, [refreshLibraryState]);

  useEffect(() => {
    refreshLibraryState();
  }, [refreshLibraryState]);

  useEffect(() => {
    setSelectedHashes(new Set());
  }, [activeSection]);

  const startPaneResize = (
    pane: "sidebar" | "details",
    event: ReactPointerEvent,
  ) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = pane === "sidebar" ? sidebarWidth : detailPanelWidth;
    const minWidth = pane === "sidebar" ? 220 : 300;
    const maxWidth = pane === "sidebar" ? 420 : 560;
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handleMove = (moveEvent: PointerEvent) => {
      const delta =
        pane === "sidebar"
          ? moveEvent.clientX - startX
          : startX - moveEvent.clientX;
      const nextWidth = Math.min(
        maxWidth,
        Math.max(minWidth, startWidth + delta),
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
    const result = await window.api.reopenPdf(filePath, fileHash);

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
        source: "library",
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
    const book = [...syncedBooks, ...unsyncedBooks].find(
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
      const allBooks = await window.api.getDocuments();
      const updatedBook = allBooks.find(
        (book) => book.fileHash === selectedBook.fileHash,
      );
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

  const toggleSelection = (fileHash: string) => {
    setSelectedHashes((previous) => {
      const next = new Set(previous);
      if (next.has(fileHash)) {
        next.delete(fileHash);
      } else {
        next.add(fileHash);
      }
      return next;
    });
  };

  const handleContextSelect = (book: BookWithThumbnail) => {
    setSelectedBook(null);
    setSelectedHashes((previous) => new Set(previous).add(book.fileHash));
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
    setDraggingBookHashes([]);
  };

  const filterBooks = useCallback(
    (booksToFilter: BookWithThumbnail[]) => {
      return booksToFilter
        .filter((book) => {
          if (selectedFolder !== null && book.filePath) {
            const normalizedFilePath = book.filePath
              .replace(/\\/g, "/")
              .toLowerCase();
            const normalizedSelectedFolder = selectedFolder
              .replace(/\\/g, "/")
              .toLowerCase();

            const lastSlashIdx = normalizedFilePath.lastIndexOf("/");
            const bookFolder =
              lastSlashIdx > 0
                ? normalizedFilePath.substring(0, lastSlashIdx)
                : "";

            if (!bookFolder.includes(normalizedSelectedFolder)) {
              return false;
            }
          }

          if (fileTypeFilter !== "all") {
            const type = getFileTypeLabel(book.fileType, book.filePath).toLowerCase();
            if (type !== fileTypeFilter) return false;
          }

          return true;
        })
        .filter((book) => {
          if (!search.trim()) return true;
          const normalizedSearch = normalizeText(search);
          const searchable = normalizeText(
            [
              book.title,
              getBookFolderLabel(book.filePath),
              getFileTypeLabel(book.fileType, book.filePath),
              String(book.numPages),
            ]
              .filter(Boolean)
              .join(" "),
          );

          if (normalizedSearch
            .split(" ")
            .every((token) => searchable.includes(token))) {
            return true;
          }

          const titleScore = calculateSimilarity(
            book.title,
            null,
            search,
          ).score;
          const folderScore = calculateSimilarity(
            getBookFolderLabel(book.filePath),
            null,
            search,
          ).score;

          return Math.max(titleScore, folderScore) > 0.2;
        })
        .sort((a, b) => {
          if (search) {
            const scoreA = Math.max(
              calculateSimilarity(a.title, null, search).score,
              calculateSimilarity(getBookFolderLabel(a.filePath), null, search)
                .score,
            );
            const scoreB = Math.max(
              calculateSimilarity(b.title, null, search).score,
              calculateSimilarity(getBookFolderLabel(b.filePath), null, search)
                .score,
            );
            if (scoreA !== scoreB) return scoreB - scoreA;
          }

          if (sort === "pages") return b.numPages - a.numPages;
          if (sort === "size") return b.fileSize - a.fileSize;

          if (sort === "recent") {
            return (
              new Date(b.lastOpenedAt).getTime() -
              new Date(a.lastOpenedAt).getTime()
            );
          }

          return a.title.localeCompare(b.title);
        });
    },
    [fileTypeFilter, search, selectedFolder, sort],
  );

  const allBooks = useMemo(
    () => [...syncedBooks, ...unsyncedBooks],
    [syncedBooks, unsyncedBooks],
  );
  const currentBooks = activeSection === "synced" ? syncedBooks : unsyncedBooks;
  const filteredBooks = useMemo(
    () => filterBooks(currentBooks),
    [currentBooks, filterBooks],
  );
  const recentBooks = useMemo(
    () =>
      allBooks
        .filter((book) => {
          const openedAt = new Date(book.lastOpenedAt).getTime();
          return book.lastOpenedAt && !Number.isNaN(openedAt);
        })
        .sort(
          (a, b) =>
            new Date(b.lastOpenedAt).getTime() -
            new Date(a.lastOpenedAt).getTime(),
        )
        .slice(0, 8),
    [allBooks],
  );
  const selectedBooks = useMemo(
    () => currentBooks.filter((book) => selectedHashes.has(book.fileHash)),
    [currentBooks, selectedHashes],
  );

  const selectAllFiltered = () => {
    setSelectedHashes(new Set(filteredBooks.map((book) => book.fileHash)));
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

  const runBulkDelete = async () => {
    setBulkBusy(true);
    let removed = 0;
    let failed = 0;

    for (const fileHash of selectedHashes) {
      const result = await window.api.deleteBook(fileHash, false);
      if (result.success) removed++;
      else failed++;
    }

    setBulkBusy(false);
    setConfirmBulkDelete(false);
    clearSelection();
    setSelectedBook(null);
    await refreshLibraryState();
    toast.success(`${removed} livro${removed !== 1 ? "s" : ""} removido${removed !== 1 ? "s" : ""}`);
    if (failed > 0) toast.error(`${failed} item${failed !== 1 ? "s" : ""} não removido${failed !== 1 ? "s" : ""}`);
  };

  return (
    <div className="flex h-full min-h-0 overflow-hidden bg-zinc-950 p-2 text-zinc-100">
      {showSidebar && (
        <aside
          className="relative h-full flex-shrink-0 overflow-hidden rounded-sm border border-zinc-800 bg-zinc-900/50"
          style={{ width: sidebarWidth }}
        >
          <div className="h-full overflow-y-auto">
            <FolderTree
              selectedFolder={selectedFolder}
              onFolderSelect={setSelectedFolder}
              localDocuments={localDocuments}
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

      <div className="ml-2 flex h-full min-w-0 flex-1 overflow-hidden rounded-sm border border-zinc-800 bg-zinc-950">
        <div className="flex h-full min-w-0 flex-1 flex-col">
          <header className="flex flex-shrink-0 items-center justify-between gap-4 border-b border-zinc-800 px-4 py-3">
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <BookOpen size={20} className="text-zinc-400" />
              <h1 className="text-base font-semibold tracking-tight">Biblioteca</h1>
              <span className="text-zinc-700">|</span>
              <span className="text-xs text-zinc-500">
                {syncedBooks.length + unsyncedBooks.length} volumes
              </span>
              <SectionTabs
                activeSection={activeSection}
                onSectionChange={setActiveSection}
                syncedCount={syncedBooks.length}
                unsyncedCount={unsyncedBooks.length}
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
                onClick={() => window.api.openLibraryFolder()}
                className="cursor-pointer rounded-sm bg-zinc-800 p-2 text-zinc-400 transition-colors hover:bg-zinc-700"
                title="Abrir pasta da biblioteca"
              >
                <FolderOpen size={18} />
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

          <main className="flex-1 overflow-y-auto p-4">
            <FilterBar
              search={search}
              onSearchChange={setSearch}
              sort={sort}
              onSortChange={setSort}
              fileType={fileTypeFilter}
              onFileTypeChange={setFileTypeFilter}
            />

            {recentBooks.length > 0 && (
              <section className="mb-4">
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-sm font-medium text-zinc-200">
                    Continuar lendo
                  </h2>
                  <span className="text-xs text-zinc-600">
                    Ultimos abertos
                  </span>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {recentBooks.map((book) => (
                    <button
                      key={book.fileHash}
                      type="button"
                      onClick={() => handleOpen(book.filePath, book.fileHash)}
                      className="flex min-w-[250px] max-w-[300px] cursor-pointer items-center gap-3 rounded-sm border border-zinc-800 bg-zinc-900/60 p-2 text-left transition-colors hover:border-zinc-700 hover:bg-zinc-900"
                    >
                      <div className="h-14 w-10 flex-shrink-0 overflow-hidden rounded-sm border border-zinc-800 bg-zinc-950">
                        {book.thumbnail ? (
                          <img
                            src={book.thumbnail}
                            alt={book.title}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[10px] font-medium text-zinc-600">
                            {getFileTypeLabel(book.fileType, book.filePath)}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-zinc-200">
                          {getTitleWithoutExtension(book.title, book.fileType)}
                        </p>
                        <p className="mt-1 truncate text-[11px] text-zinc-500">
                          {getBookFolderLabel(book.filePath)}
                        </p>
                        <div className="mt-2 flex items-center gap-2 text-[11px] text-zinc-500">
                          <span>
                            {formatPageCount(book.numPages, book.fileType)}
                          </span>
                          <span className="rounded-sm bg-zinc-800 px-1.5 py-0.5 text-zinc-300">
                            {getFileTypeLabel(book.fileType, book.filePath)}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {selectedHashes.size > 0 && (
              <div className="sticky top-0 z-20 mb-3 flex flex-wrap items-center gap-2 rounded-sm border border-zinc-800 bg-zinc-900/95 p-2.5 shadow-xl">
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

            <BookGrid
              books={filteredBooks}
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
            />
          </main>
        </div>

        {selectedBook && (
          <aside
            className="relative h-full flex-shrink-0 overflow-hidden border-l border-zinc-800 bg-zinc-900"
            style={{ width: detailPanelWidth }}
          >
            <button
              type="button"
              onPointerDown={(event) => startPaneResize("details", event)}
              className="absolute left-0 top-0 z-10 h-full w-1 cursor-col-resize bg-transparent hover:bg-green-500/70"
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
            />
            </div>
          </aside>
        )}
      </div>

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

      <ConfirmDialog
        isOpen={confirmBulkDelete}
        title="Remover livros selecionados"
        message={`Remover ${selectedBooks.length} livro${selectedBooks.length !== 1 ? "s" : ""} da biblioteca? Os arquivos no disco serão mantidos.`}
        confirmLabel="Remover"
        isDanger
        onConfirm={runBulkDelete}
        onCancel={() => setConfirmBulkDelete(false)}
      />

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
                <option value="">Raiz da library</option>
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
