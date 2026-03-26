export const CHART_COLORS = [
  "#22c55e",
  "#3b82f6",
  "#8b5cf6",
  "#f59e0b",
  "#06b6d4",
  "#ec4899",
];

export type ChartType = "daily" | "category" | "weekly" | "weekday";

export const CHART_OPTIONS: ChartOption[] = [
  { key: "daily", label: "Diário (Line)" },
  { key: "weekday", label: "Diário (Bar)" },
  { key: "weekly", label: "Semanal" },
  { key: "category", label: "Categorias" },
];

export interface ChartOption {
  key: ChartType;
  label: string;
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
