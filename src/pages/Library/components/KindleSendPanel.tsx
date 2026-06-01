import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  FileText,
  Folder,
  HardDrive,
  RefreshCw,
  Send,
  Smartphone,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { BookWithThumbnail } from "../../../types/LibraryTypes";
import {
  formatFileSize,
  getFileTypeLabel,
  getTitleWithoutExtension,
} from "../utils";

interface KindleSendDevice {
  id: string;
  name: string;
  kind: "kindle" | "kobo" | "ereader";
  isMtp: boolean;
  rootPath?: string;
  devicePath?: string;
  storageName?: string;
  destinationLabel: string;
}

interface KindleSendResultItem {
  fileHash: string;
  title: string;
  success: boolean;
  status: "sent" | "converted" | "skipped" | "error";
  outputName?: string;
  outputPath?: string;
  error?: string;
}

interface KindleSendApi {
  listKindleDevices: () => Promise<KindleSendDevice[]>;
  sendBooksToKindle: (options: {
    deviceId?: string;
    books: Array<{
      fileHash: string;
      filePath: string;
      title: string;
      author?: string | null;
      fileType?: string | null;
      fileName?: string | null;
      publisher?: string | null;
      description?: string | null;
      publishDate?: string | null;
      language?: string | null;
      identifier?: string | null;
      asin?: string | null;
      subject?: string | null;
      series?: string | null;
      seriesIndex?: string | null;
      authorSort?: string | null;
      titleSort?: string | null;
    }>;
    convertToAzw3?: boolean;
    preserveMetadata?: boolean;
    organizeByAuthor?: boolean;
    destination?: string;
  }) => Promise<{
    success: boolean;
    sent: number;
    failed: number;
    device?: KindleSendDevice;
    results: KindleSendResultItem[];
    error?: string;
  }>;
}

interface KindleSendPanelProps {
  books: BookWithThumbnail[];
  onClose: () => void;
  onSent?: () => void;
}

const CONVERTIBLE_TO_AZW3 = new Set(["pdf", "epub", "txt", "html"]);
const DIRECT_KINDLE_FORMATS = new Set(["azw3", "azw", "mobi", "prc", "kfx", "pdf", "txt"]);
const DEFAULT_DESTINATION = "documents/Downloads";

function getApi(): KindleSendApi {
  return window.api as unknown as KindleSendApi;
}

