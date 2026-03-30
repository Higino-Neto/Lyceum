import { describe, it, expect } from "vitest";
import formatDate from "../pages/DashboardPage/components/ReadingCharts/utils/formatDate";
import parseLocalDate from "../pages/DashboardPage/components/ReadingCharts/utils/parseLocalDate";

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
});
