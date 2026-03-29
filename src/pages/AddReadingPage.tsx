import { Plus, Trash2, Copy, BookPlus, NotebookPen } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import saveReadingEntries from "../utils/saveReadingEntries";
import { supabase } from "../lib/supabase";
import { getCategories } from "../api/database";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import ReadingTable from "./DashboardPage/components/ReadingTable/ReadingTable";
import { useRouteState } from "../hooks/useRouteState";

interface Book {
  id: string;
  title: string;
  author: string | null;
  thumbnail_url: string | null;
  category_id?: string | null;
}

interface LocalBook {
  id: number;
  title: string;
  fileHash: string;
  thumbnailPath: string | null;
  numPages: number;
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
  onBookSelect: (
    book: Book | LocalBook | null,
    categoryId?: string | null,
  ) => void;
}

function BookSearch({ value, onChange, onBookSelect }: BookSearchProps) {
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
      const localBooks = localResults.map((doc: any) => ({
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
        placeholder="Buscar ou digitar livro..."
        className="w-full rounded-sm bg-transparent border-0 focus:ring-0 text-zinc-100 placeholder:text-zinc-700 px-2 py-2 text-sm"
      />

      {showResults && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-zinc-900 border border-zinc-700 max-h-64 overflow-y-auto">
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
              {/* {isLocalBook(book) && book.thumbnailPath ? (
                <img src={`thumbnail://${book.thumbnailPath}`} alt="" className="w-6 h-8 object-cover rounded flex-shrink-0" onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}/>
              ) : !isLocalBook(book) && book.thumbnail_url ? (
                <img src={book.thumbnail_url} alt="" className="w-6 h-8 object-cover rounded flex-shrink-0" />
              ) : (
                <div className="w-6 h-8 bg-zinc-700 rounded flex-shrink-0" />
              )} */}
              <div className="min-w-0">
                <div className="text-sm text-zinc-100 truncate">
                  {book.title}
                </div>
                {"author" in book && book.author && (
                  <div className="text-xs text-zinc-400 truncate">
                    {book.author}
                  </div>
                )}
                {isLocalBook(book) ? (
                  <div className="text-xs text-green-500 truncate">Local</div>
                ) : (
                  <div className="text-xs text-green-500 truncate">Externo</div>
                )}
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
  const { saveState, loadState, clearState } = useRouteState();
  const [categories, setCategories] = useState<any>();
  const [entries, setEntries] = useState<ReadingEntry[]>(() => {
    const saved = loadState();
    if (saved?.entries) {
      return saved.entries as ReadingEntry[];
    }
    return [
      {
        id: crypto.randomUUID(),
        bookTitle: "",
        bookId: null,
        numPages: "",
        category_id: "",
        readingTime: "",
        date: new Date().toLocaleDateString("sv-SE"),
      },
    ];
  });

  useEffect(() => {
    saveState({ entries });
  }, [entries, saveState]);

  const handleBookSelect = (
    entryId: string,
    book: Book | LocalBook | null,
    categoryId?: string | null,
  ) => {
    const isLocal = book && "fileHash" in book;
    const currentEntry = entries.find((e) => e.id === entryId);
    const selectedCategoryId =
      categoryId !== undefined && categoryId !== null
        ? categoryId
        : currentEntry?.category_id;
    setEntries(
      entries.map((entry) =>
        entry.id === entryId
          ? {
              ...entry,
              bookTitle: book?.title || entry.bookTitle,
              bookId: isLocal
                ? (book as LocalBook).fileHash
                : (book as Book)?.id || null,
              category_id: selectedCategoryId,
            }
          : entry,
      ),
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
      const categoriesData = await getCategories();
      setCategories(categoriesData);
    };
    load();
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    console.log("All entries:", entries);

    const validEntries = entries.filter(
      (entry) =>
        entry.bookTitle.trim() !== "" &&
        entry.numPages !== "" &&
        entry.category_id !== "",
    );

    if (validEntries.length === 0) {
      toast.error("Preencha pelo menos uma leitura completa");
      return;
    }

    console.log("Valid entries:", validEntries);

    try {
      await saveReadingEntries(validEntries);
      queryClient.invalidateQueries({ queryKey: ["readings"] });
      queryClient.invalidateQueries({ queryKey: ["ranking"] });
      toast.success(
        `${validEntries.length} leitura${validEntries.length > 1 ? "s" : ""} registrada${validEntries.length > 1 ? "s" : ""} com sucesso!`,
      );
      clearState();
      navigate("/");
    } catch (error) {
      console.error("Error saving readings:", error);
      toast.error(`Erro ao registrar leituras: ${error instanceof Error ? error.message : "Erro desconhecido"}`);
    }
  };

  // const calculateTotalPoints = (entry: ReadingEntry) => {
  //   const pages = parseInt(entry.numPages) || 0;
  //   const filteredCategory = categories?.find(
  //     (category: any) => category.id === entry.category_id,
  //   );
  //   if (!filteredCategory) {
  //     return pages;
  //   }
  //   return pages * filteredCategory.points_per_page;
  // };

  // const calculateGrandTotal = () => {
  //   return entries.reduce(
  //     (total, entry) => total + calculateTotalPoints(entry),
  //     0,
  //   );
  // };

  return (
    <div className=" bg-zinc-950 text-zinc-100 px-4">
      <main className="min-h-screen flex-1 overflow-y-auto">
        <div className="py-6 space-y-4">
          {/* <header className="flex items-center justify-between">

            <div className="flex gap-2 items-center pl-4">
              <BookPlus size={32} className="text-zinc-300" />
            </div>
          </header> */}

          <section className="bg-zinc-950 p-4 rounded-sm">
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-12 gap-3 my-2 px-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                <div className="col-span-4">Obra</div>
                <div className="col-span-1">Págs</div>
                <div className="col-span-1">Tempo</div>
                <div className="col-span-2">Categoria</div>
                <div className="col-span-2">Data</div>
              </div>

              <div className="space-y-2 mb-6">
                {entries.map((entry, index) => (
                  <div
                    key={entry.id}
                    className="grid grid-cols-12 gap-3 items-center bg-zinc-900/30 border border-zinc-800 rounded-sm p-2 hover:border-zinc-700 transition"
                  >
                    <div className="col-span-4">
                      <BookSearch
                        value={entry.bookTitle}
                        onChange={(value) =>
                          updateEntry(entry.id, "bookTitle", value)
                        }
                        onBookSelect={(book, categoryId) =>
                          handleBookSelect(entry.id, book, categoryId)
                        }
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

                    <div className="col-span-2 relative">
                      <select
                        value={entry.category_id || ""}
                        onChange={(e) =>
                          updateEntry(entry.id, "category_id", e.target.value)
                        }
                        className={`border-zinc-700 text-zinc-100 w-full bg-zinc-800/50 border rounded px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 cursor-pointer`}
                      >
                        <option value="">Selecione</option>
                        {categories?.map((cat: any) => (
                          <option
                            key={cat.id}
                            value={cat.id}
                            className="text-zinc-100"
                          >
                            {cat.name} ({cat.points_per_page}x)
                          </option>
                        ))}
                      </select>
                      {/* {entry.category_id && (
                        <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none">
                          <span className="text-green-500 text-xs">✓</span>
                        </div>
                      )} */}
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

                    <div className="col-span-2 flex items-center justify-end px-3 gap-2">
                      {/* <span className="text-sm text-green-500 font-mono w-full">
                        {calculateTotalPoints(entry)}
                      </span> */}
                      <div className="flex gap-4">
                        <button
                          type="button"
                          onClick={() => duplicateEntry(entry.id)}
                          className="text-zinc-500 hover:text-zinc-300 transition cursor-pointer"
                          title="Duplicar linha"
                        >
                          <Copy size={18} />
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
                          <Trash2 size={18} />
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
                    type="submit"
                    className="flex items-center gap-2 cursor-pointer bg-green-600 hover:bg-green-500 text-black font-medium px-8 py-2.5 rounded-sm transition text-sm"
                  >
                    <NotebookPen size={15} />
                    Registrar {entries.length} leitura
                    {entries.length > 1 ? "s" : ""}
                  </button>
                </div>
              </div>
            </form>
          </section>

          <section className=" bg-zinc-900">
            <ReadingTable />
          </section>
        </div>
      </main>
    </div>
  );
}
