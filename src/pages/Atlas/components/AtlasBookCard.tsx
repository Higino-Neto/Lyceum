import {
  BookOpen,
  CalendarDays,
  FileText,
  StickyNote,
  Star,
} from "lucide-react";
import type {
  BookWithThumbnail,
  ReadingStatus,
} from "../../../types/LibraryTypes";
import { getEffectiveReadingStatus } from "../../../lib/readingStatus";
import {
  getBookFolderLabel,
  getTitleWithoutExtension,
} from "../../Library/utils";
import { calculateProgress } from "../../Library/components/BookGrid/progress";
import { useLazyThumbnail } from "../../Library/components/BookGrid/useLazyThumbnail";
import ReadingStatusSelector from "./ReadingStatusSelector";

interface AtlasBookCardProps {
  book: BookWithThumbnail;
  variant: ReadingStatus;
  onOpen: (book: BookWithThumbnail) => void;
  onStatusChange: (book: BookWithThumbnail, status: ReadingStatus) => void;
  statusBusy?: boolean;
}

function formatProgress(book: BookWithThumbnail): string {
  const progress = Math.round(calculateProgress(book));
  if (!book.numPages || book.numPages <= 1) {
    return `${progress}%`;
  }
  return `${progress}% - pagina ${Math.max(1, book.currentPage || 1)} de ${book.numPages}`;
}

function formatRating(rating: number | null | undefined): string {
  if (!rating || rating <= 0) {
    return "Sem nota";
  }
  return `${Number(rating).toFixed(1).replace(/\.0$/, "")}/5`;
}

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "Data pendente";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Data pendente";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function BookCover({
  book,
  size,
}: {
  book: BookWithThumbnail;
  size: "small" | "large";
}) {
  const { thumbnail, thumbnailRef } = useLazyThumbnail(book);
  const className = size === "large"
    ? "h-24 w-16"
    : "h-14 w-10";

  return (
    <div
      ref={thumbnailRef}
      className={`${className} flex flex-shrink-0 items-center justify-center overflow-hidden rounded-sm border border-zinc-800 bg-zinc-950`}
    >
      {thumbnail ? (
        <img src={thumbnail} alt={book.title} className="h-full w-full object-contain" />
      ) : (
        <FileText size={size === "large" ? 22 : 16} className="text-zinc-600" />
      )}
    </div>
  );
}

export default function AtlasBookCard({
  book,
  variant,
  onOpen,
  onStatusChange,
  statusBusy = false,
}: AtlasBookCardProps) {
  const status = getEffectiveReadingStatus(book);
  const title = getTitleWithoutExtension(book.title, book.fileType);
  const notesAvailable = Boolean(book.notes?.trim());

  if (variant === "want_to_read") {
    return (
      <article className="flex items-center gap-3 rounded-sm border border-zinc-800 bg-zinc-950/60 p-2">
        <BookCover book={book} size="small" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-medium text-zinc-200">{title}</h3>
          <p className="mt-1 truncate text-xs text-zinc-500">
            {book.author || getBookFolderLabel(book.filePath)}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <ReadingStatusSelector
              value={status}
              label={title}
              disabled={statusBusy}
              onChange={(nextStatus) => onStatusChange(book, nextStatus)}
            />
            <button
              type="button"
              onClick={() => onOpen(book)}
              className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-sm px-2 text-xs text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
            >
              <BookOpen size={13} />
              Abrir
            </button>
          </div>
        </div>
      </article>
    );
  }

  if (variant === "reading") {
    const progress = Math.round(calculateProgress(book));

    return (
      <article className="rounded-sm border border-zinc-800 bg-zinc-950/70 p-3">
        <div className="flex gap-3">
          <BookCover book={book} size="large" />
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 text-sm font-medium leading-5 text-zinc-100">{title}</h3>
            <p className="mt-1 truncate text-xs text-zinc-500">
              {book.author || getBookFolderLabel(book.filePath)}
            </p>
            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-zinc-400">Progresso</span>
                <span className="font-medium text-green-300">{formatProgress(book)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-sm bg-zinc-800">
                <div
                  className="h-full rounded-sm bg-green-500"
                  style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                />
              </div>
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <ReadingStatusSelector
            value={status}
            label={title}
            disabled={statusBusy}
            onChange={(nextStatus) => onStatusChange(book, nextStatus)}
          />
          <button
            type="button"
            onClick={() => onOpen(book)}
            className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-sm bg-green-500 px-3 text-xs font-medium text-zinc-950 transition-colors hover:bg-green-400"
          >
            <BookOpen size={13} />
            Continuar
          </button>
        </div>
      </article>
    );
  }

  return (
    <article className="rounded-sm border border-zinc-800 bg-zinc-950/70 p-3">
      <div className="flex gap-3">
        <BookCover book={book} size="small" />
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-sm font-medium leading-5 text-zinc-100">{title}</h3>
          <p className="mt-1 truncate text-xs text-zinc-500">
            {book.author || getBookFolderLabel(book.filePath)}
          </p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-zinc-400">
        <div className="rounded-sm border border-zinc-800 bg-zinc-900 px-2 py-2">
          <div className="mb-1 flex items-center gap-1 text-zinc-500">
            <Star size={12} />
            Nota
          </div>
          <span className="text-zinc-200">{formatRating(book.rating)}</span>
        </div>
        <div className="rounded-sm border border-zinc-800 bg-zinc-900 px-2 py-2">
          <div className="mb-1 flex items-center gap-1 text-zinc-500">
            <CalendarDays size={12} />
            Conclusao
          </div>
          <span className="text-zinc-200">{formatDate(book.completedAt)}</span>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2 rounded-sm border border-zinc-800 bg-zinc-900 px-2 py-2 text-xs">
        <StickyNote size={13} className={notesAvailable ? "text-sky-300" : "text-zinc-600"} />
        <span className={notesAvailable ? "text-zinc-300" : "text-zinc-500"}>
          {notesAvailable ? "Notas registradas" : "Espaco para notas futuras"}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <ReadingStatusSelector
          value={status}
          label={title}
          disabled={statusBusy}
          onChange={(nextStatus) => onStatusChange(book, nextStatus)}
        />
        <button
          type="button"
          onClick={() => onOpen(book)}
          className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-sm px-2 text-xs text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
        >
          <BookOpen size={13} />
          Abrir
        </button>
      </div>
    </article>
  );
}
