import type { CSSProperties, MouseEvent } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { BookOpen, ExternalLink, FileText, X } from "lucide-react";
import { DocumentTab } from "../../types/DocumentTab";

interface BaseTabProps {
  tab: DocumentTab;
  isActive: boolean;
}

interface TabItemProps extends BaseTabProps {
  onActivate: () => void;
  onClose: () => void;
  onDetach?: () => void;
}

function TabVisual({
  tab,
  isActive,
  onActivate,
  onClose,
  onDetach,
  dragStyle,
  dragAttributes,
  dragListeners,
  isDragging = false,
}: BaseTabProps & {
  onActivate?: () => void;
  onClose?: () => void;
  onDetach?: () => void;
  dragStyle?: CSSProperties;
  dragAttributes?: Record<string, any>;
  dragListeners?: Record<string, any>;
  isDragging?: boolean;
}) {
  const Icon = tab.fileType === "pdf" ? FileText : BookOpen;
  const iconColor = tab.fileType === "pdf" ? "text-red-400" : "text-blue-400";

  const handleClose = (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    onClose?.();
  };

  const handleDetach = (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    onDetach?.();
  };

  return (
    <button
      type="button"
      style={dragStyle}
      onClick={onActivate}
      {...dragAttributes}
      {...dragListeners}
      className={[
        "group flex h-full min-w-[150px] max-w-[240px] flex-shrink-0 items-center gap-2 border-r border-zinc-700 px-3 text-left transition-colors duration-150",
        isActive
          ? "bg-zinc-800 text-zinc-100 border-t-2 border-t-green-500"
          : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200",
        isDragging ? "cursor-grabbing opacity-50" : "cursor-grab",
      ].join(" ")}
    >
      <Icon size={14} className={iconColor} />

      <span className="flex-1 truncate text-sm" title={tab.fileName}>
        {tab.fileName}
      </span>

      {onDetach && (
        <span className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <span
            role="button"
            tabIndex={-1}
            onClick={handleDetach}
            className="rounded p-0.5 hover:bg-zinc-700"
            title="Abrir em nova janela"
          >
            <ExternalLink size={12} />
          </span>
        </span>
      )}

      {onClose && (
        <span
          role="button"
          tabIndex={-1}
          onClick={handleClose}
          className="rounded p-0.5 opacity-0 transition-opacity hover:bg-zinc-700 group-hover:opacity-100"
          title="Fechar"
        >
          <X size={14} />
        </span>
      )}
    </button>
  );
}

export function TabDragPreview({ tab, isActive }: BaseTabProps) {
  return (
    <div className="h-10 shadow-2xl">
      <TabVisual tab={tab} isActive={isActive} />
    </div>
  );
}

export default function TabItem({
  tab,
  isActive,
  onActivate,
  onClose,
  onDetach,
}: TabItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tab.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} className="h-full flex-shrink-0">
      <TabVisual
        tab={tab}
        isActive={isActive}
        onActivate={onActivate}
        onClose={onClose}
        onDetach={onDetach}
        dragStyle={style}
        dragAttributes={attributes}
        dragListeners={listeners}
        isDragging={isDragging}
      />
    </div>
  );
}
