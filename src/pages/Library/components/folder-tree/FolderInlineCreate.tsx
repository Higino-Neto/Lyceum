import { Folder } from "lucide-react";

export default function FolderInlineCreate({
  depth,
  value,
  onChange,
  onSubmit,
  onCancel,
}: {
  depth: number;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="flex items-center gap-1.5 px-2 py-1"
      style={{ paddingLeft: `${depth * 16 + 8}px` }}
    >
      <Folder size={15} className="text-zinc-500" />
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={() => {
          if (value.trim()) onSubmit();
          else onCancel();
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") onSubmit();
          if (event.key === "Escape") onCancel();
        }}
        className="flex-1 rounded-sm border border-zinc-600 bg-zinc-700 px-1.5 py-0.5 text-sm text-zinc-100 focus:outline-none"
        autoFocus
        onClick={(event) => event.stopPropagation()}
        placeholder="Nome da pasta"
      />
    </div>
  );
}
