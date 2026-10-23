import { AlertTriangle, Ban, BookmarkCheck, BookOpen, Check, CheckCircle, CircleHelp, Copy, FileText, Folder, Move, MoreVertical, PauseCircle, Trash2 } from "lucide-react";
import { memo, useState, type DragEvent } from "react";
import { BookWithThumbnail } from "../../../../types/LibraryTypes";
import {
  formatPageCount,
  getBookFolderLabel,
  getFileTypeLabel,
  getTitleWithoutExtension,
} from "../../utils";
import { areBooksEqual } from "./BookListItem";
import { useLazyThumbnail } from "./useLazyThumbnail";
import { setBookDragImage } from "../../utils/bookDragPreview";
import { useTranslation } from "../../../../i18n";
import { getEffectiveReadingStatus, getGroupRating, getGroupReadingStatus, isMergedGroup, READING_STATUS_LABEL_KEYS } from "../../../../lib/readingStatus";

interface BookCardProps {
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
}

function CollectionThumbnailTile({ book }: { book: BookWithThumbnail }) {
  const { thumbnail, thumbnailRef } = useLazyThumbnail(book);

  return (
    <div ref={thumbnailRef} className="min-h-0 min-w-0 overflow-hidden bg-background">
      {thumbnail ? (
        <img
          src={thumbnail}
          alt={book.title}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <FileText size={18} className="text-foreground" />
        </div>
      )}
    </div>
  );
}

function CollectionThumbnailGrid({
  books,
}: {
  books: BookWithThumbnail[];
}) {
  const previewBooks = books.slice(0, 4);

  if (previewBooks.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <FileText size={28} className="text-foreground-subtle" />
      </div>
    );
  }

  return (
    <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-px bg-surface-muted">
      {previewBooks.map((previewBook) => (
        <CollectionThumbnailTile
          key={previewBook.fileHash}
          book={previewBook}
        />
      ))}
      {Array.from({ length: Math.max(0, 4 - previewBooks.length) }).map((_, index) => (
        <div key={`empty-${index}`} className="bg-background" />
      ))}
    </div>
  );
}

