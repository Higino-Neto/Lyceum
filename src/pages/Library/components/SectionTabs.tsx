import { FolderSync, Folder, Book } from "lucide-react";

interface SectionTabsProps {
  activeSection: "synced" | "unsynced" | "books";
  onSectionChange: (section: "synced" | "unsynced" | "books") => void;
  syncedCount: number;
  unsyncedCount: number;
  booksCount: number;
}

export default function SectionTabs({
  activeSection,
  onSectionChange,
  syncedCount,
  unsyncedCount,
  booksCount,
}: SectionTabsProps) {
  return (
    <div className="flex items-center gap-4 border-b border-zinc-800 pb-4">
      <button
        onClick={() => onSectionChange("synced")}
        className={`flex items-center gap-2 px-4 py-2 cursor-pointer rounded-sm text-sm ${
          activeSection === "synced"
            ? "bg-green-500 text-zinc-900"
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
            ? "bg-green-500 text-zinc-900"
            : "bg-zinc-900 border border-zinc-800 text-zinc-400"
        }`}
      >
        <Folder size={16} />
        Não Sincronizados ({unsyncedCount})
      </button>
      <button
        onClick={() => onSectionChange("books")}
        className={`flex items-center gap-2 px-4 py-2 cursor-pointer rounded-sm text-sm ${
          activeSection === "books"
            ? "bg-green-500 text-zinc-900"
            : "bg-zinc-900 border border-zinc-800 text-zinc-400"
        }`}
      >
        <Book size={16} />
        Meus Livros ({booksCount})
      </button>
    </div>
  );
}
