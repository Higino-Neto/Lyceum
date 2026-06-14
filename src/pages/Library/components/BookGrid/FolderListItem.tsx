import {
  BookOpen,
  Boxes,
  ChevronRight,
  Folder,
  MoreVertical,
} from "lucide-react";
import type {
  DragEventHandler,
  KeyboardEvent,
  MouseEvent,
} from "react";
import type { FolderInfo } from "../../../../types/LibraryTypes";
import type { ListLayoutMode } from "./BookListItem";

interface FolderListItemProps {
  folder: FolderInfo;
  bookCount: number;
  folderCount: number;
  detail?: string;
  gridTemplateColumns: string;
  listLayout: ListLayoutMode;
  isSelected?: boolean;
  isDropTarget?: boolean;
  onOpen?: (folderPath: string) => void;
  onContextMenu?: (event: MouseEvent) => void;
  onDragOver?: DragEventHandler<HTMLDivElement>;
  onDragLeave?: DragEventHandler<HTMLDivElement>;
  onDrop?: DragEventHandler<HTMLDivElement>;
}

function formatCount(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export default function FolderListItem({
  folder,
  bookCount,
  folderCount,
  detail,
  gridTemplateColumns,
  listLayout,
  isSelected = false,
  isDropTarget = false,
  onOpen,
  onContextMenu,
  onDragOver,
  onDragLeave,
  onDrop,
}: FolderListItemProps) {
  const open = () => onOpen?.(folder.path);
  const metadata = `${formatCount(folderCount, "subpasta", "subpastas")} - ${formatCount(bookCount, "livro", "livros")}`;

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    open();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Abrir pasta ${folder.name}`}
      aria-pressed={isSelected || undefined}
      title={detail ? `${folder.name}\n${detail}` : folder.name}
      onClick={open}
      onKeyDown={handleKeyDown}
      onContextMenu={(event) => {
        if (!onContextMenu) return;
        event.preventDefault();
        onContextMenu(event);
      }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={[
        "grid min-h-12 cursor-pointer items-center rounded-sm border bg-zinc-950/70 transition-colors",
        "hover:border-emerald-400/55 hover:bg-zinc-900",
        isSelected ? "border-emerald-400/80 bg-emerald-500/10 ring-1 ring-emerald-400/35" : "border-zinc-800",
        isDropTarget ? "border-emerald-400 bg-emerald-500/10 ring-1 ring-emerald-400/70" : "",
      ].join(" ")}
      style={{ gridTemplateColumns }}
    >
      <div className="flex min-w-0 items-center gap-3 px-3 py-2">
        <div className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-sm border border-emerald-400/20 bg-emerald-400/10 text-emerald-200">
          <Folder size={22} strokeWidth={1.5} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-zinc-100">
            {folder.name}
          </p>
          {(listLayout === "compact" || listLayout === "narrow") && (
            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5 text-[11px] text-zinc-500">
              <span className="rounded-sm bg-emerald-400/10 px-1.5 py-0.5 uppercase text-emerald-200">
                Pasta
              </span>
              <span className="min-w-0 truncate">{metadata}</span>
            </div>
          )}
        </div>
      </div>

      {(listLayout === "full" || listLayout === "medium") && (
        <div className="truncate px-3 py-2 text-xs text-zinc-500">
          {detail || "Pasta"}
        </div>
      )}
      {(listLayout === "full" || listLayout === "medium") && (
        <div className="px-3 py-2 text-xs text-emerald-200">Pasta</div>
      )}
      {listLayout !== "narrow" && (
        <div className="px-3 py-2 text-xs text-zinc-400">
          <span className="inline-flex items-center gap-1">
            <BookOpen size={12} className={bookCount > 0 ? "text-amber-200/80" : "text-zinc-600"} />
            {formatCount(bookCount, "livro", "livros")}
          </span>
        </div>
      )}
      {(listLayout === "full" || listLayout === "medium") && (
        <div className="px-3 py-2 text-xs text-zinc-400">
          <span className="inline-flex items-center gap-1">
            <Boxes size={12} className={folderCount > 0 ? "text-emerald-300/80" : "text-zinc-600"} />
            {formatCount(folderCount, "subpasta", "subpastas")}
          </span>
        </div>
      )}
      {listLayout === "full" && (
        <div className="px-3 py-2 text-xs text-zinc-600">-</div>
      )}

      <div className="flex justify-end gap-1 px-2">
        {onContextMenu && (
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onContextMenu(event);
            }}
            className="cursor-pointer rounded p-2 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
            aria-label={`Mais ações de ${folder.name}`}
            title={`Mais ações de ${folder.name}`}
          >
            <MoreVertical size={15} />
          </button>
        )}
        <span className="flex h-8 w-8 items-center justify-center rounded-sm text-emerald-200">
          <ChevronRight size={16} />
        </span>
      </div>
    </div>
  );
}
