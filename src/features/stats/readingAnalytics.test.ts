import { describe, expect, it } from "vitest";
import {
  comparePeriod,
  currentStreak,
  dailyTotals,
  personalRecords,
  projectFinish,
  recentDays,
  type ReadingRecord,
} from "./readingAnalytics";
import { goalProgress } from "./goals";
import { weeklyDuel, weeklyRanking } from "./friendsAnalytics";

const reading = (reading_date: string, pages: number, reading_time = 30, source_name = "Book"): ReadingRecord => ({ reading_date, pages, reading_time, source_name });

// Wednesday 2026-11-18.
const NOW = new Date(2026, 10, 18, 15);

describe("reading analytics", () => {
  it("compares the week so far with the same days of last week", () => {
    const daily = dailyTotals([reading("2026-11-16", 10), reading("2026-11-18", 20), reading("2026-11-09", 10), reading("2026-11-13", 99)]);
    const week = comparePeriod(daily, "week", NOW);
    expect(week.current.pages).toBe(30);
    expect(week.previous.pages).toBe(10);
    expect(week.delta.pages).toBe(200);
  });

  it("keeps the streak alive while today is still open and supports weekly freezes", () => {
    const daily = dailyTotals([reading("2026-11-17", 5), reading("2026-11-16", 5), reading("2026-11-14", 5), reading("2026-11-13", 5)]);
    expect(currentStreak(daily, NOW).days).toBe(2);
    const frozen = currentStreak(daily, NOW, 1);
    expect(frozen.days).toBe(5);
    expect(frozen.frozen).toEqual(["2026-11-15"]);
  });

  it("finds personal records", () => {
    const records = personalRecords([reading("2026-11-01", 80, 60, "A"), reading("2026-11-02", 10, 10, "B"), reading("2026-11-03", 20, 20, "A")]);
    expect(records.bestDay).toEqual({ date: "2026-11-01", pages: 80 });
    expect(records.longestStreak.days).toBe(3);
    expect(records.topBook).toEqual({ title: "A", pages: 100 });
    expect(records.fastestDay?.pagesPerHour).toBe(80);
  });

  it("computes a trailing moving average", () => {
    const points = recentDays(dailyTotals([reading("2026-11-18", 70)]), NOW, 3, 7);
    expect(points.map((point) => point.date)).toEqual(["2026-11-16", "2026-11-17", "2026-11-18"]);
    expect(points[2]?.average).toBe(10);
  });

  it("projects finish dates from logged pages and recent pace", () => {
    const readings = Array.from({ length: 14 }, (_, day) => reading(`2026-11-${String(5 + day).padStart(2, "0")}`, 10, 30, "Novel"));
    const [projection] = projectFinish(readings, [{ key: "n", title: "Novel", totalPages: 300, currentPage: 1 }], NOW);
    expect(projection?.pagesDone).toBe(140);
    expect(projection?.daysLeft).toBe(16);
  });

  it("reports goal progress with the pace still required", () => {
    const [daily, weekly] = goalProgress([reading("2026-11-18", 20), reading("2026-11-16", 30)], 40, { weeklyPages: 350, monthlyPages: 0, yearlyPages: 0, yearlyBooks: 0 }, 0, NOW);
    expect(daily).toMatchObject({ current: 20, target: 40, requiredPerDay: 20 });
    expect(weekly).toMatchObject({ current: 50, requiredPerDay: 60, status: "behind" });
  });
});

describe("friends analytics", () => {
  const me = { userId: "me", name: "Me", isCurrentUser: true, readings: [reading("2026-11-17", 50), reading("2026-11-10", 5)] };
  const friend = { userId: "f", name: "Friend", isCurrentUser: false, readings: [reading("2026-11-16", 20), reading("2026-11-09", 40)] };

  it("ranks the week and reports position changes", () => {
    const [first, second] = weeklyRanking([me, friend], NOW);
    expect(first).toMatchObject({ userId: "me", rank: 1, previousRank: 2, movement: 1 });
    expect(second).toMatchObject({ userId: "f", rank: 2, movement: -1 });
  });

  it("builds cumulative duel series with future days empty", () => {
    const duel = weeklyDuel(me.readings, friend.readings, NOW);
    expect(duel.slice(0, 4).map((point) => [point.me, point.rival])).toEqual([[0, 20], [50, 20], [50, 20], [null, null]]);
  });
});
