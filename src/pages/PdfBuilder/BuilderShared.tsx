import { useEffect, useMemo, useRef, useState, type DragEvent as ReactDragEvent, type ReactNode } from "react";
import { DndContext, closestCenter } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CircleAlert, CircleCheck, FolderOpen, Upload } from "lucide-react";
import { useTranslation } from "../../i18n/useTranslation";
import { baseName, reorderById, restrictToParent, useSortableSensors, type ToolRunState } from "./builderUtils";

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

/**
 * Shared frame for every tool: a fixed header (title + actions), a body where
 * only the content scrolls, an optional options column and a fixed footer
 * with the run status and the primary action. Nothing overlaps the content.
 */
export function ToolLayout({ title, description, actions, toolbar, sidebar, footer, children, dropzone }: {
  title: string;
  description: string;
  actions?: ReactNode;
  /** Secondary row under the header (page tools, filters...). */
  toolbar?: ReactNode;
  sidebar?: ReactNode;
  footer: ReactNode;
  children: ReactNode;
  /** Drag-and-drop from the file manager onto the whole tool. */
  dropzone?: { dragging: boolean; handlers: Record<string, (event: ReactDragEvent) => void>; label: string };
}) {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-sm border border-border bg-surface/40" {...dropzone?.handlers}>
      <header className={`flex flex-shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border px-4 ${toolbar ? "py-2" : "py-3"}`}>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {/* The description only helps before anything is loaded; afterwards the space goes to the content. */}
          {!toolbar && <p className="mt-0.5 text-xs text-foreground-subtle">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </header>
      {toolbar && <div className="flex flex-shrink-0 flex-wrap items-center gap-2 border-b border-border px-4 py-2">{toolbar}</div>}

      <div className="flex min-h-0 flex-1">
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
        {sidebar && (
          <aside className="hidden w-72 flex-shrink-0 space-y-5 overflow-y-auto border-l border-border bg-surface/60 p-4 md:block xl:w-80">
            {sidebar}
          </aside>
        )}
      </div>
      {sidebar && <div className="max-h-56 flex-shrink-0 space-y-4 overflow-y-auto border-t border-border p-4 md:hidden">{sidebar}</div>}

      <footer className="flex flex-shrink-0 flex-wrap items-center justify-end gap-3 border-t border-border bg-surface px-4 py-3">
        {footer}
      </footer>

      {dropzone?.dragging && (
        <div className="pointer-events-none absolute inset-2 z-20 flex flex-col items-center justify-center gap-2 rounded-sm border-2 border-dashed border-primary bg-overlay text-sm font-medium text-foreground backdrop-blur-sm">
          <Upload size={26} className="text-primary" />
          {dropzone.label}
        </div>
      )}
    </div>
  );
}

/** Big empty state that also explains drag-and-drop. */
export function ToolEmptyState({ icon, title, hint, actions }: { icon: ReactNode; title: string; hint: string; actions: ReactNode }) {
  return (
    <div className="flex h-full min-h-64 items-center justify-center p-6">
      <div className="flex w-full max-w-lg flex-col items-center gap-3 rounded-sm border-2 border-dashed border-border-strong px-6 py-10 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-muted text-primary">{icon}</span>
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="max-w-sm text-xs leading-relaxed text-foreground-subtle">{hint}</p>
        <div className="mt-1 flex flex-wrap justify-center gap-2">{actions}</div>
      </div>
    </div>
  );
}

export function OptionSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground-subtle">{title}</h3>
      {children}
    </section>
  );
}

/** Compact segmented control for small mutually exclusive choices. */
export function Segmented<T extends string>({ value, options, onChange, label }: {
  value: T;
  options: Array<{ value: T; label: string; hint?: string; disabled?: boolean }>;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid gap-1 rounded-sm border border-border bg-background p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            title={option.hint}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            className={`h-8 truncate rounded-sm px-2 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              selected ? "bg-primary text-primary-foreground" : "text-foreground-muted hover:bg-surface-muted hover:text-foreground"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Buttons and fields
// ---------------------------------------------------------------------------

export function ToolButton({ children, onClick, disabled, variant = "secondary", title }: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: "secondary" | "primary" | "ghost";
  title?: string;
}) {
  const style = variant === "primary"
    ? "h-10 px-5 bg-primary text-primary-foreground hover:bg-primary-hover font-semibold text-sm"
    : variant === "ghost"
      ? "h-8 px-2.5 text-foreground-muted hover:bg-surface-muted hover:text-foreground text-xs font-medium"
      : "h-8 px-3 border border-border-strong bg-background text-foreground hover:bg-surface-muted text-xs font-medium";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex flex-shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-sm disabled:cursor-not-allowed disabled:opacity-40 ${style}`}
    >
      {children}
    </button>
  );
}

/** Small icon button; it stops pointer/key events so it works inside draggable cards. */
export function IconButton({ label, onClick, disabled, danger, active, children, className = "" }: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  active?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
      disabled={disabled}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`inline-flex h-7 w-7 flex-shrink-0 cursor-pointer items-center justify-center rounded-sm disabled:cursor-not-allowed disabled:opacity-30 ${
        danger
          ? "text-foreground-muted hover:bg-destructive-muted hover:text-destructive"
          : active
            ? "bg-primary-muted text-primary"
            : "text-foreground-muted hover:bg-surface-muted hover:text-foreground"
      } ${className}`}
    >
      {children}
    </button>
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

