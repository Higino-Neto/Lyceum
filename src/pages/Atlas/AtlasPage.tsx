import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type DragEvent as ReactDragEvent,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AtomicCodeMirrorEditor } from "@atomic-editor/editor";
import "@atomic-editor/editor/styles.css";
import {
  BookMarked,
  BookOpen,
  CheckCircle2,
  Circle,
  Edit3,
  FileText,
  FolderOpen,
  GripVertical,
  MoreVertical,
  Minus,
  NotebookText,
  Plus,
  RefreshCw,
  Save,
  Search,
  Star,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import useGetReadings from "../../hooks/useGetReadings";
import type {
  BookWithThumbnail,
  LibraryListResult,
  ReadingMapItem,
  ReadingMapPayload,
  ReadingMapSectionWithItems,
  ReadingStatus,
  ReadingStatusItem,
  ReadingStatusPayload,
} from "../../types/LibraryTypes";
import type TableReading from "../../types/TableReading";
import { READING_STATUS_OPTIONS } from "../../lib/readingStatus";
import {
  calculateSimilarity,
  formatPageCount,
  getBookFolderLabel,
  getFileTypeLabel,
  getTitleWithoutExtension,
} from "../Library/utils";
import { useLazyThumbnail } from "../Library/components/BookGrid/useLazyThumbnail";
import BookCard from "../Library/components/BookGrid/BookCard";
import BookMetadataSearchDialog, {
  type BookMetadataSavePayload,
} from "../Library/components/BookMetadataSearchDialog";
import FilterBar, {
  type FileTypeFilter,
  type SortOption,
} from "../Library/components/FilterBar";
import SetThumbnailDialog from "../../components/SetThumbnailDialog";

const ATLAS_BOOKS_QUERY_KEY = ["atlas-books"] as const;
const ATLAS_MAP_QUERY_KEY = "atlas-reading-map";
const ATLAS_STATUS_QUERY_KEY = ["atlas-status-items"] as const;

type AtlasView = "roadmap" | "status";
type StatusFilter = "all" | ReadingStatus;
type DropTarget = {
  sectionId: string;
  index: number;
} | null;
type StatusDropTarget = {
  status: ReadingStatus;
  index: number;
} | null;
type AddTarget =
  | { kind: "roadmap"; sectionId: string }
  | { kind: "status"; status: ReadingStatus };

const STATUS_VISUAL: Record<ReadingStatus, {
  label: string;
  detail: string;
  dot: string;
  text: string;
  border: string;
  bg: string;
}> = {
  want_to_read: {
    label: "Fila",
    detail: "Reservado",
    dot: "bg-zinc-400",
    text: "text-zinc-300",
    border: "border-zinc-700",
    bg: "bg-zinc-900",
  },
  reading: {
    label: "Lendo",
    detail: "Leitura ativa",
    dot: "bg-sky-400",
    text: "text-sky-300",
    border: "border-sky-500/40",
    bg: "bg-sky-500/10",
  },
  paused: {
    label: "Pausado",
    detail: "Em espera",
    dot: "bg-amber-400",
    text: "text-amber-300",
    border: "border-amber-500/40",
    bg: "bg-amber-500/10",
  },
  read: {
    label: "Concluido",
    detail: "Fechado",
    dot: "bg-green-400",
    text: "text-green-300",
    border: "border-green-500/40",
    bg: "bg-green-500/10",
  },
};

function statusLabel(status: ReadingStatus): string {
  return STATUS_VISUAL[status].label;
}

async function fetchAtlasBooks(): Promise<BookWithThumbnail[]> {
  const books: BookWithThumbnail[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const page = await window.api.listBooks({
      section: "all",
      search: "",
      sort: "title_asc",
      fileType: "all",
      folderPath: null,
      limit: 200,
      offset,
    }) as LibraryListResult;

    books.push(...page.items);
    hasMore = page.hasMore;
    offset = page.offset + page.limit;
  }

  return books;
}

async function fetchReadingMap(mapId?: string | null): Promise<ReadingMapPayload> {
  const result = await window.api.getReadingMap(mapId ?? null);
  if (!result.success || !result.payload) {
    throw new Error(result.error || "Erro ao carregar mapa de leitura");
  }
  return result.payload;
}

async function fetchReadingStatusItems(): Promise<ReadingStatusPayload> {
  const result = await window.api.getReadingStatusItems();
  if (!result.success || !result.payload) {
    throw new Error(result.error || "Erro ao carregar estados de leitura");
  }
  return result.payload;
}

function emptyMessage(status: ReadingStatus): string {
  if (status === "want_to_read") return "Nenhum livro na fila.";
  if (status === "reading") return "Nenhuma leitura em andamento.";
  if (status === "paused") return "Nenhum livro pausado.";
  return "Nenhum livro concluido.";
}

function getNavigationId(): string {
  return globalThis.crypto?.randomUUID?.() || String(Date.now());
}

function getMapStats(sections: ReadingMapSectionWithItems[]) {
  const items = sections.flatMap((section) => section.items);
  const read = items.filter((item) => item.status === "read").length;
  const reading = items.filter((item) => item.status === "reading").length;
  const want = items.filter((item) => item.status === "want_to_read").length;
  const pages = items.reduce((sum, item) => sum + (item.book?.numPages || 0), 0);

  return {
    sections: sections.length,
    total: items.length,
    read,
    reading,
    want,
    pages,
  };
}

function matchesLibraryBookSearch(book: BookWithThumbnail, query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed) return true;

  const haystack = [
    book.title,
    book.author,
    book.fileName,
    book.series,
    book.publisher,
    getBookFolderLabel(book.filePath),
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("pt-BR");
  const normalizedQuery = trimmed.toLocaleLowerCase("pt-BR");

  return (
    haystack.includes(normalizedQuery) ||
    calculateSimilarity(book.title || "", book.author || null, trimmed).matches
  );
}

function matchesLibraryBookFileTypes(
  book: BookWithThumbnail,
  filters: FileTypeFilter[],
): boolean {
  const activeFilters = filters.filter((filter): filter is Exclude<FileTypeFilter, "all"> => (
    filter !== "all"
  ));
  if (activeFilters.length === 0) return true;
  return Boolean(book.fileType && activeFilters.includes(book.fileType as Exclude<FileTypeFilter, "all">));
}

function sortLibraryBooks(
  books: BookWithThumbnail[],
  sort: SortOption,
): BookWithThumbnail[] {
  return [...books].sort((left, right) => {
    switch (sort) {
      case "title_desc":
        return right.title.localeCompare(left.title, "pt-BR") || right.id - left.id;
      case "recent_desc":
        return new Date(right.lastOpenedAt || right.createdAt).getTime() -
          new Date(left.lastOpenedAt || left.createdAt).getTime();
      case "recent_asc":
        return new Date(left.lastOpenedAt || left.createdAt).getTime() -
          new Date(right.lastOpenedAt || right.createdAt).getTime();
      case "pages_desc":
        return (right.numPages || 0) - (left.numPages || 0);
      case "pages_asc":
        return (left.numPages || 0) - (right.numPages || 0);
      case "size_desc":
        return (right.fileSize || 0) - (left.fileSize || 0);
      case "size_asc":
        return (left.fileSize || 0) - (right.fileSize || 0);
      case "title_asc":
      default:
        return left.title.localeCompare(right.title, "pt-BR") || left.id - right.id;
    }
  });
}

function normalizeReadingTitle(value?: string | null): string {
  return getTitleWithoutExtension(value || "", undefined)
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\.(pdf|epub|azw3|mobi|cbz|txt|docx|html)$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getExternalReadingPages(
  item: ReadingStatusItem,
  readings: TableReading[],
): number {
  if (readings.length === 0) return 0;
  const titles = new Set([
    normalizeReadingTitle(item.title),
    normalizeReadingTitle(item.book?.title),
    normalizeReadingTitle(item.book?.fileName),
  ].filter(Boolean));

  return readings.reduce((sum, reading) => (
    titles.has(normalizeReadingTitle(reading.source_name))
      ? sum + (Number(reading.pages) || 0)
      : sum
  ), 0);
}

function getStatusItemTotalPages(item: ReadingStatusItem): number {
  return Math.max(0, Number(item.manualTotalPages || item.book?.numPages || 0));
}

function getStatusItemReadPages(item: ReadingStatusItem, externalPages: number): number {
  const manualPages = Math.max(
    0,
    (Number(item.manualCurrentPage) || 0) - (Number(item.manualBasePage) || 0),
  );
  return Math.max(
    0,
    manualPages +
      (Number(item.localProgressPages) || 0) +
      externalPages,
  );
}

function getMatchingReadings(item: ReadingStatusItem, readings: TableReading[]): TableReading[] {
  if (readings.length === 0) return [];
  const titles = new Set([
    normalizeReadingTitle(item.title),
    normalizeReadingTitle(item.book?.title),
    normalizeReadingTitle(item.book?.fileName),
  ].filter(Boolean));

  return readings.filter((reading) => titles.has(normalizeReadingTitle(reading.source_name)));
}

function formatLastReading(item: ReadingStatusItem, readings: TableReading[]): string {
  const matches = getMatchingReadings(item, readings);
  if (matches.length === 0) return "Sem registros";

  const latest = [...matches].sort((left, right) => {
    const leftDate = `${left.reading_date || ""} ${left.created_at || ""}`;
    const rightDate = `${right.reading_date || ""} ${right.created_at || ""}`;
    return rightDate.localeCompare(leftDate);
  })[0];

  if (!latest?.reading_date) return "Registro recente";
  try {
    return new Date(`${latest.reading_date}T00:00:00`).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
    });
  } catch {
    return latest.reading_date;
  }
}

function getManualCoverSrc(pathValue: string | null): string | null {
  if (!pathValue) return null;
  if (/^(https?:|data:|file:)/i.test(pathValue)) return pathValue;
  return `file://${pathValue}`;
}

