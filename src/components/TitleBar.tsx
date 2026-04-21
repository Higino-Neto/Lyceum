import { Minus, Square, X, Copy, Menu, Check } from "lucide-react";
import { useEffect, useState, useCallback } from "react";

interface TitleBarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  autoHideEnabled: boolean;
  onAutoHideToggle: (enabled: boolean) => void;
  panelsVisible: boolean;
  onShowPanels: () => void;
  onHidePanels: () => void;
}

export default function TitleBar({
  collapsed,
  onToggleCollapse,
  autoHideEnabled,
  onAutoHideToggle,
  panelsVisible,
  onShowPanels,
  onHidePanels,
}: TitleBarProps) {
  const [isMaximized, setIsMaximized] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });

  const handleContextMenuClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenuPos({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
  }, []);

  const handleToggleAutoHide = useCallback(() => {
    onAutoHideToggle(!autoHideEnabled);
    setShowContextMenu(false);
  }, [autoHideEnabled, onAutoHideToggle]);

  useEffect(() => {
    const handleClickOutside = () => setShowContextMenu(false);
    if (showContextMenu) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [showContextMenu]);

  useEffect(() => {
    const checkMaximized = async () => {
      const maximized = await window.api.windowIsMaximized();
      setIsMaximized(maximized);
    };
    checkMaximized();

    const interval = setInterval(checkMaximized, 500);
    return () => clearInterval(interval);
  }, []);

  const handleMinimize = () => {
    window.api.windowMinimize();
  };

  const handleMaximize = async () => {
    await window.api.windowMaximize();
    const maximized = await window.api.windowIsMaximized();
    setIsMaximized(maximized);
  };

  const handleClose = () => {
    window.api.windowClose();
  };

  const titleBarHeight = autoHideEnabled && !panelsVisible ? "h-0" : "h-10";
  const titleBarClasses = `bg-zinc-900 flex items-center justify-between select-none transition-all duration-200 ${titleBarHeight}`;

  return (
    <>
      <div
        className={titleBarClasses}
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
        onMouseEnter={onShowPanels}
      >
        <div
          className="flex items-center h-full"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          <button
            onClick={onToggleCollapse}
            onContextMenu={handleContextMenuClick}
            className="h-full px-4 flex items-center justify-center text-zinc-400 hover:text-zinc-100 cursor-pointer"
          >
            {collapsed ? <Menu size={20} /> : <Menu size={20} />}
          </button>

          <span className="text-zinc-400 text-lg font-semibold tracking-wider ml-2">
            Lyceum
          </span>
        </div>

        <div
          className="flex items-center"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          <button
            onClick={handleMinimize}
            className="w-10 h-10 flex items-center justify-center text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100 cursor-pointer"
          >
            <Minus size={16} />
          </button>
          <button
            onClick={handleMaximize}
            className="w-10 h-10 flex items-center justify-center text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100 cursor-pointer"
          >
            {isMaximized ? (
              <Copy size={14} className="rotate-180" />
            ) : (
              <Square size={14} />
            )}
          </button>
          <button
            onClick={handleClose}
            className="w-10 h-10 flex items-center justify-center text-zinc-400 hover:bg-red-600 hover:text-white cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {showContextMenu && (
        <div
          className="fixed bg-zinc-800 border border-zinc-700 rounded-md shadow-lg py-1 z-50"
          style={{ left: contextMenuPos.x, top: contextMenuPos.y }}
        >
          <button
            onClick={handleToggleAutoHide}
            className="w-full px-4 py-2 text-left text-zinc-200 hover:bg-zinc-700 flex items-center gap-2"
          >
            {autoHideEnabled && <Check size={14} />}
            Auto-ocultar {autoHideEnabled ? "(Ativado)" : ""}
          </button>
        </div>
      )}
    </>
  );
}
