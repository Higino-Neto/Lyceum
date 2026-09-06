import { useCallback, useEffect, useState } from "react";
import type { MobileLibraryState, MobileTab } from "./types";
import { resolveMobileBookDataUrl } from "./bookFileStorage";
export function useMobileReaderState(state: MobileLibraryState, setState: React.Dispatch<React.SetStateAction<MobileLibraryState>>, setActiveTab: (tab: MobileTab) => void) {
  const [readerDataUrls, setReaderDataUrls] = useState<Record<string, string | undefined>>({});
  const [readerFileLoading, setReaderFileLoading] = useState(false);
  const selectedBook = state.books.find((book) => book.id === state.selectedBookId) || state.books[0];
  const selectedBookDataUrl = selectedBook ? (readerDataUrls[selectedBook.id] || selectedBook.dataUrl) : undefined;
  const isPdfBook = selectedBook?.fileType === "pdf";
  const isEbookReader = selectedBook?.fileType === "pdf" || selectedBook?.fileType === "epub";

  useEffect(() => {
    let cancelled = false;
    const book = selectedBook;

    if (!book || !["epub", "pdf", "txt"].includes(book.fileType)) {
      setReaderFileLoading(false);
      return () => {
        cancelled = true;
      };
    }

    if (book.dataUrl || readerDataUrls[book.id]) {
      setReaderFileLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setReaderFileLoading(Boolean(book.storagePath));
    resolveMobileBookDataUrl(book)
      .then((dataUrl) => {
        if (cancelled) return;
        if (dataUrl) {
          setReaderDataUrls((current) => ({ ...current, [book.id]: dataUrl }));
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setReaderFileLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [readerDataUrls, selectedBook]);

  const selectBook = useCallback((bookId: string) => {
    setState((current) => ({ ...current, selectedBookId: bookId, books: current.books.map(book => book.id === bookId ? { ...book, lastOpenedAt: new Date().toISOString() } : book) }));
    setActiveTab("reader");
  }, [setActiveTab, setState]);

  return { selectedBook, selectedBookDataUrl, isPdfBook, isEbookReader, readerDataUrls, setReaderDataUrls, readerFileLoading, selectBook };
}
