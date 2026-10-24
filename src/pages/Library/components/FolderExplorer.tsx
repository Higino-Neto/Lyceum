import {
  ArrowUp,
  ChevronRight,
  FilePlus,
  Folder,
  FolderPlus,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { BookWithThumbnail, FolderInfo } from "../../../types/LibraryTypes";
import {
  getFolderBookInfo,
  useBooksInFolder,
} from "../../../hooks/useBooksInFolder";
import {
  folderPathsEqual,
  getFolderBookCount,
  getFolderBreadcrumbs,
  getParentFolderPath,
} from "../utils";
import FolderCard from "./FolderCard";
import FolderContextMenu from "./FolderContextMenu";
import { useTranslation } from "../../../i18n";

interface FolderPathBarProps {
  folders: FolderInfo[];
  selectedFolder: string | null;
  onFolderSelect: (folderPath: string | null) => void;
  onCreateFolder?: (parentPath: string | null) => void;
  onImportBook?: (targetFolder: string | null) => void;
  readOnlyCurrentFolder?: boolean;
}

interface FolderGridProps {
  folders: FolderInfo[];
  onFolderSelect: (folderPath: string | null) => void;
  books?: BookWithThumbnail[];
  selectedFolder?: string | null;
  draggingBookHashes?: string[];
  onCreateFolder?: (parentPath: string | null) => void;
  onImportBook?: (targetFolder: string | null) => void;
  onRenameFolder?: (folder: FolderInfo) => void;
  onDeleteFolder?: (folder: FolderInfo) => void;
  onDissolveFolder?: (folder: FolderInfo) => void;
  isFolderReadOnly?: (folder: FolderInfo) => boolean;
  onMoveBook?: (
    fileHash: string,
    targetFolder: string | null,
  ) => Promise<boolean>;
  onMoveBooks?: (
    fileHashes: string[],
    targetFolder: string | null,
  ) => Promise<boolean>;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

interface FolderGridContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  folder: FolderInfo | null;
}

function isAbsoluteFolderPath(folderPath: string) {
  return /^[a-zA-Z]:[\\/]/.test(folderPath) || folderPath.startsWith("/") || folderPath.startsWith("\\\\");
}

export function FolderPathBar({
  folders,
  selectedFolder,
  onFolderSelect,
  onCreateFolder,
  onImportBook,
  readOnlyCurrentFolder = false,
}: FolderPathBarProps) {
  const breadcrumbs = useMemo(
    () => getFolderBreadcrumbs(folders, selectedFolder),
    [folders, selectedFolder],
  );
  const { t } = useTranslation();
  const parentPath = useMemo(
    () => getParentFolderPath(folders, selectedFolder),
    [folders, selectedFolder],
  );

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-border pb-3">
      <button
        type="button"
        onClick={() => onFolderSelect(parentPath)}
        disabled={!selectedFolder}
        className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-sm border border-border bg-surface text-foreground-muted transition-colors hover:border-border-strong hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        title={t("library:folderTree.upOneLevel")}
      >
        <ArrowUp size={16} />
      </button>

      <nav className="flex min-w-0 flex-1 items-center overflow-hidden rounded-sm border border-border bg-surface px-2">
        {breadcrumbs.map((crumb, index) => {
          const isLast = index === breadcrumbs.length - 1;

          return (
            <div
              key={`${crumb.path ?? "root"}-${index}`}
              className="flex min-w-0 items-center"
            >
              {index > 0 && (
                <ChevronRight
                  size={13}
                  className="mx-1 flex-shrink-0 text-foreground-subtle"
                />
              )}
              <button
                type="button"
                onClick={() => onFolderSelect(crumb.path)}
                disabled={isLast}
                className={`min-w-0 truncate rounded-sm px-2 py-2 text-left text-xs transition-colors ${
                  isLast
                    ? "cursor-default font-medium text-foreground"
                    : "cursor-pointer text-foreground-muted hover:bg-surface-muted hover:text-foreground"
                }`}
                title={crumb.label}
              >
                {crumb.label}
              </button>
            </div>
          );
        })}
      </nav>

      {onCreateFolder && !readOnlyCurrentFolder && (
        <button
          type="button"
          onClick={() => onCreateFolder(selectedFolder)}
          className="flex h-9 cursor-pointer items-center gap-2 rounded-sm border border-border bg-surface px-3 text-xs font-medium text-foreground transition-colors hover:border-primary/60 hover:bg-primary-muted hover:text-primary"
        >
          <FolderPlus size={15} />
          {t("library:folders.newFolder")}
        </button>
      )}

      {onImportBook && !readOnlyCurrentFolder && (
        <button
          type="button"
          onClick={() => onImportBook(selectedFolder)}
          className="flex h-9 cursor-pointer items-center gap-2 rounded-sm border border-border bg-surface px-3 text-xs font-medium text-foreground transition-colors hover:border-border-strong hover:bg-surface-muted hover:text-foreground"
        >
          <FilePlus size={15} />
          {t("library:folders.addBook")}
        </button>
      )}
    </div>
  );
}

