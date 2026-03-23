import { Search, SlidersHorizontal, Library, BookOpen, CheckCircle } from "lucide-react";

const ICON_SIZE = 16;
const STROKE_WIDTH = 1.5;

export type SortOption = "title" | "progress" | "pages" | "rating" | "recent";
export type FilterOption = "all" | "reading" | "finished";

interface FilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  sort: SortOption;
  onSortChange: (value: SortOption) => void;
  filter: FilterOption;
  onFilterChange: (value: FilterOption) => void;
}

const filterIcons: Record<FilterOption, React.ReactNode> = {
  all: <Library size={ICON_SIZE} strokeWidth={STROKE_WIDTH} />,
  reading: <BookOpen size={ICON_SIZE} strokeWidth={STROKE_WIDTH} />,
  finished: <CheckCircle size={ICON_SIZE} strokeWidth={STROKE_WIDTH} />,
};

const filterLabels: Record<FilterOption, string> = {
  all: "Todos",
  reading: "Lendo",
  finished: "Feito",
};

const sortLabels: Record<SortOption, string> = {
  title: "Nome",
  progress: "Progresso",
  pages: "Nº Páginas",
  rating: "Avaliação",
  recent: "Recentes",
};

export default function FilterBar({
  search,
  onSearchChange,
  sort,
  onSortChange,
  filter,
  onFilterChange,
}: FilterBarProps) {
  return (
    <section className="flex flex-wrap items-center gap-3">
      <SearchInput value={search} onChange={onSearchChange} />

      <FilterButtons value={filter} onChange={onFilterChange} />

      <SortSelect value={sort} onChange={onSortChange} />
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
    <div className="relative flex-1 min-w-48 max-w-72">
      <Search
        size={ICON_SIZE}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
        strokeWidth={STROKE_WIDTH}
      />
      <input
        type="text"
        placeholder="Buscar livros..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-zinc-900 border border-zinc-800 rounded-sm pl-8 pr-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600"
      />
    </div>
  );
}

function FilterButtons({
  value,
  onChange,
}: {
  value: FilterOption;
  onChange: (value: FilterOption) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {(Object.keys(filterLabels) as FilterOption[]).map((f) => (
        <button
          key={f}
          onClick={() => onChange(f)}
          className={`px-3 py-1.5 rounded-sm cursor-pointer text-xs flex items-center gap-1.5 transition-colors ${
            value === f
              ? "bg-zinc-700 text-zinc-100"
              : "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200"
          }`}
          aria-label={filterLabels[f]}
        >
          {filterIcons[f]}
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
    <div className="flex items-center gap-2">
      <SlidersHorizontal size={ICON_SIZE} className="text-zinc-500" strokeWidth={STROKE_WIDTH} />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as SortOption)}
        className="bg-zinc-900 border cursor-pointer border-zinc-800 text-xs rounded-sm px-2 py-1.5"
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
