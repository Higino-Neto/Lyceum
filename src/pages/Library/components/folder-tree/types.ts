import type {
  FolderChangedPayload,
  FolderInfo,
  LibraryRootInfo,
  WatchFolderInfo,
} from "../../../../types/LibraryTypes";
import type { DocumentRecord } from "../../../../types/ReadingTypes";

export interface FolderTreeProps {
  selectedFolder: string | null;
  onFolderSelect: (folderPath: string | null) => void;
  localDocuments: DocumentRecord[];
  folderStructure?: FolderInfo[];
  libraryRoots?: LibraryRootInfo[];
  includeSubfolders?: boolean;
  onFoldersChanged?: () => Promise<void> | void;
  onMoveBook?: (fileHash: string, targetFolder: string | null) => Promise<boolean>;
  onMoveBooks?: (fileHashes: string[], targetFolder: string | null) => Promise<boolean>;
  draggingBookHash?: string | null;
  draggingBookHashes?: string[];
  onImportBook?: (targetFolder: string | null) => Promise<void>;
}

export interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  folder: FolderInfo | null;
}

export interface FlatFolderNode {
  folder: FolderInfo;
  depth: number;
  isExpanded: boolean;
  sourcePathLabel?: string;
  readOnly?: boolean;
}

export type FolderTreeListItem =
  | { kind: "root"; totalBooks: number; dropTarget: boolean }
  | { kind: "folder"; node: FlatFolderNode }
  | { kind: "create"; parentPath: string | null; depth: number }
  | { kind: "section"; id: string; label: string; onAdd?: () => void }
  | { kind: "watch"; folder: WatchFolderInfo; count: number | string };

export interface FolderTreeData {
  folders: FolderInfo[];
  libraryRoots: LibraryRootInfo[];
  watchFolders: WatchFolderInfo[];
  watchFolderCounts: Record<number, number>;
  isLoading: boolean;
  refreshFolders?: () => Promise<void>;
}

export type LoadFolderChildren = (folderPath: string | null) => Promise<FolderInfo[]>;

export type FolderChangedHandler = (payload: FolderChangedPayload) => void;
