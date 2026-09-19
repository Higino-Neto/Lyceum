import type Database from "better-sqlite3";
import type { Habit, HabitCompletion, HabitRepository } from "../../src/core/habits/model";

/** SQLite implementation of the habits port. The caller owns the connection. */
export function createSqliteHabitRepository(db: Database.Database): HabitRepository {
  const removeCompletion = (habitId: string, dateKey: string): void => {
    db.prepare("DELETE FROM habit_completions WHERE habitId = ? AND dateKey = ?")
      .run(habitId, dateKey);
  };

  return {
    list: () => db.prepare<[], Habit>("SELECT * FROM habits ORDER BY createdAt").all(),
    find: (id) => db.prepare<[string], Habit>("SELECT * FROM habits WHERE id = ?").get(id),
    add: (habit) => {
      db.prepare("INSERT INTO habits (id, name, unit, valueMode) VALUES (?, ?, ?, ?)")
        .run(habit.id, habit.name, habit.unit, habit.valueMode);
    },
    update: (id, updates) => {
      const sets: string[] = [];
      const values: unknown[] = [];
      if (updates.name !== undefined) {
        sets.push("name = ?");
        values.push(updates.name);
      }
      if (updates.unit !== undefined) {
        sets.push("unit = ?");
        values.push(updates.unit);
      }
      if (updates.valueMode !== undefined) {
        sets.push("valueMode = ?");
        values.push(updates.valueMode);
      }
      if (sets.length > 0) {
        values.push(id);
        db.prepare(`UPDATE habits SET ${sets.join(", ")} WHERE id = ?`).run(...values);
      }
    },
    remove: (id) => {
      db.prepare("DELETE FROM habit_completions WHERE habitId = ?").run(id);
      db.prepare("DELETE FROM habits WHERE id = ?").run(id);
    },
    listCompletions: (habitId) => db.prepare<[string], HabitCompletion>(
      "SELECT * FROM habit_completions WHERE habitId = ?",
    ).all(habitId),
    listAllCompletions: () => db.prepare<[], HabitCompletion>(
      "SELECT * FROM habit_completions",
    ).all(),
    setCompletion: (habitId, dateKey, value) => {
      if (value === null) removeCompletion(habitId, dateKey);
      else db.prepare(
        "INSERT OR REPLACE INTO habit_completions (habitId, dateKey, value) VALUES (?, ?, ?)",
      ).run(habitId, dateKey, value);
    },
    removeCompletion,
  };
}
