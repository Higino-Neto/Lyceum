import { FilePlus, FolderMinus, FolderPlus, Pencil, Trash2, X } from "lucide-react";
import { FolderInfo } from "../../../types/LibraryTypes";
import { useTranslation } from "../../../i18n";

interface FolderContextMenuProps {
  folder: FolderInfo;
  x: number;
  y: number;
  /** Number of folders in the multi-selection the menu acts on (>= 1). */
  selectionCount?: number;
  /** True when `folder` is a linked source folder root. */
  isSourceRoot?: boolean;
  onCreateFolder: (folder: FolderInfo) => void;
  onRenameFolder: (folder: FolderInfo) => void;
  onDeleteFolder: (folder: FolderInfo) => void;
  onUnlinkSource?: (folder: FolderInfo) => void;
  onImportBook?: (folder: FolderInfo) => void;
  onClearSelection?: () => void;
}

const itemClass =
  "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-foreground hover:bg-border-strong";

export default function FolderContextMenu({
  folder,
  x,
  y,
  selectionCount = 1,
  isSourceRoot = false,
  onCreateFolder,
  onImportBook,
  onRenameFolder,
  onDeleteFolder,
  onUnlinkSource,
  onClearSelection,
}: FolderContextMenuProps) {
  const { t } = useTranslation();
  const batch = selectionCount > 1;
  // Keep the menu inside the viewport.
  const left = Math.min(x, window.innerWidth - 240);
  const top = Math.min(y, window.innerHeight - 220);

  return (
    <div
      className="fixed z-50 min-w-[200px] rounded-sm border border-border-strong bg-surface-muted py-1 shadow-lg"
      style={{ left, top }}
      onClick={(event) => event.stopPropagation()}
    >
      {batch ? (
        <>
          <p className="px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-foreground-subtle">
            {t("library:folderTree.selectedCount", { count: selectionCount })}
          </p>
          {onClearSelection && (
            <button type="button" onClick={onClearSelection} className={itemClass}>
              <X size={14} />
              {t("library:folderTree.clearSelection")}
            </button>
          )}
        </>
      ) : (
        <>
          <button type="button" onClick={() => onCreateFolder(folder)} className={itemClass}>
            <FolderPlus size={14} />
            {t("library:folders.newFolder")}
          </button>
          {onImportBook && (
            <button type="button" onClick={() => onImportBook(folder)} className={itemClass}>
              <FilePlus size={14} />
              {t("library:folders.addBook")}
            </button>
          )}
          {!isSourceRoot && (
            <button type="button" onClick={() => onRenameFolder(folder)} className={itemClass}>
              <Pencil size={14} />
              {t("library:folders.rename")}
            </button>
          )}
          {isSourceRoot && onUnlinkSource && (
            <>
              <div className="my-1 border-t border-border-strong" />
              <button type="button" onClick={() => onUnlinkSource(folder)} className={itemClass}>
                <FolderMinus size={14} />
                <span className="flex flex-col">
                  <span>{t("library:folderTree.unlinkSource")}</span>
                  <span className="text-[11px] text-foreground-subtle">{t("library:folderTree.unlinkSourceHint")}</span>
                </span>
              </button>
            </>
          )}
        </>
      )}
      <div className="my-1 border-t border-border-strong" />
      <button
        type="button"
       
        onClick={() => onDeleteFolder(folder)}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-destructive hover:bg-border-strong"
      >
        <Trash2 size={14} />
        <span className="flex flex-col">
          <span>
            {batch
              ? t("library:folderTree.deleteSelected", { count: selectionCount })
              : isSourceRoot
                ? t("library:folderTree.deleteFromDisk")
                : t("library:folders.delete")}
          </span>
          <span className="text-[11px] opacity-80">{t("library:folderTree.deleteHint")}</span>
        </span>
      </button>
    </div>
  );
}
