import type { HabitRepository } from "../../src/core/habits/model";
import {
  addHabit,
  deleteHabit,
  deleteHabitCompletion,
  getAllHabitCompletions,
  getAllHabits,
  getHabitById,
  getHabitCompletions,
  setHabitCompletion,
  updateHabit,
} from "../local-database";

/** Compatibility adapter while the legacy database module is split by domain. */
export const sqliteHabitRepository: HabitRepository = {
  list: getAllHabits,
  find: getHabitById,
  add: addHabit,
  update: updateHabit,
  remove: deleteHabit,
  listCompletions: getHabitCompletions,
  listAllCompletions: getAllHabitCompletions,
  setCompletion: setHabitCompletion,
  removeCompletion: deleteHabitCompletion,
};
