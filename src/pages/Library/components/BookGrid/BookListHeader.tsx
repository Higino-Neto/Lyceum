import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, Columns3, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useTranslation } from "../../../../i18n";
import type { LibrarySortOption } from "../../../../types/LibraryTypes";
import {
  activeSortDirection,
  columnWidth,
  getListColumn,
  moveListColumn,
  nextSortForColumn,
  toggleListColumn,
  DEFAULT_LIST_COLUMNS_STATE,
  type ListColumnDefinition,
  type ListColumnId,
  type ListColumnsState,
} from "../../../../features/library/model/listColumns";

interface BookListHeaderProps {
  columns: ListColumnDefinition[];
  state: ListColumnsState;
  gridTemplateColumns: string;
  compact: boolean;
  sort?: LibrarySortOption;
  onSortChange?: (sort: LibrarySortOption) => void;
  onStateChange: (state: ListColumnsState) => void;
  /** Live width while dragging; committed with `onStateChange` on release. */
  onResizePreview: (id: ListColumnId, width: number | null) => void;
}

export default function BookListHeader({
  columns,
  state,
  gridTemplateColumns,
  compact,
  sort,
  onSortChange,
  onStateChange,
  onResizePreview,
}: BookListHeaderProps) {
  const { t } = useTranslation();
  const visible = compact ? columns.slice(0, 1) : columns;

  const startResize = (column: ListColumnDefinition, event: ReactPointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startWidth = columnWidth(state, column);
    let latest = startWidth;
    const previousCursor = document.body.style.cursor;
    document.body.style.cursor = "col-resize";

    const handleMove = (moveEvent: PointerEvent) => {
      latest = Math.max(column.minWidth, startWidth + moveEvent.clientX - startX);
      onResizePreview(column.id, latest);
    };
    const handleUp = () => {
      document.body.style.cursor = previousCursor;
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      onResizePreview(column.id, null);
      onStateChange({ ...state, widths: { ...state.widths, [column.id]: Math.round(latest) } });
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  };

  return (
    <div
      className="sticky top-0 z-10 grid rounded-t-sm border border-border bg-overlay text-[11px] font-medium uppercase tracking-wide text-foreground-subtle"
      style={{ gridTemplateColumns }}
    >
      {visible.map((column) => {
        const label = t(column.labelKey);
        const direction = sort ? activeSortDirection(column, sort) : null;
        const nextSort = sort && onSortChange ? nextSortForColumn(column, sort) : null;
        const content = (
          <>
            <span className="truncate">{label}</span>
            {direction === "asc" && <ArrowUp size={12} className="shrink-0 text-primary" />}
            {direction === "desc" && <ArrowDown size={12} className="shrink-0 text-primary" />}
          </>
        );
        return (
          <div
            key={column.id}
            className={`relative flex min-w-0 items-center px-3 py-2 ${column.align === "end" ? "justify-end" : ""}`}
          >
            {nextSort ? (
              <button
                type="button"
                onClick={() => onSortChange?.(nextSort)}
                className={`flex min-w-0 cursor-pointer items-center gap-1 uppercase tracking-wide transition-colors hover:text-foreground ${
                  direction ? "text-foreground" : ""
                }`}
                title={t("library:list.sortBy", { column: label })}
              >
                {content}
              </button>
            ) : (
              <span className="flex min-w-0 items-center gap-1">{content}</span>
            )}
            {!compact && (
              <button
                type="button"
                className="absolute right-0 top-0 h-full w-2 cursor-col-resize border-r border-border hover:border-primary"
                onPointerDown={(event) => startResize(column, event)}
                aria-label={t("library:list.resizeColumn", { column: label })}
              />
            )}
          </div>
        );
      })}
      <div className="flex items-center justify-end px-1">
        <ColumnsMenu state={state} onChange={onStateChange} />
      </div>
    </div>
  );
}

function ColumnsMenu({ state, onChange }: { state: ListColumnsState; onChange: (state: ListColumnsState) => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const hidden = new Set(state.hidden);

  return (
    <div ref={ref} className="relative normal-case tracking-normal">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`flex h-7 w-7 cursor-pointer items-center justify-center rounded-sm transition-colors hover:bg-surface-muted hover:text-foreground ${
          open ? "bg-surface-muted text-foreground" : ""
        }`}
        title={t("library:list.columnsMenu.button")}
        aria-label={t("library:list.columnsMenu.button")}
        aria-expanded={open}
      >
        <Columns3 size={14} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-64 max-w-[calc(100vw-2rem)] overflow-hidden rounded-sm border border-border-strong bg-surface shadow-xl">
          <p className="border-b border-border px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-foreground-subtle">
            {t("library:list.columnsMenu.title")}
          </p>
          <ul className="max-h-80 overflow-y-auto py-1">
            {state.order.map((id, index) => {
              const column = getListColumn(id);
              const label = t(column.labelKey);
              const checked = column.locked || !hidden.has(id);
              return (
                <li key={id} className="flex items-center gap-1 px-2 py-0.5">
                  <label
                    className={`flex min-w-0 flex-1 items-center gap-2 rounded-sm px-1.5 py-1.5 text-xs text-foreground ${
                      column.locked ? "cursor-default" : "cursor-pointer hover:bg-surface-muted"
                    }`}
                    title={column.locked ? t("library:list.columnsMenu.alwaysVisible") : undefined}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={column.locked}
                      onChange={() => onChange(toggleListColumn(state, id))}
                      className="h-3.5 w-3.5 cursor-pointer accent-primary disabled:cursor-default"
                    />
                    <span className={`truncate ${checked ? "" : "text-foreground-subtle"}`}>{label}</span>
                  </label>
                  {!column.locked && (
                    <>
                      <button
                        type="button"
                        onClick={() => onChange(moveListColumn(state, id, -1))}
                        disabled={index <= 1}
                        className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-sm text-foreground-subtle hover:bg-surface-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
                        aria-label={t("library:list.columnsMenu.moveUp", { column: label })}
                        title={t("library:list.columnsMenu.moveUp", { column: label })}
                      >
                        <ChevronUp size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onChange(moveListColumn(state, id, 1))}
                        disabled={index >= state.order.length - 1}
                        className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-sm text-foreground-subtle hover:bg-surface-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
                        aria-label={t("library:list.columnsMenu.moveDown", { column: label })}
                        title={t("library:list.columnsMenu.moveDown", { column: label })}
                      >
                        <ChevronDown size={13} />
                      </button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            onClick={() => onChange(DEFAULT_LIST_COLUMNS_STATE)}
            className="flex w-full cursor-pointer items-center gap-2 border-t border-border px-3 py-2 text-xs text-foreground-muted transition-colors hover:bg-surface-muted hover:text-foreground"
          >
            <RotateCcw size={13} />
            {t("library:list.columnsMenu.reset")}
          </button>
        </div>
      )}
    </div>
  );
}
