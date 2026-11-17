import { AlertTriangle, Check, Copy, FileText, Minus, Move, MoreVertical, Star, Trash2 } from "lucide-react";
import { memo, useState, type DragEvent, type MouseEvent } from "react";
import { getSelectionModifiers, type SelectionModifiers } from "./selectionModifiers";
import { BookWithThumbnail } from "../../../../types/LibraryTypes";
import {
  formatPageCount,
  getBookFolderLabel,
  getTitleWithoutExtension,
} from "../../utils";
import FormatChips from "./FormatChips";
import { getFileSelectionState } from "./bookFiles";
import { areBooksEqual } from "./BookListItem";
import { useLazyThumbnail } from "./useLazyThumbnail";
import { setBookDragImage } from "../../utils/bookDragPreview";
import { useTranslation } from "../../../../i18n";
import { READING_STATUS_LABEL_KEYS } from "../../../../lib/readingStatus";
import { getDisplayRating, getDisplayReadingStatus, getReadingStatusIcon } from "./bookStatus";

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
  /** Comma-joined hashes of this book's selected files (see getSelectedFilesKey). */
  selectedFilesKey?: string;
  selectedCount?: number;
  onToggleSelection?: (book: BookWithThumbnail, modifiers?: SelectionModifiers) => void;
  onContextSelect?: (book: BookWithThumbnail, modifiers?: SelectionModifiers) => void;
  onToggleFile?: (file: BookWithThumbnail) => void;
  canDropOnBook?: (book: BookWithThumbnail) => boolean;
  onDropOnBook?: (book: BookWithThumbnail, event: DragEvent<HTMLDivElement>) => void;
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
  selectedFilesKey = "",
  selectedCount = 0,
  onToggleSelection,
  onContextSelect,
  onToggleFile,
  canDropOnBook,
  onDropOnBook,
}: BookCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { thumbnail, thumbnailRef } = useLazyThumbnail(book);
  const { t } = useTranslation();
  const selectionState = getFileSelectionState(book, selectedFilesKey);
  const isChecked = selectionState === "all";
  const isPartial = selectionState === "partial";

  const effectiveStatus = getDisplayReadingStatus(book);
  const bookScore = getDisplayRating(book);
  const statusIcon = getReadingStatusIcon(effectiveStatus);
  const showScore = effectiveStatus === "read" && bookScore > 0;

  const handleClick = (event: MouseEvent) => {
    const modifiers = getSelectionModifiers(event);
    if (selectionMode || ((modifiers.shiftKey || modifiers.ctrlKey) && onToggleSelection)) {
      onToggleSelection?.(book, modifiers);
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
          isSelected && !(isChecked || isPartial) ? "bg-surface-muted" : ""
        } ${isChecked || isPartial ? "bg-primary-muted/60" : ""}`}
      onClick={handleClick}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextSelect?.(book, getSelectionModifiers(e));
      }}
      draggable={!selectionMode || isChecked || isPartial}
      onDragStartCapture={(e) => {
        if (selectionMode && !isChecked && !isPartial) {
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
      {(selectionMode || isChecked || isPartial) && (
        <div
          className={`lyceum-selection-mark absolute left-2 top-2 z-30 flex h-6 w-6 items-center justify-center rounded-sm border ${
            isChecked || isPartial
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border-strong bg-background/80 text-transparent"
          }`}
        >
          {isPartial ? <Minus size={15} /> : <Check size={15} />}
        </div>
      )}

      <div ref={thumbnailRef} className="relative aspect-[2/3] overflow-hidden rounded-sm border border-border bg-surface">
        {thumbnail ? (
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
        {showScore && (
          <div className="absolute bottom-1.5 right-1.5 z-20 flex items-center gap-1 rounded-sm border border-border/80 bg-overlay px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-foreground shadow-md">
            <Star size={11} className="fill-current text-warning" aria-hidden />
            {Number(bookScore).toFixed(1)}
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
        <p className="text-xs leading-4 text-foreground line-clamp-2">
          {getTitleWithoutExtension(book.title, book.fileType)}
        </p>
        <p className="mt-1 truncate text-xs text-foreground-subtle">
          {getBookFolderLabel(book.filePath)}
        </p>
        {/* The page count yields space first; chips never wrap out of the card. */}
        <div className="mt-auto flex min-w-0 items-end justify-between gap-2 overflow-hidden pt-2 text-[11px] text-foreground-subtle">
          <span className="min-w-0 flex-1 truncate">{formatPageCount(book.numPages, book.fileType)}</span>
          <FormatChips
            book={book}
            selectedFilesKey={selectedFilesKey}
            onToggleFile={onToggleFile}
            className="min-w-0 max-w-full justify-end"
            compact
          />
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
  previous.selectedFilesKey === next.selectedFilesKey &&
  previous.onToggleFile === next.onToggleFile &&
  previous.selectedCount === next.selectedCount &&
  previous.canDropOnBook === next.canDropOnBook &&
  previous.onDropOnBook === next.onDropOnBook
));
