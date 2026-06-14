import { FolderPlus } from "lucide-react";

export default function FolderTreeSection({
  label,
  onAdd,
}: {
  label: string;
  onAdd?: () => void;
}) {
  return (
    <div className="mt-3 border-t border-zinc-800 pt-2">
      <div className="mb-1 flex items-center justify-between px-2">
        <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
          {label}
        </span>
        {onAdd && (
          <button
            onClick={onAdd}
            className="cursor-pointer rounded-sm p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
            title={`Adicionar ${label.toLowerCase()}`}
          >
            <FolderPlus size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
