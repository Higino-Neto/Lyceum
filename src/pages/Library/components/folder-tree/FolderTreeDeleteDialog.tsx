import { Trash2, X } from "lucide-react";
import type { FolderInfo } from "../../../../types/LibraryTypes";
import { useTranslation } from "../../../../i18n";

export default function FolderTreeDeleteDialog({
  folder,
  onCancel,
  onConfirm,
}: {
  folder: FolderInfo;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-backdrop">
      <div className="mx-4 w-full max-w-md rounded-sm border border-border bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-border-strong p-4">
          <div className="flex items-center gap-2">
            <Trash2 size={20} className="text-destructive" />
            <h2 className="text-lg font-semibold text-foreground">
              {t("library:folderTree.deleteDialog.title")}
            </h2>
          </div>
          <button onClick={onCancel} className="cursor-pointer rounded-sm p-2 hover:bg-surface-muted">
            <X size={20} className="text-foreground-muted" />
          </button>
        </div>
        <div className="p-4">
          <p className="text-sm text-foreground-muted">
            {t("library:folderTree.deleteDialog.message", { name: folder.name })}
          </p>
          <p className="mt-2 text-xs text-foreground-subtle">
            {t("library:folderTree.deleteDialog.warning")}
          </p>
        </div>
        <div className="flex justify-end gap-2 border-t border-border-strong p-4">
          <button
            onClick={onCancel}
            className="cursor-pointer rounded-sm px-4 py-2 text-foreground hover:bg-surface-muted hover:text-foreground"
          >
            {t("common:actions.cancel")}
          </button>
          <button
            onClick={onConfirm}
            className="cursor-pointer rounded-sm bg-destructive px-4 py-2 font-medium text-destructive-foreground hover:bg-destructive-hover"
          >
            {t("common:actions.delete")}
          </button>
        </div>
      </div>
    </div>
  );
}
