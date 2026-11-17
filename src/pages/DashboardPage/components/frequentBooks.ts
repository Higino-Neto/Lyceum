import type TableReading from "../../../types/TableReading";

/** Books read recently, used by quick reading and the register form shortcuts. */
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

export function toLocalIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function normalizeTitle(title: string): string {
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