function createSyntheticBook(item: ReadingStatusItem): BookWithThumbnail {
  return {
    id: -1,
    title: item.title,
    filePath: "",
    fileHash: item.bookId || item.id,
    currentPage: item.manualCurrentPage || 0,
    currentZoom: null,
    currentScroll: null,
    annotations: null,
    thumbnailPath: item.coverPath,
    numPages: item.manualTotalPages || 0,
    createdAt: item.createdAt,
    lastOpenedAt: item.updatedAt,
    isSynced: 0,
    category: null,
    isFavorite: 0,
    rating: 0,
    notes: null,
    author: item.author,
    description: item.description,
    isbn: item.isbn,
    publisher: item.publisher,
    publishDate: item.publishDate,
    fileSize: 0,
    processingStatus: "completed",
    fileType: "epub",
    readingStatus: item.status,
    completedAt: item.status === "read" ? item.updatedAt : null,
    language: null,
    identifier: null,
    asin: null,
    subject: item.subject,
    series: null,
    seriesIndex: null,
    authorSort: null,
    titleSort: null,
    bookId: null,
    importedAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function LocalCover({ book }: { book: BookWithThumbnail }) {
  const { thumbnail, thumbnailRef } = useLazyThumbnail(book);

  return (
    <div
      ref={thumbnailRef}
      className="flex aspect-[2/3] w-full flex-shrink-0 items-center justify-center overflow-hidden rounded-sm border border-zinc-800 bg-zinc-950"
    >
      {thumbnail ? (
        <img src={thumbnail} alt={book.title} className="h-full w-full object-contain" />
      ) : (
        <FileText size={18} className="text-zinc-600" />
      )}
    </div>
  );
}

function RoadmapCover({ item }: { item: ReadingMapItem }) {
  if (item.book) return <LocalCover book={item.book} />;

  return (
    <div className="flex aspect-[2/3] w-full flex-shrink-0 items-center justify-center overflow-hidden rounded-sm border border-zinc-800 bg-zinc-950">
      <FileText size={26} className={item.missingDocument ? "text-amber-400" : "text-zinc-600"} />
    </div>
  );
}

interface RoadmapItemCardProps {
  item: ReadingMapItem;
  index: number;
  canDrag: boolean;
  isDragging: boolean;
  showDropBefore: boolean;
  showDropAfter: boolean;
  onOpen: (book: BookWithThumbnail) => void;
  onStatusChange: (itemId: string, status: ReadingStatus) => void;
  onDelete: (itemId: string) => void;
  onDragStart: (event: ReactDragEvent<HTMLElement>, itemId: string) => void;
  onDragEnd: () => void;
  onDragOver: (event: ReactDragEvent<HTMLElement>, item: ReadingMapItem, index: number) => void;
  onDrop: (event: ReactDragEvent<HTMLElement>) => void;
}

function RoadmapStatusControl({
  value,
  label,
  onChange,
}: {
  value: ReadingStatus;
  label: string;
  onChange: (status: ReadingStatus) => void;
}) {
  return (
    <div
      className="grid grid-cols-3 overflow-hidden rounded-sm border border-zinc-800 bg-zinc-950"
      aria-label={`Status de ${label}`}
    >
      {READING_STATUS_OPTIONS.map((option) => {
        const meta = STATUS_VISUAL[option.value];
        const selected = value === option.value;
        const Icon = option.value === "read" ? CheckCircle2 : Circle;

        return (
          <button
            key={option.value}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onChange(option.value);
            }}
            className={`flex h-7 cursor-pointer items-center justify-center border-r border-zinc-800 last:border-r-0 ${
              selected
                ? `${meta.bg} ${meta.text}`
                : "text-zinc-600 hover:bg-zinc-900 hover:text-zinc-300"
            }`}
            title={meta.label}
            aria-label={`${meta.label} - ${label}`}
          >
            <Icon size={12} fill={selected ? "currentColor" : "none"} />
          </button>
        );
      })}
    </div>
  );
}

