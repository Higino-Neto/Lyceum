import { BookOpen, LayoutGrid, List } from "lucide-react";

interface LibraryHeaderProps {
  syncedCount: number;
  unsyncedCount: number;
  viewMode: "grid" | "list";
  onViewModeChange: (mode: "grid" | "list") => void;
}

export default function LibraryHeader({
  syncedCount,
  unsyncedCount,
  viewMode,
  onViewModeChange,
}: LibraryHeaderProps) {
  return (
    <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <BookOpen size={20} className="text-green-500" />
        <h1 className="text-base font-semibold tracking-tight">Biblioteca</h1>
        <span className="text-zinc-700">|</span>
        <span className="text-xs text-zinc-500">
          {syncedCount + unsyncedCount} volumes
        </span>
      </div>

      <ViewModeToggle value={viewMode} onChange={onViewModeChange} />
    </header>
  );
}

function ViewModeToggle({
  value,
  onChange,
}: {
  value: "grid" | "list";
  onChange: (mode: "grid" | "list") => void;
}) {
  return (
    <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-md p-0.5">
      <button
        onClick={() => onChange("grid")}
        className={`p-1.5 cursor-pointer rounded ${
          value === "grid"
            ? "bg-zinc-700 text-white"
            : "text-zinc-500 hover:text-zinc-300"
        }`}
      >
        <LayoutGrid size={14} />
      </button>
      <button
        onClick={() => onChange("list")}
        className={`p-1.5 cursor-pointer rounded ${
          value === "list"
            ? "bg-zinc-700 text-white"
            : "text-zinc-500 hover:text-zinc-300"
        }`}
      >
        <List size={14} />
      </button>
    </div>
  );
}
