import { BookOpen, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type DragEvent as ReactDragEvent,
  type ReactNode,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  BookWithThumbnail,
  FolderInfo,
} from "../../../../types/LibraryTypes";
import {
  getFolderBookInfo,
  useBooksInFolder,
} from "../../../../hooks/useBooksInFolder";
import {
  folderPathsEqual,
  getFolderBookCount,
} from "../../utils";
import FolderCard from "../FolderCard";
import FolderContextMenu from "../FolderContextMenu";
import DropActionMenu from "../DropActionMenu";
import BookCard from "./BookCard";
import BookListItem, { ExplorerColumns, type ListLayoutMode } from "./BookListItem";
import FolderListItem from "./FolderListItem";
import { thumbnailCache } from "./thumbnailCache";

export type GridDensity = "compact" | "comfortable" | "large";

interface BookGridProps {
  books: BookWithThumbnail[];
  viewMode: "grid" | "list";
  gridDensity?: GridDensity;
  onOpen: (filePath: string, fileHash?: string) => void;
  onSync?: (fileHash: string, action: "move" | "copy") => void;
  onDelete?: (fileHash: string) => void;
  showSyncActions?: boolean;
  onBookClick?: (book: BookWithThumbnail) => void;
  selectedBookId?: number;
  onDragStart?: (fileHash: string) => void;
  onDragEnd?: () => void;
  selectionMode?: boolean;
  selectedHashes?: Set<string>;
  selectedCount?: number;
  onToggleSelection?: (book: BookWithThumbnail) => void;
  onContextSelect?: (book: BookWithThumbnail) => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  topContent?: ReactNode;
  folders?: FolderInfo[];
  onFolderSelect?: (folderPath: string | null) => void;
  selectedFolder?: string | null;
  draggingBookHashes?: string[];
  onCreateFolder?: (parentPath: string | null) => void;
  onImportBook?: (targetFolder: string | null) => void;
  onRenameFolder?: (folder: FolderInfo) => void;
  onDeleteFolder?: (folder: FolderInfo) => void;
  isFolderReadOnly?: (folder: FolderInfo) => boolean;
  onMoveBook?: (
    fileHash: string,
    targetFolder: string | null,
  ) => Promise<boolean>;
  onMoveBooks?: (
    fileHashes: string[],
    targetFolder: string | null,
  ) => Promise<boolean>;
  onDropBooksOnBook?: (
    targetBook: BookWithThumbnail,
    sourceFileHashes: string[],
    action: "merge" | "collection",
  ) => void | Promise<void>;
}

interface FolderContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  folder: FolderInfo | null;
}

const DEFAULT_COLUMNS: ExplorerColumns = {
  name: 360,
  folder: 220,
  type: 86,
  pages: 110,
  modified: 120,
  size: 96,
};

const LIST_HEADERS: { key: keyof ExplorerColumns; label: string; min: number }[] = [
  { key: "name", label: "Nome", min: 220 },
  { key: "folder", label: "Pasta", min: 140 },
  { key: "type", label: "Tipo", min: 70 },
  { key: "pages", label: "Paginas", min: 86 },
  { key: "modified", label: "Aberto em", min: 98 },
  { key: "size", label: "Tamanho", min: 82 },
];

const LIST_HEADERS_BY_LAYOUT: Record<ListLayoutMode, (keyof ExplorerColumns)[]> = {
  full: ["name", "folder", "type", "pages", "modified", "size"],
  medium: ["name", "folder", "type", "pages", "modified"],
  compact: ["name", "pages"],
  narrow: ["name"],
};

const GRID_DENSITY: Record<GridDensity, { minWidth: number; rowHeight: number; gap: number }> = {
  compact: { minWidth: 124, rowHeight: 238, gap: 16 },
  comfortable: { minWidth: 158, rowHeight: 292, gap: 16 },
  large: { minWidth: 220, rowHeight: 374, gap: 24 },
};

const WIDTH_THRESHOLD = 5;
const EMPTY_FOLDERS: FolderInfo[] = [];

function isAbsoluteFolderPath(folderPath: string) {
  return /^[a-zA-Z]:[\\/]/.test(folderPath) || folderPath.startsWith("/") || folderPath.startsWith("\\\\");
}

function getListLayout(width: number): ListLayoutMode {
  if (width >= 1000) return "full";
  if (width >= 700) return "medium";
  if (width >= 500) return "compact";
  return "narrow";
}

