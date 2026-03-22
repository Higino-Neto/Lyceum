import { BookOpen } from "lucide-react";
import { BookWithThumbnail } from "../../../../types/LibraryTypes";
import BookCard from "./BookCard";
import BookListItem from "./BookListItem";

interface BookGridProps {
  books: BookWithThumbnail[];
  viewMode: "grid" | "list";
  onOpen: (filePath: string) => void;
  onSync?: (
    fileHash: string,
    action: "move" | "copy",
  ) => void;
  showSyncActions?: boolean;
  onBookClick?: (book: BookWithThumbnail) => void;
  selectedBookId?: number;
}

export default function BookGrid({
  books,
  viewMode,
  onOpen,
  onSync,
  showSyncActions,
  onBookClick,
  selectedBookId,
}: BookGridProps) {
  if (books.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <BookOpen size={22} className="text-zinc-600" />
        <p className="text-zinc-500 text-sm">Nenhum livro nesta seção.</p>
      </div>
    );
  }

  if (viewMode === "grid") {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
        {books.map((book) => (
          <BookCard
            key={book.id}
            book={book}
            onOpen={() => onOpen(book.filePath)}
            onSync={onSync ? (action) => onSync(book.fileHash, action) : undefined}
            showSyncActions={showSyncActions ?? false}
            onClick={() => onBookClick?.(book)}
            isSelected={selectedBookId === book.id}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {books.map((book) => (
        <BookListItem
          key={book.id}
          book={book}
          onOpen={() => onOpen(book.filePath)}
          onSync={onSync ? () => onSync(book.fileHash, "move") : undefined}
          showSyncActions={showSyncActions ?? false}
          onClick={() => onBookClick?.(book)}
          isSelected={selectedBookId === book.id}
        />
      ))}
    </div>
  );
}
