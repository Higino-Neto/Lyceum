import {
  ChevronsDown,
  ChevronsRight,
  FilePlus,
  FolderOpen,
  FolderPlus,
  HardDrive,
  MoreHorizontal,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { forwardRef, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "../../../../i18n";

/** Icon button footprint (26px button + 4px gap). */
const ACTION_SLOT_PX = 30;
/** Folder icon + gap, always visible. */
const LABEL_ICON_PX = 26;
/** Room the "FOLDERS" caption needs before it starts to truncate. */
const LABEL_TEXT_PX = 72;

interface ToolbarAction {
  id: string;
  title: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}

/**
 * Number of actions that fit inline; the rest go to an overflow menu. When
 * everything does not fit, one slot is reserved for the "more" button.
 */
function visibleActionCount(width: number, actionCount: number, withLabelText: boolean): number {
  if (width <= 0) return actionCount;
  const available = width - LABEL_ICON_PX - (withLabelText ? LABEL_TEXT_PX : 0);
  const slots = Math.max(0, Math.floor(available / ACTION_SLOT_PX));
  if (slots >= actionCount) return actionCount;
  return Math.max(0, slots - 1);
}

export default function FolderTreeToolbar({
  allExpanded,
  syncing,
  canAddSource,
  canImport,
  onCreateRoot,
  onImportRoot,
  onAddSource,
  onToggleExpandAll,
  onResync,
  onSmartSearch,
}: {
  allExpanded: boolean;
  syncing: boolean;
  canAddSource: boolean;
  canImport: boolean;
  onCreateRoot: () => void;
  onImportRoot: () => void;
  onAddSource: () => void;
  onToggleExpandAll: () => void;
  onResync: () => void;
  onSmartSearch?: () => void;
}) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    setWidth(element.clientWidth);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry?.contentRect.width ?? element.clientWidth));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Ordered by importance: the first ones stay inline the longest.
  const actions: ToolbarAction[] = [
    { id: "create", title: t("library:folderTree.create"), icon: <FolderPlus size={14} />, onClick: onCreateRoot },
    {
      id: "sync",
      title: syncing ? t("library:folderTree.syncing") : t("library:folderTree.sync"),
      icon: <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />,
      onClick: onResync,
      disabled: syncing,
    },
    {
      id: "expand",
      title: allExpanded ? t("library:folderTree.collapseAll") : t("library:folderTree.expandAll"),
      icon: allExpanded ? <ChevronsDown size={14} /> : <ChevronsRight size={14} />,
      onClick: onToggleExpandAll,
    },
    ...(canImport ? [{ id: "import", title: t("library:folderTree.addBook"), icon: <FilePlus size={14} />, onClick: onImportRoot }] : []),
    ...(canAddSource ? [{ id: "source", title: t("library:folderTree.addSourceFolder"), icon: <HardDrive size={14} />, onClick: onAddSource }] : []),
    ...(canAddSource && onSmartSearch
      ? [{ id: "smart", title: t("library:smartSearch.open"), icon: <Sparkles size={14} />, onClick: onSmartSearch }]
      : []),
  ];

  const fitsWithLabel = visibleActionCount(width, actions.length, true) === actions.length;
  const showLabelText = fitsWithLabel || width === 0 || width > LABEL_ICON_PX + LABEL_TEXT_PX + ACTION_SLOT_PX * 3;
  const inlineCount = visibleActionCount(width, actions.length, showLabelText);
  const inline = actions.slice(0, inlineCount);
  const overflow = actions.slice(inlineCount);

  return (
    <div ref={containerRef} className="flex min-w-0 items-center justify-between gap-1">
      <div className="flex min-w-0 items-center gap-2" title={t("library:folderTree.title")}>
        <FolderOpen size={16} className="flex-none text-foreground-subtle" />
        {showLabelText && (
          <span className="truncate text-xs font-medium uppercase tracking-wider text-foreground-muted">
            {t("library:folderTree.title")}
          </span>
        )}
      </div>
      <div className="flex flex-none items-center gap-1">
        {inline.map((action) => (
          <IconButton key={action.id} title={action.title} onClick={action.onClick} disabled={action.disabled}>
            {action.icon}
          </IconButton>
        ))}
        {overflow.length > 0 && <OverflowMenu actions={overflow} label={t("library:folderTree.moreActions")} />}
      </div>
    </div>
  );
}

function OverflowMenu({ actions, label }: { actions: ToolbarAction[]; label: string }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const toggle = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) setPosition({ top: rect.bottom + 4, left: rect.left });
    setOpen((value) => !value);
  };

  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      const target = event.target as Node | null;
      if (target && (menuRef.current?.contains(target) || buttonRef.current?.contains(target))) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("resize", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <IconButton ref={buttonRef} title={label} onClick={toggle} expanded={open}>
        <MoreHorizontal size={14} />
      </IconButton>
      {open && createPortal(
        <div
          ref={menuRef}
          role="menu"
          aria-label={label}
          className="fixed z-[200] min-w-48 overflow-hidden rounded-sm border border-border bg-overlay py-1 shadow-lg"
          style={{ top: position.top, left: position.left }}
        >
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              role="menuitem"
              disabled={action.disabled}
              onClick={() => {
                setOpen(false);
                action.onClick();
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs text-foreground hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="text-foreground-subtle">{action.icon}</span>
              {action.title}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}

const IconButton = forwardRef<HTMLButtonElement, {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  expanded?: boolean;
  children: ReactNode;
}>(function IconButton({ title, onClick, disabled, expanded, children }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-expanded={expanded}
      className="flex-none cursor-pointer rounded-sm p-1.5 text-foreground-subtle transition-colors hover:bg-surface-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
      title={title}
      aria-label={title}
    >
      {children}
    </button>
  );
});
