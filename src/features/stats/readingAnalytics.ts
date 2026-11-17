/**
 * Pure reading statistics derived from the user's reading log (Supabase
 * `readings`). Every function takes `now` explicitly so results are testable
 * and use local calendar days (never UTC slices of `toISOString`).
 */

export interface ReadingRecord {
  reading_date: string;
  pages: number;
  reading_time: number;
  source_name: string;
  created_at?: string | null;
  category_id?: string | null;
  book_id?: string | null;
}

export interface DayTotal {
  date: string;
  pages: number;
  minutes: number;
}

const DAY_MS = 86_400_000;

export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseIsoDate(value: string): Date {
  const [year = 1970, month = 1, day = 1] = value.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Monday-based week start, matching the dashboard's weekly streak. */
export function startOfWeek(date: Date): Date {
  const day = startOfDay(date);
  const offset = (day.getDay() + 6) % 7;
  return addDays(day, -offset);
}

export function daysBetween(start: Date, end: Date): number {
  return Math.round((startOfDay(end).getTime() - startOfDay(start).getTime()) / DAY_MS);
}

export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function pct(current: number, previous: number): number | null {
  if (previous <= 0) return current > 0 ? null : 0;
  return Math.round(((current - previous) / previous) * 100);
}

/** Pages and minutes per local calendar day. */
export function dailyTotals(readings: readonly ReadingRecord[]): Map<string, DayTotal> {
  const totals = new Map<string, DayTotal>();
  for (const reading of readings) {
    const date = reading.reading_date.slice(0, 10);
    const entry = totals.get(date) ?? { date, pages: 0, minutes: 0 };
    entry.pages += Number(reading.pages) || 0;
    entry.minutes += Number(reading.reading_time) || 0;
    totals.set(date, entry);
  }
  return totals;
}

export interface PeriodTotals {
  pages: number;
  minutes: number;
  activeDays: number;
}

export function totalsBetween(daily: Map<string, DayTotal>, start: Date, endInclusive: Date): PeriodTotals {
  const from = toIsoDate(start);
  const to = toIsoDate(endInclusive);
  const result: PeriodTotals = { pages: 0, minutes: 0, activeDays: 0 };
  for (const day of daily.values()) {
    if (day.date < from || day.date > to) continue;
    result.pages += day.pages;
    result.minutes += day.minutes;
    if (day.pages > 0 || day.minutes > 0) result.activeDays += 1;
  }
  return result;
}

export type ComparisonPeriod = "week" | "month" | "year";

export interface PeriodComparison {
  period: ComparisonPeriod;
  current: PeriodTotals;
  previous: PeriodTotals;
  delta: { pages: number | null; minutes: number | null; activeDays: number | null };
}

function periodStart(period: ComparisonPeriod, now: Date): Date {
  if (period === "week") return startOfWeek(now);
  if (period === "month") return new Date(now.getFullYear(), now.getMonth(), 1);
  return new Date(now.getFullYear(), 0, 1);
}

function previousPeriodStart(period: ComparisonPeriod, now: Date): Date {
  if (period === "week") return addDays(startOfWeek(now), -7);
  if (period === "month") return new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return new Date(now.getFullYear() - 1, 0, 1);
}

/**
 * Period-to-date comparison: the current week/month/year so far against the
 * same elapsed span of the previous one (e.g. Mon–Wed vs last Mon–Wed), so a
 * partial period is never compared with a complete one.
 */
export function comparePeriod(daily: Map<string, DayTotal>, period: ComparisonPeriod, now: Date): PeriodComparison {
  const start = periodStart(period, now);
  const elapsed = daysBetween(start, now);
  const previousStart = previousPeriodStart(period, now);
  // Clamp the previous window to its own period (e.g. 31 Mar vs a 28-day Feb).
  const previousEnd = new Date(Math.min(addDays(previousStart, elapsed).getTime(), addDays(start, -1).getTime()));
  const current = totalsBetween(daily, start, now);
  const previous = totalsBetween(daily, previousStart, previousEnd);
  return {
    period,
    current,
    previous,
    delta: {
      pages: pct(current.pages, previous.pages),
      minutes: pct(current.minutes, previous.minutes),
      activeDays: pct(current.activeDays, previous.activeDays),
    },
  };
}

/** Pages per month (index 0 = January) for one calendar year. */
export function monthlyPages(daily: Map<string, DayTotal>, year: number): number[] {
  const months = Array.from({ length: 12 }, () => 0);
  for (const day of daily.values()) {
    if (Number(day.date.slice(0, 4)) !== year) continue;
    const month = Number(day.date.slice(5, 7)) - 1;
    months[month] = (months[month] ?? 0) + day.pages;
  }
  return months;
}

export interface StreakRun {
  days: number;
  start: string | null;
  end: string | null;
}

/** Longest run of consecutive days with any reading. */
export function longestStreak(daily: Map<string, DayTotal>): StreakRun {
  const dates = [...daily.values()].filter((day) => day.pages > 0 || day.minutes > 0).map((day) => day.date).sort();
  let best: StreakRun = { days: 0, start: null, end: null };
  let runStart: string | null = null;
  let previous: string | null = null;
  let length = 0;
  for (const date of dates) {
    if (previous && daysBetween(parseIsoDate(previous), parseIsoDate(date)) === 1) {
      length += 1;
    } else {
      length = 1;
      runStart = date;
    }
    if (length > best.days) best = { days: length, start: runStart, end: date };
    previous = date;
  }
  return best;
}

export interface CurrentStreak {
  days: number;
  /** Days covered by a freeze (no reading but the streak survived). */
  frozen: string[];
  /** Whether the current week still has a freeze available. */
  freezeAvailable: boolean;
}

/**
 * Current streak ending today (or yesterday: today is still open). With
 * `freezesPerWeek`, up to that many missed days per Monday-based week are
 * forgiven instead of breaking the streak.
 */
export function currentStreak(daily: Map<string, DayTotal>, now: Date, freezesPerWeek = 0): CurrentStreak {
  const read = (date: Date) => {
    const day = daily.get(toIsoDate(date));
    return Boolean(day && (day.pages > 0 || day.minutes > 0));
  };
  const used = new Map<string, number>();
  const frozen: string[] = [];
  let cursor = startOfDay(now);
  if (!read(cursor)) cursor = addDays(cursor, -1);
  let days = 0;
  let pendingFrozen: string[] = [];
  for (let guard = 0; guard < 5000; guard += 1) {
    if (read(cursor)) {
      days += 1 + pendingFrozen.length;
      frozen.push(...pendingFrozen);
      pendingFrozen = [];
    } else {
      const week = toIsoDate(startOfWeek(cursor));
      const usedThisWeek = used.get(week) ?? 0;
      if (usedThisWeek >= freezesPerWeek) break;
      used.set(week, usedThisWeek + 1);
      // A freeze only counts if an older reading day continues the streak.
      pendingFrozen.push(toIsoDate(cursor));
    }
    cursor = addDays(cursor, -1);
  }
  const thisWeek = toIsoDate(startOfWeek(now));
  const frozenThisWeek = frozen.filter((date) => date >= thisWeek).length;
  return { days, frozen, freezeAvailable: frozenThisWeek < freezesPerWeek };
}

export interface PersonalRecords {
  bestDay: { date: string; pages: number } | null;
  bestWeek: { start: string; pages: number } | null;
  bestMonth: { month: string; pages: number } | null;
  longestStreak: StreakRun;
  longestDay: { date: string; minutes: number } | null;
  fastestDay: { date: string; pagesPerHour: number } | null;
  topBook: { title: string; pages: number } | null;
}

export function personalRecords(readings: readonly ReadingRecord[], daily = dailyTotals(readings)): PersonalRecords {
  let bestDay: PersonalRecords["bestDay"] = null;
  let longestDay: PersonalRecords["longestDay"] = null;
  let fastestDay: PersonalRecords["fastestDay"] = null;
  const weeks = new Map<string, number>();
  const months = new Map<string, number>();
  for (const day of daily.values()) {
    if (!bestDay || day.pages > bestDay.pages) bestDay = { date: day.date, pages: day.pages };
    if (day.minutes > 0 && (!longestDay || day.minutes > longestDay.minutes)) longestDay = { date: day.date, minutes: day.minutes };
    // Ignore very short logs so a 5-page/2-minute entry is not a "record pace".
    if (day.minutes >= 20 && day.pages > 0) {
      const pagesPerHour = Math.round((day.pages / day.minutes) * 60);
      if (!fastestDay || pagesPerHour > fastestDay.pagesPerHour) fastestDay = { date: day.date, pagesPerHour };
    }
    const date = parseIsoDate(day.date);
    const week = toIsoDate(startOfWeek(date));
    weeks.set(week, (weeks.get(week) ?? 0) + day.pages);
    const month = monthKey(date);
    months.set(month, (months.get(month) ?? 0) + day.pages);
  }
  const maxEntry = (map: Map<string, number>) => {
    let best: [string, number] | null = null;
    for (const entry of map) if (!best || entry[1] > best[1]) best = entry;
    return best;
  };
  const week = maxEntry(weeks);
  const month = maxEntry(months);
  const book = maxEntry(pagesByBook(readings));
  return {
    bestDay: bestDay && bestDay.pages > 0 ? bestDay : null,
    bestWeek: week && week[1] > 0 ? { start: week[0], pages: week[1] } : null,
    bestMonth: month && month[1] > 0 ? { month: month[0], pages: month[1] } : null,
    longestStreak: longestStreak(daily),
    longestDay,
    fastestDay,
    topBook: book && book[1] > 0 ? { title: book[0], pages: book[1] } : null,
  };
}

/** Total pages per book title (case-insensitive merge, latest spelling wins). */
export function pagesByBook(readings: readonly ReadingRecord[]): Map<string, number> {
  const byKey = new Map<string, { title: string; pages: number }>();
  for (const reading of readings) {
    const title = reading.source_name?.trim();
    if (!title) continue;
    const key = title.toLocaleLowerCase();
    const entry = byKey.get(key) ?? { title, pages: 0 };
    entry.pages += Number(reading.pages) || 0;
    byKey.set(key, entry);
  }
  return new Map([...byKey.values()].map((entry) => [entry.title, entry.pages]));
}

export interface CalendarDay {
  date: string;
  pages: number;
  minutes: number;
  /** 0 = Sunday … 6 = Saturday. */
  weekday: number;
}

export function calendarDays(daily: Map<string, DayTotal>, start: Date, endInclusive: Date): CalendarDay[] {
  const days: CalendarDay[] = [];
  for (let cursor = startOfDay(start); cursor <= endInclusive; cursor = addDays(cursor, 1)) {
    const date = toIsoDate(cursor);
    const total = daily.get(date);
    days.push({ date, pages: total?.pages ?? 0, minutes: total?.minutes ?? 0, weekday: cursor.getDay() });
  }
  return days;
}

export interface DailyPoint {
  date: string;
  pages: number;
  average: number;
}

/** Last `days` days with a trailing moving average of `window` days. */
export function recentDays(daily: Map<string, DayTotal>, now: Date, days = 30, window = 7): DailyPoint[] {
  const start = addDays(now, -(days + window - 2));
  const series = calendarDays(daily, start, startOfDay(now));
  return series.slice(window - 1).map((day, index) => {
    const slice = series.slice(index, index + window);
    const average = slice.reduce((sum, item) => sum + item.pages, 0) / window;
    return { date: day.date, pages: day.pages, average: Math.round(average * 10) / 10 };
  });
}

export interface MonthPoint {
  month: string;
  pages: number;
  minutes: number;
  activeDays: number;
  daysInMonth: number;
  /** Pages per hour, only over logs that recorded a reading time. */
  pagesPerHour: number | null;
}

/** The last `count` calendar months (current month included, to date). */
export function monthlySeries(readings: readonly ReadingRecord[], now: Date, count = 12): MonthPoint[] {
  const daily = dailyTotals(readings);
  const timed = new Map<string, { pages: number; minutes: number }>();
  for (const reading of readings) {
    if (!(reading.reading_time > 0)) continue;
    const key = reading.reading_date.slice(0, 7);
    const entry = timed.get(key) ?? { pages: 0, minutes: 0 };
    entry.pages += reading.pages;
    entry.minutes += reading.reading_time;
    timed.set(key, entry);
  }
  const points: MonthPoint[] = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const first = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const last = offset === 0 ? startOfDay(now) : new Date(first.getFullYear(), first.getMonth() + 1, 0);
    const totals = totalsBetween(daily, first, last);
    const key = monthKey(first);
    const pace = timed.get(key);
    points.push({
      month: key,
      pages: totals.pages,
      minutes: totals.minutes,
      activeDays: totals.activeDays,
      daysInMonth: last.getDate(),
      pagesPerHour: pace && pace.minutes > 0 ? Math.round((pace.pages / pace.minutes) * 60) : null,
    });
  }
  return points;
}

