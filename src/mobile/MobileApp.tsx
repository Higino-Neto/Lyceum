import { useMobileImport } from "./useMobileImport";
import { useMobileReaderState } from "./useMobileReaderState";
import { useMobileUpdater } from "./useMobileUpdater";
import { useMobileAuth } from "./useMobileAuth";
import { useMobileLibrary } from "./useMobileLibrary";
import MobileBackupPanel from "./MobileBackupPanel";
import { hashMobileFile } from "./mobileBackup";
import { extractMobileMetadata } from "./mobileMetadata";
import TextPane from "./TextPane";
import { useMobileConfirm } from "./MobileConfirmDialog";
import {
  BarChart3,
  BookOpen,
  Download,
  Heart,
  Library,
  NotebookPen,
  RefreshCw,
  Settings,
  Trophy,
  UserCircle,
  X,
} from "lucide-react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import {
  deleteMobileBookFile,
  getStoredBookPatch,
  moveMobileBookFile,
  resolveMobileBookDataUrl,
  writeMobileBookFile,
} from "./bookFileStorage";
import {
  createBookFromFile,
  createFolder,
  createSourceFolder,
  inferFileType,
  readFileAsDataUrl,
} from "./storage";
import {
  descendantFolderIds,
  ensureFolderPath,
  findDuplicateBook,
  sanitizeFolderName,
  type MobileLibraryQuery,
} from "./libraryModel";
import type { NativeApkUpdateState } from "./nativeApkUpdater";
import {
  getMobileSupabaseConfigError,
  hasSupabaseConfig,
} from "./supabaseMobile";
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
import type { MobileBook, MobileLibraryState, MobileTab } from "./types";

const EpubPane = lazy(() => import("./EpubPane"));
const MobileDashboardScreen = lazy(() => import("./MobileDashboardScreen"));
const MobileLeaderboardScreen = lazy(() => import("./MobileLeaderboardScreen"));
const MobileLibraryScreenV2 = lazy(() => import("./MobileLibraryScreen"));
const MobileReadingEntryScreen = lazy(() => import("./MobileReadingEntryScreen"));
const PdfPane = lazy(() => import("./PdfPane"));

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
    case "not-published":
      return state.error || "Ainda nao existe uma versao mobile publicada.";
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

type LibraryView = "grid" | "list";

interface SourceImportEntry {
  name: string;
  size: number;
  mimeType: string;
  relativePath: string;
  loadFile: (signal?: AbortSignal, onProgress?: (loaded: number, total: number) => void) => Promise<File>;
}

