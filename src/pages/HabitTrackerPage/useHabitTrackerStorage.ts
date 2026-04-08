import React, { useCallback, useMemo } from "react";
import type {
  Habit,
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

function normalizeCompletions(
  completions: Record<string, { habitId: string; dateKey: string; value: string | null }[]>
): HabitTrackerState["completions"] {
  const normalized: HabitTrackerState["completions"] = {};

  Object.entries(completions).forEach(([habitId, records]) => {
    normalized[habitId] = {};
    
    for (const record of records) {
      if (record.value === null) {
        normalized[habitId][record.dateKey] = true;
      } else if (record.value === "true") {
        normalized[habitId][record.dateKey] = true;
      } else {
        const parsedValue = Number(record.value);
        if (Number.isFinite(parsedValue)) {
          normalized[habitId][record.dateKey] = parsedValue;
        }
      }
    }
  });

  return normalized;
}

export function useHabitTrackerStorage() {
  const [state, setState, _remove] = useSQLiteHabits();

  const normalizedState = useMemo(() => {
    if (!state) return INITIAL_STATE;
    return state;
  }, [state]);

  const habits = useMemo(() => normalizedState.habits, [normalizedState.habits]);
  const completions = useMemo(
    () => normalizedState.completions,
    [normalizedState.completions]
  );

  const addHabit = useCallback(
    async (
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

      await window.api.habitsAdd({
        id: newHabit.id,
        name: newHabit.name,
        unit: newHabit.unit,
        valueMode: newHabit.valueMode,
      });

      setState((previous) => {
        return {
          ...previous,
          habits: [...previous.habits, newHabit],
        };
      });
    },
    [setState]
  );

  const updateHabit = useCallback(
    async (
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

      await window.api.habitsUpdate(habitId, {
        name: trimmedName,
        unit: trimmedUnit,
        valueMode: updates.valueMode,
      });

      setState((previous) => {
        return {
          ...previous,
          habits: previous.habits.map((habit) =>
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
    async (habitId: string) => {
      await window.api.habitsDelete(habitId);

      setState((previous) => {
        const nextCompletions = { ...previous.completions };
        delete nextCompletions[habitId];

        return {
          habits: previous.habits.filter((habit) => habit.id !== habitId),
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
        const fromIndex = previous.habits.findIndex(
          (habit) => habit.id === fromHabitId
        );
        const toIndex = previous.habits.findIndex(
          (habit) => habit.id === toHabitId
        );

        if (fromIndex === -1 || toIndex === -1) {
          return previous;
        }

        const nextHabits = [...previous.habits];
        const [movedHabit] = nextHabits.splice(fromIndex, 1);
        nextHabits.splice(toIndex, 0, movedHabit);

        return {
          ...previous,
          habits: nextHabits,
        };
      });
    },
    [setState]
  );

  const toggleHabitCompletion = useCallback(
    async (habitId: string, dateKey: string) => {
      const currentEntries = normalizedState.completions[habitId] ?? {};
      const hasCompleted = Boolean(currentEntries[dateKey]);

      if (hasCompleted) {
        await window.api.habitsDeleteCompletion(habitId, dateKey);
      } else {
        await window.api.habitsSetCompletion(habitId, dateKey, "true");
      }

      setState((previous) => {
        const habitEntries = previous.completions[habitId] ?? {};
        const nextEntries = { ...habitEntries };

        if (hasCompleted) {
          delete nextEntries[dateKey];
        } else {
          nextEntries[dateKey] = true;
        }

        return {
          ...previous,
          completions: {
            ...previous.completions,
            [habitId]: nextEntries,
          },
        };
      });
    },
    [normalizedState.completions, setState]
  );

  const setHabitMeasurement = useCallback(
    async (habitId: string, dateKey: string, value: number | null) => {
      const valueStr = value === null ? null : String(value);
      await window.api.habitsSetCompletion(habitId, dateKey, valueStr);

      setState((previous) => {
        const habitEntries = previous.completions[habitId] ?? {};
        const nextEntries = { ...habitEntries };

        if (value === null) {
          delete nextEntries[dateKey];
        } else {
          nextEntries[dateKey] = value;
        }

        return {
          ...previous,
          completions: {
            ...previous.completions,
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

function useSQLiteHabits(): [
  HabitTrackerState,
  (value: HabitTrackerState | ((prev: HabitTrackerState) => HabitTrackerState)) => void,
  () => void
] {
  const [state, setState] = React.useState<HabitTrackerState>(INITIAL_STATE);

  React.useEffect(() => {
    async function loadHabits() {
      if (!window.api?.habitsGetAll) {
        return;
      }

      try {
        const habits = await window.api.habitsGetAll();
        const allCompletions = await window.api.habitsGetAllCompletions();

        const completionsByHabit: Record<string, { habitId: string; dateKey: string; value: string | null }[]> = {};
        for (const comp of allCompletions) {
          if (!completionsByHabit[comp.habitId]) {
            completionsByHabit[comp.habitId] = [];
          }
          completionsByHabit[comp.habitId].push(comp);
        }

        const completions = normalizeCompletions(completionsByHabit);

        setState({
          habits: habits.map((h: any) => ({
            id: h.id,
            name: h.name,
            createdAt: h.createdAt,
            unit: h.unit,
            valueMode: h.valueMode as HabitValueMode,
          })),
          completions,
        });
      } catch (error) {
        console.error("[HabitTracker] Error loading habits:", error);
      }
    }

    loadHabits();
  }, []);

  const setValue = useCallback(
    (value: HabitTrackerState | ((prev: HabitTrackerState) => HabitTrackerState)) => {
      setState((prev) => {
        const newValue = value instanceof Function ? value(prev) : value;
        return newValue;
      });
    },
    []
  );

  const remove = useCallback(() => {
    // Not implemented for SQLite
  }, []);

  return [state, setValue, remove];
}
