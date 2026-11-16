import { useCallback } from "react";
import type { ChapterNode, ChapterTracker } from "./useChapterTracker";
import { Check, ChevronDown, ChevronRight } from "lucide-react";
import { useTranslation } from "../../../../../i18n";
import { useResizablePanel } from "../../../../../hooks/useResizablePanel";
import PanelResizeHandle from "../../../../../components/ui/PanelResizeHandle";

const MIN_SIDEBAR_WIDTH = 220;
const MAX_SIDEBAR_WIDTH = 640;
const DEFAULT_SIDEBAR_WIDTH = 288;
const SIDEBAR_WIDTH_KEY = "lyceum:pdf-chapters-width";

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
  const { t } = useTranslation();
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
        className="group flex items-center gap-1.5 py-1 pr-2 text-[12px] leading-tight hover:bg-surface-muted/60"
        style={{ paddingLeft: `${8 + node.depth * 14}px` }}
      >
        <button
          type="button"
          onClick={handleToggleExpanded}
          aria-label={
            isExpanded
              ? t("pdf:chapters.collapseAriaLabel")
              : t("pdf:chapters.expandAriaLabel")
          }
          className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-sm text-foreground-muted transition-colors ${
            node.hasChildren
              ? "hover:bg-border-strong hover:text-foreground"
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
          aria-label={
            isRead
              ? t("pdf:chapters.markUnreadAriaLabel")
              : t("pdf:chapters.markReadAriaLabel")
          }
          className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-sm border text-[11px] transition-colors ${
            isRead
              ? "border-border-strong bg-primary text-primary-foreground"
              : "border-border-strong text-transparent hover:border-border-strong"
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
                ? t("pdf:chapters.goToPageTitle", { page: node.page })
                : t("pdf:chapters.unknownPage")
            }
            className={`min-w-0 flex-1 truncate text-left transition-colors ${
              isRead ? "text-foreground-subtle line-through" : "text-foreground"
            } ${node.page ? "hover:text-primary" : "cursor-default"}`}
          >
            {node.title
              .replace(/\uFFFD/g, "")
              // eslint-disable-next-line no-control-regex -- strips control characters from PDF outline titles
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
  const { t } = useTranslation();
  const {
    outline,
    loading,
    error,
    hasOutline,
    totalCount,
    readCount,
    progress,
  } = tracker;

  const resize = useResizablePanel({
    storageKey: SIDEBAR_WIDTH_KEY,
    defaultWidth: DEFAULT_SIDEBAR_WIDTH,
    minWidth: MIN_SIDEBAR_WIDTH,
    maxWidth: MAX_SIDEBAR_WIDTH,
    edge: "right",
  });
  const width = resize.width;

  return (
    <aside
      className="relative flex h-full flex-shrink-0 flex-col border-r border-border bg-surface"
      style={{ width: `${width}px` }}
    >
      <PanelResizeHandle
        edge="right"
        label={t("pdf:chapters.resizeAriaLabel")}
        width={width}
        minWidth={MIN_SIDEBAR_WIDTH}
        maxWidth={MAX_SIDEBAR_WIDTH}
        isResizing={resize.isResizing}
        onPointerDown={resize.startResize}
        onKeyDown={resize.handleKeyDown}
      />
      {/* <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-foreground">
          Capítulos
        </span>
      </div> */}

      {hasOutline && (
        <div className="flex gap-3 border-b border-border px-3 py-2">
          <div className="w-full">
            <div className="mb-1 flex items-center justify-between text-[11px] text-foreground-muted">
              <span>
                {readCount}/{totalCount}
              </span>
              <span>{progress}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("pdf:chapters.closeAriaLabel")}
            className="flex h-6 w-6 items-center justify-center rounded-sm text-foreground-muted hover:bg-surface-muted hover:text-foreground"
          >
            ✕
          </button>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto py-1">
        {loading && (
          <p className="px-3 py-4 text-xs text-foreground-subtle">
            {t("pdf:chapters.loading")}
          </p>
        )}

        {!loading && error && (
          <p className="px-3 py-4 text-xs text-destructive">{error}</p>
        )}

        {!loading && !error && !hasOutline && (
          <p className="px-3 py-4 text-xs text-foreground-subtle">
            {t("pdf:chapters.empty")}
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