// ---------------------------------------------------------------------------
// Run status (footer)
// ---------------------------------------------------------------------------

export function ToolRunStatus({ state, idle }: { state: ToolRunState; idle?: ReactNode }) {
  const { t } = useTranslation();

  if (state.status === "running") {
    return (
      <div className="flex min-w-0 flex-1 items-center gap-3" role="status">
        <div className="h-1.5 w-40 flex-shrink-0 overflow-hidden rounded-full bg-surface-muted">
          <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${state.progress}%` }} />
        </div>
        <span className="truncate text-xs text-foreground-muted">{state.progress}% · {state.message || t("conversion:tools.common.running")}</span>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <p className="flex min-w-0 flex-1 items-center gap-2 text-xs text-destructive" role="alert">
        <CircleAlert size={14} className="flex-shrink-0" />
        <span className="truncate" title={state.error}>{t("conversion:tools.common.failed", { message: state.error || "" })}</span>
      </p>
    );
  }

  if (state.status === "done") {
    return (
      <div className="flex min-w-0 flex-1 items-center gap-3" role="status">
        <CircleCheck size={15} className="flex-shrink-0 text-primary" />
        <span className="min-w-0 truncate text-xs text-foreground" title={state.outputPath}>
          {t("conversion:tools.common.done", { name: baseName(state.outputPath || "") })}
          {state.pageCount ? ` · ${t("conversion:tools.common.pages", { count: state.pageCount })}` : ""}
        </span>
        {state.outputPath && (
          <ToolButton variant="ghost" onClick={() => void window.api.showToolOutputInFolder(state.outputPath!)}>
            <FolderOpen size={13} />
            {t("conversion:tools.common.showInFolder")}
          </ToolButton>
        )}
      </div>
    );
  }

  return <div className="min-w-0 flex-1 truncate text-xs text-foreground-subtle">{idle}</div>;
}

// ---------------------------------------------------------------------------
// Sortable list and grid (dragging stays inside the container)
// ---------------------------------------------------------------------------

function useSortableItem(id: string) {
  const sortable = useSortable({ id });
  const style = {
    transform: CSS.Translate.toString(sortable.transform),
    transition: sortable.transition,
    zIndex: sortable.isDragging ? 10 : undefined,
    position: "relative" as const,
  };
  return { ...sortable, style };
}

function SortableGridItem({ id, label, children }: { id: string; label: string; children: (dragging: boolean) => ReactNode }) {
  const { attributes, listeners, setNodeRef, style, isDragging } = useSortableItem(id);
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      aria-label={label}
      className={`group cursor-grab touch-none rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-primary active:cursor-grabbing ${isDragging ? "shadow-xl" : ""}`}
    >
      {children(isDragging)}
    </div>
  );
}

/** Thumbnail grid: cards are dragged as a whole and cannot leave the grid. */
export function SortableGrid<T extends { id: string }>({ items, onChange, columnWidth = 150, itemLabel, children }: {
  items: T[];
  onChange: (items: T[]) => void;
  columnWidth?: number;
  itemLabel: (item: T, index: number) => string;
  children: (item: T, index: number, dragging: boolean) => ReactNode;
}) {
  const sensors = useSortableSensors();
  const ids = useMemo(() => items.map((item) => item.id), [items]);
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToParent]}
      onDragEnd={(event) => onChange(reorderById(items, event))}
    >
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        <div className="grid gap-4 p-4" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${columnWidth}px, 1fr))` }}>
          {items.map((item, index) => (
            <SortableGridItem key={item.id} id={item.id} label={itemLabel(item, index)}>
              {(dragging) => children(item, index, dragging)}
            </SortableGridItem>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

// ---------------------------------------------------------------------------
// Thumbnails
// ---------------------------------------------------------------------------

function useVisibleOnce(load: () => Promise<string | null>, key: string) {
  const [src, setSrc] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement | null>(null);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    let canceled = false;
    setSrc(null);
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      void loadRef.current().then((value) => {
        if (!canceled) setSrc(value);
      });
    }, { rootMargin: "200px" });
    observer.observe(node);
    return () => {
      canceled = true;
      observer.disconnect();
    };
  }, [key]);

  return { src, ref };
}

/** Lazily loads an image thumbnail through the main process (file:// is blocked in the renderer). */
export function ImageThumb({ path, className = "h-12 w-9", fit = "cover" }: { path: string; className?: string; fit?: "cover" | "contain" }) {
  const { src, ref } = useVisibleOnce(async () => {
    const result = await window.api.getToolImageThumbnail(path);
    return result.success && result.dataUrl ? result.dataUrl : null;
  }, path);
  return (
    <div ref={ref} className={`${className} flex flex-shrink-0 items-center justify-center overflow-hidden rounded-sm bg-surface-muted`}>
      {src && <img src={src} alt="" draggable={false} className={`h-full w-full ${fit === "cover" ? "object-cover" : "object-contain"}`} />}
    </div>
  );
}
