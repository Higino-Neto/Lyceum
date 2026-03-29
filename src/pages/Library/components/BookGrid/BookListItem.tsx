import { FileText, FolderInput } from "lucide-react";
import { BookWithThumbnail } from "../../../../types/LibraryTypes";
import { calculateProgress } from "./progress";

interface BookListItemProps {
  book: BookWithThumbnail;
  onOpen: () => void;
  onSync?: () => void;
  showSyncActions: boolean;
  onClick?: () => void;
  isSelected?: boolean;
}

export default function BookListItem({
  book,
  onOpen,
  onSync,
  showSyncActions,
  onClick,
  isSelected = false,
}: BookListItemProps) {
  const progress = calculateProgress(book);

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      onOpen();
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`cursor-pointer flex items-center gap-4 bg-zinc-900 border rounded-sm p-3 transition-all ${
        isSelected
          ? "border-zinc-500 ring-1 ring-zinc-500"
          : "border-zinc-800 hover:border-zinc-700"
      }`}
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

      <div className="flex-1 min-w-0">
        <p className="text-sm text-zinc-200 truncate">{book.title}</p>
        {book.author && (
          <p className="text-xs text-zinc-500 truncate">{book.author}</p>
        )}
        <div className="flex items-center gap-3 mt-1">
          <span className="text-xs text-zinc-600">
            {book.currentPage}/{book.numPages} pág.
          </span>
          <div className="h-1 w-20 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs text-zinc-600">{progress.toFixed(0)}%</span>
        </div>
      </div>

      {book.category && (
        <span className="text-xs text-zinc-500 px-2 py-1 bg-zinc-800 rounded">
          {book.category}
        </span>
      )}

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
