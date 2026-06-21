import {
  useEffect,
  useState,
} from "react";
import type {
  BookWithThumbnail,
  ReadingStatus,
} from "../../../types/LibraryTypes";
import { READING_STATUS_OPTIONS } from "../../../lib/readingStatus";
import BookCard from "../../Library/components/BookGrid/BookCard";
import FilterBar, {
  type FileTypeFilter,
  type SortOption,
} from "../../Library/components/FilterBar";
import {
  matchesLibraryBookFileTypes,
  matchesLibraryBookSearch,
  sortLibraryBooks,
} from "../atlasUtils";

interface LibraryPickerDialogProps {
  open: boolean;
  books: BookWithThumbnail[];
  onClose: () => void;
  onSelect: (book: BookWithThumbnail) => void;
}

export function LibraryPickerDialog({ open, books, onClose, onSelect }: LibraryPickerDialogProps) {
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

  if (!open) return null;

  const filtered = sortLibraryBooks(
    books.filter((book) => (
      matchesLibraryBookSearch(book, search) &&
      matchesLibraryBookFileTypes(book, fileType)
    )),
    sort,
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="flex h-[84vh] w-full max-w-6xl flex-col overflow-hidden rounded-sm border border-zinc-800 bg-zinc-950 shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">Adicionar da biblioteca</h2>
            <p className="mt-1 text-xs text-zinc-500">
              {filtered.length} de {books.length} livros disponiveis
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 cursor-pointer rounded-sm border border-zinc-800 px-3 text-xs text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
          >
            Fechar
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
              <div className="flex min-h-72 items-center justify-center rounded-sm border border-dashed border-zinc-800 text-sm text-zinc-500">
                Nenhum livro encontrado.
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

interface ManualBookDialogProps {
  open: boolean;
  initialStatus?: ReadingStatus;
  onClose: () => void;
  onSubmit: (data: { title: string; author?: string | null; status: ReadingStatus }) => void;
}

export function ManualBookDialog({ open, initialStatus = "want_to_read", onClose, onSubmit }: ManualBookDialogProps) {
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [status, setStatus] = useState<ReadingStatus>(initialStatus);

  useEffect(() => {
    if (!open) {
      setTitle("");
      setAuthor("");
      setStatus(initialStatus);
      return;
    }
    setStatus(initialStatus);
  }, [initialStatus, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <form
        className="w-full max-w-md rounded-sm border border-zinc-800 bg-zinc-900 shadow-2xl"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit({ title, author, status });
        }}
      >
        <div className="border-b border-zinc-800 p-4">
          <h2 className="text-sm font-semibold text-zinc-100">Adicionar livro manual</h2>
        </div>
        <div className="space-y-3 p-4">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Titulo"
            className="h-10 w-full rounded-sm border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-200 outline-none focus:border-green-500"
            autoFocus
          />
          <input
            value={author}
            onChange={(event) => setAuthor(event.target.value)}
            placeholder="Autor opcional"
            className="h-10 w-full rounded-sm border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-200 outline-none focus:border-green-500"
          />
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as ReadingStatus)}
            className="h-10 w-full rounded-sm border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-200 outline-none focus:border-green-500"
          >
            {READING_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex justify-end gap-2 border-t border-zinc-800 p-4">
          <button type="button" onClick={onClose} className="h-9 cursor-pointer rounded-sm px-3 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100">
            Cancelar
          </button>
          <button type="submit" className="h-9 cursor-pointer rounded-sm bg-green-500 px-3 text-sm font-medium text-zinc-950 hover:bg-green-400">
            Adicionar
          </button>
        </div>
      </form>
    </div>
  );
}

interface SimpleTextDialogProps {
  open: boolean;
  title: string;
  titlePlaceholder: string;
  descriptionPlaceholder: string;
  submitLabel: string;
  onClose: () => void;
  onSubmit: (values: { title: string; description: string }) => void;
}

export function SimpleTextDialog({
  open,
  title,
  titlePlaceholder,
  descriptionPlaceholder,
  submitLabel,
  onClose,
  onSubmit,
}: SimpleTextDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!open) {
      setName("");
      setDescription("");
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <form
        className="w-full max-w-md rounded-sm border border-zinc-800 bg-zinc-900 shadow-2xl"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit({ title: name, description });
        }}
      >
        <div className="border-b border-zinc-800 p-4">
          <h2 className="text-sm font-semibold text-zinc-100">{title}</h2>
        </div>
        <div className="space-y-3 p-4">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={titlePlaceholder}
            className="h-10 w-full rounded-sm border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-200 outline-none focus:border-green-500"
            autoFocus
          />
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder={descriptionPlaceholder}
            rows={5}
            className="w-full resize-none rounded-sm border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-green-500"
          />
        </div>
        <div className="flex justify-end gap-2 border-t border-zinc-800 p-4">
          <button type="button" onClick={onClose} className="h-9 cursor-pointer rounded-sm px-3 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100">
            Cancelar
          </button>
          <button type="submit" className="h-9 cursor-pointer rounded-sm bg-green-500 px-3 text-sm font-medium text-zinc-950 hover:bg-green-400">
            {submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
