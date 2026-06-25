import type { MobileCategory, MobileReadingEntry } from "./readingApi";

export interface MobileDailyPoint {
  date: string;
  pages: number;
  minutes: number;
}

export interface MobileCategoryTotal {
  categoryId: string;
  name: string;
  pages: number;
}

export interface MobileStreakDay {
  date: string;
  dayLabel: string;
  dayNumber: number;
  pages: number;
  hasRead: boolean;
}

export interface MobileReadingSummary {
  totalPages: number;
  totalMinutes: number;
  todayPages: number;
  weekPages: number;
  monthPages: number;
  averagePagesPerReading: number;
  readingDays: number;
  currentStreak: number;
}

export interface MobileFrequentBook {
  key: string;
  title: string;
  bookId?: string | null;
  categoryId?: string | null;
  recentPages: number;
  totalPages: number;
  todayPages: number;
}

const WEEKDAY_LABELS = ["D", "S", "T", "Q", "Q", "S", "S"];

export function toLocalIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseLocalIsoDate(date: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function startOfLocalDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function sumPagesByDate(readings: MobileReadingEntry[]) {
  const pagesByDate = new Map<string, number>();
  readings.forEach((reading) => {
    pagesByDate.set(
      reading.reading_date,
      (pagesByDate.get(reading.reading_date) || 0) + Number(reading.pages || 0),
    );
  });
  return pagesByDate;
}

export function buildDailyReadingData(
  readings: MobileReadingEntry[],
  dayCount = 14,
  endDate = new Date(),
): MobileDailyPoint[] {
  const end = startOfLocalDay(endDate);
  const start = addDays(end, -(Math.max(1, dayCount) - 1));
  const byDate = new Map<string, MobileDailyPoint>();

  readings.forEach((reading) => {
    const existing = byDate.get(reading.reading_date) || {
      date: reading.reading_date,
      pages: 0,
      minutes: 0,
    };
    existing.pages += Number(reading.pages || 0);
    existing.minutes += Number(reading.reading_time || 0);
    byDate.set(reading.reading_date, existing);
  });

  return Array.from({ length: Math.max(1, dayCount) }, (_, index) => {
    const date = toLocalIsoDate(addDays(start, index));
    return byDate.get(date) || { date, pages: 0, minutes: 0 };
  });
}

export function buildWeekStreakDays(
  readings: MobileReadingEntry[],
  today = new Date(),
): MobileStreakDay[] {
  const current = startOfLocalDay(today);
  const dayOfWeek = current.getDay();
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const start = addDays(current, -daysToMonday);
  const pagesByDate = sumPagesByDate(readings);

  return Array.from({ length: 7 }, (_, index) => {
    const day = addDays(start, index);
    const date = toLocalIsoDate(day);
    const pages = pagesByDate.get(date) || 0;
    return {
      date,
      dayLabel: WEEKDAY_LABELS[day.getDay()],
      dayNumber: day.getDate(),
      pages,
      hasRead: pages > 0,
    };
  });
}

export function computeCurrentStreak(
  readings: MobileReadingEntry[],
  today = new Date(),
): number {
  const pagesByDate = sumPagesByDate(readings);
  let streak = 0;

  for (let index = 0; index < 366; index++) {
    const date = toLocalIsoDate(addDays(today, -index));
    if ((pagesByDate.get(date) || 0) <= 0) break;
    streak += 1;
  }

  return streak;
}

export function summarizeMobileReadings(
  readings: MobileReadingEntry[],
  today = new Date(),
): MobileReadingSummary {
  const todayIso = toLocalIsoDate(today);
  const startOfWeek = startOfLocalDay(today);
  const dayOfWeek = startOfWeek.getDay();
  startOfWeek.setDate(startOfWeek.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  const monthKey = todayIso.slice(0, 7);
  const readingDays = new Set(readings.map((reading) => reading.reading_date));

  const summary = readings.reduce(
    (acc, reading) => {
      const pages = Number(reading.pages || 0);
      const minutes = Number(reading.reading_time || 0);
      const date = parseLocalIsoDate(reading.reading_date);

      acc.totalPages += pages;
      acc.totalMinutes += minutes;
      if (reading.reading_date === todayIso) acc.todayPages += pages;
      if (date >= startOfWeek) acc.weekPages += pages;
      if (reading.reading_date.startsWith(monthKey)) acc.monthPages += pages;
      return acc;
    },
    {
      totalPages: 0,
      totalMinutes: 0,
      todayPages: 0,
      weekPages: 0,
      monthPages: 0,
      averagePagesPerReading: 0,
      readingDays: readingDays.size,
      currentStreak: 0,
    },
  );

  summary.averagePagesPerReading = readings.length
    ? Math.round(summary.totalPages / readings.length)
    : 0;
  summary.currentStreak = computeCurrentStreak(readings, today);
  return summary;
}

export function buildCategoryTotals(
  readings: MobileReadingEntry[],
  categories: MobileCategory[],
): MobileCategoryTotal[] {
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
  const totals = new Map<string, MobileCategoryTotal>();

  readings.forEach((reading) => {
    const categoryId = reading.category_id || "uncategorized";
    const existing = totals.get(categoryId) || {
      categoryId,
      name: categoryNames.get(categoryId) || "Sem categoria",
      pages: 0,
    };
    existing.pages += Number(reading.pages || 0);
    totals.set(categoryId, existing);
  });

  return Array.from(totals.values())
    .filter((item) => item.pages > 0)
    .sort((left, right) => right.pages - left.pages);
}

export function getFrequentMobileBooks(
  readings: MobileReadingEntry[],
  now = new Date(),
): MobileFrequentBook[] {
  const todayIso = toLocalIsoDate(now);
  const startDate = startOfLocalDay(addDays(now, -6));
  const grouped = new Map<MobileFrequentBook["key"], MobileFrequentBook & { latest: number }>();

  readings.forEach((reading) => {
    const title = reading.source_name?.trim();
    if (!title) return;
    const key = reading.book_id || `title:${title.toLocaleLowerCase("pt-BR")}`;
    const date = parseLocalIsoDate(reading.reading_date);
    const time = date.getTime();
    const existing = grouped.get(key) || {
      key,
      title,
      bookId: reading.book_id,
      categoryId: reading.category_id,
      recentPages: 0,
      totalPages: 0,
      todayPages: 0,
      latest: -Infinity,
    };

    existing.totalPages += Number(reading.pages || 0);
    if (reading.reading_date === todayIso) {
      existing.todayPages += Number(reading.pages || 0);
    }
    if (date >= startDate) {
      existing.recentPages += Number(reading.pages || 0);
    }
    if (time >= existing.latest) {
      existing.latest = time;
      existing.title = title;
      existing.bookId = reading.book_id || existing.bookId;
      existing.categoryId = reading.category_id || existing.categoryId;
    }
    grouped.set(key, existing);
  });

  return Array.from(grouped.values())
    .filter((book) => book.recentPages > 0)
    .sort((left, right) => {
      if (right.recentPages !== left.recentPages) return right.recentPages - left.recentPages;
      return right.latest - left.latest;
    })
    .slice(0, 4)
    .map(({ latest: _latest, ...book }) => book);
}

export function formatReadingMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}min` : `${hours}h`;
}
