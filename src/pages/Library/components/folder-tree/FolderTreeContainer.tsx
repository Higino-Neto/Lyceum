import { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Folder, FolderPlus, RefreshCw, X } from "lucide-react";
import toast from "react-hot-toast";
import type { FolderInfo, ReadingStatus } from "../../../../types/LibraryTypes";
import {
  LIBRARY_STATUS_FILTER_VALUES,
  READING_STATUS_LABEL_KEYS,
} from "../../../../lib/readingStatus";
import { useOptionalLibraryContext } from "../../../../contexts/LibraryContext";
import {
  folderChildrenQueryKey,
  useFolderChildrenQuery,
} from "../../../../hooks/useFolderTreeQuery";
import FolderContextMenu from "../FolderContextMenu";
import FolderInlineCreate from "./FolderInlineCreate";
import FolderTreeDeleteDialog from "./FolderTreeDeleteDialog";
import { FolderTreeDragProvider } from "./FolderTreeDragContext";
import FolderTreeEmpty from "./FolderTreeEmpty";
import FolderTreeFooter from "./FolderTreeFooter";
import FolderTreeNode from "./FolderTreeNode";
import FolderTreeSearch from "./FolderTreeSearch";
import FolderTreeSection from "./FolderTreeSection";
import FolderTreeToolbar from "./FolderTreeToolbar";
import FolderTreeVirtualizer from "./FolderTreeVirtualizer";
import {
  collectExpandablePaths,
  buildFolderBookCountIndex,
  countBooksFromIndex,
  filterFolders,
  flattenTree,
  normalizeAbsolutePath,
  updateFolderChildren,
  visibleFolders,
  withCreateRows,
} from "./folderTreeUtils";
import type {
  ContextMenuState,
  FolderTreeData,
  FolderTreeListItem,
  FolderTreeProps,
  LoadFolderChildren,
} from "./types";
import { useTranslation } from "../../../../i18n";

const STATUS_DOT: Record<ReadingStatus, string> = {
  reading: "bg-primary",
  want_to_read: "bg-foreground-muted",
  read: "bg-primary",
  paused: "bg-warning",
  not_a_book: "bg-border-strong",
  unknown: "bg-border-strong",
};

const EXPANDED_PATHS_STORAGE_KEY = "lyceum_library_folderTreeExpandedPaths";

function readExpandedPaths() {
  try {
    const value = JSON.parse(window.localStorage.getItem(EXPANDED_PATHS_STORAGE_KEY) || "[]");
    return new Set<string>(Array.isArray(value) ? value.filter((path): path is string => typeof path === "string") : []);
  } catch {
    return new Set<string>();
  }
}

export default function FolderTree(props: FolderTreeProps) {
  const libraryContext = useOptionalLibraryContext();

  if (props.folderStructure) {
    return (
      <FolderTreeContainer
        {...props}
        data={{
          folders: visibleFolders(props.folderStructure),
          libraryRoots: libraryContext?.libraryRoots ?? props.libraryRoots ?? [],
          watchFolders: libraryContext?.watchFolders ?? [],
          watchFolderCounts: libraryContext?.watchFolderCounts ?? {},
          isLoading: libraryContext?.isLoading ?? false,
          refreshFolders: libraryContext?.refreshFolders,
        }}
      />
    );
  }

  return <FolderTreeFromQueries {...props} />;
}

function FolderTreeFromQueries(props: FolderTreeProps) {
  const libraryContext = useOptionalLibraryContext();
  const queryClient = useQueryClient();
  const rootChildren = useFolderChildrenQuery(null);
  const libraryRoots = libraryContext?.libraryRoots ?? props.libraryRoots ?? [];
  const sourceRootFolders = useMemo(
    () =>
      libraryRoots
        .filter((root) => root.type === "source")
        .map((root) => ({
          name: root.label,
          path: root.path,
          fullPath: root.path,
          bookCount: 0,
          subfolders: [],
          hasChildren: true,
          isLoaded: false,
        })),
    [libraryRoots],
  );
  const loadChildren = useCallback<LoadFolderChildren>(
    (folderPath) =>
      queryClient.fetchQuery({
        queryKey: folderChildrenQueryKey(folderPath),
        queryFn: () => window.api.getFolderChildren(folderPath),
        staleTime: 30_000,
      }),
    [queryClient],
  );

  return (
    <FolderTreeContainer
      {...props}
      data={{
        folders: [...visibleFolders(rootChildren.data ?? []), ...sourceRootFolders],
        libraryRoots,
        watchFolders: libraryContext?.watchFolders ?? [],
        watchFolderCounts: libraryContext?.watchFolderCounts ?? {},
        isLoading: Boolean(libraryContext?.isLoading || rootChildren.isLoading),
        refreshFolders: libraryContext?.refreshFolders,
      }}
      loadChildren={loadChildren}
    />
  );
}

