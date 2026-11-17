import { useMobileImport } from "./useMobileImport";
import MobileSettingsScreen from "./settings/MobileSettingsScreen";
import { canReadAsLyceum } from "./learning/learningSupport";
import { useMobileReaderState } from "./useMobileReaderState";
import { useMobileUpdater } from "./useMobileUpdater";
import { useMobileAuth } from "./useMobileAuth";
import { useMobileLibrary } from "./useMobileLibrary";
import { hashMobileFile } from "./mobileBackup";
import { extractMobileMetadata } from "./mobileMetadata";
import TextPane from "./TextPane";
import { useMobileConfirm } from "./MobileConfirmDialog";
import {
  BarChart3,
  BookOpen,
  Heart,
  Library,
  NotebookPen,
  Settings,
  Trophy,
  X,
} from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useBackNavigation } from "./useBackNavigation";
import toast, { Toaster } from "react-hot-toast";
import {
  deleteMobileBookFile,
  getStoredBookPatch,
  moveMobileBookFile,
  loadMobileBookBytes,
  resolveMobileBookUrl,
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
import { MobileFieldFrame, MobileSelect } from "./MobileControls";
import { normalizeCase, translate, useTranslation, type TranslationKey } from "../i18n";
import { startDeviceSync } from "../features/device-sync/syncController";

const EpubPane = lazy(() => import("./EpubPane"));
const MobileDashboardScreen = lazy(() => import("./MobileDashboardScreen"));
const MobileLeaderboardScreen = lazy(() => import("./MobileLeaderboardScreen"));
const MobileLibraryScreenV2 = lazy(() => import("./MobileLibraryScreen"));
const MobileReadingEntryScreen = lazy(() => import("./MobileReadingEntryScreen"));
const PdfPane = lazy(() => import("./PdfPane"));
const MobileLearningReader = lazy(() => import("./learning/MobileLearningReader"));

const tabs: Array<{ id: MobileTab; labelKey: TranslationKey; icon: typeof Library }> = [
  { id: "dashboard", labelKey: "mobile:tabs.dashboard", icon: BarChart3 },
  { id: "library", labelKey: "mobile:tabs.library", icon: Library },
  { id: "leaderboard", labelKey: "mobile:tabs.leaderboard", icon: Trophy },
  { id: "profile", labelKey: "mobile:tabs.profile", icon: Settings },
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
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded bg-primary-muted text-primary">
          <BookOpen size={24} />
        </div>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-foreground-muted">{body}</p>
        {action && <div className="mt-5">{action}</div>}
      </div>
    </div>
  );
}

