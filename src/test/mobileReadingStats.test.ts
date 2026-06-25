import { describe, expect, it } from "vitest";
import {
  buildCategoryTotals,
  buildDailyReadingData,
  buildWeekStreakDays,
  computeCurrentStreak,
  getFrequentMobileBooks,
  summarizeMobileReadings,
} from "../mobile/mobileReadingStats";
import type { MobileReadingEntry } from "../mobile/readingApi";

function reading(patch: Partial<MobileReadingEntry>): MobileReadingEntry {
  return {
    id: patch.id || crypto.randomUUID(),
    source_name: patch.source_name || "Livro",
    pages: patch.pages ?? 10,
    reading_date: patch.reading_date || "2026-06-24",
    reading_time: patch.reading_time ?? 20,
    category_id: "category_id" in patch ? patch.category_id : "cat-1",
    book_id: patch.book_id,
  };
}

describe("mobile reading stats", () => {
  it("summarizes today, week, month and streak", () => {
    const now = new Date(2026, 5, 24);
    const readings = [
      reading({ pages: 12, reading_time: 15, reading_date: "2026-06-24" }),
      reading({ pages: 20, reading_time: 30, reading_date: "2026-06-23" }),
      reading({ pages: 8, reading_time: 10, reading_date: "2026-05-31" }),
    ];

    const summary = summarizeMobileReadings(readings, now);

    expect(summary.totalPages).toBe(40);
    expect(summary.totalMinutes).toBe(55);
    expect(summary.todayPages).toBe(12);
    expect(summary.weekPages).toBe(32);
    expect(summary.monthPages).toBe(32);
    expect(summary.currentStreak).toBe(2);
  });

  it("builds dense daily chart data with zero-filled days", () => {
    const now = new Date(2026, 5, 24);
    const data = buildDailyReadingData(
      [reading({ pages: 15, reading_date: "2026-06-23" })],
      3,
      now,
    );

    expect(data).toEqual([
      { date: "2026-06-22", pages: 0, minutes: 0 },
      { date: "2026-06-23", pages: 15, minutes: 20 },
      { date: "2026-06-24", pages: 0, minutes: 0 },
    ]);
  });

  it("groups category totals and names unknown categories", () => {
    const totals = buildCategoryTotals(
      [
        reading({ pages: 10, category_id: "cat-1" }),
        reading({ pages: 5, category_id: "cat-2" }),
        reading({ pages: 3, category_id: null }),
      ],
      [{ id: "cat-1", name: "Ficcao" }],
    );

    expect(totals.map((item) => [item.name, item.pages])).toEqual([
      ["Ficcao", 10],
      ["Sem categoria", 5],
      ["Sem categoria", 3],
    ]);
  });

  it("builds week streak days from monday to sunday", () => {
    const days = buildWeekStreakDays(
      [reading({ pages: 7, reading_date: "2026-06-22" })],
      new Date(2026, 5, 24),
    );

    expect(days).toHaveLength(7);
    expect(days[0]).toMatchObject({ date: "2026-06-22", pages: 7, hasRead: true });
    expect(days[2]).toMatchObject({ date: "2026-06-24", pages: 0, hasRead: false });
  });

  it("limits frequent mobile books to recent reading activity", () => {
    const frequent = getFrequentMobileBooks(
      [
        reading({ source_name: "A", book_id: "a", pages: 20, reading_date: "2026-06-24" }),
        reading({ source_name: "B", book_id: "b", pages: 80, reading_date: "2026-05-01" }),
        reading({ source_name: "A", book_id: "a", pages: 10, reading_date: "2026-06-22" }),
      ],
      new Date(2026, 5, 24),
    );

    expect(frequent).toHaveLength(1);
    expect(frequent[0]).toMatchObject({ title: "A", recentPages: 30, totalPages: 30 });
  });

  it("stops current streak on the first empty day", () => {
    const streak = computeCurrentStreak(
      [
        reading({ reading_date: "2026-06-24" }),
        reading({ reading_date: "2026-06-22" }),
      ],
      new Date(2026, 5, 24),
    );

    expect(streak).toBe(1);
  });
});
