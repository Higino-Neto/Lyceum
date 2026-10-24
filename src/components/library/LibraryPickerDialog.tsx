import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import type {
  BookWithThumbnail,
} from "../../types/LibraryTypes";
import BookCard from "../../pages/Library/components/BookGrid/BookCard";
import FilterBar, {
  type FileTypeFilter,
  type SortOption,
} from "../../pages/Library/components/FilterBar";
import {
  matchesLibraryBookFileTypes,
  matchesLibraryBookSearch,
  sortLibraryBooks,
} from "../../pages/Atlas/atlasUtils";

interface LibraryPickerDialogProps {
  open: boolean;
  books: BookWithThumbnail[];
  onClose: () => void;
  onSelect: (book: BookWithThumbnail) => void;
  title?: string;
  description?: string;
}

export function LibraryPickerDialog({ 
  open, 
  books, 
  onClose, 
  onSelect,
  title,
  description
}: LibraryPickerDialogProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("title_asc");
  const [fileType, setFileType] = useState<FileTypeFilter[]>([]);

  useEffect(() => {
    if (!open) {
      setSearch("");
      setSort("title_asc");
      setFileType([]);
    }
  }, [open]);

  const filtered = useMemo(() => sortLibraryBooks(
    books.filter((book) => (
      matchesLibraryBookSearch(book, search) &&
      matchesLibraryBookFileTypes(book, fileType)
    )),
    sort,
  ), [books, search, fileType, sort]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-backdrop px-4">
      <div className="flex h-[84vh] w-full max-w-6xl flex-col overflow-hidden rounded-sm border border-border bg-background shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              {title || t("atlas:libraryPicker.title")}
            </h2>
            <p className="mt-1 text-xs text-foreground-subtle">
              {description || t("atlas:libraryPicker.count", {
                count: filtered.length,
                total: books.length,
              })}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 cursor-pointer rounded-sm border border-border px-3 text-xs text-foreground-muted hover:bg-surface hover:text-foreground"
          >
            {t("atlas:libraryPicker.close")}
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col p-4">
          <FilterBar
            search={search}
            onSearchChange={setSearch}
            sort={sort}
            onSortChange={setSort}
            fileType={fileType}
            onFileTypeChange={setFileType}
          />
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {filtered.length === 0 ? (
              <div className="flex min-h-72 items-center justify-center rounded-sm border border-dashed border-border text-sm text-foreground-subtle">
                {t("atlas:libraryPicker.empty")}
              </div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-4 pb-2">
                {filtered.map((book) => (
                  <BookCard
                    key={book.fileHash}
                    book={book}
                    onOpen={onSelect}
                    onClick={onSelect}
                    showSyncActions={false}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default LibraryPickerDialog;
