import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DndContext, closestCenter } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, CircleAlert, CircleCheck, FolderOpen, GripVertical, X } from "lucide-react";
import { useTranslation } from "../../../i18n/useTranslation";
import { baseName, moveByOffset, reorderById, useSortableSensors, type ToolFile, type ToolRunState } from "./toolUtils";

export function ToolRunStatus({ state }: { state: ToolRunState }) {
  const { t } = useTranslation();
  if (state.status === "idle") return null;

  if (state.status === "running") {
    return (
      <div className="space-y-1.5" role="status">
        <div className="flex items-center justify-between text-xs text-foreground-muted">
          <span className="truncate">{state.message || t("conversion:tools.common.running")}</span>
          <span>{state.progress}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-muted">
          <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${state.progress}%` }} />
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <p className="flex items-start gap-2 rounded-sm border border-destructive/40 bg-destructive-muted px-3 py-2 text-xs text-destructive" role="alert">
        <CircleAlert size={14} className="mt-0.5 flex-shrink-0" />
        <span>{t("conversion:tools.common.failed", { message: state.error || "" })}</span>
      </p>
    );
  }

  return (
    <div className="space-y-2 rounded-sm border border-primary/40 bg-primary-muted px-3 py-2 text-xs text-foreground" role="status">
      <p className="flex items-start gap-2">
        <CircleCheck size={14} className="mt-0.5 flex-shrink-0 text-primary" />
        <span className="min-w-0 break-words">
          {t("conversion:tools.common.done", { name: baseName(state.outputPath || "") })}
          {state.pageCount ? ` · ${t("conversion:tools.common.pages", { count: state.pageCount })}` : ""}
        </span>
      </p>
      {state.outputPath && (
        <button
          type="button"
          onClick={() => void window.api.showToolOutputInFolder(state.outputPath!)}
          className="inline-flex h-7 items-center gap-1.5 rounded-sm border border-border-strong bg-background px-2 text-xs text-foreground hover:bg-surface-muted"
        >
          <FolderOpen size={13} />
          {t("conversion:tools.common.showInFolder")}
        </button>
      )}
    </div>
  );
}

export function ToolPanel({ title, description, actions, children }: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mb-3 rounded-sm border border-border bg-surface/40">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-foreground-subtle">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

export function ToolButton({ children, onClick, disabled, variant = "secondary", title, fullWidth }: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: "secondary" | "primary";
  title?: string;
  fullWidth?: boolean;
}) {
  const className = variant === "primary"
    ? "bg-primary text-primary-foreground hover:bg-primary-hover font-semibold"
    : "border border-border-strong bg-background text-foreground hover:bg-surface-muted font-medium";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-sm px-3 disabled:cursor-not-allowed disabled:opacity-50 ${
        fullWidth ? "h-11 w-full text-sm" : "h-9 text-xs"
      } ${className}`}
    >
      {children}
    </button>
  );
}

function SortableRow({ id, children }: { id: string; children: (handle: ReactNode) => ReactNode }) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const handle = (
    <button
      type="button"
      {...attributes}
      {...listeners}
      className="flex h-7 w-6 flex-shrink-0 cursor-grab items-center justify-center rounded-sm text-foreground-subtle hover:bg-surface-muted hover:text-foreground active:cursor-grabbing"
      title={t("conversion:tools.common.dragHandle")}
      aria-label={t("conversion:tools.common.dragHandle")}
    >
      <GripVertical size={14} />
    </button>
  );
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : undefined, position: "relative" }}
      className={isDragging ? "opacity-80" : undefined}
    >
      {children(handle)}
    </div>
  );
}

/** A vertical, drag-and-drop list of files with keyboard-accessible move buttons. */
export function SortableFileList<T extends ToolFile>({ items, onChange, renderThumb, renderMeta }: {
  items: T[];
  onChange: (items: T[]) => void;
  renderThumb?: (item: T) => ReactNode;
  renderMeta?: (item: T) => ReactNode;
}) {
  const { t } = useTranslation();
  const sensors = useSortableSensors();
  const ids = useMemo(() => items.map((item) => item.id), [items]);

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(event) => onChange(reorderById(items, event))}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ol className="divide-y divide-border">
          {items.map((item, index) => (
            <li key={item.id}>
              <SortableRow id={item.id}>
                {(handle) => (
                  <div className="flex items-center gap-2 bg-background/70 px-3 py-2">
                    {handle}
                    <span className="w-7 flex-shrink-0 text-right text-xs tabular-nums text-foreground-subtle">{index + 1}</span>
                    {renderThumb?.(item)}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-foreground" title={item.path}>{item.name}</p>
                      <div className="truncate text-xs text-foreground-subtle">{renderMeta?.(item)}</div>
                    </div>
                    <div className="flex flex-shrink-0 items-center">
                      <IconButton label={t("conversion:tools.common.moveUp")} disabled={index === 0} onClick={() => onChange(moveByOffset(items, index, -1))}>
                        <ArrowUp size={14} />
                      </IconButton>
                      <IconButton label={t("conversion:tools.common.moveDown")} disabled={index === items.length - 1} onClick={() => onChange(moveByOffset(items, index, 1))}>
                        <ArrowDown size={14} />
                      </IconButton>
                      <IconButton label={t("conversion:tools.common.remove")} danger onClick={() => onChange(items.filter((candidate) => candidate.id !== item.id))}>
                        <X size={14} />
                      </IconButton>
                    </div>
                  </div>
                )}
              </SortableRow>
            </li>
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}

export function SortableGrid<T extends { id: string }>({ items, onChange, children }: {
  items: T[];
  onChange: (items: T[]) => void;
  children: (item: T, index: number, handle: ReactNode) => ReactNode;
}) {
  const sensors = useSortableSensors();
  const ids = useMemo(() => items.map((item) => item.id), [items]);
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(event) => onChange(reorderById(items, event))}>
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-3 p-3">
          {items.map((item, index) => (
            <SortableRow key={item.id} id={item.id}>
              {(handle) => children(item, index, handle)}
            </SortableRow>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

export function IconButton({ label, onClick, disabled, danger, active, children }: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-sm disabled:cursor-not-allowed disabled:opacity-30 ${
        danger
          ? "text-foreground-muted hover:bg-destructive-muted hover:text-destructive"
          : active
            ? "bg-primary-muted text-primary"
            : "text-foreground-muted hover:bg-surface-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

/** Lazily loads an image thumbnail through the main process (file:// is blocked in the renderer). */
export function ImageThumb({ path, className = "h-12 w-9" }: { path: string; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || !window.api?.getToolImageThumbnail) return undefined;
    let canceled = false;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      void window.api.getToolImageThumbnail(path).then((result) => {
        if (!canceled && result.success && result.dataUrl) setSrc(result.dataUrl);
      });
    }, { rootMargin: "200px" });
    observer.observe(node);
    return () => {
      canceled = true;
      observer.disconnect();
    };
  }, [path]);

  return (
    <div ref={ref} className={`${className} flex-shrink-0 overflow-hidden rounded-sm border border-border bg-surface-muted`}>
      {src && <img src={src} alt="" className="h-full w-full object-cover" />}
    </div>
  );
}

export function TextField({ label, value, onChange, placeholder }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block space-y-1 text-xs text-foreground-muted">
      <span>{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-sm border border-border bg-background px-3 text-sm text-foreground outline-none placeholder:text-input-placeholder focus:border-primary"
      />
    </label>
  );
}
