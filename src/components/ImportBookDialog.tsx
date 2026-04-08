import { useState } from "react";
import { X, FilePlus, Copy, ArrowRight } from "lucide-react";

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
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-800 rounded-sm w-full max-w-md mx-4 shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-zinc-700">
          <div className="flex items-center gap-2">
            <FilePlus size={20} className="text-green-400" />
            <h2 className="text-lg font-semibold text-zinc-100">Adicionar livro</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-800 rounded-sm cursor-pointer"
          >
            <X size={20} className="text-zinc-400" />
          </button>
        </div>

        <div className="p-4">
          <p className="text-zinc-400 text-sm mb-4">
            Selecione uma opção para importar os arquivos PDF para a biblioteca:
          </p>
          <p className="text-zinc-500 text-xs mb-4">
            Pasta de destino: <span className="text-zinc-300">{targetFolderName || "Raiz da biblioteca"}</span>
          </p>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-zinc-700">
          <button
            onClick={() => onImport("copy")}
            className="flex items-center gap-2 px-4 py-2 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 rounded-sm cursor-pointer"
          >
            <Copy size={16} />
            Copiar
          </button>
          <button
            onClick={() => onImport("move")}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-sm font-medium cursor-pointer"
          >
            <ArrowRight size={16} />
            Mover
          </button>
        </div>
      </div>
    </div>
  );
}
