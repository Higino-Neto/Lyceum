import type { TranslationKey } from "../i18n";

export const CHART_COLORS = [
  "var(--accent-500)",
  "#3b82f6",
  "#8b5cf6",
  "#f59e0b",
  "#06b6d4",
  "#ec4899",
];

export type ChartType = 
  | "daily" 
  | "category" 
  | "weekly" 
  | "weekday"
  | "area";

export const CHART_OPTIONS: ChartOption[] = [
  { key: "daily", labelKey: "dashboard:charts.daily" },
  { key: "weekday", labelKey: "dashboard:charts.weekday" },
  { key: "weekly", labelKey: "dashboard:charts.weekly" },
  { key: "category", labelKey: "dashboard:charts.category" },
  { key: "area", labelKey: "dashboard:charts.area" },
];

export interface ChartOption {
  key: ChartType;
  labelKey: TranslationKey;
}

export interface CategoryData {
  id: string;
  name: string;
}

export interface ReadingData {
  id: string;
  source_name: string;
  pages: number;
  reading_date: string;
  reading_time: number;
  category_id: string;
  user_id?: string;
}

export interface UserData {
  userId: string;
  username: string;
  isCurrentUser: boolean;
}

export interface UserReadingData {
  user: UserData;
  readings: ReadingData[];
}