function MobileStartupSkeleton() {
  const { t } = useTranslation();

  return (
    <div className="mobile-app-skeleton mx-auto flex w-full max-w-[480px] flex-col px-4 pb-28 pt-[max(22px,env(safe-area-inset-top))]" role="status" aria-label={t("mobile:startup.ariaLabel")}>
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary-muted text-primary"><BookOpen size={22} /></div>
        <div><p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">Lyceum</p><p className="mt-1 text-sm text-foreground-subtle">{t("mobile:startup.preparingLibrary")}</p></div>
      </div>
      <div className="mobile-skeleton-block mt-8 h-40 rounded-3xl" />
      <div className="mt-4 grid grid-cols-2 gap-3"><div className="mobile-skeleton-block h-28 rounded-2xl" /><div className="mobile-skeleton-block h-28 rounded-2xl" /></div>
      <div className="mobile-skeleton-block mt-4 h-52 rounded-3xl" />
      <span className="sr-only">{t("mobile:startup.srOnly")}</span>
    </div>
  );
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
  const metadata = await extractMobileMetadata(file, book.fileType).catch(() => { toast(translate("mobile:metadata.unavailable", { name: file.name })); return {}; });
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
  const { t } = useTranslation();

  return (
    <section className="grid min-h-[calc(100dvh-128px)] place-items-center p-6 text-center">
      <div className="max-w-sm">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded border border-border bg-surface text-primary">
          <BookOpen size={26} />
        </div>
        <h2 className="mt-5 text-lg font-semibold text-foreground">
          {loading ? t("mobile:reader.loadingFile") : t("mobile:reader.fileNotFound")}
        </h2>
        <p className="mt-2 text-sm leading-6 text-foreground-muted">
          {loading
            ? t("mobile:reader.restoringFile")
            : t("mobile:reader.fileDetached", { title: book.title })}
        </p>
        {!loading && (
          <div className="mt-6 grid gap-2">
            <button
              className="h-11 rounded bg-primary px-4 text-sm font-semibold text-primary-foreground"
              onClick={onAttach}
              type="button"
            >
              {t("mobile:reader.relinkFile")}
            </button>
            <button
              className="h-11 rounded border border-border bg-surface px-4 text-sm font-medium text-foreground"
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
  const { t } = useTranslation();
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
  const auth = useMobileAuth();
  const { sessionEmail } = auth;
  const [isOnline, setIsOnline] = useState(() => navigator.onLine !== false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const { selectedBook, selectedBookDataUrl, isEbookReader, setReaderDataUrls, readerFileLoading, selectBook } = useMobileReaderState(state, setState, setActiveTab);
  useBackNavigation(activeTab === "dashboard", () => {
    setActiveTab((current) => (current === "reader" || current === "learning" ? "library" : "dashboard"));
  });
  const [learningBookId, setLearningBookId] = useState<string>();
  const learningBook = learningBookId ? state.books.find((book) => book.id === learningBookId) : undefined;
  const openForLearning = useCallback((bookId: string) => {
    const book = state.books.find((item) => item.id === bookId);
    if (!book || !canReadAsLyceum(book)) {
      toast.error(t("mobile:learning.learningUnsupported"));
      return;
    }
    setState((current) => ({ ...current, selectedBookId: bookId, books: current.books.map((item) => item.id === bookId ? { ...item, lastOpenedAt: new Date().toISOString(), lastReaderMode: "learning" as const } : item) }));
    setLearningBookId(bookId);
    setActiveTab("learning");
  }, [setState, state.books, t]);
  /**
   * Opens a book in the reader it was last read with (.lyceum or its own
   * format). Used by the library and "Continue reading"; switching modes from
   * inside a reader updates the memory.
   */
  const continueBook = useCallback((bookId: string) => {
    const book = state.books.find((item) => item.id === bookId);
    if (book?.lastReaderMode === "learning" && canReadAsLyceum(book)) openForLearning(bookId);
    else selectBook(bookId);
  }, [openForLearning, selectBook, state.books]);
  const updater = useMobileUpdater();
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
    const updateKeyboard = () => setKeyboardOpen(document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement || document.activeElement instanceof HTMLSelectElement);
    document.addEventListener("focusin", updateKeyboard);
    const onFocusOut = () => window.setTimeout(updateKeyboard, 0);
    document.addEventListener("focusout", onFocusOut);
    return () => { document.removeEventListener("focusin", updateKeyboard); document.removeEventListener("focusout", onFocusOut); };
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

    // One book at a time: extracting covers loads each file, and doing every
    // pending book at once (e.g. after importing a folder) exhausted memory.
    void (async () => {
      for (const book of candidates.slice(0, 12)) {
        if (cancelled) return;
        let patch: Partial<MobileBook> = { thumbnailExtractAttempted: true };
        try {
          const url = await resolveMobileBookUrl(book);
          const thumbnailDataUrl = url ? await extractThumbnailFromDataUrl(url, book.fileType) : null;
          if (thumbnailDataUrl) patch = await persistExtractedBookThumbnail(book, thumbnailDataUrl);
        } catch {
          /* keep the attempt flag so a broken file is not retried forever */
        }
        if (cancelled) return;
        setState((current) => ({
          ...current,
          books: current.books.map((item) => (item.id === book.id ? { ...item, ...patch } : item)),
        }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [setState, state.books]);

  const { fileInputRef, importControllersRef, importJobs, setImportJobs, updateImportJob, importFiles, openFileImporter, importReceivedFile } = useMobileImport({ stateRef, repositoryReady, setState, setReaderDataUrls, setActiveTab, folderId: libraryQuery.folderId, extractThumbnailPatch });
  // Device sync: receive books from the user's other devices and merge vocabulary.
  const importReceivedFileRef = useRef(importReceivedFile);
  importReceivedFileRef.current = importReceivedFile;
  useEffect(() => {
    if (!repositoryReady || !sessionEmail) return undefined;
    let stop: (() => void) | undefined;
    let cancelled = false;
    void import("./learning/learningRuntime").then(({ getMobileLearningClient }) => {
      if (cancelled) return;
      stop = startDeviceSync({
        platform: "mobile",
        learningClient: getMobileLearningClient,
        receiveBook: (file) => importReceivedFileRef.current(file),
      });
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [repositoryReady, sessionEmail]);

  const importSourceEntries = async (
    entries: SourceImportEntry[],
    requestedSourceId?: string,
    detectedName = translate("mobile:imports.folderImported"),
    nativeUri?: string,
  ) => {
    const supportedEntries = entries.filter((entry) => inferFileType({ name: entry.name, type: entry.mimeType } as File));
    if (!supportedEntries.length) {
      toast.error(t("mobile:imports.folderHasNoBooks"));
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
          message: t("mobile:imports.readingFolder"),
        }]);
        const file = await entry.loadFile(sourceController.signal, (loaded, total) => {
          updateImportJob(sourceJobId!, { progress: total > 0 ? Math.min(58, Math.round((loaded / total) * 58)) : 12 });
        });
        const contentHash = await hashMobileFile(file);
        const dataUrl = await readFileAsDataUrl(file, {
          signal: sourceController.signal,
          onProgress: (loaded, total) => updateImportJob(sourceJobId!, {
            progress: total > 0 ? 58 + Math.round((loaded / total) * 22) : 68,
            message: t("mobile:imports.preparingBook"),
          }),
        });
        updateImportJob(sourceJobId, {
          progress: 84,
          status: "processing",
          message: t("mobile:imports.savingToLibrary"),
        });
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
          updateImportJob(sourceJobId, {
            progress: 100,
            status: "done",
            message: t("mobile:imports.updated"),
          });
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
        updateImportJob(sourceJobId, {
          progress: 100,
          status: "done",
          message: t("mobile:imports.imported"),
        });
      } catch (error) {
        const cancelled = sourceController?.signal.aborted || (error instanceof Error && error.message.toLowerCase().includes("cancel"));
        if (sourceJobId) {
          updateImportJob(sourceJobId, {
            status: cancelled ? "cancelled" : "error",
            message: cancelled
              ? t("mobile:imports.cancelled")
              : error instanceof Error
                ? error.message
                : t("mobile:imports.importFailed", { name: entry.name }),
          });
        }
        if (!cancelled) {
          toast.error(
            error instanceof Error
              ? error.message
              : t("mobile:imports.importFailed", { name: entry.name }),
          );
        }
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
    toast.success(translate("mobile:library.importSummary", { added: imported.length, updated: updated.size }));
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
      toast.error(
        error instanceof Error ? error.message : t("mobile:imports.folderConnectFailed"),
      );
    }
  };

  const attachFileToSelectedBook = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file || !selectedBook) return;

    try {
      const dataUrl = await readFileAsDataUrl(file);
      const fileType = inferFileType(file);
      if (!fileType) throw new Error(t("mobile:imports.usePdfEpubOrTxt"));
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
      toast.success(t("mobile:imports.fileRelinked"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("mobile:imports.relinkFailed"));
    } finally {
      if (replaceFileInputRef.current) replaceFileInputRef.current.value = "";
    }
  };

  const createManagedFolder = (name: string, parentId?: string) => {
    const safeName = sanitizeFolderName(name);
    if (!safeName) return;
    setState((current) => {
      if (
        current.folders.some(
          (folder) =>
            folder.parentId === parentId && normalizeCase(folder.name) === normalizeCase(safeName),
        )
      ) {
        toast.error(t("mobile:folders.nameTaken"));
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
        toast.error(t("mobile:folders.cannotMoveIntoItself"));
        return current;
      }
      if (
        current.folders.some(
          (item) =>
            item.id !== folderId &&
            item.parentId === parentId &&
            normalizeCase(item.name) === normalizeCase(folder.name),
        )
      ) {
        toast.error(t("mobile:folders.nameTakenInTarget"));
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
    if (patches.size) toast.success(translate("mobile:library.booksMoved", { count: patches.size }));
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
    toast.success(translate("mobile:library.booksRemoved", { count: targets.length }));
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

  if (!repositoryReady || !auth.authReady) return <MobileStartupSkeleton />;

  return (
    <div className="lyceum-app min-h-screen bg-background text-foreground">
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 4200,
          style: {
            background: "var(--surface)",
            border: "1px solid var(--border)",
            color: "var(--foreground)",
            borderRadius: "4px",
          },
        }}
      />
      {!isOnline ? (
        <div className="fixed inset-x-0 top-0 z-50 mx-auto max-w-[480px] bg-warning px-4 py-2 text-center text-xs font-semibold text-warning-foreground" role="status">
          {t("mobile:offline.banner")}
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
        <aside className="fixed inset-x-3 bottom-[calc(82px+env(safe-area-inset-bottom))] z-[80] mx-auto max-w-[454px] rounded-2xl border border-border-strong bg-overlay p-3 shadow-2xl shadow-shadow backdrop-blur-xl" aria-label={t("mobile:imports.title")}>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">
              {t("mobile:imports.heading")}
            </p>
            <button className="grid h-8 w-8 place-items-center rounded-full bg-surface text-foreground-muted" onClick={() => setImportJobs((current) => current.filter((job) => job.status === "reading" || job.status === "processing"))} aria-label={t("mobile:imports.clearFinished")} type="button"><X size={15} /></button>
          </div>
          <div className="max-h-52 space-y-2 overflow-y-auto">
            {importJobs.map((job) => {
              const running = job.status === "reading" || job.status === "processing";
              return <div key={job.id} className="rounded-xl bg-surface p-3">
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-foreground">{job.name}</p><p className={`mt-0.5 text-[11px] ${job.status === "error" ? "text-destructive" : job.status === "done" ? "text-primary" : "text-foreground-subtle"}`}>{job.message || t("mobile:imports.preparing")}</p></div>
                  {running ? <button className="h-8 rounded-lg bg-surface-muted px-3 text-xs font-semibold text-foreground" onClick={() => importControllersRef.current.get(job.id)?.abort()} type="button">{t("mobile:imports.cancelJob")}</button> : <span className="text-xs tabular-nums text-foreground-subtle">{job.status === "done" ? "100%" : job.status === "cancelled" ? t("mobile:imports.cancelled") : t("mobile:imports.failed")}</span>}
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-muted"><div className={`h-full rounded-full transition-all duration-200 ${job.status === "error" ? "bg-destructive" : job.status === "cancelled" ? "bg-border-strong" : "bg-primary"}`} style={{ width: job.progress + "%" }} /></div>
              </div>;
            })}
          </div>
        </aside>
      )}

      <div className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col bg-background">
        {activeTab === "library" || activeTab === "learning" || (activeTab === "reader" && isEbookReader) ? null : (
          <header
            className={
              activeTab === "reader" && isEbookReader
                ? "sticky top-0 z-20 border-b border-border bg-overlay px-3 pb-2 pt-[max(10px,env(safe-area-inset-top))] backdrop-blur"
                : "sticky top-0 z-20 border-b border-border bg-overlay px-4 pb-3 pt-[max(14px,env(safe-area-inset-top))] backdrop-blur"
            }
          >
            <div className="flex items-center justify-between">
              <div>
                {!(activeTab === "reader" && isEbookReader) && (
                  <p className="text-xs font-medium uppercase tracking-wide text-primary">Lyceum Mobile</p>
                )}
                <h1 className={activeTab === "reader" && isEbookReader ? "text-base font-semibold text-foreground" : "mt-1 text-xl font-semibold text-foreground"}>
                  {activeTab === "reader"
                    ? t("mobile:reader.title")
                    : t(tabs.find((tab) => tab.id === activeTab)?.labelKey ?? "mobile:tabs.dashboard")}
                </h1>
              </div>
              <button
                className="grid h-10 w-10 place-items-center rounded border border-border bg-surface text-foreground"
                onClick={() => setActiveTab("profile")}
                type="button"
                aria-label={t("mobile:profile.openAriaLabel")}
              >
                <Settings size={18} />
              </button>
            </div>
          </header>
        )}

        <main className={`flex-1 overflow-y-auto ${activeTab === "library" || activeTab === "learning" || (activeTab === "reader" && isEbookReader) || keyboardOpen ? "" : "pb-[calc(84px+env(safe-area-inset-bottom))]"}`}>
          <Suspense fallback={<div className="grid min-h-[55dvh] place-items-center text-sm text-foreground-subtle">{t("mobile:startup.loading")}</div>}>
          {activeTab === "dashboard" && (
            <MobileDashboardScreen
              sessionEmail={sessionEmail}
              onOpenProfile={() => setActiveTab("profile")}
              onOpenRegister={() => {
                setReadingSeedBookId(undefined);
                setActiveTab("readings");
              }}
              onOpenLeaderboard={() => setActiveTab("leaderboard")}
              books={state.books}
              onOpenBook={continueBook}
            />
          )}

          {activeTab === "readings" && (
            <MobileReadingEntryScreen
              key={`${sessionEmail || "guest"}:${readingSeedBookId || "manual-reading"}`}
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
              onOpenBook={continueBook}
              onOpenForLearning={openForLearning}
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
          {activeTab === "learning" && learningBook && (
            <MobileLearningReader
              key={learningBook.id}
              book={learningBook}
              loadBytes={() => loadMobileBookBytes(learningBook)}
              onBack={() => setActiveTab("library")}
              onOpenOriginal={() => selectBook(learningBook.id)}
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
                    onRegister={() => { setReadingSeedBookId(selectedBook.id); setActiveTab("readings"); }}
                    onLearn={() => openForLearning(selectedBook.id)}
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
                      title={t("mobile:reader.noBookSelected")}
                      body={t("mobile:reader.noBookSelectedBody")}
                      action={
                        <button
                          className="rounded bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
                          onClick={() => setActiveTab("library")}
                          type="button"
                        >
                          {t("mobile:reader.openLibrary")}
                        </button>
                      }
                    />
                  ) : (
                    <>
                      {selectedBook.fileType !== "pdf" && <div className={isEbookReader ? "rounded bg-surface/70 px-3 py-2" : "rounded border border-border bg-surface p-4"}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className={isEbookReader ? "truncate text-sm font-semibold text-foreground" : "truncate text-lg font-semibold text-foreground"}>{selectedBook.title}</p>
                            <p className="mt-1 truncate text-xs text-foreground-subtle">{selectedBook.author || selectedBook.fileName}</p>
                          </div>
                          <button
                            className="grid h-9 w-9 place-items-center rounded bg-background text-foreground"
                            onClick={() => toggleFavorite(selectedBook.id)}
                            type="button"
                            aria-label={t("mobile:book.favorite")}
                          >
                            <Heart
                              className={selectedBook.isFavorite ? "fill-primary text-primary" : ""}
                              size={18}
                            />
                          </button>
                        </div>

                        <div className="mt-3 rounded bg-background px-3 py-2 text-xs text-foreground-muted">
                          {selectedBook.fileType.toUpperCase()} · {getProgress(selectedBook)}%
                        </div>
                      </div>}

                    <div className={isEbookReader ? "overflow-hidden bg-surface" : "overflow-hidden rounded border border-border bg-surface"}>
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
                            onRegister={() => { setReadingSeedBookId(selectedBook.id); setActiveTab("readings"); }}
                            onLearn={() => openForLearning(selectedBook.id)}
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
                            onLearn={() => openForLearning(selectedBook.id)}
                            onProgress={(progressPercent, textOffset) => setState((current) => updateBook(current, selectedBook.id, {
                              textOffset,
                              textScrollPercent: progressPercent,
                              progressPercent,
                              lastOpenedAt: new Date().toISOString(),
                            }))}
                          />
                        ) : (
                          <div className="min-h-[360px] p-5 text-sm leading-7 text-foreground">
                            <p>
                              {t("mobile:book.mobileReady")} {t("mobile:book.mobileReadyBody")}
                            </p>
                          </div>
                        )}
                      </div>

                      {!isEbookReader && (
                      <div className="rounded border border-border bg-surface p-4">
                        <button
                          className="mb-4 flex h-11 w-full items-center justify-center gap-2 rounded bg-primary text-sm font-semibold text-primary-foreground"
                          onClick={() => {
                            setReadingSeedBookId(selectedBook.id);
                            setActiveTab("readings");
                          }}
                          type="button"
                        >
                          <NotebookPen size={17} />
                          {t("mobile:book.logReading")}
                        </button>
                        <MobileFieldFrame label={t("mobile:book.category")} htmlFor="reader-book-category">
                        <MobileSelect
                          id="reader-book-category"
                          icon={Library}
                          value={selectedBook.category}
                          onChange={(event) => setBookCategory(selectedBook.id, event.target.value)}
                        >
                          {state.categories.map((category) => (
                            <option key={category}>{category}</option>
                          ))}
                        </MobileSelect>
                        </MobileFieldFrame>
                        <label className="mt-4 block text-sm font-medium text-foreground">
                          {t("mobile:book.notes")}
                        </label>
                        <textarea
                          className="mt-2 min-h-24 w-full resize-none rounded border border-border bg-background p-3 text-sm"
                          value={selectedBook.notes || ""}
                          onChange={(event) => saveBookNotes(selectedBook.id, event.target.value)}
                          placeholder={t("mobile:book.notesPlaceholder")}
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
            <MobileSettingsScreen
              auth={auth}
              updater={updater}
              isOnline={isOnline}
              state={state}
              setState={setState}
              onOpenLeaderboard={() => setActiveTab("leaderboard")}
            />
          )}
          </Suspense>
        </main>

        {(activeTab === "reader" && isEbookReader) || activeTab === "learning" || keyboardOpen ? null : (
          <nav aria-label={t("mobile:account.primaryNavAriaLabel")} className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[480px] overflow-hidden rounded-t-2xl border border-b-0 border-border/[0.06] bg-overlay px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 shadow-[0_-12px_35px_var(--shadow)] backdrop-blur-xl">
            <div className="grid grid-cols-4 gap-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-semibold transition active:scale-95 ${
                      active ? "bg-primary-muted text-primary" : "text-foreground-muted"
                    }`}
                    aria-current={active ? "page" : undefined}
                    onClick={() => {
                      if (tab.id === "readings") {
                        setReadingSeedBookId(undefined);
                      }
                      setActiveTab(tab.id);
                    }}
                    type="button"
                  >
                    <Icon size={21} />
                    <span>{t(tab.labelKey)}</span>
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
