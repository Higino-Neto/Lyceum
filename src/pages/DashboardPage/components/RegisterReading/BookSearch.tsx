import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../../../lib/supabase";
import { useTranslation } from "../../../../i18n";

export interface Book {
  id: string;
  title: string;
  author: string | null;
  thumbnail_url: string | null;
  category_id?: string | null;
}

export interface LocalBook {
  id: number;
  title: string;
  fileHash: string;
  thumbnailPath: string | null;
  numPages: number;
}

interface BookSearchProps {
  value: string;
  onChange: (value: string) => void;
  onBookSelect: (
    book: Book | LocalBook | null,
    categoryId?: string | null,
  ) => void;
}

export default function BookSearch({ value, onChange, onBookSelect }: BookSearchProps) {
  const { t } = useTranslation();
  const [results, setResults] = useState<(Book | LocalBook)[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const searchBooks = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }

    const [supabaseResults, localResults] = await Promise.all([
      supabase
        .from("books")
        .select("id, title, author, thumbnail_url, category_id")
        .ilike("title", `%${query}%`)
        .limit(8),
      window.api?.searchLocalBooks 
        ? window.api.searchLocalBooks(query).catch(() => []) 
        : Promise.resolve([]),
    ]);

    const combinedResults: (Book | LocalBook)[] = [];

    if (supabaseResults.data) {
      combinedResults.push(...supabaseResults.data);
    }

    if (localResults && localResults.length > 0) {
      const localBooks = localResults.map((doc) => ({
        id: doc.fileHash || `local-${doc.id}`,
        title: doc.title,
        fileHash: doc.fileHash,
        thumbnailPath: doc.thumbnailPath,
        numPages: doc.numPages,
      }));
      combinedResults.push(...localBooks);
    }

    if (combinedResults.length > 0) {
      setResults(combinedResults);
      setShowResults(true);
    } else {
      setResults([]);
      setShowResults(false);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange(newValue);
    onBookSelect(null);
    searchBooks(newValue);
  };

  const handleSelect = (book: Book | LocalBook) => {
    const categoryId = (book as Book).category_id ?? null;
    onBookSelect(book, categoryId);
    setInputValue(book.title);
    setShowResults(false);
  };

  const handleBlur = () => {
    setTimeout(() => {
      if (inputValue !== value) {
        onChange(inputValue);
      }
    }, 100);
  };

  const isLocalBook = (book: Book | LocalBook): book is LocalBook => {
    return "fileHash" in book;
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <input
        type="text"
        value={inputValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={() => results.length > 0 && setShowResults(true)}
        placeholder={t("reading:bookSearch.placeholder")}
        className="w-full rounded-sm bg-transparent border-0 focus:ring-0 text-foreground placeholder:text-input-placeholder px-2 py-2 text-sm"
      />

      {showResults && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-surface border border-border-strong max-h-64 overflow-y-auto">
          {results.map((book) => (
            <button
              key={book.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(book);
              }}
              className="w-full flex items-center gap-2 p-2 hover:bg-border-strong transition text-left"
            >
              <div className="min-w-0">
                <div className="text-sm text-foreground truncate">
                  {book.title}
                </div>
                {"author" in book && book.author && (
                  <div className="text-xs text-foreground-muted truncate">
                    {book.author}
                  </div>
                )}
                {isLocalBook(book) ? (
                  <div className="text-xs text-primary truncate">
                    {t("reading:bookSearch.local")}
                  </div>
                ) : (
                  <div className="text-xs text-primary truncate">
                    {t("reading:bookSearch.external")}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
