import { BookOpen, LayoutGrid, List, Heart, FolderOpen, PanelLeftClose, PanelLeft } from "lucide-react";

interface LibraryHeaderProps {
  syncedCount: number;
  unsyncedCount: number;
  viewMode: "grid" | "list";
  onViewModeChange: (mode: "grid" | "list") => void;
  showFavoritesOnly?: boolean;
  onToggleFavorites?: () => void;
  showSidebar?: boolean;
  onToggleSidebar?: () => void;
}

export default function LibraryHeader({
  syncedCount,
  unsyncedCount,
  viewMode,
  onViewModeChange,
  showFavoritesOnly = false,
  onToggleFavorites,
  showSidebar = true,
  onToggleSidebar,
}: LibraryHeaderProps) {

  const handleOpenLibraryFolder = async () => {
    await window.api.openLibraryFolder();
  };

  return (
    <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <BookOpen size={20} className="text-zinc-400" />
        <h1 className="text-base font-semibold tracking-tight">Biblioteca</h1>
        <span className="text-zinc-700">|</span>
        <span className="text-xs text-zinc-500">
          {syncedCount + unsyncedCount} volumes
        </span>
      </div>

      <div className="flex items-center gap-2">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="cursor-pointer p-2 bg-zinc-800 text-zinc-400 hover:bg-zinc-700 rounded-lg transition-colors"
            title={showSidebar ? "Ocultar painel de pastas" : "Mostrar painel de pastas"}
          >
            {showSidebar ? <PanelLeftClose size={18} /> : <PanelLeft size={18} />}
          </button>
        )}

        {onToggleFavorites && (
          <button
            onClick={onToggleFavorites}
            className={`cursor-pointer p-2 rounded-lg transition-colors ${
              showFavoritesOnly
                ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            }`}
            title="Mostrar favoritos"
          >
            <Heart size={18} className={showFavoritesOnly ? "fill-red-400" : ""} />
          </button>
        )}

        <button
          onClick={handleOpenLibraryFolder}
          className="cursor-pointer p-2 bg-zinc-800 text-zinc-400 hover:bg-zinc-700 rounded-lg transition-colors"
          title="Abrir pasta da biblioteca"
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
  return (
    <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-sm p-0.5">
      <button
        onClick={() => onChange("grid")}
        className={`p-1.5 cursor-pointer rounded-sm ${
          value === "grid"
            ? "bg-zinc-700 text-white"
            : "text-zinc-500 hover:text-zinc-300"
        }`}
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
      >
        <List size={14} />
      </button>
    </div>
  );
}
