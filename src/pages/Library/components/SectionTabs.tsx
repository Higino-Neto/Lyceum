import { Folder, FolderSync } from "lucide-react";

interface SectionTabsProps {
  activeSection: "synced" | "unsynced";
  onSectionChange: (section: "synced" | "unsynced") => void;
  syncedCount: number;
  unsyncedCount: number;
}

export default function SectionTabs({
  activeSection,
  onSectionChange,
  syncedCount,
  unsyncedCount,
}: SectionTabsProps) {
  return (
    <div className="flex items-center rounded-sm border border-zinc-800 bg-zinc-950 p-0.5">
      <button
        onClick={() => onSectionChange("synced")}
        className={`flex h-8 cursor-pointer items-center gap-2 rounded-sm px-3 text-xs transition-colors ${
          activeSection === "synced"
            ? "bg-green-500 text-zinc-950"
            : "text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300"
        }`}
      >
        <FolderSync size={14} />
        Sincronizados
        <span className="rounded-sm bg-black/10 px-1.5 text-[11px]">
          {syncedCount}
        </span>
      </button>
      <button
        onClick={() => onSectionChange("unsynced")}
        className={`flex h-8 cursor-pointer items-center gap-2 rounded-sm px-3 text-xs transition-colors ${
          activeSection === "unsynced"
            ? "bg-green-500 text-zinc-950"
            : "text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300"
        }`}
      >
        <Folder size={14} />
        Nao sincronizados
        <span className="rounded-sm bg-black/10 px-1.5 text-[11px]">
          {unsyncedCount}
        </span>
      </button>
    </div>
  );
}