function getProgress(book: MobileBook) {
  if (book.fileType !== "pdf") return Math.round(book.progressPercent || book.textScrollPercent || 0);
  if (book.totalPages <= 1) return 0;
  return Math.min(96, Math.max(4, Math.round((book.currentPage / book.totalPages) * 100)));
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
  const metadata = await extractMobileMetadata(file, book.fileType).catch(() => { toast(`Metadados indisponíveis: ${file.name}. Você pode editá-los na biblioteca.`); return {}; });
  if (!canExtractThumbnail(book)) return metadata;

  try {
    const thumbnailDataUrl = await extractThumbnailFromFile(file, book.fileType);
    if (!thumbnailDataUrl) return { ...metadata, thumbnailExtractAttempted: true };
    return { ...metadata, ...await persistExtractedBookThumbnail(book, thumbnailDataUrl) };
  } catch {
    return { ...metadata, thumbnailExtractAttempted: true };
  }
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
  const confirm = useMobileConfirm();
  const sourceFolderInputRef = useRef<HTMLInputElement | null>(null);
  const replaceFileInputRef = useRef<HTMLInputElement | null>(null);
  const { state, setState, stateRef, repositoryReady } = useMobileLibrary();
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
  const { sessionEmail, authReady, authBusy, authError, authEmail, setAuthEmail, authPassword, setAuthPassword, signIn, signOut, requestPasswordReset } = useMobileAuth();
  const [isOnline, setIsOnline] = useState(() => navigator.onLine !== false);
  const { selectedBook, selectedBookDataUrl, isEbookReader, setReaderDataUrls, readerFileLoading, selectBook } = useMobileReaderState(state, setState, setActiveTab);
  const { nativeApkUpdate, nativeApkUpdateBusy, refreshNativeApkUpdate, installNativeUpdate, openNativeInstallSettings } = useMobileUpdater();
  useEffect(() => {
    const updateConnection = () => setIsOnline(navigator.onLine !== false);
    window.addEventListener("online", updateConnection);
    window.addEventListener("offline", updateConnection);
    return () => {
      window.removeEventListener("online", updateConnection);
      window.removeEventListener("offline", updateConnection);
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
  }, [setState, state.books]);

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
  }, [setState, state.books]);

  const { fileInputRef, importControllersRef, importJobs, setImportJobs, updateImportJob, importFiles, openFileImporter } = useMobileImport({ stateRef, repositoryReady, setState, setReaderDataUrls, setActiveTab, folderId: libraryQuery.folderId, extractThumbnailPatch });

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
        const contentHash = await hashMobileFile(file);
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
            contentHash,
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
          contentHash,
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
      const contentHash = await hashMobileFile(file);
      const thumbnailPatch = await extractThumbnailPatch(linkedBook, file);
      const storagePath = await writeMobileBookFile(linkedBook, dataUrl, selectedBook.folderId);

      setReaderDataUrls((current) => ({ ...current, [selectedBook.id]: dataUrl }));
      setState((current) => updateBook(current, selectedBook.id, {
        ...getStoredBookPatch(linkedBook, file, dataUrl, storagePath),
        fileType,
        contentHash,
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
    if (!await confirm(`Excluir ${bookIds.length} livro(s) e seus arquivos salvos pelo Lyceum?`)) return;
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
    if (!folder || !await confirm(`Excluir a pasta ${folder.name}? Os livros serao movidos para a pasta superior.`)) return;
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
    if (!source || !await confirm(`Desconectar ${source.name}? Os livros importados continuarao na biblioteca.`)) return;
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
      {!isOnline ? (
        <div className="fixed inset-x-0 top-0 z-50 mx-auto max-w-[480px] bg-amber-500 px-4 py-2 text-center text-xs font-semibold text-zinc-950" role="status">
          Sem internet. A biblioteca e o leitor continuam disponiveis; a conta e a sincronizacao aguardarao a conexao.
        </div>
      ) : null}
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
          <Suspense fallback={<div className="grid min-h-[55dvh] place-items-center text-sm text-zinc-500">Carregando...</div>}>
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
              onCollectionsChange={collections => setState(current => ({ ...current, collections }))}
            />
          )}
          {activeTab === "reader" && (
            <>
              {selectedBook && selectedBook.fileType === "epub" && selectedBookDataUrl ? (
                <div className="h-dvh w-full">
                  <EpubPane
                    key={selectedBook.id}
                    bookId={selectedBook.id}
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
                            key={selectedBook.id}
                            bookId={selectedBook.id}
                            initialRotation={selectedBook.pdfRotation || 0}
                            onRotationChange={pdfRotation => setState(current => updateBook(current, selectedBook.id, { pdfRotation }))}
                            dataUrl={selectedBookDataUrl}
                            title={selectedBook.title}
                            fileName={selectedBook.fileName}
                            fileSize={selectedBook.fileSize}
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
                          <TextPane
                            key={selectedBook.id}
                            bookId={selectedBook.id}
                            initialOffset={selectedBook.textOffset}
                            dataUrl={selectedBookDataUrl}
                            initialProgress={selectedBook.textScrollPercent || 0}
                            onProgress={(progressPercent, textOffset) => setState((current) => updateBook(current, selectedBook.id, {
                              textOffset,
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
              <MobileBackupPanel state={state} setState={setState} />
              <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
                <p className="text-base font-semibold text-zinc-100">Lyceum Mobile</p>
                <div className="mt-4 space-y-3 text-sm text-zinc-400">
                  <p>Versao: {import.meta.env.VITE_APP_VERSION || "desenvolvimento"}</p>
                  <p>Biblioteca: armazenamento local persistente no aparelho.</p>
                  <p>Supabase: {hasSupabaseConfig() ? "configurado" : "nao configurado"}</p>
                  <p>Conta: {!authReady ? "verificando sessao..." : sessionEmail || "modo local"}</p>
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
                {getMobileSupabaseConfigError() ? (
                  <p className="mt-3 rounded border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
                    {getMobileSupabaseConfigError()}
                  </p>
                ) : null}
                {authError ? (
                  <p className="mt-3 rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200" role="alert">
                    {authError}
                  </p>
                ) : null}
                <div className="mt-4 space-y-3">
                  <input
                    className="h-11 w-full rounded border border-zinc-800 bg-zinc-950 px-3 text-sm"
                    placeholder="email"
                    autoComplete="email"
                    inputMode="email"
                    disabled={authBusy || Boolean(sessionEmail)}
                    value={authEmail}
                    onChange={(event) => setAuthEmail(event.target.value)}
                  />
                  <input
                    className="h-11 w-full rounded border border-zinc-800 bg-zinc-950 px-3 text-sm"
                    placeholder="senha"
                    type="password"
                    autoComplete={sessionEmail ? "off" : "current-password"}
                    disabled={authBusy || Boolean(sessionEmail)}
                    value={authPassword}
                    onChange={(event) => setAuthPassword(event.target.value)}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      className="rounded bg-green-600 px-3 py-3 text-sm font-semibold text-white"
                      onClick={() => signIn("signin")}
                      disabled={authBusy || !authReady || Boolean(sessionEmail) || !hasSupabaseConfig() || !isOnline}
                      type="button"
                    >
                      {authBusy ? "Conectando..." : "Entrar"}
                    </button>
                    <button
                      className="rounded border border-zinc-800 bg-zinc-950 px-3 py-3 text-sm font-semibold text-zinc-100"
                      onClick={() => signIn("signup")}
                      disabled={authBusy || !authReady || Boolean(sessionEmail) || !hasSupabaseConfig() || !isOnline}
                      type="button"
                    >
                      Criar
                    </button>
                  </div>
                  {!sessionEmail ? (
                    <button
                      className="h-10 w-full text-xs font-semibold text-emerald-400 disabled:opacity-50"
                      onClick={requestPasswordReset}
                      disabled={authBusy || !hasSupabaseConfig() || !isOnline}
                      type="button"
                    >
                      Esqueci minha senha
                    </button>
                  ) : null}
                  {sessionEmail && (
                    <button
                      className="h-11 w-full rounded border border-zinc-800 text-sm font-medium text-zinc-300"
                      onClick={signOut}
                      disabled={authBusy}
                      type="button"
                    >
                      Sair
                    </button>
                  )}
                </div>
              </div>
            </section>
          )}
          </Suspense>
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


export default MobileApp;
