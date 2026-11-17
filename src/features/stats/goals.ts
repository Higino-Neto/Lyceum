import { addDays, dailyTotals, startOfDay, startOfWeek, totalsBetween, type ReadingRecord } from "./readingAnalytics";

/**
 * Reading goals. The daily page goal keeps living in its historical
 * localStorage key (`daily_reading_goal_pages`) because the weekly streak and
 * quick-reading cards read it; the longer goals are stored together.
 */
export interface ReadingGoals {
  weeklyPages: number;
  monthlyPages: number;
  yearlyPages: number;
  yearlyBooks: number;
}

/** `useLocalStorage` keys (the hook adds the `lyceum_` prefix). */
export const READING_GOALS_STORAGE_KEY = "reading_goals";
export const DAILY_GOAL_STORAGE_KEY = "daily_reading_goal_pages";
export const STREAK_FREEZE_STORAGE_KEY = "streak_freeze_enabled";

export const EMPTY_GOALS: ReadingGoals = { weeklyPages: 0, monthlyPages: 0, yearlyPages: 0, yearlyBooks: 0 };

export function normalizeGoals(value: unknown): ReadingGoals {
  const source = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const positive = (input: unknown) => {
    const number = Math.round(Number(input));
    return Number.isFinite(number) && number > 0 ? number : 0;
  };
  return {
    weeklyPages: positive(source.weeklyPages),
    monthlyPages: positive(source.monthlyPages),
    yearlyPages: positive(source.yearlyPages),
    yearlyBooks: positive(source.yearlyBooks),
  };
}

/** Suggested goals derived from the daily goal when the user has not set them. */
export function suggestGoals(dailyGoal: number): ReadingGoals {
  if (dailyGoal <= 0) return EMPTY_GOALS;
  return {
    weeklyPages: dailyGoal * 7,
    monthlyPages: dailyGoal * 30,
    yearlyPages: dailyGoal * 365,
    yearlyBooks: 0,
  };
}

export type GoalId = "daily" | "weekly" | "monthly" | "yearly" | "yearlyBooks";

export interface GoalProgress {
  id: GoalId;
  current: number;
  target: number;
  /** 0–1, capped. */
  ratio: number;
  /** Share of the period already elapsed (0–1). */
  elapsed: number;
  /** Units per remaining day (including today) needed to hit the target. */
  requiredPerDay: number;
  status: "done" | "ahead" | "onTrack" | "behind" | "unset";
}

function progress(id: GoalId, current: number, target: number, start: Date, endExclusive: Date, now: Date): GoalProgress {
  const totalDays = Math.max(1, Math.round((endExclusive.getTime() - start.getTime()) / 86_400_000));
  const elapsedDays = Math.min(totalDays, Math.max(1, Math.round((startOfDay(now).getTime() - start.getTime()) / 86_400_000) + 1));
  const daysLeft = Math.max(1, totalDays - elapsedDays + 1);
  const elapsed = elapsedDays / totalDays;
  if (target <= 0) return { id, current, target, ratio: 0, elapsed, requiredPerDay: 0, status: "unset" };
  const ratio = Math.min(1, current / target);
  const remaining = Math.max(0, target - current);
  const status: GoalProgress["status"] = ratio >= 1
    ? "done"
    : ratio >= elapsed + 0.05
      ? "ahead"
      : ratio >= elapsed - 0.05
        ? "onTrack"
        : "behind";
  return { id, current, target, ratio, elapsed, requiredPerDay: Math.ceil(remaining / daysLeft), status };
}

export function goalProgress(
  readings: readonly ReadingRecord[],
  dailyGoal: number,
  goals: ReadingGoals,
  booksFinishedThisYear: number,
  now: Date,
): GoalProgress[] {
  const daily = dailyTotals(readings);
  const today = startOfDay(now);
  const week = startOfWeek(now);
  const month = new Date(now.getFullYear(), now.getMonth(), 1);
  const year = new Date(now.getFullYear(), 0, 1);
  const pages = (start: Date) => totalsBetween(daily, start, today).pages;
  return [
    progress("daily", pages(today), dailyGoal, today, addDays(today, 1), now),
    progress("weekly", pages(week), goals.weeklyPages, week, addDays(week, 7), now),
    progress("monthly", pages(month), goals.monthlyPages, month, new Date(now.getFullYear(), now.getMonth() + 1, 1), now),
    progress("yearly", pages(year), goals.yearlyPages, year, new Date(now.getFullYear() + 1, 0, 1), now),
    progress("yearlyBooks", booksFinishedThisYear, goals.yearlyBooks, year, new Date(now.getFullYear() + 1, 0, 1), now),
  ];
}
