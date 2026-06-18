import { FormEvent, KeyboardEvent, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, CalendarDays, Loader2, Send } from "lucide-react";
import toast from "react-hot-toast";
import { createReadingEntry } from "../../../api/database";
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
    const book =
      existing ??
      {
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
    .slice(0, 3)
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
  const { data: readings, isLoading } = useQuery({
    queryKey: ["readings"],
    queryFn: getReadings,
  });
  const [drafts, setDrafts] = useState<Record<string, QuickReadingDraft>>({});
  const [submittingKey, setSubmittingKey] = useState<string | null>(null);

  const frequentBooks = useMemo(
    () => getFrequentRecentBooks(readings ?? []),
    [readings],
  );

  useEffect(() => {
    setDrafts((current) => {
      const next: Record<string, QuickReadingDraft> = {};
      frequentBooks.forEach((book) => {
        next[book.key] = current[book.key] ?? {
          pages: "",
          readingTime: "",
          dateMode: "today",
        };
      });
      return next;
    });
  }, [frequentBooks]);

  const updateDraft = (
    key: string,
    patch: Partial<QuickReadingDraft>,
  ) => {
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

  if (isLoading) {
    return (
      <div className="h-full rounded-sm border border-zinc-800 bg-zinc-900 p-4">
        <div className="h-5 w-28 animate-pulse rounded bg-zinc-800" />
        <div className="mt-4 space-y-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-12 animate-pulse rounded-sm bg-zinc-800" />
          ))}
        </div>
      </div>
    );
  }

  if (frequentBooks.length === 0) {
    return (
      <div className="flex h-full flex-col justify-between rounded-sm border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex items-center gap-2 text-zinc-500">
          <BookOpen size={ICON_SIZE} strokeWidth={STROKE_WIDTH} />
          <span className="text-sm font-medium text-zinc-400">Leitura rapida</span>
        </div>
        <div className="py-8 text-center text-sm text-zinc-500">
          Nenhum livro nos ultimos 7 dias
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3 rounded-sm border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-center  gap-2 text-zinc-500">
        <BookOpen size={ICON_SIZE} strokeWidth={STROKE_WIDTH} />
        {/* <span className="text-sm font-medium text-zinc-400">Leitura rapida</span> */}
      </div>

      <div className="flex flex-1 justify-between flex-col gap-2">
        {frequentBooks.map((book, index) => {
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
              className="grid grid-cols-[minmax(0,1fr)_4rem_4rem_auto_auto] items-center gap-2 rounded-sm border border-zinc-800 bg-zinc-850 p-2"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-zinc-100">
                  {book.title}
                </div>
                <div className="mt-0.5 text-xs text-zinc-500">
                  {book.totalPages}p total{" "}
                  {book.todayPages > 0 &&
                  (<span className="font-semibold text-green-500">
                    (+{book.todayPages}p)
                  </span>)}
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
