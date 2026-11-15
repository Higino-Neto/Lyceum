import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";

export interface ResizablePanelOptions {
  /** localStorage key; width is persisted when given. */
  storageKey?: string;
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
  /**
   * Which edge carries the handle. A panel docked on the right has its handle
   * on the left edge, so dragging left makes it wider.
   */
  edge: "left" | "right";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function loadWidth({ storageKey, defaultWidth, minWidth, maxWidth }: ResizablePanelOptions) {
  if (!storageKey) return defaultWidth;
  try {
    const raw = localStorage.getItem(storageKey);
    const parsed = raw === null ? Number.NaN : Number(JSON.parse(raw));
    return Number.isFinite(parsed) ? clamp(parsed, minWidth, maxWidth) : defaultWidth;
  } catch {
    return defaultWidth;
  }
}

/**
 * Width state + pointer/keyboard handlers for a side panel with a draggable
 * edge (the pattern used by the library panes and the PDF chapter sidebar).
 */
export function useResizablePanel(options: ResizablePanelOptions) {
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const [width, setWidthState] = useState(() => loadWidth(options));
  const [isResizing, setIsResizing] = useState(false);
  const widthRef = useRef(width);
  widthRef.current = width;

  const setWidth = useCallback((next: number) => {
    const { minWidth, maxWidth } = optionsRef.current;
    setWidthState(clamp(Math.round(next), minWidth, maxWidth));
  }, []);

  useEffect(() => {
    if (!options.storageKey || isResizing) return;
    try {
      localStorage.setItem(options.storageKey, JSON.stringify(width));
    } catch {
      // Best-effort persistence.
    }
  }, [isResizing, options.storageKey, width]);

  const startResize = useCallback((event: ReactPointerEvent) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = widthRef.current;
    const direction = optionsRef.current.edge === "left" ? -1 : 1;
    setIsResizing(true);
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handleMove = (moveEvent: PointerEvent) => {
      setWidth(startWidth + (moveEvent.clientX - startX) * direction);
    };
    const handleUp = () => {
      setIsResizing(false);
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
  }, [setWidth]);

  /** Arrow keys resize by 16px (Shift: 64px) when the handle has focus. */
  const handleKeyDown = useCallback((event: ReactKeyboardEvent) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const step = event.shiftKey ? 64 : 16;
    const towardsWider = optionsRef.current.edge === "left" ? event.key === "ArrowLeft" : event.key === "ArrowRight";
    setWidth(widthRef.current + (towardsWider ? step : -step));
  }, [setWidth]);

  return { width, setWidth, isResizing, startResize, handleKeyDown };
}
