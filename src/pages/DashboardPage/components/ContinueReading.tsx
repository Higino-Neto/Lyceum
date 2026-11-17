import { BookOpenText } from "lucide-react";
import { formatNumber, useLanguage, useTranslation } from "../../../i18n";
import type { LibraryBookRef } from "../../../types/StatsTypes";
import { useLibrarySummary, useThumbnails } from "../hooks/useDashboardData";
import { useOpenBook } from "../hooks/useOpenBook";
import ProgressBar from "./stats/ProgressBar";

export function BookCover({ src, title, className = "h-14 w-10" }: { src?: string | null; title: string; className?: string }) {
  return src ? (
    <img src={src} alt="" className={`${className} shrink-0 border border-border object-cover`} />
  ) : (
    <div className={`${className} flex shrink-0 items-center justify-center border border-border bg-surface-muted text-[10px] font-semibold uppercase text-foreground-subtle`}>
      {title.slice(0, 2)}
    </div>
  );
}

function relativeDays(value: string | null, locale: string): string {
  if (!value) return "";
  const date = new Date(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);
  const days = Math.round((Date.now() - date.getTime()) / 86_400_000);
  try {
    return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(-Math.max(0, days), "day");
  } catch {
    return date.toLocaleDateString(locale);
  }
}

/** Books recently opened in the reader that are still in progress. */
export default function ContinueReading() {
  const { t } = useTranslation();
  const { language, locale } = useLanguage();
  const { data } = useLibrarySummary();
  const books: LibraryBookRef[] = data?.continueReading.slice(0, 5) ?? [];
  const thumbnails = useThumbnails(books.map((book) => book.thumbnailPath));
  const openBook = useOpenBook();

  if (books.length === 0) return null;

  return (
    <section className="rounded-sm border border-border bg-surface p-4">
      <div className="mb-3 flex items-center gap-2 text-foreground-subtle">
        <BookOpenText size={16} strokeWidth={1.5} />
        <h2 className="text-sm font-medium text-foreground">{t("dashboard:overview.continueReading")}</h2>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {books.map((book) => {
          const ratio = book.numPages > 0 ? Math.min(1, book.currentPage / book.numPages) : 0;
          return (
            <button
              key={book.id}
              type="button"
              onClick={() => void openBook(book.id)}
              className="flex min-w-0 cursor-pointer items-center gap-3 rounded-sm border border-border p-2 text-left transition hover:border-border-strong hover:bg-surface-muted"
              title={t("dashboard:overview.openBook", { book: book.title })}
            >
              <BookCover src={book.thumbnailPath ? thumbnails[book.thumbnailPath] : null} title={book.title} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-foreground">{book.title}</div>
                <div className="truncate text-xs text-foreground-subtle">{book.author || relativeDays(book.lastOpenedAt, locale)}</div>
                <ProgressBar value={book.currentPage} max={book.numPages} className="mt-2" />
                <div className="mt-1 flex justify-between text-[11px] tabular-nums text-foreground-subtle">
                  <span>{t("dashboard:overview.pageOf", { page: formatNumber(book.currentPage, language), total: formatNumber(book.numPages, language) })}</span>
                  <span>{formatNumber(Math.round(ratio * 100), language)}%</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
