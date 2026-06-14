import {
  ArrowDownAZ,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  FilePlus2,
  Folder,
  FolderInput,
  FolderOpen,
  Grid2X2,
  Heart,
  List,
  Menu,
  MoreVertical,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  descendantFolderIds,
  folderPath,
  formatFileSize,
  getBookProgress,
  queryMobileBooks,
  type MobileLibraryQuery,
} from "./libraryModel";
import type { MobileBook, MobileLibraryFolder, MobileLibraryState, MobileSourceFolder } from "./types";

interface MobileLibraryScreenProps {
  state: MobileLibraryState;
  query: MobileLibraryQuery;
  view: "grid" | "list";
  onQueryChange: (query: MobileLibraryQuery) => void;
  onViewChange: (view: "grid" | "list") => void;
  onOpenBook: (bookId: string) => void;
  onImportFiles: () => void;
  onImportSourceFolder: (sourceFolderId?: string) => void;
  onCreateFolder: (name: string, parentId?: string) => void;
  onRenameFolder: (folderId: string, name: string) => void;
  onMoveFolder: (folderId: string, parentId?: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onDeleteSourceFolder: (sourceFolderId: string) => void;
  onUpdateBook: (bookId: string, patch: Partial<MobileBook>) => void;
  onMoveBooks: (bookIds: string[], folderId?: string) => Promise<void>;
  onDeleteBooks: (bookIds: string[]) => Promise<void>;
}

const sortLabels: Record<MobileLibraryQuery["sort"], string> = {
  title_asc: "Titulo A-Z",
  title_desc: "Titulo Z-A",
  recent_desc: "Abertos recentemente",
  imported_desc: "Importados recentemente",
  progress_desc: "Maior progresso",
  size_desc: "Maior arquivo",
};

function getFolderTrail(folderId: string | undefined, folders: MobileLibraryFolder[]) {
  if (!folderId) return [];
  const trail: MobileLibraryFolder[] = [];
  const visited = new Set<string>();
  let current = folders.find((folder) => folder.id === folderId);
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    trail.unshift(current);
    current = current.parentId ? folders.find((folder) => folder.id === current?.parentId) : undefined;
  }
  return trail;
}

function BookCover({ book }: { book: MobileBook }) {
  return book.thumbnailUrl ? (
    <img className="h-full w-full object-cover" src={book.thumbnailUrl} alt="" />
  ) : (
    <div className="grid h-full w-full place-items-center bg-emerald-950 text-xs font-bold uppercase text-emerald-400">
      {book.fileType}
    </div>
  );
}

function FolderTreeNode({
  folder,
  folders,
  books,
  selectedFolderId,
  expanded,
  onToggle,
  onSelect,
  onAction,
}: {
  folder: MobileLibraryFolder;
  folders: MobileLibraryFolder[];
  books: MobileBook[];
  selectedFolderId?: string;
  expanded: Set<string>;
  onToggle: (folderId: string) => void;
  onSelect: (folder: MobileLibraryFolder) => void;
  onAction: (folder: MobileLibraryFolder) => void;
}) {
  const depth = folderPath(folder.id, folders).split(" / ").length - 1;
  const children = folders.filter((item) => item.parentId === folder.id).sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
  const count = books.filter((book) => book.folderId && descendantFolderIds(folder.id, folders).has(book.folderId)).length;
  const isExpanded = expanded.has(folder.id);
  const selected = selectedFolderId === folder.id;
  return (
    <div>
      <div className={`flex items-center rounded-xl ${selected ? "bg-emerald-500/15 text-emerald-300" : "text-zinc-300"}`} style={{ marginLeft: depth * 12 }}>
        <button className="grid h-10 w-8 shrink-0 place-items-center text-zinc-500 disabled:pointer-events-none" disabled={!children.length} onClick={() => onToggle(folder.id)} aria-label={children.length ? isExpanded ? `Recolher ${folder.name}` : `Expandir ${folder.name}` : undefined} type="button">
          {children.length ? isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} /> : <span className="h-1 w-1 rounded-full bg-zinc-700" />}
        </button>
        <button className="flex min-w-0 flex-1 items-center gap-2 py-2.5 text-left text-sm" onClick={() => onSelect(folder)} type="button">
          {selected ? <FolderOpen size={17} /> : <Folder size={17} />}
          <span className="min-w-0 flex-1 truncate">{folder.name}</span>
          <span className="text-[11px] tabular-nums text-zinc-600">{count}</span>
        </button>
        <button className="grid h-10 w-9 shrink-0 place-items-center text-zinc-500" onClick={() => onAction(folder)} aria-label={`Acoes de ${folder.name}`} type="button"><MoreVertical size={15} /></button>
      </div>
      {children.length > 0 && isExpanded && (
        <div>{children.map((child) => <FolderTreeNode key={child.id} folder={child} folders={folders} books={books} selectedFolderId={selectedFolderId} expanded={expanded} onToggle={onToggle} onSelect={onSelect} onAction={onAction} />)}</div>
      )}
    </div>
  );
}

