import { ChevronDown, FileText, Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type {
  LibraryFileTypeFilter,
  LibrarySortOption,
} from "../../../types/LibraryTypes";
import { useTranslation, type TranslationKey } from "../../../i18n";

const ICON_SIZE = 15;
const STROKE_WIDTH = 1.6;

export type SortOption = Exclude<LibrarySortOption, "title" | "recent" | "pages" | "size">;
export type FileTypeFilter = LibraryFileTypeFilter;

interface FilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  sort: SortOption;
  onSortChange: (value: SortOption) => void;
  fileType: FileTypeFilter[];
  onFileTypeChange: (value: FileTypeFilter[]) => void;
}

const sortLabelKeys: Record<SortOption, TranslationKey> = {
  recent_desc: "library:filters.sort.recent_desc",
  recent_asc: "library:filters.sort.recent_asc",
  title_asc: "library:filters.sort.title_asc",
  title_desc: "library:filters.sort.title_desc",
  pages_desc: "library:filters.sort.pages_desc",
  pages_asc: "library:filters.sort.pages_asc",
  size_desc: "library:filters.sort.size_desc",
  size_asc: "library:filters.sort.size_asc",
  author_asc: "library:filters.sort.author_asc",
  author_desc: "library:filters.sort.author_desc",
  series_asc: "library:filters.sort.series_asc",
  series_desc: "library:filters.sort.series_desc",
  rating_desc: "library:filters.sort.rating_desc",
  rating_asc: "library:filters.sort.rating_asc",
  type_asc: "library:filters.sort.type_asc",
  type_desc: "library:filters.sort.type_desc",
  added_desc: "library:filters.sort.added_desc",
  added_asc: "library:filters.sort.added_asc",
};

/** Sorts offered in the dropdown; the rest are reachable from list-view column headers. */
const sortMenuOptions: SortOption[] = [
  "recent_desc",
  "recent_asc",
  "added_desc",
  "title_asc",
  "title_desc",
  "author_asc",
  "series_asc",
  "rating_desc",
  "pages_desc",
  "pages_asc",
  "size_desc",
  "size_asc",
];

const fileTypeLabels: Record<Exclude<FileTypeFilter, "all">, string> = {
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
  fb2: "FB2",
  cbr: "CBR",
  lyceum: "LYCEUM",
};

const allFileTypes = Object.keys(fileTypeLabels) as FileTypeFilter[];

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
  const { t } = useTranslation();

  return (
    <div className="relative min-w-0 flex-[1_1_220px]">
      <Search
        size={ICON_SIZE}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-subtle"
        strokeWidth={STROKE_WIDTH}
      />
      <input
        type="text"
        placeholder={t("library:filters.searchPlaceholder")}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-sm border border-border bg-surface pl-9 pr-9 text-sm text-foreground outline-none placeholder:text-input-placeholder transition-colors focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-focus-ring"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-sm text-foreground-subtle hover:bg-surface-muted hover:text-foreground"
          title={t("library:filters.clearSearch")}
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
  const { t } = useTranslation();
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

  const options = sortMenuOptions.includes(value) ? sortMenuOptions : [value, ...sortMenuOptions];

  return (
    <div ref={ref} className="relative min-w-0 flex-[1_1_140px] sm:ml-auto sm:flex-none">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="flex h-9 w-full cursor-pointer items-center gap-1.5 rounded-sm border border-border bg-surface px-2 text-xs text-foreground hover:border-border-strong sm:w-auto"
      >
        <SlidersHorizontal size={ICON_SIZE} className="shrink-0 text-foreground-subtle" strokeWidth={STROKE_WIDTH} />
        <span className="min-w-0 flex-1 truncate text-left sm:min-w-[90px]">
          {t(sortLabelKeys[value])}
        </span>
        <ChevronDown size={12} className={`shrink-0 text-foreground-subtle transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 min-w-[180px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-sm border border-border-strong bg-surface shadow-xl">
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => {
                onChange(opt);
                setOpen(false);
              }}
              className={`flex w-full cursor-pointer items-center px-3 py-2 text-left text-xs transition-colors hover:bg-surface-muted hover:text-foreground ${
                value === opt ? "text-primary" : "text-foreground"
              }`}
            >
              {opt === value ? (
                <span className="mr-2 text-primary">✓</span>
              ) : (
                <span className="mr-2 w-3" />
              )}
              {t(sortLabelKeys[opt])}
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
  const { t } = useTranslation();
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

  const summary =
    value.length === 0
      ? t("library:filters.fileTypes.all")
      : value.length === 1
        ? fileTypeLabels[value[0]]
        : value.length <= 2
          ? value.map((type) => fileTypeLabels[type]).join(", ")
          : t("library:filters.fileTypes.multiple", { count: value.length });

  return (
    <div ref={ref} className="relative min-w-0 flex-[1_1_120px] sm:flex-none">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className={`flex h-9 w-full cursor-pointer items-center gap-1.5 rounded-sm border px-2 text-xs transition-colors sm:w-auto ${
          value.length > 0
            ? "border-primary/50 bg-primary-muted text-primary"
            : "border-border bg-surface text-foreground hover:border-border-strong"
        }`}
      >
        <FileText size={14} className="shrink-0 text-foreground-subtle" />
        <span className="min-w-0 flex-1 truncate text-left sm:min-w-[50px]">{summary}</span>
        <ChevronDown size={12} className={`shrink-0 text-foreground-subtle transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 max-h-72 min-w-[180px] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-sm border border-border-strong bg-surface shadow-xl">
          <button
            type="button"
            onClick={value.length === allFileTypes.length ? deselectAll : selectAll}
            className="flex w-full cursor-pointer items-center gap-2 border-b border-border px-3 py-2 text-xs text-foreground-muted transition-colors hover:text-foreground"
          >
            {value.length === allFileTypes.length
              ? t("library:filters.fileTypes.deselectAll")
              : t("library:filters.fileTypes.selectAll")}
          </button>
          {allFileTypes.map((type) => {
            const selected = value.includes(type);
            return (
              <button
                key={type}
                type="button"
                onClick={() => toggleType(type)}
                className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-xs text-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
              >
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border transition-colors ${
                    selected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border-strong bg-transparent"
                  }`}
                >
                  {selected && <span className="text-[10px] font-bold">✓</span>}
                </span>
                {type === "all" ? t("library:filters.fileTypes.all") : fileTypeLabels[type]}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
