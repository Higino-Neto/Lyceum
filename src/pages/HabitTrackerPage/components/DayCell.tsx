import { memo, useEffect, useState } from "react";

interface DayCellProps {
  active: boolean;
  isCurrentDay: boolean;
  isLastColumn: boolean;
  isMeasured?: boolean;
  label: string;
  onClick: () => void;
  onMeasureSave?: (value: number | null) => void;
  measurementValue?: number | null;
}

function formatMeasurementValue(value: number) {
  return Number.isInteger(value)
    ? value.toString()
    : value.toLocaleString("pt-BR", {
        maximumFractionDigits: 2,
      });
}

function DayCellComponent({
  active,
  isCurrentDay,
  isLastColumn,
  isMeasured = false,
  label,
  onClick,
  onMeasureSave,
  measurementValue = null,
}: DayCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftValue, setDraftValue] = useState(
    measurementValue !== null ? measurementValue.toString() : ""
  );

  useEffect(() => {
    if (!isEditing) {
      setDraftValue(measurementValue !== null ? measurementValue.toString() : "");
    }
  }, [isEditing, measurementValue]);

  const handleOpenMeasureInput = () => {
    if (!isMeasured) {
      onClick();
      return;
    }

    setIsEditing(true);
  };

  const handleCancelEditing = () => {
    setDraftValue(measurementValue !== null ? measurementValue.toString() : "");
    setIsEditing(false);
  };

  const handleSaveMeasurement = () => {
    if (!isMeasured || !onMeasureSave) {
      return;
    }

    const trimmedValue = draftValue.trim();

    if (!trimmedValue) {
      onMeasureSave(null);
      setIsEditing(false);
      return;
    }

    const parsedValue = Number(trimmedValue.replace(",", "."));

    if (!Number.isFinite(parsedValue) || parsedValue < 0) {
      handleCancelEditing();
      return;
    }

    onMeasureSave(parsedValue);
    setIsEditing(false);
  };

  return (
    <div
      className={`group relative flex aspect-square w-full items-center justify-center border-l border-zinc-900/80 transition-colors duration-150 ${
        isLastColumn ? "border-r border-zinc-900/80" : ""
      } ${active ? "bg-green-500/5" : "bg-transparent"}`}
    >
      {isCurrentDay && (
        <span className="pointer-events-none absolute inset-y-1 left-1/2 w-px -translate-x-1/2 bg-zinc-700/80" />
      )}
      {isMeasured && isEditing ? (
        <input
          type="text"
          inputMode="decimal"
          value={draftValue}
          onChange={(event) => setDraftValue(event.target.value)}
          onBlur={handleSaveMeasurement}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              handleSaveMeasurement();
            }

            if (event.key === "Escape") {
              handleCancelEditing();
            }
          }}
          aria-label={`${label} - valor`}
          className="relative z-10 h-full w-full bg-zinc-950/95 px-1 text-center text-xs font-semibold text-green-400 outline-none"
          autoFocus
        />
      ) : (
        <button
          type="button"
          onClick={handleOpenMeasureInput}
          aria-pressed={active}
          aria-label={label}
          className="flex h-full w-full cursor-pointer items-center justify-center focus-visible:bg-zinc-800/40"
        >
          {isMeasured ? (
            active && measurementValue !== null ? (
              <span className="relative z-10 text-xs font-semibold text-green-400">
                {formatMeasurementValue(measurementValue)}
              </span>
            ) : (
              <span className="relative z-10 h-2 w-2 rounded-full bg-zinc-600/55 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100" />
            )
          ) : (
            <span
              className={`relative z-10 rounded-full transition-all duration-150 ${
                active
                  ? "h-3 w-3 bg-green-500"
                  : "h-2 w-2 bg-zinc-600/55 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
              }`}
            />
          )}
        </button>
      )}
    </div>
  );
}

export const DayCell = memo(DayCellComponent);