/** Pages per category per month, for a stacked area. Keys are category ids. */
export function categoryMonthly(readings: readonly ReadingRecord[], now: Date, count = 12): Array<Record<string, number | string>> {
  const firstMonth = new Date(now.getFullYear(), now.getMonth() - (count - 1), 1);
  const rows = new Map<string, Record<string, number | string>>();
  for (let offset = 0; offset < count; offset += 1) {
    const key = monthKey(new Date(firstMonth.getFullYear(), firstMonth.getMonth() + offset, 1));
    rows.set(key, { month: key });
  }
  for (const reading of readings) {
    const row = rows.get(reading.reading_date.slice(0, 7));
    if (!row) continue;
    const category = reading.category_id || "none";
    row[category] = (Number(row[category]) || 0) + reading.pages;
  }
  return [...rows.values()];
}

export interface PaceByCategory {
  categoryId: string;
  pagesPerHour: number;
  minutes: number;
}

export function paceByCategory(readings: readonly ReadingRecord[]): PaceByCategory[] {
  const totals = new Map<string, { pages: number; minutes: number }>();
  for (const reading of readings) {
    if (!(reading.reading_time > 0)) continue;
    const key = reading.category_id || "none";
    const entry = totals.get(key) ?? { pages: 0, minutes: 0 };
    entry.pages += reading.pages;
    entry.minutes += reading.reading_time;
    totals.set(key, entry);
  }
  return [...totals.entries()]
    .filter(([, value]) => value.minutes >= 30)
    .map(([categoryId, value]) => ({ categoryId, minutes: value.minutes, pagesPerHour: Math.round((value.pages / value.minutes) * 60) }))
    .sort((a, b) => b.pagesPerHour - a.pagesPerHour);
}

