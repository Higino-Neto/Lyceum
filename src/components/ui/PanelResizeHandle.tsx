import type { KeyboardEvent, PointerEvent } from "react";

interface PanelResizeHandleProps {
  edge: "left" | "right";
  label: string;
  width: number;
  minWidth: number;
  maxWidth: number;
  isResizing: boolean;
  onPointerDown(event: PointerEvent): void;
  onKeyDown(event: KeyboardEvent): void;
}

/**
 * Draggable edge for side panels (use with `useResizablePanel`). Sits on the
 * panel border, highlights on hover, and keeps a full-screen cursor layer
 * while dragging so iframes and text do not steal the pointer.
 */
export default function PanelResizeHandle({
  edge, label, width, minWidth, maxWidth, isResizing, onPointerDown, onKeyDown,
}: PanelResizeHandleProps) {
  return (
    <>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={label}
        aria-valuenow={width}
        aria-valuemin={minWidth}
        aria-valuemax={maxWidth}
        tabIndex={0}
        title={label}
        onPointerDown={onPointerDown}
        onKeyDown={onKeyDown}
        className={`absolute top-0 z-20 h-full w-2 cursor-col-resize bg-transparent transition-colors hover:bg-primary-hover/40 focus-visible:bg-primary-hover/40 focus-visible:outline-none ${
          edge === "left" ? "-left-1" : "-right-1"
        } ${isResizing ? "bg-primary-hover/40" : ""}`}
      />
      {isResizing && <div className="fixed inset-0 z-50 cursor-col-resize" />}
    </>
  );
}
