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
import { setBookDragImage } from "../../utils/bookDragPreview";
import { useTranslation } from "../../../../i18n";

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
  onDragMove?: (event: DragEvent<HTMLDivElement>) => void;
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
  onDragMove,
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
  const { t } = useTranslation();
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
      className={`lyceum-interactive-row grid min-h-12 cursor-pointer items-center rounded-sm border bg-surface transition-shadow ${
        isSelected
          ? "border-border-strong ring-1 ring-border-strong"
          : "border-border hover:border-border-strong"
      } ${isChecked ? "border-primary bg-primary-muted" : ""}`}
      style={{ gridTemplateColumns }}
      draggable={!selectionMode || isChecked}
      onDragStartCapture={(e) => {
        if (selectionMode && !isChecked) {
          e.preventDefault();
          return;
        }
        e.dataTransfer.effectAllowed = "copyMove";
        e.dataTransfer.setData("application/x-lyceum-book", book.fileHash);
        setBookDragImage(e.dataTransfer, Math.max(1, selectedCount));
        onDragStart?.(book.fileHash);
      }}
      onDrag={onDragMove}
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
              ? "border-primary bg-primary text-primary-foreground"
              : selectionMode
                ? "border-border-strong bg-background text-transparent"
                : "border-transparent text-transparent"
          }`}
        >
          <Check size={13} />
        </div>
        {isCollection ? (
          <div className="h-11 w-8 flex-shrink-0 overflow-hidden rounded-sm bg-surface-muted flex items-center justify-center">
            <Folder size={16} className="text-primary" />
          </div>
        ) : (
          <div ref={thumbnailRef} className="h-11 w-8 flex-shrink-0 overflow-hidden rounded-sm bg-surface-muted">
            {thumbnail ? (
              <img
                src={thumbnail}
                alt={book.title}
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <FileText size={14} className="text-foreground-subtle" />
              </div>
            )}
          </div>
        )}
        <div className="min-w-0">
          <p className="min-w-0 truncate text-sm text-foreground">
            {getTitleWithoutExtension(book.title, book.fileType)}
          </p>
          {(listLayout === "compact" || listLayout === "narrow") && (
            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5 text-[11px] text-foreground-subtle">
            <span className={`rounded-sm px-1.5 py-0.5 ${isCollection ? "bg-primary-muted text-primary" : "bg-surface-muted uppercase text-foreground"}`}>
                {isCollection ? t("library:list.collection") : formatLabel}
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
      <div className="truncate px-3 py-2 text-xs text-foreground-subtle">
        {getBookFolderLabel(book.filePath)}
      </div>
      )}
      {(listLayout === "full" || listLayout === "medium") && (
      <div className="px-3 py-2 text-xs text-foreground-muted">
        {isCollection ? (
          <span className="rounded-sm bg-primary-muted px-1.5 py-0.5 text-primary">Coleção</span>
        ) : formatLabel}
      </div>
      )}
      {listLayout !== "narrow" && (
      <div className="px-3 py-2 text-xs text-foreground-muted">
        {isCollection ? `${book.mergedBooks?.length || 0} livros` : formatPageCount(book.numPages, book.fileType)}
      </div>
      )}
      {(listLayout === "full" || listLayout === "medium") && (
      <div className="px-3 py-2 text-xs text-foreground-subtle">
        {formatShortDate(book.lastOpenedAt || book.createdAt)}
      </div>
      )}
      {listLayout === "full" && (
      <div className="px-3 py-2 text-xs text-foreground-subtle">
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
              className="cursor-pointer rounded p-2 hover:bg-surface-muted"
              title={t("library:list.moveToLibrary")}
            >
              <Move size={15} className="text-foreground-muted" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSync(book, "copy");
              }}
              className="cursor-pointer rounded p-2 hover:bg-surface-muted"
              title={t("library:list.copyToLibrary")}
            >
              <Copy size={15} className="text-foreground-muted" />
            </button>
          </>
        )}
        {onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(book);
            }}
            className="cursor-pointer rounded p-2 hover:bg-destructive-muted"
            title={t("library:list.remove")}
          >
            <Trash2 size={15} className="text-destructive" />
          </button>
        )}
      </div>
    </div>
  );
}

export function areBooksEqual(previous: BookWithThumbnail, next: BookWithThumbnail) {
  const previousMergedSignature = previous.mergedBooks
    ?.map((book) => `${book.fileHash}:${book.thumbnail || ""}:${book.thumbnailPath || ""}:${book.readingStatus || ""}:${book.rating || 0}`)
    .join("|");
  const nextMergedSignature = next.mergedBooks
    ?.map((book) => `${book.fileHash}:${book.thumbnail || ""}:${book.thumbnailPath || ""}:${book.readingStatus || ""}:${book.rating || 0}`)
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
    previous.readingStatus === next.readingStatus &&
    previous.currentPage === next.currentPage &&
    previous.rating === next.rating &&
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
