import { FolderMinus, Trash2, X } from "lucide-react";
import type { FolderInfo } from "../../../../types/LibraryTypes";
import AnimatedModal from "../../../../components/ui/AnimatedModal";
import { useTranslation } from "../../../../i18n";

export type FolderDeleteMode = "delete" | "unlink";

/**
 * Confirms deleting folders from disk (to the system trash) or unlinking a
 * source folder from the library. The copy spells out which one happens to
 * the files, since the two actions look alike but are very different.
 */
export default function FolderTreeDeleteDialog({
  folders,
  mode = "delete",
  onCancel,
  onConfirm,
}: {
  folders: FolderInfo[];
  mode?: FolderDeleteMode;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  const isUnlink = mode === "unlink";
  const Icon = isUnlink ? FolderMinus : Trash2;
  const single = folders.length === 1 ? folders[0] : null;

  return (
    <AnimatedModal
      open={folders.length > 0}
      ariaLabelledBy="folder-delete-title"
      onBackdropClick={onCancel}
      className="mx-4 w-full max-w-md rounded-sm border border-border bg-surface shadow-2xl"
    >
      <div className="flex items-center justify-between border-b border-border p-4">
        <div className="flex items-center gap-2">
          <Icon size={18} className={isUnlink ? "text-foreground-muted" : "text-destructive"} />
          <h2 id="folder-delete-title" className="text-base font-semibold text-foreground">
            {isUnlink
              ? t("library:folderTree.unlinkDialog.title")
              : single
                ? t("library:folderTree.deleteDialog.title")
                : t("library:folderTree.deleteDialog.titleMany", { count: folders.length })}
          </h2>
        </div>
        <button
          type="button"
          onClick={onCancel}
          aria-label={t("common:actions.close")}
          className="cursor-pointer rounded-sm p-1.5 text-foreground-muted hover:bg-surface-muted hover:text-foreground"
        >
          <X size={18} />
        </button>
      </div>
      <div className="space-y-3 p-4">
        <p className="text-sm text-foreground-muted">
          {isUnlink
            ? t("library:folderTree.unlinkDialog.message", { name: single?.name ?? "" })
            : single
              ? t("library:folderTree.deleteDialog.message", { name: single.name })
              : t("library:folderTree.deleteDialog.messageMany", { count: folders.length })}
        </p>
        {!single && (
          <ul className="max-h-32 space-y-0.5 overflow-y-auto rounded-sm border border-border bg-background/50 px-3 py-2 text-xs text-foreground-muted">
            {folders.map((folder) => (
              <li key={folder.fullPath} className="truncate" title={folder.fullPath}>{folder.name}</li>
            ))}
          </ul>
        )}
        <p className={`rounded-sm px-3 py-2 text-xs ${isUnlink ? "bg-surface-muted text-foreground-muted" : "bg-destructive/10 text-destructive"}`}>
          {isUnlink
            ? t("library:folderTree.unlinkDialog.hint")
            : t("library:folderTree.deleteDialog.warning")}
        </p>
      </div>
      <div className="flex justify-end gap-2 border-t border-border p-4">
        <button
          type="button"
          onClick={onCancel}
          className="cursor-pointer rounded-sm px-4 py-2 text-sm text-foreground hover:bg-surface-muted"
        >
          {t("common:actions.cancel")}
        </button>
        <button
          type="button"
          autoFocus
          onClick={onConfirm}
          className={isUnlink
            ? "cursor-pointer rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
            : "cursor-pointer rounded-sm bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive-hover"}
        >
          {isUnlink ? t("library:folderTree.unlinkDialog.confirm") : t("library:folderTree.deleteDialog.confirm")}
        </button>
      </div>
    </AnimatedModal>
  );
}