/** Average pages per weekday over active weeks (index 0 = Sunday). */
export function weekdayAverages(daily: Map<string, DayTotal>, now: Date, weeks = 26): number[] {
  const start = addDays(startOfWeek(now), -7 * (weeks - 1));
  const sums = Array.from({ length: 7 }, () => 0);
  const counts = Array.from({ length: 7 }, () => 0);
  for (const day of calendarDays(daily, start, startOfDay(now))) {
    sums[day.weekday] = (sums[day.weekday] ?? 0) + day.pages;
    counts[day.weekday] = (counts[day.weekday] ?? 0) + 1;
  }
  return sums.map((sum, index) => {
    const count = counts[index] ?? 0;
    return count > 0 ? Math.round(sum / count) : 0;
  });
}

/**
 * Pages logged per hour of the day, from the time each entry was recorded.
 * Manual logs are usually saved right after reading, so this approximates when
 * the user reads; it is labelled as "time of logging" in the UI.
 */
export function hourDistribution(readings: readonly ReadingRecord[]): number[] {
  const hours = Array.from({ length: 24 }, () => 0);
  for (const reading of readings) {
    if (!reading.created_at) continue;
    const created = new Date(reading.created_at);
    if (Number.isNaN(created.getTime())) continue;
    const hour = created.getHours();
    hours[hour] = (hours[hour] ?? 0) + (Number(reading.pages) || 0);
  }
  return hours;
}

