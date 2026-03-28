import { useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { getOrCreateBook } from "../api/database";
import { DocumentRecord } from "../types/ReadingTypes";

export interface Book {
  id: string;
  title: string;
  author: string | null;
  thumbnail_url: string | null;
  total_pages: number | null;
  isbn: string | null;
  description: string | null;
  published_date: string | null;
  external_id: string | null;
}

export interface LocalBook {
  id: number;
  title: string;
  fileHash: string;
  thumbnailPath: string | null;
  numPages: number;
  author: string | null;
  description: string | null;
}

export function useBookSearch() {
  const [results, setResults] = useState<Book[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchBooks = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }

    setLoading(true);
    setShowResults(true);
    setError(null);

    try {
      const [supabaseResults, localResults] = await Promise.all([
        supabase
          .from("books")
          .select("*")
          .ilike("title", `%${query}%`)
          .limit(10),
        window.api?.searchLocalBooks
          ? window.api.searchLocalBooks(query).catch(() => [])
          : Promise.resolve([]),
      ]);

      if (supabaseResults.error) {
        console.error("Error searching books:", supabaseResults.error);
      }

      const combinedResults: Book[] = [...(supabaseResults.data || [])];

      if (localResults && localResults.length > 0) {
        const localBooks: Book[] = localResults.map((doc: DocumentRecord) => ({
          id: doc.fileHash || `local-${doc.id}`,
          title: doc.title,
          author: doc.author || null,
          thumbnail_url: doc.thumbnailPath ? `file://${doc.thumbnailPath}` : null,
          total_pages: doc.numPages || null,
          isbn: null,
          description: doc.description || null,
          published_date: null,
          external_id: doc.fileHash || null,
        }));
        combinedResults.push(...localBooks);
      }

      if (combinedResults.length > 0) {
        setResults(combinedResults);
      } else {
        setResults([]);
        setError("Nenhum livro encontrado. Digite o nome manualmente.");
      }
    } catch (err) {
      console.error("Error searching books:", err);
      setError("Erro ao buscar livros");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const findOrCreateBook = useCallback(
    async (book: Book): Promise<string> => {
      if (book.id && !book.id.startsWith("google-")) {
        return book.id;
      }

      return getOrCreateBook(
        book.title,
        book.author || undefined,
        book.thumbnail_url || undefined,
        book.total_pages || undefined,
        book.isbn || undefined,
        book.description || undefined,
        book.published_date || undefined,
        book.external_id || undefined
      );
    },
    []
  );

  return {
    results,
    loading,
    showResults,
    error,
    searchBooks,
    findOrCreateBook,
    setShowResults,
  };
}
