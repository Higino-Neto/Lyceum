import {
  createContext,
  useCallback,
  useContext,
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
export type ConversionQueueStatus = "pending" | "running" | "done" | "error";

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
  pdfIncludeToc: true,
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
  clearLogs: () => void;
}

interface ConversionApi {
  convertBookFile: (
    filePath: string,
    targetFormat: ConversionOutputFormat,
    requestOptions?: { conversionOptions?: LyceumConversionOptions; outputDirectory?: string },
  ) => Promise<{
    success: boolean;
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
         candidate.id === itemId
           ? { ...candidate, progress: Math.min(99, Math.max(0, progress)), message: message || candidate.message }
           : candidate,
       ),
     );
   }, []);

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
         message: `Iniciando ${item.sourceFormat.toUpperCase()} para ${item.targetFormat.toUpperCase()}`,
         detail: item.book.filePath,
       });

       try {
         updateProgress(item.id, 28, "Analisando estrutura e recursos...");
         addLog({ itemId: item.id, level: "info", message: "Pipeline de conversao em execucao" });
         const requestOptions = {
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
             message: `Conversao concluida em ${(Math.max(0, Date.now() - startedAt) / 1000).toFixed(1)}s`,
             detail: result.outputPath,
           });
           warnings.forEach((warning) => addLog({ itemId: item.id, level: "warning", message: warning }));
         } else {
           addLog({ itemId: item.id, level: "error", message: result?.error || "Erro ao converter" });
         }
       } catch (error) {
         const message = error instanceof Error ? error.message : "Erro ao converter";
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
         addLog({ itemId: item.id, level: "error", message });
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
    }),
    [
      addDraftBooks,
      clearDraft,
      clearLogs,
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
