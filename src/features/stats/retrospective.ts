import {
  addDays,
  dailyTotals,
  hourDistribution,
  longestStreak,
  monthKey,
  pagesByBook,
  totalsBetween,
  type PeriodTotals,
  type ReadingRecord,
} from "./readingAnalytics";

export interface PeriodReview {
  totals: PeriodTotals;
  previous: PeriodTotals;
  bestDay: { date: string; pages: number } | null;
  bestMonth: { month: string; pages: number } | null;
  topBook: { title: string; pages: number } | null;
  topCategoryId: string | null;
  longestStreak: number;
  peakHour: number | null;
  books: number;
}

function review(readings: readonly ReadingRecord[], start: Date, endInclusive: Date, previousStart: Date, previousEnd: Date): PeriodReview {
  const from = start.getTime();
  const to = endInclusive.getTime();
  const inPeriod = readings.filter((reading) => {
    const [year = 1970, month = 1, day = 1] = reading.reading_date.slice(0, 10).split("-").map(Number);
    const time = new Date(year, month - 1, day).getTime();
    return time >= from && time <= to;
  });
  const all = dailyTotals(readings);
  const daily = dailyTotals(inPeriod);
  let bestDay: PeriodReview["bestDay"] = null;
  const months = new Map<string, number>();
  for (const day of daily.values()) {
    if (day.pages > 0 && (!bestDay || day.pages > bestDay.pages)) bestDay = { date: day.date, pages: day.pages };
    const key = day.date.slice(0, 7);
    months.set(key, (months.get(key) ?? 0) + day.pages);
  }
  const bestMonthEntry = [...months.entries()].sort((a, b) => b[1] - a[1])[0];
  const bookEntry = [...pagesByBook(inPeriod).entries()].sort((a, b) => b[1] - a[1])[0];
  const categories = new Map<string, number>();
  for (const reading of inPeriod) {
    if (!reading.category_id) continue;
    categories.set(reading.category_id, (categories.get(reading.category_id) ?? 0) + reading.pages);
  }
  const hours = hourDistribution(inPeriod);
  const peak = Math.max(...hours);
  return {
    totals: totalsBetween(all, start, endInclusive),
    previous: totalsBetween(all, previousStart, previousEnd),
    bestDay,
    bestMonth: bestMonthEntry && bestMonthEntry[1] > 0 ? { month: bestMonthEntry[0], pages: bestMonthEntry[1] } : null,
    topBook: bookEntry ? { title: bookEntry[0], pages: bookEntry[1] } : null,
    topCategoryId: [...categories.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    longestStreak: longestStreak(daily).days,
    peakHour: peak > 0 ? hours.indexOf(peak) : null,
    books: pagesByBook(inPeriod).size,
  };
}

/** Year in review; the current year is compared with the same span last year. */
export function yearReview(readings: readonly ReadingRecord[], year: number, now: Date): PeriodReview {
  const start = new Date(year, 0, 1);
  const isCurrent = year === now.getFullYear();
  const end = isCurrent ? new Date(now.getFullYear(), now.getMonth(), now.getDate()) : new Date(year, 11, 31);
  const previousStart = new Date(year - 1, 0, 1);
  const previousEnd = isCurrent ? new Date(year - 1, now.getMonth(), now.getDate()) : new Date(year - 1, 11, 31);
  return review(readings, start, end, previousStart, previousEnd);
}

/** Month in review (`offset` 0 = current month to date, 1 = last month). */
export function monthReview(readings: readonly ReadingRecord[], now: Date, offset: number): PeriodReview & { month: string } {
  const start = new Date(now.getFullYear(), now.getMonth() - offset, 1);
  const end = offset === 0 ? new Date(now.getFullYear(), now.getMonth(), now.getDate()) : new Date(start.getFullYear(), start.getMonth() + 1, 0);
  const previousStart = new Date(start.getFullYear(), start.getMonth() - 1, 1);
  const elapsed = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  const previousMonthEnd = new Date(start.getFullYear(), start.getMonth(), 0);
  const previousEnd = new Date(Math.min(addDays(previousStart, elapsed).getTime(), previousMonthEnd.getTime()));
  return { ...review(readings, start, end, previousStart, previousEnd), month: monthKey(start) };
}

/** Years that have at least one reading, newest first. */
export function readingYears(readings: readonly ReadingRecord[], now: Date): number[] {
  const years = new Set<number>([now.getFullYear()]);
  for (const reading of readings) years.add(Number(reading.reading_date.slice(0, 4)));
  return [...years].filter((year) => Number.isFinite(year) && year > 1970).sort((a, b) => b - a);
}
