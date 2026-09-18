import type { IpcMain } from "electron";
import type {
  HabitRepository,
  HabitUpdate,
  NewHabit,
} from "../../src/core/habits/model";
import {
  dateKey as validateDateKey,
  nonEmptyString,
  nullableString,
  record,
} from "../ipc/validation";

function validatedHabit(value: unknown): NewHabit {
  const habit = record(value, "habit");
  return {
    id: nonEmptyString(habit.id, "habit.id", 128),
    name: nonEmptyString(habit.name, "habit.name", 160),
    unit: nullableString(habit.unit, "habit.unit", 80),
    valueMode: nonEmptyString(habit.valueMode, "habit.valueMode", 40),
  };
}

function validatedUpdates(value: unknown): HabitUpdate {
  const updates = record(value, "updates");
  return {
    ...(updates.name === undefined
      ? {}
      : { name: nonEmptyString(updates.name, "updates.name", 160) }),
    ...(updates.unit === undefined
      ? {}
      : { unit: nullableString(updates.unit, "updates.unit", 80) }),
    ...(updates.valueMode === undefined
      ? {}
      : { valueMode: nonEmptyString(updates.valueMode, "updates.valueMode", 40) }),
  };
}

export function registerHabitHandlers(ipcMain: IpcMain, repository: HabitRepository) {
  ipcMain.handle("habits:get-all", () => repository.list());
  ipcMain.handle("habits:get-by-id", (_, id: string) =>
    repository.find(nonEmptyString(id, "id", 128)));
  ipcMain.handle("habits:add", (_, habit: NewHabit) => {
    repository.add(validatedHabit(habit));
    return { success: true };
  });
  ipcMain.handle("habits:update", (_, id: string, updates: HabitUpdate) => {
    repository.update(
      nonEmptyString(id, "id", 128),
      validatedUpdates(updates),
    );
    return { success: true };
  });
  ipcMain.handle("habits:delete", (_, id: string) => {
    repository.remove(nonEmptyString(id, "id", 128));
    return { success: true };
  });
  ipcMain.handle("habits:get-completions", (_, habitId: string) =>
    repository.listCompletions(nonEmptyString(habitId, "habitId", 128)));
  ipcMain.handle("habits:get-all-completions", () => repository.listAllCompletions());
  ipcMain.handle(
    "habits:set-completion",
    (_, habitId: string, dateKey: string, value: string | null) => {
      repository.setCompletion(
        nonEmptyString(habitId, "habitId", 128),
        validateDateKey(dateKey, "dateKey"),
        value === null ? null : nonEmptyString(value, "value", 128),
      );
      return { success: true };
    },
  );
  ipcMain.handle("habits:delete-completion", (_, habitId: string, dateKey: string) => {
    repository.removeCompletion(
      nonEmptyString(habitId, "habitId", 128),
      validateDateKey(dateKey, "dateKey"),
    );
    return { success: true };
  });
}
