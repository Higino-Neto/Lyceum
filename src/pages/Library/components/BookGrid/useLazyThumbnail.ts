import { useEffect, useRef, useState } from "react";
import { BookWithThumbnail } from "../../../../types/LibraryTypes";

function getThumbnailSrc(book: BookWithThumbnail): string | undefined {
  if (book.thumbnail) return book.thumbnail;
  if (book.thumbnailPath) {
    const baseName = book.thumbnailPath.split(/[/\\]/).pop() || "";
    const hash = baseName.split("-")[0];
    if (/^[a-f0-9]{64}$/i.test(hash)) return `thumb://${hash}`;
  }
  return undefined;
}

export function useLazyThumbnail(book: BookWithThumbnail) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [src, setSrc] = useState<string | undefined>(() => getThumbnailSrc(book));

  useEffect(() => {
    setSrc(getThumbnailSrc(book));
  }, [book.fileHash, book.thumbnail, book.thumbnailPath]);

  return { thumbnail: src, thumbnailRef: containerRef };
}
