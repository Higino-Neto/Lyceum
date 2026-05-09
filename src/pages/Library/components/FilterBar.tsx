import { FileText, Search, SlidersHorizontal, X } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { springFast } from "../../../utils/motionPresets";

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
  title_asc: "Nome A-Z",
  title_desc: "Nome Z-A",
  recent_desc: "Recentes primeiro",
  recent_asc: "Antigos primeiro",
  pages_desc: "Mais paginas",
  pages_asc: "Menos paginas",
  size_desc: "Maior arquivo",
  size_asc: "Menor arquivo",
};

export default function FilterBar({
  search,
  onSearchChange,
  sort,
  onSortChange,
  fileType,
  onFileTypeChange,
}: FilterBarProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.section
      className="mb-4 rounded-sm border border-zinc-800 bg-zinc-950/70 p-2 shadow-sm"
      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.18 }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={onSearchChange} />
        <FileTypeButtons value={fileType} onChange={onFileTypeChange} />
        <SortSelect value={sort} onChange={onSortChange} />
      </div>
    </motion.section>
  );
}

function SearchInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const reduceMotion = useReducedMotion();

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
        <motion.button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-sm text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
          title="Limpar busca"
          initial={reduceMotion ? false : { opacity: 0, y: "-50%" }}
          animate={{ opacity: 1, y: "-50%" }}
          transition={springFast}
        >
          <X size={14} />
        </motion.button>
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
  const reduceMotion = useReducedMotion();

  return (
    <div className="flex h-9 items-center rounded-sm border border-zinc-800 bg-zinc-900 p-0.5">
      <FileText size={14} className="mx-2 text-zinc-500" />
      {(["all", "pdf", "epub"] as FileTypeFilter[]).map((type) => (
        <motion.button
          key={type}
          onClick={() => onChange(type)}
          className={`relative h-7 cursor-pointer rounded-sm px-2.5 text-xs uppercase transition-colors ${
            value === type
              ? "text-zinc-100 shadow-sm"
              : "text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
          }`}
        >
          {value === type && (
            <motion.span
              layoutId="library-filetype-active"
              className="absolute inset-0 rounded-sm bg-zinc-700"
              transition={springFast}
            />
          )}
          <span className="relative z-10">{type === "all" ? "Todos" : type}</span>
        </motion.button>
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
