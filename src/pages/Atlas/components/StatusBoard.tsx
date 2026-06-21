import {
  useEffect,
  useState,
  type DragEvent as ReactDragEvent,
} from "react";
import { AtomicCodeMirrorEditor } from "@atomic-editor/editor";
import "@atomic-editor/editor/styles.css";
import {
  BookMarked,
  BookOpen,
  Edit3,
  FileText,
  FolderOpen,
  GripVertical,
  MoreVertical,
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
import type {
  BookWithThumbnail,
  ReadingStatus,
  ReadingStatusItem,
} from "../../../types/LibraryTypes";
import type TableReading from "../../../types/TableReading";
import { READING_STATUS_OPTIONS } from "../../../lib/readingStatus";
import {
  getBookFolderLabel,
  getTitleWithoutExtension,
} from "../../Library/utils";
import {
  getExternalReadingPages,
  getManualCoverSrc,
  getStatusItemReadPages,
  getStatusItemTotalPages,
  formatLastReading,
  stripFrontmatter,
} from "../atlasUtils";
import {
  emptyMessage,
  STATUS_VISUAL,
  type StatusDropTarget,
} from "../atlasTypes";
import {
  NoteProperties,
  emptyNotePropertiesDraft,
  type NotePropertiesDraft,
} from "./NoteProperties";
import { LocalCover } from "./BookCover";

export interface StatusBoardProps {
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
  onSaveNote: (markdown: string, properties: NotePropertiesDraft) => void;
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
  onSave: (content: string, properties: NotePropertiesDraft) => void;
}) {
  const [draft, setDraft] = useState(() => stripFrontmatter(content));
  const [propDraft, setPropDraft] = useState<NotePropertiesDraft>(
    () => emptyNotePropertiesDraft(selectedItem),
  );

  useEffect(() => {
    setDraft(stripFrontmatter(content));
  }, [content, selectedItem?.id]);

  useEffect(() => {
    setPropDraft(emptyNotePropertiesDraft(selectedItem));
  }, [selectedItem?.id]);

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
      {selectedItem && (
        <NoteProperties item={selectedItem} draft={propDraft} onChange={setPropDraft} />
      )}
      <div className="min-h-0 flex-1 p-3">
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-zinc-500">Carregando nota...</div>
        ) : !selectedItem ? (
          <div className="flex h-full items-center justify-center rounded-sm border border-dashed border-zinc-800 bg-zinc-950 px-4 text-center text-sm text-zinc-500">
            Selecione um livro para escrever notas de leitura.
          </div>
        ) : (
          <div className="h-full rounded-sm border border-zinc-800 bg-zinc-950 text-zinc-200 focus-within:border-green-500">
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
        <button type="button" onClick={() => onSave(draft, propDraft)} disabled={!selectedItem || saving} className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-sm bg-green-500 px-3 font-medium text-zinc-950 hover:bg-green-400 disabled:cursor-not-allowed disabled:opacity-60">
          {saving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
          Salvar
        </button>
      </div>
    </aside>
  );
}

export default function StatusBoard({
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
}: StatusBoardProps) {
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
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_770px]">
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
      <AtomicEditor key={selectedItem?.id || "no-selection"} selectedItem={selectedItem} vaultPath={vaultPath} notePath={notePath} content={noteContent} loading={noteLoading} saving={noteSaving} onChooseVault={onChooseVault} onSave={onSaveNote} />
      <PageSettingsDialog item={pageDialogItem} onClose={() => setPageDialogItem(null)} onSave={onProgressSave} onProgressEvent={onProgressEvent} />
    </div>
  );
}