export interface ReaderProfileAxis {
  key: "volume" | "consistency" | "speed" | "variety" | "depth" | "weekend";
  value: number;
  raw: number;
}

/**
 * Six normalised (0–100) traits over the last 90 days. Benchmarks are fixed
 * so the shape is comparable over time: 40 pages/day, 100% active days,
 * 45 pages/hour, 6 different books, 60 minutes per active day, and weekends
 * carrying their fair 2/7 share.
 */
export function readerProfile(readings: readonly ReadingRecord[], now: Date): ReaderProfileAxis[] {
  const start = addDays(now, -89);
  const from = toIsoDate(start);
  const recent = readings.filter((reading) => reading.reading_date.slice(0, 10) >= from);
  const daily = dailyTotals(recent);
  const totals = totalsBetween(daily, start, now);
  const timed = recent.filter((reading) => reading.reading_time > 0);
  const timedPages = timed.reduce((sum, reading) => sum + reading.pages, 0);
  const timedMinutes = timed.reduce((sum, reading) => sum + reading.reading_time, 0);
  const books = new Set(recent.map((reading) => reading.source_name.trim().toLocaleLowerCase())).size;
  let weekendPages = 0;
  for (const day of daily.values()) {
    const weekday = parseIsoDate(day.date).getDay();
    if (weekday === 0 || weekday === 6) weekendPages += day.pages;
  }
  const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
  const pagesPerDay = totals.pages / 90;
  const activeShare = totals.activeDays / 90;
  const pagesPerHour = timedMinutes > 0 ? (timedPages / timedMinutes) * 60 : 0;
  const minutesPerDay = totals.activeDays > 0 ? totals.minutes / totals.activeDays : 0;
  const weekendShare = totals.pages > 0 ? weekendPages / totals.pages : 0;
  return [
    { key: "volume", raw: Math.round(pagesPerDay), value: clamp((pagesPerDay / 40) * 100) },
    { key: "consistency", raw: Math.round(activeShare * 100), value: clamp(activeShare * 100) },
    { key: "speed", raw: Math.round(pagesPerHour), value: clamp((pagesPerHour / 45) * 100) },
    { key: "variety", raw: books, value: clamp((books / 6) * 100) },
    { key: "depth", raw: Math.round(minutesPerDay), value: clamp((minutesPerDay / 60) * 100) },
    { key: "weekend", raw: Math.round(weekendShare * 100), value: clamp((weekendShare / (2 / 7)) * 50) },
  ];
}

