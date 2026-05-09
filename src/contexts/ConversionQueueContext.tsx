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

export type ConversionOutputFormat = "epub" | "pdf" | "txt" | "html";
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
  startedAt?: number;
  finishedAt?: number;
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
}

interface ConversionApi {
  convertBookFile: (
    filePath: string,
    targetFormat: ConversionOutputFormat,
  ) => Promise<{ success: boolean; outputPath?: string; error?: string }>;
}

const supportedInputs = new Set(["epub", "pdf", "txt", "html"]);
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
                startedAt: Date.now(),
              }
            : candidate,
        ),
      );

      const result =
        item.book.fileHash.startsWith("usb:") || item.book.fileHash.startsWith("mtp:")
          ? await (window.api as unknown as ConversionApi).convertBookFile(
              item.book.filePath,
              item.targetFormat,
            )
          : await window.api.convertBook(item.book.fileHash, item.targetFormat);

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
                finishedAt: Date.now(),
              }
            : candidate,
        ),
      );
    }

    processingRef.current = false;
    setIsRunning(false);
  }, []);

  const prepareBooks = useCallback((books: BookWithThumbnail[]) => {
    setDraftBooks(books);
  }, []);

  const clearDraft = useCallback(() => {
    setDraftBooks([]);
  }, []);

  const startConversion = useCallback(
    ({ books, targetFormat, profile }: ConversionRunOptions) => {
      const items = books.map<ConversionQueueItem>((book) => {
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
        };
      });

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
    [processQueue],
  );

  const value = useMemo<ConversionQueueContextValue>(
    () => ({
      draftBooks,
      queue,
      isRunning,
      prepareBooks,
      clearDraft,
      startConversion,
    }),
    [clearDraft, draftBooks, isRunning, prepareBooks, queue, startConversion],
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
