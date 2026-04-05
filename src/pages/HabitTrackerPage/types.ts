export interface Habit {
  id: string;
  name: string;
  createdAt: string;
}

export interface HabitTrackerState {
  habits: Habit[];
  completions: Record<string, string[]>;
}
