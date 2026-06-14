import { useCallback, useMemo, useState } from "react";

export interface FolderDragDropState {
  draggedBooks: string[];
  dropTarget: string | null;
  isDraggingBooks: boolean;
  startBookDrag: (fileHashes: string[]) => void;
  clearDrag: () => void;
  setDropTarget: (targetFolder: string | null) => void;
}

export function useFolderDragDrop(): FolderDragDropState {
  const [draggedBooks, setDraggedBooks] = useState<string[]>([]);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const startBookDrag = useCallback((fileHashes: string[]) => {
    setDraggedBooks([...new Set(fileHashes)].filter(Boolean));
  }, []);

  const clearDrag = useCallback(() => {
    setDraggedBooks([]);
    setDropTarget(null);
  }, []);

  return useMemo(
    () => ({
      draggedBooks,
      dropTarget,
      isDraggingBooks: draggedBooks.length > 0,
      startBookDrag,
      clearDrag,
      setDropTarget,
    }),
    [clearDrag, draggedBooks, dropTarget, startBookDrag],
  );
}
