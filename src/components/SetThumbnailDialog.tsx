import { useState, useEffect } from "react";
import { X, Image, ArrowRight, Layers, Plus } from "lucide-react";

interface SetThumbnailDialogProps {
  isOpen: boolean;
  imagePath: string;
  onSetThumbnail: (mode: "replace" | "prepend") => void;
  onClose: () => void;
}

export default function SetThumbnailDialog({
  isOpen,
  imagePath,
  onSetThumbnail,
  onClose,
}: SetThumbnailDialogProps) {
  const [previewError, setPreviewError] = useState(false);

  useEffect(() => {
    setPreviewError(false);
  }, [imagePath]);

  if (!isOpen) return null;

  const fileName = imagePath.split(/[/\\]/).pop() || imagePath;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg w-full max-w-lg mx-4 shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-zinc-700">
          <div className="flex items-center gap-2">
            <Image size={20} className="text-green-400" />
            <h2 className="text-lg font-semibold text-zinc-100">Definir Capa do Livro</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-800 rounded-md cursor-pointer"
          >
            <X size={20} className="text-zinc-400" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <p className="text-sm text-zinc-400 mb-2">Imagem selecionada:</p>
            <div className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-md border border-zinc-700">
              <div className="w-16 h-16 bg-zinc-800 rounded overflow-hidden flex items-center justify-center flex-shrink-0">
                {!previewError ? (
                  <img 
                    src={`file://${imagePath}`} 
                    alt="Preview" 
                    className="w-full h-full object-cover"
                    onError={() => setPreviewError(true)}
                  />
                ) : (
                  <Image size={24} className="text-zinc-600" />
                )}
              </div>
              <span className="text-sm text-zinc-300 truncate">{fileName}</span>
            </div>
          </div>

          <div>
            <p className="text-sm text-zinc-400 mb-3">Escolha como aplicar a imagem:</p>
            
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => onSetThumbnail("replace")}
                className="flex flex-col items-center p-4 bg-zinc-800 hover:bg-zinc-750 border-2 border-zinc-700 hover:border-green-500 rounded-lg transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-center gap-2 mb-3">
                  <div className="w-14 h-20 bg-zinc-700 rounded flex items-center justify-center">
                    <Image size={18} className="text-zinc-500" />
                  </div>
                  <ArrowRight size={18} className="text-zinc-500" />
                  <div className="w-14 h-20 bg-green-600 rounded flex items-center justify-center">
                    <Image size={18} className="text-white" />
                  </div>
                </div>
                <span className="text-sm font-medium text-zinc-200 group-hover:text-white">Substituir</span>
                <span className="text-xs text-zinc-500 mt-1 text-center">Primeira página vira a imagem</span>
              </button>

              <button
                onClick={() => onSetThumbnail("prepend")}
                className="flex flex-col items-center p-4 bg-zinc-800 hover:bg-zinc-750 border-2 border-zinc-700 hover:border-green-500 rounded-lg transition-all cursor-pointer group"
              >
                <div className="flex flex-col items-center gap-1 mb-3">
                  <div className="w-14 h-10 bg-green-600 rounded flex items-center justify-center">
                    <Image size={14} className="text-white" />
                  </div>
                  <div className="w-14 h-10 bg-zinc-700 rounded flex items-center justify-center">
                    <Image size={14} className="text-zinc-500" />
                  </div>
                </div>
                <span className="text-sm font-medium text-zinc-200 group-hover:text-white">Adicionar</span>
                <span className="text-xs text-zinc-500 mt-1 text-center">Nova página antes da primeira</span>
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-zinc-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-md cursor-pointer"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
