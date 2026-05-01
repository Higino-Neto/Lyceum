import { FileText, Search, SlidersHorizontal, X } from "lucide-react";

const ICON_SIZE = 15;
const STROKE_WIDTH = 1.6;

export type SortOption = "title" | "pages" | "recent" | "size";
export type FileTypeFilter = "all" | "pdf" | "epub";

interface FilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  sort: SortOption;
  onSortChange: (value: SortOption) => void;
  fileType: FileTypeFilter;
  onFileTypeChange: (value: FileTypeFilter) => void;
}

const sortLabels: Record<SortOption, string> = {
  title: "Nome",
  pages: "Paginas",
  recent: "Recentes",
  size: "Tamanho",
};

export default function FilterBar({
  search,
  onSearchChange,
  sort,
  onSortChange,
  fileType,
  onFileTypeChange,
}: FilterBarProps) {
  return (
    <section className="mb-4 rounded-sm border border-zinc-800 bg-zinc-950/70 p-2 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={onSearchChange} />
        <FileTypeButtons value={fileType} onChange={onFileTypeChange} />
        <SortSelect value={sort} onChange={onSortChange} />
      </div>
    </section>
  );
}

function SearchInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative min-w-64 flex-1">
      <Search
        size={ICON_SIZE}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
        strokeWidth={STROKE_WIDTH}
      />
      <input
        type="text"
        placeholder="Buscar por titulo, pasta, tipo ou paginas..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-sm border border-zinc-800 bg-zinc-900 pl-9 pr-9 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 transition-colors focus-visible:border-green-500 focus-visible:ring-1 focus-visible:ring-green-500"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-sm text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
          title="Limpar busca"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

function FileTypeButtons({
  value,
  onChange,
}: {
  value: FileTypeFilter;
  onChange: (value: FileTypeFilter) => void;
}) {
  return (
    <div className="flex h-9 items-center rounded-sm border border-zinc-800 bg-zinc-900 p-0.5">
      <FileText size={14} className="mx-2 text-zinc-500" />
      {(["all", "pdf", "epub"] as FileTypeFilter[]).map((type) => (
        <button
          key={type}
          onClick={() => onChange(type)}
          className={`h-7 cursor-pointer rounded-sm px-2.5 text-xs uppercase transition-colors ${
            value === type
              ? "bg-zinc-700 text-zinc-100 shadow-sm"
              : "text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
          }`}
        >
          {type === "all" ? "Todos" : type}
        </button>
      ))}
    </div>
  );
}

function SortSelect({
  value,
  onChange,
}: {
  value: SortOption;
  onChange: (value: SortOption) => void;
}) {
  return (
    <div className="ml-auto flex h-9 items-center gap-2 rounded-sm border border-zinc-800 bg-zinc-900 px-2">
      <SlidersHorizontal
        size={ICON_SIZE}
        className="text-zinc-500"
        strokeWidth={STROKE_WIDTH}
      />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as SortOption)}
        className="h-7 cursor-pointer rounded-sm bg-transparent text-xs text-zinc-300 outline-none"
      >
        {(Object.keys(sortLabels) as SortOption[]).map((key) => (
          <option key={key} value={key}>
            {sortLabels[key]}
          </option>
        ))}
      </select>
    </div>
  );
}
