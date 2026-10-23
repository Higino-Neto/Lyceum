import { X, AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import AnimatedModal from "./ui/AnimatedModal";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDanger?: boolean;
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  isDanger = false,
}: ConfirmDialogProps) {
  const { t } = useTranslation();

  return (
    <AnimatedModal
      open={isOpen}
      ariaLabel={title}
      onBackdropClick={onCancel}
      backdropClassName="px-4"
      className="w-full max-w-md rounded-sm border border-border bg-surface shadow-2xl"
    >
        <div className="flex items-center justify-between p-4 border-b border-border-strong">
          <div className="flex items-center gap-2">
            {isDanger && <AlertTriangle size={20} className="text-destructive" />}
            <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          </div>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-surface-muted rounded-sm cursor-pointer"
          >
            <X size={20} className="text-foreground-muted" />
          </button>
        </div>

        <div className="p-4">
          <p className="text-foreground-muted text-sm">{message}</p>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-border-strong">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-foreground-muted hover:text-foreground cursor-pointer"
          >
            {cancelLabel ?? t("dialogs:confirm.cancel")}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded-sm font-medium cursor-pointer ${
              isDanger
                ? "bg-destructive hover:bg-destructive-hover text-destructive-foreground"
                : "bg-primary hover:bg-primary-hover text-primary-foreground"
            }`}
          >
            {confirmLabel ?? t("dialogs:confirm.confirm")}
          </button>
        </div>
    </AnimatedModal>
  );
}
