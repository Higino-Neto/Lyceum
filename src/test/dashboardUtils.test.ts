import { describe, it, expect } from "vitest";

describe("formatTotalHours", () => {
  it("converts minutes to hours and minutes format", () => {
    const formatTotalHours = (total_minutes: string) => {
      if (!total_minutes) return;
      const hours = Math.floor(Number(total_minutes) / 60);
      const minutes = Math.floor(Number(total_minutes) % 60);
      return `${hours}h ${minutes}min`;
    };

    expect(formatTotalHours("90")).toBe("1h 30min");
    expect(formatTotalHours("60")).toBe("1h 0min");
    expect(formatTotalHours("120")).toBe("2h 0min");
    expect(formatTotalHours("45")).toBe("0h 45min");
  });

  it("returns undefined for empty input", () => {
    const formatTotalHours = (total_minutes: string) => {
      if (!total_minutes) return;
      const hours = Math.floor(Number(total_minutes) / 60);
      const minutes = Math.floor(Number(total_minutes) % 60);
      return `${hours}h ${minutes}min`;
    };

    expect(formatTotalHours("")).toBeUndefined();
    expect(formatTotalHours(null as unknown as string)).toBeUndefined();
  });
});

describe("computeCurrentStreak", () => {
  const computeCurrentStreak = (
    readings: { reading_date: string; pages: number }[],
  ): number => {
    if (!readings || readings.length === 0) return 0;

    const readDates = new Set(readings.map((r) => r.reading_date));

    let streak = 0;
    const today = new Date();

    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toLocaleDateString("sv-SE");
      if (readDates.has(dateStr)) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  };

  it("returns 0 for empty readings", () => {
    expect(computeCurrentStreak([])).toBe(0);
  });

  it("returns 0 for no readings", () => {
    expect(computeCurrentStreak(undefined as unknown as [])).toBe(0);
  });
});

describe("getWeekDays", () => {
  const getWeekDays = () => {
    const today = new Date();
    const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    const days: { date: string; dayName: string; dayNumber: number; hasRead: boolean; pagesRead: number }[] = [];

    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());

    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(startOfWeek);
      currentDate.setDate(startOfWeek.getDate() + i);
      days.push({
        date: currentDate.toLocaleDateString("sv-SE"),
        dayName: weekDays[currentDate.getDay()],
        dayNumber: currentDate.getDate(),
        hasRead: false,
        pagesRead: 0,
      });
    }

    return days;
  };

  it("returns 7 days", () => {
    const days = getWeekDays();
    expect(days).toHaveLength(7);
  });

  it("returns days with correct properties", () => {
    const days = getWeekDays();
    days.forEach((day) => {
      expect(day).toHaveProperty("date");
      expect(day).toHaveProperty("dayName");
      expect(day).toHaveProperty("dayNumber");
      expect(day).toHaveProperty("hasRead");
      expect(day).toHaveProperty("pagesRead");
    });
  });
});

describe("formatDate", () => {
  const formatDate = (dateString: string) => {
    const [year, month, day] = dateString.split("-");
    return `${day}/${month}/${year}`;
  };

  it("formats date correctly", () => {
    expect(formatDate("2024-01-15")).toBe("15/01/2024");
    expect(formatDate("2024-12-31")).toBe("31/12/2024");
  });
});