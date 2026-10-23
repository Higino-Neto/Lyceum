import {
  useEffect,
  useState,
  type DragEvent as ReactDragEvent,
} from "react";
import {
  BookMarked,
  BookOpen,
  CalendarDays,
  ChevronDown,
  Clock,
  Edit3,
  FileText,
  GripVertical,
  Library,
  MoreVertical,
  Plus,
  Search,
  Star,
  Trash2,
  Upload,
} from "lucide-react";
import type {
  BookWithThumbnail,
  ReadingStatus,
  ReadingStatusItem,
} from "../../../types/LibraryTypes";
import { useTranslation } from "react-i18next";
import type TableReading from "../../../types/TableReading";
import { formatDate, formatNumber, normalizeCase } from "../../../i18n";
import { READING_STATUS_OPTIONS } from "../../../lib/readingStatus";
import {
  getBookFolderLabel,
  getTitleWithoutExtension,
} from "../../Library/utils";
import {
  getExternalReadingPages,
  getStatusItemReadPages,
  getStatusItemTotalPages,
  formatLastReading,
} from "../atlasUtils";
import {
  emptyMessage,
  STATUS_VISUAL,
  type StatusDropTarget,
} from "../atlasTypes";
import { LocalCover } from "./BookCover";

interface StatusBoardProps {
  items: ReadingStatusItem[];
  activeStatus: ReadingStatus;
  selectedItemId: string | null;
  search: string;
  loading: boolean;
  readings: TableReading[];
  draggedItemId: string | null;
  dropTarget: StatusDropTarget;
  onActiveStatusChange: (status: ReadingStatus) => void;
  onSearchChange: (value: string) => void;
  onSelectItem: (itemId: string) => void;
  onAddLibrary: () => void;
  onAddManual: () => void;
  onOpen: (book: BookWithThumbnail) => void;
  onStatusChange: (itemId: string, status: ReadingStatus) => void;
  onSetPrimary: (itemId: string) => void;
  onCoverChange: (item: ReadingStatusItem) => void;
  onMetadataSearch: (item: ReadingStatusItem) => void;
  onDelete: (itemId: string) => void;
  onProgressSave: (itemId: string, updates: { manualBasePage?: number; manualCurrentPage?: number; manualTotalPages?: number | null }) => void;
  onProgressEvent: (itemId: string, pages: number) => void;
  onRatingChange: (itemId: string, rating: number) => void;
  onDragStart: (event: ReactDragEvent<HTMLElement>, itemId: string) => void;
  onDragEnd: () => void;
  onDragOverItem: (event: ReactDragEvent<HTMLElement>, item: ReadingStatusItem, index: number) => void;
  onDragOverBoard: (event: ReactDragEvent<HTMLElement>, index: number) => void;
  onDrop: (event: ReactDragEvent<HTMLElement>) => void;
}

function RatingInput({
  value,
  onChange,
  starSize = 12,
}: {
  value: number;
  onChange?: (rating: number) => void;
  starSize?: number;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(value));

  const handleSave = () => {
    const normalized = editValue.replace(",", ".");
    const num = Number(normalized);
    if (!isNaN(num) && num >= 0 && num <= 10) {
      onChange?.(num);
    } else {
      setEditValue(String(value));
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        type="number"
        min={0}
        max={10}
        step={0.1}
        value={editValue}
        autoFocus
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSave();
          if (e.key === "Escape") { setEditValue(String(value)); setEditing(false); }
        }}
        className="h-6 w-12 rounded-sm border border-border-strong bg-surface px-1 text-center text-xs tabular-nums text-foreground outline-none focus:border-primary"
      />
    );
  }

  return (
    <button
      type="button"
      disabled={!onChange}
      onClick={() => { setEditValue(String(value)); setEditing(true); }}
      className={`inline-flex items-center gap-0.5 ${
        onChange ? "cursor-pointer" : "cursor-default"
      } ${value > 0 ? "text-warning" : "text-foreground-subtle"} hover:text-warning`}
      title={t("atlas:actions.rateTitle")}
    >
      <Star size={starSize} fill={value > 0 ? "currentColor" : "none"} />
      <span className="text-xs tabular-nums">{value}</span>
    </button>
  );
}

