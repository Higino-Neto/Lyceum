import {
  Plus,
  Trash2,
  Copy,
  BookPlus,
  NotebookPen,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState, useRef, useCallback } from "react";
import saveReadingEntries from "../utils/saveReadingEntries";
import { supabase } from "../lib/supabase";
import { useQueryClient } from "@tanstack/react-query";

interface Book {
  id: string;
  title: string;
  author: string | null;
  thumbnail_url: string | null;
}

interface ReadingEntry {
  id: string;
  bookTitle: string;
  bookId: string | null;
  numPages: string;
  category_id: string;
  readingTime: string;
  date: string;
}

interface BookSearchProps {
  value: string;
  onChange: (value: string) => void;
  onBookSelect: (book: Book | null) => void;
}

function BookSearch({ value, onChange, onBookSelect }: BookSearchProps) {
  const [results, setResults] = useState<Book[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
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

    const { data, error } = await supabase
      .from("books")
      .select("id, title, author, thumbnail_url")
      .ilike("title", `%${query}%`)
      .limit(8);

    if (!error && data) {
      setResults(data);
      setShowResults(true);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange(newValue);
    onBookSelect(null);
    searchBooks(newValue);
  };

  const handleSelect = (book: Book) => {
    onBookSelect(book);
    onChange(book.title);
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

  return (
    <div ref={containerRef} className="relative w-full">
      <input
        type="text"
        value={inputValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={() => results.length > 0 && setShowResults(true)}
        placeholder="Buscar ou digitar livro..."
        className="w-full rounded bg-transparent border-0 focus:ring-0 text-zinc-100 placeholder:text-zinc-700 px-2 py-2 text-sm"
      />

      {showResults && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl max-h-48 overflow-y-auto">
          {results.map((book) => (
            <button
              key={book.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(book);
              }}
              className="w-full flex items-center gap-2 p-2 hover:bg-zinc-700 transition text-left"
            >
              {book.thumbnail_url ? (
                <img src={book.thumbnail_url} alt="" className="w-6 h-8 object-cover rounded flex-shrink-0" />
              ) : (
                <div className="w-6 h-8 bg-zinc-700 rounded flex-shrink-0" />
              )}
              <div className="min-w-0">
                <div className="text-sm text-zinc-100 truncate">{book.title}</div>
                {book.author && <div className="text-xs text-zinc-400 truncate">{book.author}</div>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AddReadingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [categories, setCategories] = useState<any>();
  const [entries, setEntries] = useState<ReadingEntry[]>([
    {
      id: crypto.randomUUID(),
      bookTitle: "",
      bookId: null,
      numPages: "",
      category_id: "",
      readingTime: "",
      date: new Date().toLocaleDateString("sv-SE"),
    },
  ]);

  const handleBookSelect = (entryId: string, book: Book | null) => {
    setEntries(
      entries.map((entry) =>
        entry.id === entryId
          ? {
              ...entry,
              bookTitle: book?.title || entry.bookTitle,
              bookId: book?.id || null,
            }
          : entry
      )
    );
  };

  const addNewEntry = () => {
    setEntries([
      ...entries,
      {
        id: crypto.randomUUID(),
        bookTitle: "",
        bookId: null,
        numPages: "",
        category_id: "",
        readingTime: "",
        date: new Date().toLocaleDateString("sv-SE"),
      },
    ]);
  };

  const duplicateEntry = (id: string) => {
    const entryToDuplicate = entries.find((e) => e.id === id);
    if (entryToDuplicate) {
      const newEntry = {
        ...entryToDuplicate,
        id: crypto.randomUUID(),
        bookId: null,
      };
      const index = entries.findIndex((e) => e.id === id);
      const newEntries = [...entries];
      newEntries.splice(index + 1, 0, newEntry);
      setEntries(newEntries);
    }
  };

  const removeEntry = (id: string) => {
    if (entries.length > 1) {
      setEntries(entries.filter((entry) => entry.id !== id));
    }
  };

  const updateEntry = (
    id: string,
    field: keyof ReadingEntry,
    value: string,
  ) => {
    console.log("updateEntry called:", id, field, value);
    setEntries(
      entries.map((entry) =>
        entry.id === id ? { ...entry, [field]: value } : entry,
      ),
    );
  };

  useEffect(() => {
    const load = async () => {
      const { data: categoriesData, error: categoriesError } = await supabase
        .from("categories")
        .select("*");
      if (categoriesError) throw categoriesError;
      setCategories(categoriesData);
    };
    load();
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    console.log("All entries:", entries);
    
    const validEntries = entries.filter(
      (entry) => entry.bookTitle.trim() !== "" && entry.numPages !== "" && entry.category_id !== "",
    );

    console.log("Valid entries:", validEntries);

    await saveReadingEntries(validEntries);

    queryClient.invalidateQueries({ queryKey: ["readings"] });
    queryClient.invalidateQueries({ queryKey: ["ranking"] });

    navigate("/");
  };

  const calculateTotalPoints = (entry: ReadingEntry) => {
    const pages = parseInt(entry.numPages) || 0;
    const filteredCategory = categories?.find(
      (category: any) => category.id === entry.category_id,
    );
    if (!filteredCategory) {
      return pages;
    }
    return pages * filteredCategory.points_per_page;
  };

  const calculateGrandTotal = () => {
    return entries.reduce(
      (total, entry) => total + calculateTotalPoints(entry),
      0,
    );
  };

  return (
    <div className="h-screen bg-zinc-950 text-zinc-100 px-4">
      <main className="flex-1 overflow-y-auto">
        <div className="py-6 space-y-4">
          <header className="flex items-center justify-between">

            <div className="flex gap-2 items-center pl-4">
              <BookPlus size={32} className="text-zinc-300" />
            </div>

            <div className="text-green-500 font-medium">
              Total: {calculateGrandTotal()} pts
            </div>
          </header>

          <section>
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-12 gap-3 my-2 px-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                <div className="col-span-4">Obra</div>
                <div className="col-span-1">Págs</div>
                <div className="col-span-2">Categoria</div>
                <div className="col-span-1">Tempo</div>
                <div className="col-span-2">Data</div>
              </div>

              <div className="space-y-2 mb-6">
                {entries.map((entry, index) => (
                  <div
                    key={entry.id}
                    className="grid grid-cols-12 gap-3 items-center bg-zinc-900/30 border border-zinc-800 rounded-lg p-2 hover:border-zinc-700 transition"
                  >
                    <div className="col-span-4">
                      <BookSearch
                        value={entry.bookTitle}
                        onChange={(value) => updateEntry(entry.id, "bookTitle", value)}
                        onBookSelect={(book) => handleBookSelect(entry.id, book)}
                      />
                    </div>

                    <div className="col-span-1">
                      <input
                        type="number"
                        value={entry.numPages}
                        onChange={(e) =>
                          updateEntry(entry.id, "numPages", e.target.value)
                        }
                        placeholder="0"
                        min="1"
                        className="w-full bg-zinc-800/50 border border-zinc-700 rounded px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                      />
                    </div>

                    <div className="col-span-2">
                      <select
                        value={entry.category_id}
                        onChange={(e) =>
                          updateEntry(entry.id, "category_id", e.target.value)
                        }
                        className="w-full bg-zinc-800/50 border border-zinc-700 rounded px-2 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-green-500"
                      >
                        <option value="">Selecione</option>
                        {categories?.map((cat: any) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name} ({cat.points_per_page}x)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-span-1">
                      <input
                        type="number"
                        value={entry.readingTime}
                        onChange={(e) =>
                          updateEntry(entry.id, "readingTime", e.target.value)
                        }
                        placeholder="min"
                        min="1"
                        className="w-16 bg-zinc-800/50 border border-zinc-700 rounded px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                      />
                    </div>

                    <div className="col-span-2">
                      <input
                        type="date"
                        value={entry.date}
                        onChange={(e) =>
                          updateEntry(entry.id, "date", e.target.value)
                        }
                        className="w-full bg-zinc-800/50 border border-zinc-700 rounded px-2 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-green-500"
                      />
                    </div>

                    <div className="col-span-2 flex items-between px-3 gap-2">
                      <span className="text-sm text-green-500 font-mono w-full">
                        {calculateTotalPoints(entry)}
                      </span>
                      <div className="flex gap-2 ">
                        <button
                          type="button"
                          onClick={() => duplicateEntry(entry.id)}
                          className="text-zinc-500 hover:text-zinc-300 transition cursor-pointer"
                          title="Duplicar linha"
                        >
                          <Copy size={14} />
                        </button>

                        <button
                          type="button"
                          disabled={entries.length < 2}
                          onClick={() => removeEntry(entry.id)}
                          className={
                            entries.length < 2
                              ? `text-zinc-700 cursor-no-drop`
                              : `text-zinc-500 hover:text-red-400 transition cursor-pointer`
                          }
                          title="Remover linha"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between border-t border-zinc-800 pt-6">
                <button
                  type="button"
                  onClick={addNewEntry}
                  className="cursor-pointer flex items-center gap-2 text-green-500 hover:text-green-400 transition text-sm font-medium"
                >
                  <Plus size={18} />
                  Adicionar outra leitura
                </button>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => navigate("/dashboard")}
                    className="cursor-pointer px-6 py-2.5 border border-zinc-700 hover:border-zinc-600 rounded-lg text-zinc-300 hover:text-zinc-100 transition text-sm"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    className="flex items-center gap-2 cursor-pointer bg-green-600 hover:bg-green-500 text-black font-medium px-8 py-2.5 rounded-lg transition text-sm"
                  >
                    <NotebookPen size={15} />
                    Registrar {entries.length} leitura
                    {entries.length > 1 ? "s" : ""}
                  </button>
                </div>
              </div>
            </form>
          </section>
        </div>
      </main>
    </div>
  );
}
