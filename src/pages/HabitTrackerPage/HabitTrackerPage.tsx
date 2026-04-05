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
    () => `minmax(220px, 280px) repeat(${daysInMonth}, minmax(0, 1fr))`,
    [daysInMonth]
  );

  const handleCreateHabit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = newHabitName.trim();

    if (!trimmedName) {
      return;
    }

    addHabit(trimmedName);
    setNewHabitName("");
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
                <div className="px-3 flex justify-center">
                  <p className="text-[11px] uppercase tracking-[0.28em] text-zinc-500">
                    Hábitos
                  </p>
                  {/* <p className="mt-2 text-sm text-zinc-400">
                    Clique em qualquer célula para marcar. Arraste o handle para
                    reorganizar.
                  </p> */}
                </div>
                {days.map((item, index) => (
                  <div
                    key={item.dateKey}
                    className={`flex h-14 flex-col items-center justify-center gap-0.5 border-l border-zinc-800/80 text-center ${
                      index === days.length - 1 ? "border-r border-zinc-800/80" : ""
                    } ${item.isCurrentDay ? "bg-zinc-800/35" : ""}`}
                  >
                    <span
                      className={`text-[10px] uppercase tracking-[0.2em] ${
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
                      completedDates={completions[habit.id] ?? []}
                      gridTemplateColumns={gridTemplateColumns}
                      isDragging={draggedHabitId === habit.id}
                      isDropTarget={
                        dropTargetHabitId === habit.id &&
                        draggedHabitId !== habit.id
                      }
                      onToggle={(dateKey) =>
                        toggleHabitCompletion(habit.id, dateKey)
                      }
                      onDelete={() => setHabitToDelete(habit)}
                      onUpdate={(name) => updateHabit(habit.id, name)}
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
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      value={newHabitName}
                      onChange={(event) => setNewHabitName(event.target.value)}
                      placeholder="Ex: Dormir Cedo"
                      className="min-w-0 flex-1 h-8 w-8 rounded-sm border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-500"
                      maxLength={48}
                    />
                    <button
                      type="submit"
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center gap-2 rounded-sm bg-green-500 text-sm font-medium text-zinc-950 transition hover:bg-green-600 cursor-pointer"
                    >
                      <Plus size={16} />
                    </button>
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
