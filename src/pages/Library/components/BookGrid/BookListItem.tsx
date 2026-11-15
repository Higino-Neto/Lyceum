import { Check, Copy, FileText, Folder, Move, Trash2 } from "lucide-react";
import { memo, type ReactNode } from "react";
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
import { READING_STATUS_LABEL_KEYS } from "../../../../lib/readingStatus";
import type { ListColumnDefinition } from "../../../../features/library/model/listColumns";
import { calculateProgress } from "./progress";
import { getDisplayRating, getDisplayReadingStatus, getReadingStatusIcon } from "./bookStatus";

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
  /** Visible columns, in display order (memoized by the grid). */
  columns: ListColumnDefinition[];
  gridTemplateColumns: string;
  /** Narrow panes show only the title cell, with a metadata line under it. */
  compact: boolean;
}

const EMPTY = "—";

function MutedText({ children, align }: { children: ReactNode; align?: "start" | "end" }) {
  return (
    <div className={`truncate px-3 py-2 text-xs text-foreground-subtle ${align === "end" ? "text-right tabular-nums" : ""}`}>
      {children}
    </div>
  );
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
  columns,
  gridTemplateColumns,
  compact,
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

  const formatBadge = isCollection ? (
    <span className="rounded-sm bg-primary-muted px-1.5 py-0.5 text-primary">{t("library:list.collection")}</span>
  ) : (
    <span className="rounded-sm bg-surface-muted px-1.5 py-0.5 uppercase text-foreground-subtle">{formatLabel}</span>
  );

  const renderTitleCell = () => (
    <div className="flex min-w-0 items-center gap-3 px-3 py-2.5">
      <div
        className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-sm border transition-colors ${
          isChecked
            ? "border-primary bg-primary text-primary-foreground"
            : selectionMode
              ? "border-border-strong bg-background text-transparent"
              : "border-transparent text-transparent group-hover:border-border-strong"
        }`}
      >
        <Check size={13} />
      </div>
      {isCollection ? (
        <div className="flex h-12 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-sm bg-surface-muted">
          <Folder size={18} className="text-primary" />
        </div>
      ) : (
        <div ref={thumbnailRef} className="h-12 w-9 flex-shrink-0 overflow-hidden rounded-sm bg-surface-muted shadow-sm">
          {thumbnail ? (
            <img src={thumbnail} alt={book.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <FileText size={16} className="text-foreground-subtle" />
            </div>
          )}
        </div>
      )}
      <div className="min-w-0">
        <p className="min-w-0 truncate text-sm font-medium text-foreground">
          {getTitleWithoutExtension(book.title, book.fileType)}
        </p>
        {compact && (
          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5 text-[11px] text-foreground-subtle">
            {formatBadge}
            <span className="min-w-0 truncate">{book.author || getBookFolderLabel(book.filePath)}</span>
          </div>
        )}
      </div>
    </div>
  );

  const renderCell = (column: ListColumnDefinition): ReactNode => {
    switch (column.id) {
      case "title":
        return renderTitleCell();
      case "author":
        return <MutedText>{book.author || EMPTY}</MutedText>;
      case "series":
        return (
          <MutedText>
            {book.series ? `${book.series}${book.seriesIndex ? ` #${book.seriesIndex}` : ""}` : EMPTY}
          </MutedText>
        );
      case "format":
        return <div className="px-3 py-2 text-xs">{formatBadge}</div>;
      case "pages":
        return (
          <MutedText align="end">
            {isCollection
              ? t("library:list.booksInCollection", { count: book.mergedBooks?.length || 0 })
              : formatPageCount(book.numPages, book.fileType)}
          </MutedText>
        );
      case "progress": {
        if (isCollection || book.numPages <= 0) return <MutedText>{EMPTY}</MutedText>;
        const progress = Math.round(calculateProgress(book));
        return (
          <div className="flex min-w-0 items-center gap-2 px-3 py-2">
            <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
            </div>
            <span className="w-8 text-right text-[11px] tabular-nums text-foreground-subtle">{progress}%</span>
          </div>
        );
      }
      case "status": {
        const status = getDisplayReadingStatus(book);
        const icon = getReadingStatusIcon(status);
        return (
          <div className="flex min-w-0 items-center gap-1.5 px-3 py-2 text-xs text-foreground-muted">
            {icon && <icon.Icon size={14} className={`shrink-0 ${icon.color}`} />}
            <span className="truncate">{t(READING_STATUS_LABEL_KEYS[status])}</span>
          </div>
        );
      }
      case "rating": {
        const rating = getDisplayRating(book);
        return <MutedText align="end">{rating > 0 ? `${rating.toFixed(1)}/10` : EMPTY}</MutedText>;
      }
      case "size":
        return <MutedText align="end">{formatFileSize(book.fileSize)}</MutedText>;
      case "folder":
        return <MutedText>{getBookFolderLabel(book.filePath)}</MutedText>;
      case "added":
        return <MutedText>{formatShortDate(book.importedAt || book.createdAt)}</MutedText>;
      case "lastOpened":
        return <MutedText>{formatShortDate(book.lastOpenedAt || book.createdAt)}</MutedText>;
      case "publisher":
        return <MutedText>{book.publisher || EMPTY}</MutedText>;
      case "language":
        return <MutedText>{book.language ? book.language.toUpperCase() : EMPTY}</MutedText>;
      case "published":
        return <MutedText>{book.publishDate ? book.publishDate.slice(0, 10) : EMPTY}</MutedText>;
      case "isbn":
        return <MutedText>{book.isbn || EMPTY}</MutedText>;
      default:
        return null;
    }
  };

  return (
    <div
      onClick={handleClick}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextSelect?.(book);
      }}
      className={`lyceum-interactive-row group grid min-h-14 cursor-pointer items-center rounded-sm border bg-surface transition-all duration-150 ${
        isSelected
          ? "border-primary/60 ring-1 ring-primary/20"
          : "border-border hover:border-border-strong hover:bg-surface-muted/40"
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
      {(compact ? columns.slice(0, 1) : columns).map((column) => (
        <div key={column.id} className="min-w-0">
          {renderCell(column)}
        </div>
      ))}

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
    previous.author === next.author &&
    previous.series === next.series &&
    previous.seriesIndex === next.seriesIndex &&
    previous.publisher === next.publisher &&
    previous.language === next.language &&
    previous.publishDate === next.publishDate &&
    previous.isbn === next.isbn &&
    previous.filePath === next.filePath &&
    previous.thumbnail === next.thumbnail &&
    previous.thumbnailPath === next.thumbnailPath &&
    previous.numPages === next.numPages &&
    previous.fileType === next.fileType &&
    previous.fileSize === next.fileSize &&
    previous.lastOpenedAt === next.lastOpenedAt &&
    previous.importedAt === next.importedAt &&
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

export default memo(BookListItem, (previous, next) => (
  areBooksEqual(previous.book, next.book) &&
  previous.showSyncActions === next.showSyncActions &&
  previous.isSelected === next.isSelected &&
  previous.selectionMode === next.selectionMode &&
  previous.isChecked === next.isChecked &&
  previous.selectedCount === next.selectedCount &&
  previous.gridTemplateColumns === next.gridTemplateColumns &&
  previous.columns === next.columns &&
  previous.compact === next.compact &&
  previous.canDropOnBook === next.canDropOnBook &&
  previous.onDropOnBook === next.onDropOnBook
));
