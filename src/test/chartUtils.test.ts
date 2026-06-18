import { describe, it, expect } from "vitest";
import formatDate from "../pages/DashboardPage/components/ReadingCharts/utils/formatDate";
import parseLocalDate from "../pages/DashboardPage/components/ReadingCharts/utils/parseLocalDate";
import {
  buildAreaPagesData,
  buildDailyPagesData,
  buildRecentDateKeys,
  buildWeeklyPagesData,
} from "../pages/DashboardPage/components/ReadingCharts/utils/chartData";
import type { UserReadingData } from "../types/ChartTypes";

describe("Chart Utils", () => {
  describe("formatDate", () => {
    it("should format date object", () => {
      const result = formatDate(new Date(2024, 0, 15));
      expect(result).toBeDefined();
    });

    it("should format date with time", () => {
      const result = formatDate(new Date(2024, 0, 15, 10, 30));
      expect(result).toBeDefined();
    });
  });

  describe("parseLocalDate", () => {
    it("should parse date string", () => {
      const result = parseLocalDate("2024-01-15");
      expect(result).toBeInstanceOf(Date);
    });

    it("should handle invalid date", () => {
      const result = parseLocalDate("invalid");
      expect(result).toBeInstanceOf(Date);
    });
  });

  describe("chart data ranges", () => {
    const usersData: UserReadingData[] = [
      {
        user: {
          userId: "me",
          username: "Voce",
          isCurrentUser: true,
        },
        readings: [
          {
            id: "1",
            source_name: "Book A",
            pages: 10,
            reading_date: "2026-06-15",
            reading_time: 20,
            category_id: "cat",
          },
          {
            id: "2",
            source_name: "Book A",
            pages: 5,
            reading_date: "2026-06-17",
            reading_time: 10,
            category_id: "cat",
          },
        ],
      },
      {
        user: {
          userId: "friend",
          username: "Friend",
          isCurrentUser: false,
        },
        readings: [
          {
            id: "3",
            source_name: "Book B",
            pages: 7,
            reading_date: "2026-06-16",
            reading_time: 15,
            category_id: "cat",
          },
        ],
      },
    ];

    it("builds daily zero points for dates without readings", () => {
      const data = buildDailyPagesData(usersData, 3, new Date(2026, 5, 17));

      expect(data).toEqual([
        { date: "2026-06-15", Voce: 10, Friend: 0 },
        { date: "2026-06-16", Voce: 0, Friend: 7 },
        { date: "2026-06-17", Voce: 5, Friend: 0 },
      ]);
    });

    it("builds recent local date keys ending on the selected date", () => {
      expect(buildRecentDateKeys(2, new Date(2026, 5, 17))).toEqual([
        "2026-06-16",
        "2026-06-17",
      ]);
    });

    it("does not build daily points before the first reading", () => {
      const data = buildDailyPagesData(usersData, 30, new Date(2026, 5, 17));

      expect(data[0].date).toBe("2026-06-15");
      expect(data.map((point) => point.date)).toEqual([
        "2026-06-15",
        "2026-06-16",
        "2026-06-17",
      ]);
    });

    it("keeps accumulated totals from readings before the visible window", () => {
      const data = buildAreaPagesData(
        [
          {
            user: {
              userId: "me",
              username: "Voce",
              isCurrentUser: true,
            },
            readings: [
              {
                id: "old",
                source_name: "Book A",
                pages: 100,
                reading_date: "2026-05-01",
                reading_time: 80,
                category_id: "cat",
              },
              {
                id: "visible",
                source_name: "Book A",
                pages: 10,
                reading_date: "2026-06-17",
                reading_time: 20,
                category_id: "cat",
              },
            ],
          },
        ],
        2,
        new Date(2026, 5, 17),
      );

      expect(data).toEqual([
        { date: "2026-06-16", Voce: 100 },
        { date: "2026-06-17", Voce: 110 },
      ]);
    });

    it("builds weekly zero points for weeks without readings", () => {
      const data = buildWeeklyPagesData(usersData, 2, new Date(2026, 5, 17));

      expect(data[0].Voce).toBe(0);
      expect(data[0].Friend).toBe(0);
      expect(data[1].Voce).toBe(15);
      expect(data[1].Friend).toBe(7);
    });
  });
});