function Toggle({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onChange}
      className={`flex h-5 w-9 flex-shrink-0 items-center rounded-full p-0.5 transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? "bg-green-500" : "bg-zinc-700"
      }`}
      title={checked ? "Ativado" : "Desativado"}
    >
      <span
        className={`h-4 w-4 rounded-full bg-white transition-transform ${
          checked ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function MiniCover({ book }: { book: BookWithThumbnail }) {
  if (book.thumbnail) {
    return (
      <img
        src={book.thumbnail}
        alt={book.title}
        className="h-12 w-8 flex-shrink-0 rounded-sm object-cover"
      />
    );
  }

  return (
    <div className="flex h-12 w-8 flex-shrink-0 items-center justify-center rounded-sm border border-zinc-800 bg-zinc-950 text-zinc-600">
      <FileText size={15} />
    </div>
  );
}

function getBookFormat(book: BookWithThumbnail) {
  return (book.fileType || book.filePath.split(".").pop() || "").toLowerCase();
}

function itemStatusLabel(result?: KindleSendResultItem, shouldConvert?: boolean) {
  if (!result) return shouldConvert ? "Converter para AZW3" : "Pronto";
  if (result.success && result.status === "converted") return "Convertido e enviado";
  if (result.success) return "Enviado";
  return result.error || "Erro no envio";
}

export default function KindleSendPanel({
  books,
  onClose,
  onSent,
}: KindleSendPanelProps) {
  const [devices, setDevices] = useState<KindleSendDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [loadingDevices, setLoadingDevices] = useState(true);
  const [sending, setSending] = useState(false);
  const [convertToAzw3, setConvertToAzw3] = useState(true);
  const [preserveMetadata, setPreserveMetadata] = useState(true);
  const [organizeByAuthor, setOrganizeByAuthor] = useState(false);
  const [results, setResults] = useState<Map<string, KindleSendResultItem>>(new Map());

  const selectedDevice = useMemo(
    () => devices.find((device) => device.id === selectedDeviceId) || devices[0],
    [devices, selectedDeviceId],
  );

  const convertibleCount = useMemo(
    () =>
      books.filter((book) => {
        const format = getBookFormat(book);
        return convertToAzw3 && format !== "azw3" && CONVERTIBLE_TO_AZW3.has(format);
      }).length,
    [books, convertToAzw3],
  );

  const totalSize = useMemo(
    () => books.reduce((sum, book) => sum + (book.fileSize || 0), 0),
    [books],
  );

  const destinationLabel = useMemo(() => {
    const base = selectedDevice?.destinationLabel || DEFAULT_DESTINATION;
    return organizeByAuthor ? `${base}/Autor` : base;
  }, [organizeByAuthor, selectedDevice?.destinationLabel]);

  const refreshDevices = async () => {
    setLoadingDevices(true);
    try {
      const nextDevices = await getApi().listKindleDevices();
      setDevices(nextDevices);
      setSelectedDeviceId((current) =>
        current && nextDevices.some((device) => device.id === current)
          ? current
          : nextDevices[0]?.id || "",
      );
    } catch (error) {
      console.error("Error loading Kindle devices:", error);
      toast.error("Nao foi possivel verificar o Kindle conectado");
    } finally {
      setLoadingDevices(false);
    }
  };

  useEffect(() => {
    void refreshDevices();
  }, []);

  const handleSend = async () => {
    if (!selectedDevice || books.length === 0) return;

    setSending(true);
    setResults(new Map());

    try {
      const response = await getApi().sendBooksToKindle({
        deviceId: selectedDevice.id,
        books: books.map((book) => ({
          fileHash: book.fileHash,
          filePath: book.filePath,
          title: getTitleWithoutExtension(book.title, book.fileType),
          author: book.author,
          fileType: book.fileType,
          fileName: book.fileName,
          publisher: book.publisher,
          description: book.description,
          publishDate: book.publishDate,
          language: book.language,
          identifier: book.identifier,
          asin: book.asin,
          subject: book.subject,
          series: book.series,
          seriesIndex: book.seriesIndex,
          authorSort: book.authorSort,
          titleSort: book.titleSort,
        })),
        convertToAzw3,
        preserveMetadata,
        organizeByAuthor,
        destination: DEFAULT_DESTINATION,
      });

      setResults(new Map(response.results.map((result) => [result.fileHash, result])));

      if (response.sent > 0) {
        toast.success(`${response.sent} livro${response.sent !== 1 ? "s" : ""} enviado${response.sent !== 1 ? "s" : ""} para o Kindle`);
        onSent?.();
      }
      if (response.failed > 0) {
        toast.error(response.error || `${response.failed} livro${response.failed !== 1 ? "s" : ""} nao foi enviado${response.failed !== 1 ? "s" : ""}`);
      }
    } catch (error) {
      console.error("Error sending to Kindle:", error);
      toast.error("Erro ao enviar para o Kindle");
    } finally {
      setSending(false);
    }
  };

  return (
    <aside
      className="lyceum-kindle-send-panel flex h-full w-[390px] flex-shrink-0 flex-col border-l border-zinc-800 bg-zinc-900 text-zinc-100"
      aria-label="Enviar para Kindle"
    >
      <header className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold">Enviar para Kindle</h2>
          <p className="mt-0.5 truncate text-xs text-zinc-500">
            {books.length} livro{books.length !== 1 ? "s" : ""} selecionado{books.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-sm p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
          title="Fechar"
        >
          <X size={17} />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <section className="mb-4 rounded-sm border border-zinc-800 bg-zinc-950/60 p-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <Smartphone size={17} className="flex-shrink-0 text-green-400" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {loadingDevices ? "Procurando Kindle..." : selectedDevice?.name || "Nenhum Kindle encontrado"}
                </p>
                <p className="truncate text-xs text-zinc-500">
                  {selectedDevice?.isMtp ? "MTP do Windows" : selectedDevice ? "Armazenamento USB" : "Conecte o Paperwhite por USB"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void refreshDevices()}
              disabled={loadingDevices || sending}
              className="rounded-sm p-2 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-50"
              title="Atualizar dispositivos"
            >
              <RefreshCw size={15} className={loadingDevices ? "animate-spin" : ""} />
            </button>
          </div>

          {devices.length > 1 && (
            <select
              value={selectedDevice?.id || ""}
              onChange={(event) => setSelectedDeviceId(event.target.value)}
              className="h-9 w-full rounded-sm border border-zinc-800 bg-zinc-900 px-2 text-sm text-zinc-200 outline-none focus:border-green-500"
            >
              {devices.map((device) => (
                <option key={device.id} value={device.id}>
                  {device.name}
                </option>
              ))}
            </select>
          )}

          <div className="mt-3 flex items-center gap-2 rounded-sm border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-400">
            <Folder size={14} className="flex-shrink-0 text-zinc-500" />
            <span className="truncate">{destinationLabel}</span>
          </div>
        </section>

        <section className="mb-4 rounded-sm border border-zinc-800 bg-zinc-950/60 p-3">
          <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
            Opcoes de transferencia
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-zinc-200">Converter para AZW3</p>
                <p className="text-xs text-zinc-500">Ideal para EPUB, PDF, TXT e HTML via USB</p>
              </div>
              <Toggle
                checked={convertToAzw3}
                disabled={sending}
                onChange={() => setConvertToAzw3((value) => !value)}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-zinc-200">Preservar metadados</p>
                <p className="text-xs text-zinc-500">Titulo, autor e identificador Lyceum</p>
              </div>
              <Toggle
                checked={preserveMetadata}
                disabled={sending}
                onChange={() => setPreserveMetadata((value) => !value)}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-zinc-200">Organizar por autor</p>
                <p className="text-xs text-zinc-500">Cria subpastas dentro de Downloads</p>
              </div>
              <Toggle
                checked={organizeByAuthor}
                disabled={sending}
                onChange={() => setOrganizeByAuthor((value) => !value)}
              />
            </div>
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Livros selecionados
            </h3>
            <span className="text-xs text-zinc-600">{formatFileSize(totalSize)}</span>
          </div>
          <div className="space-y-2">
            {books.map((book) => {
              const format = getBookFormat(book);
              const result = results.get(book.fileHash);
              const shouldConvert = convertToAzw3 && format !== "azw3" && CONVERTIBLE_TO_AZW3.has(format);
              const needsConversion = !convertToAzw3 && !DIRECT_KINDLE_FORMATS.has(format);
              const hasError = needsConversion || (result && !result.success);
              const isDone = result?.success;
              const fallbackStatus = needsConversion ? "Ative AZW3 para enviar por USB" : itemStatusLabel(result, shouldConvert);

              return (
                <article
                  key={book.fileHash}
                  className="flex min-w-0 gap-3 rounded-sm border border-zinc-800 bg-zinc-950/60 p-2.5"
                >
                  <MiniCover book={book} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-100">
                      {getTitleWithoutExtension(book.title, book.fileType)}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-zinc-500">
                      {book.author || "Autor desconhecido"} - {getFileTypeLabel(book.fileType, book.filePath)} - {formatFileSize(book.fileSize)}
                    </p>
                    <p
                      className={`mt-2 flex items-center gap-1.5 text-xs ${
                        hasError ? "text-red-300" : isDone ? "text-green-400" : shouldConvert ? "text-amber-300" : "text-zinc-400"
                      }`}
                    >
                      {hasError ? (
                        <AlertCircle size={13} />
                      ) : isDone ? (
                        <CheckCircle2 size={13} />
                      ) : shouldConvert ? (
                        <RefreshCw size={13} />
                      ) : (
                        <BookOpen size={13} />
                      )}
                      <span className="truncate">{fallbackStatus}</span>
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>

      <footer className="flex-shrink-0 border-t border-zinc-800 bg-zinc-900/95 p-4">
        <div className="mb-3 flex items-center justify-between text-xs text-zinc-500">
          <span>{convertibleCount} convers{convertibleCount === 1 ? "ao" : "oes"} AZW3</span>
          <span>{books.length} arquivo{books.length !== 1 ? "s" : ""}</span>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="h-10 flex-1 rounded-sm border border-zinc-800 bg-zinc-950 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={sending || books.length === 0 || !selectedDevice}
            className="flex h-10 flex-[1.6] items-center justify-center gap-2 rounded-sm bg-green-500 text-sm font-semibold text-zinc-950 hover:bg-green-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sending ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
            {sending ? "Enviando..." : `Enviar ${books.length}`}
          </button>
        </div>
      </footer>
    </aside>
  );
}
