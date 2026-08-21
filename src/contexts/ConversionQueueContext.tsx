import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import toast from "react-hot-toast";
import { BookWithThumbnail } from "../types/LibraryTypes";
import type { LyceumConversionOptions } from "../lib/lyceum/schema/types";

export type ConversionOutputFormat = "epub" | "pdf" | "txt" | "html" | "azw3" | "kfx" | "lyceum";
export type ConversionProfile = "ereader" | "light" | "compatible";
export type ConversionQueueStatus = "pending" | "running" | "done" | "error" | "canceled";

export interface ConversionQueueItem {
  id: string;
  book: BookWithThumbnail;
  sourceFormat: string;
  targetFormat: ConversionOutputFormat;
  profile: ConversionProfile;
  options: ConversionOptions;
  status: ConversionQueueStatus;
  message: string;
  outputPath?: string;
  outputHash?: string;
  thumbnailPath?: string;
  outputSize?: number;
  report?: Record<string, unknown> & { warnings?: string[] };
  progress: number;
  startedAt?: number;
  finishedAt?: number;
}

export interface ConversionLogEntry {
  id: string;
  itemId?: string;
  timestamp: number;
  level: "info" | "success" | "warning" | "error";
  message: string;
  detail?: string;
}

export interface ConversionOptions extends LyceumConversionOptions {
  preserveCover: boolean;
  preserveMetadata: boolean;
  optimizeImages: boolean;
  generateIndex: boolean;
  pdfPageSize: "A4" | "A5" | "Letter" | "Legal";
  pdfMarginTopMm: number;
  pdfMarginBottomMm: number;
  pdfMarginLeftMm: number;
  pdfMarginRightMm: number;
  pdfLineHeight: number;
  pdfParagraphSpacingEm: number;
  pdfFontSizePt: number;
  pdfChapterPageBreaks: boolean;
  pdfIncludeToc: boolean;
  pdfGenerateOutline: boolean;
  epubLayout: "auto" | "reflow" | "fixed-layout";
  epubLineHeight: number;
  epubParagraphSpacingEm: number;
  kindleProfile: "legacy-paperwhite" | "kindle-compatible" | "modern-kindle" | "scribe";
  txtChapterHeadings: boolean;
  txtLineEnding: "lf" | "crlf";
  htmlIncludeToc: boolean;
}

export const defaultConversionOptions: ConversionOptions = {
  preserveCover: true,
  preserveMetadata: true,
  optimizeImages: true,
  generateIndex: true,
  pdfPageSize: "A4",
  pdfMarginTopMm: 16,
  pdfMarginBottomMm: 18,
  pdfMarginLeftMm: 15,
  pdfMarginRightMm: 15,
  pdfLineHeight: 1.45,
  pdfParagraphSpacingEm: 0.85,
  pdfFontSizePt: 11,
  pdfChapterPageBreaks: true,
  pdfIncludeToc: false,
  pdfGenerateOutline: true,
  epubLayout: "auto",
  epubLineHeight: 1.45,
  epubParagraphSpacingEm: 0.9,
  kindleProfile: "kindle-compatible",
  txtChapterHeadings: true,
  txtLineEnding: "crlf",
  htmlIncludeToc: true,
};

export function getOptionsForProfile(profile: ConversionProfile): ConversionOptions {
  const base = { ...defaultConversionOptions };
  if (profile === "light") {
    base.generateIndex = false;
    base.optimizeImages = true;
    base.epubLayout = "reflow";
  } else if (profile === "compatible") {
    base.optimizeImages = false;
    base.epubLayout = "fixed-layout";
  }
  return base;
}

export interface BookConversionConfig {
  book: BookWithThumbnail;
  targetFormat: ConversionOutputFormat;
  profile: ConversionProfile;
  options: ConversionOptions;
  outputPath?: string;
}

interface ConversionRunOptions {
  books: BookWithThumbnail[];
  targetFormat: ConversionOutputFormat;
  profile: ConversionProfile;
}

interface ConversionQueueContextValue {
  draftBooks: BookWithThumbnail[];
  queue: ConversionQueueItem[];
  logs: ConversionLogEntry[];
  isRunning: boolean;
  prepareBooks: (books: BookWithThumbnail[]) => void;
  addDraftBooks: (books: BookWithThumbnail[]) => void;
  removeDraftBook: (fileHash: string) => void;
  clearDraft: () => void;
  startConversion: (options: ConversionRunOptions) => void;
  startConversionWithConfigs: (configs: BookConversionConfig[]) => void;
  cancelConversion: (itemId: string) => Promise<void>;
  deleteConversion: (itemId: string) => Promise<boolean>;
  clearLogs: () => void;
}

