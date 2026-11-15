import { useEffect, useRef, useState, type DragEvent as ReactDragEvent } from "react";
import { KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";

export interface ToolFile {
  id: string;
  path: string;
  name: string;
  size: number;
  extension: string;
}

export interface ToolRunState {
  status: "idle" | "running" | "done" | "error";
  progress: number;
  message?: string;
  outputPath?: string;
  pageCount?: number;
  error?: string;
}

let idCounter = 0;
export function createToolFileId(prefix = "file") {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

export function baseName(filePath: string) {
  return filePath.split(/[/\\]/).pop() || filePath;
}

export function stripExtension(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "");
}

/** Runs a tool job and tracks the progress events the main process emits for it. */
export function useToolRunner() {
  const [state, setState] = useState<ToolRunState>({ status: "idle", progress: 0 });
  const jobRef = useRef<string | null>(null);

  useEffect(() => {
    if (!window.api?.onToolProgress) return undefined;
    return window.api.onToolProgress((event) => {
      if (event.jobId !== jobRef.current) return;
      setState((current) => current.status === "running"
        ? { ...current, progress: Math.max(current.progress, Math.round(event.progress * 100)), message: event.message }
        : current);
    });
  }, []);

  const run = async (request: Parameters<typeof window.api.runTool>[0]) => {
    const jobId = createToolFileId("job");
    jobRef.current = jobId;
    setState({ status: "running", progress: 2 });
    try {
      const result = await window.api.runTool(request, jobId);
      setState(result.success
        ? { status: "done", progress: 100, outputPath: result.outputPath, pageCount: result.pageCount }
        : { status: "error", progress: 0, error: result.error });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setState({ status: "error", progress: 0, error: message });
      return { success: false, error: message };
    } finally {
      jobRef.current = null;
    }
  };

  const reset = () => setState({ status: "idle", progress: 0 });
  return { state, run, reset };
}

export function useSortableSensors() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
}

export function reorderById<T extends { id: string }>(items: T[], event: DragEndEvent) {
  const { active, over } = event;
  if (!over || active.id === over.id) return items;
  const from = items.findIndex((item) => item.id === active.id);
  const to = items.findIndex((item) => item.id === over.id);
  return from < 0 || to < 0 ? items : arrayMove(items, from, to);
}


export function toToolFiles(files: Array<{ path: string; name: string; size: number; extension: string }>, prefix: string): ToolFile[] {
  return files.map((file) => ({ ...file, id: createToolFileId(prefix) }));
}

type Rect = { top: number; left: number; width: number; height: number; bottom: number; right: number };
type ModifierArgs = { transform: { x: number; y: number; scaleX: number; scaleY: number }; draggingNodeRect: Rect | null; containerNodeRect: Rect | null };

function clampToRect(transform: ModifierArgs["transform"], rect: Rect, bounds: Rect) {
  const next = { ...transform };
  if (rect.top + next.y < bounds.top) next.y = bounds.top - rect.top;
  else if (rect.bottom + next.y > bounds.bottom) next.y = bounds.bottom - rect.bottom;
  if (rect.left + next.x < bounds.left) next.x = bounds.left - rect.left;
  else if (rect.right + next.x > bounds.right) next.x = bounds.right - rect.right;
  return next;
}

/** Keeps the dragged item inside its list/grid (same behaviour as @dnd-kit/modifiers' restrictToParentElement). */
export function restrictToParent({ transform, draggingNodeRect, containerNodeRect }: ModifierArgs) {
  return draggingNodeRect && containerNodeRect ? clampToRect(transform, draggingNodeRect, containerNodeRect) : transform;
}


function hasFiles(event: ReactDragEvent) {
  return Array.from(event.dataTransfer?.types || []).includes("Files");
}

/**
 * Accepts files dragged from the OS file manager. Only reacts to real file
 * drags, so it never interferes with reordering (dnd-kit uses pointer events).
 */
export function useFileDrop(extensions: string[], onFiles: (files: ToolFile[]) => void, prefix: string) {
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0);
  const accepted = new Set(extensions);

  const reset = () => {
    depth.current = 0;
    setDragging(false);
  };

  return {
    dragging,
    handlers: {
      onDragEnter: (event: ReactDragEvent) => {
        if (!hasFiles(event)) return;
        event.preventDefault();
        depth.current += 1;
        setDragging(true);
      },
      onDragOver: (event: ReactDragEvent) => {
        if (!hasFiles(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      },
      onDragLeave: (event: ReactDragEvent) => {
        if (!hasFiles(event)) return;
        depth.current = Math.max(0, depth.current - 1);
        if (depth.current === 0) setDragging(false);
      },
      onDrop: (event: ReactDragEvent) => {
        if (!hasFiles(event)) return;
        event.preventDefault();
        reset();
        const paths = Array.from(event.dataTransfer.files)
          .map((file) => {
            try {
              return window.api.getPathForFile(file);
            } catch {
              return "";
            }
          })
          .filter(Boolean);
        if (paths.length === 0) return;
        void window.api.describeToolFiles(paths).then((files) => {
          const usable = files.filter((file) => accepted.has(file.extension));
          if (usable.length) onFiles(toToolFiles(usable, prefix));
        });
      },
    },
  };
}