function FolderTreeContainer({
  selectedFolder,
  onFolderSelect,
  localDocuments = [],
  folderBookCounts = {},
  includeSubfolders = false,
  onFoldersChanged,
  onMoveBook,
  onMoveBooks,
  draggingBookHash,
  draggingBookHashes = [],
  onImportBook,
  onDissolveFolder,
  visibleStatuses = [],
  onToggleStatus,
  data,
  loadChildren,
}: FolderTreeProps & { data: FolderTreeData; loadChildren?: LoadFolderChildren }) {
  const { t } = useTranslation();
  const libraryContext = useOptionalLibraryContext();
  const [folders, setFolders] = useState<FolderInfo[]>(data.folders);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => {
    const saved = readExpandedPaths();
    if (saved.size > 0) return saved;
    return collectExpandablePaths(data.folders);
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0, folder: null });
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [creatingFolderAt, setCreatingFolderAt] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [draggingFolder, setDraggingFolder] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [libraryPath, setLibraryPath] = useState("");
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; folder: FolderInfo | null }>({ open: false, folder: null });
  const draggingBooks = draggingBookHashes.length > 0 ? draggingBookHashes : draggingBookHash ? [draggingBookHash] : [];
  const sourceRoots = useMemo(() => data.libraryRoots.filter((root) => root.type === "source"), [data.libraryRoots]);
  const sourceRootPaths = useMemo(
    () => new Set(sourceRoots.map((root) => normalizeAbsolutePath(root.path))),
    [sourceRoots],
  );

  useEffect(() => {
    setFolders(visibleFolders(data.folders));
    // Don't auto-expand on data change if user has saved expanded paths
    // Only auto-expand if no paths are saved
    setExpandedPaths((current) => {
      if (current.size > 0) return current;
      return collectExpandablePaths(data.folders);
    });
  }, [data.folders]);

  useEffect(() => {
    try {
      window.localStorage.setItem(EXPANDED_PATHS_STORAGE_KEY, JSON.stringify([...expandedPaths]));
    } catch {
      // Storage can be unavailable in restricted environments.
    }
  }, [expandedPaths]);

  // Load children for expanded folders that haven't been loaded yet
  useEffect(() => {
    if (!loadChildren) return;
    const loadUnloaded = async () => {
      const toLoad: string[] = [];
      const findUnloaded = (items: FolderInfo[]) => {
        for (const folder of items) {
          if (expandedPaths.has(folder.path) && folder.hasChildren && !folder.isLoaded) {
            toLoad.push(folder.path);
          }
          if (folder.subfolders.length > 0) {
            findUnloaded(folder.subfolders);
          }
        }
      };
      findUnloaded(folders);
      for (const path of toLoad) {
        try {
          const children = await loadChildren(path);
          setFolders((current) => updateFolderChildren(current, path, children));
        } catch {
          // ignore
        }
      }
    };
    void loadUnloaded();
  }, [expandedPaths, folders, loadChildren]);

  useEffect(() => {
    if (!window.api?.getLibraryPath) return;
    void window.api.getLibraryPath().then(setLibraryPath);
  }, []);

  useEffect(() => {
    if (!contextMenu.visible) return;
    const handleClickOutside = () => setContextMenu({ visible: false, x: 0, y: 0, folder: null });
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [contextMenu.visible]);

  const refreshFolders = useCallback(async () => {
    await data.refreshFolders?.();
    await onFoldersChanged?.();
  }, [data, onFoldersChanged]);

  const filteredFolders = useMemo(() => filterFolders(folders, searchTerm), [folders, searchTerm]);
  const [libraryFolders, sourceFolders] = useMemo(() => {
    const library: FolderInfo[] = [];
    const sources: FolderInfo[] = [];
    for (const folder of filteredFolders) {
      if (sourceRootPaths.has(normalizeAbsolutePath(folder.fullPath))) sources.push(folder);
      else library.push(folder);
    }
    return [library, sources];
  }, [filteredFolders, sourceRootPaths]);

  const allExpandablePaths = useMemo(() => collectExpandablePaths(filteredFolders), [filteredFolders]);
  const allExpanded = allExpandablePaths.size > 0 && [...allExpandablePaths].every((path) => expandedPaths.has(path));
  const folderCountIndex = useMemo(
    () => buildFolderBookCountIndex(folderBookCounts, localDocuments),
    [folderBookCounts, localDocuments],
  );
  const totalBooks = countBooksFromIndex(null, libraryPath, folderCountIndex, includeSubfolders);

  const toggleExpand = useCallback(async (folder: FolderInfo, event: MouseEvent) => {
    event.stopPropagation();
    const shouldExpand = !expandedPaths.has(folder.path);
    if (shouldExpand && loadChildren && folder.hasChildren && !folder.isLoaded) {
      const children = await loadChildren(folder.path);
      setFolders((current) => updateFolderChildren(current, folder.path, children));
    }
    setExpandedPaths((current) => {
      const next = new Set(current);
      if (next.has(folder.path)) next.delete(folder.path);
      else next.add(folder.path);
      return next;
    });
  }, [expandedPaths, loadChildren]);

  const toggleExpandAll = () => {
    setExpandedPaths(allExpanded ? new Set() : allExpandablePaths);
  };

  const closeContextMenu = () => setContextMenu({ visible: false, x: 0, y: 0, folder: null });
  const cancelCreateFolder = () => {
    setCreatingFolderAt(null);
    setNewFolderName("");
  };

  const handleCreateFolderAt = async (parentPath: string | null) => {
    if (!newFolderName.trim()) {
      setCreatingFolderAt(parentPath);
      return;
    }
    const apiParentPath = parentPath === "" ? null : parentPath;
    try {
      const result = libraryContext
        ? await libraryContext.createFolder(apiParentPath, newFolderName.trim())
        : await window.api.createFolder(newFolderName.trim(), apiParentPath);
      if (result.success) {
        toast.success(t("library:folderTree.toasts.created"));
        setNewFolderName("");
        setCreatingFolderAt(null);
        await refreshFolders();
      } else {
        toast.error(result.error || t("library:folderTree.toasts.createFailed"));
      }
    } catch {
      toast.error(t("library:folderTree.toasts.createFailed"));
    }
    closeContextMenu();
  };

  const submitRename = async () => {
    if (!renamingFolder || !renameValue.trim()) {
      setRenamingFolder(null);
      return;
    }
    try {
      const result = libraryContext
        ? await libraryContext.renameFolder(renamingFolder, renameValue.trim())
        : await window.api.renameFolder(renamingFolder, renameValue.trim());
      if (result.success) {
        toast.success(t("library:folderTree.toasts.renamed"));
        await refreshFolders();
      } else {
        toast.error(result.error || t("library:folderTree.toasts.renameFailed"));
      }
    } catch {
      toast.error(t("library:folderTree.toasts.renameFailed"));
    }
    setRenamingFolder(null);
    setRenameValue("");
  };

  const handleDrop = async (targetPath: string) => {
    if (draggingFolder) {
      const result = libraryContext
        ? await libraryContext.moveFolder(draggingFolder, targetPath)
        : await window.api.moveFolder(draggingFolder, targetPath);
      if (result.success) toast.success(t("library:folderTree.toasts.moved"));
      else toast.error(result.error || t("library:folderTree.toasts.moveFailed"));
      await refreshFolders();
    } else if (draggingBooks.length > 0) {
      const success = draggingBooks.length > 1 && onMoveBooks
        ? await onMoveBooks(draggingBooks, targetPath)
        : onMoveBook
          ? await onMoveBook(draggingBooks[0], targetPath)
          : false;
      if (success && draggingBooks.length === 1)
        toast.success(t("library:folderTree.toasts.bookMoved"));
    }
    setDraggingFolder(null);
    setDragOver(null);
  };

  const listItems = useMemo<FolderTreeListItem[]>(() => {
    const libraryNodes = withCreateRows(flattenTree(libraryFolders, expandedPaths, 0, sourceRootPaths), creatingFolderAt);
    const sourceNodes = withCreateRows(flattenTree(sourceFolders, expandedPaths, 0, sourceRootPaths), creatingFolderAt);
    const items: FolderTreeListItem[] = [{ kind: "root", totalBooks, dropTarget: dragOver === "root" }];
    items.push(...libraryNodes);
    if (creatingFolderAt === "") items.push({ kind: "create", parentPath: "", depth: 1 });
    if (sourceNodes.length > 0)
      items.push({
        kind: "section",
        id: "source",
        labelKey: "library:sections.sourceFolders",
        onAdd: handleAddSourceFolder,
      });
    items.push(...sourceNodes);

    items.push({
      kind: "section" as const,
      id: "status",
      labelKey: "library:sections.readingStatus",
    } as any);
    LIBRARY_STATUS_FILTER_VALUES.forEach((status) => {
      items.push({
        kind: "filter" as const,
        id: `status-${status}`,
        status,
        visible: visibleStatuses.includes(status),
        onToggle: () => onToggleStatus?.(status),
      });
    });

    if (data.watchFolders.length > 0)
      items.push({
        kind: "section",
        id: "watch",
        labelKey: "library:sections.watchFolders",
        onAdd: handleAddWatchFolder,
      });
    items.push(...data.watchFolders.map((folder) => ({ kind: "watch" as const, folder, count: data.watchFolderCounts[folder.id] ?? "?" })));
    return items;
  }, [libraryFolders, expandedPaths, sourceRootPaths, creatingFolderAt, sourceFolders, totalBooks, dragOver, data.watchFolders, data.watchFolderCounts, visibleStatuses, onToggleStatus]);

  async function handleResync() {
    setSyncing(true);
    try {
      const result = await window.api.resyncLibrary();
      toast.success(
        t("library:folderTree.syncDone", {
          added: result.added,
          removed: result.removed,
          updated: result.updated,
        }),
      );
      await refreshFolders();
    } catch {
      toast.error(t("library:folderTree.syncFailed"));
    } finally {
      setSyncing(false);
    }
  }

  async function handleAddWatchFolder() {
    if (!window.api?.selectFolder) return;
    const result = await window.api.selectFolder();
    if (result.canceled || result.filePaths.length === 0) return;
    await window.api.addWatchFolder(result.filePaths[0]);
    await refreshFolders();
    toast.success(t("library:folderTree.watchFolderAdded"));
  }

  async function handleAddSourceFolder() {
    if (!window.api?.selectFolder || !window.api.addSourceFolder) return;
    const result = await window.api.selectFolder();
    if (result.canceled || result.filePaths.length === 0) return;
    const addResult = await window.api.addSourceFolder(result.filePaths[0]);
    if (addResult.success) {
      await refreshFolders();
      toast.success(t("library:folderTree.toasts.sourceAdded"));
    } else {
      toast.error(
        addResult.error || t("library:folderTree.toasts.sourceFailed"),
      );
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteDialog.folder) return;
    const result = libraryContext
      ? await libraryContext.deleteFolder(deleteDialog.folder.fullPath, true)
      : await window.api.deleteFolder(deleteDialog.folder.fullPath, true);
    if (result.success) {
      toast.success(t("library:folderTree.toasts.deleted"));
      await refreshFolders();
      if (selectedFolder === deleteDialog.folder.path) onFolderSelect(null);
    } else {
      toast.error(result.error || t("library:folderTree.toasts.deleteFailed"));
    }
    setDeleteDialog({ open: false, folder: null });
  }

  const renderItem = (item: FolderTreeListItem) => {
    if (item.kind === "root") return renderRootItem(item);
    if (item.kind === "create") {
      return (
        <FolderInlineCreate
          depth={item.depth}
          value={newFolderName}
          onChange={setNewFolderName}
          onSubmit={() => handleCreateFolderAt(item.parentPath)}
          onCancel={cancelCreateFolder}
        />
      );
    }
    if (item.kind === "section")
      return <FolderTreeSection labelKey={item.labelKey} onAdd={item.onAdd} />;
    if (item.kind === "filter") {
      return (
        <div
          onClick={item.onToggle}
          title={t(item.visible ? "library:filters.status.hide" : "library:filters.status.show")}
          className={`ml-2 mr-1 flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-xs transition-colors ${
            item.visible ? "text-foreground" : "text-foreground-subtle"
          } hover:bg-surface-muted hover:text-foreground`}
        >
          <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${
            item.visible ? STATUS_DOT[item.status] : "bg-border-strong"
          }`} />
          <span className={`truncate ${item.visible ? "" : "line-through decoration-border-strong"}`}>
            {t(READING_STATUS_LABEL_KEYS[item.status])}
          </span>
          <span className="ml-auto flex-shrink-0">
            {item.visible ? <Eye size={13} /> : <EyeOff size={13} />}
          </span>
        </div>
      );
    }
    if (item.kind === "watch") return renderWatchItem(item);
    if (item.kind !== "folder") return null;
    const folderBookCount = countBooksFromIndex(item.node.folder.path, libraryPath, folderCountIndex, false);
    const itemTotalBooks = countBooksFromIndex(item.node.folder.path, libraryPath, folderCountIndex, includeSubfolders);
    return (
      <FolderTreeNode
        node={item.node}
        selectedPath={selectedFolder}
        searchTerm={searchTerm}
        isRenaming={renamingFolder === item.node.folder.fullPath}
        renameValue={renameValue}
        folderBookCount={folderBookCount}
        totalBooks={itemTotalBooks}
        subfoldersBooks={Math.max(0, itemTotalBooks - folderBookCount)}
        onSelect={onFolderSelect}
        onToggleExpand={toggleExpand}
        onContextMenu={(event, folder) => {
          event.preventDefault();
          setContextMenu({ visible: true, x: event.clientX, y: event.clientY, folder });
        }}
        onRenameChange={setRenameValue}
        onRenameSubmit={submitRename}
        onRenameCancel={() => {
          setRenamingFolder(null);
          setRenameValue("");
        }}
      />
    );
  };

  const dragValue = {
    draggingFolder,
    draggingBooks,
    dragOver,
    onFolderDragStart: setDraggingFolder,
    onDragEnd: () => {
      setDraggingFolder(null);
      setDragOver(null);
    },
    onDragOver: (path: string) => {
      if (draggingFolder && path !== draggingFolder && !draggingFolder.startsWith(path)) setDragOver(path);
      else if (draggingBooks.length > 0) setDragOver(path);
    },
    onDragLeave: () => setDragOver(null),
    onDrop: handleDrop,
  };

  if (data.isLoading) {
    return (
      <div className="flex cursor-wait items-center gap-2 p-3 text-xs text-foreground-subtle">
        <RefreshCw size={12} className="animate-spin" />
        Carregando...
      </div>
    );
  }

  return (
    <FolderTreeDragProvider value={dragValue}>
      <div className="flex h-full flex-col">
        <div className="flex flex-shrink-0 flex-col gap-2 border-b border-border p-3">
          <FolderTreeToolbar
            allExpanded={allExpanded}
            syncing={syncing}
            canAddSource={Boolean(window.api?.addSourceFolder)}
            canImport={Boolean(onImportBook)}
            onCreateRoot={() => {
              setNewFolderName("");
              setCreatingFolderAt("");
            }}
            onImportRoot={() => onImportBook?.("")}
            onAddSource={handleAddSourceFolder}
            onToggleExpandAll={toggleExpandAll}
            onResync={handleResync}
          />
          <FolderTreeSearch value={searchTerm} onChange={setSearchTerm} />
        </div>

        {folders.length === 0 && data.watchFolders.length === 0 && creatingFolderAt !== "" ? (
          <FolderTreeEmpty
            canAddSource={Boolean(window.api?.addSourceFolder)}
            onAddWatch={handleAddWatchFolder}
            onAddSource={handleAddSourceFolder}
          />
        ) : (
          <>
            <FolderTreeVirtualizer items={listItems} renderItem={renderItem} />
            <FolderTreeFooter folderCount={filteredFolders.length} totalBooks={totalBooks} />
          </>
        )}

        {contextMenu.visible && contextMenu.folder && (
          <FolderContextMenu
            folder={contextMenu.folder}
            x={contextMenu.x}
            y={contextMenu.y}
            onCreateFolder={(folder) => {
              closeContextMenu();
              setNewFolderName("");
              setCreatingFolderAt(folder.path || "");
              setExpandedPaths((previous) => new Set([...previous, folder.path]));
            }}
            onImportBook={onImportBook ? (folder) => onImportBook(folder.path || "") : undefined}
            onRenameFolder={(folder) => {
              setRenamingFolder(folder.fullPath);
              setRenameValue(folder.name);
              closeContextMenu();
            }}
            onDeleteFolder={(folder) => {
              setDeleteDialog({ open: true, folder });
              closeContextMenu();
            }}
            onDissolveFolder={onDissolveFolder ? (folder) => {
              onDissolveFolder(folder);
              closeContextMenu();
            } : undefined}
          />
        )}

        {deleteDialog.open && deleteDialog.folder && (
          <FolderTreeDeleteDialog
            folder={deleteDialog.folder}
            onCancel={() => setDeleteDialog({ open: false, folder: null })}
            onConfirm={handleDeleteConfirm}
          />
        )}
      </div>
    </FolderTreeDragProvider>
  );

  function renderRootItem(item: Extract<FolderTreeListItem, { kind: "root" }>) {
    return (
      <button
        onClick={() => onFolderSelect(null)}
        className={`mb-1 flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-2 text-sm transition-colors ${
          selectedFolder === null
            ? "bg-surface-muted text-foreground"
            : "text-foreground-muted hover:bg-surface-muted/50 hover:text-foreground"
        } ${item.dropTarget ? "bg-primary-muted text-primary ring-1 ring-focus-ring" : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          if (draggingBooks.length > 0 || draggingFolder) setDragOver("root");
        }}
        onDragLeave={() => setDragOver(null)}
        onDrop={(event) => {
          event.preventDefault();
          if (draggingBooks.length > 0 || draggingFolder) void handleDrop("");
        }}
      >
        <Folder size={16} className="text-foreground-subtle" />
        <span className="flex-1 text-left">Raiz</span>
        <span className={`mr-5 rounded-sm px-1.5 py-0.5 text-xs ${selectedFolder === null ? "bg-border-strong text-foreground" : "bg-surface-muted text-foreground-subtle"}`}>
          {item.totalBooks}
        </span>
      </button>
    );
  }

  function renderWatchItem(item: Extract<FolderTreeListItem, { kind: "watch" }>) {
    const isSelected = item.folder.path === selectedFolder;
    return (
      <div
        onClick={() => onFolderSelect(item.folder.path)}
        className={`group flex cursor-pointer items-center gap-2 rounded-sm px-2 py-2 text-sm transition-colors ${
          isSelected ? "bg-surface-muted text-foreground" : "text-foreground-muted hover:bg-surface-muted/50 hover:text-foreground"
        }`}
      >
        <FolderPlus size={15} className="text-foreground-subtle" />
        <span className="min-w-0 flex-1">
          <span className="block truncate">{item.folder.label || item.folder.path.split(/[/\\]/).pop()}</span>
          <span className="mt-0.5 block truncate text-[10px] leading-3 text-foreground-subtle" title={item.folder.path}>
            {item.folder.path}
          </span>
        </span>
        <span className={`mr-1 rounded-sm px-1.5 py-0.5 text-[11px] ${isSelected ? "bg-border-strong text-foreground" : "bg-surface-muted text-foreground-subtle"}`}>
          {item.count}
        </span>
        <button
          onClick={async (event) => {
            event.stopPropagation();
            await window.api.removeWatchFolder(item.folder.id);
            await refreshFolders();
            toast.success(t("library:folderTree.watchFolderRemoved"));
          }}
          className="cursor-pointer rounded-sm p-0.5 text-foreground-subtle opacity-0 transition-opacity hover:bg-border-strong hover:text-destructive group-hover:opacity-100"
          title={t("library:folderTree.removeWatchFolder")}
        >
          <X size={12} />
        </button>
      </div>
    );
  }
}
