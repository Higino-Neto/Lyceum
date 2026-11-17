import { addDays, currentStreak, dailyTotals, startOfDay, startOfWeek, toIsoDate, totalsBetween, type ReadingRecord } from "./readingAnalytics";

export interface PersonReadings {
  userId: string;
  name: string;
  isCurrentUser: boolean;
  readings: readonly ReadingRecord[];
}

export interface RankingRow {
  userId: string;
  name: string;
  isCurrentUser: boolean;
  pages: number;
  previousPages: number;
  rank: number;
  previousRank: number | null;
  /** Positive = climbed positions since last week. */
  movement: number | null;
}

function rankBy<T extends { userId: string }>(items: T[], value: (item: T) => number): Map<string, number> {
  const sorted = [...items].sort((a, b) => value(b) - value(a));
  const ranks = new Map<string, number>();
  sorted.forEach((item, index) => {
    const previous = sorted[index - 1];
    ranks.set(item.userId, previous && value(previous) === value(item) ? ranks.get(previous.userId) ?? index + 1 : index + 1);
  });
  return ranks;
}

/**
 * This week so far vs the same days of last week, with the rank change. A
 * person with no pages last week has no previous rank.
 */
export function weeklyRanking(people: readonly PersonReadings[], now: Date): RankingRow[] {
  const weekStart = startOfWeek(now);
  const elapsed = Math.round((startOfDay(now).getTime() - weekStart.getTime()) / 86_400_000);
  const previousStart = addDays(weekStart, -7);
  const rows = people.map((person) => {
    const daily = dailyTotals(person.readings);
    return {
      userId: person.userId,
      name: person.name,
      isCurrentUser: person.isCurrentUser,
      pages: totalsBetween(daily, weekStart, now).pages,
      previousPages: totalsBetween(daily, previousStart, addDays(previousStart, elapsed)).pages,
    };
  });
  const current = rankBy(rows, (row) => row.pages);
  const activeBefore = rows.filter((row) => row.previousPages > 0);
  const previous = rankBy(activeBefore, (row) => row.previousPages);
  return rows
    .map((row) => {
      const rank = current.get(row.userId) ?? rows.length;
      const previousRank = previous.get(row.userId) ?? null;
      return { ...row, rank, previousRank, movement: previousRank === null ? null : previousRank - rank };
    })
    .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));
}

export interface DuelPoint {
  /** 0 = Monday … 6 = Sunday. */
  day: number;
  date: string;
  me: number | null;
  rival: number | null;
}

/** Cumulative pages per day of the current week; future days are null. */
export function weeklyDuel(me: readonly ReadingRecord[], rival: readonly ReadingRecord[], now: Date): DuelPoint[] {
  const start = startOfWeek(now);
  const today = toIsoDate(now);
  const mine = dailyTotals(me);
  const theirs = dailyTotals(rival);
  let myTotal = 0;
  let rivalTotal = 0;
  return Array.from({ length: 7 }, (_, day) => {
    const date = toIsoDate(addDays(start, day));
    if (date > today) return { day, date, me: null, rival: null };
    myTotal += mine.get(date)?.pages ?? 0;
    rivalTotal += theirs.get(date)?.pages ?? 0;
    return { day, date, me: myTotal, rival: rivalTotal };
  });
}

export type FeedEvent =
  | { kind: "read"; userId: string; name: string; date: string; book: string; pages: number }
  | { kind: "bestDay"; userId: string; name: string; date: string; pages: number }
  | { kind: "streak"; userId: string; name: string; date: string; days: number };

const STREAK_MILESTONES = [7, 14, 30, 50, 100, 200, 365];

/**
 * Lightweight activity feed from friends' reading logs over the last
 * `days` days: what they read, personal-best days and streak milestones.
 */
export function friendsFeed(people: readonly PersonReadings[], now: Date, days = 7, limit = 20): FeedEvent[] {
  const from = toIsoDate(addDays(now, -(days - 1)));
  const events: FeedEvent[] = [];
  for (const person of people) {
    if (person.isCurrentUser) continue;
    const grouped = new Map<string, { date: string; book: string; pages: number }>();
    for (const reading of person.readings) {
      const date = reading.reading_date.slice(0, 10);
      if (date < from) continue;
      const key = `${date}|${reading.source_name.trim().toLocaleLowerCase()}`;
      const entry = grouped.get(key) ?? { date, book: reading.source_name.trim(), pages: 0 };
      entry.pages += reading.pages;
      grouped.set(key, entry);
    }
    for (const entry of grouped.values()) {
      events.push({ kind: "read", userId: person.userId, name: person.name, ...entry });
    }

    const daily = dailyTotals(person.readings);
    let bestBefore = 0;
    for (const day of [...daily.values()].sort((a, b) => a.date.localeCompare(b.date))) {
      if (day.date >= from && day.pages > bestBefore && bestBefore > 0) {
        events.push({ kind: "bestDay", userId: person.userId, name: person.name, date: day.date, pages: day.pages });
      }
      bestBefore = Math.max(bestBefore, day.pages);
    }

    const streak = currentStreak(daily, now);
    if (STREAK_MILESTONES.some((value) => streak.days >= value)) {
      const lastRead = [...daily.keys()].filter((date) => date <= toIsoDate(now)).sort().pop() ?? toIsoDate(now);
      events.push({ kind: "streak", userId: person.userId, name: person.name, date: lastRead, days: streak.days });
    }
  }
  const weight = (event: FeedEvent) => (event.kind === "read" ? 0 : 1);
  return events
    .sort((a, b) => b.date.localeCompare(a.date) || weight(b) - weight(a))
    .slice(0, limit);
}