function StatusCoverButton({
  item,
  onCoverChange,
}: {
  item: ReadingStatusItem;
  onCoverChange: (item: ReadingStatusItem) => void;
}) {
  const { t } = useTranslation();
  const [coverUrl, setCoverUrl] = useState<string | null>(null);

  useEffect(() => {
    if (item.book || !item.coverPath) { setCoverUrl(null); return; }
    window.api.readImageDataUrl(item.coverPath).then((r) => {
      if (r.success) setCoverUrl(r.data);
    });
  }, [item.book, item.coverPath]);

  return (
    <div className="group/cover relative h-24 w-16 flex-shrink-0 overflow-hidden rounded-sm border border-border bg-background">
      {item.book ? (
        <LocalCover book={item.book} />
      ) : coverUrl ? (
        <img src={coverUrl} alt={item.title} className="h-full w-full object-contain" />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <FileText size={20} className="text-foreground-subtle" />
        </div>
      )}
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onCoverChange(item);
        }}
        className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center gap-1 bg-backdrop text-xs font-medium text-foreground opacity-0 transition-opacity group-hover/cover:opacity-100"
        title={t("atlas:actions.setCover")}
      >
        <Upload size={14} />
        {t("atlas:actions.cover")}
      </button>
    </div>
  );
}

function StatusActionMenu({
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
  const { t } = useTranslation();

  return (
    <div className="relative">
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onToggle();
        }}
        className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-sm border border-border text-foreground-subtle hover:bg-surface-muted hover:text-foreground"
        title={t("atlas:actions.label")}
      >
        <MoreVertical size={16} />
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-30 w-56 overflow-hidden rounded-sm border border-border bg-background shadow-2xl">
          <button type="button" onClick={onSetPrimary} className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-xs text-foreground hover:bg-surface hover:text-primary">
            <Star size={13} />
            {t("atlas:actions.setPrimary")}
          </button>
          <button type="button" onClick={onEditPages} className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-xs text-foreground hover:bg-surface hover:text-foreground">
            <Edit3 size={13} />
            {t("atlas:actions.editPages")}
          </button>
          <button type="button" onClick={onMetadataSearch} className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-xs text-foreground hover:bg-surface hover:text-foreground">
            <Search size={13} />
            {t("atlas:actions.searchMetadata")}
          </button>
          <div className="border-t border-border py-1">
            <p className="px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-foreground-subtle">
              {t("atlas:actions.moveTo")}
            </p>
            {READING_STATUS_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onStatusChange(option.value)}
                className={`flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-xs ${
                  item.status === option.value ? "bg-primary-muted text-primary" : "text-foreground-muted hover:bg-surface hover:text-foreground"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${STATUS_VISUAL[option.value].dot}`} />
                {t(STATUS_VISUAL[option.value].labelKey)}
              </button>
            ))}
          </div>
          <button type="button" onClick={onDelete} className="flex w-full cursor-pointer items-center gap-2 border-t border-border px-3 py-2 text-left text-xs text-destructive hover:bg-destructive-muted">
            <Trash2 size={13} />
            {t("atlas:actions.removeFromList")}
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
  onRatingChange,
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
  onRatingChange: (itemId: string, rating: number) => void;
  onDragStart: (event: ReactDragEvent<HTMLElement>, itemId: string) => void;
  onDragEnd: () => void;
  onDragOver: (event: ReactDragEvent<HTMLElement>, item: ReadingStatusItem, index: number) => void;
  onDrop: (event: ReactDragEvent<HTMLElement>) => void;
  onToggleMenu: (itemId: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const title = getTitleWithoutExtension(item.title, item.book?.fileType);
  const totalPages = getStatusItemTotalPages(item);
  const readPages = getStatusItemReadPages(item, externalPages);
  const progress = totalPages > 0 ? Math.min(100, Math.round((readPages / totalPages) * 100)) : 0;
  const lastReading = formatLastReading(item, readings);
  const displayRating = item.rating || item.book?.rating || 0;

  return (
    <article
      draggable
      onClick={() => onSelect(item.id)}
      onDragStart={(event) => onDragStart(event, item.id)}
      onDragEnd={onDragEnd}
      onDragOver={(event) => onDragOver(event, item, index)}
      onDrop={onDrop}
      className={`group relative grid cursor-pointer select-none grid-cols-[20px_64px_minmax(0,1fr)_70px_150px_60px] items-center gap-3 border-b border-border px-4 py-3.5 transition-colors duration-150 ${
        isDragging
          ? "bg-surface/40 opacity-40"
          : isSelected
          ? "bg-primary-muted"
          : "hover:bg-surface"
      } ${index === 0 ? "border-t border-border-strong" : ""}`}
    >
      {showDropBefore && <div className="absolute -top-[5px] left-3 right-3 h-0.5 rounded-sm bg-primary" />}
      {showDropAfter && <div className="absolute -bottom-[5px] left-3 right-3 h-0.5 rounded-sm bg-primary" />}

      <div className="flex items-center justify-center text-foreground opacity-0 transition-opacity group-hover:opacity-100">
        <GripVertical size={16} />
      </div>

      <div className="flex items-center" onClick={(e) => { e.stopPropagation(); onSelect(item.id); }}>
        <StatusCoverButton item={item} onCoverChange={onCoverChange} />
      </div>

      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          {item.isPrimary && (
            <Star size={14} className="shrink-0 fill-primary text-primary" aria-label={t("atlas:board.primary")} />
          )}
          <span className="truncate text-base font-semibold leading-tight text-foreground">{title}</span>
        </div>
        <p className="mt-0.5 truncate text-sm text-foreground-subtle">
          {item.author || item.book?.author || (item.book
              ? getBookFolderLabel(item.book.filePath)
              : t("atlas:board.manualBook"))}
        </p>
      </div>

      <div className="flex items-center justify-center">
        <RatingInput value={displayRating} onChange={(rating) => onRatingChange(item.id, rating)} starSize={16} />
      </div>

      <div className="flex flex-col items-start justify-center gap-0.5 text-sm text-foreground-subtle">
        {(item.status === "reading" || item.status === "paused") && totalPages > 0 && (
          <span className="text-foreground-muted">{progress}% &middot; {Math.min(readPages, totalPages)}/{totalPages}</span>
        )}
        {item.status === "read" && item.updatedAt && (
          <span className="inline-flex items-center gap-1 text-foreground-muted">
            <CalendarDays size={12} />
            {formatDate(new Date(item.updatedAt), i18n.language)}
          </span>
        )}
        {lastReading && item.status !== "reading" && item.status !== "paused" && (
          <span className="inline-flex items-center gap-1 text-foreground-subtle">
            <Clock size={12} />
            {lastReading}
          </span>
        )}
      </div>

      <div className="flex items-center justify-end gap-1.5">
        {item.book && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onOpen(item.book!);
            }}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-sm border border-border text-foreground-muted transition-colors hover:border-border-strong hover:bg-surface-muted hover:text-foreground"
            title={t("atlas:board.openBook")}
            aria-label={t("atlas:board.openBook")}
          >
            <BookOpen size={15} />
          </button>
        )}
        <StatusActionMenu
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

