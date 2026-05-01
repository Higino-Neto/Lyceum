import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { useTabContext } from "../../contexts/TabContext";
import TabItem, { TabDragPreview } from "./TabItem";

interface TabBarProps {
  onOpenFile?: () => void;
}

export default function TabBar({ onOpenFile }: TabBarProps) {
  const { tabs, activeTabId, setActiveTab, removeTab, reorderTabs, detachTab } =
    useTabContext();
  const [draggingTabId, setDraggingTabId] = useState<string | null>(null);
  const tabStripRef = useRef<HTMLDivElement | null>(null);
  const pointerPositionRef = useRef<{ x: number; y: number } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (!draggingTabId) {
      pointerPositionRef.current = null;
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      pointerPositionRef.current = { x: event.clientX, y: event.clientY };
    };

    window.addEventListener("pointermove", handlePointerMove);
    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, [draggingTabId]);

  const activeDraggedTab = useMemo(
    () => tabs.find((tab) => tab.id === draggingTabId) ?? null,
    [draggingTabId, tabs]
  );
  const tabMinWidth = tabs.length >= 12 ? 72 : tabs.length >= 8 ? 88 : tabs.length >= 5 ? 104 : 112;

  const shouldDetachDraggedTab = useCallback((tabId: string) => {
    const rect = tabStripRef.current?.getBoundingClientRect();
    const pointer = pointerPositionRef.current;

    if (!rect || !pointer) {
      return false;
    }

    const margin = 24;
    const outsideTabStrip =
      pointer.x < rect.left - margin ||
      pointer.x > rect.right + margin ||
      pointer.y < rect.top - margin ||
      pointer.y > rect.bottom + margin;

    if (!outsideTabStrip) {
      return false;
    }

    void detachTab(tabId);
    return true;
  }, [detachTab]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setDraggingTabId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const activeId = event.active.id as string;
      const overId = event.over?.id as string | undefined;

      setDraggingTabId(null);

      if (!activeId) {
        return;
      }

      if (shouldDetachDraggedTab(activeId)) {
        return;
      }

      if (overId && activeId !== overId) {
        reorderTabs(activeId, overId);
      }
    },
    [reorderTabs, shouldDetachDraggedTab]
  );

  const handleDragCancel = useCallback(() => {
    setDraggingTabId(null);
  }, []);

  const handleOpenFileClick = useCallback(() => {
    onOpenFile?.();
  }, [onOpenFile]);

  return (
    <div className="flex h-10 items-center overflow-hidden rounded-sm border border-zinc-800 bg-zinc-900">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div ref={tabStripRef} className="flex h-full min-w-0 flex-1 items-center overflow-hidden">
          <SortableContext
            items={tabs.map((tab) => tab.id)}
            strategy={horizontalListSortingStrategy}
          >
            <div className="flex h-full w-fit min-w-0 max-w-full flex-shrink items-center overflow-hidden">
              {tabs.map((tab) => (
                <TabItem
                  key={tab.id}
                  tab={tab}
                  minWidth={tabMinWidth}
                  isActive={tab.id === activeTabId}
                  onActivate={() => setActiveTab(tab.id)}
                  onClose={() => removeTab(tab.id)}
                  onDetach={() => void detachTab(tab.id)}
                />
              ))}
            </div>
          </SortableContext>

          <div className="relative flex h-full flex-shrink-0 items-center border-r border-zinc-700 px-1">
            <button
              type="button"
              onClick={handleOpenFileClick}
              className="flex h-8 w-8 items-center justify-center rounded transition-colors hover:bg-zinc-700"
              title="Abrir arquivo"
            >
              <Plus size={18} className="text-zinc-400" />
            </button>
          </div>
        </div>

        <DragOverlay>
          {activeDraggedTab ? (
            <TabDragPreview
              tab={activeDraggedTab}
              isActive={activeDraggedTab.id === activeTabId}
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
