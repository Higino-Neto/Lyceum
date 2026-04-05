import { memo } from "react";

interface DayCellProps {
  active: boolean;
  isCurrentDay: boolean;
  isLastColumn: boolean;
  label: string;
  onClick: () => void;
}

function DayCellComponent({
  active,
  isCurrentDay,
  isLastColumn,
  label,
  onClick,
}: DayCellProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      className={`group relative flex aspect-square w-full items-center justify-center border-l border-zinc-900/80 transition-colors duration-150 cursor-pointer ${
        isLastColumn ? "border-r border-zinc-900/80" : ""
      } ${
        active
          ? ""
          : "bg-transparent  focus-visible:bg-zinc-800/40"
      }`}
    >
      {isCurrentDay && (
        <span className="pointer-events-none absolute inset-y-1 left-1/2 w-px -translate-x-1/2 bg-zinc-700/80" />
      )}
      <span
        className={`relative z-10 rounded-full transition-all duration-150 ${
          active
            ? "h-4 w-4   bg-green-500"
            : "h-3 w-3 bg-zinc-600/55 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
        }`}
      />
    </button>
  );
}

export const DayCell = memo(DayCellComponent);