export function FolderGrid({
  folders,
  onFolderSelect,
  books = [],
  selectedFolder = null,
  draggingBookHashes = [],
  onCreateFolder,
  onImportBook,
  onRenameFolder,
  onDeleteFolder,
  onDissolveFolder,
  isFolderReadOnly,
  onMoveBook,
  onMoveBooks,
  collapsed = false,
  onCollapsedChange,
}: FolderGridProps) {
  const { t } = useTranslation();
  const [dragOverPath, setDragOverPath] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<FolderGridContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    folder: null,
  });
  const draggingBooks = draggingBookHashes.length > 0;
  const folderBookIndex = useBooksInFolder(books, folders);

  const handleDrop = async (folderPath: string) => {
    if (!draggingBooks) return;

    try {
      const success =
        draggingBookHashes.length > 1 && onMoveBooks
          ? await onMoveBooks(draggingBookHashes, folderPath)
          : onMoveBook
            ? await onMoveBook(draggingBookHashes[0], folderPath)
            : false;

      if (success && draggingBookHashes.length === 1) {
        toast.success(t("library:folders.bookMovedToast"));
      }
    } catch (error) {
      toast.error(t("library:folders.moveBookFailedToast"));
    } finally {
      setDragOverPath(null);
    }
  };

  const closeContextMenu = () => {
    setContextMenu({ visible: false, x: 0, y: 0, folder: null });
  };

  const openContextMenu = (event: React.MouseEvent, folder: FolderInfo) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({
      visible: true,
      x: event.clientX,
      y: event.clientY,
      folder,
    });
  };

  useEffect(() => {
    if (!contextMenu.visible) return;
    document.addEventListener("click", closeContextMenu);
    return () => document.removeEventListener("click", closeContextMenu);
  }, [contextMenu.visible]);

  return (
    <section className="mb-5">
      <div className="mb-2 flex items-center justify-between px-2">
        <h2 className="text-xs font-medium uppercase tracking-wide text-foreground-subtle">
          Pastas
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-foreground-subtle">
            {folders.length} pasta{folders.length !== 1 ? "s" : ""}
          </span>
          {onCollapsedChange && folders.length > 0 && (
            <button
              type="button"
              onClick={() => onCollapsedChange(!collapsed)}
              className="rounded px-2 py-1 text-[11px] text-foreground-muted hover:bg-surface-muted hover:text-foreground"
              aria-expanded={!collapsed}
            >
              {collapsed ? t("library:folders.show") : t("library:folders.hide")}
            </button>
          )}
        </div>
      </div>

      {collapsed ? null : folders.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-border bg-background/30 py-10 text-foreground-subtle">
          <Folder size={32} strokeWidth={1.2} className="mb-3" />
          <p className="text-sm">Nenhuma subpasta</p>
        </div>
      ) : (
        <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto overflow-y-visible px-1 pb-3 pt-1 pr-2">
          {folders.map((folder) => {
            const indexedInfo = getFolderBookInfo(folderBookIndex, folder);
            const bookCount = getFolderBookCount(folder) || indexedInfo.bookCount;
            const isDropTarget = dragOverPath === folder.path;
            const folderCount = folder.subfolders.length;
            const previews = indexedInfo;
            const readOnly = isFolderReadOnly?.(folder) ?? false;

            return (
              <div key={folder.path} className="w-[220px] min-w-[220px] snap-start">
              <FolderCard
                id={folder.path}
                name={folder.name}
                detail={isAbsoluteFolderPath(folder.path) ? folder.fullPath : undefined}
                bookCount={bookCount}
                folderCount={folderCount}
                coverPreviews={previews.coverPreviews}
                coverPreviewPaths={previews.coverPreviewPaths}
                isSelected={folderPathsEqual(folder.path, selectedFolder)}
                isEmpty={bookCount === 0 && folderCount === 0}
                isDropTarget={isDropTarget}
                onOpen={onFolderSelect}
                onContextMenu={
                  readOnly
                    ? undefined
                    : (_, event) => {
                        if (event) openContextMenu(event, folder);
                      }
                }
                onDragOver={readOnly ? undefined : (event) => {
                  if (!draggingBooks) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  setDragOverPath(folder.path);
                }}
                onDragLeave={readOnly ? undefined : () => setDragOverPath(null)}
                onDrop={readOnly ? undefined : (event) => {
                  event.preventDefault();
                  handleDrop(folder.path);
                }}
              />
              </div>
            );
          })}
        </div>
      )}

      {contextMenu.visible && contextMenu.folder && (
        <FolderContextMenu
          folder={contextMenu.folder}
          x={contextMenu.x}
          y={contextMenu.y}
          onCreateFolder={(folder) => {
            closeContextMenu();
            onCreateFolder?.(folder.path);
          }}
          onImportBook={
            onImportBook
              ? (folder) => {
                  closeContextMenu();
                  onImportBook(folder.path);
                }
              : undefined
          }
          onRenameFolder={(folder) => {
            closeContextMenu();
            onRenameFolder?.(folder);
          }}
          onDeleteFolder={(folder) => {
            closeContextMenu();
            onDeleteFolder?.(folder);
          }}
          onDissolveFolder={onDissolveFolder ? (folder) => {
            closeContextMenu();
            onDissolveFolder(folder);
          } : undefined}
        />
      )}
    </section>
  );
}
