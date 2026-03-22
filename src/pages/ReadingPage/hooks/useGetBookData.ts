import { useEffect, useState } from "react";

export interface BookData {
  id: number;
  title: string;
  filePath: string;
  fileHash: string;
  currentPage: number;
  currentZoom: number | null;
  currentScroll: number | null;
  annotations: string | null;
  thumbnailPath: string | null;
  numPages: number;
  createdAt: string;
  lastOpenedAt: string;
  isSynced: number;
  category: string | null;
  isFavorite: number;
  rating: number;
  notes: string | null;
  author: string | null;
  description: string | null;
  isbn: string | null;
  publisher: string | null;
  publishDate: string | null;
  fileSize: number;
  processingStatus: "pending" | "processing" | "completed" | "failed";
}

export default function useGetBookData() {
  const [books, setBooks] = useState<BookData[] | null>(null);

  useEffect(() => {
    async function fetchBooks() {
      const docs = await window.api.getDocuments();
      setBooks(docs as BookData[]);
    }
    fetchBooks();
  }, []);

  return books;
}
