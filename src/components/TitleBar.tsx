import { Minus, Square, X, Copy } from "lucide-react";
import { useEffect, useState } from "react";

declare global {
  interface Window {
    api: {
      windowMinimize: () => Promise<void>;
      windowMaximize: () => Promise<void>;
      windowClose: () => Promise<void>;
      windowIsMaximized: () => Promise<boolean>;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      [key: string]: any;
    };
  }
}

export default function TitleBar() {
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
    <div className="h-10 bg-zinc-900 flex items-center justify-between px-4 select-none" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
      <div className="flex items-center gap-2">
        <span className="text-zinc-400 text-sm font-medium">Lyceum</span>
      </div>
      
      <div className="flex items-center" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button
          onClick={handleMinimize}
          className="w-10 h-10 flex items-center justify-center text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100 transition-colors"
        >
          <Minus size={16} />
        </button>
        <button
          onClick={handleMaximize}
          className="w-10 h-10 flex items-center justify-center text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100 transition-colors"
        >
          {isMaximized ? <Copy size={14} className="rotate-180" /> : <Square size={14} />}
        </button>
        <button
          onClick={handleClose}
          className="w-10 h-10 flex items-center justify-center text-zinc-400 hover:bg-red-600 hover:text-white transition-colors"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