function BookEditor({
  book,
  folders,
  categories,
  onClose,
  onSave,
  onMove,
  onDelete,
}: {
  book: MobileBook;
  folders: MobileLibraryFolder[];
  categories: string[];
  onClose: () => void;
  onSave: (patch: Partial<MobileBook>) => void;
  onMove: (folderId?: string) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [draft, setDraft] = useState(book);
  const [moving, setMoving] = useState(false);
  const update = (patch: Partial<MobileBook>) => setDraft((current) => ({ ...current, ...patch }));

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/70 backdrop-blur-sm">
      <div className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-zinc-800 bg-zinc-950 p-5 pb-[max(24px,env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between">
          <div><p className="text-xs uppercase tracking-wider text-emerald-400">Detalhes do livro</p><h2 className="mt-1 text-lg font-semibold">{book.title}</h2></div>
          <button className="grid h-10 w-10 place-items-center rounded-full bg-zinc-900" onClick={onClose} aria-label="Fechar detalhes" type="button"><X size={18} /></button>
        </div>

        <div className="mt-5 grid gap-3">
          <input className="h-11 rounded-xl border border-zinc-800 bg-zinc-900 px-3" value={draft.title} onChange={(event) => update({ title: event.target.value })} placeholder="Titulo" />
          <input className="h-11 rounded-xl border border-zinc-800 bg-zinc-900 px-3" value={draft.author || ""} onChange={(event) => update({ author: event.target.value })} placeholder="Autor" />
          <div className="grid grid-cols-2 gap-3">
            <input className="h-11 rounded-xl border border-zinc-800 bg-zinc-900 px-3" value={draft.publisher || ""} onChange={(event) => update({ publisher: event.target.value })} placeholder="Editora" />
            <input className="h-11 rounded-xl border border-zinc-800 bg-zinc-900 px-3" value={draft.publishDate || ""} onChange={(event) => update({ publishDate: event.target.value })} placeholder="Data" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input className="h-11 rounded-xl border border-zinc-800 bg-zinc-900 px-3" value={draft.isbn || ""} onChange={(event) => update({ isbn: event.target.value })} placeholder="ISBN" />
            <div>
              <input list="mobile-book-categories" className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3" value={draft.category} onChange={(event) => update({ category: event.target.value })} placeholder="Categoria" />
              <datalist id="mobile-book-categories">{Array.from(new Set([...categories, draft.category])).map((category) => <option key={category} value={category} />)}</datalist>
            </div>
          </div>
          <label className="rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-sm text-zinc-400">
            Avaliacao: <span className="text-zinc-100">{draft.rating || 0}/5</span>
            <input className="mt-2 w-full accent-emerald-500" type="range" min="0" max="5" step="1" value={draft.rating || 0} onChange={(event) => update({ rating: Number(event.target.value) })} />
          </label>
          <textarea className="min-h-24 rounded-xl border border-zinc-800 bg-zinc-900 p-3" value={draft.description || ""} onChange={(event) => update({ description: event.target.value })} placeholder="Descricao" />
          <textarea className="min-h-28 rounded-xl border border-zinc-800 bg-zinc-900 p-3" value={draft.notes || ""} onChange={(event) => update({ notes: event.target.value })} placeholder="Notas" />

          <button className={`flex h-11 items-center justify-center gap-2 rounded-xl border ${draft.isFavorite ? "border-emerald-500 bg-emerald-500/15 text-emerald-300" : "border-zinc-800 bg-zinc-900"}`} onClick={() => update({ isFavorite: !draft.isFavorite })} type="button">
            <Heart className={draft.isFavorite ? "fill-current" : ""} size={17} /> {draft.isFavorite ? "Favorito" : "Adicionar aos favoritos"}
          </button>

          <label className="text-sm text-zinc-400">Pasta gerenciada</label>
          <select className="h-11 rounded-xl border border-zinc-800 bg-zinc-900 px-3" value={draft.folderId || ""} onChange={(event) => update({ folderId: event.target.value || undefined })}>
            <option value="">Biblioteca</option>
            {folders.map((folder) => <option key={folder.id} value={folder.id}>{folderPath(folder.id, folders)}</option>)}
          </select>

          <button className="h-12 rounded-xl bg-emerald-600 font-semibold text-white" onClick={async () => {
            if (draft.folderId !== book.folderId) {
              setMoving(true);
              await onMove(draft.folderId);
              setMoving(false);
            }
            onSave({
              title: draft.title,
              author: draft.author,
              description: draft.description,
              isbn: draft.isbn,
              publisher: draft.publisher,
              publishDate: draft.publishDate,
              category: draft.category,
              notes: draft.notes,
              rating: draft.rating,
              isFavorite: draft.isFavorite,
              updatedAt: new Date().toISOString(),
            });
          }} disabled={moving} type="button">{moving ? "Movendo..." : "Salvar alteracoes"}</button>
          <button className="h-11 rounded-xl border border-red-900/70 bg-red-950/30 font-medium text-red-300" onClick={onDelete} type="button">Remover livro e arquivo gerenciado</button>
        </div>
      </div>
    </div>
  );
}

export default function MobileLibraryScreen({
  state,
  query,
  view,
  onQueryChange,
  onViewChange,
  onOpenBook,
  onImportFiles,
  onImportSourceFolder,
  onCreateFolder,
  onRenameFolder,
  onMoveFolder,
  onDeleteFolder,
  onDeleteSourceFolder,
  onUpdateBook,
  onMoveBooks,
  onDeleteBooks,
}: MobileLibraryScreenProps) {
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingBookId, setEditingBookId] = useState<string>();
  const [bulkFolderId, setBulkFolderId] = useState("");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [folderActionId, setFolderActionId] = useState<string>();
  const [folderDialog, setFolderDialog] = useState<{ mode: "create" | "rename"; folderId?: string; parentId?: string }>();
  const [folderName, setFolderName] = useState("");
  const queriedBooks = useMemo(() => queryMobileBooks(state.books, state.folders, state.sourceFolders, query), [query, state.books, state.folders, state.sourceFolders]);
  const books = useMemo(() => query.folderId && !query.search.trim()
    ? queriedBooks.filter((book) => book.folderId === query.folderId)
    : queriedBooks, [queriedBooks, query.folderId, query.search]);
  const editingBook = state.books.find((book) => book.id === editingBookId);
  const currentFolder = query.folderId ? state.folders.find((folder) => folder.id === query.folderId) : undefined;
  const currentSource = query.sourceFolderId ? state.sourceFolders.find((folder) => folder.id === query.sourceFolderId) : undefined;
  const folderAction = state.folders.find((folder) => folder.id === folderActionId);
  const childFolders = useMemo(() => state.folders
    .filter((folder) => folder.parentId === query.folderId)
    .sort((left, right) => left.name.localeCompare(right.name, "pt-BR")), [query.folderId, state.folders]);
  const visibleChildFolders = !query.sourceFolderId && !query.search.trim() ? childFolders : [];
  const rootFolders = useMemo(() => state.folders.filter((folder) => !folder.parentId).sort((left, right) => left.name.localeCompare(right.name, "pt-BR")), [state.folders]);
  const folderTrail = useMemo(() => getFolderTrail(query.folderId, state.folders), [query.folderId, state.folders]);

  const setQuery = (patch: Partial<MobileLibraryQuery>) => onQueryChange({ ...query, ...patch });
  const toggleSelected = (bookId: string) => setSelectedIds((current) => {
    const next = new Set(current);
    if (next.has(bookId)) next.delete(bookId); else next.add(bookId);
    return next;
  });

  useEffect(() => {
    if (!query.folderId) return;
    setExpandedFolders((current) => new Set([...current, ...getFolderTrail(query.folderId, state.folders).map((folder) => folder.id)]));
  }, [query.folderId, state.folders]);

  const openFolder = (folder: MobileLibraryFolder) => {
    setExpandedFolders((current) => new Set([...current, folder.id]));
    setQuery({ folderId: folder.id, sourceFolderId: undefined, scope: "all" });
    setDrawerOpen(false);
  };

  const openFolderDialog = (mode: "create" | "rename", folder?: MobileLibraryFolder, parentId?: string) => {
    setFolderName(mode === "rename" ? folder?.name || "" : "");
    setFolderDialog({ mode, folderId: folder?.id, parentId });
    setFolderActionId(undefined);
  };

  const submitFolderDialog = () => {
    const name = folderName.trim();
    if (!name || !folderDialog) return;
    if (folderDialog.mode === "rename" && folderDialog.folderId) onRenameFolder(folderDialog.folderId, name);
    else onCreateFolder(name, folderDialog.parentId);
    setFolderDialog(undefined);
    setFolderName("");
  };

  return (
    <section className="min-h-screen bg-[#050607] px-4 pb-[calc(90px+env(safe-area-inset-bottom))] pt-[max(10px,env(safe-area-inset-top))] text-zinc-100">
      <header className="flex h-12 items-center justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <button className="grid h-10 w-10 place-items-center rounded-full" onClick={() => setDrawerOpen(true)} aria-label="Menu da biblioteca" type="button"><Menu size={23} /></button>
          <div className="min-w-0"><h1 className="truncate text-xl font-extrabold">Biblioteca</h1><p className="text-xs text-zinc-500">{state.books.length} {state.books.length === 1 ? "volume" : "volumes"}</p></div>
        </div>
        <div className="flex gap-1">
          <button className="grid h-10 w-10 place-items-center rounded-full" onClick={() => searchRef.current?.focus()} aria-label="Buscar" type="button"><Search size={20} /></button>
          <button className="grid h-10 w-10 place-items-center rounded-full" onClick={() => setSortOpen((value) => !value)} aria-label="Ordenar e filtrar" type="button"><SlidersHorizontal size={20} /></button>
        </div>
      </header>

      <nav className="mt-2 flex min-h-10 items-center gap-1 overflow-x-auto rounded-xl bg-zinc-900/80 px-2 py-1 text-xs" aria-label="Caminho da pasta">
        <button className={`shrink-0 rounded-lg px-2.5 py-2 ${!currentFolder && !currentSource ? "bg-emerald-500/15 text-emerald-300" : "text-zinc-400"}`} onClick={() => setQuery({ folderId: undefined, sourceFolderId: undefined })} type="button">Biblioteca</button>
        {folderTrail.map((folder) => <span className="flex shrink-0 items-center" key={folder.id}><ChevronRight size={13} className="text-zinc-700" /><button className={`rounded-lg px-2.5 py-2 ${folder.id === query.folderId ? "bg-emerald-500/15 text-emerald-300" : "text-zinc-400"}`} onClick={() => openFolder(folder)} type="button">{folder.name}</button></span>)}
        {currentSource && <span className="flex shrink-0 items-center"><ChevronRight size={13} className="text-zinc-700" /><span className="rounded-lg bg-emerald-500/15 px-2.5 py-2 text-emerald-300">Fonte: {currentSource.name}</span></span>}
      </nav>

      <div className="relative mt-3">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
        <input ref={searchRef} className="h-11 w-full rounded-2xl border border-white/5 bg-[#17181c] pl-11 pr-4 text-sm outline-none focus:border-emerald-500/50" placeholder="Livros, autores, notas, pastas..." value={query.search} onChange={(event) => setQuery({ search: event.target.value })} />
      </div>

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {(["all", "managed", "source"] as const).map((scope) => <button key={scope} className={`h-8 shrink-0 rounded-full px-4 text-xs font-semibold ${query.scope === scope ? "bg-emerald-600 text-white" : "bg-zinc-900 text-zinc-400"}`} onClick={() => setQuery({ scope })} type="button">{scope === "all" ? "Todos" : scope === "managed" ? "Gerenciados" : "Fontes"}</button>)}
        {(["pdf", "epub", "txt"] as const).map((fileType) => <button key={fileType} className={`h-8 shrink-0 rounded-full px-4 text-xs font-semibold uppercase ${query.fileType === fileType ? "bg-zinc-100 text-zinc-950" : "bg-zinc-900 text-zinc-400"}`} onClick={() => setQuery({ fileType: query.fileType === fileType ? "all" : fileType })} type="button">{fileType}</button>)}
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
        <span>{books.length} resultado(s) · {sortLabels[query.sort]}</span>
        <div className="flex gap-1">
          <button className="grid h-9 w-9 place-items-center rounded-lg bg-zinc-900 text-emerald-400" onClick={() => openFolderDialog("create", undefined, query.folderId)} aria-label="Nova pasta" type="button"><Plus size={17} /></button>
          <button className={`grid h-9 w-9 place-items-center rounded-lg ${bulkMode ? "bg-emerald-500/20 text-emerald-300" : "bg-zinc-900"}`} onClick={() => { setBulkMode((value) => !value); setSelectedIds(new Set()); }} aria-label="Selecao em lote" type="button"><Check size={16} /></button>
          <button className={`grid h-9 w-9 place-items-center rounded-lg ${view === "grid" ? "bg-zinc-700 text-white" : "bg-zinc-900"}`} onClick={() => onViewChange("grid")} aria-label="Grade" type="button"><Grid2X2 size={16} /></button>
          <button className={`grid h-9 w-9 place-items-center rounded-lg ${view === "list" ? "bg-zinc-700 text-white" : "bg-zinc-900"}`} onClick={() => onViewChange("list")} aria-label="Lista" type="button"><List size={17} /></button>
        </div>
      </div>

      {visibleChildFolders.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Pastas</p>
            <button className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-emerald-400" onClick={() => openFolderDialog("create", undefined, query.folderId)} type="button"><Plus size={14} /> Nova</button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {visibleChildFolders.map((folder) => {
              const folderIds = descendantFolderIds(folder.id, state.folders);
              const count = state.books.filter((book) => book.folderId && folderIds.has(book.folderId)).length;
              return <article key={folder.id} className="relative rounded-2xl border border-white/5 bg-gradient-to-br from-zinc-800 to-zinc-900 p-3 shadow-lg shadow-black/10">
                <button className="flex w-full items-center gap-3 pr-8 text-left" onClick={() => openFolder(folder)} type="button">
                  <span className="grid h-11 w-12 shrink-0 place-items-center rounded-xl bg-emerald-500/12 text-emerald-400"><FolderOpen size={24} /></span>
                  <span className="min-w-0"><span className="block truncate text-sm font-semibold">{folder.name}</span><span className="mt-1 block text-[11px] text-zinc-500">{count} {count === 1 ? "livro" : "livros"}</span></span>
                </button>
                <button className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full text-zinc-500" onClick={() => setFolderActionId(folder.id)} aria-label={`Acoes de ${folder.name}`} type="button"><MoreVertical size={16} /></button>
              </article>;
            })}
          </div>
        </div>
      )}

      {books.length === 0 && visibleChildFolders.length === 0 ? (
        <div className="grid min-h-[360px] place-items-center text-center"><div><BookOpen className="mx-auto text-emerald-400" size={34} /><h2 className="mt-4 text-lg font-semibold">{state.books.length ? "Nenhum resultado" : "Sua biblioteca esta vazia"}</h2><p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-zinc-500">Importe PDF, EPUB ou TXT, ou conecte uma pasta-fonte preservando sua organizacao.</p><div className="mt-5 flex justify-center gap-2"><button className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold" onClick={onImportFiles} type="button">Importar livros</button><button className="rounded-xl bg-zinc-800 px-4 py-3 text-sm font-semibold" onClick={() => onImportSourceFolder()} type="button">Pasta-fonte</button></div></div></div>
      ) : view === "grid" ? (
        <div className="mt-4 grid grid-cols-2 gap-3">{books.map((book) => {
          const progress = getBookProgress(book);
          const selected = selectedIds.has(book.id);
          return <article key={book.id} className={`relative overflow-hidden rounded-2xl border bg-zinc-900 ${selected ? "border-emerald-500" : "border-white/5"}`}>
            {bulkMode && <button className={`absolute left-2 top-2 z-10 grid h-7 w-7 place-items-center rounded-full ${selected ? "bg-emerald-500 text-white" : "bg-black/70 text-zinc-300"}`} onClick={() => toggleSelected(book.id)} aria-label={`Selecionar ${book.title}`} type="button">{selected && <Check size={15} />}</button>}
            <button className="absolute right-2 top-2 z-10 grid h-8 w-8 place-items-center rounded-full bg-black/70" onClick={() => setEditingBookId(book.id)} aria-label={`Detalhes de ${book.title}`} type="button"><MoreVertical size={16} /></button>
            <button className="w-full text-left" onClick={() => bulkMode ? toggleSelected(book.id) : onOpenBook(book.id)} type="button"><div className="aspect-[3/4] bg-zinc-800"><BookCover book={book} /></div><div className="p-3"><p className="truncate text-sm font-semibold">{book.title}</p><p className="mt-1 truncate text-xs text-zinc-500">{book.author || folderPath(book.folderId, state.folders)}</p><div className="mt-3 h-1 rounded bg-zinc-800"><div className="h-full rounded bg-emerald-500" style={{ width: `${progress}%` }} /></div><p className="mt-1 text-[10px] text-zinc-500">{progress}% · {formatFileSize(book.fileSize)}</p></div></button>
          </article>;
        })}</div>
      ) : (
        <div className="mt-4 space-y-2">{books.map((book) => {
          const selected = selectedIds.has(book.id);
          return <article key={book.id} className={`flex items-center gap-3 rounded-2xl border bg-zinc-900 p-2 ${selected ? "border-emerald-500" : "border-white/5"}`}><button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => bulkMode ? toggleSelected(book.id) : onOpenBook(book.id)} type="button"><div className="h-16 w-12 shrink-0 overflow-hidden rounded-lg"><BookCover book={book} /></div><div className="min-w-0"><p className="truncate text-sm font-semibold">{book.title}</p><p className="mt-1 truncate text-xs text-zinc-500">{book.author || book.fileName}</p><p className="mt-1 text-[11px] text-zinc-600">{folderPath(book.folderId, state.folders)} · {getBookProgress(book)}%</p></div></button>{bulkMode ? <button className={`grid h-9 w-9 place-items-center rounded-full ${selected ? "bg-emerald-500" : "bg-zinc-800"}`} onClick={() => toggleSelected(book.id)} type="button">{selected && <Check size={15} />}</button> : <button className="grid h-10 w-10 place-items-center" onClick={() => setEditingBookId(book.id)} aria-label={`Detalhes de ${book.title}`} type="button"><ChevronRight size={18} /></button>}</article>;
        })}</div>
      )}

      <button className="fixed bottom-[calc(82px+env(safe-area-inset-bottom))] right-5 z-20 grid h-14 w-14 place-items-center rounded-full bg-emerald-600 text-white shadow-xl shadow-black/40" onClick={onImportFiles} aria-label="Importar livros" type="button"><FilePlus2 size={24} /></button>

      {sortOpen && <div className="fixed inset-0 z-40 flex items-end bg-black/60" onClick={() => setSortOpen(false)}><div className="w-full rounded-t-3xl bg-zinc-950 p-5 pb-[max(24px,env(safe-area-inset-bottom))]" onClick={(event) => event.stopPropagation()}><div className="flex items-center justify-between"><h2 className="font-semibold">Ordenar e exibir</h2><button onClick={() => setSortOpen(false)} type="button"><X /></button></div><div className="mt-4 grid gap-2">{Object.entries(sortLabels).map(([value, label]) => <button key={value} className={`flex h-11 items-center justify-between rounded-xl px-3 text-sm ${query.sort === value ? "bg-emerald-500/15 text-emerald-300" : "bg-zinc-900"}`} onClick={() => { setQuery({ sort: value as MobileLibraryQuery["sort"] }); setSortOpen(false); }} type="button"><span className="flex items-center gap-2"><ArrowDownAZ size={16} />{label}</span>{query.sort === value && <Check size={16} />}</button>)}</div></div></div>}

      {drawerOpen && <div className="fixed inset-0 z-50 bg-black/70" onClick={() => setDrawerOpen(false)}><aside className="h-full w-[88%] max-w-sm overflow-y-auto border-r border-zinc-800 bg-zinc-950 p-4 pt-[max(18px,env(safe-area-inset-top))]" onClick={(event) => event.stopPropagation()}><div className="flex items-center justify-between"><div><p className="text-xs uppercase tracking-wider text-emerald-400">Organizacao</p><h2 className="text-xl font-bold">Pastas e fontes</h2></div><button className="grid h-10 w-10 place-items-center rounded-full bg-zinc-900" onClick={() => setDrawerOpen(false)} type="button"><X size={18} /></button></div>
        <div className="mt-5 grid grid-cols-2 gap-2"><button className="flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-semibold" onClick={() => openFolderDialog("create", undefined, query.folderId)} type="button"><Plus size={16} />Nova pasta</button><button className="flex h-11 items-center justify-center gap-2 rounded-xl bg-zinc-800 text-sm font-semibold" onClick={() => onImportSourceFolder()} type="button"><FolderInput size={16} />Pasta-fonte</button></div>
        <button className={`mt-4 flex h-11 w-full items-center gap-2 rounded-xl px-3 text-sm ${!query.folderId && !query.sourceFolderId ? "bg-emerald-500/15 text-emerald-300" : "bg-zinc-900"}`} onClick={() => { setQuery({ folderId: undefined, sourceFolderId: undefined }); setDrawerOpen(false); }} type="button"><BookOpen size={16} />Todos os livros</button>
        <div className="mt-5"><p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Pastas gerenciadas</p>{rootFolders.length ? <div className="space-y-1">{rootFolders.map((folder) => <FolderTreeNode key={folder.id} folder={folder} folders={state.folders} books={state.books} selectedFolderId={query.folderId} expanded={expandedFolders} onToggle={(folderId) => setExpandedFolders((current) => { const next = new Set(current); if (next.has(folderId)) next.delete(folderId); else next.add(folderId); return next; })} onSelect={openFolder} onAction={(item) => setFolderActionId(item.id)} />)}</div> : <p className="rounded-xl bg-zinc-900 p-3 text-sm text-zinc-500">Nenhuma pasta criada.</p>}</div>
        <div className="mt-5"><p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Pastas-fonte</p>{state.sourceFolders.length ? <div className="space-y-2">{state.sourceFolders.map((source) => <div key={source.id} className={`rounded-xl border p-3 ${query.sourceFolderId === source.id ? "border-emerald-500 bg-emerald-500/10" : "border-zinc-800 bg-zinc-900"}`}><button className="flex w-full items-center justify-between text-left" onClick={() => { setQuery({ sourceFolderId: source.id, folderId: undefined, scope: "source" }); setDrawerOpen(false); }} type="button"><span><span className="block text-sm font-medium">{source.name}</span><span className="mt-1 block text-xs text-zinc-500">{source.lastFileCount} arquivo(s) · {new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(source.lastImportedAt))}</span></span><ChevronRight size={17} /></button><div className="mt-2 grid grid-cols-[1fr_auto] gap-2"><button className="flex h-9 items-center justify-center gap-2 rounded-lg bg-zinc-800 text-xs font-semibold" onClick={() => onImportSourceFolder(source.id)} type="button"><RefreshCw size={14} />Reimportar pasta</button><button className="grid h-9 w-9 place-items-center rounded-lg bg-red-950/40 text-red-300" onClick={() => onDeleteSourceFolder(source.id)} aria-label={`Desconectar ${source.name}`} type="button"><Trash2 size={14} /></button></div></div>)}</div> : <p className="rounded-xl bg-zinc-900 p-3 text-sm leading-5 text-zinc-500">Selecione uma pasta para copiar seus livros e preservar a hierarquia no Lyceum.</p>}</div>
      </aside></div>}

      {folderAction && <div className="fixed inset-0 z-[60] flex items-end bg-black/70 backdrop-blur-sm" onClick={() => setFolderActionId(undefined)}><div className="w-full rounded-t-3xl border border-zinc-800 bg-zinc-950 p-5 pb-[max(24px,env(safe-area-inset-bottom))]" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-400"><FolderOpen size={24} /></span><div className="min-w-0"><p className="truncate font-semibold">{folderAction.name}</p><p className="truncate text-xs text-zinc-500">{folderPath(folderAction.id, state.folders)}</p></div></div>
        <div className="mt-5 grid gap-2">
          <button className="flex h-12 items-center gap-3 rounded-xl bg-zinc-900 px-4 text-sm font-medium" onClick={() => { openFolder(folderAction); setFolderActionId(undefined); }} type="button"><FolderOpen size={18} className="text-emerald-400" />Abrir pasta</button>
          <button className="flex h-12 items-center gap-3 rounded-xl bg-zinc-900 px-4 text-sm font-medium" onClick={() => openFolderDialog("create", undefined, folderAction.id)} type="button"><Plus size={18} className="text-emerald-400" />Criar subpasta</button>
          <button className="flex h-12 items-center gap-3 rounded-xl bg-zinc-900 px-4 text-sm font-medium" onClick={() => openFolderDialog("rename", folderAction)} type="button"><Pencil size={18} />Renomear</button>
          <label className="rounded-xl bg-zinc-900 px-4 py-3 text-xs text-zinc-500">Mover para
            <select className="mt-2 h-11 w-full rounded-xl bg-zinc-800 px-3 text-sm text-zinc-100" value={folderAction.parentId || ""} onChange={(event) => { onMoveFolder(folderAction.id, event.target.value || undefined); setFolderActionId(undefined); }}>
              <option value="">Biblioteca</option>
              {state.folders.filter((folder) => folder.id !== folderAction.id && !descendantFolderIds(folderAction.id, state.folders).has(folder.id)).map((folder) => <option key={folder.id} value={folder.id}>{folderPath(folder.id, state.folders)}</option>)}
            </select>
          </label>
          <button className="flex h-12 items-center gap-3 rounded-xl bg-red-950/40 px-4 text-sm font-medium text-red-300" onClick={() => { if (window.confirm(`Excluir a pasta ${folderAction.name}?`)) onDeleteFolder(folderAction.id); setFolderActionId(undefined); }} type="button"><Trash2 size={18} />Excluir pasta</button>
        </div>
      </div></div>}

      {folderDialog && <div className="fixed inset-0 z-[70] flex items-end bg-black/70 backdrop-blur-sm" onClick={() => setFolderDialog(undefined)}><form className="w-full rounded-t-3xl border border-zinc-800 bg-zinc-950 p-5 pb-[max(24px,env(safe-area-inset-bottom))]" onClick={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); submitFolderDialog(); }}>
        <div className="flex items-center justify-between"><div><p className="text-xs uppercase tracking-wider text-emerald-400">Organizacao</p><h2 className="mt-1 text-lg font-semibold">{folderDialog.mode === "rename" ? "Renomear pasta" : "Nova pasta"}</h2></div><button className="grid h-10 w-10 place-items-center rounded-full bg-zinc-900" onClick={() => setFolderDialog(undefined)} type="button"><X size={18} /></button></div>
        <input autoFocus className="mt-5 h-12 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 text-base outline-none focus:border-emerald-500" value={folderName} onChange={(event) => setFolderName(event.target.value)} placeholder="Nome da pasta" />
        <p className="mt-2 text-xs text-zinc-500">Destino: {folderPath(folderDialog.parentId, state.folders)}</p>
        <button className="mt-5 h-12 w-full rounded-xl bg-emerald-600 font-semibold text-white disabled:opacity-40" disabled={!folderName.trim()} type="submit">{folderDialog.mode === "rename" ? "Salvar nome" : "Criar pasta"}</button>
      </form></div>}

      {bulkMode && selectedIds.size > 0 && <div className="fixed inset-x-3 bottom-[calc(78px+env(safe-area-inset-bottom))] z-30 rounded-2xl border border-zinc-700 bg-zinc-900 p-3 shadow-2xl"><div className="flex items-center gap-2"><span className="text-sm font-semibold">{selectedIds.size} selecionado(s)</span><select className="ml-auto h-9 min-w-0 rounded-lg bg-zinc-800 px-2 text-xs" value={bulkFolderId} onChange={(event) => setBulkFolderId(event.target.value)}><option value="">Biblioteca</option>{state.folders.map((folder) => <option key={folder.id} value={folder.id}>{folderPath(folder.id, state.folders)}</option>)}</select><button className="grid h-9 w-9 place-items-center rounded-lg bg-zinc-800 text-emerald-300" onClick={() => selectedIds.forEach((id) => onUpdateBook(id, { isFavorite: true }))} aria-label="Favoritar selecionados" type="button"><Heart size={16} /></button><button className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-600" onClick={async () => { await onMoveBooks([...selectedIds], bulkFolderId || undefined); setSelectedIds(new Set()); }} aria-label="Mover selecionados" type="button"><FolderOpen size={16} /></button><button className="grid h-9 w-9 place-items-center rounded-lg bg-red-950 text-red-300" onClick={async () => { await onDeleteBooks([...selectedIds]); setSelectedIds(new Set()); }} aria-label="Excluir selecionados" type="button"><Trash2 size={16} /></button></div></div>}

      {editingBook && <BookEditor book={editingBook} folders={state.folders} categories={state.categories} onClose={() => setEditingBookId(undefined)} onSave={(patch) => { onUpdateBook(editingBook.id, patch); setEditingBookId(undefined); }} onMove={(folderId) => onMoveBooks([editingBook.id], folderId)} onDelete={async () => { if (!window.confirm(`Remover ${editingBook.title} e o arquivo salvo pelo Lyceum?`)) return; await onDeleteBooks([editingBook.id]); setEditingBookId(undefined); }} />}
    </section>
  );
}
