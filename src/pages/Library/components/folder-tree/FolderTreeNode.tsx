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

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightMatch(text: string, term: string) {
  if (!term) return text;
  const parts = text.split(new RegExp(`(${escapeRegExp(term)})`, "gi"));
  return parts.map((part, index) =>
    part.toLowerCase() === term.toLowerCase() ? (
      <span key={index} className="bg-green-500/30 text-green-300">
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
  searchTerm: string;
  isRenaming: boolean;
  renameValue: string;
  folderBookCount: number;
  totalBooks: number;
  subfoldersBooks: number;
  onSelect: (path: string | null) => void;
  onToggleExpand: (folder: FolderInfo, event: MouseEvent) => void;
  onContextMenu: (event: MouseEvent, folder: FolderInfo) => void;
  onRenameChange: (value: string) => void;
  onRenameSubmit: () => void;
  onRenameCancel: () => void;
}) {
  const drag = useFolderTreeDrag();
  const { folder, depth, isExpanded, sourcePathLabel, readOnly } = node;
  const hasChildren = folder.hasChildren || folder.subfolders.length > 0;
  const isSelected = folder.path === selectedPath;
  const isDropTarget = drag.dragOver === folder.path;
  const isDragging = drag.draggingFolder === folder.fullPath;

  return (
    <div
      className={`group flex cursor-pointer items-center gap-1.5 rounded-sm transition-colors ${
        isSelected
          ? "bg-zinc-800 text-zinc-100"
          : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
      } ${isDropTarget ? "bg-green-500/10 text-green-100 ring-1 ring-green-500" : ""} ${
        isDragging ? "opacity-50" : ""
      }`}
      style={{
        paddingLeft: `${depth * 16 + 8}px`,
        paddingRight: 8,
        paddingTop: 6,
        paddingBottom: 6,
      }}
      onClick={() => !isRenaming && onSelect(folder.path)}
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
          className="cursor-pointer rounded-sm p-0.5 hover:bg-zinc-700 hover:text-zinc-200"
        >
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
      ) : (
        <span className="w-5" />
      )}

      {sourcePathLabel ? (
        <HardDrive size={15} className={isSelected ? "text-green-400" : "text-zinc-500"} />
      ) : folderBookCount > 0 ? (
        <FolderOpen size={15} className={isSelected ? "text-green-400" : "text-green-500"} />
      ) : (
        <Folder size={15} className={totalBooks > 0 ? "text-zinc-500" : "text-zinc-600"} />
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
            <span className="mt-0.5 block truncate text-[10px] leading-3 text-zinc-500" title={sourcePathLabel}>
              {sourcePathLabel}
            </span>
          )}
        </span>
      )}

      <div className={`flex items-center gap-1 text-xs ${isSelected ? "text-zinc-300" : "text-zinc-500"}`}>
        {subfoldersBooks > 0 && (
          <span className="text-[10px]" title={`${folderBookCount} neste local, ${subfoldersBooks} em subpastas`}>
            +{subfoldersBooks}
          </span>
        )}
        <span className={`rounded-sm px-1.5 py-0.5 ${isSelected ? "bg-zinc-700 text-zinc-300" : "bg-zinc-800"}`}>
          {totalBooks}
        </span>
        {!readOnly && (
          <button
            onClick={(event) => {
              event.stopPropagation();
              onContextMenu(event, folder);
            }}
            className="rounded-sm p-0.5 opacity-0 transition-opacity hover:bg-zinc-700 group-hover:opacity-100"
          >
            <MoreVertical size={12} />
          </button>
        )}
      </div>
    </div>
  );
}