function DetailPanel({
  item,
  readings,
  externalPages,
  onOpen,
  onCoverChange,
  onMetadataSearch,
  onStatusChange,
  onSetPrimary,
  onDelete,
  onProgressSave,
  onProgressEvent,
  onRatingChange,
}: {
  item: ReadingStatusItem;
  readings: TableReading[];
  externalPages: number;
  onOpen: (book: BookWithThumbnail) => void;
  onCoverChange: (item: ReadingStatusItem) => void;
  onMetadataSearch: (item: ReadingStatusItem) => void;
  onStatusChange: (itemId: string, status: ReadingStatus) => void;
  onSetPrimary: (itemId: string) => void;
  onDelete: (itemId: string) => void;
  onProgressSave: (itemId: string, updates: { manualBasePage?: number; manualCurrentPage?: number; manualTotalPages?: number | null }) => void;
  onProgressEvent: (itemId: string, pages: number) => void;
  onRatingChange: (itemId: string, rating: number) => void;
}) {
  const { t, i18n } = useTranslation();
  const title = getTitleWithoutExtension(item.title, item.book?.fileType);
  const totalPages = getStatusItemTotalPages(item);
  const readPages = getStatusItemReadPages(item, externalPages);
  const progress = totalPages > 0 ? Math.min(100, Math.round((readPages / totalPages) * 100)) : 0;
  const [basePage, setBasePage] = useState(String(item.manualBasePage || 0));
  const [currentPage, setCurrentPage] = useState(String(item.manualCurrentPage || 0));
  const [editTotalPages, setEditTotalPages] = useState(item.manualTotalPages ? String(item.manualTotalPages) : "");
  const [addPages, setAddPages] = useState("");
  const [manualCoverUrl, setManualCoverUrl] = useState<string | null>(null);
  const displayRating = item.rating || item.book?.rating || 0;

  useEffect(() => {
    if (item.book || !item.coverPath) { setManualCoverUrl(null); return; }
    window.api.readImageDataUrl(item.coverPath).then((r) => {
      if (r.success) setManualCoverUrl(r.data);
    });
  }, [item.book, item.coverPath]);

  useEffect(() => {
    setBasePage(String(item.manualBasePage || 0));
    setCurrentPage(String(item.manualCurrentPage || 0));
    setEditTotalPages(item.manualTotalPages ? String(item.manualTotalPages) : "");
    setAddPages("");
  }, [item.id, item.manualBasePage, item.manualCurrentPage, item.manualTotalPages]);

  return (
    <aside className="flex min-h-0 flex-col overflow-y-auto rounded-sm border border-border bg-surface">
      <div className="flex flex-col items-center gap-4 border-b border-border p-5">
        <div className="group/cover relative h-32 w-24 flex-shrink-0 overflow-hidden rounded-sm border border-border bg-background">
          {item.book ? (
            <LocalCover book={item.book} />
          ) : manualCoverUrl ? (
            <img src={manualCoverUrl} alt={title} className="h-full w-full object-contain" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <FileText size={28} className="text-foreground-subtle" />
            </div>
          )}
          <button
            type="button"
            onClick={() => onCoverChange(item)}
            className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center gap-1 bg-backdrop text-xs font-medium text-foreground opacity-0 transition-opacity group-hover/cover:opacity-100"
          >
            <Upload size={16} />
            {t("atlas:actions.cover")}
          </button>
        </div>
        <div className="min-w-0 text-center">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <p className="mt-1 text-sm text-foreground-subtle">
            {item.author || item.book?.author || t("atlas:board.manualBook")}
          </p>
        </div>
        <RatingInput value={displayRating} onChange={(rating) => onRatingChange(item.id, rating)} starSize={18} />
      </div>

      <div className="space-y-4 p-4">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onSetPrimary(item.id)}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-sm border border-border px-3 text-xs text-foreground hover:bg-surface-muted"
          >
            <Star size={12} />
            {t("atlas:board.primary")}
          </button>
          {item.book && (
            <button
              type="button"
              onClick={() => onOpen(item.book!)}
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-sm bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary-hover"
            >
              <BookOpen size={12} />
              Abrir
            </button>
          )}
          <button
            type="button"
            onClick={() => onMetadataSearch(item)}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-sm border border-border px-3 text-xs text-foreground hover:bg-surface-muted"
          >
            <Library size={12} />
            Metadados
          </button>
        </div>

        <div>
          <div className="flex items-center justify-between gap-4">
            <span className={`inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1 text-xs ${STATUS_VISUAL[item.status].border} ${STATUS_VISUAL[item.status].bg} ${STATUS_VISUAL[item.status].text}`}>
              <span className={`h-2 w-2 rounded-full ${STATUS_VISUAL[item.status].dot}`} />
              {t(STATUS_VISUAL[item.status].labelKey)}
            </span>
            <div className="flex gap-1">
              {READING_STATUS_OPTIONS.filter((o) => o.value !== item.status).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onStatusChange(item.id, option.value)}
                  className={`inline-flex h-7 cursor-pointer items-center gap-1 rounded-sm border px-2 text-[11px] transition-colors ${STATUS_VISUAL[option.value].border} ${STATUS_VISUAL[option.value].bg} ${STATUS_VISUAL[option.value].text} hover:opacity-80`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${STATUS_VISUAL[option.value].dot}`} />
                  {t(option.labelKey)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {item.isPrimary && (
          <div className="rounded-sm border border-primary/20 bg-primary-muted px-3 py-2 text-xs text-primary">
            <Star size={12} className="mr-1 inline fill-primary" />
            {t("atlas:board.primary")}
          </div>
        )}

        {item.updatedAt && (
          <div className="flex items-center gap-2 text-xs text-foreground-subtle">
            <CalendarDays size={12} />
            {item.status === "read"
              ? t("atlas:detail.completedOn")
              : t("atlas:detail.lastUpdated")}{" "}
            <span className="text-foreground">
              {formatDate(new Date(item.updatedAt), i18n.language)}
            </span>
          </div>
        )}

        <div>
          <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-foreground-subtle">
              {t("atlas:detail.progress")}
            </h4>
          {totalPages > 0 && (
            <div className="mb-2">
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-foreground-muted">
                {formatNumber(progress, i18n.language)}%
              </span>
                <span className="text-foreground-muted">
                  {t("atlas:board.progressSummary", {
                    read: formatNumber(Math.min(readPages, totalPages), i18n.language),
                    total: formatNumber(totalPages, i18n.language),
                  })}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-sm bg-surface-muted">
                <div
                  className={`h-full rounded-sm transition-[width] duration-300 ${
                    item.status === "paused" ? "bg-warning" : "bg-primary"
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
          <div className="grid grid-cols-3 gap-2">
            <label className="text-xs text-foreground-subtle">
              {t("atlas:detail.basePage")}
              <input type="number" min={0} value={basePage} onChange={(e) => setBasePage(e.target.value)}
                className="mt-1 h-8 w-full rounded-sm border border-border bg-background px-2 text-xs text-foreground outline-none focus:border-primary" />
            </label>
            <label className="text-xs text-foreground-subtle">
              {t("atlas:detail.currentPage")}
              <input type="number" min={0} value={currentPage} onChange={(e) => setCurrentPage(e.target.value)}
                className="mt-1 h-8 w-full rounded-sm border border-border bg-background px-2 text-xs text-foreground outline-none focus:border-primary" />
            </label>
            <label className="text-xs text-foreground-subtle">
              {t("atlas:detail.totalPages")}
              <input type="number" min={1} value={editTotalPages} onChange={(e) => setEditTotalPages(e.target.value)}
                className="mt-1 h-8 w-full rounded-sm border border-border bg-background px-2 text-xs text-foreground outline-none focus:border-primary" />
            </label>
          </div>
          <div className="mt-2 flex gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <input type="number" min={1} value={addPages} onChange={(e) => setAddPages(e.target.value)}
                placeholder={t("atlas:detail.addPagesPlaceholder")}
                className="h-8 min-w-0 flex-1 rounded-sm border border-border bg-background px-2 text-xs text-foreground outline-none placeholder:text-input-placeholder focus:border-primary" />
              <button type="button" onClick={() => {
                const pages = Number(addPages) || 0;
                if (pages <= 0) return;
                onProgressEvent(item.id, pages);
                setAddPages("");
              }}
                className="h-8 shrink-0 cursor-pointer rounded-sm border border-border px-2 text-xs text-foreground hover:bg-surface-muted">
                {t("atlas:detail.add")}
              </button>
            </div>
            <button type="button" onClick={() => {
              onProgressSave(item.id, {
                manualBasePage: Number(basePage) || 0,
                manualCurrentPage: Number(currentPage) || 0,
                manualTotalPages: editTotalPages.trim() ? Number(editTotalPages) : null,
              });
            }}
              className="h-8 cursor-pointer rounded-sm bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary-hover">
              {t("atlas:detail.save")}
            </button>
          </div>
        </div>

        {item.description && (
          <div>
            <h4 className="mb-1 text-xs font-medium uppercase tracking-wider text-foreground-subtle">
              {t("atlas:detail.description")}
            </h4>
            <p className="text-xs leading-5 text-foreground-muted">{item.description}</p>
          </div>
        )}

        {(item.isbn || item.publisher || item.publishDate || item.subject) && (
          <div>
            <h4 className="mb-1.5 text-xs font-medium uppercase tracking-wider text-foreground-subtle">
              {t("atlas:detail.details")}
            </h4>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
              {item.isbn && (
                <div>
                  <span className="text-foreground-subtle">ISBN</span>
                  <p className="text-foreground">{item.isbn}</p>
                </div>
              )}
              {item.publisher && (
                <div>
                  <span className="text-foreground-subtle">{t("atlas:detail.fields.publisher")}</span>
                  <p className="text-foreground">{item.publisher}</p>
                </div>
              )}
              {item.publishDate && (
                <div>
                  <span className="text-foreground-subtle">{t("atlas:detail.fields.publishDate")}</span>
                  <p className="text-foreground">{item.publishDate}</p>
                </div>
              )}
              {item.subject && (
                <div>
                  <span className="text-foreground-subtle">{t("atlas:detail.fields.subject")}</span>
                  <p className="text-foreground">{item.subject}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="mt-auto border-t border-border p-4">
        <button
          type="button"
          onClick={() => onDelete(item.id)}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-sm border border-destructive/40 px-3 py-2 text-xs text-destructive transition-colors hover:bg-destructive-muted"
        >
          <Trash2 size={13} />
          {t("atlas:actions.removeFromList")}
        </button>
      </div>
    </aside>
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
  const { t } = useTranslation();
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
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-backdrop px-4">
      <div className="w-full max-w-lg rounded-sm border border-border bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b border-border p-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              {t("atlas:pageDialog.title")}
            </h2>
            <p className="mt-1 text-xs text-foreground-subtle">{item.title}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-sm p-2 text-foreground-subtle hover:bg-surface hover:text-foreground">
            <ChevronDown size={16} />
          </button>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-3">
          <label className="text-xs text-foreground-subtle">
            {t("atlas:detail.basePage")}
            <input type="number" min={0} value={basePage} onChange={(event) => setBasePage(event.target.value)} className="mt-1 h-9 w-full rounded-sm border border-border bg-surface px-3 text-sm text-foreground outline-none focus:border-primary" />
          </label>
          <label className="text-xs text-foreground-subtle">
            {t("atlas:detail.currentPage")}
            <input type="number" min={0} value={currentPage} onChange={(event) => setCurrentPage(event.target.value)} className="mt-1 h-9 w-full rounded-sm border border-border bg-surface px-3 text-sm text-foreground outline-none focus:border-primary" />
          </label>
          <label className="text-xs text-foreground-subtle">
            {t("atlas:detail.totalPages")}
            <input type="number" min={1} value={totalPages} onChange={(event) => setTotalPages(event.target.value)} className="mt-1 h-9 w-full rounded-sm border border-border bg-surface px-3 text-sm text-foreground outline-none focus:border-primary" />
          </label>
        </div>
        <div className="border-t border-border p-4">
          <label className="text-xs text-foreground-subtle">
            {t("atlas:pageDialog.addPagesNow")}
            <div className="mt-1 flex gap-2">
              <input type="number" min={1} value={addPages} onChange={(event) => setAddPages(event.target.value)} className="h-9 min-w-0 flex-1 rounded-sm border border-border bg-surface px-3 text-sm text-foreground outline-none focus:border-primary" />
              <button type="button" onClick={() => {
                const pages = Number(addPages) || 0;
                if (pages <= 0) return;
                onProgressEvent(item.id, pages);
                setAddPages("");
              }} className="h-9 cursor-pointer rounded-sm border border-border px-3 text-sm text-foreground hover:bg-surface">
                {t("atlas:detail.add")}
              </button>
            </div>
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-border p-4">
          <button type="button" onClick={onClose} className="h-9 cursor-pointer rounded-sm px-3 text-sm text-foreground-muted hover:bg-surface">
            {t("atlas:detail.cancel")}
          </button>
          <button type="button" onClick={() => {
            onSave(item.id, {
              manualBasePage: Number(basePage) || 0,
              manualCurrentPage: Number(currentPage) || 0,
              manualTotalPages: totalPages.trim() ? Number(totalPages) : null,
            });
            onClose();
          }} className="h-9 cursor-pointer rounded-sm bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary-hover">
            {t("atlas:detail.save")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function StatusBoard({
  items,
  activeStatus,
  selectedItemId,
  search,
  loading,
  readings,
  draggedItemId,
  dropTarget,
  onActiveStatusChange,
  onSearchChange,
  onSelectItem,
  onAddLibrary,
  onAddManual,
  onOpen,
  onStatusChange,
  onSetPrimary,
  onCoverChange,
  onMetadataSearch,
  onDelete,
  onProgressSave,
  onProgressEvent,
  onRatingChange,
  onDragStart,
  onDragEnd,
  onDragOverItem,
  onDragOverBoard,
  onDrop,
}: StatusBoardProps) {
  const { t } = useTranslation();
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [pageDialogItem, setPageDialogItem] = useState<ReadingStatusItem | null>(null);
  const normalizedSearch = normalizeCase(search.trim());
  const activeItems = items
    .filter((item) => item.status === activeStatus)
    .filter((item) => {
      if (!normalizedSearch) return true;
      return [item.title, item.author, item.book?.author, item.publisher, item.subject]
        .filter(Boolean)
        .join(" ")
        .split(" ")
        .map(normalizeCase)
        .join(" ")
        .includes(normalizedSearch);
    })
    .sort((left, right) => Number(right.isPrimary) - Number(left.isPrimary) || left.order - right.order);
  const counts = READING_STATUS_OPTIONS.reduce<Record<ReadingStatus, number>>((acc, option) => {
    acc[option.value] = items.filter((item) => item.status === option.value).length;
    return acc;
  }, { want_to_read: 0, reading: 0, paused: 0, read: 0, not_a_book: 0, unknown: 0 });
  const selectedItem = items.find((item) => item.id === selectedItemId) || activeItems[0] || null;

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_380px]">
      <section className="flex min-h-0 flex-col rounded-sm border border-border bg-surface/50">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-3">
          <div className="flex flex-wrap gap-1 rounded-sm border border-border bg-background p-1">
            {READING_STATUS_OPTIONS.map((option) => {
              const meta = STATUS_VISUAL[option.value];
              const active = activeStatus === option.value;
              return (
                <button key={option.value} type="button" aria-label={t("atlas:status.viewAriaLabel", { label: t(meta.labelKey) })} onClick={() => onActiveStatusChange(option.value)} className={`flex h-9 cursor-pointer items-center gap-2 rounded-sm px-3 text-sm ${active ? "bg-primary text-primary-foreground" : "text-foreground-muted hover:bg-surface hover:text-foreground"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                  {t(meta.labelKey)}
                  <span className={`rounded-sm px-1.5 py-0.5 text-[11px] ${active ? "bg-background/15" : "bg-surface-muted text-foreground"}`}>{counts[option.value]}</span>
                </button>
              );
            })}
          </div>
          <div className="flex min-w-[200px] flex-1 items-center gap-2 rounded-sm border border-border bg-background px-3">
            <Search size={15} className="text-foreground-subtle" />
            <input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder={t("atlas:board.searchPlaceholder")} className="h-9 min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-input-placeholder" />
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onAddLibrary} className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-sm bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary-hover">
              <Plus size={15} />
              {t("atlas:board.add")}
            </button>
            <button type="button" onClick={onAddManual} className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-sm border border-border bg-background px-3 text-sm text-foreground hover:bg-surface">
              <FileText size={15} />
              {t("atlas:board.addManual")}
            </button>
          </div>
        </div>
        <div onDragOver={(event) => onDragOverBoard(event, activeItems.length)} onDrop={onDrop} className="min-h-0 flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="flex h-56 items-center justify-center text-sm text-foreground-subtle">
                {t("atlas:board.loading")}
              </div>
          ) : activeItems.length === 0 ? (
            <div onDragOver={(event) => onDragOverBoard(event, 0)} onDrop={onDrop} className={`flex h-72 flex-col items-center justify-center gap-3 rounded-sm border border-dashed px-4 text-center ${dropTarget?.status === activeStatus ? "border-primary/60 bg-primary-muted text-primary" : "border-border text-foreground-subtle"}`}>
              <BookMarked size={22} className="text-foreground-subtle" />
              <p className="text-sm">{emptyMessage(activeStatus)}</p>
              <p className="max-w-md text-xs text-foreground-subtle">
                {t("atlas:board.emptyHint")}
              </p>
            </div>
          ) : (
            <div className="pb-2">
              <div className="grid grid-cols-[20px_64px_minmax(0,1fr)_70px_150px_60px] gap-3 border-b border-border-strong px-4 pb-3 text-xs font-medium uppercase tracking-wider text-foreground-subtle">
                <div />
                <div />
                <div>{t("atlas:board.columns.title")}</div>
                <div className="text-center">{t("atlas:board.columns.rating")}</div>
                <div>{t("atlas:board.columns.progress")}</div>
                <div />
              </div>
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
                  onRatingChange={onRatingChange}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                  onDragOver={onDragOverItem}
                  onDrop={onDrop}
                  onToggleMenu={(itemId) => setOpenMenuId((current) => current === itemId ? null : itemId)}
                />
              ))}
              {dropTarget?.status === activeStatus && dropTarget.index >= activeItems.length && <div className="h-1 rounded-sm bg-primary" />}
            </div>
          )}
        </div>
      </section>
      {selectedItem && (
        <DetailPanel
          item={selectedItem}
          readings={readings}
          externalPages={getExternalReadingPages(selectedItem, readings)}
          onOpen={onOpen}
          onCoverChange={onCoverChange}
          onMetadataSearch={onMetadataSearch}
          onStatusChange={(itemId, status) => {
            onStatusChange(itemId, status);
          }}
          onSetPrimary={onSetPrimary}
          onDelete={onDelete}
          onProgressSave={onProgressSave}
          onProgressEvent={onProgressEvent}
          onRatingChange={onRatingChange}
        />
      )}
      {!selectedItem && (
        <div className="flex hidden items-center justify-center rounded-sm border border-dashed border-border bg-surface/30 xl:flex">
          <div className="flex flex-col items-center gap-2 px-6 text-center">
            <BookMarked size={24} className="text-foreground" />
            <p className="text-sm text-foreground-subtle">Selecione um livro</p>
            <p className="text-xs text-foreground-subtle">Clique em um livro para ver detalhes, avaliar e acompanhar o progresso.</p>
          </div>
        </div>
      )}
      <PageSettingsDialog item={pageDialogItem} onClose={() => setPageDialogItem(null)} onSave={onProgressSave} onProgressEvent={onProgressEvent} />
    </div>
  );
}
