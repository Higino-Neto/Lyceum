import { BookOpen, LayoutGrid, List, FolderOpen, PanelLeftClose, PanelLeft } from "lucide-react";
import { useTranslation } from "../../../i18n";

interface LibraryHeaderProps {
  syncedCount: number;
  unsyncedCount: number;
  viewMode: "grid" | "list";
  onViewModeChange: (mode: "grid" | "list") => void;
  showSidebar?: boolean;
  onToggleSidebar?: () => void;
}

export default function LibraryHeader({
  syncedCount,
  unsyncedCount,
  viewMode,
  onViewModeChange,
  showSidebar = true,
  onToggleSidebar,
}: LibraryHeaderProps) {
  const { t } = useTranslation();

  const handleOpenLibraryFolder = async () => {
    await window.api.openLibraryFolder();
  };

  return (
    <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <BookOpen size={20} className="text-zinc-400" />
        <h1 className="text-base font-semibold tracking-tight">
          {t("library:header.title")}
        </h1>
        {/* <span className="text-zinc-700">|</span> */}
        {/* <span className="text-xs text-zinc-500">
          {syncedCount + unsyncedCount} volumes
        </span> */}
      </div>

      <div className="flex items-center gap-2">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="cursor-pointer p-2 bg-zinc-800 text-zinc-400 hover:bg-zinc-700 rounded-sm transition-colors"
            title={
              showSidebar
                ? t("library:header.hideFolderPanel")
                : t("library:header.showFolderPanel")
            }
          >
            {showSidebar ? <PanelLeftClose size={18} /> : <PanelLeft size={18} />}
          </button>
        )}

        <button
          onClick={handleOpenLibraryFolder}
          className="cursor-pointer p-2 bg-zinc-800 text-zinc-400 hover:bg-zinc-700 rounded-sm transition-colors"
          title={t("library:header.openLibraryFolder")}
        >
          <FolderOpen size={18} />
        </button>

        <ViewModeToggle value={viewMode} onChange={onViewModeChange} />
      </div>
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
  const { t } = useTranslation();

  return (
    <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-sm p-0.5">
      <button
        onClick={() => onChange("grid")}
        className={`p-1.5 cursor-pointer rounded-sm ${
          value === "grid"
            ? "bg-zinc-700 text-white"
            : "text-zinc-500 hover:text-zinc-300"
        }`}
        title={t("library:header.gridView")}
        aria-label={t("library:header.gridView")}
      >
        <LayoutGrid size={14} />
      </button>
      <button
        onClick={() => onChange("list")}
        className={`p-1.5 cursor-pointer rounded-sm ${
          value === "list"
            ? "bg-zinc-700 text-white"
            : "text-zinc-500 hover:text-zinc-300"
        }`}
        title={t("library:header.listView")}
        aria-label={t("library:header.listView")}
      >
        <List size={14} />
      </button>
    </div>
  );
}
