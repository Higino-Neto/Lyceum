import { FileText } from "lucide-react";
import type { BookWithThumbnail } from "../../../types/LibraryTypes";
import { useLazyThumbnail } from "../../Library/components/BookGrid/useLazyThumbnail";

export function LocalCover({ book }: { book: BookWithThumbnail }) {
  const { thumbnail, thumbnailRef } = useLazyThumbnail(book);

  return (
    <div
      ref={thumbnailRef}
      className="flex aspect-[2/3] w-full flex-shrink-0 items-center justify-center overflow-hidden rounded-sm border border-border bg-background"
    >
      {thumbnail ? (
        <img src={thumbnail} alt={book.title} className="h-full w-full object-contain" />
      ) : (
        <FileText size={18} className="text-foreground-subtle" />
      )}
    </div>
  );
}
