import { useCallback, useMemo } from "react";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import type { Habit, HabitTrackerState } from "./types";

const INITIAL_STATE: HabitTrackerState = {
  habits: [],
  completions: {},
};

function createHabitId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `habit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeCompletions(
  completions: HabitTrackerState["completions"] | Record<string, unknown>
) {
  const normalized: HabitTrackerState["completions"] = {};

  Object.entries(completions || {}).forEach(([habitId, rawValue]) => {
    if (Array.isArray(rawValue)) {
      normalized[habitId] = rawValue.filter(
        (value): value is string => typeof value === "string"
      );
      return;
    }

    if (rawValue && typeof rawValue === "object") {
      normalized[habitId] = Object.entries(rawValue)
        .filter(([, value]) => value === true || typeof value === "number")
        .map(([dateKey]) => dateKey)
        .sort();
      return;
    }

    normalized[habitId] = [];
  });

  return normalized;
}

function normalizeState(rawState: HabitTrackerState) {
  return {
    habits: Array.isArray(rawState.habits) ? rawState.habits : [],
    completions: normalizeCompletions(rawState.completions),
  };
}

export function useHabitTrackerStorage() {
  const [state, setState] = useLocalStorage<HabitTrackerState>(
    "habit_tracker",
    INITIAL_STATE
  );

  const normalizedState = useMemo(() => normalizeState(state), [state]);
  const habits = useMemo(() => normalizedState.habits, [normalizedState.habits]);
  const completions = useMemo(
    () => normalizedState.completions,
    [normalizedState.completions]
  );

  const addHabit = useCallback(
    (name: string) => {
      const trimmedName = name.trim();
      if (!trimmedName) {
        return;
      }

      const newHabit: Habit = {
        id: createHabitId(),
        name: trimmedName,
        createdAt: new Date().toISOString(),
      };

      setState((previous) => {
        const safePrevious = normalizeState(previous);

        return {
          ...safePrevious,
          habits: [...safePrevious.habits, newHabit],
        };
      });
    },
    [setState]
  );

  const updateHabit = useCallback(
    (habitId: string, name: string) => {
      const trimmedName = name.trim();
      if (!trimmedName) {
        return;
      }

      setState((previous) => {
        const safePrevious = normalizeState(previous);

        return {
          ...safePrevious,
          habits: safePrevious.habits.map((habit) =>
            habit.id === habitId ? { ...habit, name: trimmedName } : habit
          ),
        };
      });
    },
    [setState]
  );

  const deleteHabit = useCallback(
    (habitId: string) => {
      setState((previous) => {
        const safePrevious = normalizeState(previous);
        const nextCompletions = { ...safePrevious.completions };
        delete nextCompletions[habitId];

        return {
          habits: safePrevious.habits.filter((habit) => habit.id !== habitId),
          completions: nextCompletions,
        };
      });
    },
    [setState]
  );

  const reorderHabits = useCallback(
    (fromHabitId: string, toHabitId: string) => {
      if (fromHabitId === toHabitId) {
        return;
      }

      setState((previous) => {
        const safePrevious = normalizeState(previous);
        const fromIndex = safePrevious.habits.findIndex(
          (habit) => habit.id === fromHabitId
        );
        const toIndex = safePrevious.habits.findIndex(
          (habit) => habit.id === toHabitId
        );

        if (fromIndex === -1 || toIndex === -1) {
          return safePrevious;
        }

        const nextHabits = [...safePrevious.habits];
        const [movedHabit] = nextHabits.splice(fromIndex, 1);
        nextHabits.splice(toIndex, 0, movedHabit);

        return {
          ...safePrevious,
          habits: nextHabits,
        };
      });
    },
    [setState]
  );

  const toggleHabitCompletion = useCallback(
    (habitId: string, dateKey: string) => {
      setState((previous) => {
        const safePrevious = normalizeState(previous);
        const habitDates = safePrevious.completions[habitId] ?? [];
        const hasCompleted = habitDates.includes(dateKey);

        const nextDates = hasCompleted
          ? habitDates.filter((item) => item !== dateKey)
          : [...habitDates, dateKey].sort();

        return {
          ...safePrevious,
          completions: {
            ...safePrevious.completions,
            [habitId]: nextDates,
          },
        };
      });
    },
    [setState]
  );

  return {
    habits,
    completions,
    addHabit,
    updateHabit,
    deleteHabit,
    reorderHabits,
    toggleHabitCompletion,
  };
}
