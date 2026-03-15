import { Copy, FileText, Move, MoreVertical } from "lucide-react";
import { useState } from "react";
import { BookWithThumbnail } from "../../../../types/LibraryTypes";
import { calculateProgress } from "./progress";

interface BookCardProps {
  book: BookWithThumbnail;
  onOpen: () => void;
  onSync?: (action: "move" | "copy") => void;
  showSyncActions: boolean;
}

export default function BookCard({
  book,
  onOpen,
  onSync,
  showSyncActions,
}: BookCardProps) {
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const progress = calculateProgress(book);

  return (
    <div
      className="flex flex-col gap-2 cursor-pointer group"
      onClick={onOpen}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="relative rounded-sm overflow-hidden aspect-[4/5] bg-zinc-900 border border-zinc-800">
        {book.thumbnail ? (
          <img
            src={book.thumbnail}
            alt={book.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <FileText size={28} className="text-zinc-600" />
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
                    onSync("move");
                    setMenuOpen(false);
                  }}
                  className="flex cursor-pointer items-center gap-2 w-full px-3 py-2 text-xs hover:bg-zinc-700 rounded-t-md"
                >
                  <Move size={12} /> Mover para library
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onSync("copy");
                    setMenuOpen(false);
                  }}
                  className="flex items-center cursor-pointer gap-2 w-full px-3 py-2 text-xs hover:bg-zinc-700 rounded-b-md"
                >
                  <Copy size={12} /> Copiar para library
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <p className="text-xs text-zinc-300 line-clamp-2">{book.title}</p>
      {book.category && (
        <span className="text-xs text-zinc-500">{book.category}</span>
      )}

      <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-green-500"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
