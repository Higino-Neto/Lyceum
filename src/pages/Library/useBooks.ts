import { useEffect, useState } from "react";
import useGetBookData from "../ReadingPage/hooks/useGetBookData";
import { BookWithThumbnail } from "../../types/LibraryTypes";
import { DocumentRecord } from "../../types/ReadingTypes";
import toast from "react-hot-toast";

async function addThumbnailToBook(book: DocumentRecord): Promise<BookWithThumbnail> {
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

  const handleSync = async (
    fileHash: string,
    action: "move" | "copy",
    category?: string,
  ) => {
    const result = await window.api.syncDocument(fileHash, action, category);
    if (result.success) {
      toast.success("Livro sincronizado com sucesso!");
      await window.api.scanLibrary();
      window.location.reload();
    } else {
      toast.error("Erro ao sincronizar: " + result.error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      if (!books) return;

      const synced = await Promise.all(
        books
          .filter((book) => book.isSynced === 1)
          .map(addThumbnailToBook),
      );

      const unsynced = await Promise.all(
        books
          .filter((book) => !book.isSynced || book.isSynced !== 1)
          .map(addThumbnailToBook),
      );

      setSyncedBooks(synced);
      setUnsyncedBooks(unsynced);

      const cats = await window.api.getCategories();
      setCategories(cats);
    };

    loadData();
  }, [books]);

  return {
    syncedBooks,
    unsyncedBooks,
    categories,
    selectedCategory,
    setSelectedCategory,
    handleSync,
  };
}
