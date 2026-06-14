import { ChevronDown, FileText, Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const ICON_SIZE = 15;
const STROKE_WIDTH = 1.6;

export type SortOption =
  | "title_asc"
  | "title_desc"
  | "recent_desc"
  | "recent_asc"
  | "pages_desc"
  | "pages_asc"
  | "size_desc"
  | "size_asc";
export type FileTypeFilter =
  | "all"
  | "pdf"
  | "epub"
  | "docx"
  | "html"
  | "cbz"
  | "mobi"
  | "azw"
  | "azw3"
  | "azw4"
  | "kfx"
  | "prc"
  | "txt"
  | "lyceum";

interface FilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  sort: SortOption;
  onSortChange: (value: SortOption) => void;
  fileType: FileTypeFilter[];
  onFileTypeChange: (value: FileTypeFilter[]) => void;
}

const sortLabels: Record<SortOption, string> = {
  title_asc: "Nome A-Z",
  title_desc: "Nome Z-A",
  recent_desc: "Recentes primeiro",
  recent_asc: "Antigos primeiro",
  pages_desc: "Mais paginas",
  pages_asc: "Menos paginas",
  size_desc: "Maior arquivo",
  size_asc: "Menor arquivo",
};

const fileTypeLabels: Record<FileTypeFilter, string> = {
  all: "Todos",
  pdf: "PDF",
  epub: "EPUB",
  docx: "DOCX",
  html: "HTML",
  cbz: "CBZ",
  mobi: "MOBI",
  azw: "AZW",
  azw3: "AZW3",
  azw4: "AZW4",
  kfx: "KFX",
  prc: "PRC",
  txt: "TXT",
  lyceum: "LYCEUM",
};

const allFileTypes = Object.keys(fileTypeLabels).filter((t) => t !== "all") as FileTypeFilter[];

export default function FilterBar({
  search,
  onSearchChange,
  sort,
  onSortChange,
  fileType,
  onFileTypeChange,
}: FilterBarProps) {
  return (
    <section className="mb-3 rounded-sm shadow-sm sm:mb-4">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={onSearchChange} />
        <FileTypeSelect value={fileType} onChange={onFileTypeChange} />
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
    <div className="relative min-w-0 flex-[1_1_220px]">
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

function SortSelect({
  value,
  onChange,
}: {
  value: SortOption;
  onChange: (value: SortOption) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const options = Object.keys(sortLabels) as SortOption[];

  return (
    <div ref={ref} className="relative min-w-0 flex-[1_1_140px] sm:ml-auto sm:flex-none">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="flex h-9 w-full cursor-pointer items-center gap-1.5 rounded-sm border border-zinc-800 bg-zinc-900 px-2 text-xs text-zinc-300 hover:border-zinc-700 sm:w-auto"
      >
        <SlidersHorizontal size={ICON_SIZE} className="shrink-0 text-zinc-500" strokeWidth={STROKE_WIDTH} />
        <span className="min-w-0 flex-1 truncate text-left sm:min-w-[90px]">{sortLabels[value]}</span>
        <ChevronDown size={12} className={`shrink-0 text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 min-w-[180px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-sm border border-zinc-700 bg-zinc-900 shadow-xl">
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => {
                onChange(opt);
                setOpen(false);
              }}
              className={`flex w-full cursor-pointer items-center px-3 py-2 text-left text-xs transition-colors hover:bg-zinc-800 hover:text-zinc-100 ${
                value === opt ? "text-green-400" : "text-zinc-300"
              }`}
            >
              {opt === value ? (
                <span className="mr-2 text-green-400">✓</span>
              ) : (
                <span className="mr-2 w-3" />
              )}
              {sortLabels[opt]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function FileTypeSelect({
  value,
  onChange,
}: {
  value: FileTypeFilter[];
  onChange: (value: FileTypeFilter[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const toggleType = (type: FileTypeFilter) => {
    const next = value.includes(type) ? value.filter((t) => t !== type) : [...value, type];
    onChange(next);
  };

  const selectAll = () => onChange([...allFileTypes]);
  const deselectAll = () => onChange([]);

  const summary = value.length === 0
    ? "Todos"
    : value.length === 1
      ? fileTypeLabels[value[0]]
      : value.length <= 2
        ? value.map((t) => fileTypeLabels[t]).join(", ")
        : `${value.length} tipos`;

  return (
    <div ref={ref} className="relative min-w-0 flex-[1_1_120px] sm:flex-none">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className={`flex h-9 w-full cursor-pointer items-center gap-1.5 rounded-sm border px-2 text-xs transition-colors sm:w-auto ${
          value.length > 0
            ? "border-green-500/50 bg-green-500/10 text-green-200"
            : "border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700"
        }`}
      >
        <FileText size={14} className="shrink-0 text-zinc-500" />
        <span className="min-w-0 flex-1 truncate text-left sm:min-w-[50px]">{summary}</span>
        <ChevronDown size={12} className={`shrink-0 text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 max-h-72 min-w-[180px] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-sm border border-zinc-700 bg-zinc-900 shadow-xl">
          <button
            type="button"
            onClick={value.length === allFileTypes.length ? deselectAll : selectAll}
            className="flex w-full cursor-pointer items-center gap-2 border-b border-zinc-800 px-3 py-2 text-xs text-zinc-400 transition-colors hover:text-zinc-200"
          >
            {value.length === allFileTypes.length ? "Desmarcar todos" : "Selecionar todos"}
          </button>
          {allFileTypes.map((type) => {
            const selected = value.includes(type);
            return (
              <button
                key={type}
                type="button"
                onClick={() => toggleType(type)}
                className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-xs text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
              >
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border transition-colors ${
                    selected
                      ? "border-green-500 bg-green-500 text-zinc-950"
                      : "border-zinc-700 bg-transparent"
                  }`}
                >
                  {selected && <span className="text-[10px] font-bold">✓</span>}
                </span>
                {fileTypeLabels[type]}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
