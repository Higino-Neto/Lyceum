import { DragEvent, FormEvent, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import ConfirmDialog from "../../components/ConfirmDialog";
import type { Habit } from "./types";
import { HabitRow } from "./components/HabitRow";
import { MonthNavigator } from "./components/MonthNavigator";
import { useHabitTrackerStorage } from "./useHabitTrackerStorage";
import {
  createDateKey,
  getMonthDays,
  getMonthLabel,
  getWeekdayLabel,
  isToday,
} from "./utils";

export default function HabitTrackerPage() {
  const [currentMonth, setCurrentMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );
  const [newHabitName, setNewHabitName] = useState("");
  const [newHabitIsMeasured, setNewHabitIsMeasured] = useState(false);
  const [newHabitUnit, setNewHabitUnit] = useState("");
  const [draggedHabitId, setDraggedHabitId] = useState<string | null>(null);
  const [dropTargetHabitId, setDropTargetHabitId] = useState<string | null>(null);
  const [habitToDelete, setHabitToDelete] = useState<Habit | null>(null);
  const {
    habits,
    completions,
    addHabit,
    updateHabit,
    deleteHabit,
    reorderHabits,
    toggleHabitCompletion,
    setHabitMeasurement,
  } = useHabitTrackerStorage();

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const daysInMonth = getMonthDays(year, month);

  const days = useMemo(
    () =>
      Array.from({ length: daysInMonth }, (_, index) => {
        const day = index + 1;

        return {
          day,
          dateKey: createDateKey(year, month, day),
          weekday: getWeekdayLabel(year, month, day),
          isCurrentDay: isToday(year, month, day),
        };
      }),
    [daysInMonth, month, year]
  );

  const monthLabel = useMemo(() => getMonthLabel(currentMonth), [currentMonth]);
  const gridTemplateColumns = useMemo(
    () => `minmax(220px, 240px) repeat(${daysInMonth}, minmax(0, 1fr))`,
    [daysInMonth]
  );
  const canCreateHabit =
    newHabitName.trim().length > 0 &&
    (!newHabitIsMeasured || newHabitUnit.trim().length > 0);

  const handleCreateHabit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = newHabitName.trim();
    const trimmedUnit = newHabitUnit.trim();

    if (!trimmedName || (newHabitIsMeasured && !trimmedUnit)) {
      return;
    }

    addHabit(trimmedName, {
      unit: newHabitIsMeasured ? trimmedUnit : null,
      valueMode: newHabitIsMeasured ? "measure" : "toggle",
    });
    setNewHabitName("");
    setNewHabitIsMeasured(false);
    setNewHabitUnit("");
  };

  const handleDropHabit = (targetHabitId: string) => {
    if (!draggedHabitId || draggedHabitId === targetHabitId) {
      setDraggedHabitId(null);
      setDropTargetHabitId(null);
      return;
    }

    reorderHabits(draggedHabitId, targetHabitId);
    setDraggedHabitId(null);
    setDropTargetHabitId(null);
  };

  const handleMatrixDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  return (
    <div className="min-h-[calc(100vh-80px)] bg-zinc-950 px-3 py-3 text-zinc-100 md:px-5 md:py-5">
      <div className="flex min-h-[calc(100vh-24px)] w-full flex-col rounded-sm bg-zinc-900/95  ring-zinc-800/80 md:min-h-[calc(100vh-80px)]">
        <div className="flex flex-1 flex-col">
          <div
            className="flex-1 overflow-x-auto lg:overflow-x-visible"
            onDragOver={handleMatrixDragOver}
          >
            <div className="min-w-270 overflow-hidden rounded-sm border border-zinc-800/80 bg-zinc-950/35 lg:min-w-0">
              <div
                className="grid items-center border-b border-zinc-800/80 bg-zinc-900/90"
                style={{ gridTemplateColumns }}
              >
                <div className="px-1 flex justify-center">
                  <p className="text-[11px] uppercase tracking-[0.28em] text-zinc-500">
                    Hábitos
                  </p>
                </div>
                {days.map((item, index) => (
                  <div
                    key={item.dateKey}
                    className={`flex h-14 flex-col items-center justify-center gap-0.5 border-l border-zinc-800/80 text-center ${
                      index === days.length - 1 ? "border-r border-zinc-800/80" : ""
                    } ${item.isCurrentDay ? "bg-zinc-800/35" : ""}`}
                  >
                    <span
                      className={`text-[11px] uppercase tracking-[0.2em] ${
                        item.isCurrentDay ? "text-green-400" : "text-zinc-600"
                      }`}
                    >
                      {item.weekday}
                    </span>
                    <span
                      className={`text-sm ${
                        item.isCurrentDay
                          ? "font-semibold text-zinc-100"
                          : "text-zinc-400"
                      }`}
                    >
                      {item.day}
                    </span>
                  </div>
                ))}
              </div>

              {habits.length === 0 ? (
                <div className="py-12 text-center text-sm text-zinc-500">
                  Adicione seu primeiro hábito para começar o acompanhamento.
                </div>
              ) : (
                <div>
                  {habits.map((habit) => (
                    <HabitRow
                      key={habit.id}
                      habit={habit}
                      days={days}
                      completions={completions[habit.id] ?? {}}
                      gridTemplateColumns={gridTemplateColumns}
                      isDragging={draggedHabitId === habit.id}
                      isDropTarget={
                        dropTargetHabitId === habit.id &&
                        draggedHabitId !== habit.id
                      }
                      onToggle={(dateKey) =>
                        toggleHabitCompletion(habit.id, dateKey)
                      }
                      onMeasure={(dateKey, value) =>
                        setHabitMeasurement(habit.id, dateKey, value)
                      }
                      onDelete={() => setHabitToDelete(habit)}
                      onUpdate={(name) => updateHabit(habit.id, { name })}
                      onDragStart={() => {
                        setDraggedHabitId(habit.id);
                        setDropTargetHabitId(habit.id);
                      }}
                      onDragEnter={() => {
                        if (draggedHabitId && draggedHabitId !== habit.id) {
                          setDropTargetHabitId(habit.id);
                        }
                      }}
                      onDragEnd={() => {
                        setDraggedHabitId(null);
                        setDropTargetHabitId(null);
                      }}
                      onDrop={() => handleDropHabit(habit.id)}
                    />
                  ))}
                </div>
              )}

              <form
                onSubmit={handleCreateHabit}
                className="grid items-center border-t border-zinc-900/80"
                style={{ gridTemplateColumns }}
              >
                <div className="px-3 py-3">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <input
                        type="text"
                        value={newHabitName}
                        onChange={(event) => setNewHabitName(event.target.value)}
                        placeholder="Ex: Dormir Cedo"
                        aria-label="Nome do hábito"
                        className="h-8 min-w-0 w-8 flex-1 rounded-sm border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-500"
                        maxLength={48}
                      />
                      <button
                        type="submit"
                        aria-label="Adicionar hábito"
                        disabled={!canCreateHabit}
                        className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-sm bg-green-500 text-sm font-medium text-zinc-950 transition hover:bg-green-600 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="inline-flex cursor-pointer items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                        <input
                          type="checkbox"
                          checked={newHabitIsMeasured}
                          onChange={(event) => {
                            const nextChecked = event.target.checked;

                            setNewHabitIsMeasured(nextChecked);
                            if (!nextChecked) {
                              setNewHabitUnit("");
                            }
                          }}
                          className="h-3.5 w-3.5 rounded border-zinc-700 bg-zinc-950 text-green-500 focus:ring-0"
                        />
                        Mensurar
                      </label>
                      {newHabitIsMeasured && (
                        <input
                          type="text"
                          value={newHabitUnit}
                          onChange={(event) => setNewHabitUnit(event.target.value)}
                          placeholder="Unidade ex: horas"
                          aria-label="Unidade de medida"
                          className="h-8 min-w-0 flex-1 rounded-sm border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 placeholder:text-zinc-500"
                          maxLength={16}
                        />
                      )}
                    </div>
                  </div>
                </div>
                {days.map((item, index) => (
                  <div
                    key={item.dateKey}
                    className={`aspect-square w-full border-l border-zinc-900/80 bg-transparent ${
                      index === days.length - 1 ? "border-r border-zinc-900/80" : ""
                    }`}
                  />
                ))}
              </form>
            </div>
          </div>

          <div className="mt-5 flex justify-center border-t border-zinc-800/80 pt-5">
            <MonthNavigator
              label={monthLabel}
              onPrevious={() =>
                setCurrentMonth(
                  (previous) =>
                    new Date(previous.getFullYear(), previous.getMonth() - 1, 1)
                )
              }
              onNext={() =>
                setCurrentMonth(
                  (previous) =>
                    new Date(previous.getFullYear(), previous.getMonth() + 1, 1)
                )
              }
            />
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={!!habitToDelete}
        title="Excluir hábito"
        message={`Tem certeza que deseja excluir "${habitToDelete?.name}"?`}
        confirmLabel="Excluir"
        onCancel={() => setHabitToDelete(null)}
        onConfirm={() => {
          if (!habitToDelete) {
            return;
          }

          deleteHabit(habitToDelete.id);
          setHabitToDelete(null);
        }}
        isDanger
      />
    </div>
  );
}
