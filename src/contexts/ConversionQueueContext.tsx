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

export type ConversionOutputFormat = "epub" | "pdf" | "txt" | "html" | "azw3" | "kfx";
export type ConversionProfile = "ereader" | "light" | "compatible";
export type ConversionQueueStatus = "pending" | "running" | "done" | "error";

export interface ConversionQueueItem {
  id: string;
  book: BookWithThumbnail;
  sourceFormat: string;
  targetFormat: ConversionOutputFormat;
  profile: ConversionProfile;
  status: ConversionQueueStatus;
  message: string;
  outputPath?: string;
  outputSize?: number;
  progress: number;
  startedAt?: number;
  finishedAt?: number;
}

export interface ConversionOptions {
  preserveCover: boolean;
  preserveMetadata: boolean;
  optimizeImages: boolean;
  generateIndex: boolean;
  adjustForEreader: boolean;
  simplifiedOutput: boolean;
}

export const defaultConversionOptions: ConversionOptions = {
  preserveCover: true,
  preserveMetadata: true,
  optimizeImages: true,
  generateIndex: true,
  adjustForEreader: true,
  simplifiedOutput: false,
};

export function getOptionsForProfile(profile: ConversionProfile): ConversionOptions {
  const base = { ...defaultConversionOptions };
  if (profile === "light") {
    base.generateIndex = false;
    base.simplifiedOutput = true;
  } else if (profile === "compatible") {
    base.optimizeImages = false;
    base.adjustForEreader = false;
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
  isRunning: boolean;
  prepareBooks: (books: BookWithThumbnail[]) => void;
  clearDraft: () => void;
  startConversion: (options: ConversionRunOptions) => void;
  startConversionWithConfigs: (configs: BookConversionConfig[]) => void;
}

interface ConversionApi {
  convertBookFile: (
    filePath: string,
    targetFormat: ConversionOutputFormat,
  ) => Promise<{ success: boolean; outputPath?: string; error?: string }>;
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
  const [isRunning, setIsRunning] = useState(false);
  const pendingRef = useRef<ConversionQueueItem[]>([]);
  const processingRef = useRef(false);

   const updateProgress = useCallback((itemId: string, progress: number) => {
     setQueue((current) =>
       current.map((candidate) =>
         candidate.id === itemId
           ? { ...candidate, progress: Math.min(99, Math.max(0, progress)) }
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

       setQueue((current) =>
         current.map((candidate) =>
           candidate.id === item.id
             ? {
                 ...candidate,
                 status: "running",
                 message: "Convertendo em segundo plano...",
                 progress: 0,
                 startedAt: Date.now(),
               }
             : candidate,
         ),
       );

       const fileSize = item.book.fileSize || 1000000;
       const estimatedDuration = Math.max(2000, Math.min(15000, fileSize / 100));
       const stepInterval = estimatedDuration / 20;
       let currentProgress = 0;

       const progressInterval = setInterval(() => {
         const increment = Math.random() * 8 + 3;
         currentProgress = Math.min(currentProgress + increment, 95);
         updateProgress(item.id, Math.round(currentProgress));
       }, stepInterval);

       try {
         const result =
           item.book.fileHash.startsWith("usb:") || item.book.fileHash.startsWith("mtp:")
             ? await (window.api as unknown as ConversionApi).convertBookFile(
                 item.book.filePath,
                 item.targetFormat,
               )
             : await window.api.convertBook(item.book.fileHash, item.targetFormat);

         clearInterval(progressInterval);

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
                   progress: result?.success ? 100 : 0,
                   finishedAt: Date.now(),
                 }
               : candidate,
           ),
         );
       } catch (error) {
         clearInterval(progressInterval);
         setQueue((current) =>
           current.map((candidate) =>
             candidate.id === item.id
               ? {
                   ...candidate,
                   status: "error",
                   message: "Erro ao converter",
                   progress: 0,
                   finishedAt: Date.now(),
                 }
               : candidate,
           ),
         );
       }
     }

     processingRef.current = false;
     setIsRunning(false);
   }, [updateProgress]);

  const prepareBooks = useCallback((books: BookWithThumbnail[]) => {
    setDraftBooks(books);
  }, []);

  const clearDraft = useCallback(() => {
    setDraftBooks([]);
  }, []);

  const createQueueItem = useCallback(
    ({ book, targetFormat, profile }: BookConversionConfig): ConversionQueueItem => {
      const sourceFormat = getBookSourceFormat(book);
      const convertible = canConvertBook(book, targetFormat);

       return {
         id: createQueueId(book, targetFormat),
         book,
         sourceFormat,
         targetFormat,
         profile,
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
      pendingRef.current.push(...runnable);
      void processQueue();
    },
    [createQueueItem, processQueue],
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
      isRunning,
      prepareBooks,
      clearDraft,
      startConversion,
      startConversionWithConfigs,
    }),
    [clearDraft, draftBooks, isRunning, prepareBooks, queue, startConversion, startConversionWithConfigs],
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
