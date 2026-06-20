import type { ReadingStatus } from "../../../types/LibraryTypes";
import { READING_STATUS_OPTIONS } from "../../../lib/readingStatus";

interface ReadingStatusSelectorProps {
  value: ReadingStatus;
  onChange: (status: ReadingStatus) => void;
  disabled?: boolean;
  label: string;
}

export default function ReadingStatusSelector({
  value,
  onChange,
  disabled = false,
  label,
}: ReadingStatusSelectorProps) {
  return (
    <select
      aria-label={`Status de ${label}`}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value as ReadingStatus)}
      className="h-8 cursor-pointer rounded-sm border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-200 outline-none transition-colors hover:border-zinc-600 focus:border-green-500 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {READING_STATUS_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
