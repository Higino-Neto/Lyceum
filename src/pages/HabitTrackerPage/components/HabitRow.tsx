import { Check, Edit3, GripVertical, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Habit, HabitCompletionValue } from "../types";
import { DayCell } from "./DayCell";

interface HabitRowProps {
  habit: Habit;
  days: Array<{
    day: number;
    dateKey: string;
    weekday: string;
    isCurrentDay: boolean;
  }>;
  completions: Record<string, HabitCompletionValue>;
  gridTemplateColumns: string;
  isDragging: boolean;
  isDropTarget: boolean;
  onToggle: (dateKey: string) => void;
  onMeasure: (dateKey: string, value: number | null) => void;
  onDelete: () => void;
  onUpdate: (name: string) => void;
  onDragStart: () => void;
  onDragEnter: () => void;
  onDragEnd: () => void;
  onDrop: () => void;
}

export function HabitRow({
  habit,
  days,
  completions,
  gridTemplateColumns,
  isDragging,
  isDropTarget,
  onToggle,
  onMeasure,
  onDelete,
  onUpdate,
  onDragStart,
  onDragEnter,
  onDragEnd,
  onDrop,
}: HabitRowProps) {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState(habit.name);

  useEffect(() => {
    setDraftName(habit.name);
  }, [habit.name]);

  const isMeasuredHabit = habit.valueMode === "measure" && Boolean(habit.unit);
  const habitDisplayName = isMeasuredHabit ? `${habit.name} (${habit.unit})` : habit.name;

  const handleSave = () => {
    const trimmedName = draftName.trim();
    if (!trimmedName) {
      setDraftName(habit.name);
      setIsEditing(false);
      return;
    }

    onUpdate(trimmedName);
    setIsEditing(false);
  };

  return (
    <div
      className={`group/habit grid items-center border-t border-border/80 transition-colors ${
        isDropTarget ? "bg-surface-muted/35" : "hover:bg-background/30"
      } ${isDragging ? "opacity-45" : ""}`}
      style={{ gridTemplateColumns }}
      onDragEnter={onDragEnter}
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
    >
      <div className="min-w-0 px-3 py-2">
        {isEditing ? (
          <div className="flex items-center gap-2">
            <input
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              className="w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm text-foreground"
              maxLength={48}
              autoFocus
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  handleSave();
                }
                if (event.key === "Escape") {
                  setDraftName(habit.name);
                  setIsEditing(false);
                }
              }}
            />
            <button
              type="button"
              onClick={handleSave}
              className="p-1.5 hover:bg-border-strong rounded text-foreground cursor-pointer"
              aria-label={t("habits:row.save", { name: habit.name })}
            >
              <Check size={16} />
            </button>
            <button
              type="button"
              onClick={() => {
                setDraftName(habit.name);
                setIsEditing(false);
              }}
              className="p-1.5 hover:bg-border-strong rounded text-foreground-muted cursor-pointer"
              aria-label={t("habits:row.cancelEdit", { name: habit.name })}
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              draggable
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-foreground-subtle transition hover:bg-surface-muted hover:text-foreground cursor-grab active:cursor-grabbing"
              aria-label={t("habits:row.reorder", { name: habit.name })}
            >
              <GripVertical size={15} />
            </button>
            <h3 className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
              {habitDisplayName}
            </h3>
            <div className="flex shrink-0 items-center gap-1 opacity-0 transition group-hover/habit:opacity-100 focus-within:opacity-100">
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="p-1.5 hover:bg-border-strong rounded text-foreground-muted hover:text-foreground cursor-pointer"
                aria-label={t("habits:row.rename", { name: habit.name })}
              >
                <Edit3 size={14} />
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="p-1.5 hover:bg-border-strong rounded text-foreground-muted hover:text-destructive cursor-pointer"
                aria-label={t("habits:row.delete", { name: habit.name })}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {days.map((item, index) => {
        const completionValue = completions[item.dateKey];

        return (
          <DayCell
            key={item.dateKey}
            label={t("habits:day.ariaLabel", {
              habit: habitDisplayName,
              day: item.day,
            })}
            active={Boolean(completionValue)}
            isCurrentDay={item.isCurrentDay}
            isLastColumn={index === days.length - 1}
            isMeasured={isMeasuredHabit}
            measurementValue={
              typeof completionValue === "number" ? completionValue : null
            }
            onClick={() => onToggle(item.dateKey)}
            onMeasureSave={(value) => onMeasure(item.dateKey, value)}
          />
        );
      })}
    </div>
  );
}
