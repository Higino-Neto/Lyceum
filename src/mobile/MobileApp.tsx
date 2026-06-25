import {
  BarChart3,
  BookOpen,
  ChevronDown,
  Download,
  Heart,
  Library,
  Menu,
  NotebookPen,
  RefreshCw,
  Search,
  Settings,
  SlidersHorizontal,
  Trophy,
  UserCircle,
  X,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import EpubPane from "./EpubPane";
import MobileDashboardScreen from "./MobileDashboardScreen";
import MobileLeaderboardScreen from "./MobileLeaderboardScreen";
import MobileLibraryScreenV2 from "./MobileLibraryScreen";
import MobileReadingEntryScreen from "./MobileReadingEntryScreen";
import PdfPane from "./PdfPane";
import {
  deleteMobileBookFile,
  getStoredBookPatch,
  moveMobileBookFile,
  resolveMobileBookDataUrl,
  writeMobileBookFile,
} from "./bookFileStorage";
import {
  acknowledgeNativeBook,
  getPendingNativeBooks,
  listenForIncomingBooks,
  loadNativeBook,
  pickNativeBooks,
  supportsNativeDocumentPicker,
  supportsNativeIncomingBooks,
  type NativeImportFile,
} from "./incomingBooksBridge";
import {
  createBookFromFile,
  createFolder,
  createSourceFolder,
  hydrateMobileState,
  inferFileType,
  loadMobileState,
  readFileAsDataUrl,
  saveMobileState,
} from "./storage";
import {
  descendantFolderIds,
  ensureFolderPath,
  findDuplicateBook,
  sanitizeFolderName,
  type MobileLibraryQuery,
} from "./libraryModel";
import {
  checkNativeApkUpdate,
  installNativeApkUpdate,
  openInstallPermissionSettings,
  type NativeApkUpdateState,
} from "./nativeApkUpdater";
import { getMobileSession, getMobileSupabase, hasSupabaseConfig } from "./supabaseMobile";
import {
  loadPersistentSourceFile,
  pickPersistentSourceFolder,
  releasePersistentSourceFolder,
  scanPersistentSourceFolder,
  supportsPersistentSourceFolders,
  type NativeSourceFile,
} from "./sourceFolderBridge";
import { extractThumbnailFromDataUrl, extractThumbnailFromFile } from "./thumbnailExtractor";
import { deleteMobileBookThumbnail, hydrateMobileBookThumbnails, persistExtractedBookThumbnail } from "./thumbnailStorage";
import { createMobileUserProfile } from "./readingApi";
import type { MobileBook, MobileLibraryState, MobileTab } from "./types";

const tabs: Array<{ id: MobileTab; label: string; icon: typeof Library }> = [
  { id: "dashboard", label: "Hoje", icon: BarChart3 },
  { id: "readings", label: "Registrar", icon: NotebookPen },
  { id: "library", label: "Biblioteca", icon: Library },
  { id: "leaderboard", label: "Ranking", icon: Trophy },
  { id: "profile", label: "Perfil", icon: UserCircle },
];

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

function formatMobileBytes(bytes?: number) {
  if (!bytes || bytes <= 0) return "0 MB";
  const value = bytes / (1024 * 1024);
  if (value >= 1024) return `${(value / 1024).toFixed(1)} GB`;
  return `${value.toFixed(1)} MB`;
}

function formatMobileDate(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("pt-BR");
}

function getNativeApkUpdateText(state: NativeApkUpdateState) {
  switch (state.status) {
    case "checking":
      return "Buscando atualizacao...";
    case "available":
      return "Atualizacao disponivel para instalar.";
    case "not-available":
      return "Voce esta na versao mais recente.";
    case "permission-required":
      return "Permita que o Lyceum solicite instalacao de APKs.";
    case "downloading":
      return "Baixando APK...";
    case "installing":
      return "Instalador do Android aberto. Confirme para concluir.";
    case "error":
      return state.error || "Falha ao verificar atualizacao.";
    case "unsupported":
      return "Atualizacao por APK esta disponivel apenas no Android.";
    default:
      return "Nenhuma verificacao feita.";
  }
}

type LibraryFilter = "all" | "pdf" | "epub";
type LibraryView = "grid" | "list";

const INITIAL_NATIVE_APK_UPDATE_STATE: NativeApkUpdateState = {
  status: "idle",
};

interface SourceImportEntry {
  name: string;
  size: number;
  mimeType: string;
  relativePath: string;
  loadFile: (signal?: AbortSignal, onProgress?: (loaded: number, total: number) => void) => Promise<File>;
}

interface ImportJob {
  id: string;
  name: string;
  progress: number;
  status: "reading" | "processing" | "done" | "cancelled" | "error";
  message?: string;
}

interface ImportCandidate {
  key: string;
  name: string;
  size: number;
  loadFile: (signal: AbortSignal, onProgress: (loaded: number, total: number) => void) => Promise<File>;
  acknowledge?: () => Promise<void>;
}

function getProgress(book: MobileBook) {
  if (book.fileType !== "pdf") return Math.round(book.progressPercent || book.textScrollPercent || 0);
  if (book.totalPages <= 1) return 0;
  return Math.min(96, Math.max(4, Math.round((book.currentPage / book.totalPages) * 100)));
}

function getBookMeasure(book: MobileBook) {
  if (book.fileType === "epub" && book.totalPages <= 80) return `${book.totalPages} cap.`;
  return `${book.totalPages} pags.`;
}

function canExtractThumbnail(book: MobileBook) {
  return book.fileType === "pdf" || book.fileType === "epub";
}

function shouldExtractThumbnail(book: MobileBook) {
  if (!canExtractThumbnail(book)) return false;
  if (book.thumbnailSource === "extracted" && book.thumbnailUrl) return false;
  return !book.thumbnailExtractAttempted;
}

async function extractThumbnailPatch(book: MobileBook, file: File): Promise<Partial<MobileBook>> {
  if (!canExtractThumbnail(book)) return {};

  try {
    const thumbnailDataUrl = await extractThumbnailFromFile(file, book.fileType);
    if (!thumbnailDataUrl) return { thumbnailExtractAttempted: true };
    return persistExtractedBookThumbnail(book, thumbnailDataUrl);
  } catch {
    return { thumbnailExtractAttempted: true };
  }
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
      className={`grid h-10 w-10 place-items-center rounded text-zinc-300 transition active:scale-95 ${className}`}
      onClick={onClick}
      type="button"
      aria-label={label}
      title={label}
    >
      {children}
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
      className={`h-8 min-w-[70px] rounded-full px-4 text-xs font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition active:scale-95 ${
        active
          ? "bg-emerald-500 text-white shadow-emerald-950/30"
          : "border border-white/5 bg-zinc-800/80 text-zinc-300"
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
      className={`w-full object-cover ${compact ? "h-24 rounded" : "h-full"}`}
      loading="lazy"
    />
  ) : (
    <div className={`grid w-full place-items-center bg-zinc-800 text-xs uppercase text-zinc-500 ${compact ? "h-24 rounded" : "h-full"}`}>
      {book.fileType}
    </div>
  );
}

function BookGridCard({ book, onSelect }: { book: MobileBook; onSelect: (bookId: string) => void }) {
  const progress = getProgress(book);

  return (
    <button
      className="group relative min-w-0 overflow-hidden rounded-[10px] border border-white/[0.06] bg-zinc-900 text-left shadow-[0_14px_35px_rgba(0,0,0,0.38)] transition active:scale-[0.99]"
      onClick={() => onSelect(book.id)}
      type="button"
    >
      <div className="aspect-[0.78/1] w-full overflow-hidden">
        <BookCover book={book} />
      </div>
      <span className="absolute left-2 top-2 rounded-[4px] bg-zinc-800/95 px-2 py-1 text-[9px] font-semibold uppercase leading-none text-zinc-200 shadow">
        {book.fileType}
      </span>
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#101114] via-[#101114]/95 to-transparent px-3 pb-3 pt-14">
        <div className="min-w-0">
          <p className="truncate text-[14px] font-bold leading-4 text-zinc-50">{book.title}</p>
          <p className="mt-1 truncate text-xs text-zinc-400">{book.author || book.category}</p>
        </div>
        <div className="mt-2 grid grid-cols-[1fr_auto] items-center gap-2">
          <div className="h-1 overflow-hidden rounded-full bg-zinc-700/70">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-[10px] tabular-nums text-zinc-400">{progress}%</span>
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
  const totalVolumes = Math.max(books.length, 152);

  return (
    <section className="min-h-screen bg-[#050607] px-6 pb-[calc(76px+env(safe-area-inset-bottom))] pt-[max(10px,env(safe-area-inset-top))] text-zinc-100">
      <div className="mx-auto w-full max-w-[480px]">
        <header className="flex h-11 items-center justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <IconButton label="Menu" className="-ml-1" onClick={onImportClick}>
              <Menu size={23} />
            </IconButton>
            <div className="min-w-0">
              <h1 className="truncate text-[22px] font-extrabold leading-6 tracking-normal text-zinc-50">Biblioteca</h1>
              <p className="mt-0.5 text-sm leading-4 text-zinc-500">{totalVolumes} volumes</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <IconButton label="Buscar">
              <Search size={21} />
            </IconButton>
            <IconButton label="Ordenar">
              <SlidersHorizontal size={21} />
            </IconButton>
          </div>
        </header>

        <div className="mt-3">
          <label className="relative block">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={19} />
            <input
              className="h-11 w-full rounded-2xl border border-white/[0.03] bg-[#17181c] pl-12 pr-4 text-sm font-medium text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-emerald-500/40"
              placeholder="Buscar livros, autores ou pastas"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
            />
          </label>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex min-w-0 gap-2">
            <FilterPill active={filter === "all"} label="Todos" onClick={() => onFilterChange("all")} />
            <FilterPill active={filter === "pdf"} label="PDF" onClick={() => onFilterChange("pdf")} />
            <FilterPill active={filter === "epub"} label="EPUB" onClick={() => onFilterChange("epub")} />
          </div>
          <button
            className="flex h-8 shrink-0 items-center gap-2 rounded-full border border-white/5 bg-zinc-800/80 px-4 text-xs font-semibold text-zinc-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
            type="button"
          >
            A-Z
            <ChevronDown size={14} />
          </button>
        </div>

        {filteredBooks.length === 0 ? (
          <EmptyState
            title="Nenhum livro encontrado"
            body="Ajuste a busca ou o filtro para ver outros itens da biblioteca."
          />
        ) : view === "grid" ? (
          <div className="mt-4 grid grid-cols-2 gap-3">
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
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const sourceFolderInputRef = useRef<HTMLInputElement | null>(null);
  const replaceFileInputRef = useRef<HTMLInputElement | null>(null);
  const importControllersRef = useRef(new Map<string, AbortController>());
  const incomingProcessingRef = useRef(new Set<string>());
  const [state, setState] = useState<MobileLibraryState>(() => loadMobileState());
  const stateRef = useRef(state);
  const [repositoryReady, setRepositoryReady] = useState(false);
  const [activeTab, setActiveTab] = useState<MobileTab>("dashboard");
  const [readingSeedBookId, setReadingSeedBookId] = useState<string>();
  const [libraryQuery, setLibraryQuery] = useState<MobileLibraryQuery>({
    search: "",
    scope: "all",
    fileType: "all",
    sort: "title_asc",
  });
  const [libraryView, setLibraryView] = useState<LibraryView>("grid");
  const [sourceFolderRefreshId, setSourceFolderRefreshId] = useState<string>();
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [readerDataUrls, setReaderDataUrls] = useState<Record<string, string | undefined>>({});
  const [readerFileLoading, setReaderFileLoading] = useState(false);
  const [importJobs, setImportJobs] = useState<ImportJob[]>([]);
  const [nativeApkUpdate, setNativeApkUpdate] = useState<NativeApkUpdateState>(INITIAL_NATIVE_APK_UPDATE_STATE);
  const [nativeApkUpdateBusy, setNativeApkUpdateBusy] = useState(false);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const selectedBook = state.books.find((book) => book.id === state.selectedBookId) || state.books[0];
  const selectedBookDataUrl = selectedBook ? (readerDataUrls[selectedBook.id] || selectedBook.dataUrl) : undefined;
  const isPdfBook = selectedBook?.fileType === "pdf";
  const isEbookReader = selectedBook?.fileType === "pdf" || selectedBook?.fileType === "epub";

  const refreshNativeApkUpdate = useCallback(async (silent = false) => {
    setNativeApkUpdate((current) => ({ ...current, status: "checking", error: undefined }));
    const result = await checkNativeApkUpdate();
    setNativeApkUpdate(result);

    if (!silent) {
      if (result.status === "available") {
        toast.success("Atualizacao disponivel");
      } else if (result.status === "not-available") {
        toast.success("Voce ja esta na versao mais recente");
      } else if (result.status === "error") {
        toast.error(result.error || "Falha ao verificar atualizacao");
      }
    }

    return result;
  }, []);

  const installNativeUpdate = useCallback(async () => {
    const manifest = nativeApkUpdate.manifest;
    if (!manifest) {
      toast.error("Nenhuma atualizacao disponivel");
      return;
    }

    setNativeApkUpdateBusy(true);
    setNativeApkUpdate((current) => ({
      ...current,
      status: "downloading",
      progress: { loaded: 0, total: manifest.sizeBytes || 0, percent: 0 },
      error: undefined,
    }));

    const result = await installNativeApkUpdate(manifest, (progress) => {
      setNativeApkUpdate((current) => ({
        ...current,
        status: "downloading",
        progress,
      }));
    });

    setNativeApkUpdate((current) => ({ ...current, ...result }));
    setNativeApkUpdateBusy(false);

    if (result.status === "permission-required") {
      toast("Permissao de instalacao necessaria");
    } else if (result.status === "installing") {
      toast.success("Confirme a instalacao no Android");
    } else if (result.status === "error") {
      toast.error(result.error || "Falha ao instalar atualizacao");
    }
  }, [nativeApkUpdate.manifest]);

  const openNativeInstallSettings = useCallback(async () => {
    try {
      await openInstallPermissionSettings();
      toast("Ative a permissao e volte ao Lyceum para atualizar");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao abrir permissoes");
    }
  }, []);

  useEffect(() => {
    if (!repositoryReady) return;
    saveMobileState(state);
  }, [repositoryReady, state]);

  useEffect(() => {
    void refreshNativeApkUpdate(true);
  }, [refreshNativeApkUpdate]);

  useEffect(() => {
    let cancelled = false;
    hydrateMobileState().then((hydrated) => {
      if (!cancelled) {
        setState(hydrated);
        setRepositoryReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

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
    let cancelled = false;
    const candidates = state.books.filter((book) => shouldExtractThumbnail(book) && (book.dataUrl || book.storagePath));
    if (candidates.length === 0) return () => {
      cancelled = true;
    };

    Promise.all(candidates.map(async (book): Promise<{ id: string; patch: Partial<MobileBook> }> => {
      try {
        const dataUrl = await resolveMobileBookDataUrl(book);
        if (!dataUrl) return { id: book.id, patch: { thumbnailExtractAttempted: true } };

        const thumbnailDataUrl = await extractThumbnailFromDataUrl(dataUrl, book.fileType);
        if (!thumbnailDataUrl) return { id: book.id, patch: { thumbnailExtractAttempted: true } };

        return { id: book.id, patch: await persistExtractedBookThumbnail(book, thumbnailDataUrl) };
      } catch {
        return { id: book.id, patch: { thumbnailExtractAttempted: true } };
      }
    })).then((results) => {
      if (cancelled) return;
      setState((current) => ({
        ...current,
        books: current.books.map((book) => {
          const result = results.find((item) => item.id === book.id);
          return result ? { ...book, ...result.patch } : book;
        }),
      }));
    }).catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [state.books]);

  useEffect(() => {
    getMobileSession().then((session) => setSessionEmail(session?.user?.email ?? null));
  }, []);

  useEffect(() => {
    const supabase = getMobileSupabase();
    if (!supabase) return undefined;

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionEmail(session?.user?.email ?? null);
      queryClient.invalidateQueries({ queryKey: ["mobile-readings"] });
      queryClient.invalidateQueries({ queryKey: ["mobile-reading-stats"] });
      queryClient.invalidateQueries({ queryKey: ["mobile-ranking"] });
      queryClient.invalidateQueries({ queryKey: ["mobile-friends"] });
      queryClient.invalidateQueries({ queryKey: ["mobile-friend-requests"] });
      queryClient.invalidateQueries({ queryKey: ["mobile-user-profile"] });
    });

    return () => data.subscription.unsubscribe();
  }, [queryClient]);

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

  const selectBook = useCallback((bookId: string) => {
    setState((current) => updateBook({ ...current, selectedBookId: bookId }, bookId, {
      lastOpenedAt: new Date().toISOString(),
    }));
    setActiveTab("reader");
  }, []);

  const updateImportJob = (jobId: string, patch: Partial<ImportJob>) => {
    setImportJobs((current) => current.map((job) => job.id === jobId ? { ...job, ...patch } : job));
  };

  const importCandidates = async (candidates: ImportCandidate[], folderId = libraryQuery.folderId) => {
    if (!candidates.length) return;
    const imported: MobileBook[] = [];
    const existing = [...stateRef.current.books];

    for (const candidate of candidates) {
      const jobId = `import_${Date.now()}_${Math.random().toString(16).slice(2)}`;
      const controller = new AbortController();
      importControllersRef.current.set(jobId, controller);
      setImportJobs((current) => [...current.filter((job) => job.status === "reading" || job.status === "processing"), {
        id: jobId,
        name: candidate.name,
        progress: 0,
        status: "reading",
      }]);

      try {
        const file = await candidate.loadFile(controller.signal, (loaded, total) => {
          const progress = total > 0 ? Math.round((loaded / total) * 58) : 12;
          updateImportJob(jobId, { progress: Math.min(58, progress), status: "reading", message: "Lendo arquivo" });
        });
        if (controller.signal.aborted) throw new DOMException("Importacao cancelada", "AbortError");
        if (!inferFileType(file)) throw new Error(`Formato nao suportado: ${file.name}`);
        if (findDuplicateBook([...existing, ...imported], file)) {
          toast(`Ignorado por parecer duplicado: ${file.name}`);
          updateImportJob(jobId, { progress: 100, status: "done", message: "Ja estava na biblioteca" });
          await candidate.acknowledge?.();
          continue;
        }
        const dataUrl = await readFileAsDataUrl(file, {
          signal: controller.signal,
          onProgress: (loaded, total) => {
            const progress = total > 0 ? 58 + Math.round((loaded / total) * 22) : 68;
            updateImportJob(jobId, { progress: Math.min(80, progress), status: "reading", message: "Preparando livro" });
          },
        });
        updateImportJob(jobId, { progress: 84, status: "processing", message: "Extraindo capa e salvando" });
        const book = createBookFromFile(file, dataUrl, folderId);
        const thumbnailPatch = await extractThumbnailPatch(book, file);
        if (controller.signal.aborted) throw new DOMException("Importacao cancelada", "AbortError");
        const storagePath = await writeMobileBookFile(book, dataUrl, folderId);
        imported.push({
          ...book,
          ...getStoredBookPatch(book, file, dataUrl, storagePath),
          ...thumbnailPatch,
        });
        if (storagePath) {
          setReaderDataUrls((current) => ({ ...current, [book.id]: dataUrl }));
        }
        await candidate.acknowledge?.();
        updateImportJob(jobId, { progress: 100, status: "done", message: "Importado" });
      } catch (error) {
        const cancelled = controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError") || (error instanceof Error && error.message.toLowerCase().includes("cancel"));
        updateImportJob(jobId, {
          status: cancelled ? "cancelled" : "error",
          message: cancelled ? "Cancelado" : error instanceof Error ? error.message : "Falha ao importar arquivo",
        });
        if (!cancelled) toast.error(error instanceof Error ? error.message : "Falha ao importar arquivo");
      } finally {
        importControllersRef.current.delete(jobId);
        incomingProcessingRef.current.delete(candidate.key);
      }
    }

    if (imported.length) {
      setState((current) => ({
        ...current,
        books: [...imported, ...current.books],
        selectedBookId: imported[0].id,
      }));
      toast.success(imported.length === 1 ? "Livro importado" : `${imported.length} livros importados`);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const importFiles = async (files: FileList | null, folderId = libraryQuery.folderId) => {
    if (!files?.length) return;
    await importCandidates(Array.from(files).map((file) => ({
      key: `web:${file.name}:${file.size}:${file.lastModified}`,
      name: file.name,
      size: file.size,
      loadFile: async () => file,
    })), folderId);
  };

  const importNativeFiles = async (files: NativeImportFile[], folderId = libraryQuery.folderId) => {
    const candidates = files.filter((file) => {
      if (incomingProcessingRef.current.has(file.uri)) return false;
      incomingProcessingRef.current.add(file.uri);
      return true;
    }).map((nativeFile): ImportCandidate => ({
      key: nativeFile.uri,
      name: nativeFile.name,
      size: nativeFile.size,
      loadFile: (signal, onProgress) => loadNativeBook(nativeFile, onProgress, signal),
      acknowledge: () => acknowledgeNativeBook(nativeFile.uri),
    }));
    await importCandidates(candidates, folderId);
  };

  const openFileImporter = async () => {
    if (!supportsNativeDocumentPicker()) {
      fileInputRef.current?.click();
      return;
    }
    try {
      await importNativeFiles(await pickNativeBooks());
    } catch (error) {
      if (!(error instanceof Error && error.message.toLowerCase().includes("cancel"))) {
        toast.error(error instanceof Error ? error.message : "Falha ao abrir o seletor de arquivos");
      }
    }
  };

  useEffect(() => {
    if (!repositoryReady || !supportsNativeIncomingBooks()) return undefined;
    let disposed = false;
    let listener: { remove: () => Promise<void> } | undefined;
    const consumePending = async () => {
      try {
        const pending = await getPendingNativeBooks();
        if (!disposed && pending.length) {
          setActiveTab("library");
          await importNativeFiles(pending);
        }
      } catch (error) {
        if (!disposed) toast.error(error instanceof Error ? error.message : "Falha ao receber arquivo compartilhado");
      }
    };
    void consumePending();
    void listenForIncomingBooks(() => { void consumePending(); }).then((handle) => {
      listener = handle;
    });
    return () => {
      disposed = true;
      void listener?.remove();
    };
  }, [repositoryReady]);

  const importSourceEntries = async (
    entries: SourceImportEntry[],
    requestedSourceId?: string,
    detectedName = "Pasta importada",
    nativeUri?: string,
  ) => {
    const supportedEntries = entries.filter((entry) => inferFileType({ name: entry.name, type: entry.mimeType } as File));
    if (!supportedEntries.length) {
      toast.error("A pasta nao contem PDF, EPUB ou TXT");
      return;
    }

    const existingSource = state.sourceFolders.find((source) => source.id === requestedSourceId);
    const source = existingSource || createSourceFolder(detectedName, supportedEntries.length);
    let workingFolders = [...state.folders];
    const imported: MobileBook[] = [];
    const updated = new Map<string, MobileBook>();

    for (const entry of supportedEntries) {
      let sourceJobId: string | undefined;
      let sourceController: AbortController | undefined;
      try {
        const relativePath = entry.relativePath.replace(/\\/g, "/");
        const parts = relativePath.split("/").filter(Boolean);
        const nestedParts = parts.slice(1, -1);
        const ensured = ensureFolderPath([source.name, ...nestedParts], workingFolders);
        workingFolders = ensured.folders;
        const duplicate = findDuplicateBook(
          [...state.books.filter((book) => book.sourceFolderId === source.id), ...imported],
          { name: entry.name, size: entry.size } as File,
          relativePath,
        );
        if (duplicate && duplicate.fileSize === entry.size) continue;

        sourceJobId = `source_${Date.now()}_${Math.random().toString(16).slice(2)}`;
        sourceController = new AbortController();
        importControllersRef.current.set(sourceJobId, sourceController);
        setImportJobs((current) => [...current.filter((job) => job.status === "reading" || job.status === "processing"), {
          id: sourceJobId!,
          name: entry.name,
          progress: 0,
          status: "reading",
          message: "Lendo pasta-fonte",
        }]);
        const file = await entry.loadFile(sourceController.signal, (loaded, total) => {
          updateImportJob(sourceJobId!, { progress: total > 0 ? Math.min(58, Math.round((loaded / total) * 58)) : 12 });
        });
        const dataUrl = await readFileAsDataUrl(file, {
          signal: sourceController.signal,
          onProgress: (loaded, total) => updateImportJob(sourceJobId!, {
            progress: total > 0 ? 58 + Math.round((loaded / total) * 22) : 68,
            message: "Preparando livro",
          }),
        });
        updateImportJob(sourceJobId, { progress: 84, status: "processing", message: "Salvando na biblioteca" });
        if (duplicate) {
          const nextBook = { ...duplicate, folderId: ensured.folderId, sourceFolderId: source.id, sourceRelativePath: relativePath };
          const storagePath = await writeMobileBookFile(nextBook, dataUrl, ensured.folderId);
          if (duplicate.storagePath && duplicate.storagePath !== storagePath) await deleteMobileBookFile(duplicate);
          const thumbnailPatch = await extractThumbnailPatch(nextBook, file);
          updated.set(duplicate.id, {
            ...nextBook,
            ...getStoredBookPatch(nextBook, file, dataUrl, storagePath),
            ...thumbnailPatch,
          });
          updateImportJob(sourceJobId, { progress: 100, status: "done", message: "Atualizado" });
          continue;
        }

        const book = createBookFromFile(file, dataUrl, ensured.folderId);
        const storagePath = await writeMobileBookFile(book, dataUrl, ensured.folderId);
        const thumbnailPatch = await extractThumbnailPatch(book, file);
        imported.push({
          ...book,
          ...getStoredBookPatch(book, file, dataUrl, storagePath),
          ...thumbnailPatch,
          sourceFolderId: source.id,
          sourceRelativePath: relativePath,
        });
        updateImportJob(sourceJobId, { progress: 100, status: "done", message: "Importado" });
      } catch (error) {
        const cancelled = sourceController?.signal.aborted || (error instanceof Error && error.message.toLowerCase().includes("cancel"));
        if (sourceJobId) updateImportJob(sourceJobId, { status: cancelled ? "cancelled" : "error", message: cancelled ? "Cancelado" : error instanceof Error ? error.message : `Falha ao importar ${entry.name}` });
        if (!cancelled) toast.error(error instanceof Error ? error.message : `Falha ao importar ${entry.name}`);
      } finally {
        if (sourceJobId) importControllersRef.current.delete(sourceJobId);
      }
    }

    const refreshedSource = {
      ...source,
      name: existingSource?.name || detectedName,
      lastImportedAt: new Date().toISOString(),
      lastFileCount: supportedEntries.length,
      nativeUri: nativeUri || existingSource?.nativeUri,
    };
    setState((current) => ({
      ...current,
      folders: workingFolders,
      sourceFolders: existingSource
        ? current.sourceFolders.map((item) => item.id === source.id ? refreshedSource : item)
        : [refreshedSource, ...current.sourceFolders],
      books: [
        ...imported,
        ...current.books.map((book) => updated.get(book.id) || book),
      ],
      selectedBookId: imported[0]?.id || current.selectedBookId,
    }));
    setSourceFolderRefreshId(undefined);
    if (sourceFolderInputRef.current) sourceFolderInputRef.current.value = "";
    toast.success(`${imported.length} novo(s), ${updated.size} atualizado(s)`);
  };

  const importSourceFolder = async (files: FileList | null) => {
    if (!files?.length) return;
    const sourceFiles = Array.from(files);
    const firstRelativePath = sourceFiles[0].webkitRelativePath || sourceFiles[0].name;
    const detectedName = firstRelativePath.split("/")[0] || "Pasta importada";
    await importSourceEntries(sourceFiles.map((file) => ({
      name: file.name,
      size: file.size,
      mimeType: file.type,
      relativePath: file.webkitRelativePath || `${detectedName}/${file.name}`,
      loadFile: async () => file,
    })), sourceFolderRefreshId, detectedName);
  };

  const connectOrRefreshSourceFolder = async (sourceFolderId?: string) => {
    if (!supportsPersistentSourceFolders()) {
      setSourceFolderRefreshId(sourceFolderId);
      sourceFolderInputRef.current?.click();
      return;
    }

    try {
      const existingSource = state.sourceFolders.find((source) => source.id === sourceFolderId);
      const selection = existingSource?.nativeUri
        ? { uri: existingSource.nativeUri, name: existingSource.name }
        : await pickPersistentSourceFolder();
      const scan = await scanPersistentSourceFolder(selection.uri);
      const entries = scan.files.map((file: NativeSourceFile): SourceImportEntry => ({
        name: file.name,
        size: file.size,
        mimeType: file.mimeType,
        relativePath: `${scan.name || selection.name}/${file.relativePath}`,
        loadFile: (signal, onProgress) => loadPersistentSourceFile(file, onProgress, signal),
      }));
      await importSourceEntries(entries, sourceFolderId, scan.name || selection.name, selection.uri);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao conectar pasta-fonte");
    }
  };

  const attachFileToSelectedBook = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file || !selectedBook) return;

    try {
      const dataUrl = await readFileAsDataUrl(file);
      const fileType = inferFileType(file);
      if (!fileType) throw new Error("Use um arquivo PDF, EPUB ou TXT");
      const linkedBook = { ...selectedBook, fileName: file.name, fileType };
      const thumbnailPatch = await extractThumbnailPatch(linkedBook, file);
      const storagePath = await writeMobileBookFile(linkedBook, dataUrl, selectedBook.folderId);

      setReaderDataUrls((current) => ({ ...current, [selectedBook.id]: dataUrl }));
      setState((current) => updateBook(current, selectedBook.id, {
        ...getStoredBookPatch(linkedBook, file, dataUrl, storagePath),
        fileType,
        lastOpenedAt: new Date().toISOString(),
        ...thumbnailPatch,
      }));
      toast.success("Arquivo religado ao livro");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao religar arquivo");
    } finally {
      if (replaceFileInputRef.current) replaceFileInputRef.current.value = "";
    }
  };

  const createManagedFolder = (name: string, parentId?: string) => {
    const safeName = sanitizeFolderName(name);
    if (!safeName) return;
    setState((current) => {
      if (current.folders.some((folder) => folder.parentId === parentId && folder.name.toLocaleLowerCase("pt-BR") === safeName.toLocaleLowerCase("pt-BR"))) {
        toast.error("Ja existe uma pasta com este nome");
        return current;
      }
      return { ...current, folders: [...current.folders, createFolder(safeName, parentId)] };
    });
  };

  const renameManagedFolder = (folderId: string, name: string) => {
    const safeName = sanitizeFolderName(name);
    if (!safeName) return;
    setState((current) => ({
      ...current,
      folders: current.folders.map((folder) => folder.id === folderId ? { ...folder, name: safeName, updatedAt: new Date().toISOString() } : folder),
    }));
  };

  const moveManagedFolder = (folderId: string, parentId?: string) => {
    setState((current) => {
      const folder = current.folders.find((item) => item.id === folderId);
      if (!folder || folder.parentId === parentId) return current;
      if (parentId && descendantFolderIds(folderId, current.folders).has(parentId)) {
        toast.error("Uma pasta nao pode ser movida para dentro dela mesma");
        return current;
      }
      if (current.folders.some((item) => item.id !== folderId && item.parentId === parentId && item.name.toLocaleLowerCase("pt-BR") === folder.name.toLocaleLowerCase("pt-BR"))) {
        toast.error("Ja existe uma pasta com este nome no destino");
        return current;
      }
      return {
        ...current,
        folders: current.folders.map((item) => item.id === folderId ? { ...item, parentId, updatedAt: new Date().toISOString() } : item),
      };
    });
  };

  const moveBooks = async (bookIds: string[], folderId?: string) => {
    const patches = new Map<string, Partial<MobileBook>>();
    for (const bookId of bookIds) {
      const book = state.books.find((item) => item.id === bookId);
      if (!book) continue;
      try {
        const storagePath = await moveMobileBookFile(book, folderId);
        patches.set(bookId, { folderId, storagePath, updatedAt: new Date().toISOString() });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : `Falha ao mover ${book.title}`);
      }
    }
    setState((current) => ({ ...current, books: current.books.map((book) => ({ ...book, ...(patches.get(book.id) || {}) })) }));
    if (patches.size) toast.success(`${patches.size} livro(s) movido(s)`);
  };

  const deleteBooks = async (bookIds: string[]) => {
    const ids = new Set(bookIds);
    const targets = state.books.filter((book) => ids.has(book.id));
    await Promise.all(targets.map(async (book) => {
      await deleteMobileBookFile(book);
      await deleteMobileBookThumbnail(book);
    }));
    setReaderDataUrls((current) => Object.fromEntries(Object.entries(current).filter(([id]) => !ids.has(id))));
    setState((current) => ({
      ...current,
      books: current.books.filter((book) => !ids.has(book.id)),
      selectedBookId: ids.has(current.selectedBookId || "") ? current.books.find((book) => !ids.has(book.id))?.id : current.selectedBookId,
    }));
    toast.success(`${targets.length} livro(s) removido(s)`);
  };

  const deleteManagedFolder = async (folderId: string) => {
    const ids = descendantFolderIds(folderId, state.folders);
    const folder = state.folders.find((item) => item.id === folderId);
    if (!folder || !window.confirm(`Excluir a pasta ${folder.name}? Os livros serao movidos para a pasta superior.`)) return;
    const affected = state.books.filter((book) => book.folderId && ids.has(book.folderId));
    await moveBooks(affected.map((book) => book.id), folder.parentId);
    setState((current) => ({
      ...current,
      folders: current.folders.filter((item) => !ids.has(item.id)),
      books: current.books.map((book) => book.folderId && ids.has(book.folderId) ? { ...book, folderId: folder.parentId } : book),
    }));
  };

  const updateMobileBook = (bookId: string, patch: Partial<MobileBook>) => {
    setState((current) => {
      const category = patch.category?.trim();
      return {
        ...updateBook(current, bookId, patch),
        categories: category && !current.categories.includes(category) ? [...current.categories, category] : current.categories,
      };
    });
  };

  const deleteSourceFolder = async (sourceFolderId: string) => {
    const source = state.sourceFolders.find((item) => item.id === sourceFolderId);
    if (!source || !window.confirm(`Desconectar ${source.name}? Os livros importados continuarao na biblioteca.`)) return;
    if (source.nativeUri) await releasePersistentSourceFolder(source.nativeUri).catch(() => undefined);
    setState((current) => ({
      ...current,
      sourceFolders: current.sourceFolders.filter((item) => item.id !== sourceFolderId),
      books: current.books.map((book) => book.sourceFolderId === sourceFolderId
        ? { ...book, sourceFolderId: undefined, sourceRelativePath: undefined }
        : book),
    }));
    setLibraryQuery((current) => current.sourceFolderId === sourceFolderId
      ? { ...current, sourceFolderId: undefined, scope: "all" }
      : current);
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

  const signIn = async (mode: "signin" | "signup") => {
    const supabase = getMobileSupabase();
    if (!supabase) {
      toast.error("Supabase nao configurado no build mobile");
      return;
    }

    const email = authEmail.trim();
    if (!email || !authPassword) {
      toast.error("Informe email e senha");
      return;
    }

    const result = mode === "signin"
      ? await supabase.auth.signInWithPassword({ email, password: authPassword })
      : await supabase.auth.signUp({
          email,
          password: authPassword,
          options: {
            data: {
              name: email.split("@")[0],
              full_name: email.split("@")[0],
            },
          },
        });

    if (result.error) {
      toast.error(result.error.message);
      return;
    }

    if (result.data.session?.user?.id) {
      await createMobileUserProfile(result.data.user.id, result.data.user.email || email).catch((error) => {
        console.warn("Could not create mobile profile:", error);
      });
    }

    if (!result.data.session) {
      setSessionEmail(null);
      toast.success("Conta criada. Confirme o email antes de entrar.");
      return;
    }

    setSessionEmail(result.data.session.user.email ?? email);
    queryClient.invalidateQueries({ queryKey: ["mobile-readings"] });
    queryClient.invalidateQueries({ queryKey: ["mobile-reading-stats"] });
    queryClient.invalidateQueries({ queryKey: ["mobile-ranking"] });
    queryClient.invalidateQueries({ queryKey: ["mobile-friends"] });
    toast.success(mode === "signin" ? "Sessao iniciada" : "Conta criada");
  };

  const signOut = async () => {
    await getMobileSupabase()?.auth.signOut();
    setSessionEmail(null);
    queryClient.clear();
  };

  const nativeUpdateProgress = nativeApkUpdate.progress?.percent ?? 0;
  const nativeUpdatePublishedAt = formatMobileDate(nativeApkUpdate.manifest?.publishedAt);
  const nativeUpdateSize = formatMobileBytes(nativeApkUpdate.manifest?.sizeBytes);

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
        accept=".pdf,.epub,.txt,application/pdf,application/epub+zip,text/plain"
        multiple
        onChange={(event) => importFiles(event.target.files)}
      />
      <input
        ref={sourceFolderInputRef}
        className="hidden"
        type="file"
        accept=".pdf,.epub,.txt,application/pdf,application/epub+zip,text/plain"
        multiple
        {...({ webkitdirectory: "", directory: "" } as React.InputHTMLAttributes<HTMLInputElement>)}
        onChange={(event) => importSourceFolder(event.target.files)}
      />
      <input
        ref={replaceFileInputRef}
        className="hidden"
        type="file"
        accept=".pdf,.epub,.txt,application/pdf,application/epub+zip,text/plain"
        onChange={(event) => attachFileToSelectedBook(event.target.files)}
      />

      {importJobs.length > 0 && (
        <aside className="fixed inset-x-3 bottom-[calc(82px+env(safe-area-inset-bottom))] z-[80] mx-auto max-w-[454px] rounded-2xl border border-zinc-700 bg-zinc-950/95 p-3 shadow-2xl shadow-black/60 backdrop-blur-xl" aria-label="Progresso das importacoes">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Importacoes</p>
            <button className="grid h-8 w-8 place-items-center rounded-full bg-zinc-900 text-zinc-400" onClick={() => setImportJobs((current) => current.filter((job) => job.status === "reading" || job.status === "processing"))} aria-label="Limpar importacoes concluidas" type="button"><X size={15} /></button>
          </div>
          <div className="max-h-52 space-y-2 overflow-y-auto">
            {importJobs.map((job) => {
              const running = job.status === "reading" || job.status === "processing";
              return <div key={job.id} className="rounded-xl bg-zinc-900 p-3">
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-zinc-100">{job.name}</p><p className={`mt-0.5 text-[11px] ${job.status === "error" ? "text-red-400" : job.status === "done" ? "text-emerald-400" : "text-zinc-500"}`}>{job.message || "Preparando"}</p></div>
                  {running ? <button className="h-8 rounded-lg bg-zinc-800 px-3 text-xs font-semibold text-zinc-300" onClick={() => importControllersRef.current.get(job.id)?.abort()} type="button">Cancelar</button> : <span className="text-xs tabular-nums text-zinc-500">{job.status === "done" ? "100%" : job.status === "cancelled" ? "Cancelado" : "Falhou"}</span>}
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800"><div className={`h-full rounded-full transition-all duration-200 ${job.status === "error" ? "bg-red-500" : job.status === "cancelled" ? "bg-zinc-600" : "bg-emerald-500"}`} style={{ width: job.progress + "%" }} /></div>
              </div>;
            })}
          </div>
        </aside>
      )}

      <div className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col bg-zinc-950">
        {activeTab === "library" || (activeTab === "reader" && isEbookReader) ? null : (
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
                  {activeTab === "reader" ? "Leitor" : tabs.find((tab) => tab.id === activeTab)?.label}
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

        <main className={`flex-1 overflow-y-auto ${activeTab === "library" || (activeTab === "reader" && isEbookReader) ? "" : "pb-[calc(84px+env(safe-area-inset-bottom))]"}`}>
          {activeTab === "dashboard" && (
            <MobileDashboardScreen
              sessionEmail={sessionEmail}
              onOpenProfile={() => setActiveTab("profile")}
              onOpenRegister={() => {
                setReadingSeedBookId(undefined);
                setActiveTab("readings");
              }}
              onOpenLeaderboard={() => setActiveTab("leaderboard")}
            />
          )}

          {activeTab === "readings" && (
            <MobileReadingEntryScreen
              key={readingSeedBookId || "manual-reading"}
              books={state.books}
              sessionEmail={sessionEmail}
              selectedBook={readingSeedBookId ? state.books.find((book) => book.id === readingSeedBookId) || null : null}
              onOpenProfile={() => setActiveTab("profile")}
            />
          )}

          {activeTab === "library" && (
            <MobileLibraryScreenV2
              state={state}
              query={libraryQuery}
              view={libraryView}
              onQueryChange={setLibraryQuery}
              onViewChange={setLibraryView}
              onOpenBook={selectBook}
              onImportFiles={() => { void openFileImporter(); }}
              onImportSourceFolder={connectOrRefreshSourceFolder}
              onCreateFolder={createManagedFolder}
              onRenameFolder={renameManagedFolder}
              onMoveFolder={moveManagedFolder}
              onDeleteFolder={deleteManagedFolder}
              onDeleteSourceFolder={deleteSourceFolder}
              onUpdateBook={updateMobileBook}
              onMoveBooks={moveBooks}
              onDeleteBooks={deleteBooks}
            />
          )}

          {/* Legacy library prototype retained in history; the managed library is rendered above.
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
                          {book.fileType === "pdf" ? `Pagina ${book.currentPage}` : `${getProgress(book)}%`} · {book.category}
                        </p>
                      </div>
                      <ChevronRight className="text-zinc-600" size={18} />
                    </button>
                  ))}
                </div>
              )}
            </section>
          */}

          {activeTab === "reader" && (
            <>
              {selectedBook && selectedBook.fileType === "epub" && selectedBookDataUrl ? (
                <div className="h-dvh w-full">
                  <EpubPane
                    dataUrl={selectedBookDataUrl}
                    location={selectedBook.epubLocation}
                    onLocationChange={(location, progressPercent) => {
                      setState((current) => updateBook(current, selectedBook.id, {
                        epubLocation: location,
                        progressPercent,
                        lastOpenedAt: new Date().toISOString(),
                      }));
                    }}
                    bookTitle={selectedBook.title}
                    onBack={() => setActiveTab("library")}
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
                <section className={selectedBook?.fileType === "pdf" ? "h-[100dvh]" : isEbookReader ? "space-y-3 px-3 py-3" : "space-y-4 p-4"}>
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
                      {selectedBook.fileType !== "pdf" && <div className={isEbookReader ? "rounded bg-zinc-900/70 px-3 py-2" : "rounded border border-zinc-800 bg-zinc-900 p-4"}>
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

                        <div className="mt-3 rounded bg-zinc-950 px-3 py-2 text-xs text-zinc-400">
                          {selectedBook.fileType.toUpperCase()} · {getProgress(selectedBook)}%
                        </div>
                      </div>}

                    <div className={isEbookReader ? "overflow-hidden bg-zinc-900" : "overflow-hidden rounded border border-zinc-800 bg-zinc-900"}>
                        {selectedBook.fileType === "pdf" && selectedBookDataUrl ? (
                          <PdfPane
                            dataUrl={selectedBookDataUrl}
                            currentPage={selectedBook.currentPage}
                            initialZoom={selectedBook.currentZoom || 1}
                            onClose={() => setActiveTab("library")}
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
                            onZoomChange={(currentZoom) => {
                              setState((current) => updateBook(current, selectedBook.id, { currentZoom }));
                            }}
                          />
                        ) : selectedBookDataUrl && selectedBook.fileType === "txt" ? (
                          <TextReader
                            dataUrl={selectedBookDataUrl}
                            initialProgress={selectedBook.textScrollPercent || 0}
                            onProgress={(progressPercent) => setState((current) => updateBook(current, selectedBook.id, {
                              textScrollPercent: progressPercent,
                              progressPercent,
                              lastOpenedAt: new Date().toISOString(),
                            }))}
                          />
                        ) : (
                          <div className="min-h-[360px] p-5 text-sm leading-7 text-zinc-300">
                            <p>
                              Este item esta pronto para acompanhamento mobile. Importe um PDF, EPUB ou TXT para ver o conteudo
                              dentro do leitor.
                            </p>
                          </div>
                        )}
                      </div>

                      {!isEbookReader && (
                      <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
                        <button
                          className="mb-4 flex h-11 w-full items-center justify-center gap-2 rounded bg-emerald-600 text-sm font-semibold text-white"
                          onClick={() => {
                            setReadingSeedBookId(selectedBook.id);
                            setActiveTab("readings");
                          }}
                          type="button"
                        >
                          <NotebookPen size={17} />
                          Registrar leitura deste livro
                        </button>
                        <label className="text-sm font-medium text-zinc-100">Categoria</label>
                        <select
                          className="mt-2 h-11 w-full rounded border border-zinc-800 bg-zinc-950 px-3 text-sm"
                          value={selectedBook.category}
                          onChange={(event) => setBookCategory(selectedBook.id, event.target.value)}
                        >
                          {state.categories.map((category) => (
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

          {activeTab === "leaderboard" && (
            <MobileLeaderboardScreen
              sessionEmail={sessionEmail}
              onOpenProfile={() => setActiveTab("profile")}
            />
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
                {sessionEmail && (
                  <button
                    className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded border border-zinc-800 bg-zinc-950 text-sm font-semibold text-zinc-200"
                    onClick={() => setActiveTab("leaderboard")}
                    type="button"
                  >
                    <Trophy size={17} />
                    Ranking e amigos
                  </button>
                )}
              </div>

              <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-zinc-100">Atualizacoes</p>
                    <p className="mt-1 text-sm leading-6 text-zinc-400">
                      {getNativeApkUpdateText(nativeApkUpdate)}
                    </p>
                  </div>
                  {nativeApkUpdate.status === "checking" ? (
                    <RefreshCw className="mt-1 animate-spin text-emerald-400" size={18} />
                  ) : null}
                </div>

                <div className="mt-4 space-y-2 text-xs text-zinc-500">
                  {nativeApkUpdate.installed ? (
                    <p>
                      Instalado: {nativeApkUpdate.installed.versionName} ({nativeApkUpdate.installed.versionCode})
                    </p>
                  ) : null}
                  {nativeApkUpdate.manifest ? (
                    <p>
                      Disponivel: {nativeApkUpdate.manifest.version} ({nativeApkUpdate.manifest.versionCode})
                      {nativeUpdatePublishedAt ? ` - ${nativeUpdatePublishedAt}` : ""}
                    </p>
                  ) : null}
                  {nativeApkUpdate.manifest?.sizeBytes ? (
                    <p>Tamanho: {nativeUpdateSize}</p>
                  ) : null}
                </div>

                {nativeApkUpdate.status === "downloading" ? (
                  <div className="mt-4">
                    <div className="mb-2 flex items-center justify-between text-xs text-zinc-500">
                      <span>{Math.round(nativeUpdateProgress)}%</span>
                      <span>
                        {formatMobileBytes(nativeApkUpdate.progress?.loaded)} / {formatMobileBytes(nativeApkUpdate.progress?.total)}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all"
                        style={{ width: `${Math.max(0, Math.min(100, nativeUpdateProgress))}%` }}
                      />
                    </div>
                  </div>
                ) : null}

                {nativeApkUpdate.manifest?.notes ? (
                  <p className="mt-4 whitespace-pre-wrap rounded border border-zinc-800 bg-zinc-950 p-3 text-sm leading-6 text-zinc-400">
                    {nativeApkUpdate.manifest.notes}
                  </p>
                ) : null}

                <div className="mt-4 grid gap-2">
                  {nativeApkUpdate.status === "permission-required" ? (
                    <button
                      className="flex h-11 w-full items-center justify-center gap-2 rounded bg-emerald-600 text-sm font-semibold text-white"
                      onClick={openNativeInstallSettings}
                      type="button"
                    >
                      Abrir permissao de instalacao
                    </button>
                  ) : null}
                  {nativeApkUpdate.status === "available" || nativeApkUpdate.status === "permission-required" ? (
                    <button
                      className="flex h-11 w-full items-center justify-center gap-2 rounded bg-emerald-600 text-sm font-semibold text-white disabled:opacity-60"
                      onClick={installNativeUpdate}
                      disabled={nativeApkUpdateBusy}
                      type="button"
                    >
                      <Download size={17} />
                      {nativeApkUpdateBusy ? "Preparando..." : "Atualizar"}
                    </button>
                  ) : null}
                  <button
                    className="flex h-11 w-full items-center justify-center gap-2 rounded border border-zinc-800 bg-zinc-950 text-sm font-semibold text-zinc-200 disabled:opacity-60"
                    onClick={() => { void refreshNativeApkUpdate(false); }}
                    disabled={nativeApkUpdate.status === "checking" || nativeApkUpdateBusy}
                    type="button"
                  >
                    <RefreshCw size={17} />
                    Buscar atualizacoes
                  </button>
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

        {activeTab === "reader" && isEbookReader ? null : (
          <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[480px] overflow-hidden rounded-t-2xl border border-b-0 border-white/[0.06] bg-[#111216]/95 px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 shadow-[0_-12px_35px_rgba(0,0,0,0.45)] backdrop-blur-xl">
            <div className="grid grid-cols-5 gap-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    className={`flex h-12 flex-col items-center justify-center gap-1 rounded text-[10px] font-semibold transition active:scale-95 ${
                      active ? "text-emerald-500" : "text-zinc-500"
                    }`}
                    onClick={() => {
                      if (tab.id === "readings") {
                        setReadingSeedBookId(undefined);
                      }
                      setActiveTab(tab.id);
                    }}
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

function TextReader({ dataUrl, initialProgress, onProgress }: { dataUrl: string; initialProgress: number; onProgress: (progress: number) => void }) {
  const [content, setContent] = useState("Carregando texto...");
  const scrollRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    fetch(dataUrl)
      .then((response) => response.text())
      .then(setContent)
      .catch(() => setContent("Nao foi possivel ler o arquivo de texto."));
  }, [dataUrl]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element || content === "Carregando texto...") return;
    element.scrollTop = Math.max(0, element.scrollHeight - element.clientHeight) * (initialProgress / 100);
  }, [content, initialProgress]);

  return (
    <article
      ref={scrollRef}
      className="max-h-[560px] overflow-y-auto bg-zinc-100 p-5 text-base leading-8 text-zinc-950"
      onScroll={(event) => {
        const element = event.currentTarget;
        const available = Math.max(1, element.scrollHeight - element.clientHeight);
        onProgress(Math.round((element.scrollTop / available) * 100));
      }}
    >
      <pre className="whitespace-pre-wrap font-sans">{content}</pre>
    </article>
  );
}

export default MobileApp;
