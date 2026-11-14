import { useEffect, useRef, useState } from "react";
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

export function moveByOffset<T>(items: T[], index: number, offset: number) {
  const target = index + offset;
  return target < 0 || target >= items.length ? items : arrayMove(items, index, target);
}

export function toToolFiles(files: Array<{ path: string; name: string; size: number; extension: string }>, prefix: string): ToolFile[] {
  return files.map((file) => ({ ...file, id: createToolFileId(prefix) }));
}
