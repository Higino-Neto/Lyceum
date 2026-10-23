import { X, FilePlus, Copy, ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import AnimatedModal from "./ui/AnimatedModal";

interface ImportBookDialogProps {
  isOpen: boolean;
  targetFolderName: string;
  onImport: (action: "move" | "copy") => void;
  onClose: () => void;
}

export default function ImportBookDialog({
  isOpen,
  targetFolderName,
  onImport,
  onClose,
}: ImportBookDialogProps) {
  const { t } = useTranslation();

  return (
    <AnimatedModal
      open={isOpen}
      ariaLabel={t("dialogs:importBook.title")}
      onBackdropClick={onClose}
      backdropClassName="px-4"
      className="w-full max-w-md rounded-sm border border-border bg-surface shadow-2xl shadow-shadow"
    >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <FilePlus size={20} className="text-success" />
            <h2 className="text-lg font-semibold text-foreground">
            {t("dialogs:importBook.title")}
          </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-surface-muted rounded-sm cursor-pointer"
          >
            <X size={20} className="text-foreground-muted" />
          </button>
        </div>

        <div className="p-4">
          <p className="text-foreground-muted text-sm mb-4">
            {t("dialogs:importBook.description")}
          </p>
          <p className="text-foreground-subtle text-xs mb-4">
            {t("dialogs:importBook.targetFolderLabel")}{" "}
            <span className="text-foreground-muted">
              {targetFolderName || t("dialogs:importBook.targetFolderRoot")}
            </span>
          </p>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-border">
          <button
            onClick={() => onImport("copy")}
            className="flex items-center gap-2 px-4 py-2 text-foreground-muted hover:text-foreground hover:bg-surface-muted rounded-sm cursor-pointer"
          >
            <Copy size={16} />
            {t("dialogs:importBook.actions.copy")}
          </button>
          <button
            onClick={() => onImport("move")}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-sm font-medium cursor-pointer"
          >
            <ArrowRight size={16} />
            {t("dialogs:importBook.actions.move")}
          </button>
        </div>
    </AnimatedModal>
  );
}
