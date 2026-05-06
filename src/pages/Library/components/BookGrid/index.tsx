import { BookOpen } from "lucide-react";
import { useState, type PointerEvent as ReactPointerEvent } from "react";
import { BookWithThumbnail } from "../../../../types/LibraryTypes";
import BookCard from "./BookCard";
import BookListItem, { ExplorerColumns } from "./BookListItem";

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
  onToggleSelection?: (fileHash: string) => void;
  onContextSelect?: (book: BookWithThumbnail) => void;
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
  { key: "pages", label: "Páginas", min: 86 },
  { key: "modified", label: "Aberto em", min: 98 },
  { key: "size", label: "Tamanho", min: 82 },
];

const GRID_DENSITY_CLASSES: Record<GridDensity, string> = {
  compact:
    "grid-cols-2 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8",
  comfortable:
    "grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6",
  large:
    "grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
};

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
}: BookGridProps) {
  const [columns, setColumns] = useState<ExplorerColumns>(DEFAULT_COLUMNS);

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

  if (books.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20">
        <BookOpen size={22} className="text-zinc-600" />
        <p className="text-sm text-zinc-500">Nenhum livro nesta seção.</p>
      </div>
    );
  }

  if (viewMode === "grid") {
    return (
      <div className={`grid items-start ${GRID_DENSITY_CLASSES[gridDensity]}`}>
        {books.map((book) => (
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
            onToggleSelection={() => onToggleSelection?.(book.fileHash)}
            onContextSelect={() => onContextSelect?.(book)}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
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

        {books.map((book) => (
          <BookListItem
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
            onToggleSelection={() => onToggleSelection?.(book.fileHash)}
            onContextSelect={() => onContextSelect?.(book)}
            columns={columns}
          />
        ))}
      </div>
    </div>
  );
}
