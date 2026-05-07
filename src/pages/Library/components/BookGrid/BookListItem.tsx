import { Check, Copy, FileText, Move, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { BookWithThumbnail } from "../../../../types/LibraryTypes";
import {
  formatFileSize,
  formatPageCount,
  formatShortDate,
  getBookFolderLabel,
  getFileTypeLabel,
  getTitleWithoutExtension,
} from "../../utils";

export interface ExplorerColumns {
  name: number;
  folder: number;
  type: number;
  pages: number;
  modified: number;
  size: number;
}

interface BookListItemProps {
  book: BookWithThumbnail;
  onOpen: () => void;
  onSync?: (action: "move" | "copy") => void;
  onDelete?: () => void;
  showSyncActions: boolean;
  onClick?: () => void;
  isSelected?: boolean;
  onDragStart?: (fileHash: string) => void;
  onDragEnd?: () => void;
  selectionMode?: boolean;
  isChecked?: boolean;
  selectedCount?: number;
  onToggleSelection?: () => void;
  onContextSelect?: () => void;
  columns: ExplorerColumns;
}

export default function BookListItem({
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
  columns,
}: BookListItemProps) {
  const [thumbnail, setThumbnail] = useState(book.thumbnail);

  useEffect(() => {
    let canceled = false;
    setThumbnail(book.thumbnail);

    if (!book.thumbnail && book.thumbnailPath) {
      window.api.getThumbnail(book.thumbnailPath).then((value: string | null) => {
        if (!canceled) {
          setThumbnail(value || undefined);
        }
      });
    }

    return () => {
      canceled = true;
    };
  }, [book.thumbnail, book.thumbnailPath]);

  const handleClick = () => {
    if (selectionMode) {
      onToggleSelection?.();
      return;
    }

    if (onClick) {
      onClick();
    } else {
      onOpen();
    }
  };

  return (
    <div
      onClick={handleClick}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextSelect?.();
      }}
      className={`grid min-h-12 cursor-pointer items-center rounded-sm border bg-zinc-900 transition-all ${
        isSelected
          ? "border-zinc-500 ring-1 ring-zinc-500"
          : "border-zinc-800 hover:border-zinc-700"
      } ${isChecked ? "border-green-500 bg-green-950/20" : ""}`}
      style={{
        gridTemplateColumns: `${columns.name}px ${columns.folder}px ${columns.type}px ${columns.pages}px ${columns.modified}px ${columns.size}px 76px`,
      }}
      draggable={!selectionMode || isChecked}
      onDragStart={(e) => {
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
      onDragEnd={() => onDragEnd?.()}
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
        <div className="h-11 w-8 flex-shrink-0 overflow-hidden rounded-sm bg-zinc-800">
          {thumbnail ? (
            <img
              src={thumbnail}
              alt={book.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <FileText size={14} className="text-zinc-600" />
            </div>
          )}
        </div>
        <p className="min-w-0 truncate text-sm text-zinc-200">
          {getTitleWithoutExtension(book.title, book.fileType)}
        </p>
      </div>

      <div className="truncate px-3 py-2 text-xs text-zinc-500">
        {getBookFolderLabel(book.filePath)}
      </div>
      <div className="px-3 py-2 text-xs text-zinc-400">
        {getFileTypeLabel(book.fileType, book.filePath)}
      </div>
      <div className="px-3 py-2 text-xs text-zinc-400">
        {formatPageCount(book.numPages, book.fileType)}
      </div>
      <div className="px-3 py-2 text-xs text-zinc-500">
        {formatShortDate(book.lastOpenedAt || book.createdAt)}
      </div>
      <div className="px-3 py-2 text-xs text-zinc-500">
        {formatFileSize(book.fileSize)}
      </div>

      <div className="flex justify-end gap-1 px-2">
        {showSyncActions && onSync && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSync("move");
              }}
              className="cursor-pointer rounded p-2 hover:bg-zinc-800"
              title="Mover para library"
            >
              <Move size={15} className="text-zinc-400" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSync("copy");
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
              onDelete();
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
