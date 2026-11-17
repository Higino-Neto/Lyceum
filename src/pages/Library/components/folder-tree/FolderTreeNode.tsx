import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  HardDrive,
  MoreVertical,
} from "lucide-react";
import type { MouseEvent } from "react";
import type { FolderInfo } from "../../../../types/LibraryTypes";
import type { FlatFolderNode } from "./types";
import { useFolderTreeDrag } from "./FolderTreeDragContext";
import FolderInlineRename from "./FolderInlineRename";
import { translate } from "../../../../i18n";

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightMatch(text: string, term: string) {
  if (!term) return text;
  const parts = text.split(new RegExp(`(${escapeRegExp(term)})`, "gi"));
  return parts.map((part, index) =>
    part.toLowerCase() === term.toLowerCase() ? (
      <span key={index} className="bg-primary-muted text-primary">
        {part}
      </span>
    ) : (
      part
    ),
  );
}

export default function FolderTreeNode({
  node,
  selectedPath,
  isMultiSelected = false,
  searchTerm,
  isRenaming,
  renameValue,
  folderBookCount,
  totalBooks,
  subfoldersBooks,
  onSelect,
  onToggleExpand,
  onContextMenu,
  onRenameChange,
  onRenameSubmit,
  onRenameCancel,
}: {
  node: FlatFolderNode;
  selectedPath: string | null;
  isMultiSelected?: boolean;
  searchTerm: string;
  isRenaming: boolean;
  renameValue: string;
  folderBookCount: number;
  totalBooks: number;
  subfoldersBooks: number;
  onSelect: (folder: FolderInfo, event: MouseEvent) => void;
  onToggleExpand: (folder: FolderInfo, event: MouseEvent) => void;
  onContextMenu: (event: MouseEvent, folder: FolderInfo) => void;
  onRenameChange: (value: string) => void;
  onRenameSubmit: () => void;
  onRenameCancel: () => void;
}) {
  const drag = useFolderTreeDrag();
  const { folder, depth, isExpanded, sourcePathLabel, readOnly } = node;
  const hasChildren = folder.hasChildren || folder.subfolders.length > 0;
  const isSelected = folder.path === selectedPath || isMultiSelected;
  const isDropTarget = drag.dragOver === folder.path;
  const isDragging = drag.draggingFolder === folder.fullPath;

  return (
    <div
      className={`group flex cursor-pointer items-center gap-1.5 rounded-sm transition-colors ${
        isMultiSelected
          ? "bg-primary-muted text-foreground"
          : isSelected
            ? "bg-surface-muted text-foreground"
            : "text-foreground-muted hover:bg-surface-muted/50 hover:text-foreground"
      } ${isDropTarget ? "bg-primary-muted text-primary ring-1 ring-focus-ring" : ""} ${
        isDragging ? "opacity-50" : ""
      }`}
      style={{
        paddingLeft: `${depth * 16 + 8}px`,
        paddingRight: 8,
        paddingTop: 6,
        paddingBottom: 6,
      }}
      aria-selected={isSelected}
      onClick={(event) => !isRenaming && onSelect(folder, event)}
      onContextMenu={(event) => {
        if (!readOnly) onContextMenu(event, folder);
      }}
      draggable={!isRenaming && !readOnly}
      onDragStart={(event) => {
        if (readOnly) return;
        event.dataTransfer.setData("text/plain", folder.fullPath);
        drag.onFolderDragStart(folder.fullPath);
      }}
      onDragEnd={drag.onDragEnd}
      onDragOver={(event) => {
        if (readOnly) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        drag.onDragOver(folder.path);
      }}
      onDragLeave={drag.onDragLeave}
      onDrop={(event) => {
        if (readOnly) return;
        event.preventDefault();
        drag.onDrop(folder.path);
      }}
    >
      {hasChildren ? (
        <button
          onClick={(event) => onToggleExpand(folder, event)}
          className="cursor-pointer rounded-sm p-0.5 hover:bg-border-strong hover:text-foreground"
        >
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
      ) : (
        <span className="w-5" />
      )}

      {sourcePathLabel ? (
        <HardDrive size={15} className={isSelected ? "text-primary" : "text-foreground-subtle"} />
      ) : folderBookCount > 0 ? (
        <FolderOpen size={15} className={isSelected ? "text-primary" : "text-primary"} />
      ) : (
        <Folder size={15} className={totalBooks > 0 ? "text-foreground-subtle" : "text-foreground-subtle"} />
      )}

      {isRenaming && !readOnly ? (
        <FolderInlineRename
          value={renameValue}
          onChange={onRenameChange}
          onSubmit={onRenameSubmit}
          onCancel={onRenameCancel}
        />
      ) : (
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm">
            {highlightMatch(folder.name, searchTerm)}
          </span>
          {sourcePathLabel && (
            <span className="mt-0.5 block truncate text-[10px] leading-3 text-foreground-subtle" title={sourcePathLabel}>
              {sourcePathLabel}
            </span>
          )}
        </span>
      )}

      <div className={`flex items-center gap-1 text-xs ${isSelected ? "text-foreground" : "text-foreground-subtle"}`}>
        {subfoldersBooks > 0 && (
          <span className="text-[10px]" title={translate("library:folderTree.countBreakdown", { here: folderBookCount, nested: subfoldersBooks })}>
            +{subfoldersBooks}
          </span>
        )}
        <span className={`rounded-sm px-1.5 py-0.5 ${isSelected ? "bg-border-strong text-foreground" : "bg-surface-muted"}`}>
          {totalBooks}
        </span>
        {!readOnly && (
          <button
            onClick={(event) => {
              event.stopPropagation();
              onContextMenu(event, folder);
            }}
            className="rounded-sm p-0.5 opacity-0 transition-opacity hover:bg-border-strong group-hover:opacity-100"
          >
            <MoreVertical size={12} />
          </button>
        )}
      </div>
    </div>
  );
}
