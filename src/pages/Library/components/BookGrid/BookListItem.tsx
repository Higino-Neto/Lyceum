import { FileText, FolderInput } from "lucide-react";
import { BookWithThumbnail } from "../../../../types/LibraryTypes";
import { calculateProgress } from "./progress";

interface BookListItemProps {
  book: BookWithThumbnail;
  onOpen: () => void;
  onSync?: () => void;
  showSyncActions: boolean;
}

export default function BookListItem({
  book,
  onOpen,
  onSync,
  showSyncActions,
}: BookListItemProps) {
  const progress = calculateProgress(book);

  return (
    <div
      onClick={onOpen}
      className="cursor-pointer flex items-center gap-4 bg-zinc-900 border border-zinc-800 rounded-sm p-3"
    >
      <div className="w-10 h-14 bg-zinc-800 rounded-sm overflow-hidden">
        {book.thumbnail ? (
          <img
            src={book.thumbnail}
            alt={book.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <FileText size={14} className="text-zinc-600 m-auto" />
        )}
      </div>

      <div className="flex-1">
        <p className="text-sm text-zinc-200">{book.title}</p>
        {book.category && (
          <span className="text-xs text-zinc-500">{book.category}</span>
        )}
        <div className="h-1 mt-1 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {showSyncActions && onSync && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSync();
          }}
          className="p-2 hover:bg-zinc-800 rounded cursor-pointer"
          title="Mover para library"
        >
          <FolderInput size={16} className="text-zinc-400" />
        </button>
      )}
    </div>
  );
}
