import {
  ArrowDownAZ,
  BookOpen,
  Check,
  ChevronRight,
  FilePlus2,
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
import { useMemo, useRef, useState } from "react";
import {
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

function BookCover({ book }: { book: MobileBook }) {
  return book.thumbnailUrl ? (
    <img className="h-full w-full object-cover" src={book.thumbnailUrl} alt="" />
  ) : (
    <div className="grid h-full w-full place-items-center bg-emerald-950 text-xs font-bold uppercase text-emerald-400">
      {book.fileType}
    </div>
  );
}

function FolderRow({
  folder,
  folders,
  selected,
  onSelect,
  onRename,
  onDelete,
}: {
  folder: MobileLibraryFolder;
  folders: MobileLibraryFolder[];
  selected: boolean;
  onSelect: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const depth = folderPath(folder.id, folders).split(" / ").length - 1;
  return (
    <div className={`flex items-center rounded-xl ${selected ? "bg-emerald-500/15 text-emerald-300" : "text-zinc-300"}`} style={{ paddingLeft: depth * 12 }}>
      <button className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5 text-left text-sm" onClick={onSelect} type="button">
        <FolderOpen size={16} />
        <span className="truncate">{folder.name}</span>
      </button>
      <button className="grid h-9 w-9 place-items-center" onClick={onRename} aria-label={`Renomear ${folder.name}`} type="button"><Pencil size={14} /></button>
      <button className="grid h-9 w-9 place-items-center text-zinc-500" onClick={onDelete} aria-label={`Excluir ${folder.name}`} type="button"><Trash2 size={14} /></button>
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
  const books = useMemo(() => queryMobileBooks(state.books, state.folders, state.sourceFolders, query), [query, state.books, state.folders, state.sourceFolders]);
  const editingBook = state.books.find((book) => book.id === editingBookId);
  const currentFolder = query.folderId ? state.folders.find((folder) => folder.id === query.folderId) : undefined;
  const currentSource = query.sourceFolderId ? state.sourceFolders.find((folder) => folder.id === query.sourceFolderId) : undefined;

  const setQuery = (patch: Partial<MobileLibraryQuery>) => onQueryChange({ ...query, ...patch });
  const toggleSelected = (bookId: string) => setSelectedIds((current) => {
    const next = new Set(current);
    if (next.has(bookId)) next.delete(bookId); else next.add(bookId);
    return next;
  });

  const askFolderName = (folder?: MobileLibraryFolder) => {
    const name = window.prompt(folder ? "Novo nome da pasta" : "Nome da nova pasta", folder?.name || "");
    if (!name?.trim()) return;
    if (folder) onRenameFolder(folder.id, name); else onCreateFolder(name, query.folderId);
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

      {(currentFolder || currentSource) && (
        <button className="mt-2 flex w-full items-center gap-2 rounded-xl bg-zinc-900 px-3 py-2 text-left text-xs text-zinc-300" onClick={() => setQuery({ folderId: undefined, sourceFolderId: undefined })} type="button">
          <X size={14} /> {currentFolder ? folderPath(currentFolder.id, state.folders) : `Fonte: ${currentSource?.name}`}
        </button>
      )}

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
          <button className={`grid h-9 w-9 place-items-center rounded-lg ${bulkMode ? "bg-emerald-500/20 text-emerald-300" : "bg-zinc-900"}`} onClick={() => { setBulkMode((value) => !value); setSelectedIds(new Set()); }} aria-label="Selecao em lote" type="button"><Check size={16} /></button>
          <button className={`grid h-9 w-9 place-items-center rounded-lg ${view === "grid" ? "bg-zinc-700 text-white" : "bg-zinc-900"}`} onClick={() => onViewChange("grid")} aria-label="Grade" type="button"><Grid2X2 size={16} /></button>
          <button className={`grid h-9 w-9 place-items-center rounded-lg ${view === "list" ? "bg-zinc-700 text-white" : "bg-zinc-900"}`} onClick={() => onViewChange("list")} aria-label="Lista" type="button"><List size={17} /></button>
        </div>
      </div>

      {books.length === 0 ? (
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
        <div className="mt-5 grid grid-cols-2 gap-2"><button className="flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-semibold" onClick={() => askFolderName()} type="button"><Plus size={16} />Nova pasta</button><button className="flex h-11 items-center justify-center gap-2 rounded-xl bg-zinc-800 text-sm font-semibold" onClick={() => onImportSourceFolder()} type="button"><FolderInput size={16} />Pasta-fonte</button></div>
        <button className={`mt-4 flex h-11 w-full items-center gap-2 rounded-xl px-3 text-sm ${!query.folderId && !query.sourceFolderId ? "bg-emerald-500/15 text-emerald-300" : "bg-zinc-900"}`} onClick={() => { setQuery({ folderId: undefined, sourceFolderId: undefined }); setDrawerOpen(false); }} type="button"><BookOpen size={16} />Todos os livros</button>
        <div className="mt-5"><p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Pastas gerenciadas</p>{state.folders.length ? <div className="space-y-1">{state.folders.map((folder) => <FolderRow key={folder.id} folder={folder} folders={state.folders} selected={query.folderId === folder.id} onSelect={() => { setQuery({ folderId: folder.id, sourceFolderId: undefined }); setDrawerOpen(false); }} onRename={() => askFolderName(folder)} onDelete={() => onDeleteFolder(folder.id)} />)}</div> : <p className="rounded-xl bg-zinc-900 p-3 text-sm text-zinc-500">Nenhuma pasta criada.</p>}</div>
        <div className="mt-5"><p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Pastas-fonte</p>{state.sourceFolders.length ? <div className="space-y-2">{state.sourceFolders.map((source) => <div key={source.id} className={`rounded-xl border p-3 ${query.sourceFolderId === source.id ? "border-emerald-500 bg-emerald-500/10" : "border-zinc-800 bg-zinc-900"}`}><button className="flex w-full items-center justify-between text-left" onClick={() => { setQuery({ sourceFolderId: source.id, folderId: undefined, scope: "source" }); setDrawerOpen(false); }} type="button"><span><span className="block text-sm font-medium">{source.name}</span><span className="mt-1 block text-xs text-zinc-500">{source.lastFileCount} arquivo(s) · {new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(source.lastImportedAt))}</span></span><ChevronRight size={17} /></button><div className="mt-2 grid grid-cols-[1fr_auto] gap-2"><button className="flex h-9 items-center justify-center gap-2 rounded-lg bg-zinc-800 text-xs font-semibold" onClick={() => onImportSourceFolder(source.id)} type="button"><RefreshCw size={14} />Reimportar pasta</button><button className="grid h-9 w-9 place-items-center rounded-lg bg-red-950/40 text-red-300" onClick={() => onDeleteSourceFolder(source.id)} aria-label={`Desconectar ${source.name}`} type="button"><Trash2 size={14} /></button></div></div>)}</div> : <p className="rounded-xl bg-zinc-900 p-3 text-sm leading-5 text-zinc-500">Selecione uma pasta para copiar seus livros e preservar a hierarquia no Lyceum.</p>}</div>
      </aside></div>}

      {bulkMode && selectedIds.size > 0 && <div className="fixed inset-x-3 bottom-[calc(78px+env(safe-area-inset-bottom))] z-30 rounded-2xl border border-zinc-700 bg-zinc-900 p-3 shadow-2xl"><div className="flex items-center gap-2"><span className="text-sm font-semibold">{selectedIds.size} selecionado(s)</span><select className="ml-auto h-9 min-w-0 rounded-lg bg-zinc-800 px-2 text-xs" value={bulkFolderId} onChange={(event) => setBulkFolderId(event.target.value)}><option value="">Biblioteca</option>{state.folders.map((folder) => <option key={folder.id} value={folder.id}>{folderPath(folder.id, state.folders)}</option>)}</select><button className="grid h-9 w-9 place-items-center rounded-lg bg-zinc-800 text-emerald-300" onClick={() => selectedIds.forEach((id) => onUpdateBook(id, { isFavorite: true }))} aria-label="Favoritar selecionados" type="button"><Heart size={16} /></button><button className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-600" onClick={async () => { await onMoveBooks([...selectedIds], bulkFolderId || undefined); setSelectedIds(new Set()); }} aria-label="Mover selecionados" type="button"><FolderOpen size={16} /></button><button className="grid h-9 w-9 place-items-center rounded-lg bg-red-950 text-red-300" onClick={async () => { await onDeleteBooks([...selectedIds]); setSelectedIds(new Set()); }} aria-label="Excluir selecionados" type="button"><Trash2 size={16} /></button></div></div>}

      {editingBook && <BookEditor book={editingBook} folders={state.folders} categories={state.categories} onClose={() => setEditingBookId(undefined)} onSave={(patch) => { onUpdateBook(editingBook.id, patch); setEditingBookId(undefined); }} onMove={(folderId) => onMoveBooks([editingBook.id], folderId)} onDelete={async () => { if (!window.confirm(`Remover ${editingBook.title} e o arquivo salvo pelo Lyceum?`)) return; await onDeleteBooks([editingBook.id]); setEditingBookId(undefined); }} />}
    </section>
  );
}
