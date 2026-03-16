import { Minus, Square, X, Copy, PanelLeftClose, Menu } from "lucide-react";
import { useEffect, useState } from "react";

interface TitleBarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export default function TitleBar({ collapsed, onToggleCollapse }: TitleBarProps) {
  const [isMaximized, setIsMaximized] = useState(false);

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

  return (
    <div className="h-10 bg-zinc-900 flex items-center justify-between select-none" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
      <div className="flex items-center h-full" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button
          onClick={onToggleCollapse}
          className="h-full px-4 flex items-center justify-center text-zinc-400 hover:text-zinc-100 cursor-pointer"
        >
          {collapsed ? <Menu size={20} /> : <Menu size={20} />}
        </button>
        
        <span className="text-zinc-400 text-lg font-semibold tracking-wider ml-2">Lyceum</span>
      </div>
      
      <div className="flex items-center" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
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
          {isMaximized ? <Copy size={14} className="rotate-180" /> : <Square size={14} />}
        </button>
        <button
          onClick={handleClose}
          className="w-10 h-10 flex items-center justify-center text-zinc-400 hover:bg-red-600 hover:text-white cursor-pointer"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
