import { useRef, useEffect, useCallback } from "react";
import { Search, BookOpen, X, AlertCircle } from "lucide-react";
import { useBookSearch, Book } from "../hooks/useBookSearch";

interface BookSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onBookSelect: (book: Book | null) => void;
  selectedBook: Book | null;
}

export function BookSearchInput({
  value,
  onChange,
  onBookSelect,
  selectedBook,
}: BookSearchInputProps) {
  const { results, loading, showResults, searchBooks, findOrCreateBook, setShowResults, error } =
    useBookSearch();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

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
  }, [setShowResults]);

  const debouncedSearch = useCallback((query: string) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      if (query.length >= 2) {
        searchBooks(query);
      }
    }, 1000);
  }, [searchBooks]);

  useEffect(() => {
    if (!selectedBook && value.length >= 2) {
      debouncedSearch(value);
    }
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [value, selectedBook, debouncedSearch]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    onBookSelect(null);
  };

  const handleSelect = async (book: Book) => {
    try {
      const bookId = await findOrCreateBook(book);
      const bookWithId = { ...book, id: bookId };
      onBookSelect(bookWithId);
      onChange(book.title);
      setShowResults(false);
    } catch (err) {
      console.error("Error saving book:", err);
      onBookSelect(book);
      onChange(book.title);
      setShowResults(false);
    }
  };

  const handleClear = () => {
    onChange("");
    onBookSelect(null);
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        {selectedBook?.thumbnail_url ? (
          <img
            src={selectedBook.thumbnail_url}
            alt=""
            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-10 object-cover rounded"
          />
        ) : (
          <Search
            size={16}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500"
          />
        )}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          placeholder={selectedBook ? "" : "Buscar livro ou digitar manualmente..."}
          className={`w-full rounded bg-transparent border-0 focus:ring-0 text-zinc-100 placeholder:text-zinc-700 px-2 py-2 text-sm ${
            selectedBook ? "pl-12" : "pl-8"
          }`}
        />
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {showResults && (results.length > 0 || loading) && !selectedBook && (
        <div className="absolute z-50 w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl max-h-72 overflow-y-auto">
          {loading ? (
            <div className="p-3 text-zinc-400 text-sm">Buscando...</div>
          ) : (
            results.map((book) => (
              <button
                key={book.id}
                type="button"
                onClick={() => handleSelect(book)}
                className="w-full flex items-center gap-3 p-2 hover:bg-zinc-700 transition text-left"
              >
                {book.thumbnail_url ? (
                  <img
                    src={book.thumbnail_url}
                    alt=""
                    className="w-8 h-12 object-cover rounded flex-shrink-0"
                  />
                ) : (
                  <div className="w-8 h-12 bg-zinc-700 rounded flex items-center justify-center flex-shrink-0">
                    <BookOpen size={14} className="text-zinc-500" />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-sm text-zinc-100 truncate">
                    {book.title}
                  </div>
                  {book.author && (
                    <div className="text-xs text-zinc-400 truncate">
                      {book.author}
                    </div>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {showResults &&
        !loading &&
        results.length === 0 &&
        value.length >= 2 &&
        !selectedBook && (
          <div className="absolute z-50 w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl p-3">
            {error ? (
              <div className="flex items-center gap-2 text-yellow-400 text-sm">
                <AlertCircle size={14} />
                <span>API temporariamente indisponível. Você pode digitar o nome manualmente.</span>
              </div>
            ) : (
              <div className="text-sm text-zinc-400">
                Nenhum livro encontrado. Você pode digitar o nome manualmente.
              </div>
            )}
          </div>
        )}
    </div>
  );
}