interface ConversionApi {
  convertBookFile: (
    filePath: string,
    targetFormat: ConversionOutputFormat,
    requestOptions?: { jobId?: string; conversionOptions?: LyceumConversionOptions; outputDirectory?: string },
  ) => Promise<{
    success: boolean;
    canceled?: boolean;
    outputPath?: string;
    fileHash?: string;
    fileSize?: number;
    thumbnailPath?: string;
    report?: Record<string, unknown> & { warnings?: string[] };
    error?: string;
  }>;
}

const supportedInputs = new Set(["epub", "pdf", "txt", "html", "cbz"]);
const ConversionQueueContext = createContext<ConversionQueueContextValue | null>(null);

function inferFormat(book: BookWithThumbnail): string {
  return (book.fileType || book.filePath.split(".").pop() || "").toLowerCase();
}

export function canConvertBook(
  book: BookWithThumbnail,
  targetFormat: ConversionOutputFormat,
): boolean {
  const sourceFormat = inferFormat(book);
  return supportedInputs.has(sourceFormat) && sourceFormat !== targetFormat;
}

export function getBookSourceFormat(book: BookWithThumbnail): string {
  return inferFormat(book) || "arquivo";
}

function createQueueId(book: BookWithThumbnail, targetFormat: ConversionOutputFormat) {
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
  return `${book.fileHash}:${targetFormat}:${random}`;
}

