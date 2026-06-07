import { Check, Copy, FileText, Folder, Move, Trash2 } from "lucide-react";
import { memo } from "react";
import type { DragEvent } from "react";
import { BookWithThumbnail } from "../../../../types/LibraryTypes";
import {
  formatFileSize,
  formatPageCount,
  formatShortDate,
  getBookFolderLabel,
  getFileTypeLabel,
  getTitleWithoutExtension,
} from "../../utils";
import { useLazyThumbnail } from "./useLazyThumbnail";

export interface ExplorerColumns {
  name: number;
  folder: number;
  type: number;
  pages: number;
  modified: number;
  size: number;
}

export type ListLayoutMode = "full" | "medium" | "compact" | "narrow";

interface BookListItemProps {
  book: BookWithThumbnail;
  onOpen: (book: BookWithThumbnail) => void;
  onSync?: (book: BookWithThumbnail, action: "move" | "copy") => void;
  onDelete?: (book: BookWithThumbnail) => void;
  showSyncActions: boolean;
  onClick?: (book: BookWithThumbnail) => void;
  isSelected?: boolean;
  onDragStart?: (fileHash: string) => void;
  onDragEnd?: () => void;
  selectionMode?: boolean;
  isChecked?: boolean;
  selectedCount?: number;
  onToggleSelection?: (book: BookWithThumbnail) => void;
  onContextSelect?: (book: BookWithThumbnail) => void;
  canDropOnBook?: (book: BookWithThumbnail) => boolean;
  onDropOnBook?: (book: BookWithThumbnail, event: DragEvent<HTMLDivElement>) => void;
  columns: ExplorerColumns;
  gridTemplateColumns: string;
  listLayout: ListLayoutMode;
}

