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
  syncedCount: _syncedCount,
  unsyncedCount: _unsyncedCount,
  viewMode,
  onViewModeChange,
  showSidebar = true,
  onToggleSidebar,
}: LibraryHeaderProps) {
  const { t } = useTranslation();

  const handleOpenLibraryFolder = async () => {
    try {
      await window.api.openLibraryFolder();
    } catch {
      // Avoid an unhandled IPC rejection from destabilising the renderer.
    }
  };

  return (
    <header className="border-b border-border px-6 py-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <BookOpen size={20} className="text-foreground-muted" />
        <h1 className="text-base font-semibold tracking-tight">
          {t("library:header.title")}
        </h1>
        {/* <span className="text-foreground">|</span> */}
        {/* <span className="text-xs text-foreground-subtle">
          {syncedCount + unsyncedCount} volumes
        </span> */}
      </div>

      <div className="flex items-center gap-2">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="cursor-pointer p-2 bg-surface-muted text-foreground-muted hover:bg-border-strong rounded-sm transition-colors"
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
          className="cursor-pointer p-2 bg-surface-muted text-foreground-muted hover:bg-border-strong rounded-sm transition-colors"
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
    <div className="flex items-center bg-surface border border-border rounded-sm p-0.5">
      <button
        onClick={() => onChange("grid")}
        className={`p-1.5 cursor-pointer rounded-sm ${
          value === "grid"
            ? "bg-border-strong text-foreground"
            : "text-foreground-subtle hover:text-foreground"
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
            ? "bg-border-strong text-foreground"
            : "text-foreground-subtle hover:text-foreground"
        }`}
        title={t("library:header.listView")}
        aria-label={t("library:header.listView")}
      >
        <List size={14} />
      </button>
    </div>
  );
}
