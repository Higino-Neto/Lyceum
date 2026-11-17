import { GraduationCap } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "../i18n";
import { getBookProgress } from "./libraryModel";
import type { MobileBook } from "./types";

/**
 * Recently opened books, newest first. Works offline and signed out: it is the
 * first thing on the Today screen so reading is always one tap away.
 */
export default function ContinueReadingRow({ books, onOpenBook }: { books: MobileBook[]; onOpenBook(bookId: string): void }) {
  const { t } = useTranslation();
  const recent = useMemo(
    () => books.filter((book) => book.lastOpenedAt).sort((a, b) => String(b.lastOpenedAt).localeCompare(String(a.lastOpenedAt))).slice(0, 10),
    [books],
  );
  if (recent.length === 0) return null;
  return (
    <section aria-label={t("mobile:dashboard.continueReading")}>
      <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-widest text-foreground-subtle">{t("mobile:dashboard.continueReading")}</h2>
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {recent.map((book) => {
          const progress = getBookProgress(book);
          return (
            <button
              key={book.id}
              type="button"
              onClick={() => onOpenBook(book.id)}
              className="w-28 shrink-0 snap-start text-left transition-transform active:scale-[.97]"
              aria-label={book.title}
            >
              <div className="relative aspect-[3/4] overflow-hidden rounded-xl border border-border bg-surface-muted shadow-md">
                {book.thumbnailUrl
                  ? <img className="h-full w-full object-cover" src={book.thumbnailUrl} alt="" loading="lazy" />
                  : <div className="grid h-full w-full place-items-center p-2 text-center text-[11px] font-semibold text-primary">{book.title}</div>}
                {book.lastReaderMode === "learning" && (
                  <span className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-surface/90 text-primary" title={t("mobile:learning.openForLearning")}>
                    <GraduationCap size={14} />
                  </span>
                )}
                <div className="absolute inset-x-0 bottom-0 h-1 bg-black/30"><div className="h-full bg-primary" style={{ width: `${progress}%` }} /></div>
              </div>
              <p className="mt-1.5 line-clamp-2 text-xs font-medium leading-4 text-foreground">{book.title}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
