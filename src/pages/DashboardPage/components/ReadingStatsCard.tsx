import { FormEvent, KeyboardEvent, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  CalendarDays,
  Loader2,
  MoreVertical,
  Plus,
  Send,
  Trash2,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { createReadingEntry, getAllBooks } from "../../../api/database";
import type { SupabaseBook } from "../../../api/database";
import { useLocalStorage } from "../../../hooks/useLocalStorage";
import { useSelectedUsers } from "../../../contexts/SelectedUsersContext";
import type TableReading from "../../../types/TableReading";
import getReadings from "../../../utils/getReadings";

type DraftDateMode = "today" | "yesterday";

interface QuickReadingDraft {
  pages: string;
  readingTime: string;
  dateMode: DraftDateMode;
}

export interface FrequentReadingBook {
  key: string;
  title: string;
  bookId?: string;
  categoryId?: string;
  recentPages: number;
  totalPages: number;
  todayPages: number;
  latestRecentReadingTime: number;
}

const ICON_SIZE = 15;
const STROKE_WIDTH = 1.5;
const QUICK_CONTROL_SELECTOR = "[data-quick-reading-control]";
const QUICK_BOOK_LIMIT_HEIGHT = "max-h-[184px]";
const EMPTY_READINGS: TableReading[] = [];
const EMPTY_REGISTERED_BOOKS: SupabaseBook[] = [];

function toLocalIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function getDateForMode(mode: DraftDateMode): string {
  const date = new Date();
  if (mode === "yesterday") {
    date.setDate(date.getDate() - 1);
  }
  return toLocalIsoDate(date);
}

function normalizeTitle(title: string): string {
  return title.trim().toLocaleLowerCase();
}

export function getFrequentRecentBooks(
  readings: TableReading[],
  now = new Date(),
): FrequentReadingBook[] {
  const todayIso = toLocalIsoDate(now);
  const startDate = new Date(now);
  startDate.setDate(now.getDate() - 6);
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(now);
  endDate.setHours(23, 59, 59, 999);

  const grouped = new Map<
    string,
    FrequentReadingBook & {
      latestAnyReadingTime: number;
      latestCategoryReadingTime: number;
    }
  >();

  readings.forEach((reading) => {
    const title = reading.source_name?.trim();
    if (!title) return;

    const readingDate = parseLocalDate(reading.reading_date);
    const readingTime = readingDate.getTime();
    if (Number.isNaN(readingTime)) return;

    const key = reading.book_id || `title:${normalizeTitle(title)}`;
    const existing = grouped.get(key);
    const book = existing ?? {
      key,
      title,
      bookId: reading.book_id,
      categoryId: reading.category_id,
      recentPages: 0,
      totalPages: 0,
      todayPages: 0,
      latestRecentReadingTime: -Infinity,
      latestAnyReadingTime: -Infinity,
      latestCategoryReadingTime: reading.category_id ? readingTime : -Infinity,
    };

    book.totalPages += reading.pages;
    if (reading.reading_date === todayIso) {
      book.todayPages += reading.pages;
    }

    if (readingTime >= book.latestAnyReadingTime) {
      book.latestAnyReadingTime = readingTime;
      book.title = title;
      if (reading.book_id) {
        book.bookId = reading.book_id;
      }
    }

    if (reading.category_id && readingTime >= book.latestCategoryReadingTime) {
      book.latestCategoryReadingTime = readingTime;
      book.categoryId = reading.category_id;
    }

    if (readingDate >= startDate && readingDate <= endDate) {
      book.recentPages += reading.pages;
      book.latestRecentReadingTime = Math.max(
        book.latestRecentReadingTime,
        readingTime,
      );
    }

    grouped.set(key, book);
  });

  return Array.from(grouped.values())
    .filter((book) => book.recentPages > 0)
    .sort((left, right) => {
      if (right.recentPages !== left.recentPages) {
        return right.recentPages - left.recentPages;
      }
      return right.latestRecentReadingTime - left.latestRecentReadingTime;
    })
    .map(
      ({
        latestAnyReadingTime: _latestAnyReadingTime,
        latestCategoryReadingTime: _latestCategoryReadingTime,
        ...book
      }) => book,
    );
}

function focusNextQuickControl(current: HTMLElement) {
  const controls = Array.from(
    document.querySelectorAll<HTMLElement>(QUICK_CONTROL_SELECTOR),
  ).filter((element) => {
    if (element.hasAttribute("disabled")) return false;
    if (element.getAttribute("aria-disabled") === "true") return false;
    return element.tabIndex >= 0;
  });

  if (controls.length === 0) return;

  const currentIndex = controls.indexOf(current);
  const next = controls[currentIndex + 1] ?? controls[0];
  next.focus();
}

function scheduleFocus(callback: () => void) {
  if (typeof window.requestAnimationFrame === "function") {
    window.requestAnimationFrame(callback);
    return;
  }

  window.setTimeout(callback, 0);
}

function bookToQuickReading(book: SupabaseBook): FrequentReadingBook {
  return {
    key: book.id,
    title: book.title,
    bookId: book.id,
    categoryId: book.category_id || undefined,
    recentPages: 0,
    totalPages: 0,
    todayPages: 0,
    latestRecentReadingTime: 0,
  };
}

function handleFastKeyDown(event: KeyboardEvent<HTMLElement>) {
  if (event.key !== "Enter" && event.key !== " ") return;

  event.preventDefault();
  const target = event.currentTarget;

  if (target instanceof HTMLButtonElement) {
    target.click();
  }

  scheduleFocus(() => focusNextQuickControl(target));
}

export default function ReadingStatsCard() {
  const queryClient = useQueryClient();
  const { selectedUsers } = useSelectedUsers();
  const { data: readingsData, isLoading } = useQuery({
    queryKey: ["readings"],
    queryFn: getReadings,
  });
  const { data: registeredBooksData, isLoading: booksLoading } = useQuery({
    queryKey: ["books"],
    queryFn: getAllBooks,
    staleTime: 1000 * 60 * 5,
  });
  const readings = readingsData ?? EMPTY_READINGS;
  const registeredBooks = registeredBooksData ?? EMPTY_REGISTERED_BOOKS;
  const [drafts, setDrafts] = useState<Record<string, QuickReadingDraft>>({});
  const [submittingKey, setSubmittingKey] = useState<string | null>(null);
  const [hiddenBookKeys, setHiddenBookKeys] = useLocalStorage<string[]>(
    "quick_reading_hidden_books",
    [],
  );
  const [addedBookIds, setAddedBookIds] = useLocalStorage<string[]>(
    "quick_reading_added_books",
    [],
  );
  const [addPanelOpen, setAddPanelOpen] = useState(false);
  const [addBookSearch, setAddBookSearch] = useState("");
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [actionMenuBookKey, setActionMenuBookKey] = useState<string | null>(
    null,
  );

  const frequentBooks = useMemo(
    () => getFrequentRecentBooks(readings),
    [readings],
  );

  const registeredBooksById = useMemo(() => {
    return new Map(registeredBooks.map((book) => [book.id, book]));
  }, [registeredBooks]);

  const quickBooks = useMemo(() => {
    const hidden = new Set(hiddenBookKeys);
    const booksByKey = new Map<string, FrequentReadingBook>();

    frequentBooks.forEach((book) => {
      if (!hidden.has(book.key)) {
        booksByKey.set(book.key, book);
      }
    });

    addedBookIds.forEach((bookId) => {
      const book = registeredBooksById.get(bookId);
      if (!book || hidden.has(book.id) || booksByKey.has(book.id)) return;
      booksByKey.set(book.id, bookToQuickReading(book));
    });

    return Array.from(booksByKey.values());
  }, [addedBookIds, frequentBooks, hiddenBookKeys, registeredBooksById]);

  const availableBooksToAdd = useMemo(() => {
    const visibleKeys = new Set(quickBooks.map((book) => book.key));
    return registeredBooks.filter((book) => !visibleKeys.has(book.id));
  }, [quickBooks, registeredBooks]);

  const suggestedBooksToAdd = useMemo(() => {
    const query = normalizeTitle(addBookSearch);
    const matches = query
      ? availableBooksToAdd.filter((book) => {
          const title = normalizeTitle(book.title);
          const author = normalizeTitle(book.author || "");
          return title.includes(query) || author.includes(query);
        })
      : availableBooksToAdd;

    return matches.slice(0, 8);
  }, [addBookSearch, availableBooksToAdd]);

  const isExpandedByLeaderboard = selectedUsers.length > 0;

  useEffect(() => {
    setDrafts((current) => {
      const next: Record<string, QuickReadingDraft> = {};
      let changed = Object.keys(current).length !== quickBooks.length;

      quickBooks.forEach((book) => {
        next[book.key] = current[book.key] ?? {
          pages: "",
          readingTime: "",
          dateMode: "today",
        };
        if (next[book.key] !== current[book.key]) {
          changed = true;
        }
      });

      return changed ? next : current;
    });
  }, [quickBooks]);

  const updateDraft = (key: string, patch: Partial<QuickReadingDraft>) => {
    setDrafts((current) => ({
      ...current,
      [key]: {
        pages: "",
        readingTime: "",
        dateMode: "today",
        ...current[key],
        ...patch,
      },
    }));
  };

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
    book: FrequentReadingBook,
  ) => {
    event.preventDefault();

    const draft = drafts[book.key] ?? {
      pages: "",
      readingTime: "",
      dateMode: "today" as DraftDateMode,
    };
    const pages = Number(draft.pages);
    const readingTime = Number(draft.readingTime);

    if (!book.categoryId) {
      toast.error("Defina uma categoria para este livro em /readings");
      return;
    }

    if (!Number.isFinite(pages) || pages <= 0) {
      toast.error("Informe as paginas lidas");
      return;
    }

    if (!Number.isFinite(readingTime) || readingTime <= 0) {
      toast.error("Informe o tempo de leitura");
      return;
    }

    try {
      setSubmittingKey(book.key);
      await createReadingEntry(
        book.title,
        pages,
        getDateForMode(draft.dateMode),
        readingTime,
        book.categoryId,
        book.bookId,
      );

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["readings"] }),
        queryClient.invalidateQueries({ queryKey: ["ranking"] }),
        queryClient.invalidateQueries({ queryKey: ["selectedUsersReadings"] }),
      ]);

      setDrafts((current) => ({
        ...current,
        [book.key]: {
          pages: "",
          readingTime: "",
          dateMode: current[book.key]?.dateMode ?? "today",
        },
      }));
      toast.success("Leitura registrada!");
    } catch (error) {
      console.error("Error saving quick reading:", error);
      toast.error("Erro ao registrar leitura");
    } finally {
      setSubmittingKey(null);
    }
  };

  const handleRemoveBook = (book: FrequentReadingBook) => {
    setHiddenBookKeys((current) =>
      current.includes(book.key) ? current : [...current, book.key],
    );
    if (book.bookId) {
      setAddedBookIds((current) => current.filter((id) => id !== book.bookId));
    }
    toast.success("Livro removido da leitura rapida");
  };

  const handleAddRegisteredBook = (bookId: string) => {
    if (!bookId) return;

    setAddedBookIds((current) =>
      current.includes(bookId) ? current : [...current, bookId],
    );
    setHiddenBookKeys((current) => current.filter((key) => key !== bookId));
    setAddBookSearch("");
    setSuggestionsOpen(false);
    setAddPanelOpen(false);
  };

  const renderHeader = () => (
    <div className="flex items-center justify-between gap-2 text-zinc-500">
      <div className="flex items-center gap-2">
        <BookOpen size={ICON_SIZE} strokeWidth={STROKE_WIDTH} />
      </div>
      <button
        type="button"
        onClick={() => setAddPanelOpen((open) => !open)}
        className="inline-flex h-6 w-6 items-center justify-center rounded-sm border border-zinc-700 cursor-pointer text-zinc-300 transition hover:border-zinc-600 hover:text-zinc-100"
        title={
          addPanelOpen
            ? "Fechar selecao de livro"
            : "Adicionar livro cadastrado"
        }
        aria-label={
          addPanelOpen
            ? "Fechar selecao de livro"
            : "Adicionar livro cadastrado"
        }
      >
        {addPanelOpen ? (
          <X size={ICON_SIZE} strokeWidth={STROKE_WIDTH} />
        ) : (
          <Plus size={ICON_SIZE} strokeWidth={STROKE_WIDTH} />
        )}
      </button>
    </div>
  );

  const renderAddPanel = () => {
    if (!addPanelOpen) return null;

    return (
      <div className="relative rounded-sm">
        <input
          type="text"
          value={addBookSearch}
          onChange={(event) => {
            setAddBookSearch(event.target.value);
            setSuggestionsOpen(true);
          }}
          onFocus={() => setSuggestionsOpen(true)}
          onBlur={() => window.setTimeout(() => setSuggestionsOpen(false), 120)}
          className="h-9 w-full rounded-sm border border-zinc-700 bg-zinc-900 px-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-green-500 focus:ring-1 focus:ring-green-500"
          aria-label="Buscar livro cadastrado"
          placeholder={
            booksLoading ? "Carregando livros..." : "Buscar livro cadastrado..."
          }
          disabled={booksLoading || availableBooksToAdd.length === 0}
        />

        {suggestionsOpen ? (
          <div className="absolute left-2 right-2 top-[calc(100%+0.25rem)] z-20 max-h-56 overflow-y-auto rounded-sm border border-zinc-700 bg-zinc-900 shadow-xl shadow-black/40">
            {booksLoading ? (
              <div className="px-3 py-2 text-sm text-zinc-500">
                Carregando livros...
              </div>
            ) : suggestedBooksToAdd.length > 0 ? (
              suggestedBooksToAdd.map((book) => (
                <button
                  key={book.id}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => handleAddRegisteredBook(book.id)}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm text-zinc-200 transition hover:bg-zinc-800"
                  aria-label={`Adicionar ${book.title} a leitura rapida`}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {book.title}
                    </span>
                    {book.author ? (
                      <span className="block truncate text-xs text-zinc-500">
                        {book.author}
                      </span>
                    ) : null}
                  </span>
                  <Plus
                    size={ICON_SIZE}
                    strokeWidth={STROKE_WIDTH}
                    className="shrink-0 text-green-500"
                  />
                </button>
              ))
            ) : (
              <div className="px-3 py-2 text-sm text-zinc-500">
                Nenhum livro cadastrado encontrado
              </div>
            )}
          </div>
        ) : null}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="h-full rounded-sm border border-zinc-800 bg-zinc-900 p-4">
        <div className="h-5 w-28 animate-pulse rounded bg-zinc-800" />
        <div className="mt-4 space-y-3">
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="h-12 animate-pulse rounded-sm bg-zinc-800"
            />
          ))}
        </div>
      </div>
    );
  }

  if (quickBooks.length === 0) {
    return (
      <div className="flex h-full flex-col gap-3 rounded-sm border border-zinc-800 bg-zinc-900 p-4">
        {renderHeader()}
        {renderAddPanel()}
        <div className="flex flex-1 items-center justify-center py-8 text-center text-sm text-zinc-500">
          Nenhum livro na leitura rapida
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3 rounded-sm border border-zinc-800 bg-zinc-900 p-4">
      {renderHeader()}
      {renderAddPanel()}

      <div
        className={`flex flex-1 flex-col gap-2 ${
          isExpandedByLeaderboard
            ? "overflow-visible"
            : `${QUICK_BOOK_LIMIT_HEIGHT} overflow-y-auto pr-1`
        }`}
      >
        {quickBooks.map((book, index) => {
          const draft = drafts[book.key] ?? {
            pages: "",
            readingTime: "",
            dateMode: "today",
          };
          const tabStart = index * 4 + 1;
          const isSubmitting = submittingKey === book.key;
          const canSubmit = Boolean(book.categoryId) && !isSubmitting;

          return (
            <form
              key={book.key}
              onSubmit={(event) => handleSubmit(event, book)}
              className="relative grid grid-cols-[minmax(0,1fr)_4rem_4rem_auto_auto_0rem] items-center gap-2 rounded-sm border border-zinc-800 bg-zinc-850 p-2"
            >
              <div className="min-w-0 flex">
                <div>
                  <button
                    type="button"
                    onClick={() =>
                      setActionMenuBookKey((current) =>
                        current === book.key ? null : book.key,
                      )
                    }
                    className="flex h-9 w-5 cursor-pointer items-center justify-center rounded-sm hover:bg-zinc-800 text-zinc-500 transition hover:border-zinc-600 hover:text-zinc-200"
                    title="Acoes"
                    aria-label={`Acoes de ${book.title}`}
                  >
                    <MoreVertical size={ICON_SIZE} strokeWidth={STROKE_WIDTH} />
                  </button>

                  {actionMenuBookKey === book.key ? (
                    <div className="absolute left-2 top-12 z-20 min-w-44 rounded-sm border border-zinc-700 bg-zinc-900 py-1">
                      <button
                        type="button"
                        onClick={() => {
                          handleRemoveBook(book);
                          setActionMenuBookKey(null);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-300 transition hover:bg-red-500/10"
                        aria-label={`Remover ${book.title} da leitura rapida`}
                      >
                        <Trash2 size={ICON_SIZE} strokeWidth={STROKE_WIDTH} />
                        Remover da lista
                      </button>
                    </div>
                  ) : null}
                </div>
                <div className="ml-2">
                  <div className="truncate text-sm font-medium text-zinc-100">
                    {book.title}
                  </div>
                  <div className="mt-0.5 text-xs text-zinc-500">
                    {book.totalPages}p total{" "}
                    {book.todayPages > 0 && (
                      <span className="font-semibold text-green-500">
                        (+{book.todayPages}p)
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <input
                data-quick-reading-control
                tabIndex={tabStart}
                type="number"
                inputMode="numeric"
                min="1"
                value={draft.pages}
                onChange={(event) =>
                  updateDraft(book.key, { pages: event.target.value })
                }
                onKeyDown={handleFastKeyDown}
                placeholder="pag"
                aria-label={`Paginas de ${book.title}`}
                className="h-9 w-full rounded-sm border border-zinc-700 bg-zinc-800/70 px-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-green-500 focus:ring-1 focus:ring-green-500"
              />

              <input
                data-quick-reading-control
                tabIndex={tabStart + 1}
                type="number"
                inputMode="numeric"
                min="1"
                value={draft.readingTime}
                onChange={(event) =>
                  updateDraft(book.key, { readingTime: event.target.value })
                }
                onKeyDown={handleFastKeyDown}
                placeholder="min"
                aria-label={`Minutos de ${book.title}`}
                className="h-9 w-full rounded-sm border border-zinc-700 bg-zinc-800/70 px-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-green-500 focus:ring-1 focus:ring-green-500"
              />

              <button
                data-quick-reading-control
                tabIndex={tabStart + 2}
                type="button"
                onClick={() =>
                  updateDraft(book.key, {
                    dateMode:
                      draft.dateMode === "today" ? "yesterday" : "today",
                  })
                }
                onKeyDown={handleFastKeyDown}
                className="flex h-9 cursor-pointer items-center gap-1.5 rounded-sm border border-zinc-700 bg-zinc-800 px-2 text-xs font-medium text-zinc-300 transition hover:border-zinc-600 hover:text-zinc-100"
                aria-label={`Data de ${book.title}`}
                title={draft.dateMode === "today" ? "Hoje" : "Ontem"}
              >
                <CalendarDays size={ICON_SIZE} strokeWidth={STROKE_WIDTH} />
                {draft.dateMode === "today" ? "Hoje" : "Ontem"}
              </button>

              <button
                data-quick-reading-control
                tabIndex={tabStart + 3}
                type="submit"
                disabled={!canSubmit}
                onKeyDown={handleFastKeyDown}
                className={`flex h-9 cursor-pointer items-center gap-1.5 rounded-sm px-2 text-xs font-semibold transition ${
                  canSubmit
                    ? "bg-green-600 text-black hover:bg-green-500"
                    : "cursor-not-allowed bg-zinc-800 text-zinc-600"
                }`}
                title={book.categoryId ? "Registrar leitura" : "Sem categoria"}
              >
                {isSubmitting ? (
                  <Loader2 size={ICON_SIZE} className="animate-spin" />
                ) : (
                  <Send size={ICON_SIZE} strokeWidth={STROKE_WIDTH} />
                )}
                Enviar
              </button>
            </form>
          );
        })}
      </div>
    </div>
  );
}
