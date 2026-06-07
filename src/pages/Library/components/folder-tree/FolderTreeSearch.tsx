import { useEffect, useState } from "react";
import { Search } from "lucide-react";

export default function FolderTreeSearch({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    const timer = setTimeout(() => onChange(draft), 180);
    return () => clearTimeout(timer);
  }, [draft, onChange]);

  return (
    <div className="relative">
      <Search
        size={14}
        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500"
      />
      <input
        type="text"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder="Buscar pastas..."
        className="w-full rounded-sm border border-zinc-700 bg-zinc-800 py-1.5 pl-8 pr-3 text-xs text-zinc-200 placeholder:text-zinc-500 focus:border-green-500 focus:outline-none"
      />
    </div>
  );
}