function BookCard({
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
}: BookCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { thumbnail, thumbnailRef } = useLazyThumbnail(book);
  const { t } = useTranslation();
  const formatCount = book.mergedBooks?.length || 1;
  const isCollection = book.syntheticFolderType === "collection";
  const showCollectionGrid =
    isCollection && (book.mergedBooks?.length || 0) > 1;
  const formatLabel =
    formatCount > 1
      ? Array.from(new Set(book.mergedBooks?.map((variant) => getFileTypeLabel(variant.fileType, variant.filePath)))).join(" / ")
      : getFileTypeLabel(book.fileType, book.filePath);

  // Merged variants behave as one book: the grid shows one shared status and
  // score instead of whichever variant happens to be the representative.
  const effectiveStatus = isMergedGroup(book)
    ? getGroupReadingStatus(book)
    : getEffectiveReadingStatus(book);
  const bookScore = isMergedGroup(book)
    ? getGroupRating(book)
    : Math.max(0, Number(book.rating) || 0);
  const statusIcon = (() => {
    switch (effectiveStatus) {
      case "reading":
        return { Icon: BookOpen, color: "text-primary" };
      case "want_to_read":
        return { Icon: BookmarkCheck, color: "text-warning" };
      case "read":
        return { Icon: CheckCircle, color: "text-primary" };
      case "paused":
        return { Icon: PauseCircle, color: "text-warning" };
      case "not_a_book":
        return { Icon: Ban, color: "text-foreground-subtle" };
      case "unknown":
        return { Icon: CircleHelp, color: "text-foreground-subtle" };
      default:
        return null;
    }
  })();
  const showScore = effectiveStatus === "read" && bookScore > 0;

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
      className={`lyceum-interactive-card bg-surface group relative flex flex-col rounded-sm p-2 gap-3 cursor-pointer transition-shadow ${
          isSelected ? "ring-2 ring-border-strong ring-offset-2 ring-offset-surface rounded-sm" : ""
        } ${isChecked ? "ring-2 ring-focus-ring ring-offset-2 ring-offset-surface rounded-sm" : ""} ${
          isCollection ? "border border-dashed border-border-strong/40 hover:border-primary/40" : ""
        }`}
      onClick={handleClick}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextSelect?.(book);
      }}
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
      {(selectionMode || isChecked) && (
        <div
          className={`lyceum-selection-mark absolute left-2 top-2 z-30 flex h-6 w-6 items-center justify-center rounded-sm border ${
            isChecked
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border-strong bg-background/80 text-transparent"
          }`}
        >
          <Check size={15} />
        </div>
      )}

      <div ref={thumbnailRef} className={`relative aspect-[2/3] overflow-hidden rounded-sm border bg-surface ${
          showCollectionGrid ? "border-dashed border-border-strong/60" : "border-border"
        }`}>
        {showCollectionGrid ? (
          <div className="relative h-full w-full">
            <CollectionThumbnailGrid books={book.mergedBooks || []} />
            <div className="absolute bottom-1.5 right-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-sm bg-overlay border border-border-strong/60 shadow-sm">
              <Folder size={13} className="text-primary" />
            </div>
          </div>
        ) : thumbnail ? (
          <img
            src={thumbnail}
            alt={book.title}
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <FileText size={28} className="text-foreground-subtle" />
          </div>
        )}
        
        {book.processingStatus === "processing" && (
          <div className="absolute inset-0 bg-backdrop flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-border border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {statusIcon && (
          <div className="absolute top-1.5 left-1.5 z-20 rounded-md bg-overlay p-1 border border-border/80 shadow-md" title={t(READING_STATUS_LABEL_KEYS[effectiveStatus])}>
            <statusIcon.Icon size={16} className={`${statusIcon.color} drop-shadow-sm`} />
          </div>
        )}
        {book.processingStatus === "failed" && (
          <div className="absolute top-1.5 left-1.5 z-20" title={t("library:toasts.corruptedFile")}>
            <AlertTriangle size={15} className="text-warning drop-shadow-sm" />
          </div>
        )}
        
        {showSyncActions && onSync && (
          <div className="absolute top-2 right-2 z-20 hidden group-hover:block">
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setMenuOpen(!menuOpen);
              }}
              className="p-1 cursor-pointer bg-surface-muted rounded hover:bg-border-strong"
            >
              <MoreVertical size={14} />
            </button>
            {menuOpen && (
              <div
                className="absolute right-0 mt-1 w-36 bg-surface-muted border border-border-strong rounded-sm shadow-lg z-30"
                onMouseLeave={() => setMenuOpen(false)}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onSync(book, "move");
                    setMenuOpen(false);
                  }}
                  className="flex cursor-pointer items-center gap-2 w-full px-3 py-2 text-xs hover:bg-border-strong rounded-t-sm"
                >
                  <Move size={12} /> Mover para library
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onSync(book, "copy");
                    setMenuOpen(false);
                  }}
                  className="flex items-center cursor-pointer gap-2 w-full px-3 py-2 text-xs hover:bg-border-strong"
                >
                  <Copy size={12} /> Copiar para library
                </button>
                {onDelete && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      onDelete(book);
                      setMenuOpen(false);
                    }}
                    className="flex items-center cursor-pointer gap-2 w-full px-3 py-2 text-xs hover:bg-destructive-muted text-destructive rounded-b-sm border-t border-border-strong"
                  >
                    <Trash2 size={12} /> Remover
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex h-[72px] flex-col">
        <p className={`text-xs leading-4 ${isCollection ? "font-medium text-foreground" : "text-foreground"} line-clamp-2`}>
          {getTitleWithoutExtension(book.title, book.fileType)}
        </p>
        <p className="mt-1 truncate text-xs text-foreground-subtle">
          {getBookFolderLabel(book.filePath)}
        </p>
        <div className="mt-auto flex items-center justify-between gap-2 pt-2 text-[11px] text-foreground-subtle">
          {isCollection ? (
            <>
              <span>{book.mergedBooks?.length || 0} livros</span>
              <span className="bg-surface-muted rounded-sm px-1.5 py-0.5 text-foreground ">
                Coleção
              </span>
            </>
          ) : (
            <>
              <span>{formatPageCount(book.numPages, book.fileType)}</span>
              {showScore && (
                <span className="rounded-sm bg-surface-muted px-1.5 py-0.5 text-foreground">
                  {Number(bookScore).toFixed(1)}/10
                </span>
              )}
              <span className="rounded-sm bg-surface-muted px-1.5 py-0.5 text-foreground">
                {formatLabel}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(BookCard, (previous, next) => (
  areBooksEqual(previous.book, next.book) &&
  previous.showSyncActions === next.showSyncActions &&
  previous.isSelected === next.isSelected &&
  previous.selectionMode === next.selectionMode &&
  previous.isChecked === next.isChecked &&
  previous.selectedCount === next.selectedCount &&
  previous.canDropOnBook === next.canDropOnBook &&
  previous.onDropOnBook === next.onDropOnBook
));
