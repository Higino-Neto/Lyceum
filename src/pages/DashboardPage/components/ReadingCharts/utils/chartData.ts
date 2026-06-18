import type { ReadingData, UserReadingData } from "../../../../../types/ChartTypes";
import { getWeekNumber, getWeekRange } from "./getWeekInfo";
import parseLocalDate from "./parseLocalDate";

export type ChartDataPoint = Record<string, string | number>;

export function toLocalIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfLocalDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function buildRecentDateKeys(
  dayCount = 30,
  endDate = new Date(),
): string[] {
  const safeDayCount = Math.max(1, dayCount);
  const end = startOfLocalDay(endDate);
  const start = addDays(end, -(safeDayCount - 1));

  return Array.from({ length: safeDayCount }, (_, index) =>
    toLocalIsoDate(addDays(start, index)),
  );
}

function sumPagesOnDate(readings: ReadingData[], date: string): number {
  return readings
    .filter((reading) => reading.reading_date === date)
    .reduce((sum, reading) => sum + reading.pages, 0);
}

function getEarliestReadingDate(usersData: UserReadingData[]): string | null {
  const dates = usersData
    .flatMap((userData) => userData.readings.map((reading) => reading.reading_date))
    .filter(Boolean)
    .sort();

  return dates[0] ?? null;
}

function buildVisibleDateKeys(
  usersData: UserReadingData[],
  dayCount: number,
  endDate: Date,
): string[] {
  const earliestReadingDate = getEarliestReadingDate(usersData);
  if (!earliestReadingDate) return [];

  return buildRecentDateKeys(dayCount, endDate).filter(
    (date) => date >= earliestReadingDate,
  );
}

export function hasPositiveChartData(
  chartData: ChartDataPoint[],
  usersData: UserReadingData[],
): boolean {
  return chartData.some((point) =>
    usersData.some((userData) => Number(point[userData.user.username] ?? 0) > 0),
  );
}

export function buildDailyPagesData(
  usersData: UserReadingData[],
  dayCount = 30,
  endDate = new Date(),
): ChartDataPoint[] {
  return buildVisibleDateKeys(usersData, dayCount, endDate).map((date) => {
    const dataPoint: ChartDataPoint = { date };

    usersData.forEach((userData) => {
      dataPoint[userData.user.username] = sumPagesOnDate(userData.readings, date);
    });

    return dataPoint;
  });
}

export function buildAreaPagesData(
  usersData: UserReadingData[],
  dayCount = 30,
  endDate = new Date(),
): ChartDataPoint[] {
  const dateKeys = buildVisibleDateKeys(usersData, dayCount, endDate);
  const accumulators: Record<string, number> = {};
  const firstVisibleDate = dateKeys[0];

  usersData.forEach((userData) => {
    accumulators[userData.user.username] = firstVisibleDate
      ? userData.readings
          .filter((reading) => reading.reading_date < firstVisibleDate)
          .reduce((sum, reading) => sum + reading.pages, 0)
      : 0;
  });

  return dateKeys.map((date) => {
    const dataPoint: ChartDataPoint = { date };

    usersData.forEach((userData) => {
      accumulators[userData.user.username] += sumPagesOnDate(
        userData.readings,
        date,
      );
      dataPoint[userData.user.username] = accumulators[userData.user.username];
    });

    return dataPoint;
  });
}

function getWeekStart(date: Date): Date {
  const start = startOfLocalDay(date);
  const dayOfWeek = start.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  start.setDate(start.getDate() + diffToMonday);
  return start;
}

function getWeekKeyFromStart(weekStart: Date): string {
  return `${weekStart.getFullYear()}-W${String(getWeekNumber(weekStart)).padStart(2, "0")}`;
}

function getWeekKeyFromDate(date: Date): string {
  return getWeekKeyFromStart(getWeekStart(date));
}

export function buildRecentWeekKeys(
  weekCount = 10,
  endDate = new Date(),
): Array<{ key: string; label: string }> {
  const safeWeekCount = Math.max(1, weekCount);
  const currentWeekStart = getWeekStart(endDate);

  return Array.from({ length: safeWeekCount }, (_, index) => {
    const weekStart = addDays(
      currentWeekStart,
      -(safeWeekCount - 1 - index) * 7,
    );

    return {
      key: getWeekKeyFromStart(weekStart),
      label: getWeekRange(weekStart),
    };
  });
}

export function buildWeeklyPagesData(
  usersData: UserReadingData[],
  weekCount = 10,
  endDate = new Date(),
): ChartDataPoint[] {
  return buildRecentWeekKeys(weekCount, endDate).map((week) => {
    const dataPoint: ChartDataPoint = {
      week: week.label,
      key: week.key,
    };

    usersData.forEach((userData) => {
      const userPages = userData.readings
        .filter((reading) => getWeekKeyFromDate(parseLocalDate(reading.reading_date)) === week.key)
        .reduce((sum, reading) => sum + reading.pages, 0);

      dataPoint[userData.user.username] = userPages;
    });

    return dataPoint;
  });
}
