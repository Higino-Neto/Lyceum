import { X, AlertTriangle } from "lucide-react";

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
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  onConfirm,
  onCancel,
  isDanger = false,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-800 rounded-sm w-full max-w-md mx-4 shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-zinc-700">
          <div className="flex items-center gap-2">
            {isDanger && <AlertTriangle size={20} className="text-red-400" />}
            <h2 className="text-lg font-semibold text-zinc-100">{title}</h2>
          </div>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-zinc-800 rounded-sm cursor-pointer"
          >
            <X size={20} className="text-zinc-400" />
          </button>
        </div>

        <div className="p-4">
          <p className="text-zinc-400 text-sm">{message}</p>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-zinc-700">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-zinc-300 hover:text-zinc-100 cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded-sm font-medium cursor-pointer ${
              isDanger
                ? "bg-red-500 hover:bg-red-600 text-white"
                : "bg-zinc-100 hover:bg-zinc-200 text-zinc-900"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
