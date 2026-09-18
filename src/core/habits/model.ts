export interface Habit {
  id: string;
  name: string;
  createdAt: string;
  unit: string | null;
  valueMode: string;
}

export type NewHabit = Omit<Habit, "createdAt">;
export type HabitUpdate = Partial<Pick<Habit, "name" | "unit" | "valueMode">>;

export interface HabitCompletion {
  habitId: string;
  dateKey: string;
  value: string | null;
}

export interface HabitRepository {
  list(): Habit[];
  find(id: string): Habit | undefined;
  add(habit: NewHabit): void;
  update(id: string, updates: HabitUpdate): void;
  remove(id: string): void;
  listCompletions(habitId: string): HabitCompletion[];
  listAllCompletions(): HabitCompletion[];
  setCompletion(habitId: string, dateKey: string, value: string | null): void;
  removeCompletion(habitId: string, dateKey: string): void;
}
