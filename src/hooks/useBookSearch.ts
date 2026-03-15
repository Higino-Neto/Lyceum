import { useState, useCallback } from "react";
import { supabase } from "../lib/supabase";

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

interface GoogleBookItem {
  id: string;
  volumeInfo: {
    title: string;
    authors?: string[];
    pageCount?: number;
    description?: string;
    publishedDate?: string;
    industryIdentifiers?: Array<{
      type: string;
      identifier: string;
    }>;
    imageLinks?: {
      thumbnail?: string;
      smallThumbnail?: string;
    };
  };
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

      const { data: existingBook } = await supabase
        .from("books")
        .select("id")
        .eq("external_id", book.external_id)
        .single();

      if (existingBook) {
        return existingBook.id;
      }

      const { data: newBook, error } = await supabase
        .from("books")
        .insert({
          title: book.title,
          author: book.author,
          thumbnail_url: book.thumbnail_url,
          total_pages: book.total_pages,
          isbn: book.isbn,
          description: book.description,
          published_date: book.published_date,
          external_id: book.external_id,
        })
        .select("id")
        .single();

      if (error) {
        console.error("Error creating book:", error);
        throw error;
      }

      return newBook.id;
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
