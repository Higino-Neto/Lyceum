import { BookOpen, RefreshCw } from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { BookWithThumbnail } from "../../../../types/LibraryTypes";
import BookCard from "./BookCard";
import BookListItem, { ExplorerColumns } from "./BookListItem";
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

const GRID_DENSITY: Record<GridDensity, { minWidth: number; rowHeight: number; gap: number }> = {
  compact: { minWidth: 124, rowHeight: 238, gap: 16 },
  comfortable: { minWidth: 158, rowHeight: 292, gap: 16 },
  large: { minWidth: 220, rowHeight: 374, gap: 24 },
};

const WIDTH_THRESHOLD = 5;

function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

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
}: BookGridProps) {
  const [columns, setColumns] = useState<ExplorerColumns>(DEFAULT_COLUMNS);
  const [scrollRef, scrollWidth] = useElementWidth<HTMLDivElement>();
  const density = GRID_DENSITY[gridDensity];
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
    estimateSize: () => viewMode === "grid" ? gridRowHeight : 56,
    overscan: 3,
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

  const prevGridColumns = useRef(gridColumns);
  useEffect(() => {
    if (prevGridColumns.current !== gridColumns) {
      prevGridColumns.current = gridColumns;
      virtualizer.measure();
    }
  }, [gridColumns, virtualizer]);

  useEffect(() => {
    thumbnailCache.prefetch(virtualThumbnailPaths);
  }, [virtualThumbnailPaths]);

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

  const loadingIndicator = loadingMore ? (
    <div className="flex items-center justify-center gap-2 py-4 text-xs text-zinc-500">
      <RefreshCw size={14} className="animate-spin" />
      Carregando mais livros...
    </div>
  ) : null;

  if (books.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 py-20">
        <BookOpen size={22} className="text-zinc-600" />
        <p className="text-sm text-zinc-500">Nenhum livro nesta secao.</p>
      </div>
    );
  }

  if (viewMode === "grid") {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div ref={scrollRef} data-grid-scroll className="min-h-0 flex-1 overflow-y-auto" style={{ scrollbarGutter: "stable" }}>
          {topContent}
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
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  {rowBooks.map((book) => (
                    <BookCard
                      key={book.id}
                      book={book}
                      onOpen={() => onOpen(book.filePath, book.fileHash)}
                      onSync={onSync ? (action) => onSync(book.fileHash, action) : undefined}
                      onDelete={onDelete ? () => onDelete(book.fileHash) : undefined}
                      showSyncActions={showSyncActions ?? false}
                      onClick={() => onBookClick?.(book)}
                      isSelected={selectedBookId === book.id}
                      onDragStart={onDragStart}
                      onDragEnd={onDragEnd}
                      selectionMode={selectionMode}
                      isChecked={selectedHashes.has(book.fileHash)}
                      selectedCount={selectedCount}
                      onToggleSelection={() => onToggleSelection?.(book)}
                      onContextSelect={() => onContextSelect?.(book)}
                    />
                  ))}
                </div>
              );
            })}
          </div>
          {loadingIndicator}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scrollRef} data-grid-scroll className="min-h-0 flex-1 overflow-auto" style={{ scrollbarGutter: "stable" }}>
        {topContent}
        <div className="min-w-max space-y-1">
          <div
            className="sticky top-0 z-10 grid rounded-sm border border-zinc-800 bg-zinc-950/95 text-xs uppercase tracking-wide text-zinc-500"
            style={{
              gridTemplateColumns: `${columns.name}px ${columns.folder}px ${columns.type}px ${columns.pages}px ${columns.modified}px ${columns.size}px 76px`,
            }}
          >
            {LIST_HEADERS.map((header) => (
              <div key={header.key} className="relative flex items-center px-3 py-2">
                <span>{header.label}</span>
                <button
                  type="button"
                  className="absolute right-0 top-0 h-full w-2 cursor-col-resize border-r border-zinc-800 hover:border-green-500"
                  onPointerDown={(event) => startResize(header.key, header.min, event)}
                  aria-label={`Redimensionar coluna ${header.label}`}
                />
              </div>
            ))}
            <div />
          </div>

          <div className="relative" style={{ height: virtualizer.getTotalSize() }}>
            {virtualRows.map((virtualRow) => {
              const book = books[virtualRow.index];
              if (!book) return null;

              return (
                <div
                  key={virtualRow.key}
                  className="absolute left-0 top-0 w-full"
                  style={{ transform: `translateY(${virtualRow.start}px)` }}
                >
                  <BookListItem
                    book={book}
                    onOpen={() => onOpen(book.filePath, book.fileHash)}
                    onSync={onSync ? (action) => onSync(book.fileHash, action) : undefined}
                    onDelete={onDelete ? () => onDelete(book.fileHash) : undefined}
                    showSyncActions={showSyncActions ?? false}
                    onClick={() => onBookClick?.(book)}
                    isSelected={selectedBookId === book.id}
                    onDragStart={onDragStart}
                    onDragEnd={onDragEnd}
                    selectionMode={selectionMode}
                    isChecked={selectedHashes.has(book.fileHash)}
                    selectedCount={selectedCount}
                    onToggleSelection={() => onToggleSelection?.(book)}
                    onContextSelect={() => onContextSelect?.(book)}
                    columns={columns}
                  />
                </div>
              );
            })}
          </div>
        </div>
        {loadingIndicator}
      </div>
    </div>
  );
}
