import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import { Check, Folder, FolderOpen, Library, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { BookWithThumbnail, ReadingStatus } from "../../types/LibraryTypes";
import BookCard from "../../pages/Library/components/BookGrid/BookCard";
import FilterBar, {
  type FileTypeFilter,
  type SortOption,
} from "../../pages/Library/components/FilterBar";
import {
  getDisplayReadingStatus,
  getReadingStatusIcon,
} from "../../pages/Library/components/BookGrid/bookStatus";
import type { SelectionModifiers } from "../../pages/Library/components/BookGrid/selectionModifiers";
import {
  LIBRARY_STATUS_FILTER_VALUES,
  READING_STATUS_LABEL_KEYS,
} from "../../lib/readingStatus";
import AnimatedModal from "../ui/AnimatedModal";
import {
  buildPickerFolders,
  matchesLibraryBookFileTypes,
  matchesLibraryBookSearch,
  matchesPickerFolder,
  sortLibraryBooks,
} from "./libraryPickerFilters";

interface LibraryPickerDialogProps {
  open: boolean;
  books: BookWithThumbnail[];
  onClose: () => void;
  /** Single mode: called as soon as a book is clicked. */
  onSelect?: (book: BookWithThumbnail) => void;
  /**
   * Multi mode: books are toggled (Ctrl/Shift supported) and confirmed with
   * the footer button.
   */
  multiple?: boolean;
  onSelectMany?: (books: BookWithThumbnail[]) => void;
  title?: string;
  description?: string;
}

/**
 * Reusable "Add from library" dialog: search, file type, reading status and
 * folder filters over the whole library, with single or multiple selection.
 */
export function LibraryPickerDialog({
  open,
  books,
  onClose,
  onSelect,
  multiple = false,
  onSelectMany,
  title,
  description,
}: LibraryPickerDialogProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("title_asc");
  const [fileType, setFileType] = useState<FileTypeFilter[]>([]);
  const [statuses, setStatuses] = useState<ReadingStatus[]>([]);
  const [folder, setFolder] = useState<string | null>(null);
  const [selected, setSelected] = useState<Map<string, BookWithThumbnail>>(() => new Map());
  const anchorRef = useRef<string | null>(null);

  useEffect(() => {
    if (open) return;
    setSearch("");
    setSort("title_asc");
    setFileType([]);
    setStatuses([]);
    setFolder(null);
    setSelected(new Map());
    anchorRef.current = null;
  }, [open]);

  const folders = useMemo(() => buildPickerFolders(books), [books]);

  const filtered = useMemo(() => sortLibraryBooks(
    books.filter((book) => (
      matchesPickerFolder(book, folder)
      && matchesLibraryBookSearch(book, search)
      && matchesLibraryBookFileTypes(book, fileType)
      && (statuses.length === 0 || statuses.includes(getDisplayReadingStatus(book)))
    )),
    sort,
  ), [books, folder, search, fileType, statuses, sort]);

  const toggleStatus = (status: ReadingStatus) => {
    setStatuses((current) => (
      current.includes(status) ? current.filter((value) => value !== status) : [...current, status]
    ));
  };

  const handleBook = useCallback((book: BookWithThumbnail, modifiers?: SelectionModifiers) => {
    if (!multiple) {
      onSelect?.(book);
      return;
    }
    if (modifiers?.shiftKey && anchorRef.current) {
      const from = filtered.findIndex((item) => item.fileHash === anchorRef.current);
      const to = filtered.findIndex((item) => item.fileHash === book.fileHash);
      if (from >= 0 && to >= 0) {
        const range = filtered.slice(Math.min(from, to), Math.max(from, to) + 1);
        setSelected((current) => {
          const next = new Map(current);
          for (const item of range) next.set(item.fileHash, item);
          return next;
        });
        return;
      }
    }
    anchorRef.current = book.fileHash;
    setSelected((current) => {
      const next = new Map(current);
      if (next.has(book.fileHash)) next.delete(book.fileHash);
      else next.set(book.fileHash, book);
      return next;
    });
  }, [filtered, multiple, onSelect]);

  const allVisibleSelected = filtered.length > 0 && filtered.every((book) => selected.has(book.fileHash));
  const toggleAllVisible = () => {
    setSelected((current) => {
      const next = new Map(current);
      for (const book of filtered) {
        if (allVisibleSelected) next.delete(book.fileHash);
        else next.set(book.fileHash, book);
      }
      return next;
    });
  };

  const confirm = () => {
    if (selected.size === 0) return;
    onSelectMany?.([...selected.values()]);
  };

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (multiple && event.key === "Enter" && (event.ctrlKey || event.metaKey)) confirm();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  const folderButton = (key: string | null, label: string, count: number, depth = 0, titleText?: string) => {
    const active = folder === key;
    const Icon = key === null ? Library : active ? FolderOpen : Folder;
    return (
      <button
        key={key ?? "__all__"}
        type="button"
        onClick={() => setFolder(key)}
        title={titleText ?? label}
        className={`flex w-full items-center gap-2 rounded-sm py-1.5 pr-2 text-left text-xs transition-colors ${
          active ? "bg-surface-muted text-foreground" : "text-foreground-muted hover:bg-surface-muted/60 hover:text-foreground"
        }`}
        style={{ paddingLeft: 8 + depth * 12 }}
      >
        <Icon size={14} className={active ? "text-primary" : "text-foreground-subtle"} />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <span className="text-[10px] tabular-nums text-foreground-subtle">{count}</span>
      </button>
    );
  };

  return (
    <AnimatedModal
      open={open}
      ariaLabelledBy="library-picker-title"
      onBackdropClick={onClose}
      backdropClassName="px-4"
      className="flex h-[86vh] w-full max-w-6xl flex-col overflow-hidden rounded-sm border border-border bg-background shadow-2xl"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h2 id="library-picker-title" className="text-sm font-semibold text-foreground">
            {title || t("library:picker.title")}
          </h2>
          <p className="mt-1 text-xs text-foreground-subtle">
            {description || t("library:picker.count", { count: filtered.length, total: books.length })}
            {multiple && <span className="ml-2 hidden sm:inline">· {t("library:picker.multiHint")}</span>}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("library:picker.close")}
          className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-sm text-foreground-muted hover:bg-surface hover:text-foreground"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-56 shrink-0 flex-col border-r border-border bg-surface/40 md:flex">
          <p className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wide text-foreground-subtle">
            {t("library:picker.folders")}
          </p>
          <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
            {folderButton(null, t("library:picker.allFolders"), books.length)}
            {folders.map((item) => folderButton(item.key, item.label, item.count, item.depth, item.key))}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col p-4">
          <FilterBar
            search={search}
            onSearchChange={setSearch}
            sort={sort}
            onSortChange={setSort}
            fileType={fileType}
            onFileTypeChange={setFileType}
          />
          <div className="-mt-1 mb-3 flex flex-wrap items-center gap-1.5">
            {LIBRARY_STATUS_FILTER_VALUES.map((status) => {
              const active = statuses.includes(status);
              const icon = getReadingStatusIcon(status);
              return (
                <button
                  key={status}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleStatus(status)}
                  className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors ${
                    active
                      ? "border-primary/60 bg-primary-muted text-foreground"
                      : "border-border text-foreground-muted hover:border-border-strong hover:text-foreground"
                  }`}
                >
                  {icon && <icon.Icon size={12} className={icon.color} />}
                  {t(READING_STATUS_LABEL_KEYS[status])}
                </button>
              );
            })}
            {(statuses.length > 0 || folder !== null) && (
              <button
                type="button"
                onClick={() => {
                  setStatuses([]);
                  setFolder(null);
                }}
                className="h-7 rounded-full px-2.5 text-xs text-foreground-subtle hover:text-foreground"
              >
                {t("library:picker.clearFilters")}
              </button>
            )}
            {multiple && filtered.length > 0 && (
              <button
                type="button"
                onClick={toggleAllVisible}
                className="ml-auto inline-flex h-7 items-center gap-1.5 rounded-sm border border-border px-2.5 text-xs text-foreground-muted hover:bg-surface-muted hover:text-foreground"
              >
                <Check size={12} />
                {allVisibleSelected ? t("library:picker.deselectVisible") : t("library:picker.selectVisible", { count: filtered.length })}
              </button>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {filtered.length === 0 ? (
              <div className="flex min-h-72 items-center justify-center rounded-sm border border-dashed border-border text-sm text-foreground-subtle">
                {t("library:picker.empty")}
              </div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-4 pb-2">
                {filtered.map((book) => (
                  <BookCard
                    key={book.fileHash}
                    book={book}
                    onOpen={(item) => handleBook(item)}
                    onClick={(item) => handleBook(item)}
                    onToggleSelection={(item, modifiers) => handleBook(item, modifiers)}
                    onContextSelect={multiple ? (item, modifiers) => handleBook(item, modifiers) : undefined}
                    selectionMode={multiple}
                    selectedFilesKey={selected.has(book.fileHash) ? book.fileHash : ""}
                    selectedCount={selected.size}
                    showSyncActions={false}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {multiple && (
        <div className="flex items-center justify-between gap-3 border-t border-border bg-surface/40 px-4 py-3">
          <span className="text-xs text-foreground-muted">
            {t("library:picker.selected", { count: selected.size })}
          </span>
          <div className="flex items-center gap-2">
            {selected.size > 0 && (
              <button
                type="button"
                onClick={(event: MouseEvent) => {
                  event.stopPropagation();
                  setSelected(new Map());
                }}
                className="h-9 rounded-sm px-3 text-sm text-foreground-muted hover:bg-surface-muted hover:text-foreground"
              >
                {t("library:picker.clearSelection")}
              </button>
            )}
            <button
              type="button"
              disabled={selected.size === 0}
              onClick={confirm}
              className="h-9 rounded-sm bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("library:picker.addSelected", { count: selected.size })}
            </button>
          </div>
        </div>
      )}
    </AnimatedModal>
  );
}

export default LibraryPickerDialog;
