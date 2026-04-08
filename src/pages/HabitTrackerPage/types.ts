export type HabitValueMode = "toggle" | "measure";

export interface Habit {
  id: string;
  name: string;
  createdAt: string;
  unit: string | null;
  valueMode: HabitValueMode;
}

export type HabitCompletionValue = true | number;

export type HabitCompletions = Record<string, HabitCompletionValue>;

export interface HabitTrackerState {
  habits: Habit[];
  completions: Record<string, HabitCompletions>;
}
