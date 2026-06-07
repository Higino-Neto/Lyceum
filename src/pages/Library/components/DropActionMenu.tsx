import { GitMerge, Layers } from "lucide-react";

interface DropActionMenuProps {
  x: number;
  y: number;
  onMerge: () => void;
  onCreateCollection: () => void;
  onClose: () => void;
}

export default function DropActionMenu({
  x,
  y,
  onMerge,
  onCreateCollection,
  onClose,
}: DropActionMenuProps) {
  return (
    <div
      className="fixed z-50 min-w-[180px] rounded-sm border border-zinc-700 bg-zinc-800 py-1 shadow-lg"
      style={{ left: x, top: y }}
      onClick={(event) => event.stopPropagation()}
      onMouseLeave={onClose}
    >
      <button
        type="button"
        onClick={onCreateCollection}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-700"
      >
        <Layers size={14} />
        Criar colecao
      </button>
      <button
        type="button"
        onClick={onMerge}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-700"
      >
        <GitMerge size={14} />
        Mesclar livros
      </button>
    </div>
  );
}