function getListTemplate(layout: ListLayoutMode, columns: ExplorerColumns) {
  if (layout === "full") {
    return `${columns.name}px ${columns.folder}px ${columns.type}px ${columns.pages}px ${columns.modified}px ${columns.size}px 76px`;
  }

  if (layout === "medium") {
    return "minmax(240px, 2fr) minmax(130px, 1fr) 72px 90px 98px 76px";
  }

  if (layout === "compact") {
    return "minmax(0, 1fr) 88px 76px";
  }

  return "minmax(0, 1fr) 76px";
}

function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    if (typeof ResizeObserver === "undefined") {
      const updateWidth = () => setWidth(element.getBoundingClientRect().width);
      updateWidth();
      window.addEventListener("resize", updateWidth);
      return () => window.removeEventListener("resize", updateWidth);
    }

    const observer = new ResizeObserver(([entry]) => {
      setWidth((prev) => {
        const next = entry.contentRect.width;
        return Math.abs(next - prev) > WIDTH_THRESHOLD ? next : prev;
      });
    });

    observer.observe(element);
    setWidth(element.getBoundingClientRect().width);

    return () => observer.disconnect();
  }, []);

  return [ref, width] as const;
}

export default function BookGrid({
  books,
  viewMode,
  gridDensity = "comfortable",
  onOpen,
  onSync,
  onDelete,
  showSyncActions,
  onBookClick,
  selectedBookId,
  onDragStart,
  onDragEnd,
  selectionMode = false,
  selectedHashes = new Set(),
  selectedCount = 0,
  onToggleSelection,
  onContextSelect,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  topContent,
  folders = EMPTY_FOLDERS,
  onFolderSelect,
  selectedFolder = null,
  draggingBookHashes = [],
  onCreateFolder,
  onImportBook,
  onRenameFolder,
  onDeleteFolder,
  isFolderReadOnly,
  onMoveBook,
  onMoveBooks,
  onDropBooksOnBook,
}: BookGridProps) {
  const [columns, setColumns] = useState<ExplorerColumns>(DEFAULT_COLUMNS);
  const [dragOverPath, setDragOverPath] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<FolderContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    folder: null,
  });
  const [dropMenu, setDropMenu] = useState<{
    x: number;
    y: number;
    targetBook: BookWithThumbnail;
    sourceFileHashes: string[];
  } | null>(null);
  const [virtualizerOffset, setVirtualizerOffset] = useState(0);
  const staticContentRef = useRef<HTMLDivElement | null>(null);
  const [scrollRef, scrollWidth] = useElementWidth<HTMLDivElement>();
  const density = GRID_DENSITY[gridDensity];
  const listLayout = getListLayout(scrollWidth);
  const listGridTemplate = getListTemplate(listLayout, columns);
  const hasBooks = books.length > 0;
  const hasFolders = folders.length > 0;
  const draggingBooks = draggingBookHashes.length > 0;
  const folderBookIndex = useBooksInFolder(books, folders);
  const visibleListHeaders = LIST_HEADERS.filter((header) =>
    LIST_HEADERS_BY_LAYOUT[listLayout].includes(header.key),
  );
  const { gridColumns, gridColumnWidth, gridRowHeight, rowCount } = useMemo(() => {
    const cols = Math.max(
      1,
      Math.floor((scrollWidth + density.gap) / (density.minWidth + density.gap)),
    );
    const colWidth = cols > 0
      ? (scrollWidth - density.gap * (cols - 1)) / cols
      : density.minWidth;
    const rowH = Math.ceil(Math.max(
      density.rowHeight,
      (colWidth - 8) * 1.5 + 88 + density.gap,
    ));
    return {
      gridColumns: cols,
      gridColumnWidth: colWidth,
      gridRowHeight: rowH,
      rowCount: viewMode === "grid" ? Math.ceil(books.length / cols) : books.length,
    };
  }, [scrollWidth, density, viewMode, books.length]);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => viewMode === "grid" ? gridRowHeight : listLayout === "narrow" ? 66 : 58,
    overscan: 3,
    scrollMargin: virtualizerOffset,
  });

  const virtualRows = virtualizer.getVirtualItems();
  const lastVirtualRow = virtualRows[virtualRows.length - 1];
  const virtualThumbnailPaths = useMemo(() => {
    const paths: string[] = [];

    for (const virtualRow of virtualRows) {
      if (viewMode === "grid") {
        const start = virtualRow.index * gridColumns;
        const end = Math.min(start + gridColumns, books.length);

        for (let index = start; index < end; index++) {
          const thumbnailPath = books[index]?.thumbnailPath;
          if (thumbnailPath) paths.push(thumbnailPath);
        }
        continue;
      }

      const thumbnailPath = books[virtualRow.index]?.thumbnailPath;
      if (thumbnailPath) paths.push(thumbnailPath);
    }

    return paths;
  }, [books, gridColumns, viewMode, virtualRows]);

  const virtualThumbnailRequests = useMemo(() => {
    const requests = new Map<string, { fileHash: string; filePath: string; fileType?: BookWithThumbnail["fileType"] | null }>();

    const collect = (book: BookWithThumbnail | undefined) => {
      if (!book || book.thumbnail || book.thumbnailPath || !book.fileHash || !book.filePath) return;
      requests.set(book.fileHash, {
        fileHash: book.fileHash,
        filePath: book.filePath,
        fileType: book.fileType,
      });
    };

    for (const virtualRow of virtualRows) {
      if (viewMode === "grid") {
        const start = virtualRow.index * gridColumns;
        const end = Math.min(start + gridColumns, books.length);
        for (let index = start; index < end; index++) {
          collect(books[index]);
        }
        continue;
      }

      collect(books[virtualRow.index]);
    }

    return Array.from(requests.values());
  }, [books, gridColumns, viewMode, virtualRows]);

  const onLoadMoreRef = useRef(onLoadMore);
  onLoadMoreRef.current = onLoadMore;

  useEffect(() => {
    if (
      lastVirtualRow &&
      lastVirtualRow.index >= rowCount - 5 &&
      hasMore &&
      !loadingMore &&
      onLoadMoreRef.current
    ) {
      onLoadMoreRef.current();
    }
  }, [lastVirtualRow?.index, rowCount, hasMore, loadingMore]);

  useEffect(() => {
    virtualizer.measure();
  }, [gridColumns, gridDensity, gridRowHeight, listLayout, viewMode, virtualizer, virtualizerOffset]);

  useEffect(() => {
    thumbnailCache.prefetch(virtualThumbnailPaths);
  }, [virtualThumbnailPaths]);

  useEffect(() => {
    if (virtualThumbnailRequests.length === 0) return;
    void window.api?.ensureThumbnails?.(virtualThumbnailRequests);
  }, [virtualThumbnailRequests]);

  const handleOpenBook = useCallback((book: BookWithThumbnail) => {
    onOpen(book.filePath, book.fileHash);
  }, [onOpen]);

  const handleSyncBook = useCallback((book: BookWithThumbnail, action: "move" | "copy") => {
    onSync?.(book.fileHash, action);
  }, [onSync]);

  const handleDeleteBook = useCallback((book: BookWithThumbnail) => {
    onDelete?.(book.fileHash);
  }, [onDelete]);

  const handleClickBook = useCallback((book: BookWithThumbnail) => {
    onBookClick?.(book);
  }, [onBookClick]);

  const handleToggleSelection = useCallback((book: BookWithThumbnail) => {
    onToggleSelection?.(book);
  }, [onToggleSelection]);

  const handleContextSelect = useCallback((book: BookWithThumbnail) => {
    onContextSelect?.(book);
  }, [onContextSelect]);

  const measureStaticContent = useCallback(() => {
    const nextOffset = staticContentRef.current?.offsetHeight ?? 0;
    setVirtualizerOffset((current) =>
      Math.abs(current - nextOffset) > 1 ? nextOffset : current,
    );
  }, []);

  useLayoutEffect(() => {
    measureStaticContent();

    const element = staticContentRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(measureStaticContent);
    observer.observe(element);

    return () => observer.disconnect();
  }, [
    books.length,
    folders.length,
    gridColumns,
    gridDensity,
    listLayout,
    measureStaticContent,
    topContent,
    viewMode,
  ]);

  const closeContextMenu = useCallback(() => {
    setContextMenu({ visible: false, x: 0, y: 0, folder: null });
  }, []);

  const openContextMenu = useCallback((event: ReactMouseEvent, folder: FolderInfo) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({
      visible: true,
      x: event.clientX,
      y: event.clientY,
      folder,
    });
  }, []);

  useEffect(() => {
    if (!contextMenu.visible) return;
    document.addEventListener("click", closeContextMenu);
    return () => document.removeEventListener("click", closeContextMenu);
  }, [closeContextMenu, contextMenu.visible]);

  const handleOpenFolder = useCallback((folderPath: string) => {
    onFolderSelect?.(folderPath);
  }, [onFolderSelect]);

  const handleDropOnFolder = useCallback(async (folderPath: string) => {
    if (!draggingBooks) return;

    try {
      const success =
        draggingBookHashes.length > 1 && onMoveBooks
          ? await onMoveBooks(draggingBookHashes, folderPath)
          : onMoveBook
            ? await onMoveBook(draggingBookHashes[0], folderPath)
            : false;

      if (success && draggingBookHashes.length === 1) {
        toast.success("Livro movido");
      }
    } catch {
      toast.error("Erro ao mover livro");
    } finally {
      setDragOverPath(null);
    }
  }, [draggingBookHashes, draggingBooks, onMoveBook, onMoveBooks]);

  const getFolderDisplayInfo = useCallback((folder: FolderInfo) => {
    const indexedInfo = getFolderBookInfo(folderBookIndex, folder);
    return {
      bookCount: getFolderBookCount(folder) || indexedInfo.bookCount,
      folderCount: folder.subfolders.length,
      previews: indexedInfo,
      readOnly: isFolderReadOnly?.(folder) ?? false,
      detail: isAbsoluteFolderPath(folder.path) ? folder.fullPath : undefined,
      isDropTarget: dragOverPath === folder.path,
    };
  }, [dragOverPath, folderBookIndex, isFolderReadOnly]);

  const canDropOnBook = useCallback((book: BookWithThumbnail) => {
    if (!onDropBooksOnBook || draggingBookHashes.length === 0) return false;
    const targetHashes = new Set(
      book.mergedBooks?.length
        ? book.mergedBooks.map((variant) => variant.fileHash)
        : [book.fileHash],
    );
    return draggingBookHashes.some((fileHash) => !targetHashes.has(fileHash));
  }, [draggingBookHashes, onDropBooksOnBook]);

  const openDropMenu = useCallback((
    book: BookWithThumbnail,
    event: ReactDragEvent<HTMLDivElement>,
  ) => {
    if (!canDropOnBook(book)) return;
    const targetHashes = new Set(
      book.mergedBooks?.length
        ? book.mergedBooks.map((variant) => variant.fileHash)
        : [book.fileHash],
    );
    const sourceFileHashes = draggingBookHashes.filter(
      (fileHash) => !targetHashes.has(fileHash),
    );
    if (sourceFileHashes.length === 0) return;

    setDropMenu({
      x: event.clientX,
      y: event.clientY,
      targetBook: book,
      sourceFileHashes,
    });
  }, [canDropOnBook, draggingBookHashes]);

  const startResize = (
    key: keyof ExplorerColumns,
    min: number,
    event: ReactPointerEvent,
  ) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = columns[key];

    const handleMove = (moveEvent: PointerEvent) => {
      const nextWidth = Math.max(min, startWidth + moveEvent.clientX - startX);
      setColumns((current) => ({ ...current, [key]: nextWidth }));
    };

    const handleUp = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  };

  const renderGridFolders = () => {
    if (folders.length === 0) return null;

    return (
      <section className="mb-4">
        <h2 className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
          Pastas
        </h2>
        <div
          className="grid items-start px-1"
          style={{
            columnGap: density.gap,
            rowGap: density.gap,
            gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))`,
          }}
        >
          {folders.map((folder) => {
            const displayInfo = getFolderDisplayInfo(folder);

            return (
              <FolderCard
                key={folder.path}
                id={folder.path}
                name={folder.name}
                detail={displayInfo.detail}
                bookCount={displayInfo.bookCount}
                folderCount={displayInfo.folderCount}
                coverPreviews={displayInfo.previews.coverPreviews}
                coverPreviewPaths={displayInfo.previews.coverPreviewPaths}
                isSelected={folderPathsEqual(folder.path, selectedFolder)}
                isEmpty={displayInfo.bookCount === 0 && displayInfo.folderCount === 0}
                isDropTarget={displayInfo.isDropTarget}
                onOpen={handleOpenFolder}
                onContextMenu={
                  displayInfo.readOnly
                    ? undefined
                    : (_, event) => {
                        if (event) openContextMenu(event, folder);
                      }
                }
                onDragOver={displayInfo.readOnly ? undefined : (event) => {
                  if (!draggingBooks) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  setDragOverPath(folder.path);
                }}
                onDragLeave={displayInfo.readOnly ? undefined : () => setDragOverPath(null)}
                onDrop={displayInfo.readOnly ? undefined : (event) => {
                  event.preventDefault();
                  void handleDropOnFolder(folder.path);
                }}
                fluid
              />
            );
          })}
        </div>
      </section>
    );
  };

  const renderListFolders = () => {
    if (folders.length === 0) return null;

    return (
      <div className="space-y-1">
        {folders.map((folder) => {
          const displayInfo = getFolderDisplayInfo(folder);

          return (
            <FolderListItem
              key={folder.path}
              folder={folder}
              bookCount={displayInfo.bookCount}
              folderCount={displayInfo.folderCount}
              detail={displayInfo.detail}
              gridTemplateColumns={listGridTemplate}
              listLayout={listLayout}
              isSelected={folderPathsEqual(folder.path, selectedFolder)}
              isDropTarget={displayInfo.isDropTarget}
              onOpen={handleOpenFolder}
              onContextMenu={
                displayInfo.readOnly
                  ? undefined
                  : (event) => openContextMenu(event, folder)
              }
              onDragOver={displayInfo.readOnly ? undefined : (event) => {
                if (!draggingBooks) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                setDragOverPath(folder.path);
              }}
              onDragLeave={displayInfo.readOnly ? undefined : () => setDragOverPath(null)}
              onDrop={displayInfo.readOnly ? undefined : (event) => {
                event.preventDefault();
                void handleDropOnFolder(folder.path);
              }}
            />
          );
        })}
      </div>
    );
  };

  const folderBookSeparator = hasFolders && hasBooks ? (
    <div className="my-4 border-t border-zinc-800/80" aria-hidden="true" />
  ) : null;

  const folderContextMenu = contextMenu.visible && contextMenu.folder ? (
    <FolderContextMenu
      folder={contextMenu.folder}
      x={contextMenu.x}
      y={contextMenu.y}
      onCreateFolder={(folder) => {
        closeContextMenu();
        onCreateFolder?.(folder.path);
      }}
      onImportBook={
        onImportBook
          ? (folder) => {
              closeContextMenu();
              onImportBook(folder.path);
            }
          : undefined
      }
      onRenameFolder={(folder) => {
        closeContextMenu();
        onRenameFolder?.(folder);
      }}
      onDeleteFolder={(folder) => {
        closeContextMenu();
        onDeleteFolder?.(folder);
      }}
    />
  ) : null;

  const dropActionMenu = dropMenu ? (
    <DropActionMenu
      x={dropMenu.x}
      y={dropMenu.y}
      onClose={() => setDropMenu(null)}
      onMerge={() => {
        void onDropBooksOnBook?.(
          dropMenu.targetBook,
          dropMenu.sourceFileHashes,
          "merge",
        );
        setDropMenu(null);
      }}
      onCreateCollection={() => {
        void onDropBooksOnBook?.(
          dropMenu.targetBook,
          dropMenu.sourceFileHashes,
          "collection",
        );
        setDropMenu(null);
      }}
    />
  ) : null;

  const loadingIndicator = loadingMore ? (
    <div className="flex items-center justify-center gap-2 py-4 text-xs text-zinc-500">
      <RefreshCw size={14} className="animate-spin" />
      Carregando mais livros...
    </div>
  ) : null;

  if (!hasBooks && !hasFolders) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div
          ref={scrollRef}
          data-grid-scroll
          className="min-h-0 flex-1 overflow-y-auto"
          style={{ scrollbarGutter: "stable" }}
        >
          <div ref={staticContentRef}>{topContent}</div>
          <div className="flex min-h-72 flex-col items-center justify-center gap-3 py-20">
            <BookOpen size={22} className="text-zinc-600" />
            <p className="text-sm text-zinc-500">Nenhum livro nesta secao.</p>
          </div>
          {folderContextMenu}
          {dropActionMenu}
        </div>
      </div>
    );
  }

  if (viewMode === "grid") {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div ref={scrollRef} data-grid-scroll className="min-h-0 flex-1 overflow-y-auto" style={{ scrollbarGutter: "stable" }}>
          <div ref={staticContentRef}>
            {topContent}
            {renderGridFolders()}
            {folderBookSeparator}
          </div>
          <div className="relative" style={{ height: virtualizer.getTotalSize() }}>
            {virtualRows.map((virtualRow) => {
              const rowBooks = books.slice(
                virtualRow.index * gridColumns,
                virtualRow.index * gridColumns + gridColumns,
              );

              return (
                <div
                  key={virtualRow.key}
                  className="absolute left-0 top-0 grid w-full items-start px-1"
                  style={{
                    columnGap: density.gap,
                    gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))`,
                    transform: `translateY(${virtualRow.start - virtualizer.options.scrollMargin}px)`,
                  }}
                >
                  {rowBooks.map((book) => (
                    <BookCard
                      key={book.id}
                      book={book}
                      onOpen={handleOpenBook}
                      onSync={onSync ? handleSyncBook : undefined}
                      onDelete={onDelete ? handleDeleteBook : undefined}
                      showSyncActions={showSyncActions ?? false}
                      onClick={onBookClick ? handleClickBook : undefined}
                      isSelected={selectedBookId === book.id}
                      onDragStart={onDragStart}
                      onDragEnd={onDragEnd}
                      selectionMode={selectionMode}
                      isChecked={selectedHashes.has(book.fileHash)}
                      selectedCount={selectedCount}
                      onToggleSelection={onToggleSelection ? handleToggleSelection : undefined}
                      onContextSelect={onContextSelect ? handleContextSelect : undefined}
                      canDropOnBook={canDropOnBook}
                      onDropOnBook={openDropMenu}
                    />
                  ))}
                </div>
              );
            })}
          </div>
          {loadingIndicator}
          {folderContextMenu}
          {dropActionMenu}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scrollRef} data-grid-scroll className="min-h-0 flex-1 overflow-auto" style={{ scrollbarGutter: "stable" }}>
        <div className="min-w-0 space-y-1">
          <div ref={staticContentRef} className="space-y-1">
            {topContent}
            <div
              className="sticky top-0 z-10 grid rounded-sm border border-zinc-800 bg-zinc-950/95 text-xs uppercase tracking-wide text-zinc-500"
              style={{ gridTemplateColumns: listGridTemplate }}
            >
              {visibleListHeaders.map((header) => (
                <div key={header.key} className="relative flex items-center px-3 py-2">
                  <span>{header.label}</span>
                  {listLayout === "full" && (
                  <button
                    type="button"
                    className="absolute right-0 top-0 h-full w-2 cursor-col-resize border-r border-zinc-800 hover:border-green-500"
                    onPointerDown={(event) => startResize(header.key, header.min, event)}
                    aria-label={`Redimensionar coluna ${header.label}`}
                  />
                  )}
                </div>
              ))}
              <div />
            </div>
            {renderListFolders()}
            {folderBookSeparator}
          </div>

          <div className="relative" style={{ height: virtualizer.getTotalSize() }}>
            {virtualRows.map((virtualRow) => {
              const book = books[virtualRow.index];
              if (!book) return null;

              return (
                <div
                  key={virtualRow.key}
                  className="absolute left-0 top-0 w-full"
                  style={{ transform: `translateY(${virtualRow.start - virtualizer.options.scrollMargin}px)` }}
                >
                  <BookListItem
                    book={book}
                    onOpen={handleOpenBook}
                    onSync={onSync ? handleSyncBook : undefined}
                    onDelete={onDelete ? handleDeleteBook : undefined}
                    showSyncActions={showSyncActions ?? false}
                    onClick={onBookClick ? handleClickBook : undefined}
                    isSelected={selectedBookId === book.id}
                    onDragStart={onDragStart}
                    onDragEnd={onDragEnd}
                    selectionMode={selectionMode}
                    isChecked={selectedHashes.has(book.fileHash)}
                    selectedCount={selectedCount}
                    onToggleSelection={onToggleSelection ? handleToggleSelection : undefined}
                    onContextSelect={onContextSelect ? handleContextSelect : undefined}
                    canDropOnBook={canDropOnBook}
                    onDropOnBook={openDropMenu}
                    columns={columns}
                    gridTemplateColumns={listGridTemplate}
                    listLayout={listLayout}
                  />
                </div>
              );
            })}
          </div>
        </div>
        {loadingIndicator}
        {folderContextMenu}
        {dropActionMenu}
      </div>
    </div>
  );
}
