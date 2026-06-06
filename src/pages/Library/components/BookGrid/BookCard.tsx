import { Check, Copy, FileText, Move, MoreVertical, Trash2 } from "lucide-react";
import { memo, useState } from "react";
import { BookWithThumbnail } from "../../../../types/LibraryTypes";
import {
  formatPageCount,
  getBookFolderLabel,
  getFileTypeLabel,
  getTitleWithoutExtension,
} from "../../utils";
import { areBooksEqual } from "./BookListItem";
import { useLazyThumbnail } from "./useLazyThumbnail";

interface BookCardProps {
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
  onDragEnd,
  selectionMode = false,
  isChecked = false,
  selectedCount = 0,
  onToggleSelection,
  onContextSelect,
}: BookCardProps) {
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { thumbnail, thumbnailRef } = useLazyThumbnail(book);
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
      className={`bg-zinc-900 group relative flex flex-col rounded-sm p-2 gap-3 cursor-pointer transition-all ${
        isSelected ? "ring-2 ring-zinc-500 ring-offset-2 ring-offset-zinc-950 rounded-sm" : ""
      } ${isChecked ? "ring-2 ring-green-500 ring-offset-2 ring-offset-zinc-950 rounded-sm" : ""}`}
      onClick={handleClick}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextSelect?.(book);
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
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
    >
      {(selectionMode || isChecked) && (
        <div
          className={`absolute left-2 top-2 z-30 flex h-6 w-6 items-center justify-center rounded-sm border ${
            isChecked
              ? "border-green-500 bg-green-500 text-zinc-950"
              : "border-zinc-600 bg-zinc-950/80 text-transparent"
          }`}
        >
          <Check size={15} />
        </div>
      )}

      <div ref={thumbnailRef} className="relative aspect-[2/3] overflow-hidden rounded-sm border border-zinc-800 bg-zinc-900">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={book.title}
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <FileText size={28} className="text-zinc-600" />
          </div>
        )}
        
        {book.processingStatus === "processing" && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        
        {showSyncActions && onSync && hovered && (
          <div className="absolute top-2 right-2 z-20">
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setMenuOpen(!menuOpen);
              }}
              className="p-1 cursor-pointer bg-zinc-800 rounded hover:bg-zinc-700"
            >
              <MoreVertical size={14} />
            </button>
            {menuOpen && (
              <div
                className="absolute right-0 mt-1 w-36 bg-zinc-800 border border-zinc-700 rounded-sm shadow-lg z-30"
                onMouseLeave={() => setMenuOpen(false)}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onSync(book, "move");
                    setMenuOpen(false);
                  }}
                  className="flex cursor-pointer items-center gap-2 w-full px-3 py-2 text-xs hover:bg-zinc-700 rounded-t-sm"
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
                  className="flex items-center cursor-pointer gap-2 w-full px-3 py-2 text-xs hover:bg-zinc-700"
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
                    className="flex items-center cursor-pointer gap-2 w-full px-3 py-2 text-xs hover:bg-red-500/20 text-red-400 rounded-b-sm border-t border-zinc-700"
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
        <p className="text-xs text-zinc-300 line-clamp-2 leading-4">
          {getTitleWithoutExtension(book.title, book.fileType)}
        </p>
        <p className="mt-1 truncate text-xs text-zinc-500">
          {getBookFolderLabel(book.filePath)}
        </p>
        <div className="mt-auto flex items-center justify-between gap-2 pt-2 text-[11px] text-zinc-500">
          <span>{formatPageCount(book.numPages, book.fileType)}</span>
          <span className="rounded-sm bg-zinc-800 px-1.5 py-0.5 text-zinc-300">
            {formatLabel}
          </span>
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
  previous.selectedCount === next.selectedCount
));
