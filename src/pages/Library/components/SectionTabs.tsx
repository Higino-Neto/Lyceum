import { FolderSync, Folder } from "lucide-react";

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
    <div className="flex items-center gap-4 border-b border-zinc-800 pb-4">
      <button
        onClick={() => onSectionChange("synced")}
        className={`flex items-center gap-2 px-4 py-2 cursor-pointer rounded-sm text-sm ${
          activeSection === "synced"
            ? "bg-zinc-700 text-white"
            : "bg-zinc-900 border border-zinc-800 text-zinc-400"
        }`}
      >
        <FolderSync size={16} />
        Sincronizados ({syncedCount})
      </button>
      <button
        onClick={() => onSectionChange("unsynced")}
        className={`flex items-center gap-2 px-4 py-2 cursor-pointer rounded-sm text-sm ${
          activeSection === "unsynced"
            ? "bg-zinc-700 text-white"
            : "bg-zinc-900 border border-zinc-800 text-zinc-400"
        }`}
      >
        <Folder size={16} />
        Não Sincronizados ({unsyncedCount})
      </button>
    </div>
  );
}
