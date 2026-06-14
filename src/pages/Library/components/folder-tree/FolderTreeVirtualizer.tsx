import { useRef, type MutableRefObject, type ReactNode } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { FolderTreeListItem } from "./types";

export default function FolderTreeVirtualizer({
  items,
  renderItem,
}: {
  items: FolderTreeListItem[];
  renderItem: (item: FolderTreeListItem, index: number) => ReactNode;
}) {
  const parentRef = useRef<HTMLDivElement | null>(null);

  if (items.length <= 80) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto px-1 py-2">
        {items.map((item, index) => (
          <div key={itemKey(item, index)} className="mb-0.5">
            {renderItem(item, index)}
          </div>
        ))}
      </div>
    );
  }

  return (
    <VirtualizedList parentRef={parentRef} items={items} renderItem={renderItem} />
  );
}

function VirtualizedList({
  parentRef,
  items,
  renderItem,
}: {
  parentRef: MutableRefObject<HTMLDivElement | null>;
  items: FolderTreeListItem[];
  renderItem: (item: FolderTreeListItem, index: number) => ReactNode;
}) {
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => (items[index]?.kind === "section" ? 34 : 36),
    overscan: 8,
  });

  return (
    <div ref={parentRef} className="min-h-0 flex-1 overflow-y-auto px-1 py-2">
      <div
        className="relative w-full"
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const item = items[virtualRow.index];
          return (
            <div
              key={itemKey(item, virtualRow.index)}
              className="absolute left-0 top-0 w-full"
              style={{ transform: `translateY(${virtualRow.start}px)` }}
            >
              {renderItem(item, virtualRow.index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function itemKey(item: FolderTreeListItem, index: number) {
  if (item.kind === "folder") return `folder:${item.node.folder.path}`;
  if (item.kind === "watch") return `watch:${item.folder.id}`;
  if (item.kind === "create") return `create:${item.parentPath ?? "root"}`;
  if (item.kind === "section") return `section:${item.id}`;
  return `root:${index}`;
}