export function ConversionQueueProvider({ children }: { children: ReactNode }) {
  const [draftBooks, setDraftBooks] = useState<BookWithThumbnail[]>([]);
  const [queue, setQueue] = useState<ConversionQueueItem[]>([]);
  const [logs, setLogs] = useState<ConversionLogEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const pendingRef = useRef<ConversionQueueItem[]>([]);
  const processingRef = useRef(false);
  const canceledRef = useRef(new Set<string>());
  const progressBucketsRef = useRef(new Map<string, number>());

  const addLog = useCallback((entry: Omit<ConversionLogEntry, "id" | "timestamp">) => {
    setLogs((current) => [...current.slice(-499), {
      ...entry,
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      timestamp: Date.now(),
    }]);
  }, []);

   const updateProgress = useCallback((itemId: string, progress: number, message?: string) => {
     setQueue((current) =>
       current.map((candidate) =>
         candidate.id === itemId && ["pending", "running"].includes(candidate.status)
           ? { ...candidate, progress: Math.min(99, Math.max(candidate.progress, progress)), message: message || candidate.message }
           : candidate,
       ),
     );
   }, []);

  useEffect(() => {
    if (!window.api?.onConversionProgress) return;
    return window.api.onConversionProgress(({ jobId, progress, message }) => {
      const normalized = Math.min(1, Math.max(0, progress));
      const percentage = Math.round(10 + normalized * 82);
      updateProgress(jobId, percentage, message);
      const bucket = Math.floor(percentage / 10);
      const previousBucket = progressBucketsRef.current.get(jobId) ?? -1;
      if (message && bucket > previousBucket && !/^(?:Starting|Finished)\b/i.test(message)) {
        progressBucketsRef.current.set(jobId, bucket);
        addLog({ itemId: jobId, level: "info", message });
      }
    });
  }, [addLog, updateProgress]);

   const processQueue = useCallback(async () => {
     if (processingRef.current) return;
     processingRef.current = true;
     setIsRunning(true);

     while (pendingRef.current.length > 0) {
       const item = pendingRef.current.shift();
       if (!item) continue;
       const startedAt = Date.now();

       setQueue((current) =>
         current.map((candidate) =>
           candidate.id === item.id
             ? {
                 ...candidate,
                 status: "running",
                 message: "Preparando arquivo...",
                 progress: 10,
                 startedAt,
               }
             : candidate,
         ),
       );
       addLog({
         itemId: item.id,
         level: "info",
         message: `${item.book.title}: iniciando ${item.sourceFormat.toUpperCase()} para ${item.targetFormat.toUpperCase()}`,
         detail: item.book.filePath,
       });

       try {
         updateProgress(item.id, 28, "Analisando estrutura e recursos...");
         addLog({ itemId: item.id, level: "info", message: `${item.book.title}: pipeline de conversao em execucao` });
         const requestOptions = {
           jobId: item.id,
           conversionOptions: item.options,
           outputDirectory: item.outputPath,
         };
         const result =
           item.book.fileHash.startsWith("usb:") || item.book.fileHash.startsWith("mtp:")
             ? await (window.api as unknown as ConversionApi).convertBookFile(
                 item.book.filePath,
                 item.targetFormat,
                 requestOptions,
               )
             : await window.api.convertBook(item.book.fileHash, item.targetFormat, requestOptions);

         if (canceledRef.current.has(item.id) || result?.canceled) {
           canceledRef.current.delete(item.id);
           setQueue((current) => current.map((candidate) => candidate.id === item.id
             ? { ...candidate, status: "canceled", message: "Cancelada", progress: 0, finishedAt: Date.now() }
             : candidate));
           continue;
         }

         updateProgress(item.id, 92, "Validando arquivo de saida...");
         const report = result?.report;
         const warnings = Array.isArray(report?.warnings) ? report.warnings : [];

         setQueue((current) =>
           current.map((candidate) =>
             candidate.id === item.id
               ? {
                   ...candidate,
                   status: result?.success ? "done" : "error",
                   message: result?.success
                     ? "Concluído"
                     : result?.error || "Erro ao converter",
                   outputPath: result?.outputPath,
                   outputHash: result?.fileHash,
                   outputSize: result?.fileSize,
                   thumbnailPath: result?.thumbnailPath,
                   report,
                   progress: result?.success ? 100 : 0,
                   finishedAt: Date.now(),
                 }
               : candidate,
           ),
         );
         if (result?.success) {
           addLog({
             itemId: item.id,
             level: "success",
             message: `${item.book.title}: conversao concluida em ${(Math.max(0, Date.now() - startedAt) / 1000).toFixed(1)}s`,
             detail: result.outputPath,
           });
           warnings.forEach((warning) => addLog({ itemId: item.id, level: "warning", message: `${item.book.title}: ${warning}` }));
         } else {
           addLog({ itemId: item.id, level: "error", message: `${item.book.title}: ${result?.error || "Erro ao converter"}` });
         }
       } catch (error) {
         const message = error instanceof Error ? error.message : "Erro ao converter";
         if (canceledRef.current.has(item.id) || (error instanceof DOMException && error.name === "AbortError")) {
           canceledRef.current.delete(item.id);
           setQueue((current) => current.map((candidate) => candidate.id === item.id
             ? { ...candidate, status: "canceled", message: "Cancelada", progress: 0, finishedAt: Date.now() }
             : candidate));
           continue;
         }
         setQueue((current) =>
           current.map((candidate) =>
             candidate.id === item.id
               ? {
                   ...candidate,
                   status: "error",
                   message,
                   progress: 0,
                   finishedAt: Date.now(),
                 }
               : candidate,
           ),
         );
         addLog({ itemId: item.id, level: "error", message: `${item.book.title}: ${message}` });
       }
     }

     processingRef.current = false;
     setIsRunning(false);
   }, [addLog, updateProgress]);

  const prepareBooks = useCallback((books: BookWithThumbnail[]) => {
    setDraftBooks(books);
  }, []);

  const addDraftBooks = useCallback((books: BookWithThumbnail[]) => {
    setDraftBooks((current) => {
      const next = new Map(current.map((book) => [book.fileHash, book]));
      books.forEach((book) => next.set(book.fileHash, book));
      return Array.from(next.values());
    });
  }, []);

  const removeDraftBook = useCallback((fileHash: string) => {
    setDraftBooks((current) => current.filter((book) => book.fileHash !== fileHash));
  }, []);

  const clearDraft = useCallback(() => {
    setDraftBooks([]);
  }, []);

  const clearLogs = useCallback(() => setLogs([]), []);

  const cancelConversion = useCallback(async (itemId: string) => {
    const item = queue.find((candidate) => candidate.id === itemId);
    if (!item || !["pending", "running"].includes(item.status)) return;
    const pendingIndex = pendingRef.current.findIndex((item) => item.id === itemId);
    const wasPending = pendingIndex >= 0;
    if (pendingIndex >= 0) pendingRef.current.splice(pendingIndex, 1);
    canceledRef.current.add(itemId);
    setQueue((current) => current.map((candidate) => {
      if (candidate.id !== itemId || !["pending", "running"].includes(candidate.status)) return candidate;
      return { ...candidate, status: "canceled", message: "Cancelada", progress: 0, finishedAt: Date.now() };
    }));
    addLog({ itemId, level: "warning", message: `${item.book.title}: cancelamento solicitado` });
    await window.api.cancelConversion(itemId).catch(() => ({ success: false, active: false }));
    if (wasPending) canceledRef.current.delete(itemId);
  }, [addLog, queue]);

  const deleteConversion = useCallback(async (itemId: string) => {
    const item = queue.find((candidate) => candidate.id === itemId);
    if (!item) return false;
    if (item.status === "done" && (!item.outputHash || !item.outputPath)) {
      toast.error("O resultado da conversao nao possui caminho verificavel");
      return false;
    }
    if (item.status === "done" && item.outputHash && item.outputPath) {
      const result = await window.api.deleteConvertedOutput(item.outputPath, item.outputHash);
      if (!result.success) {
        toast.error(result.error || "Nao foi possivel excluir o arquivo convertido");
        addLog({ itemId, level: "error", message: `${item.book.title}: falha ao excluir o arquivo convertido`, detail: result.error });
        return false;
      }
    }
    pendingRef.current = pendingRef.current.filter((candidate) => candidate.id !== itemId);
    canceledRef.current.delete(itemId);
    progressBucketsRef.current.delete(itemId);
    setQueue((current) => current.filter((candidate) => candidate.id !== itemId));
    setLogs((current) => current.filter((entry) => entry.itemId !== itemId));
    if (item.status === "done") toast.success("Arquivo convertido excluido");
    return true;
  }, [addLog, queue]);

  const createQueueItem = useCallback(
    ({ book, targetFormat, profile, options, outputPath }: BookConversionConfig): ConversionQueueItem => {
      const sourceFormat = getBookSourceFormat(book);
      const convertible = canConvertBook(book, targetFormat);

       return {
         id: createQueueId(book, targetFormat),
         book,
         sourceFormat,
         targetFormat,
         profile,
         options,
         outputPath,
         status: convertible ? "pending" : "error",
         message: convertible
           ? "Aguardando na fila"
           : supportedInputs.has(sourceFormat)
             ? "Origem e saída têm o mesmo formato"
             : "Formato de origem não suportado pelo conversor atual",
         progress: 0,
       };
    },
    [],
  );

  const startConversionWithConfigs = useCallback(
    (configs: BookConversionConfig[]) => {
      const items = configs.map(createQueueItem);

      const runnable = items.filter((item) => item.status === "pending");
      if (runnable.length === 0) {
        toast.error("Nenhum livro selecionado pode ser convertido para esse formato");
      } else {
        toast.success(`${runnable.length} conversão${runnable.length !== 1 ? "ões" : ""} adicionada${runnable.length !== 1 ? "s" : ""} à fila`);
      }

      setQueue((current) => [...items, ...current]);
      items.forEach((item) => addLog({
        itemId: item.id,
        level: item.status === "pending" ? "info" : "error",
        message: item.message,
        detail: `${item.book.title} -> ${item.targetFormat.toUpperCase()}`,
      }));
      pendingRef.current.push(...runnable);
      void processQueue();
    },
    [addLog, createQueueItem, processQueue],
  );

  const startConversion = useCallback(
    ({ books, targetFormat, profile }: ConversionRunOptions) => {
      const configs: BookConversionConfig[] = books.map((book) => ({
        book,
        targetFormat,
        profile,
        options: getOptionsForProfile(profile),
      }));
      startConversionWithConfigs(configs);
    },
    [startConversionWithConfigs],
  );

  const value = useMemo<ConversionQueueContextValue>(
    () => ({
      draftBooks,
      queue,
      logs,
      isRunning,
      prepareBooks,
      addDraftBooks,
      removeDraftBook,
      clearDraft,
      clearLogs,
      startConversion,
      startConversionWithConfigs,
      cancelConversion,
      deleteConversion,
    }),
    [
      addDraftBooks,
      clearDraft,
      clearLogs,
      cancelConversion,
      deleteConversion,
      draftBooks,
      isRunning,
      logs,
      prepareBooks,
      queue,
      removeDraftBook,
      startConversion,
      startConversionWithConfigs,
    ],
  );

  return (
    <ConversionQueueContext.Provider value={value}>
      {children}
    </ConversionQueueContext.Provider>
  );
}

export function useConversionQueue() {
  const context = useContext(ConversionQueueContext);
  if (!context) {
    throw new Error("useConversionQueue must be used inside ConversionQueueProvider");
  }
  return context;
}
