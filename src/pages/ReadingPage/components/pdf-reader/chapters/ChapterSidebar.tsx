import { useCallback, useEffect, useRef, useState } from "react";
import type { ChapterNode, ChapterTracker } from "./useChapterTracker";
import { Check, ChevronDown, ChevronRight } from "lucide-react";

const MIN_SIDEBAR_WIDTH = 220;
const MAX_SIDEBAR_WIDTH = 640;
const DEFAULT_SIDEBAR_WIDTH = 288;
const SIDEBAR_WIDTH_KEY = "lyceum:pdf-chapters-width";

function loadSidebarWidth(): number {
  try {
    const raw = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    if (!raw) {
      return DEFAULT_SIDEBAR_WIDTH;
    }
    const parsed = Number(JSON.parse(raw));
    if (!Number.isFinite(parsed)) {
      return DEFAULT_SIDEBAR_WIDTH;
    }
    return Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, parsed));
  } catch {
    return DEFAULT_SIDEBAR_WIDTH;
  }
}

function saveSidebarWidth(width: number): void {
  try {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, JSON.stringify(width));
  } catch {
    // Best-effort persistence.
  }
}

interface ChapterSidebarProps {
  tracker: ChapterTracker;
  onClose: () => void;
}

function ChapterRow({
  node,
  tracker,
}: {
  node: ChapterNode;
  tracker: ChapterTracker;
}) {
  const isRead = !!tracker.readMap[node.id];
  const isExpanded = !!tracker.expandedMap[node.id];

  const handleToggleRead = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      tracker.toggleRead(node.id);
    },
    [node.id, tracker],
  );

  const handleToggleExpanded = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      if (node.hasChildren) {
        tracker.toggleExpanded(node.id);
      }
    },
    [node.hasChildren, node.id, tracker],
  );

  const handleNavigate = useCallback(() => {
    if (node.page) {
      tracker.goToPage(node.page);
    }
  }, [node.page, tracker]);

  // const isVerified = (node.id) => {

  // }


  return (
    <li>
      <div
        className="group flex items-center gap-1.5 py-1 pr-2 text-[12px] leading-tight hover:bg-zinc-800/60"
        style={{ paddingLeft: `${8 + node.depth * 14}px` }}
      >
        <button
          type="button"
          onClick={handleToggleExpanded}
          aria-label={isExpanded ? "Recolher" : "Expandir"}
          className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-sm text-zinc-400 transition-colors ${
            node.hasChildren
              ? "hover:bg-zinc-700 hover:text-zinc-100"
              : "cursor-default opacity-0"
          }`}
          tabIndex={node.hasChildren ? 0 : -1}
        >
          <span className="text-[10px]">
            {isExpanded ? (
              <ChevronDown
                strokeWidth={2}
                color="oklch(70.5% 0.015 286.067)"
                size={16}
              />
            ) : (
              <ChevronRight
                strokeWidth={2}
                color="oklch(70.5% 0.015 286.067)"
                size={16}
              />
            )}
          </span>
        </button>

        <button
          type="button"
          onClick={handleToggleRead}
          aria-pressed={isRead}
          aria-label={isRead ? "Marcar como não lido" : "Marcar como lido"}
          className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-sm border text-[11px] transition-colors ${
            isRead
              ? "border-zinc-600 bg-green-500 text-zinc-700"
              : "border-zinc-600 text-transparent hover:border-zinc-400"
          }`}
        >
          <Check strokeWidth={3} />
         
        </button>

        <div className="w-full flex gap-2 truncate">
          <button
            type="button"
            onClick={handleNavigate}
            disabled={!node.page}
            title={
              node.page
                ? `Ir para a página ${node.page}`
                : "Página desconhecida"
            }
            className={`min-w-0 flex-1 truncate text-left transition-colors ${
              isRead ? "text-zinc-500 line-through" : "text-zinc-200"
            } ${node.page ? "hover:text-green-200" : "cursor-default"}`}
          >
            {node.title
              .replace(/\uFFFD/g, "")
              .replace(/[\u0000-\u001F\u007F]/g, "")}
          </button>
          <div className="flex justify-end">{node.page}</div>
        </div>
      </div>

      {node.hasChildren && isExpanded && (
        <ul>
          {node.children.map((child) => (
            <ChapterRow key={child.id} node={child} tracker={tracker} />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function ChapterSidebar({
  tracker,
  onClose,
}: ChapterSidebarProps) {
  const {
    outline,
    loading,
    error,
    hasOutline,
    totalCount,
    readCount,
    progress,
  } = tracker;

  const [width, setWidth] = useState<number>(loadSidebarWidth);
  const [isResizing, setIsResizing] = useState(false);
  const widthRef = useRef(width);
  widthRef.current = width;

  useEffect(() => {
    saveSidebarWidth(width);
  }, [width]);

  const handleResizeStart = useCallback((event: React.PointerEvent) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = widthRef.current;
    setIsResizing(true);

    const handleMove = (moveEvent: PointerEvent) => {
      const delta = moveEvent.clientX - startX;
      const next = Math.min(
        MAX_SIDEBAR_WIDTH,
        Math.max(MIN_SIDEBAR_WIDTH, startWidth + delta),
      );
      setWidth(next);
    };

    const handleUp = () => {
      setIsResizing(false);
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
  }, []);

  return (
    <aside
      className="relative flex h-full flex-shrink-0 flex-col border-r border-zinc-800 bg-zinc-900"
      style={{ width: `${width}px` }}
    >
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Redimensionar painel de capítulos"
        onPointerDown={handleResizeStart}
        className="absolute right-0 top-0 z-10 h-full w-2 cursor-col-resize bg-transparent transition-colors"
      />
      {isResizing && (
        <div className="fixed inset-0 z-50 cursor-col-resize" />
      )}
      {/* <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-300">
          Capítulos
        </span>
      </div> */}

      {hasOutline && (
        <div className="flex gap-3 border-b border-zinc-800 px-3 py-2">
          <div className="w-full">
            <div className="mb-1 flex items-center justify-between text-[11px] text-zinc-400">
              <span>
                {readCount}/{totalCount}
              </span>
              <span>{progress}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full rounded-full bg-green-500/80 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar painel de capítulos"
            className="flex h-6 w-6 items-center justify-center rounded-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          >
            ✕
          </button>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto py-1">
        {loading && (
          <p className="px-3 py-4 text-xs text-zinc-500">
            Carregando capítulos…
          </p>
        )}

        {!loading && error && (
          <p className="px-3 py-4 text-xs text-red-300">{error}</p>
        )}

        {!loading && !error && !hasOutline && (
          <p className="px-3 py-4 text-xs text-zinc-500">
            Este PDF não possui capítulos ou bookmarks.
          </p>
        )}

        {!loading && hasOutline && outline && (
          <ul>
            {outline.map((node) => (
              <ChapterRow key={node.id} node={node} tracker={tracker} />
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
