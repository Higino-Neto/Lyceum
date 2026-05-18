import {
  BarChart3,
  BookOpen,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Clock3,
  Cloud,
  CloudOff,
  FilePlus2,
  Folder,
  Heart,
  LayoutGrid,
  Library,
  List,
  Menu,
  MoreVertical,
  Pause,
  Play,
  Plus,
  Search,
  Settings,
  SlidersHorizontal,
  Star,
  Square,
  Usb,
  UserCircle,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import EpubPane from "./EpubPane";
import PdfPane from "./PdfPane";
import { getStoredBookPatch, resolveMobileBookDataUrl, writeMobileBookFile } from "./bookFileStorage";
import {
  calculateStats,
  createBookFromFile,
  createHabit,
  createManualBook,
  createSession,
  formatShortDate,
  getTodayKey,
  loadMobileState,
  readFileAsDataUrl,
  saveMobileState,
} from "./storage";
import { getMobileSession, getMobileSupabase, hasSupabaseConfig } from "./supabaseMobile";
import { hydrateMobileBookThumbnails } from "./thumbnailStorage";
import type { MobileBook, MobileHabit, MobileLibraryState, MobileTab } from "./types";

const tabs: Array<{ id: MobileTab; label: string; icon: typeof Library }> = [
  { id: "library", label: "Biblioteca", icon: Library },
  { id: "reader", label: "Pastas", icon: Folder },
  { id: "dashboard", label: "Recentes", icon: Clock3 },
  { id: "habits", label: "Favoritos", icon: Star },
  { id: "profile", label: "Configuracoes", icon: Settings },
];

const categories = ["Geral", "Ficcao", "Tecnologia", "Filosofia", "Idiomas", "Academico"];

function updateBook(state: MobileLibraryState, bookId: string, patch: Partial<MobileBook>) {
  return {
    ...state,
    books: state.books.map((book) => (book.id === bookId ? { ...book, ...patch } : book)),
  };
}

function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="grid min-h-[280px] place-items-center px-6 text-center">
      <div>
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded bg-green-500/10 text-green-400">
          <BookOpen size={24} />
        </div>
        <h2 className="text-lg font-semibold text-zinc-100">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-400">{body}</p>
        {action && <div className="mt-5">{action}</div>}
      </div>
    </div>
  );
}

function StatTile({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-zinc-50">{value}</p>
      <p className="mt-1 text-xs text-zinc-500">{detail}</p>
    </div>
  );
}

type LibraryFilter = "all" | "pdf" | "epub";
type LibraryView = "grid" | "list";

function getProgress(book: MobileBook) {
  if (book.totalPages <= 1) return book.minutesRead > 0 ? 16 : 0;
  return Math.min(96, Math.max(4, Math.round((book.currentPage / book.totalPages) * 100)));
}

function getBookMeasure(book: MobileBook) {
  if (book.fileType === "epub" && book.totalPages <= 80) return `${book.totalPages} cap.`;
  return `${book.totalPages} pags.`;
}