function RoadmapItemCard({
  item,
  index,
  canDrag,
  isDragging,
  showDropBefore,
  showDropAfter,
  onOpen,
  onStatusChange,
  onDelete,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: RoadmapItemCardProps) {
  const title = getTitleWithoutExtension(item.title, item.book?.fileType);
  const meta = STATUS_VISUAL[item.status];

  return (
    <article
      draggable={canDrag}
      onDragStart={(event) => onDragStart(event, item.id)}
      onDragEnd={onDragEnd}
      onDragOver={(event) => onDragOver(event, item, index)}
      onDrop={onDrop}
      className={`group relative z-10 w-[154px] flex-shrink-0 rounded-sm border bg-zinc-900 p-2 transition ${
        isDragging
          ? "scale-[0.98] border-green-500/60 opacity-45"
          : "border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/90"
      } ${canDrag ? "cursor-grab active:cursor-grabbing" : "cursor-default"}`}
    >
      {showDropBefore && (
        <div className="absolute -left-2 top-2 bottom-2 w-1 rounded-sm bg-green-400 shadow-[0_0_0_1px_rgba(34,197,94,0.25)]" />
      )}
      {showDropAfter && (
        <div className="absolute -right-2 top-2 bottom-2 w-1 rounded-sm bg-green-400 shadow-[0_0_0_1px_rgba(34,197,94,0.25)]" />
      )}
      <div className="absolute left-2 top-2 z-20 flex h-6 w-6 items-center justify-center rounded-sm border border-zinc-800 bg-zinc-950/80 text-zinc-500 opacity-0 transition-opacity group-hover:opacity-100">
        <GripVertical size={13} />
      </div>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onDelete(item.id);
        }}
        className="absolute right-2 top-2 z-20 flex h-6 w-6 cursor-pointer items-center justify-center rounded-sm border border-zinc-800 bg-zinc-950/80 text-zinc-500 opacity-0 transition-opacity hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300 group-hover:opacity-100"
        title="Remover do mapa"
      >
        <Trash2 size={12} />
      </button>
      <div className="relative">
        <RoadmapCover item={item} />
        <div className={`absolute bottom-2 left-2 flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[10px] font-medium ${meta.border} ${meta.bg} ${meta.text}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
          {meta.label}
        </div>
      </div>
      <div className="flex h-[94px] flex-col pt-3">
        <h3 className="line-clamp-2 text-xs font-medium leading-4 text-zinc-200">
          {title}
        </h3>
        <p className="mt-1 truncate text-[11px] text-zinc-500">
          {item.author || item.book?.author || (item.book ? getBookFolderLabel(item.book.filePath) : "Livro manual")}
        </p>
        <div className="mt-auto space-y-2 pt-2">
          <div className="flex items-center justify-between gap-2 text-[11px] text-zinc-500">
            <span>{item.book ? formatPageCount(item.book.numPages, item.book.fileType) : "planejado"}</span>
            <span className="rounded-sm bg-zinc-800 px-1.5 py-0.5 text-zinc-300">
              {item.book ? getFileTypeLabel(item.book.fileType, item.book.filePath) : "Manual"}
            </span>
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-1">
            <RoadmapStatusControl
              value={item.status}
              label={item.title}
              onChange={(status) => onStatusChange(item.id, status)}
            />
            {item.book && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onOpen(item.book!);
                }}
                className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-sm border border-zinc-800 bg-zinc-950 text-zinc-500 hover:border-zinc-700 hover:text-zinc-100"
                title="Abrir livro"
              >
                <BookOpen size={12} />
              </button>
            )}
          </div>
        </div>
      </div>
      {item.missingDocument && (
        <div className="mt-2 rounded-sm border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-300">
          arquivo ausente
        </div>
      )}
    </article>
  );
}

interface SectionDetailsProps {
  section: ReadingMapSectionWithItems | null;
  onSave: (sectionId: string, updates: { title: string; description: string }) => void;
}

function SectionDetails({ section, onSave }: SectionDetailsProps) {
  const [title, setTitle] = useState(section?.title || "");
  const [description, setDescription] = useState(section?.description || "");

  useEffect(() => {
    setTitle(section?.title || "");
    setDescription(section?.description || "");
  }, [section?.id, section?.title, section?.description]);

  if (!section) {
    return (
      <aside className="rounded-sm border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-500">
        Selecione uma etapa para ver os detalhes.
      </aside>
    );
  }

  const stats = getMapStats([section]);

  return (
    <aside className="flex min-h-0 flex-col rounded-sm border border-zinc-800 bg-zinc-900">
      <div className="border-b border-zinc-800 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-green-400">
          Descricao da etapa
        </p>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="mt-3 h-9 w-full rounded-sm border border-zinc-700 bg-zinc-950 px-3 text-sm font-medium text-zinc-100 outline-none focus:border-green-500"
        />
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={8}
          className="w-full resize-none rounded-sm border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm leading-6 text-zinc-300 outline-none focus:border-green-500"
        />
        <button
          type="button"
          onClick={() => onSave(section.id, { title, description })}
          className="h-9 cursor-pointer rounded-sm bg-green-500 px-3 text-sm font-medium text-zinc-950 hover:bg-green-400"
        >
          Salvar etapa
        </button>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-sm border border-zinc-800 bg-zinc-950 p-2">
            <p className="text-zinc-500">Livros</p>
            <p className="mt-1 text-base font-semibold text-zinc-100">{stats.total}</p>
          </div>
          <div className="rounded-sm border border-zinc-800 bg-zinc-950 p-2">
            <p className="text-zinc-500">Concluidos</p>
            <p className="mt-1 text-base font-semibold text-green-300">{stats.read}</p>
          </div>
          <div className="rounded-sm border border-zinc-800 bg-zinc-950 p-2">
            <p className="text-zinc-500">Em curso</p>
            <p className="mt-1 text-base font-semibold text-sky-300">{stats.reading}</p>
          </div>
          <div className="rounded-sm border border-zinc-800 bg-zinc-950 p-2">
            <p className="text-zinc-500">Fila</p>
            <p className="mt-1 text-base font-semibold text-zinc-300">{stats.want}</p>
          </div>
        </div>
        <div className="rounded-sm border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-500">
          Paginas estimadas: <span className="text-zinc-300">{stats.pages || "sem dados"}</span>
        </div>
      </div>
    </aside>
  );
}

interface LibraryPickerDialogProps {
  open: boolean;
  books: BookWithThumbnail[];
  onClose: () => void;
  onSelect: (book: BookWithThumbnail) => void;
}

function LibraryPickerDialog({ open, books, onClose, onSelect }: LibraryPickerDialogProps) {
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

function ManualBookDialog({ open, initialStatus = "want_to_read", onClose, onSubmit }: ManualBookDialogProps) {
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

function SimpleTextDialog({
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

interface StatusBoardProps {
  items: ReadingStatusItem[];
  activeStatus: ReadingStatus;
  loading: boolean;
  readings: TableReading[];
  draggedItemId: string | null;
  dropTarget: StatusDropTarget;
  onActiveStatusChange: (status: ReadingStatus) => void;
  onAddLibrary: () => void;
  onAddManual: () => void;
  onOpen: (book: BookWithThumbnail) => void;
  onStatusChange: (itemId: string, status: ReadingStatus) => void;
  onDelete: (itemId: string) => void;
  onProgressSave: (itemId: string, updates: { manualCurrentPage?: number; manualTotalPages?: number | null }) => void;
  onProgressEvent: (itemId: string, pages: number) => void;
  onDragStart: (event: ReactDragEvent<HTMLElement>, itemId: string) => void;
  onDragEnd: () => void;
  onDragOverItem: (event: ReactDragEvent<HTMLElement>, item: ReadingStatusItem, index: number) => void;
  onDragOverBoard: (event: ReactDragEvent<HTMLElement>, index: number) => void;
  onDrop: (event: ReactDragEvent<HTMLElement>) => void;
}

function StatusItemCover({ item }: { item: ReadingStatusItem }) {
  if (item.book) return <LocalCover book={item.book} />;

  return (
    <div className="flex aspect-[2/3] w-full items-center justify-center overflow-hidden rounded-sm border border-zinc-800 bg-zinc-950">
      <FileText size={24} className={item.missingDocument ? "text-amber-400" : "text-zinc-600"} />
    </div>
  );
}

function StatusItemCard({
  item,
  index,
  externalPages,
  isDragging,
  showDropBefore,
  showDropAfter,
  onOpen,
  onStatusChange,
  onDelete,
  onProgressSave,
  onProgressEvent,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: {
  item: ReadingStatusItem;
  index: number;
  externalPages: number;
  isDragging: boolean;
  showDropBefore: boolean;
  showDropAfter: boolean;
  onOpen: (book: BookWithThumbnail) => void;
  onStatusChange: (itemId: string, status: ReadingStatus) => void;
  onDelete: (itemId: string) => void;
  onProgressSave: (itemId: string, updates: { manualCurrentPage?: number; manualTotalPages?: number | null }) => void;
  onProgressEvent: (itemId: string, pages: number) => void;
  onDragStart: (event: ReactDragEvent<HTMLElement>, itemId: string) => void;
  onDragEnd: () => void;
  onDragOver: (event: ReactDragEvent<HTMLElement>, item: ReadingStatusItem, index: number) => void;
  onDrop: (event: ReactDragEvent<HTMLElement>) => void;
}) {
  const title = getTitleWithoutExtension(item.title, item.book?.fileType);
  const meta = STATUS_VISUAL[item.status];
  const totalPages = getStatusItemTotalPages(item);
  const readPages = getStatusItemReadPages(item, externalPages);
  const progress = totalPages > 0 ? Math.min(100, Math.round((readPages / totalPages) * 100)) : 0;
  const [currentPageInput, setCurrentPageInput] = useState(String(item.manualCurrentPage || 0));
  const [totalPagesInput, setTotalPagesInput] = useState(item.manualTotalPages ? String(item.manualTotalPages) : "");
  const [addPagesInput, setAddPagesInput] = useState("");

  useEffect(() => {
    setCurrentPageInput(String(item.manualCurrentPage || 0));
    setTotalPagesInput(item.manualTotalPages ? String(item.manualTotalPages) : "");
    setAddPagesInput("");
  }, [item.id, item.manualCurrentPage, item.manualTotalPages, item.localProgressPages]);

  const saveProgress = () => {
    onProgressSave(item.id, {
      manualCurrentPage: Number(currentPageInput) || 0,
      manualTotalPages: totalPagesInput.trim() ? Number(totalPagesInput) : null,
    });
  };

  const addProgress = () => {
    const pages = Number(addPagesInput) || 0;
    if (pages <= 0) return;
    onProgressEvent(item.id, pages);
  };

  return (
    <article
      draggable
      onDragStart={(event) => onDragStart(event, item.id)}
      onDragEnd={onDragEnd}
      onDragOver={(event) => onDragOver(event, item, index)}
      onDrop={onDrop}
      className={`group relative grid gap-4 rounded-sm border bg-zinc-900 p-3 transition md:grid-cols-[92px_minmax(0,1fr)] ${
        isDragging
          ? "border-green-500/60 opacity-45"
          : "border-zinc-800 hover:border-zinc-700"
      }`}
    >
      {showDropBefore && (
        <div className="absolute -top-2 left-2 right-2 h-1 rounded-sm bg-green-400" />
      )}
      {showDropAfter && (
        <div className="absolute -bottom-2 left-2 right-2 h-1 rounded-sm bg-green-400" />
      )}
      <div className="relative">
        <StatusItemCover item={item} />
        <div className="absolute left-2 top-2 flex h-6 w-6 cursor-grab items-center justify-center rounded-sm border border-zinc-800 bg-zinc-950/80 text-zinc-500 opacity-0 transition-opacity group-hover:opacity-100">
          <GripVertical size={13} />
        </div>
      </div>
      <div className="min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="line-clamp-2 text-sm font-semibold leading-5 text-zinc-100">
              {title}
            </h3>
            <p className="mt-1 truncate text-xs text-zinc-500">
              {item.author || item.book?.author || (item.book ? getBookFolderLabel(item.book.filePath) : "Livro manual")}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {item.book && (
              <button
                type="button"
                onClick={() => onOpen(item.book!)}
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-sm border border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                title="Abrir livro"
              >
                <BookOpen size={14} />
              </button>
            )}
            <button
              type="button"
              onClick={() => onDelete(item.id)}
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-sm border border-zinc-800 text-zinc-500 hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300"
              title="Remover dos estados"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        <div className="mt-3 grid gap-2 lg:grid-cols-[180px_minmax(0,1fr)]">
          <RoadmapStatusControl
            value={item.status}
            label={item.title}
            onChange={(status) => onStatusChange(item.id, status)}
          />
          <div className={`flex items-center gap-2 rounded-sm border px-2 py-1 text-xs ${meta.border} ${meta.bg} ${meta.text}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
            {meta.detail}
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-zinc-500">Progresso</span>
            <span className="font-medium text-zinc-200">
              {totalPages > 0 ? `${progress}% · ${Math.min(readPages, totalPages)} / ${totalPages} pags.` : `${readPages} pags.`}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-sm bg-zinc-800">
            <div
              className="h-full rounded-sm bg-green-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-zinc-500">
            <span>Base: <b className="font-medium text-zinc-300">{item.manualCurrentPage || 0}</b></span>
            <span>Atlas: <b className="font-medium text-zinc-300">{item.localProgressPages || 0}</b></span>
            <span>Registros: <b className="font-medium text-zinc-300">{externalPages}</b></span>
          </div>
        </div>

        {item.status === "reading" && (
          <div className="mt-4 grid gap-2 rounded-sm border border-zinc-800 bg-zinc-950/50 p-3 lg:grid-cols-[120px_120px_90px_auto]">
            <label className="text-[11px] text-zinc-500">
              Pagina base
              <input
                aria-label={`Pagina atual de ${item.title}`}
                type="number"
                min={0}
                value={currentPageInput}
                onChange={(event) => setCurrentPageInput(event.target.value)}
                className="mt-1 h-8 w-full rounded-sm border border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-200 outline-none focus:border-green-500"
              />
            </label>
            <label className="text-[11px] text-zinc-500">
              Total
              <input
                aria-label={`Total de paginas de ${item.title}`}
                type="number"
                min={1}
                value={totalPagesInput}
                placeholder={item.book?.numPages ? String(item.book.numPages) : "pags."}
                onChange={(event) => setTotalPagesInput(event.target.value)}
                className="mt-1 h-8 w-full rounded-sm border border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-200 outline-none focus:border-green-500"
              />
            </label>
            <label className="text-[11px] text-zinc-500">
              Somar
              <input
                aria-label={`Paginas lidas de ${item.title}`}
                type="number"
                min={1}
                value={addPagesInput}
                placeholder="+pags."
                onChange={(event) => setAddPagesInput(event.target.value)}
                className="mt-1 h-8 w-full rounded-sm border border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-200 outline-none focus:border-green-500"
              />
            </label>
            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={saveProgress}
                className="h-8 cursor-pointer rounded-sm border border-zinc-700 px-3 text-xs text-zinc-300 hover:bg-zinc-800"
              >
                Salvar
              </button>
              <button
                type="button"
                onClick={addProgress}
                className="h-8 cursor-pointer rounded-sm bg-green-500 px-3 text-xs font-medium text-zinc-950 hover:bg-green-400"
              >
                Somar
              </button>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

function StatusBoard({
  items,
  activeStatus,
  loading,
  readings,
  draggedItemId,
  dropTarget,
  onActiveStatusChange,
  onAddLibrary,
  onAddManual,
  onOpen,
  onStatusChange,
  onDelete,
  onProgressSave,
  onProgressEvent,
  onDragStart,
  onDragEnd,
  onDragOverItem,
  onDragOverBoard,
  onDrop,
}: StatusBoardProps) {
  const activeItems = items.filter((item) => item.status === activeStatus);
  const counts = READING_STATUS_OPTIONS.reduce<Record<ReadingStatus, number>>((acc, option) => {
    acc[option.value] = items.filter((item) => item.status === option.value).length;
    return acc;
  }, { want_to_read: 0, reading: 0, paused: 0, read: 0 });

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-zinc-800 bg-zinc-900 p-3">
        <div className="flex overflow-hidden rounded-sm border border-zinc-800 bg-zinc-950">
          {READING_STATUS_OPTIONS.map((option) => {
            const meta = STATUS_VISUAL[option.value];
            const active = activeStatus === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-label={`Ver ${meta.label}`}
                onClick={() => onActiveStatusChange(option.value)}
                className={`flex h-9 cursor-pointer items-center gap-2 border-r border-zinc-800 px-3 text-sm last:border-r-0 ${
                  active
                    ? "bg-green-500 text-zinc-950"
                    : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                {meta.label}
                <span className={`rounded-sm px-1.5 py-0.5 text-[11px] ${active ? "bg-zinc-950/15" : "bg-zinc-800 text-zinc-300"}`}>
                  {counts[option.value]}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onAddLibrary}
            className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-sm bg-green-500 px-3 text-sm font-medium text-zinc-950 hover:bg-green-400"
          >
            <Plus size={15} />
            Adicionar livro
          </button>
          <button
            type="button"
            onClick={onAddManual}
            className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-sm border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-300 hover:bg-zinc-900"
          >
            <FileText size={15} />
            Livro manual
          </button>
        </div>
      </div>

      <section
        onDragOver={(event) => onDragOverBoard(event, activeItems.length)}
        onDrop={onDrop}
        className="min-h-0 flex-1 overflow-y-auto rounded-sm border border-zinc-800 bg-zinc-900/50 p-3"
      >
        {loading ? (
          <div className="flex h-56 items-center justify-center text-sm text-zinc-500">
            Carregando estados...
          </div>
        ) : activeItems.length === 0 ? (
          <div
            onDragOver={(event) => onDragOverBoard(event, 0)}
            onDrop={onDrop}
            className={`flex h-72 flex-col items-center justify-center gap-3 rounded-sm border border-dashed px-4 text-center ${
              dropTarget?.status === activeStatus
                ? "border-green-500/60 bg-green-500/10 text-green-200"
                : "border-zinc-800 text-zinc-500"
            }`}
          >
            <BookMarked size={22} className="text-zinc-600" />
            <p className="text-sm">{emptyMessage(activeStatus)}</p>
            <p className="max-w-md text-xs text-zinc-600">
              Adicione livros da biblioteca ou crie um item manual para montar uma fila de leitura separada da Library.
            </p>
          </div>
        ) : (
          <div className="space-y-3 pb-2">
            {activeItems.map((item, index) => {
              const externalPages = getExternalReadingPages(item, readings);
              return (
                <StatusItemCard
                  key={item.id}
                  item={item}
                  index={index}
                  externalPages={externalPages}
                  isDragging={draggedItemId === item.id}
                  showDropBefore={dropTarget?.status === activeStatus && dropTarget.index === index && draggedItemId !== item.id}
                  showDropAfter={dropTarget?.status === activeStatus && dropTarget.index === index + 1 && draggedItemId !== item.id}
                  onOpen={onOpen}
                  onStatusChange={onStatusChange}
                  onDelete={onDelete}
                  onProgressSave={onProgressSave}
                  onProgressEvent={onProgressEvent}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                  onDragOver={onDragOverItem}
                  onDrop={onDrop}
                />
              );
            })}
            {dropTarget?.status === activeStatus && dropTarget.index >= activeItems.length && (
              <div className="h-1 rounded-sm bg-green-400" />
            )}
          </div>
        )}
      </section>
    </div>
  );
}

interface StatusBoardV2Props {
  items: ReadingStatusItem[];
  activeStatus: ReadingStatus;
  selectedItemId: string | null;
  search: string;
  loading: boolean;
  readings: TableReading[];
  vaultPath: string | null;
  noteContent: string;
  notePath: string | null;
  noteLoading: boolean;
  noteSaving: boolean;
  draggedItemId: string | null;
  dropTarget: StatusDropTarget;
  onActiveStatusChange: (status: ReadingStatus) => void;
  onSearchChange: (value: string) => void;
  onSelectItem: (itemId: string) => void;
  onAddLibrary: () => void;
  onAddManual: () => void;
  onChooseVault: () => void;
  onSaveNote: (content: string) => void;
  onOpen: (book: BookWithThumbnail) => void;
  onStatusChange: (itemId: string, status: ReadingStatus) => void;
  onSetPrimary: (itemId: string) => void;
  onCoverChange: (item: ReadingStatusItem) => void;
  onMetadataSearch: (item: ReadingStatusItem) => void;
  onDelete: (itemId: string) => void;
  onProgressSave: (itemId: string, updates: { manualBasePage?: number; manualCurrentPage?: number; manualTotalPages?: number | null }) => void;
  onProgressEvent: (itemId: string, pages: number) => void;
  onDragStart: (event: ReactDragEvent<HTMLElement>, itemId: string) => void;
  onDragEnd: () => void;
  onDragOverItem: (event: ReactDragEvent<HTMLElement>, item: ReadingStatusItem, index: number) => void;
  onDragOverBoard: (event: ReactDragEvent<HTMLElement>, index: number) => void;
  onDrop: (event: ReactDragEvent<HTMLElement>) => void;
}

function StatusCoverButton({
  item,
  onCoverChange,
}: {
  item: ReadingStatusItem;
  onCoverChange: (item: ReadingStatusItem) => void;
}) {
  const manualCover = !item.book ? getManualCoverSrc(item.coverPath) : null;

  return (
    <div className="group/cover relative h-24 w-16 flex-shrink-0 overflow-hidden rounded-sm border border-zinc-800 bg-zinc-950">
      {item.book ? (
        <LocalCover book={item.book} />
      ) : manualCover ? (
        <img src={manualCover} alt={item.title} className="h-full w-full object-contain" />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <FileText size={22} className="text-zinc-600" />
        </div>
      )}
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onCoverChange(item);
        }}
        className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center gap-1 bg-black/60 text-xs font-medium text-white opacity-0 transition-opacity group-hover/cover:opacity-100"
        title="Definir capa"
      >
        <Upload size={16} />
        Capa
      </button>
    </div>
  );
}

function StatusActionMenuV2({
  item,
  open,
  onToggle,
  onStatusChange,
  onSetPrimary,
  onEditPages,
  onMetadataSearch,
  onDelete,
}: {
  item: ReadingStatusItem;
  open: boolean;
  onToggle: () => void;
  onStatusChange: (status: ReadingStatus) => void;
  onSetPrimary: () => void;
  onEditPages: () => void;
  onMetadataSearch: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onToggle();
        }}
        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-sm border border-zinc-800 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-100"
        title="Acoes"
      >
        <MoreVertical size={15} />
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-30 w-64 overflow-hidden rounded-sm border border-zinc-800 bg-zinc-950 shadow-2xl">
          <button type="button" onClick={onSetPrimary} className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-xs text-zinc-300 hover:bg-zinc-900 hover:text-green-200">
            <Star size={13} />
            Definir como leitura principal
          </button>
          <button type="button" onClick={onEditPages} className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-xs text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100">
            <Edit3 size={13} />
            Ajustar paginas e progresso
          </button>
          <button type="button" onClick={onMetadataSearch} className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-xs text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100">
            <Search size={13} />
            Pesquisar metadados
          </button>
          <div className="border-t border-zinc-800 py-1">
            {READING_STATUS_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onStatusChange(option.value)}
                className={`flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-xs ${
                  item.status === option.value ? "bg-green-500/10 text-green-200" : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${STATUS_VISUAL[option.value].dot}`} />
                Mover para {STATUS_VISUAL[option.value].label}
              </button>
            ))}
          </div>
          <button type="button" onClick={onDelete} className="flex w-full cursor-pointer items-center gap-2 border-t border-zinc-800 px-3 py-2 text-left text-xs text-red-300 hover:bg-red-500/10">
            <Trash2 size={13} />
            Remover da lista
          </button>
        </div>
      )}
    </div>
  );
}

function StatusBookRow({
  item,
  index,
  readings,
  externalPages,
  isSelected,
  openMenu,
  isDragging,
  showDropBefore,
  showDropAfter,
  onOpen,
  onSelect,
  onStatusChange,
  onSetPrimary,
  onCoverChange,
  onMetadataSearch,
  onDelete,
  onEditPages,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onToggleMenu,
}: {
  item: ReadingStatusItem;
  index: number;
  readings: TableReading[];
  externalPages: number;
  isSelected: boolean;
  openMenu: boolean;
  isDragging: boolean;
  showDropBefore: boolean;
  showDropAfter: boolean;
  onOpen: (book: BookWithThumbnail) => void;
  onSelect: (itemId: string) => void;
  onStatusChange: (itemId: string, status: ReadingStatus) => void;
  onSetPrimary: (itemId: string) => void;
  onCoverChange: (item: ReadingStatusItem) => void;
  onMetadataSearch: (item: ReadingStatusItem) => void;
  onDelete: (itemId: string) => void;
  onEditPages: (item: ReadingStatusItem) => void;
  onDragStart: (event: ReactDragEvent<HTMLElement>, itemId: string) => void;
  onDragEnd: () => void;
  onDragOver: (event: ReactDragEvent<HTMLElement>, item: ReadingStatusItem, index: number) => void;
  onDrop: (event: ReactDragEvent<HTMLElement>) => void;
  onToggleMenu: (itemId: string) => void;
}) {
  const title = getTitleWithoutExtension(item.title, item.book?.fileType);
  const meta = STATUS_VISUAL[item.status];
  const totalPages = getStatusItemTotalPages(item);
  const readPages = getStatusItemReadPages(item, externalPages);
  const progress = totalPages > 0 ? Math.min(100, Math.round((readPages / totalPages) * 100)) : 0;
  const remaining = totalPages > 0 ? Math.max(0, totalPages - Math.min(readPages, totalPages)) : null;

  return (
    <article
      draggable
      onClick={() => onSelect(item.id)}
      onDragStart={(event) => onDragStart(event, item.id)}
      onDragEnd={onDragEnd}
      onDragOver={(event) => onDragOver(event, item, index)}
      onDrop={onDrop}
      className={`group relative grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] gap-4 rounded-sm border bg-zinc-900/80 p-3 transition ${
        isDragging ? "border-green-500/60 opacity-45" : isSelected ? "border-green-500/60 bg-green-500/[0.04]" : "border-zinc-800 hover:border-zinc-700"
      }`}
    >
      {showDropBefore && <div className="absolute -top-2 left-2 right-2 h-1 rounded-sm bg-green-400" />}
      {showDropAfter && <div className="absolute -bottom-2 left-2 right-2 h-1 rounded-sm bg-green-400" />}
      <div className="relative">
        <StatusCoverButton item={item} onCoverChange={onCoverChange} />
        <div className="absolute left-2 top-2 flex h-6 w-6 cursor-grab items-center justify-center rounded-sm border border-zinc-800 bg-zinc-950/80 text-zinc-500 opacity-0 transition-opacity group-hover:opacity-100">
          <GripVertical size={13} />
        </div>
      </div>

      <div className="min-w-0 space-y-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {item.isPrimary && (
              <span className="inline-flex items-center gap-1 rounded-sm bg-green-500/15 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-green-300">
                <Star size={11} fill="currentColor" />
                Leitura principal
              </span>
            )}
            <span className={`inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-[11px] ${meta.border} ${meta.bg} ${meta.text}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
              {meta.label}
            </span>
          </div>
          <h3 className="mt-2 line-clamp-1 text-base font-semibold leading-5 text-zinc-100">{title}</h3>
          <p className="mt-1 truncate text-xs text-zinc-500">
            {item.author || item.book?.author || (item.book ? getBookFolderLabel(item.book.filePath) : "Livro manual")}
          </p>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-zinc-500">Progresso</span>
            <span className="font-medium text-zinc-200">
              {totalPages > 0 ? `${progress}% - ${Math.min(readPages, totalPages)} / ${totalPages} pags.` : `${readPages} pags.`}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-sm bg-zinc-800">
            <div className={`h-full rounded-sm ${item.status === "paused" ? "bg-amber-500" : "bg-green-500"}`} style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="grid gap-2 text-xs text-zinc-500 md:grid-cols-4">
          <div>
            <p className="uppercase tracking-wide text-zinc-600">Pagina atual</p>
            <p className="mt-1 text-zinc-200">{item.manualCurrentPage || 0}</p>
          </div>
          <div>
            <p className="uppercase tracking-wide text-zinc-600">Restantes</p>
            <p className="mt-1 text-zinc-200">{remaining === null ? "-" : remaining}</p>
          </div>
          <div>
            <p className="uppercase tracking-wide text-zinc-600">Ultima leitura</p>
            <p className="mt-1 truncate text-zinc-200">{formatLastReading(item, readings)}</p>
          </div>
          <div>
            <p className="uppercase tracking-wide text-zinc-600">Registros</p>
            <p className="mt-1 text-zinc-200">{readPages}</p>
          </div>
        </div>
      </div>

      <div className="flex items-start gap-2">
        {item.book && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onOpen(item.book!);
            }}
            className="flex h-8 cursor-pointer items-center gap-2 rounded-sm border border-zinc-800 px-3 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            title="Abrir livro"
          >
            <BookOpen size={14} />
            Abrir
          </button>
        )}
        <StatusActionMenuV2
          item={item}
          open={openMenu}
          onToggle={() => onToggleMenu(item.id)}
          onSetPrimary={() => onSetPrimary(item.id)}
          onEditPages={() => onEditPages(item)}
          onMetadataSearch={() => onMetadataSearch(item)}
          onDelete={() => onDelete(item.id)}
          onStatusChange={(status) => onStatusChange(item.id, status)}
        />
      </div>
    </article>
  );
}

function PageSettingsDialog({
  item,
  onClose,
  onSave,
  onProgressEvent,
}: {
  item: ReadingStatusItem | null;
  onClose: () => void;
  onSave: (itemId: string, updates: { manualBasePage?: number; manualCurrentPage?: number; manualTotalPages?: number | null }) => void;
  onProgressEvent: (itemId: string, pages: number) => void;
}) {
  const [basePage, setBasePage] = useState("");
  const [currentPage, setCurrentPage] = useState("");
  const [totalPages, setTotalPages] = useState("");
  const [addPages, setAddPages] = useState("");

  useEffect(() => {
    if (!item) return;
    setBasePage(String(item.manualBasePage || 0));
    setCurrentPage(String(item.manualCurrentPage || 0));
    setTotalPages(item.manualTotalPages ? String(item.manualTotalPages) : "");
    setAddPages("");
  }, [item]);

  if (!item) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-lg rounded-sm border border-zinc-800 bg-zinc-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 p-4">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">Ajustar paginas</h2>
            <p className="mt-1 text-xs text-zinc-500">{item.title}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-sm p-2 text-zinc-500 hover:bg-zinc-900 hover:text-zinc-100">
            <X size={16} />
          </button>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-3">
          <label className="text-xs text-zinc-500">
            Pagina base
            <input aria-label={`Pagina base de ${item.title}`} type="number" min={0} value={basePage} onChange={(event) => setBasePage(event.target.value)} className="mt-1 h-9 w-full rounded-sm border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100 outline-none focus:border-green-500" />
          </label>
          <label className="text-xs text-zinc-500">
            Pagina atual
            <input aria-label={`Pagina atual de ${item.title}`} type="number" min={0} value={currentPage} onChange={(event) => setCurrentPage(event.target.value)} className="mt-1 h-9 w-full rounded-sm border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100 outline-none focus:border-green-500" />
          </label>
          <label className="text-xs text-zinc-500">
            Total
            <input aria-label={`Total de paginas de ${item.title}`} type="number" min={1} value={totalPages} onChange={(event) => setTotalPages(event.target.value)} className="mt-1 h-9 w-full rounded-sm border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100 outline-none focus:border-green-500" />
          </label>
        </div>
        <div className="border-t border-zinc-800 p-4">
          <label className="text-xs text-zinc-500">
            Somar paginas lidas agora
            <div className="mt-1 flex gap-2">
              <input aria-label={`Paginas lidas de ${item.title}`} type="number" min={1} value={addPages} onChange={(event) => setAddPages(event.target.value)} className="h-9 min-w-0 flex-1 rounded-sm border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100 outline-none focus:border-green-500" />
              <button type="button" onClick={() => {
                const pages = Number(addPages) || 0;
                if (pages <= 0) return;
                onProgressEvent(item.id, pages);
                setAddPages("");
              }} className="h-9 cursor-pointer rounded-sm border border-zinc-800 px-3 text-sm text-zinc-300 hover:bg-zinc-900">
                Somar
              </button>
            </div>
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-zinc-800 p-4">
          <button type="button" onClick={onClose} className="h-9 cursor-pointer rounded-sm px-3 text-sm text-zinc-400 hover:bg-zinc-900">Cancelar</button>
          <button type="button" onClick={() => {
            onSave(item.id, {
              manualBasePage: Number(basePage) || 0,
              manualCurrentPage: Number(currentPage) || 0,
              manualTotalPages: totalPages.trim() ? Number(totalPages) : null,
            });
            onClose();
          }} className="h-9 cursor-pointer rounded-sm bg-green-500 px-3 text-sm font-medium text-zinc-950 hover:bg-green-400">
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

function AtomicEditor({
  selectedItem,
  vaultPath,
  notePath,
  content,
  loading,
  saving,
  onChooseVault,
  onSave,
}: {
  selectedItem: ReadingStatusItem | null;
  vaultPath: string | null;
  notePath: string | null;
  content: string;
  loading: boolean;
  saving: boolean;
  onChooseVault: () => void;
  onSave: (content: string) => void;
}) {
  const [draft, setDraft] = useState(content);

  useEffect(() => {
    setDraft(content);
  }, [content, selectedItem?.id]);

  return (
    <aside className="flex min-h-0 flex-col rounded-sm border border-zinc-800 bg-zinc-900">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-800 p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-sm border border-green-500/40 bg-green-500/10 text-green-300">
              <NotebookText size={16} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">Atomic Editor</h2>
              <p className="mt-0.5 truncate text-xs text-zinc-500">{selectedItem ? selectedItem.title : "Selecione um livro"}</p>
            </div>
          </div>
        </div>
        <button type="button" onClick={onChooseVault} className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-sm border border-zinc-800 px-3 text-xs text-zinc-300 hover:bg-zinc-800">
          <FolderOpen size={13} />
          {vaultPath ? "Trocar vault" : "Definir vault"}
        </button>
      </div>
      <div className="border-b border-zinc-800 p-3">
        <div className="flex min-w-0 items-center gap-2 rounded-sm border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">
          <span className={`h-1.5 w-1.5 rounded-full ${vaultPath ? "bg-green-400" : "bg-amber-400"}`} />
          <span className="text-zinc-500">{vaultPath ? "Vault conectado" : "Sem Vault definido"}</span>
          <span className="min-w-0 truncate text-zinc-300">{notePath || vaultPath || "Notas ficam no SQLite ate escolher uma pasta"}</span>
        </div>
      </div>
      <div className="min-h-0 flex-1 p-3">
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-zinc-500">Carregando nota...</div>
        ) : !selectedItem ? (
          <div className="flex h-full min-h-[420px] items-center justify-center rounded-sm border border-dashed border-zinc-800 bg-zinc-950 px-4 text-center text-sm text-zinc-500">
            Selecione um livro para escrever notas de leitura.
          </div>
        ) : (
          <div
            className="h-full min-h-[420px] overflow-hidden rounded-sm border border-zinc-800 bg-zinc-950 text-zinc-200 focus-within:border-green-500"
            style={{
              "--atomic-editor-bg": "#09090b",
              "--atomic-editor-bg-panel": "#18181b",
              "--atomic-editor-bg-surface": "#27272a",
              "--atomic-editor-border": "#27272a",
              "--atomic-editor-accent": "#22c55e",
              "--atomic-editor-accent-bright": "#4ade80",
              "--atomic-editor-link": "#86efac",
              "--atomic-editor-link-hover": "#bbf7d0",
              "--atomic-editor-font": "Inter, ui-sans-serif, system-ui, sans-serif",
              "--atomic-editor-font-mono": "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              "--atomic-editor-body-size": "0.875rem",
              "--atomic-editor-body-leading": "1.65",
              "--atomic-editor-measure": "100%",
            } as CSSProperties}
          >
            <AtomicCodeMirrorEditor
              key={selectedItem.id}
              documentId={selectedItem.id}
              markdownSource={draft}
              onMarkdownChange={setDraft}
              onLinkClick={(url) => {
                window.open(url, "_blank", "noopener,noreferrer");
              }}
            />
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-zinc-800 px-4 py-3 text-xs text-zinc-500">
        <span className="min-w-0 truncate">{notePath ? `Arquivo: ${notePath.split(/[/\\]/).pop()}` : "Arquivo markdown criado ao salvar com Vault definido"}</span>
        <button type="button" onClick={() => onSave(draft)} disabled={!selectedItem || saving} className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-sm bg-green-500 px-3 font-medium text-zinc-950 hover:bg-green-400 disabled:cursor-not-allowed disabled:opacity-60">
          {saving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
          Salvar
        </button>
      </div>
    </aside>
  );
}

function StatusBoardV2({
  items,
  activeStatus,
  selectedItemId,
  search,
  loading,
  readings,
  vaultPath,
  noteContent,
  notePath,
  noteLoading,
  noteSaving,
  draggedItemId,
  dropTarget,
  onActiveStatusChange,
  onSearchChange,
  onSelectItem,
  onAddLibrary,
  onAddManual,
  onChooseVault,
  onSaveNote,
  onOpen,
  onStatusChange,
  onSetPrimary,
  onCoverChange,
  onMetadataSearch,
  onDelete,
  onProgressSave,
  onProgressEvent,
  onDragStart,
  onDragEnd,
  onDragOverItem,
  onDragOverBoard,
  onDrop,
}: StatusBoardV2Props) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [pageDialogItem, setPageDialogItem] = useState<ReadingStatusItem | null>(null);
  const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR");
  const activeItems = items
    .filter((item) => item.status === activeStatus)
    .filter((item) => {
      if (!normalizedSearch) return true;
      return [item.title, item.author, item.book?.author, item.publisher, item.subject]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("pt-BR")
        .includes(normalizedSearch);
    })
    .sort((left, right) => Number(right.isPrimary) - Number(left.isPrimary) || left.order - right.order);
  const counts = READING_STATUS_OPTIONS.reduce<Record<ReadingStatus, number>>((acc, option) => {
    acc[option.value] = items.filter((item) => item.status === option.value).length;
    return acc;
  }, { want_to_read: 0, reading: 0, paused: 0, read: 0 });
  const selectedItem = items.find((item) => item.id === selectedItemId) || activeItems[0] || null;

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_470px]">
      <section className="flex min-h-0 flex-col rounded-sm border border-zinc-800 bg-zinc-900/50">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 p-3">
          <div className="flex flex-wrap gap-1 rounded-sm border border-zinc-800 bg-zinc-950 p-1">
            {READING_STATUS_OPTIONS.map((option) => {
              const meta = STATUS_VISUAL[option.value];
              const active = activeStatus === option.value;
              return (
                <button key={option.value} type="button" aria-label={`Ver ${meta.label}`} onClick={() => onActiveStatusChange(option.value)} className={`flex h-9 cursor-pointer items-center gap-2 rounded-sm px-3 text-sm ${active ? "bg-green-500 text-zinc-950" : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                  {meta.label}
                  <span className={`rounded-sm px-1.5 py-0.5 text-[11px] ${active ? "bg-zinc-950/15" : "bg-zinc-800 text-zinc-300"}`}>{counts[option.value]}</span>
                </button>
              );
            })}
          </div>
          <div className="flex min-w-[280px] flex-1 items-center gap-2 rounded-sm border border-zinc-800 bg-zinc-950 px-3">
            <Search size={15} className="text-zinc-500" />
            <input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Buscar livro..." className="h-9 min-w-0 flex-1 bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-600" />
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onAddLibrary} className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-sm bg-green-500 px-3 text-sm font-medium text-zinc-950 hover:bg-green-400">
              <Plus size={15} />
              Adicionar livro
            </button>
            <button type="button" onClick={onAddManual} className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-sm border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-300 hover:bg-zinc-900">
              <FileText size={15} />
              Manual
            </button>
          </div>
        </div>
        <div onDragOver={(event) => onDragOverBoard(event, activeItems.length)} onDrop={onDrop} className="min-h-0 flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="flex h-56 items-center justify-center text-sm text-zinc-500">Carregando estados...</div>
          ) : activeItems.length === 0 ? (
            <div onDragOver={(event) => onDragOverBoard(event, 0)} onDrop={onDrop} className={`flex h-72 flex-col items-center justify-center gap-3 rounded-sm border border-dashed px-4 text-center ${dropTarget?.status === activeStatus ? "border-green-500/60 bg-green-500/10 text-green-200" : "border-zinc-800 text-zinc-500"}`}>
              <BookMarked size={22} className="text-zinc-600" />
              <p className="text-sm">{emptyMessage(activeStatus)}</p>
              <p className="max-w-md text-xs text-zinc-600">Adicione livros da biblioteca ou livros manuais para manter notas, capas e progresso em um unico lugar.</p>
            </div>
          ) : (
            <div className="space-y-3 pb-2">
              {activeItems.map((item, index) => (
                <StatusBookRow
                  key={item.id}
                  item={item}
                  index={index}
                  readings={readings}
                  externalPages={getExternalReadingPages(item, readings)}
                  isSelected={selectedItemId === item.id}
                  openMenu={openMenuId === item.id}
                  isDragging={draggedItemId === item.id}
                  showDropBefore={dropTarget?.status === activeStatus && dropTarget.index === index && draggedItemId !== item.id}
                  showDropAfter={dropTarget?.status === activeStatus && dropTarget.index === index + 1 && draggedItemId !== item.id}
                  onOpen={onOpen}
                  onSelect={onSelectItem}
                  onStatusChange={(itemId, status) => {
                    setOpenMenuId(null);
                    onStatusChange(itemId, status);
                  }}
                  onSetPrimary={(itemId) => {
                    setOpenMenuId(null);
                    onSetPrimary(itemId);
                  }}
                  onCoverChange={onCoverChange}
                  onMetadataSearch={(target) => {
                    setOpenMenuId(null);
                    onMetadataSearch(target);
                  }}
                  onDelete={(itemId) => {
                    setOpenMenuId(null);
                    onDelete(itemId);
                  }}
                  onEditPages={(target) => {
                    setOpenMenuId(null);
                    setPageDialogItem(target);
                  }}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                  onDragOver={onDragOverItem}
                  onDrop={onDrop}
                  onToggleMenu={(itemId) => setOpenMenuId((current) => current === itemId ? null : itemId)}
                />
              ))}
              {dropTarget?.status === activeStatus && dropTarget.index >= activeItems.length && <div className="h-1 rounded-sm bg-green-400" />}
            </div>
          )}
        </div>
      </section>
      <AtomicEditor selectedItem={selectedItem} vaultPath={vaultPath} notePath={notePath} content={noteContent} loading={noteLoading} saving={noteSaving} onChooseVault={onChooseVault} onSave={onSaveNote} />
      <PageSettingsDialog item={pageDialogItem} onClose={() => setPageDialogItem(null)} onSave={onProgressSave} onProgressEvent={onProgressEvent} />
    </div>
  );
}

export default function AtlasPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [view, setView] = useState<AtlasView>("roadmap");
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [activeStatusView, setActiveStatusView] = useState<ReadingStatus>("reading");
  const [statusSearch, setStatusSearch] = useState("");
  const [selectedStatusItemId, setSelectedStatusItemId] = useState<string | null>(null);
  const [coverTarget, setCoverTarget] = useState<ReadingStatusItem | null>(null);
  const [thumbnailDialog, setThumbnailDialog] = useState<{ open: boolean; imagePath: string }>({ open: false, imagePath: "" });
  const [metadataTarget, setMetadataTarget] = useState<ReadingStatusItem | null>(null);
  const [noteSaving, setNoteSaving] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget>(null);
  const [draggedStatusItemId, setDraggedStatusItemId] = useState<string | null>(null);
  const [statusDropTarget, setStatusDropTarget] = useState<StatusDropTarget>(null);
  const [libraryPickerTarget, setLibraryPickerTarget] = useState<AddTarget | null>(null);
  const [manualDialogTarget, setManualDialogTarget] = useState<AddTarget | null>(null);
  const [mapDialogOpen, setMapDialogOpen] = useState(false);
  const [sectionDialogOpen, setSectionDialogOpen] = useState(false);
  const apiAvailable = Boolean(window.api?.listBooks);
  const roadmapApiAvailable = Boolean(window.api?.getReadingMap);
  const statusApiAvailable = Boolean(window.api?.getReadingStatusItems);

  const booksQuery = useQuery({
    queryKey: ATLAS_BOOKS_QUERY_KEY,
    queryFn: fetchAtlasBooks,
    enabled: apiAvailable,
    staleTime: 20_000,
  });

  const mapQuery = useQuery({
    queryKey: [ATLAS_MAP_QUERY_KEY, selectedMapId],
    queryFn: () => fetchReadingMap(selectedMapId),
    enabled: apiAvailable && roadmapApiAvailable,
    staleTime: 20_000,
  });

  const readingsQuery = useGetReadings();

  const statusQuery = useQuery({
    queryKey: ATLAS_STATUS_QUERY_KEY,
    queryFn: fetchReadingStatusItems,
    enabled: apiAvailable && statusApiAvailable,
    staleTime: 20_000,
  });

  const noteQuery = useQuery({
    queryKey: ["atlas-status-note", selectedStatusItemId],
    queryFn: async () => {
      if (!selectedStatusItemId) {
        return { itemId: "", content: "", notePath: null, vaultPath: statusQuery.data?.vaultPath || null };
      }
      const result = await window.api.getReadingStatusItemNote(selectedStatusItemId);
      if (!result.success || !result.payload) {
        throw new Error(result.error || "Erro ao carregar nota");
      }
      return result.payload;
    },
    enabled: apiAvailable && statusApiAvailable && Boolean(selectedStatusItemId),
    staleTime: 5_000,
  });

  useEffect(() => {
    if (!window.api?.onLibraryUpdated) return undefined;
    return window.api.onLibraryUpdated(() => {
      queryClient.invalidateQueries({ queryKey: ATLAS_BOOKS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: [ATLAS_MAP_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ATLAS_STATUS_QUERY_KEY });
    });
  }, [queryClient]);

  useEffect(() => {
    const payload = mapQuery.data;
    if (!payload) return;
    if (selectedMapId && selectedMapId !== payload.activeMap.id) {
      setSelectedMapId(payload.activeMap.id);
    }
    if (!activeSectionId || !payload.sections.some((section) => section.id === activeSectionId)) {
      setActiveSectionId(payload.sections[0]?.id || null);
    }
  }, [activeSectionId, mapQuery.data, selectedMapId]);

  useEffect(() => {
    const activeItems = (statusQuery.data?.items ?? []).filter((item) => item.status === activeStatusView);
    if (selectedStatusItemId && activeItems.some((item) => item.id === selectedStatusItemId)) return;
    setSelectedStatusItemId(activeItems.find((item) => item.isPrimary)?.id || activeItems[0]?.id || null);
  }, [activeStatusView, selectedStatusItemId, statusQuery.data?.items]);

  const payload = mapQuery.data;
  const statusItems = statusQuery.data?.items ?? [];
  const atlasVaultPath = statusQuery.data?.vaultPath ?? noteQuery.data?.vaultPath ?? null;
  const cachedReadings = queryClient.getQueryData<TableReading[]>(["readings"]) ?? [];
  const readings = readingsQuery.data ?? cachedReadings;
  const stats = useMemo(() => getMapStats(payload?.sections ?? []), [payload?.sections]);
  const activeSection = useMemo(
    () => payload?.sections.find((section) => section.id === activeSectionId) || payload?.sections[0] || null,
    [activeSectionId, payload?.sections],
  );

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ATLAS_BOOKS_QUERY_KEY });
    queryClient.invalidateQueries({ queryKey: [ATLAS_MAP_QUERY_KEY] });
    queryClient.invalidateQueries({ queryKey: ATLAS_STATUS_QUERY_KEY });
  }, [queryClient]);

  const applyMapResult = useCallback((result: { success: boolean; payload?: ReadingMapPayload; error?: string }) => {
    if (!result.success || !result.payload) {
      toast.error(result.error || "Erro ao atualizar mapa");
      return;
    }

    setSelectedMapId(result.payload.activeMap.id);
    queryClient.setQueryData([ATLAS_MAP_QUERY_KEY, result.payload.activeMap.id], result.payload);
    queryClient.invalidateQueries({ queryKey: [ATLAS_MAP_QUERY_KEY] });
  }, [queryClient]);

  const applyStatusResult = useCallback((result: { success: boolean; payload?: ReadingStatusPayload; error?: string }) => {
    if (!result.success || !result.payload) {
      toast.error(result.error || "Erro ao atualizar estados");
      return;
    }

    queryClient.setQueryData(ATLAS_STATUS_QUERY_KEY, result.payload);
    queryClient.invalidateQueries({ queryKey: ATLAS_STATUS_QUERY_KEY });
    queryClient.invalidateQueries({ queryKey: ATLAS_BOOKS_QUERY_KEY });
    queryClient.invalidateQueries({ queryKey: [ATLAS_MAP_QUERY_KEY] });
  }, [queryClient]);

  const handleOpenBook = useCallback(async (book: BookWithThumbnail) => {
    if (!book.filePath) {
      toast.error("Caminho do arquivo nao encontrado");
      return;
    }

    try {
      const result = await window.api.openDocumentByHash(book.fileHash, book.filePath);
      if (!result) {
        toast.error("Erro ao abrir o arquivo");
        return;
      }
      if ("error" in result) {
        toast.error(result.message || "Erro ao abrir o arquivo");
        return;
      }

      const filePath = result.foundAt || result.filePath || book.filePath;
      const fileType =
        result.fileType === "epub" || filePath.toLowerCase().endsWith(".epub")
          ? "epub"
          : "pdf";

      navigate("/reading", {
        state: {
          fileBuffer: result.fileBuffer,
          fileHash: result.fileHash || book.fileHash,
          fileName: result.fileName || book.fileName || book.title,
          filePath,
          fileType,
          source: "library",
          navigationId: getNavigationId(),
        },
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao abrir o arquivo");
    }
  }, [navigate]);

  const handleMapMutation = useCallback(async (
    mutation: () => Promise<{ success: boolean; payload?: ReadingMapPayload; error?: string }>,
    successMessage?: string,
  ) => {
    try {
      const result = await mutation();
      applyMapResult(result);
      if (result.success && successMessage) toast.success(successMessage);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao atualizar mapa");
    }
  }, [applyMapResult]);

  const handleStatusMutation = useCallback(async (
    mutation: () => Promise<{ success: boolean; payload?: ReadingStatusPayload; error?: string }>,
    successMessage?: string,
  ) => {
    try {
      const result = await mutation();
      applyStatusResult(result);
      if (result.success && successMessage) toast.success(successMessage);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao atualizar estados");
    }
  }, [applyStatusResult]);

  const handleChooseVault = useCallback(async () => {
    try {
      const result = await window.api.selectFolder();
      const folderPath = result && !result.canceled ? result.filePaths[0] : null;
      if (!folderPath) return;
      await handleStatusMutation(
        () => window.api.setAtlasNotesVault(folderPath),
        "Vault definido",
      );
      queryClient.invalidateQueries({ queryKey: ["atlas-status-note", selectedStatusItemId] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao definir Vault");
    }
  }, [handleStatusMutation, queryClient, selectedStatusItemId]);

  const handleSaveNote = useCallback(async (content: string) => {
    if (!selectedStatusItemId) {
      toast.error("Selecione um livro");
      return;
    }

    setNoteSaving(true);
    try {
      const result = await window.api.saveReadingStatusItemNote(selectedStatusItemId, content);
      if (!result.success || !result.payload) {
        throw new Error(result.error || "Erro ao salvar nota");
      }
      queryClient.setQueryData(["atlas-status-note", selectedStatusItemId], result.payload);
      queryClient.invalidateQueries({ queryKey: ATLAS_STATUS_QUERY_KEY });
      toast.success("Nota salva");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar nota");
    } finally {
      setNoteSaving(false);
    }
  }, [queryClient, selectedStatusItemId]);

  const handleCoverChange = useCallback(async (item: ReadingStatusItem) => {
    try {
      const imagePath = await window.api.openImageDialog();
      if (!imagePath) return;
      setCoverTarget(item);
      setThumbnailDialog({ open: true, imagePath });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao selecionar capa");
    }
  }, []);

  const handleSetStatusCover = useCallback(async (mode: "replace" | "prepend") => {
    const target = coverTarget;
    if (!target || !thumbnailDialog.imagePath) return;

    try {
      if (target.bookId && target.book) {
        const result = await window.api.setThumbnail(target.book.fileHash, thumbnailDialog.imagePath, mode);
        if (!result.success) throw new Error(result.error || "Erro ao definir capa");
        toast.success("Capa atualizada");
        queryClient.invalidateQueries({ queryKey: ATLAS_BOOKS_QUERY_KEY });
      } else {
        const result = await window.api.updateReadingStatusItemCover(target.id, thumbnailDialog.imagePath);
        applyStatusResult(result);
        if (!result.success) return;
        toast.success("Capa atualizada");
      }
      setThumbnailDialog({ open: false, imagePath: "" });
      setCoverTarget(null);
      queryClient.invalidateQueries({ queryKey: ATLAS_STATUS_QUERY_KEY });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao definir capa");
    }
  }, [applyStatusResult, coverTarget, queryClient, thumbnailDialog.imagePath]);

  const handleManualMetadataSave = useCallback(async (
    item: ReadingStatusItem,
    metadata: BookMetadataSavePayload,
  ) => {
    await handleStatusMutation(
      () => window.api.updateReadingStatusItemMetadata(item.id, {
        title: metadata.title,
        author: metadata.author ?? null,
        description: metadata.description ?? null,
        isbn: metadata.isbn ?? null,
        publisher: metadata.publisher ?? null,
        publishDate: metadata.publishDate ?? null,
        subject: metadata.subject ?? null,
        manualTotalPages: metadata.pageCount ?? null,
        coverPath: metadata.coverUrl ?? undefined,
      }),
      "Metadados salvos",
    );
  }, [handleStatusMutation]);

  const handleRoadmapDragStart = useCallback((
    event: ReactDragEvent<HTMLElement>,
    itemId: string,
  ) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/x-lyceum-roadmap-item", itemId);
    event.dataTransfer.setData("text/plain", itemId);
    setDraggedItemId(itemId);
  }, []);

  const handleRoadmapDragEnd = useCallback(() => {
    setDraggedItemId(null);
    setDropTarget(null);
  }, []);

  const handleRoadmapDragOverSection = useCallback((
    event: ReactDragEvent<HTMLElement>,
    sectionId: string,
    index: number,
  ) => {
    if (!draggedItemId || statusFilter !== "all") return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setActiveSectionId(sectionId);
    setDropTarget({ sectionId, index });
  }, [draggedItemId, statusFilter]);

  const handleRoadmapDragOverItem = useCallback((
    event: ReactDragEvent<HTMLElement>,
    item: ReadingMapItem,
    index: number,
  ) => {
    if (!draggedItemId || draggedItemId === item.id || statusFilter !== "all") return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";

    const bounds = event.currentTarget.getBoundingClientRect();
    const insertAfter = event.clientX > bounds.left + bounds.width / 2;
    setActiveSectionId(item.sectionId);
    setDropTarget({
      sectionId: item.sectionId,
      index: index + (insertAfter ? 1 : 0),
    });
  }, [draggedItemId, statusFilter]);

  const handleRoadmapDrop = useCallback((event: ReactDragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const itemId =
      event.dataTransfer.getData("application/x-lyceum-roadmap-item") ||
      event.dataTransfer.getData("text/plain") ||
      draggedItemId;
    const target = dropTarget;

    setDraggedItemId(null);
    setDropTarget(null);

    if (!itemId || !target || statusFilter !== "all") return;

    void handleMapMutation(
      () => window.api.positionReadingMapItem(itemId, target.sectionId, target.index),
      "Livro reposicionado",
    );
  }, [draggedItemId, dropTarget, handleMapMutation, statusFilter]);

  const handleStatusDragStart = useCallback((
    event: ReactDragEvent<HTMLElement>,
    itemId: string,
  ) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/x-lyceum-status-item", itemId);
    event.dataTransfer.setData("text/plain", itemId);
    setDraggedStatusItemId(itemId);
  }, []);

  const handleStatusDragEnd = useCallback(() => {
    setDraggedStatusItemId(null);
    setStatusDropTarget(null);
  }, []);

  const handleStatusDragOverBoard = useCallback((
    event: ReactDragEvent<HTMLElement>,
    index: number,
  ) => {
    if (!draggedStatusItemId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setStatusDropTarget({ status: activeStatusView, index });
  }, [activeStatusView, draggedStatusItemId]);

  const handleStatusDragOverItem = useCallback((
    event: ReactDragEvent<HTMLElement>,
    item: ReadingStatusItem,
    index: number,
  ) => {
    if (!draggedStatusItemId || draggedStatusItemId === item.id) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";

    const bounds = event.currentTarget.getBoundingClientRect();
    const insertAfter = event.clientY > bounds.top + bounds.height / 2;
    setStatusDropTarget({
      status: activeStatusView,
      index: index + (insertAfter ? 1 : 0),
    });
  }, [activeStatusView, draggedStatusItemId]);

  const handleStatusDrop = useCallback((event: ReactDragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const itemId =
      event.dataTransfer.getData("application/x-lyceum-status-item") ||
      event.dataTransfer.getData("text/plain") ||
      draggedStatusItemId;
    const target = statusDropTarget;

    setDraggedStatusItemId(null);
    setStatusDropTarget(null);

    if (!itemId || !target) return;

    void handleStatusMutation(
      () => window.api.positionReadingStatusItem(itemId, target.status, target.index),
      "Ordem atualizada",
    );
  }, [draggedStatusItemId, handleStatusMutation, statusDropTarget]);

  if (!apiAvailable) {
    return (
      <div className="flex h-full items-center justify-center bg-zinc-950 p-6 text-sm text-zinc-500">
        Atlas esta disponivel no app desktop.
      </div>
    );
  }

  const loading =
    booksQuery.isLoading ||
    booksQuery.isFetching ||
    mapQuery.isLoading ||
    mapQuery.isFetching ||
    statusQuery.isFetching;
  const canDragRoadmap = statusFilter === "all";
  const filteredSections = (payload?.sections ?? []).map((section) => ({
    ...section,
    items: statusFilter === "all"
      ? section.items
      : section.items.filter((item) => item.status === statusFilter),
  }));

  return (
    <div className="flex h-full min-h-0 flex-col bg-zinc-950 p-4 text-zinc-100">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-sm border border-zinc-800 bg-zinc-900">
            <BookMarked size={20} className="text-green-300" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-zinc-100">Atlas</h1>
            <p className="text-sm text-zinc-500">
              {view === "roadmap"
                ? "Construa trilhas de leitura por etapas."
                : "Organize a biblioteca por estado de leitura."}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-sm border border-zinc-800 bg-zinc-900 p-1">
            <button
              type="button"
              onClick={() => setView("roadmap")}
              className={`h-8 cursor-pointer rounded-sm px-3 text-sm ${view === "roadmap" ? "bg-green-500 text-zinc-950" : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"}`}
            >
              Roadmap
            </button>
            <button
              type="button"
              onClick={() => setView("status")}
              className={`h-8 cursor-pointer rounded-sm px-3 text-sm ${view === "status" ? "bg-green-500 text-zinc-950" : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"}`}
            >
              Estados
            </button>
          </div>
          <button
            type="button"
            onClick={refresh}
            className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-sm border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-300 transition-colors hover:border-zinc-700 hover:bg-zinc-800"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            Atualizar
          </button>
        </div>
      </header>

      {view === "status" ? (
        <StatusBoardV2
          items={statusItems}
          activeStatus={activeStatusView}
          selectedItemId={selectedStatusItemId}
          search={statusSearch}
          loading={statusQuery.isLoading || statusQuery.isFetching}
          readings={readings}
          vaultPath={atlasVaultPath}
          noteContent={noteQuery.data?.content || ""}
          notePath={noteQuery.data?.notePath || null}
          noteLoading={noteQuery.isLoading || noteQuery.isFetching}
          noteSaving={noteSaving}
          draggedItemId={draggedStatusItemId}
          dropTarget={statusDropTarget}
          onActiveStatusChange={(status) => {
            setActiveStatusView(status);
            setStatusSearch("");
          }}
          onSearchChange={setStatusSearch}
          onSelectItem={setSelectedStatusItemId}
          onAddLibrary={() => setLibraryPickerTarget({ kind: "status", status: activeStatusView })}
          onAddManual={() => setManualDialogTarget({ kind: "status", status: activeStatusView })}
          onChooseVault={handleChooseVault}
          onSaveNote={handleSaveNote}
          onOpen={handleOpenBook}
          onStatusChange={(itemId, status) =>
            handleStatusMutation(
              () => window.api.updateReadingStatusItemStatus(itemId, status),
              `Movido para ${statusLabel(status)}`,
            )
          }
          onDelete={(itemId) =>
            handleStatusMutation(
              () => window.api.deleteReadingStatusItem(itemId),
              "Livro removido dos estados",
            )
          }
          onSetPrimary={(itemId) =>
            handleStatusMutation(
              () => window.api.setPrimaryReadingStatusItem(itemId),
              "Leitura principal definida",
            )
          }
          onCoverChange={handleCoverChange}
          onMetadataSearch={setMetadataTarget}
          onProgressSave={(itemId, updates) =>
            handleStatusMutation(
              () => window.api.updateReadingStatusItemProgress(itemId, updates),
              "Progresso atualizado",
            )
          }
          onProgressEvent={(itemId, pages) =>
            handleStatusMutation(
              () => window.api.addReadingStatusProgressEvent(itemId, pages),
              "Registro somado",
            )
          }
          onDragStart={handleStatusDragStart}
          onDragEnd={handleStatusDragEnd}
          onDragOverItem={handleStatusDragOverItem}
          onDragOverBoard={handleStatusDragOverBoard}
          onDrop={handleStatusDrop}
        />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Mapa de leitura"
                value={payload?.activeMap.id || ""}
                onChange={(event) => setSelectedMapId(event.target.value)}
                className="h-9 cursor-pointer rounded-sm border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-200 outline-none focus:border-green-500"
              >
                {(payload?.maps ?? []).map((map) => (
                  <option key={map.id} value={map.id}>{map.title}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setMapDialogOpen(true)}
                className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-sm border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-300 hover:bg-zinc-800"
              >
                <Plus size={15} />
                Novo mapa
              </button>
              <button
                type="button"
                onClick={() => setSectionDialogOpen(true)}
                className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-sm border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-300 hover:bg-zinc-800"
              >
                <Plus size={15} />
                Nova etapa
              </button>
              <button
                type="button"
                onClick={() => activeSection ? setLibraryPickerTarget({ kind: "roadmap", sectionId: activeSection.id }) : toast.error("Selecione uma etapa")}
                className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-sm bg-green-500 px-3 text-sm font-medium text-zinc-950 hover:bg-green-400"
              >
                <Plus size={15} />
                Adicionar livro
              </button>
              <button
                type="button"
                onClick={() => activeSection ? setManualDialogTarget({ kind: "roadmap", sectionId: activeSection.id }) : toast.error("Selecione uma etapa")}
                className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-sm border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-300 hover:bg-zinc-800"
              >
                <FileText size={15} />
                Livro manual
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex overflow-hidden rounded-sm border border-zinc-800 bg-zinc-900">
                {(["all", "read", "reading", "paused", "want_to_read"] as StatusFilter[]).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setStatusFilter(filter)}
                    className={`flex h-8 cursor-pointer items-center gap-1.5 px-3 text-xs ${statusFilter === filter ? "bg-green-500 text-zinc-950" : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"}`}
                  >
                    {filter !== "all" && (
                      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_VISUAL[filter].dot}`} />
                    )}
                    {filter === "all" ? "Todos" : statusLabel(filter)}
                  </button>
                ))}
              </div>
              <div className="flex overflow-hidden rounded-sm border border-zinc-800 bg-zinc-900">
                <button
                  type="button"
                  onClick={() => setZoom((value) => Math.max(0.8, Number((value - 0.1).toFixed(1))))}
                  className="flex h-8 w-10 cursor-pointer items-center justify-center text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                  title="Reduzir zoom"
                >
                  <Minus size={14} />
                </button>
                <span className="flex h-8 w-16 items-center justify-center border-x border-zinc-800 text-xs text-zinc-400">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoom((value) => Math.min(1.3, Number((value + 0.1).toFixed(1))))}
                  className="flex h-8 w-10 cursor-pointer items-center justify-center text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                  title="Aumentar zoom"
                >
                  <Plus size={14} />
                </button>
              </div>
              {!canDragRoadmap && (
                <span className="text-xs text-zinc-500">
                  Use Todos para reorganizar.
                </span>
              )}
            </div>
          </div>

          <div className="mb-3 grid grid-cols-2 gap-2 text-xs md:grid-cols-6">
            {[
              ["Etapas", stats.sections],
              ["Livros", stats.total],
              ["Concluidos", stats.read],
              ["Em curso", stats.reading],
              ["Fila", stats.want],
              ["Paginas", stats.pages || "-"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-sm border border-zinc-800 bg-zinc-900 px-3 py-2">
                <p className="text-zinc-500">{label}</p>
                <p className="mt-1 text-base font-semibold text-zinc-100">{value}</p>
              </div>
            ))}
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="min-h-0 overflow-auto rounded-sm border border-zinc-800 bg-zinc-900/50 p-3">
              {mapQuery.isLoading ? (
                <div className="flex h-80 items-center justify-center text-sm text-zinc-500">Carregando mapa...</div>
              ) : mapQuery.error ? (
                <div className="flex h-80 items-center justify-center text-sm text-red-300">Erro ao carregar mapa.</div>
              ) : (
                <div
                  className="min-w-[820px] space-y-3"
                  style={{
                    transform: `scale(${zoom})`,
                    transformOrigin: "top left",
                    width: `${100 / zoom}%`,
                  }}
                >
                  {filteredSections.map((section, index) => (
                    <section
                      key={section.id}
                      onMouseEnter={() => setActiveSectionId(section.id)}
                      onClick={() => setActiveSectionId(section.id)}
                      onDragOver={(event) => handleRoadmapDragOverSection(event, section.id, section.items.length)}
                      onDrop={handleRoadmapDrop}
                      className={`grid min-h-[236px] grid-cols-[150px_minmax(0,1fr)] overflow-hidden rounded-sm border transition-colors ${
                        activeSection?.id === section.id
                          ? "border-green-500/50 bg-green-500/[0.025]"
                          : "border-zinc-800 bg-zinc-950/70"
                      }`}
                    >
                      <button
                        type="button"
                        className="flex h-full cursor-pointer flex-col items-start justify-center border-r border-zinc-800 bg-zinc-950/60 px-5 text-left"
                        onClick={() => setActiveSectionId(section.id)}
                      >
                        <span className="text-xs font-semibold uppercase tracking-wide text-green-400">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span className="mt-3 text-base font-semibold text-zinc-100">
                          {section.title}
                        </span>
                        <span className="mt-3 text-xs text-zinc-500">
                          {section.items.length} livros
                        </span>
                      </button>
                      <div className="relative min-h-[236px] overflow-x-auto px-8 py-5">
                        {index > 0 && (
                          <div className="absolute left-1/2 top-0 h-5 w-px bg-zinc-700" aria-hidden="true" />
                        )}
                        {index < filteredSections.length - 1 && (
                          <div className="absolute bottom-0 left-1/2 h-5 w-px bg-zinc-700" aria-hidden="true" />
                        )}
                        <div className="relative flex min-h-[194px] items-start justify-center gap-4">
                          {section.items.length > 1 && (
                            <div className="absolute left-10 right-10 top-[74px] h-px bg-zinc-800" aria-hidden="true" />
                          )}
                          {section.items.length === 0 ? (
                            <div
                              onDragOver={(event) => handleRoadmapDragOverSection(event, section.id, 0)}
                              onDrop={handleRoadmapDrop}
                              className={`relative z-10 flex min-h-[178px] min-w-[260px] items-center justify-center rounded-sm border border-dashed px-4 py-3 text-center text-sm transition-colors ${
                                dropTarget?.sectionId === section.id
                                  ? "border-green-500/60 bg-green-500/10 text-green-200"
                                  : "border-zinc-800 text-zinc-500"
                              }`}
                            >
                              Solte um livro nesta etapa.
                            </div>
                          ) : (
                            section.items.map((item, itemIndex) => {
                              const showDropBefore =
                                dropTarget?.sectionId === section.id &&
                                dropTarget.index === itemIndex &&
                                draggedItemId !== item.id;
                              const showDropAfter =
                                dropTarget?.sectionId === section.id &&
                                dropTarget.index === itemIndex + 1 &&
                                draggedItemId !== item.id;

                              return (
                                <RoadmapItemCard
                                  key={item.id}
                                  item={item}
                                  index={itemIndex}
                                  canDrag={canDragRoadmap}
                                  isDragging={draggedItemId === item.id}
                                  showDropBefore={Boolean(showDropBefore)}
                                  showDropAfter={Boolean(showDropAfter)}
                                  onOpen={handleOpenBook}
                                  onDragStart={handleRoadmapDragStart}
                                  onDragEnd={handleRoadmapDragEnd}
                                  onDragOver={handleRoadmapDragOverItem}
                                  onDrop={handleRoadmapDrop}
                                  onStatusChange={(itemId, status) =>
                                    handleMapMutation(
                                      () => window.api.updateReadingMapItemStatus(itemId, status),
                                      `Movido para ${statusLabel(status)}`,
                                    )
                                  }
                                  onDelete={(itemId) =>
                                    handleMapMutation(
                                      () => window.api.deleteReadingMapItem(itemId),
                                      "Livro removido do mapa",
                                    )
                                  }
                                />
                              );
                            })
                          )}
                          {section.items.length > 0 && dropTarget?.sectionId === section.id && dropTarget.index >= section.items.length && (
                            <div className="relative z-20 h-[178px] w-1 flex-shrink-0 rounded-sm bg-green-400" />
                          )}
                        </div>
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </div>

            <SectionDetails
              section={activeSection}
              onSave={(sectionId, updates) =>
                handleMapMutation(
                  () => window.api.updateReadingMapSection(sectionId, updates),
                  "Etapa atualizada",
                )
              }
            />
          </div>

          <SimpleTextDialog
            open={mapDialogOpen}
            title="Novo mapa"
            titlePlaceholder="Nome do mapa"
            descriptionPlaceholder="Descricao opcional"
            submitLabel="Criar mapa"
            onClose={() => setMapDialogOpen(false)}
            onSubmit={(values) => {
              setMapDialogOpen(false);
              handleMapMutation(
                () => window.api.createReadingMap(values.title, values.description),
                "Mapa criado",
              );
            }}
          />
          <SimpleTextDialog
            open={sectionDialogOpen}
            title="Nova etapa"
            titlePlaceholder="Nome da etapa"
            descriptionPlaceholder="Descricao e objetivo da etapa"
            submitLabel="Criar etapa"
            onClose={() => setSectionDialogOpen(false)}
            onSubmit={(values) => {
              if (!payload?.activeMap) return;
              setSectionDialogOpen(false);
              handleMapMutation(
                () => window.api.createReadingMapSection(payload.activeMap.id, values.title, values.description),
                "Etapa criada",
              );
            }}
          />
        </>
      )}

      <LibraryPickerDialog
        open={Boolean(libraryPickerTarget)}
        books={booksQuery.data ?? []}
        onClose={() => setLibraryPickerTarget(null)}
        onSelect={(book) => {
          const target = libraryPickerTarget;
          if (!target) return;
          setLibraryPickerTarget(null);

          if (target.kind === "roadmap") {
            handleMapMutation(
              () => window.api.addLibraryBookToReadingMap(target.sectionId, book.fileHash),
              "Livro adicionado ao mapa",
            );
            return;
          }

          handleStatusMutation(
            () => window.api.addLibraryBookToReadingStatus(target.status, book.fileHash),
            "Livro adicionado aos estados",
          );
        }}
      />
      <ManualBookDialog
        open={Boolean(manualDialogTarget)}
        initialStatus={manualDialogTarget?.kind === "status" ? manualDialogTarget.status : "want_to_read"}
        onClose={() => setManualDialogTarget(null)}
        onSubmit={(data) => {
          const target = manualDialogTarget;
          if (!target) return;
          setManualDialogTarget(null);

          if (target.kind === "roadmap") {
            handleMapMutation(
              () => window.api.addManualBookToReadingMap(target.sectionId, data),
              "Livro manual adicionado",
            );
            return;
          }

          handleStatusMutation(
            () => window.api.addManualBookToReadingStatus({ ...data, status: data.status || target.status }),
            "Livro manual adicionado",
          );
        }}
      />
      <SetThumbnailDialog
        isOpen={thumbnailDialog.open}
        imagePath={thumbnailDialog.imagePath}
        onSetThumbnail={handleSetStatusCover}
        onClose={() => {
          setThumbnailDialog({ open: false, imagePath: "" });
          setCoverTarget(null);
        }}
      />
      {metadataTarget && (
        <BookMetadataSearchDialog
          isOpen={Boolean(metadataTarget)}
          book={metadataTarget.book || createSyntheticBook(metadataTarget)}
          thumbnail={getManualCoverSrc(metadataTarget.coverPath) || undefined}
          onClose={() => setMetadataTarget(null)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ATLAS_BOOKS_QUERY_KEY });
            queryClient.invalidateQueries({ queryKey: ATLAS_STATUS_QUERY_KEY });
            queryClient.invalidateQueries({ queryKey: ["atlas-status-note", selectedStatusItemId] });
            setMetadataTarget(null);
          }}
          onSaveMetadata={metadataTarget.book ? undefined : (metadata) => handleManualMetadataSave(metadataTarget, metadata)}
        />
      )}
    </div>
  );
}
