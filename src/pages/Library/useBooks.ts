import { useEffect, useState, useCallback } from "react";
import useGetBookData, { BookData } from "../ReadingPage/hooks/useGetBookData";
import { BookWithThumbnail } from "../../types/LibraryTypes";
import toast from "react-hot-toast";

async function addThumbnailToBook(book: BookData): Promise<BookWithThumbnail> {
  if (book.thumbnailPath) {
    const thumbnail = await window.api.getThumbnail(book.thumbnailPath);
    return { ...book, thumbnail: thumbnail || undefined };
  }
  return { ...book };
}

export default function useBooks() {
  const books = useGetBookData();

  const [syncedBooks, setSyncedBooks] = useState<BookWithThumbnail[]>([]);
  const [unsyncedBooks, setUnsyncedBooks] = useState<BookWithThumbnail[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const refreshBooks = useCallback(async () => {
    const allBooks = await window.api.getDocuments();
    
    const synced = await Promise.all(
      allBooks
        .filter((book) => book.isSynced === 1)
        .map(addThumbnailToBook),
    );

    const unsynced = await Promise.all(
      allBooks
        .filter((book) => !book.isSynced || book.isSynced !== 1)
        .map(addThumbnailToBook),
    );

    setSyncedBooks(synced);
    setUnsyncedBooks(unsynced);

    const cats = await window.api.getCategories();
    setCategories(cats);
  }, []);

  const handleSync = async (
    fileHash: string,
    action: "move" | "copy",
    category?: string,
  ) => {
    const result = await window.api.syncDocument(fileHash, action, category);
    if (result.success) {
      toast.success("Livro sincronizado com sucesso!");
      await refreshBooks();
    } else {
      toast.error("Erro ao sincronizar: " + result.error);
    }
  };

  useEffect(() => {
    refreshBooks();
  }, [refreshBooks]);

  return {
    syncedBooks,
    unsyncedBooks,
    categories,
    selectedCategory,
    setSelectedCategory,
    handleSync,
    refreshBooks,
  };
}
