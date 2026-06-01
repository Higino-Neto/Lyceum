import { useEffect, useRef, useState } from "react";
import { BookWithThumbnail } from "../../../../types/LibraryTypes";
import { thumbnailCache } from "./thumbnailCache";

export function useLazyThumbnail(book: BookWithThumbnail) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(Boolean(book.thumbnail));
  const [thumbnail, setThumbnail] = useState<string | undefined>(book.thumbnail);

  useEffect(() => {
    setThumbnail(book.thumbnail);
    setIsVisible(Boolean(book.thumbnail));
  }, [book.fileHash, book.thumbnail, book.thumbnailPath]);

  useEffect(() => {
    if (book.thumbnail || !book.thumbnailPath) return;

    const element = containerRef.current;
    if (!element || !("IntersectionObserver" in window)) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setIsVisible(true);
        observer.disconnect();
      },
      { rootMargin: "240px 0px" },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [book.thumbnail, book.thumbnailPath]);

  useEffect(() => {
    if (book.thumbnail || !book.thumbnailPath || !isVisible) return;

    const cached = thumbnailCache.get(book.thumbnailPath);
    if (cached) {
      setThumbnail(cached);
      return;
    }

    const unsubscribe = thumbnailCache.subscribe(book.thumbnailPath, setThumbnail);
    thumbnailCache.load(book.thumbnailPath, "visible");
    return unsubscribe;
  }, [book.thumbnail, book.thumbnailPath, isVisible]);

  return { thumbnail, thumbnailRef: containerRef };
}
