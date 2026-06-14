import { Trash2, X } from "lucide-react";
import type { FolderInfo } from "../../../../types/LibraryTypes";

export default function FolderTreeDeleteDialog({
  folder,
  onCancel,
  onConfirm,
}: {
  folder: FolderInfo;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-md rounded-sm border border-zinc-800 bg-zinc-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-700 p-4">
          <div className="flex items-center gap-2">
            <Trash2 size={20} className="text-red-400" />
            <h2 className="text-lg font-semibold text-zinc-100">Excluir pasta</h2>
          </div>
          <button onClick={onCancel} className="cursor-pointer rounded-sm p-2 hover:bg-zinc-800">
            <X size={20} className="text-zinc-400" />
          </button>
        </div>
        <div className="p-4">
          <p className="text-sm text-zinc-400">
            Tem certeza que deseja excluir a pasta{" "}
            <span className="font-medium text-zinc-200">"{folder.name}"</span>?
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            Esta pasta e todo o seu conteudo serao excluidos permanentemente.
          </p>
        </div>
        <div className="flex justify-end gap-2 border-t border-zinc-700 p-4">
          <button
            onClick={onCancel}
            className="cursor-pointer rounded-sm px-4 py-2 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="cursor-pointer rounded-sm bg-red-500 px-4 py-2 font-medium text-white hover:bg-red-600"
          >
            Excluir
          </button>
        </div>
      </div>
    </div>
  );
}
