import { createContext, useContext, type ReactNode } from "react";

export interface FolderTreeDragState {
  draggingFolder: string | null;
  draggingBooks: string[];
  dragOver: string | null;
  onFolderDragStart: (path: string) => void;
  onDragEnd: () => void;
  onDragOver: (path: string) => void;
  onDragLeave: () => void;
  onDrop: (targetPath: string) => void;
}

const FolderTreeDragContext = createContext<FolderTreeDragState | null>(null);

export function FolderTreeDragProvider({
  value,
  children,
}: {
  value: FolderTreeDragState;
  children: ReactNode;
}) {
  return (
    <FolderTreeDragContext.Provider value={value}>
      {children}
    </FolderTreeDragContext.Provider>
  );
}

export function useFolderTreeDrag() {
  const context = useContext(FolderTreeDragContext);
  if (!context) {
    throw new Error("useFolderTreeDrag must be used inside FolderTreeDragProvider");
  }
  return context;
}