function BookListItem({
  book,
  onOpen,
  onSync,
  onDelete,
  showSyncActions,
  onClick,
  isSelected = false,
  onDragStart,
  onDragEnd,
  selectionMode = false,
  isChecked = false,
  selectedCount = 0,
  onToggleSelection,
  onContextSelect,
  canDropOnBook,
  onDropOnBook,
  gridTemplateColumns,
  listLayout,
}: BookListItemProps) {
  const { thumbnail, thumbnailRef } = useLazyThumbnail(book);
  const isCollection = book.syntheticFolderType === "collection";
  const formatCount = book.mergedBooks?.length || 1;
  const formatLabel =
    formatCount > 1
      ? Array.from(new Set(book.mergedBooks?.map((variant) => getFileTypeLabel(variant.fileType, variant.filePath)))).join(" / ")
      : getFileTypeLabel(book.fileType, book.filePath);

  const handleClick = () => {
    if (selectionMode) {
      onToggleSelection?.(book);
      return;
    }

    if (onClick) {
      onClick(book);
    } else {
      onOpen(book);
    }
  };

  return (
    <div
      onClick={handleClick}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextSelect?.(book);
      }}
      className={`grid min-h-12 cursor-pointer items-center rounded-sm border bg-zinc-900 transition-shadow ${
        isSelected
          ? "border-zinc-500 ring-1 ring-zinc-500"
          : "border-zinc-800 hover:border-zinc-700"
      } ${isChecked ? "border-green-500 bg-green-950/20" : ""}`}
      style={{ gridTemplateColumns }}
      draggable={!selectionMode || isChecked}
      onDragStartCapture={(e) => {
        if (selectionMode && !isChecked) {
          e.preventDefault();
          return;
        }
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", book.fileHash);
        if (isChecked && selectedCount > 1) {
          const dragPreview = document.createElement("div");
          dragPreview.className =
            "fixed -top-96 left-0 rounded-sm border border-green-500/50 bg-zinc-900 px-3 py-2 text-xs font-medium text-zinc-100 shadow-xl";
          dragPreview.textContent = `${selectedCount} livros selecionados`;
          document.body.appendChild(dragPreview);
          e.dataTransfer.setDragImage(dragPreview, 12, 12);
          window.setTimeout(() => dragPreview.remove(), 0);
        }
        onDragStart?.(book.fileHash);
      }}
      onDragEndCapture={() => onDragEnd?.()}
      onDragOver={(event) => {
        if (!canDropOnBook?.(book)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      }}
      onDrop={(event) => {
        if (!canDropOnBook?.(book)) return;
        event.preventDefault();
        event.stopPropagation();
        onDropOnBook?.(book, event);
      }}
    >
      <div className="flex min-w-0 items-center gap-3 px-3 py-2">
        <div
          className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-sm border ${
            isChecked
              ? "border-green-500 bg-green-500 text-zinc-950"
              : selectionMode
                ? "border-zinc-600 bg-zinc-950 text-transparent"
                : "border-transparent text-transparent"
          }`}
        >
          <Check size={13} />
        </div>
        {isCollection ? (
          <div className="h-11 w-8 flex-shrink-0 overflow-hidden rounded-sm bg-zinc-800 flex items-center justify-center">
            <Folder size={16} className="text-emerald-400" />
          </div>
        ) : (
          <div ref={thumbnailRef} className="h-11 w-8 flex-shrink-0 overflow-hidden rounded-sm bg-zinc-800">
            {thumbnail ? (
              <img
                src={thumbnail}
                alt={book.title}
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <FileText size={14} className="text-zinc-600" />
              </div>
            )}
          </div>
        )}
        <div className="min-w-0">
          <p className="min-w-0 truncate text-sm text-zinc-200">
            {getTitleWithoutExtension(book.title, book.fileType)}
          </p>
          {(listLayout === "compact" || listLayout === "narrow") && (
            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5 text-[11px] text-zinc-500">
            <span className={`rounded-sm px-1.5 py-0.5 ${isCollection ? "bg-emerald-950/50 text-emerald-300" : "bg-zinc-800 uppercase text-zinc-300"}`}>
                {isCollection ? "Coleção" : formatLabel}
              </span>
              {listLayout !== "narrow" && (
                <span className="min-w-0 truncate">
                  {getBookFolderLabel(book.filePath)}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {(listLayout === "full" || listLayout === "medium") && (
      <div className="truncate px-3 py-2 text-xs text-zinc-500">
        {getBookFolderLabel(book.filePath)}
      </div>
      )}
      {(listLayout === "full" || listLayout === "medium") && (
      <div className="px-3 py-2 text-xs text-zinc-400">
        {isCollection ? (
          <span className="rounded-sm bg-emerald-950/50 px-1.5 py-0.5 text-emerald-300">Coleção</span>
        ) : formatLabel}
      </div>
      )}
      {listLayout !== "narrow" && (
      <div className="px-3 py-2 text-xs text-zinc-400">
        {isCollection ? `${book.mergedBooks?.length || 0} livros` : formatPageCount(book.numPages, book.fileType)}
      </div>
      )}
      {(listLayout === "full" || listLayout === "medium") && (
      <div className="px-3 py-2 text-xs text-zinc-500">
        {formatShortDate(book.lastOpenedAt || book.createdAt)}
      </div>
      )}
      {listLayout === "full" && (
      <div className="px-3 py-2 text-xs text-zinc-500">
        {formatFileSize(book.fileSize)}
      </div>
      )}

      <div className="flex justify-end gap-1 px-2">
        {showSyncActions && onSync && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSync(book, "move");
              }}
              className="cursor-pointer rounded p-2 hover:bg-zinc-800"
              title="Mover para library"
            >
              <Move size={15} className="text-zinc-400" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSync(book, "copy");
              }}
              className="cursor-pointer rounded p-2 hover:bg-zinc-800"
              title="Copiar para library"
            >
              <Copy size={15} className="text-zinc-400" />
            </button>
          </>
        )}
        {onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(book);
            }}
            className="cursor-pointer rounded p-2 hover:bg-red-500/20"
            title="Remover"
          >
            <Trash2 size={15} className="text-red-400" />
          </button>
        )}
      </div>
    </div>
  );
}

export function areBooksEqual(previous: BookWithThumbnail, next: BookWithThumbnail) {
  const previousMergedSignature = previous.mergedBooks
    ?.map((book) => `${book.fileHash}:${book.thumbnail || ""}:${book.thumbnailPath || ""}`)
    .join("|");
  const nextMergedSignature = next.mergedBooks
    ?.map((book) => `${book.fileHash}:${book.thumbnail || ""}:${book.thumbnailPath || ""}`)
    .join("|");

  return (
    previous.id === next.id &&
    previous.fileHash === next.fileHash &&
    previous.title === next.title &&
    previous.filePath === next.filePath &&
    previous.thumbnail === next.thumbnail &&
    previous.thumbnailPath === next.thumbnailPath &&
    previous.numPages === next.numPages &&
    previous.fileType === next.fileType &&
    previous.fileSize === next.fileSize &&
    previous.lastOpenedAt === next.lastOpenedAt &&
    previous.createdAt === next.createdAt &&
    previous.processingStatus === next.processingStatus &&
    previous.syntheticFolderPath === next.syntheticFolderPath &&
    previous.syntheticFolderType === next.syntheticFolderType &&
    previousMergedSignature === nextMergedSignature
  );
}

function areColumnsEqual(previous: ExplorerColumns, next: ExplorerColumns) {
  return (
    previous.name === next.name &&
    previous.folder === next.folder &&
    previous.type === next.type &&
    previous.pages === next.pages &&
    previous.modified === next.modified &&
    previous.size === next.size
  );
}

export default memo(BookListItem, (previous, next) => (
  areBooksEqual(previous.book, next.book) &&
  previous.showSyncActions === next.showSyncActions &&
  previous.isSelected === next.isSelected &&
  previous.selectionMode === next.selectionMode &&
  previous.isChecked === next.isChecked &&
  previous.selectedCount === next.selectedCount &&
  previous.gridTemplateColumns === next.gridTemplateColumns &&
  previous.listLayout === next.listLayout &&
  previous.canDropOnBook === next.canDropOnBook &&
  previous.onDropOnBook === next.onDropOnBook &&
  areColumnsEqual(previous.columns, next.columns)
));
