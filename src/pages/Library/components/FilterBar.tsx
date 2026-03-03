import { Search, SlidersHorizontal } from "lucide-react";

export type SortOption = "title" | "progress" | "pages";
export type FilterOption = "all" | "reading" | "finished";

interface FilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  sort: SortOption;
  onSortChange: (value: SortOption) => void;
  filter: FilterOption;
  onFilterChange: (value: FilterOption) => void;
  categories: string[];
  selectedCategory: string | null;
  onCategoryChange: (value: string | null) => void;
  showCategorySelect: boolean;
}

const filterLabels: Record<FilterOption, string> = {
  all: "Todos",
  reading: "Em leitura",
  finished: "Concluídos",
};

const sortLabels: Record<SortOption, string> = {
  title: "Nome",
  progress: "Progresso",
  pages: "Nº de páginas",
};

export default function FilterBar({
  search,
  onSearchChange,
  sort,
  onSortChange,
  filter,
  onFilterChange,
  categories,
  selectedCategory,
  onCategoryChange,
  showCategorySelect,
}: FilterBarProps) {
  return (
    <section className="flex flex-wrap items-center gap-3">
      {showCategorySelect && categories.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">Categoria:</span>
          <select
            value={selectedCategory || ""}
            onChange={(e) => onCategoryChange(e.target.value || null)}
            className="bg-zinc-900 border cursor-pointer border-zinc-800 text-xs rounded-md px-2 py-1.5"
          >
            <option value="">Todas</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      )}

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
        size={14}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
      />
      <input
        type="text"
        placeholder="Buscar livro..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-zinc-900 border border-zinc-800 rounded-md pl-8 pr-3 py-2 text-sm text-zinc-200"
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
          className={`px-3 py-1.5 rounded-md cursor-pointer text-xs ${
            value === f
              ? "bg-green-600 text-black"
              : "bg-zinc-900 border border-zinc-800 text-zinc-400"
          }`}
        >
          {filterLabels[f]}
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
    <div className="ml-auto flex items-center gap-2">
      <SlidersHorizontal size={13} className="text-zinc-500" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as SortOption)}
        className="bg-zinc-900 border cursor-pointer border-zinc-800 text-xs rounded-md px-2 py-1.5"
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
