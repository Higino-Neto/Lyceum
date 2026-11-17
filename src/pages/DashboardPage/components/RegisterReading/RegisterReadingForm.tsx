import { FormEvent, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Copy, Loader2, NotebookPen, Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import Select from "../../../../components/ui/Select";
import { useRouteState } from "../../../../hooks/useRouteState";
import saveReadingEntries from "../../../../utils/saveReadingEntries";
import { formatNumber, useLanguage, useTranslation } from "../../../../i18n";
import { currentStreak, dailyTotals, toIsoDate } from "../../../../features/stats/readingAnalytics";
import { getFrequentRecentBooks } from "../frequentBooks";
import { useCategories, useReadingGoals, useReadingRecords, useStreakFreeze } from "../../hooks/useDashboardData";
import ProgressBar from "../stats/ProgressBar";
import BookSearch, { type Book, type LocalBook } from "./BookSearch";

interface ReadingEntry {
  id: string;
  bookTitle: string;
  bookId: string | null;
  numPages: string;
  category_id: string;
  readingTime: string;
  date: string;
}

const today = () => toIsoDate(new Date());

function emptyEntry(): ReadingEntry {
  return { id: crypto.randomUUID(), bookTitle: "", bookId: null, numPages: "", category_id: "", readingTime: "", date: today() };
}

const INPUT_CLASS =
  "w-full rounded-sm border border-border-strong bg-surface-muted/50 px-2 py-2 text-sm text-foreground placeholder:text-input-placeholder focus:outline-none focus:border-primary";

/**
 * Multi-row reading log (formerly the /add_reading screen). Rows stay as a
 * draft in route state until they are saved; the header shows today's totals.
 */
export default function RegisterReadingForm() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const { saveState, loadState, clearState } = useRouteState();
  const { data: categories } = useCategories();
  const { records } = useReadingRecords();
  const { dailyGoal } = useReadingGoals();
  const [freezeEnabled] = useStreakFreeze();
  const [saving, setSaving] = useState(false);
  const [entries, setEntries] = useState<ReadingEntry[]>(() => {
    const saved = loadState()?.registerEntries;
    if (Array.isArray(saved) && saved.length > 0) {
      return (saved as ReadingEntry[]).map((entry) => ({ ...entry, date: today() }));
    }
    return [emptyEntry()];
  });

  useEffect(() => {
    saveState({ registerEntries: entries });
  }, [entries, saveState]);

  const todayStats = useMemo(() => {
    const daily = dailyTotals(records);
    const day = daily.get(today());
    return { pages: day?.pages ?? 0, minutes: day?.minutes ?? 0, streak: currentStreak(daily, new Date(), freezeEnabled ? 1 : 0).days };
  }, [freezeEnabled, records]);

  const recentBooks = useMemo(() => getFrequentRecentBooks(records as Parameters<typeof getFrequentRecentBooks>[0]).slice(0, 6), [records]);

  const updateEntry = (id: string, patch: Partial<ReadingEntry>) => {
    setEntries((current) => current.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));
  };

  const handleBookSelect = (entryId: string, book: Book | LocalBook | null, categoryId?: string | null) => {
    setEntries((current) => current.map((entry) => {
      if (entry.id !== entryId) return entry;
      const isLocal = book !== null && "fileHash" in book;
      return {
        ...entry,
        bookTitle: book?.title || entry.bookTitle,
        bookId: book ? (isLocal ? (book as LocalBook).fileHash : (book as Book).id) : null,
        category_id: categoryId ?? entry.category_id,
      };
    }));
  };

  /** Fills the first empty row (or a new one) with a recently read book. */
  const fillWithRecentBook = (book: (typeof recentBooks)[number]) => {
    setEntries((current) => {
      const filled = { bookTitle: book.title, bookId: book.bookId ?? null, category_id: book.categoryId ?? "" };
      const emptyIndex = current.findIndex((entry) => !entry.bookTitle.trim());
      if (emptyIndex >= 0) return current.map((entry, index) => (index === emptyIndex ? { ...entry, ...filled } : entry));
      return [...current, { ...emptyEntry(), ...filled }];
    });
  };

  const duplicateEntry = (id: string) => {
    setEntries((current) => {
      const index = current.findIndex((entry) => entry.id === id);
      const source = current[index];
      if (!source) return current;
      const next = [...current];
      next.splice(index + 1, 0, { ...source, id: crypto.randomUUID(), bookId: null });
      return next;
    });
  };

  const removeEntry = (id: string) => {
    setEntries((current) => (current.length > 1 ? current.filter((entry) => entry.id !== id) : current));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validEntries = entries.filter((entry) => entry.bookTitle.trim() !== "" && entry.numPages !== "" && entry.category_id !== "");
    if (validEntries.length === 0) {
      toast.error(t("reading:add.toasts.formIncomplete"));
      return;
    }

    setSaving(true);
    try {
      await saveReadingEntries(validEntries);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["readings"] }),
        queryClient.invalidateQueries({ queryKey: ["ranking"] }),
        queryClient.invalidateQueries({ queryKey: ["readingStats"] }),
        queryClient.invalidateQueries({ queryKey: ["selectedUsersReadings"] }),
        queryClient.invalidateQueries({ queryKey: ["books"] }),
      ]);
      const pages = validEntries.filter((entry) => entry.date === today()).reduce((sum, entry) => sum + Number(entry.numPages), 0);
      window.dispatchEvent(new CustomEvent("lyceum:reading-submitted", {
        detail: { pages, metaBatida: dailyGoal > 0 && pages > 0 && todayStats.pages + pages >= dailyGoal },
      }));
      toast.success(t("reading:add.toasts.registered", { count: validEntries.length }));
      // Keep rows that were not complete so nothing typed is lost.
      const remaining = entries.filter((entry) => !validEntries.includes(entry) && entry.bookTitle.trim() !== "");
      clearState();
      setEntries(remaining.length > 0 ? remaining : [emptyEntry()]);
    } catch (error) {
      toast.error(t("reading:add.toasts.registerFailed", {
        reason: error instanceof Error ? error.message : t("reading:errors.unknown"),
      }));
    } finally {
      setSaving(false);
    }
  };

  const filledCount = entries.filter((entry) => entry.bookTitle.trim() && entry.numPages).length;

  return (
    <section className="rounded-sm border border-border bg-surface p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <div className="flex items-center gap-2 text-foreground-subtle">
          <NotebookPen size={16} strokeWidth={1.5} />
          <h2 className="text-sm font-medium text-foreground">{t("dashboard:register.title")}</h2>
        </div>
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-x-5 gap-y-1 text-xs text-foreground-subtle">
          <span>
            {t("dashboard:register.today")}{" "}
            <span className="font-semibold tabular-nums text-foreground">
              {dailyGoal > 0
                ? t("dashboard:register.pagesOfGoal", { pages: formatNumber(todayStats.pages, language), goal: formatNumber(dailyGoal, language) })
                : t("dashboard:register.pages", { count: todayStats.pages })}
            </span>
          </span>
          {dailyGoal > 0 && (
            <span className="flex w-28 items-center">
              <ProgressBar value={todayStats.pages} max={dailyGoal} />
            </span>
          )}
          {dailyGoal > todayStats.pages && (
            <span>{t("dashboard:register.remaining", { count: dailyGoal - todayStats.pages })}</span>
          )}
          <span className="tabular-nums">{t("dashboard:register.minutes", { count: todayStats.minutes })}</span>
          <span className="tabular-nums">{t("dashboard:register.streak", { count: todayStats.streak })}</span>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="mb-2 hidden grid-cols-12 gap-3 px-2 text-xs font-medium uppercase tracking-wider text-foreground-subtle md:grid">
          <div className="col-span-4">{t("reading:add.columns.work")}</div>
          <div className="col-span-1">{t("reading:add.columns.pagesShort")}</div>
          <div className="col-span-1">{t("reading:add.columns.time")}</div>
          <div className="col-span-2">{t("reading:add.columns.category")}</div>
          <div className="col-span-2">{t("reading:add.columns.date")}</div>
        </div>

        <div className="space-y-2">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="grid grid-cols-2 items-center gap-2 rounded-sm border border-border p-2 transition hover:border-border-strong md:grid-cols-12 md:gap-3"
            >
              <div className="col-span-2 md:col-span-4">
                <BookSearch
                  value={entry.bookTitle}
                  onChange={(value) => updateEntry(entry.id, { bookTitle: value })}
                  onBookSelect={(book, categoryId) => handleBookSelect(entry.id, book, categoryId)}
                />
              </div>
              <div className="md:col-span-1">
                <input
                  type="number"
                  value={entry.numPages}
                  onChange={(event) => updateEntry(entry.id, { numPages: event.target.value })}
                  placeholder={t("reading:add.pagesPlaceholder")}
                  aria-label={t("reading:add.columns.pagesShort")}
                  min="1"
                  className={INPUT_CLASS}
                />
              </div>
              <div className="md:col-span-1">
                <input
                  type="number"
                  value={entry.readingTime}
                  onChange={(event) => updateEntry(entry.id, { readingTime: event.target.value })}
                  placeholder={t("reading:add.timePlaceholder")}
                  aria-label={t("reading:add.columns.time")}
                  min="1"
                  className={INPUT_CLASS}
                />
              </div>
              <div className="md:col-span-2">
                <Select
                  value={entry.category_id || ""}
                  onChange={(value) => updateEntry(entry.id, { category_id: value })}
                  placeholder={t("reading:add.selectCategory")}
                  className="h-10 w-full text-sm"
                  items={(categories ?? []).map((category) => ({ value: category.id, label: `${category.name} (${category.points_per_page}x)` }))}
                />
              </div>
              <div className="md:col-span-2">
                <input
                  type="date"
                  value={entry.date}
                  onChange={(event) => updateEntry(entry.id, { date: event.target.value })}
                  aria-label={t("reading:add.columns.date")}
                  className={INPUT_CLASS}
                />
              </div>
              <div className="col-span-2 flex items-center justify-end gap-4 px-2">
                <button
                  type="button"
                  onClick={() => duplicateEntry(entry.id)}
                  className="cursor-pointer text-foreground-subtle transition hover:text-foreground"
                  title={t("reading:add.actions.duplicateRow")}
                  aria-label={t("reading:add.actions.duplicateRow")}
                >
                  <Copy size={16} strokeWidth={1.5} />
                </button>
                <button
                  type="button"
                  disabled={entries.length < 2}
                  onClick={() => removeEntry(entry.id)}
                  className={entries.length < 2 ? "cursor-not-allowed text-foreground-subtle opacity-40" : "cursor-pointer text-foreground-subtle transition hover:text-destructive"}
                  title={t("reading:add.actions.removeRow")}
                  aria-label={t("reading:add.actions.removeRow")}
                >
                  <Trash2 size={16} strokeWidth={1.5} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {recentBooks.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-foreground-subtle">{t("dashboard:register.recent")}</span>
            {recentBooks.map((book) => (
              <button
                key={book.key}
                type="button"
                onClick={() => fillWithRecentBook(book)}
                className="max-w-56 cursor-pointer truncate rounded-sm border border-border bg-surface-muted px-2 py-1 text-foreground-muted transition hover:border-border-strong hover:text-foreground"
                title={t("dashboard:register.fillRow", { book: book.title })}
              >
                {book.title}
              </button>
            ))}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
          <button
            type="button"
            onClick={() => setEntries((current) => [...current, emptyEntry()])}
            className="flex cursor-pointer items-center gap-2 text-sm font-medium text-primary transition hover:text-primary-hover"
          >
            <Plus size={16} />
            {t("reading:add.actions.addAnother")}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex cursor-pointer items-center gap-2 rounded-sm bg-primary px-6 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover disabled:cursor-wait disabled:opacity-70"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <NotebookPen size={15} />}
            {t("reading:add.submit", { count: Math.max(1, filledCount) })}
          </button>
        </div>
      </form>
    </section>
  );
}
