import { useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { getOrCreateBook } from "../api/database";

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
      const { data: localBooks, error: localError } = await supabase
        .from("books")
        .select("*")
        .ilike("title", `%${query}%`)
        .limit(10);

      if (localError) {
        console.error("Error searching books:", localError);
        setError("Erro ao buscar livros");
        setResults([]);
        setLoading(false);
        return;
      }

      if (localBooks && localBooks.length > 0) {
        setResults(localBooks);
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
