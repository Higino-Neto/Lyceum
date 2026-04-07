import { useCallback, useMemo } from "react";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import type {
  Habit,
  HabitCompletionValue,
  HabitTrackerState,
  HabitValueMode,
} from "./types";

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

function normalizeHabit(rawHabit: unknown): Habit | null {
  if (!rawHabit || typeof rawHabit !== "object") {
    return null;
  }

  const maybeHabit = rawHabit as Partial<Habit>;

  if (typeof maybeHabit.id !== "string" || typeof maybeHabit.name !== "string") {
    return null;
  }

  const normalizedUnit =
    typeof maybeHabit.unit === "string" && maybeHabit.unit.trim()
      ? maybeHabit.unit.trim()
      : null;
  const normalizedValueMode: HabitValueMode =
    maybeHabit.valueMode === "measure" && normalizedUnit ? "measure" : "toggle";

  return {
    id: maybeHabit.id,
    name: maybeHabit.name,
    createdAt:
      typeof maybeHabit.createdAt === "string"
        ? maybeHabit.createdAt
        : new Date().toISOString(),
    unit: normalizedUnit,
    valueMode: normalizedValueMode,
  };
}

function normalizeCompletions(
  completions: HabitTrackerState["completions"] | Record<string, unknown>
) {
  const normalized: HabitTrackerState["completions"] = {};

  Object.entries(completions || {}).forEach(([habitId, rawValue]) => {
    if (Array.isArray(rawValue)) {
      normalized[habitId] = rawValue.reduce<Record<string, HabitCompletionValue>>(
        (dates, value) => {
          if (typeof value === "string") {
            dates[value] = true;
          }

          return dates;
        },
        {}
      );
      return;
    }

    if (rawValue && typeof rawValue === "object") {
      normalized[habitId] = Object.entries(rawValue).reduce<
        Record<string, HabitCompletionValue>
      >((entries, [dateKey, value]) => {
        if (value === true) {
          entries[dateKey] = true;
        }

        if (typeof value === "number" && Number.isFinite(value)) {
          entries[dateKey] = value;
        }

        if (typeof value === "string") {
          const parsedValue = Number(value.replace(",", "."));

          if (Number.isFinite(parsedValue)) {
            entries[dateKey] = parsedValue;
          }
        }

        return entries;
      }, {});
      return;
    }

    normalized[habitId] = {};
  });

  return normalized;
}

function normalizeState(rawState: HabitTrackerState) {
  return {
    habits: Array.isArray(rawState.habits)
      ? rawState.habits
          .map((habit) => normalizeHabit(habit))
          .filter((habit): habit is Habit => habit !== null)
      : [],
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
    (
      name: string,
      options?: {
        unit?: string | null;
        valueMode?: HabitValueMode;
      }
    ) => {
      const trimmedName = name.trim();
      const trimmedUnit =
        typeof options?.unit === "string" && options.unit.trim()
          ? options.unit.trim()
          : null;
      const valueMode: HabitValueMode =
        options?.valueMode === "measure" && trimmedUnit ? "measure" : "toggle";

      if (!trimmedName) {
        return;
      }

      const newHabit: Habit = {
        id: createHabitId(),
        name: trimmedName,
        createdAt: new Date().toISOString(),
        unit: trimmedUnit,
        valueMode,
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
    (
      habitId: string,
      updates: {
        name?: string;
        unit?: string | null;
        valueMode?: HabitValueMode;
      }
    ) => {
      const trimmedName =
        typeof updates.name === "string" ? updates.name.trim() : undefined;
      const trimmedUnit =
        typeof updates.unit === "string" && updates.unit.trim()
          ? updates.unit.trim()
          : null;

      if (typeof updates.name === "string" && !trimmedName) {
        return;
      }

      setState((previous) => {
        const safePrevious = normalizeState(previous);

        return {
          ...safePrevious,
          habits: safePrevious.habits.map((habit) =>
            habit.id === habitId
              ? {
                  ...habit,
                  name: trimmedName ?? habit.name,
                  unit:
                    updates.valueMode === "measure"
                      ? trimmedUnit
                      : updates.valueMode === "toggle"
                        ? null
                        : habit.unit,
                  valueMode:
                    updates.valueMode === "measure" && trimmedUnit
                      ? "measure"
                      : updates.valueMode === "toggle"
                        ? "toggle"
                        : habit.valueMode,
                }
              : habit
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
        const habitEntries = safePrevious.completions[habitId] ?? {};
        const hasCompleted = Boolean(habitEntries[dateKey]);
        const nextEntries = { ...habitEntries };

        if (hasCompleted) {
          delete nextEntries[dateKey];
        } else {
          nextEntries[dateKey] = true;
        }

        return {
          ...safePrevious,
          completions: {
            ...safePrevious.completions,
            [habitId]: nextEntries,
          },
        };
      });
    },
    [setState]
  );

  const setHabitMeasurement = useCallback(
    (habitId: string, dateKey: string, value: number | null) => {
      setState((previous) => {
        const safePrevious = normalizeState(previous);
        const habitEntries = safePrevious.completions[habitId] ?? {};
        const nextEntries = { ...habitEntries };

        if (value === null) {
          delete nextEntries[dateKey];
        } else {
          nextEntries[dateKey] = value;
        }

        return {
          ...safePrevious,
          completions: {
            ...safePrevious.completions,
            [habitId]: nextEntries,
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
    setHabitMeasurement,
  };
}