function IconButton({
  label,
  children,
  className = "",
  onClick,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <button
      className={`grid h-11 w-11 place-items-center rounded border border-zinc-800 bg-zinc-950/60 text-zinc-300 ${className}`}
      onClick={onClick}
      type="button"
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}

function StatusPill({
  active,
  icon: Icon,
  label,
  count,
}: {
  active?: boolean;
  icon: typeof Library;
  label: string;
  count: number;
}) {
  return (
    <button
      className={`flex h-16 min-w-fit items-center gap-3 rounded border px-4 text-left ${
        active
          ? "border-green-500/40 bg-green-500 text-white shadow-lg shadow-green-900/30"
          : "border-zinc-800 bg-zinc-900/80 text-zinc-400"
      }`}
      type="button"
    >
      <Icon size={24} />
      <span className="text-base font-semibold">{label}</span>
      <span className={`ml-1 rounded px-2 py-1 text-sm font-bold ${active ? "bg-green-700/35" : "bg-zinc-950 text-zinc-300"}`}>
        {count}
      </span>
    </button>
  );
}

function FilterPill({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`h-14 rounded border px-7 text-base ${
        active
          ? "border-green-500 bg-green-500/10 font-semibold text-zinc-50"
          : "border-zinc-800 bg-zinc-950/40 text-zinc-400"
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function ContinueCard({ book, onSelect }: { book: MobileBook; onSelect: (bookId: string) => void }) {
  const progress = getProgress(book);

  return (
    <button
      className="grid h-[136px] w-[246px] shrink-0 grid-cols-[48px_1fr] gap-4 rounded border border-zinc-800 bg-zinc-900/70 p-4 text-left shadow-lg shadow-black/20"
      onClick={() => onSelect(book.id)}
      type="button"
    >
      <div className="grid h-14 w-12 place-items-center rounded border border-zinc-700 bg-zinc-950 text-[11px] uppercase text-zinc-400">
        {book.fileType}
      </div>
      <div className="min-w-0">
        <p className="truncate text-base font-semibold text-zinc-100">{book.title}</p>
        <p className="mt-1 truncate text-sm text-zinc-500">{book.category}</p>
      </div>
      <div className="col-span-2 grid grid-cols-[1fr_auto] items-center gap-3">
        <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
          <div className="h-full rounded-full bg-green-500" style={{ width: `${progress}%` }} />
        </div>
        <span className="text-sm text-zinc-400">{progress}%</span>
      </div>
    </button>
  );
}

function BookCover({ book, compact = false }: { book: MobileBook; compact?: boolean }) {
  return book.thumbnailUrl ? (
    <img
      src={book.thumbnailUrl}
      alt=""
      className={`w-full rounded-t object-cover ${compact ? "h-24" : "aspect-[2/3]"}`}
      loading="lazy"
    />
  ) : (
    <div className={`grid w-full place-items-center rounded-t bg-zinc-800 text-xs uppercase text-zinc-500 ${compact ? "h-24" : "aspect-[2/3]"}`}>
      {book.fileType}
    </div>
  );
}

function BookGridCard({ book, onSelect }: { book: MobileBook; onSelect: (bookId: string) => void }) {
  return (
    <button
      className="min-w-0 overflow-hidden rounded border border-zinc-800 bg-zinc-900/80 text-left shadow-lg shadow-black/20"
      onClick={() => onSelect(book.id)}
      type="button"
    >
      <BookCover book={book} />
      <div className="space-y-3 p-3">
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-zinc-100">{book.title}</p>
            <p className="mt-1 truncate text-sm text-zinc-500">{book.category}</p>
          </div>
          <MoreVertical className="mt-1 text-zinc-400" size={18} />
        </div>
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="truncate text-zinc-500">{getBookMeasure(book)}</span>
          <span className="rounded bg-zinc-800 px-2 py-1 font-medium uppercase text-zinc-100">{book.fileType}</span>
        </div>
      </div>
    </button>
  );
}

function BookListRow({ book, onSelect }: { book: MobileBook; onSelect: (bookId: string) => void }) {
  return (
    <button
      className="grid w-full grid-cols-[56px_1fr_auto] items-center gap-4 rounded border border-zinc-800 bg-zinc-900/80 p-3 text-left"
      onClick={() => onSelect(book.id)}
      type="button"
    >
      <BookCover book={book} compact />
      <div className="min-w-0">
        <p className="truncate text-base font-semibold text-zinc-100">{book.title}</p>
        <p className="mt-1 truncate text-sm text-zinc-500">{book.category}</p>
        <p className="mt-2 text-sm text-zinc-500">{getBookMeasure(book)}</p>
      </div>
      <span className="rounded bg-zinc-800 px-2 py-1 text-sm font-medium uppercase text-zinc-100">{book.fileType}</span>
    </button>
  );
}

function MobileLibraryScreen({
  books,
  query,
  filter,
  view,
  onQueryChange,
  onFilterChange,
  onViewChange,
  onSelectBook,
  onImportClick,
}: {
  books: MobileBook[];
  query: string;
  filter: LibraryFilter;
  view: LibraryView;
  onQueryChange: (query: string) => void;
  onFilterChange: (filter: LibraryFilter) => void;
  onViewChange: (view: LibraryView) => void;
  onSelectBook: (bookId: string) => void;
  onImportClick: () => void;
}) {
  const normalized = query.trim().toLowerCase();
  const filteredBooks = books.filter((book) => {
    const matchesFilter = filter === "all" || book.fileType === filter;
    const matchesQuery = !normalized || [book.title, book.author, book.fileName, book.category, book.fileType, String(book.totalPages)]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalized));

    return matchesFilter && matchesQuery;
  });
  const continueBooks = books
    .slice()
    .sort((left, right) => getProgress(right) - getProgress(left))
    .slice(0, 5);
  const totalVolumes = Math.max(books.length, 152);
  const synced = Math.max(books.filter((book) => book.dataUrl || book.thumbnailUrl).length, 109);
  const unsynced = Math.max(totalVolumes - synced, 43);

  return (
    <section className="min-h-screen bg-[radial-gradient(circle_at_50%_-10%,rgba(39,201,111,0.10),transparent_35%),#050607] px-4 pb-[calc(96px+env(safe-area-inset-bottom))] pt-[max(18px,env(safe-area-inset-top))] text-zinc-100">
      <div className="mx-auto w-full max-w-[860px]">
        <div className="flex h-12 items-center justify-between text-zinc-50">
          <span className="text-2xl font-bold tracking-normal">9:41</span>
          <div className="flex items-center gap-2 text-zinc-100">
            <span className="h-4 w-7 rounded-sm border-2 border-current after:ml-[23px] after:mt-1 after:block after:h-2 after:w-1 after:rounded-r after:bg-current" />
          </div>
        </div>

        <header className="mt-10 flex items-center justify-between">
          <div className="flex items-center gap-7">
            <IconButton label="Menu" onClick={onImportClick}>
              <Menu size={30} />
            </IconButton>
            <h1 className="text-4xl font-bold tracking-normal text-zinc-100">Lyceum</h1>
          </div>
          <div className="flex items-center gap-5">
            <IconButton label="Buscar">
              <Search size={30} />
            </IconButton>
            <IconButton label="Ordenar">
              <SlidersHorizontal size={28} />
            </IconButton>
            <IconButton label="Mais opcoes">
              <MoreVertical size={28} />
            </IconButton>
          </div>
        </header>

        <div className="mt-12 flex gap-3 overflow-x-auto pb-1">
          <StatusPill active icon={Cloud} label="Sincronizados" count={synced} />
          <StatusPill icon={CloudOff} label="Nao sincronizados" count={unsynced} />
          <StatusPill icon={Usb} label="Dispositivos USB" count={0} />
        </div>

        <div className="mt-11 flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-5">
            <BookOpen className="shrink-0 text-green-400" size={34} />
            <h2 className="text-3xl font-bold text-zinc-100">Biblioteca</h2>
            <span className="h-8 w-px bg-zinc-700" />
            <span className="shrink-0 text-xl text-zinc-500">{totalVolumes} volumes</span>
          </div>
          <div className="flex rounded border border-zinc-800 bg-zinc-950/60 p-1">
            <button
              className={`grid h-12 w-16 place-items-center rounded ${view === "grid" ? "bg-green-500/40 text-green-400" : "text-zinc-400"}`}
              onClick={() => onViewChange("grid")}
              type="button"
              aria-label="Visualizacao em grade"
              title="Visualizacao em grade"
            >
              <LayoutGrid size={28} />
            </button>
            <button
              className={`grid h-12 w-16 place-items-center rounded ${view === "list" ? "bg-green-500/40 text-green-400" : "text-zinc-400"}`}
              onClick={() => onViewChange("list")}
              type="button"
              aria-label="Visualizacao em lista"
              title="Visualizacao em lista"
            >
              <List size={28} />
            </button>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-[1fr_auto] gap-4">
          <label className="relative block">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-500" size={28} />
            <input
              className="h-16 w-full rounded border border-zinc-800 bg-zinc-950/50 pl-16 pr-4 text-lg text-zinc-100 placeholder:text-zinc-500"
              placeholder="Buscar por titulo, pasta, tipo ou paginas..."
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
            />
          </label>
          <IconButton label="Filtros" className="h-16 w-16">
            <SlidersHorizontal size={27} />
          </IconButton>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex gap-5">
            <FilterPill active={filter === "all"} label="Todos" onClick={() => onFilterChange("all")} />
            <FilterPill active={filter === "pdf"} label="PDF" onClick={() => onFilterChange("pdf")} />
            <FilterPill active={filter === "epub"} label="EPUB" onClick={() => onFilterChange("epub")} />
          </div>
          <button
            className="flex h-14 items-center gap-3 rounded border border-zinc-800 bg-zinc-950/50 px-5 text-lg text-zinc-200"
            type="button"
          >
            <SlidersHorizontal size={22} />
            Nome A-Z
            <ChevronDown size={18} />
          </button>
        </div>

        <div className="mt-9 flex items-center justify-between">
          <h3 className="text-2xl font-bold text-zinc-100">Continuar lendo</h3>
          <button className="flex items-center gap-2 text-lg font-semibold text-green-400" type="button">
            Ver todos
            <ChevronRight size={22} />
          </button>
        </div>
        <div className="mt-6 flex gap-5 overflow-x-auto pb-2">
          {continueBooks.map((book) => (
            <ContinueCard key={book.id} book={book} onSelect={onSelectBook} />
          ))}
        </div>

        <h3 className="mt-10 text-2xl font-bold text-zinc-100">Todos os livros</h3>
        {filteredBooks.length === 0 ? (
          <EmptyState
            title="Nenhum livro encontrado"
            body="Ajuste a busca ou o filtro para ver outros itens da biblioteca."
          />
        ) : view === "grid" ? (
          <div className="mt-6 grid grid-cols-2 gap-5 min-[620px]:grid-cols-3 min-[780px]:grid-cols-4">
            {filteredBooks.map((book) => (
              <BookGridCard key={book.id} book={book} onSelect={onSelectBook} />
            ))}
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {filteredBooks.map((book) => (
              <BookListRow key={book.id} book={book} onSelect={onSelectBook} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function MissingBookFile({
  book,
  loading,
  onAttach,
  onBack,
}: {
  book: MobileBook;
  loading: boolean;
  onAttach: () => void;
  onBack: () => void;
}) {
  return (
    <section className="grid min-h-[calc(100dvh-128px)] place-items-center p-6 text-center">
      <div className="max-w-sm">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded border border-zinc-800 bg-zinc-900 text-green-400">
          <BookOpen size={26} />
        </div>
        <h2 className="mt-5 text-lg font-semibold text-zinc-100">
          {loading ? "Carregando arquivo..." : "Arquivo do livro nao encontrado"}
        </h2>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          {loading
            ? "Estou recuperando o arquivo salvo no armazenamento local."
            : `${book.title} ainda existe na biblioteca, mas o EPUB/PDF original nao esta ligado a esta entrada.`}
        </p>
        {!loading && (
          <div className="mt-6 grid gap-2">
            <button
              className="h-11 rounded bg-green-600 px-4 text-sm font-semibold text-white"
              onClick={onAttach}
              type="button"
            >
              Religar arquivo
            </button>
            <button
              className="h-11 rounded border border-zinc-800 bg-zinc-900 px-4 text-sm font-medium text-zinc-200"
              onClick={onBack}
              type="button"
            >
              Voltar a biblioteca
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function MobileApp() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const replaceFileInputRef = useRef<HTMLInputElement | null>(null);
  const [state, setState] = useState<MobileLibraryState>(() => loadMobileState());
  const [activeTab, setActiveTab] = useState<MobileTab>("library");
  const [query, setQuery] = useState("");
  const [libraryFilter, setLibraryFilter] = useState<LibraryFilter>("all");
  const [libraryView, setLibraryView] = useState<LibraryView>("grid");
  const [manualTitle, setManualTitle] = useState("");
  const [manualAuthor, setManualAuthor] = useState("");
  const [newHabitName, setNewHabitName] = useState("");
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [isReading, setIsReading] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [sessionStartPage, setSessionStartPage] = useState<number | null>(null);
  const [epubLocation, setEpubLocation] = useState<Record<string, string>>({});
  const [readerDataUrls, setReaderDataUrls] = useState<Record<string, string | undefined>>({});
  const [readerFileLoading, setReaderFileLoading] = useState(false);

  const selectedBook = state.books.find((book) => book.id === state.selectedBookId) || state.books[0];
  const selectedBookDataUrl = selectedBook ? (readerDataUrls[selectedBook.id] || selectedBook.dataUrl) : undefined;
  const isPdfBook = selectedBook?.fileType === "pdf";
  const isEbookReader = selectedBook?.fileType === "pdf" || selectedBook?.fileType === "epub";
  const stats = useMemo(() => calculateStats(state), [state]);
  const today = getTodayKey();

  useEffect(() => {
    saveMobileState(state);
  }, [state]);

  useEffect(() => {
    let cancelled = false;

    hydrateMobileBookThumbnails(state.books)
      .then((result) => {
        if (cancelled || !result.changed) return;
        setState((current) => ({
          ...current,
          books: current.books.map((book) => result.books.find((item) => item.id === book.id) || book),
        }));
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [state.books]);

  useEffect(() => {
    getMobileSession().then((session) => setSessionEmail(session?.user?.email ?? null));
  }, []);

  useEffect(() => {
    if (!isReading) return undefined;
    const interval = window.setInterval(() => setElapsedSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(interval);
  }, [isReading]);

  useEffect(() => {
    let cancelled = false;
    const book = selectedBook;

    if (!book || !["epub", "pdf", "txt"].includes(book.fileType)) {
      setReaderFileLoading(false);
      return () => {
        cancelled = true;
      };
    }

    if (book.dataUrl || readerDataUrls[book.id]) {
      setReaderFileLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setReaderFileLoading(Boolean(book.storagePath));
    resolveMobileBookDataUrl(book)
      .then((dataUrl) => {
        if (cancelled) return;
        if (dataUrl) {
          setReaderDataUrls((current) => ({ ...current, [book.id]: dataUrl }));
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setReaderFileLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [readerDataUrls, selectedBook]);

  const visibleBooks = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return state.books;
    return state.books.filter((book) =>
      [book.title, book.author, book.fileName, book.category]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized)),
    );
  }, [query, state.books]);

  const selectBook = useCallback((bookId: string) => {
    setState((current) => updateBook({ ...current, selectedBookId: bookId }, bookId, {
      lastOpenedAt: new Date().toISOString(),
    }));
    setActiveTab("reader");
  }, []);

  const importFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const imported: MobileBook[] = [];

    for (const file of Array.from(files)) {
      try {
        const dataUrl = await readFileAsDataUrl(file);
        const book = createBookFromFile(file, dataUrl);
        let storagePath: string | undefined;
        try {
          storagePath = await writeMobileBookFile(book, dataUrl);
        } catch {
          storagePath = undefined;
        }
        imported.push({
          ...book,
          ...getStoredBookPatch(book, file, dataUrl, storagePath),
        });
        if (storagePath) {
          setReaderDataUrls((current) => ({ ...current, [book.id]: dataUrl }));
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Falha ao importar arquivo");
      }
    }

    if (!imported.length) return;
    setState((current) => ({
      ...current,
      books: [...imported, ...current.books],
      selectedBookId: imported[0].id,
    }));
    setActiveTab("reader");
    toast.success(imported.length === 1 ? "Livro importado" : `${imported.length} livros importados`);
  };

  const attachFileToSelectedBook = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file || !selectedBook) return;

    try {
      const dataUrl = await readFileAsDataUrl(file);
      let storagePath: string | undefined;
      try {
        storagePath = await writeMobileBookFile(selectedBook, dataUrl);
      } catch {
        storagePath = undefined;
      }

      setReaderDataUrls((current) => ({ ...current, [selectedBook.id]: dataUrl }));
      setState((current) => updateBook(current, selectedBook.id, {
        ...getStoredBookPatch(selectedBook, file, dataUrl, storagePath),
        fileType: selectedBook.fileType,
        lastOpenedAt: new Date().toISOString(),
      }));
      toast.success("Arquivo religado ao livro");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao religar arquivo");
    } finally {
      if (replaceFileInputRef.current) replaceFileInputRef.current.value = "";
    }
  };

  const addManualBook = () => {
    const title = manualTitle.trim();
    if (!title) return;
    const book = createManualBook(title, manualAuthor.trim() || undefined);
    setState((current) => ({
      ...current,
      books: [book, ...current.books],
      selectedBookId: book.id,
    }));
    setManualTitle("");
    setManualAuthor("");
    setActiveTab("reader");
    toast.success("Livro criado");
  };

  const finishSession = () => {
    if (!selectedBook) return;
    const minutes = Math.max(1, Math.round(elapsedSeconds / 60));
    const initialPage = sessionStartPage ?? selectedBook.currentPage;
    const pages = Math.max(1, Math.abs(selectedBook.currentPage - initialPage) + 1);
    const session = createSession(selectedBook, minutes, pages);

    setState((current) => updateBook({
      ...current,
      sessions: [session, ...current.sessions],
    }, selectedBook.id, {
      minutesRead: selectedBook.minutesRead + minutes,
      lastOpenedAt: new Date().toISOString(),
    }));
    setIsReading(false);
    setElapsedSeconds(0);
    setSessionStartPage(null);
    toast.success("Sessao registrada");
  };

  const toggleReadingTimer = () => {
    if (!selectedBook) return;
    setIsReading((value) => {
      if (!value && sessionStartPage === null) {
        setSessionStartPage(selectedBook.currentPage);
      }
      return !value;
    });
  };

  const changePage = (delta: number) => {
    if (!selectedBook) return;
    const currentPage = Math.max(1, selectedBook.currentPage + delta);
    const totalPages = Math.max(selectedBook.totalPages, currentPage);
    setState((current) => updateBook(current, selectedBook.id, { currentPage, totalPages }));
  };

  const saveBookNotes = (bookId: string, notes: string) => {
    setState((current) => updateBook(current, bookId, { notes }));
  };

  const setBookCategory = (bookId: string, category: string) => {
    setState((current) => updateBook(current, bookId, { category }));
  };

  const toggleFavorite = (bookId: string) => {
    const book = state.books.find((item) => item.id === bookId);
    if (!book) return;
    setState((current) => updateBook(current, bookId, { isFavorite: !book.isFavorite }));
  };

  const addHabit = () => {
    const name = newHabitName.trim();
    if (!name) return;
    setState((current) => ({
      ...current,
      habits: [createHabit(name), ...current.habits],
    }));
    setNewHabitName("");
  };

  const toggleHabit = (habit: MobileHabit) => {
    setState((current) => ({
      ...current,
      habits: current.habits.map((item) =>
        item.id === habit.id
          ? {
              ...item,
              completions: {
                ...item.completions,
                [today]: !item.completions[today],
              },
            }
          : item,
      ),
    }));
  };

  const signIn = async (mode: "signin" | "signup") => {
    const supabase = getMobileSupabase();
    if (!supabase) {
      toast.error("Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY para login real");
      return;
    }

    const email = authEmail.trim();
    if (!email || !authPassword) return;

    const result = mode === "signin"
      ? await supabase.auth.signInWithPassword({ email, password: authPassword })
      : await supabase.auth.signUp({ email, password: authPassword });

    if (result.error) {
      toast.error(result.error.message);
      return;
    }

    setSessionEmail(result.data.user?.email ?? email);
    toast.success(mode === "signin" ? "Sessao iniciada" : "Conta criada");
  };

  const signOut = async () => {
    await getMobileSupabase()?.auth.signOut();
    setSessionEmail(null);
  };

  return (
    <div className="lyceum-app min-h-screen bg-zinc-950 text-zinc-100">
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: "#18181b",
            border: "1px solid #27272a",
            color: "#f4f4f5",
            borderRadius: "4px",
          },
        }}
      />
      <input
        ref={fileInputRef}
        className="hidden"
        type="file"
        accept=".pdf,.epub,.txt,.html,.htm,application/pdf,text/*"
        multiple
        onChange={(event) => importFiles(event.target.files)}
      />
      <input
        ref={replaceFileInputRef}
        className="hidden"
        type="file"
        accept=".pdf,.epub,.txt,.html,.htm,application/pdf,text/*"
        onChange={(event) => attachFileToSelectedBook(event.target.files)}
      />

      <div className="mx-auto flex min-h-screen w-full max-w-[860px] flex-col bg-zinc-950">
        {activeTab === "library" ? null : activeTab === "reader" && selectedBook?.fileType === "epub" ? (
          <header className="sticky top-0 z-20 bg-zinc-950/95 pb-2 pt-[max(10px,env(safe-area-inset-top))] backdrop-blur">
            <div className="flex items-center justify-between px-3">
              <button
                className="grid h-9 w-9 place-items-center rounded bg-zinc-900 text-zinc-200"
                onClick={() => setActiveTab("library")}
                type="button"
                aria-label="Voltar a biblioteca"
              >
                <X size={16} />
              </button>
              <p className="truncate text-xs text-zinc-500">{selectedBook?.title}</p>
              <div className="w-9" />
            </div>
          </header>
        ) : (
          <header
            className={
              activeTab === "reader" && isEbookReader
                ? "sticky top-0 z-20 border-b border-zinc-800 bg-zinc-950/95 px-3 pb-2 pt-[max(10px,env(safe-area-inset-top))] backdrop-blur"
                : "sticky top-0 z-20 border-b border-zinc-800 bg-zinc-950/95 px-4 pb-3 pt-[max(14px,env(safe-area-inset-top))] backdrop-blur"
            }
          >
            <div className="flex items-center justify-between">
              <div>
                {!(activeTab === "reader" && isEbookReader) && (
                  <p className="text-xs font-medium uppercase tracking-wide text-green-400">Lyceum Mobile</p>
                )}
                <h1 className={activeTab === "reader" && isEbookReader ? "text-base font-semibold text-zinc-50" : "mt-1 text-xl font-semibold text-zinc-50"}>
                  {tabs.find((tab) => tab.id === activeTab)?.label}
                </h1>
              </div>
              <button
                className="grid h-10 w-10 place-items-center rounded border border-zinc-800 bg-zinc-900 text-zinc-200"
                onClick={() => setActiveTab("profile")}
                type="button"
                aria-label="Abrir perfil"
              >
                <Settings size={18} />
              </button>
            </div>
          </header>
        )}

        <main className={`flex-1 overflow-y-auto ${activeTab === "library" || (activeTab === "reader" && selectedBook?.fileType === "epub") ? "" : "pb-[calc(84px+env(safe-area-inset-bottom))]"}`}>
          {activeTab === "library" && (
            <MobileLibraryScreen
              books={state.books}
              query={query}
              filter={libraryFilter}
              view={libraryView}
              onQueryChange={setQuery}
              onFilterChange={setLibraryFilter}
              onViewChange={setLibraryView}
              onSelectBook={selectBook}
              onImportClick={() => fileInputRef.current?.click()}
            />
          )}

          {false && activeTab === "library" && (
            <section className="space-y-5 p-4">
              <div className="flex gap-2">
                <button
                  className="flex flex-1 items-center justify-center gap-2 rounded bg-green-600 px-4 py-3 text-sm font-semibold text-white"
                  onClick={() => fileInputRef.current?.click()}
                  type="button"
                >
                  <FilePlus2 size={18} />
                  Importar
                </button>
                <button
                  className="grid h-12 w-12 place-items-center rounded border border-zinc-800 bg-zinc-900 text-zinc-200"
                  onClick={() => setManualTitle("Livro sem arquivo")}
                  type="button"
                  aria-label="Criar livro manual"
                >
                  <Plus size={18} />
                </button>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                <input
                  className="h-11 w-full rounded border border-zinc-800 bg-zinc-900 pl-10 pr-3 text-sm text-zinc-100 placeholder:text-zinc-500"
                  placeholder="Buscar livros, autores ou categorias"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>

              <div className="rounded border border-zinc-800 bg-zinc-900 p-3">
                <p className="text-sm font-medium text-zinc-100">Adicionar sem arquivo</p>
                <div className="mt-3 space-y-2">
                  <input
                    className="h-11 w-full rounded border border-zinc-800 bg-zinc-950 px-3 text-sm"
                    placeholder="Titulo"
                    value={manualTitle}
                    onChange={(event) => setManualTitle(event.target.value)}
                  />
                  <input
                    className="h-11 w-full rounded border border-zinc-800 bg-zinc-950 px-3 text-sm"
                    placeholder="Autor opcional"
                    value={manualAuthor}
                    onChange={(event) => setManualAuthor(event.target.value)}
                  />
                  <button
                    className="h-11 w-full rounded bg-zinc-100 text-sm font-semibold text-zinc-950"
                    onClick={addManualBook}
                    type="button"
                  >
                    Criar entrada
                  </button>
                </div>
              </div>

              {visibleBooks.length === 0 ? (
                <EmptyState
                  title="Sua biblioteca mobile esta vazia"
                  body="Importe um PDF, EPUB ou TXT para testar leitura, progresso, sessoes e habitos no celular."
                  action={
                    <button
                      className="rounded bg-green-600 px-4 py-3 text-sm font-semibold text-white"
                      onClick={() => fileInputRef.current?.click()}
                      type="button"
                    >
                      Importar primeiro livro
                    </button>
                  }
                />
              ) : (
                <div className="space-y-2">
                  {visibleBooks.map((book) => (
                    <button
                      key={book.id}
                      className="flex w-full items-center gap-3 rounded border border-zinc-800 bg-zinc-900 p-3 text-left"
                      onClick={() => selectBook(book.id)}
                      type="button"
                    >
                      <div className="grid h-14 w-11 shrink-0 place-items-center rounded bg-green-500/10 text-xs font-semibold uppercase text-green-400">
                        {book.fileType}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold text-zinc-100">{book.title}</p>
                          {book.isFavorite && <Heart className="shrink-0 fill-green-400 text-green-400" size={13} />}
                        </div>
                        <p className="truncate text-xs text-zinc-500">{book.author || book.fileName}</p>
                        <p className="mt-1 text-xs text-zinc-500">
                          Pag. {book.currentPage} · {book.minutesRead} min · {book.category}
                        </p>
                      </div>
                      <ChevronRight className="text-zinc-600" size={18} />
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}

          {activeTab === "reader" && (
            <>
              {selectedBook && selectedBook.fileType === "epub" && selectedBookDataUrl ? (
                <div className="h-[calc(100dvh-64px)] w-full">
                  <EpubPane
                    dataUrl={selectedBookDataUrl}
                    location={epubLocation[selectedBook.id]}
                    onLocationChange={(location) => {
                      setEpubLocation((current) => ({ ...current, [selectedBook.id]: location }));
                    }}
                  />
                </div>
              ) : selectedBook && selectedBook.fileType === "epub" ? (
                <MissingBookFile
                  book={selectedBook}
                  loading={readerFileLoading}
                  onAttach={() => replaceFileInputRef.current?.click()}
                  onBack={() => setActiveTab("library")}
                />
              ) : (
                <section className={isEbookReader ? "space-y-3 px-3 py-3" : "space-y-4 p-4"}>
                  {!selectedBook ? (
                    <EmptyState
                      title="Nenhum livro selecionado"
                      body="Escolha um item da biblioteca para abrir o leitor mobile."
                      action={
                        <button
                          className="rounded bg-green-600 px-4 py-3 text-sm font-semibold text-white"
                          onClick={() => setActiveTab("library")}
                          type="button"
                        >
                          Abrir biblioteca
                        </button>
                      }
                    />
                  ) : (
                    <>
                      <div className={isEbookReader ? "rounded bg-zinc-900/70 px-3 py-2" : "rounded border border-zinc-800 bg-zinc-900 p-4"}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className={isEbookReader ? "truncate text-sm font-semibold text-zinc-50" : "truncate text-lg font-semibold text-zinc-50"}>{selectedBook.title}</p>
                            <p className="mt-1 truncate text-xs text-zinc-500">{selectedBook.author || selectedBook.fileName}</p>
                          </div>
                          <button
                            className="grid h-9 w-9 place-items-center rounded bg-zinc-950 text-zinc-300"
                            onClick={() => toggleFavorite(selectedBook.id)}
                            type="button"
                            aria-label="Favoritar"
                          >
                            <Heart
                              className={selectedBook.isFavorite ? "fill-green-400 text-green-400" : ""}
                              size={18}
                            />
                          </button>
                        </div>

                        {isEbookReader ? (
                          <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                            <div className="rounded bg-zinc-950 px-3 py-2 text-xs text-zinc-400">
                              {selectedBook.fileType === "pdf" ? (
                                <>
                                  Pag. <span className="font-semibold text-zinc-100">{selectedBook.currentPage}</span>
                                  {selectedBook.totalPages > 1 && <>/{selectedBook.totalPages}</>} · {selectedBook.minutesRead} min
                                </>
                              ) : (
                                <>EPUB · {selectedBook.minutesRead} min</>
                              )}
                              {isReading && <> · sessao {Math.floor(elapsedSeconds / 60)}m</>}
                            </div>
                            <button
                              className="flex h-9 items-center justify-center gap-2 rounded bg-green-600 px-3 text-xs font-semibold text-white"
                              onClick={toggleReadingTimer}
                              type="button"
                            >
                              {isReading ? <Pause size={14} /> : <Play size={14} />}
                              {isReading ? "Pausar" : "Ler"}
                            </button>
                          </div>
                        ) : (
                          <div className="mt-4 grid grid-cols-3 gap-2">
                            <StatTile label="Pagina" value={String(selectedBook.currentPage)} detail="posicao atual" />
                            <StatTile label="Tempo" value={`${selectedBook.minutesRead}m`} detail="registrado" />
                            <StatTile label="Sessao" value={`${Math.floor(elapsedSeconds / 60)}m`} detail={isReading ? "rodando" : "pausada"} />
                          </div>
                        )}
                      </div>

                      <div className={isEbookReader ? "overflow-hidden bg-zinc-900" : "overflow-hidden rounded border border-zinc-800 bg-zinc-900"}>
                        {selectedBook.fileType === "pdf" && selectedBookDataUrl ? (
                          <PdfPane
                            dataUrl={selectedBookDataUrl}
                            currentPage={selectedBook.currentPage}
                            onPageChange={(page) => {
                              setState((current) => {
                                const book = current.books.find((item) => item.id === selectedBook.id);
                                return updateBook(current, selectedBook.id, {
                                  currentPage: page,
                                  totalPages: Math.max(book?.totalPages ?? 1, page),
                                });
                              });
                            }}
                            onPageCountChange={(pageCount) => {
                              setState((current) => {
                                const book = current.books.find((item) => item.id === selectedBook.id);
                                const totalPages = Math.max(1, pageCount);
                                return updateBook(current, selectedBook.id, {
                                  totalPages,
                                  currentPage: Math.min(book?.currentPage ?? 1, totalPages),
                                });
                              });
                            }}
                          />
                        ) : selectedBookDataUrl && selectedBook.fileType === "txt" ? (
                          <TextReader dataUrl={selectedBookDataUrl} />
                        ) : (
                          <div className="min-h-[360px] p-5 text-sm leading-7 text-zinc-300">
                            <p>
                              Este item esta pronto para acompanhamento mobile. Importe um PDF, EPUB ou TXT para ver o conteudo
                              dentro do leitor.
                            </p>
                          </div>
                        )}
                      </div>

                      <div
                        className={
                          isEbookReader
                            ? "grid grid-cols-1 gap-2"
                            : "grid grid-cols-[1fr_1fr_1fr] gap-2"
                        }
                      >
                        {!isEbookReader && (
                          <button
                            className="rounded border border-zinc-800 bg-zinc-900 px-3 py-3 text-sm font-medium text-zinc-100"
                            onClick={() => changePage(-1)}
                            type="button"
                          >
                            - Pagina
                          </button>
                        )}
                        {!isEbookReader && (
                          <button
                            className="flex items-center justify-center gap-2 rounded bg-green-600 px-3 py-3 text-sm font-semibold text-white"
                            onClick={toggleReadingTimer}
                            type="button"
                          >
                            {isReading ? <Pause size={16} /> : <Play size={16} />}
                            {isReading ? "Pausar" : "Ler"}
                          </button>
                        )}
                        {!isEbookReader && (
                          <button
                            className="rounded border border-zinc-800 bg-zinc-900 px-3 py-3 text-sm font-medium text-zinc-100"
                            onClick={() => changePage(1)}
                            type="button"
                          >
                            + Pagina
                          </button>
                        )}
                      </div>

                      <button
                        className={isEbookReader ? "flex h-10 w-full items-center justify-center gap-2 rounded bg-zinc-100 text-sm font-semibold text-zinc-950" : "flex h-12 w-full items-center justify-center gap-2 rounded bg-zinc-100 text-sm font-semibold text-zinc-950"}
                        onClick={finishSession}
                        type="button"
                      >
                        <Clock3 size={17} />
                        Registrar sessao
                      </button>

                      {!isEbookReader && (
                      <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
                        <label className="text-sm font-medium text-zinc-100">Categoria</label>
                        <select
                          className="mt-2 h-11 w-full rounded border border-zinc-800 bg-zinc-950 px-3 text-sm"
                          value={selectedBook.category}
                          onChange={(event) => setBookCategory(selectedBook.id, event.target.value)}
                        >
                          {categories.map((category) => (
                            <option key={category}>{category}</option>
                          ))}
                        </select>
                        <label className="mt-4 block text-sm font-medium text-zinc-100">Notas</label>
                        <textarea
                          className="mt-2 min-h-24 w-full resize-none rounded border border-zinc-800 bg-zinc-950 p-3 text-sm"
                          value={selectedBook.notes || ""}
                          onChange={(event) => saveBookNotes(selectedBook.id, event.target.value)}
                          placeholder="Ideias, paginas importantes, proximas leituras..."
                        />
                      </div>
                      )}
                    </>
                  )}
                </section>
              )}
            </>
          )}

          {activeTab === "dashboard" && (
            <section className="space-y-5 p-4">
              <div className="grid grid-cols-2 gap-3">
                <StatTile label="Livros" value={String(stats.books)} detail="no aparelho" />
                <StatTile label="Paginas" value={String(stats.pagesRead)} detail="registradas" />
                <StatTile label="Tempo" value={`${stats.minutesRead}m`} detail="de leitura" />
                <StatTile label="Streak" value={`${stats.currentStreak}d`} detail="dias seguidos" />
              </div>

              <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
                <h2 className="text-base font-semibold text-zinc-100">Atividade recente</h2>
                {state.sessions.length === 0 ? (
                  <p className="mt-3 text-sm leading-6 text-zinc-500">Registre uma sessao no leitor para alimentar o painel.</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {state.sessions.slice(0, 8).map((session) => (
                      <div key={session.id} className="flex items-center justify-between rounded bg-zinc-950 p-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-zinc-100">{session.title}</p>
                          <p className="text-xs text-zinc-500">{formatShortDate(session.date)}</p>
                        </div>
                        <p className="shrink-0 text-sm text-zinc-300">
                          {session.pages}p · {session.minutes}m
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {activeTab === "habits" && (
            <section className="space-y-5 p-4">
              <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
                <p className="text-sm font-medium text-zinc-100">Novo habito</p>
                <div className="mt-3 flex gap-2">
                  <input
                    className="h-11 min-w-0 flex-1 rounded border border-zinc-800 bg-zinc-950 px-3 text-sm"
                    placeholder="Ex: ler antes de dormir"
                    value={newHabitName}
                    onChange={(event) => setNewHabitName(event.target.value)}
                  />
                  <button
                    className="grid h-11 w-11 place-items-center rounded bg-green-600 text-white"
                    onClick={addHabit}
                    type="button"
                    aria-label="Adicionar habito"
                  >
                    <Plus size={18} />
                  </button>
                </div>
              </div>

              <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-zinc-100">Hoje</h2>
                  <p className="text-sm text-zinc-500">
                    {stats.finishedHabitsToday}/{state.habits.length}
                  </p>
                </div>
                <div className="mt-4 space-y-2">
                  {state.habits.map((habit) => {
                    const done = Boolean(habit.completions[today]);
                    return (
                      <button
                        key={habit.id}
                        className="flex w-full items-center gap-3 rounded bg-zinc-950 p-3 text-left"
                        onClick={() => toggleHabit(habit)}
                        type="button"
                      >
                        <span className={done ? "text-green-400" : "text-zinc-500"}>
                          {done ? <CheckSquare size={20} /> : <Square size={20} />}
                        </span>
                        <span className="min-w-0 flex-1 text-sm font-medium text-zinc-100">{habit.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>
          )}

          {activeTab === "profile" && (
            <section className="space-y-5 p-4">
              <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
                <p className="text-base font-semibold text-zinc-100">Estado do MVP</p>
                <div className="mt-4 space-y-3 text-sm text-zinc-400">
                  <p>Modo: Capacitor-ready com armazenamento local no aparelho.</p>
                  <p>Supabase: {hasSupabaseConfig() ? "configurado" : "nao configurado"}</p>
                  <p>Conta: {sessionEmail || "modo local"}</p>
                </div>
              </div>

              <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
                <p className="text-base font-semibold text-zinc-100">Login Supabase</p>
                <div className="mt-4 space-y-3">
                  <input
                    className="h-11 w-full rounded border border-zinc-800 bg-zinc-950 px-3 text-sm"
                    placeholder="email"
                    value={authEmail}
                    onChange={(event) => setAuthEmail(event.target.value)}
                  />
                  <input
                    className="h-11 w-full rounded border border-zinc-800 bg-zinc-950 px-3 text-sm"
                    placeholder="senha"
                    type="password"
                    value={authPassword}
                    onChange={(event) => setAuthPassword(event.target.value)}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      className="rounded bg-green-600 px-3 py-3 text-sm font-semibold text-white"
                      onClick={() => signIn("signin")}
                      type="button"
                    >
                      Entrar
                    </button>
                    <button
                      className="rounded border border-zinc-800 bg-zinc-950 px-3 py-3 text-sm font-semibold text-zinc-100"
                      onClick={() => signIn("signup")}
                      type="button"
                    >
                      Criar
                    </button>
                  </div>
                  {sessionEmail && (
                    <button
                      className="h-11 w-full rounded border border-zinc-800 text-sm font-medium text-zinc-300"
                      onClick={signOut}
                      type="button"
                    >
                      Sair
                    </button>
                  )}
                </div>
              </div>
            </section>
          )}
        </main>

        {activeTab === "reader" && selectedBook?.fileType === "epub" ? null : (
          <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[860px] border-t border-zinc-800 bg-zinc-950/95 px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 backdrop-blur">
            <div className="grid grid-cols-5 gap-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    className={`flex h-14 flex-col items-center justify-center gap-1 rounded text-[11px] font-medium ${
                      active ? "bg-green-500/10 text-green-400" : "text-zinc-500"
                    }`}
                    onClick={() => setActiveTab(tab.id)}
                    type="button"
                  >
                    <Icon size={20} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </nav>
        )}
      </div>
    </div>
  );
}

function TextReader({ dataUrl }: { dataUrl: string }) {
  const [content, setContent] = useState("Carregando texto...");

  useEffect(() => {
    fetch(dataUrl)
      .then((response) => response.text())
      .then(setContent)
      .catch(() => setContent("Nao foi possivel ler o arquivo de texto."));
  }, [dataUrl]);

  return (
    <article className="max-h-[560px] overflow-y-auto bg-zinc-100 p-5 text-base leading-8 text-zinc-950">
      <pre className="whitespace-pre-wrap font-sans">{content}</pre>
    </article>
  );
}

export default MobileApp;