export interface BookProgressInput {
  key: string;
  title: string;
  totalPages: number;
  currentPage: number;
  /** Supabase book id, used to match reading logs. */
  bookId?: string | null;
}

export interface BookProjection {
  key: string;
  title: string;
  totalPages: number;
  pagesDone: number;
  pagesPerDay: number;
  daysLeft: number | null;
  finishDate: string | null;
}

/**
 * Finish-date projection at the pace of the last 14 days. Progress is the
 * larger of the reader position and the pages logged for the book, since
 * many users read outside the app and only log pages.
 */
export function projectFinish(readings: readonly ReadingRecord[], books: readonly BookProgressInput[], now: Date, windowDays = 14): BookProjection[] {
  const from = toIsoDate(addDays(now, -(windowDays - 1)));
  return books
    .map((book) => {
      const titleKey = book.title.trim().toLocaleLowerCase();
      const matches = readings.filter((reading) =>
        (book.bookId && reading.book_id === book.bookId) || reading.source_name.trim().toLocaleLowerCase() === titleKey);
      const logged = matches.reduce((sum, reading) => sum + reading.pages, 0);
      const recent = matches.filter((reading) => reading.reading_date.slice(0, 10) >= from).reduce((sum, reading) => sum + reading.pages, 0);
      const pagesDone = Math.min(book.totalPages, Math.max(book.currentPage, logged));
      const pagesPerDay = recent / windowDays;
      const remaining = Math.max(0, book.totalPages - pagesDone);
      const daysLeft = pagesPerDay > 0 ? Math.ceil(remaining / pagesPerDay) : null;
      return {
        key: book.key,
        title: book.title,
        totalPages: book.totalPages,
        pagesDone,
        pagesPerDay: Math.round(pagesPerDay * 10) / 10,
        daysLeft,
        finishDate: daysLeft === null ? null : toIsoDate(addDays(now, daysLeft)),
      };
    })
    .filter((projection) => projection.pagesPerDay > 0 && projection.pagesDone < projection.totalPages)
    .sort((a, b) => (a.daysLeft ?? Infinity) - (b.daysLeft ?? Infinity));
}

/** Average pages per day over the last `days` days (for backlog estimates). */
export function averagePagesPerDay(daily: Map<string, DayTotal>, now: Date, days = 90): number {
  const totals = totalsBetween(daily, addDays(now, -(days - 1)), now);
  return totals.pages / days;
}
