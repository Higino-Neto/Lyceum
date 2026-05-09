import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Check,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Clock3,
  FileText,
  Folder,
  FolderOpen,
  Info,
  LibraryBig,
  ListChecks,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  TabletSmartphone,
  X,
  Zap,
} from "lucide-react";
import {
  canConvertBook,
  useConversionQueue,
  type ConversionOutputFormat,
  type ConversionProfile,
  type ConversionQueueItem,
} from "../../contexts/ConversionQueueContext";
import { BookWithThumbnail } from "../../types/LibraryTypes";
import {
  formatFileSize,
  getBookFolderLabel,
  getFileTypeLabel,
  getTitleWithoutExtension,
} from "../Library/utils";

const outputFormats: {
  value: ConversionOutputFormat;
  label: string;
  description: string;
}[] = [
  { value: "epub", label: "EPUB", description: "Leitura fluida" },
  { value: "pdf", label: "PDF", description: "Layout fixo" },
  { value: "txt", label: "TXT", description: "Texto leve" },
  { value: "html", label: "HTML", description: "Arquivo web" },
];

const profiles: { value: ConversionProfile; label: string; description: string }[] = [
  {
    value: "ereader",
    label: "Leitura em e-reader",
    description: "Melhor experiência em dispositivos",
  },
  {
    value: "light",
    label: "Arquivo leve",
    description: "Menor tamanho possível",
  },
  {
    value: "compatible",
    label: "Máxima compatibilidade",
    description: "Funciona na maioria dos apps e leitores",
  },
];

function bookKey(book: BookWithThumbnail) {
  return `${book.fileHash}:${book.filePath}`;
}

function statusLabel(item: ConversionQueueItem) {
  if (item.status === "done") return "Concluído";
  if (item.status === "error") return item.message;
  if (item.status === "running") return "Convertendo";
  return "Aguardando";
}

function Cover({ book }: { book: BookWithThumbnail }) {
  if (book.thumbnail) {
    return (
      <img
        src={book.thumbnail}
        alt={book.title}
        className="h-20 w-14 flex-shrink-0 rounded-sm object-cover"
      />
    );
  }

  return (
    <div className="flex h-20 w-14 flex-shrink-0 items-center justify-center rounded-sm border border-zinc-800 bg-zinc-950 text-zinc-600">
      <FileText size={18} />
    </div>
  );
}

function MiniCover({ book }: { book: BookWithThumbnail }) {
  if (book.thumbnail) {
    return (
      <img
        src={book.thumbnail}
        alt={book.title}
        className="h-10 w-7 flex-shrink-0 rounded-sm object-cover"
      />
    );
  }

  return (
    <div className="flex h-10 w-7 flex-shrink-0 items-center justify-center rounded-sm bg-zinc-800 text-zinc-600">
      <FileText size={13} />
    </div>
  );
}

function Toggle({ checked }: { checked: boolean }) {
  return (
    <span
      className={`flex h-5 w-9 items-center rounded-full p-0.5 ${
        checked ? "bg-green-500" : "bg-zinc-700"
      }`}
    >
      <span
        className={`h-4 w-4 rounded-full bg-white transition-transform ${
          checked ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </span>
  );
}

export default function ConversionPage() {
  const navigate = useNavigate();
  const {
    draftBooks,
    queue,
    isRunning,
    clearDraft,
    startConversion,
  } = useConversionQueue();
  const [targetFormat, setTargetFormat] = useState<ConversionOutputFormat>("epub");
  const [profile, setProfile] = useState<ConversionProfile>("ereader");
  const [search, setSearch] = useState("");

  const selectedBooks = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return draftBooks;
    return draftBooks.filter((book) =>
      [book.title, book.author, book.fileName, book.filePath]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized)),
    );
  }, [draftBooks, search]);

  const selectedKeys = useMemo(
    () => new Set(draftBooks.map(bookKey)),
    [draftBooks],
  );
  const visibleQueue = useMemo(
    () =>
      queue.filter((item) =>
        selectedKeys.size > 0 ? selectedKeys.has(bookKey(item.book)) : true,
      ),
    [queue, selectedKeys],
  );
  const convertibleCount = useMemo(
    () => draftBooks.filter((book) => canConvertBook(book, targetFormat)).length,
    [draftBooks, targetFormat],
  );
  const estimatedSize = useMemo(() => {
    const totalBytes = draftBooks.reduce((sum, book) => sum + (book.fileSize || 0), 0);
    if (!totalBytes) return "-";
    const multiplier = targetFormat === "txt" ? 0.22 : targetFormat === "html" ? 0.7 : 1.05;
    return formatFileSize(Math.max(1, Math.round(totalBytes * multiplier)));
  }, [draftBooks, targetFormat]);
  const activeCount = queue.filter((item) => item.status === "running").length;
  const pendingCount = queue.filter((item) => item.status === "pending").length;

  const handleStart = () => {
    startConversion({ books: draftBooks, targetFormat, profile });
  };

  return (
    <div className="lyceum-page-conversion flex h-full min-h-0 flex-col overflow-hidden bg-zinc-950 p-3 text-zinc-100">
      <header className="flex flex-shrink-0 flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => navigate("/library")}
          className="flex h-10 items-center gap-2 rounded-sm border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-300 hover:bg-zinc-900"
        >
          <LibraryBig size={16} />
          Biblioteca
        </button>
        <button className="flex h-10 items-center gap-2 rounded-sm border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-300">
          <ListChecks size={16} />
          Sincronizados
        </button>
        <button className="flex h-10 items-center gap-2 rounded-sm border border-green-500/50 bg-green-500/15 px-4 text-sm font-medium text-green-100 shadow-[0_0_20px_rgba(34,197,94,0.14)]">
          <Zap size={16} />
          Conversão
        </button>
        <button className="flex h-10 items-center gap-2 rounded-sm border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-300">
          <TabletSmartphone size={16} />
          Dispositivo
          <span className="h-2 w-2 rounded-full bg-green-400" />
        </button>
      </header>

      <div className="mt-3 flex h-11 flex-shrink-0 items-center justify-between rounded-sm border border-green-500/40 bg-green-950/20 px-4">
        <div className="flex min-w-0 items-center gap-3 text-sm font-medium">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-green-500/15 text-green-300">
            {isRunning ? <RefreshCw size={15} className="animate-spin" /> : <Zap size={15} />}
          </span>
          <span className="truncate">
            Fila de conversão {isRunning ? "ativa" : "pronta"}{" "}
            <span className="text-zinc-600">•</span> {queue.length} arquivos{" "}
            <span className="text-zinc-600">•</span> {activeCount || pendingCount} em andamento
          </span>
        </div>
        <button className="hidden items-center gap-2 text-sm text-green-300 hover:text-green-200 sm:flex">
          Ver detalhes
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="mt-3 grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden 2xl:grid-cols-[minmax(0,1fr)_400px]">
        <main className="min-h-0 overflow-y-auto pr-0.5">
          <div className="mb-3 flex min-h-16 items-center rounded-sm border border-zinc-800 bg-zinc-950 px-4">
            {["Selecionar livros", "Escolher formato", "Revisar", "Converter"].map((step, index) => (
              <div key={step} className="flex min-w-0 flex-1 items-center gap-3">
                <span
                  className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                    index <= 1 ? "bg-green-500 text-zinc-950" : "bg-zinc-800 text-zinc-400"
                  }`}
                >
                  {index + 1}
                </span>
                <div className="hidden min-w-0 md:block">
                  <p className="truncate text-sm font-medium text-zinc-200">{step}</p>
                  <p className="truncate text-xs text-zinc-500">
                    {["Livros escolhidos", "Defina a saída", "Confira a fila", "Roda em segundo plano"][index]}
                  </p>
                </div>
                {index < 3 && <span className="mx-2 hidden h-px flex-1 bg-zinc-800 lg:block" />}
              </div>
            ))}
          </div>

          <div className="mb-3 rounded-sm border border-zinc-800 bg-zinc-900/40">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
              <h2 className="text-sm font-semibold text-zinc-100">
                Livros selecionados ({draftBooks.length})
              </h2>
              <label className="flex h-9 min-w-64 items-center gap-2 rounded-sm border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-500">
                <Search size={15} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-zinc-200 placeholder:text-zinc-600"
                  placeholder="Filtrar seleção..."
                />
              </label>
            </div>
            {selectedBooks.length === 0 ? (
              <div className="flex min-h-44 flex-col items-center justify-center gap-3 p-6 text-center text-sm text-zinc-500">
                <CircleAlert size={22} className="text-zinc-600" />
                Selecione livros na Biblioteca e clique em Converter.
              </div>
            ) : (
              <div className="grid gap-3 p-3 lg:grid-cols-3">
                {selectedBooks.map((book) => (
                  <article
                    key={bookKey(book)}
                    className="relative flex min-w-0 gap-3 rounded-sm border border-zinc-800 bg-zinc-950/70 p-3"
                  >
                    <Cover book={book} />
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-semibold text-zinc-100">
                        {getTitleWithoutExtension(book.title, book.fileType)}
                      </h3>
                      <p className="mt-1 truncate text-sm text-zinc-500">
                        {book.author || getBookFolderLabel(book.filePath)}
                      </p>
                      <p className="mt-3 text-xs text-zinc-400">
                        {getFileTypeLabel(book.fileType, book.filePath)}{" "}
                        <span className="text-zinc-700">•</span> {formatFileSize(book.fileSize)}
                      </p>
                      <span className="mt-3 inline-flex items-center gap-1.5 rounded-sm bg-green-500/10 px-2 py-1 text-xs text-green-400">
                        <CircleCheck size={13} />
                        Pronto
                      </span>
                    </div>
                    <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-zinc-950">
                      <Check size={13} />
                    </span>
                  </article>
                ))}
              </div>
            )}
          </div>

          <div className="mb-3 overflow-hidden rounded-sm border border-zinc-800 bg-zinc-900/40">
            <div className="border-b border-zinc-800 px-4 py-3">
              <h2 className="text-sm font-semibold text-zinc-100">
                Fila de conversão ({visibleQueue.length})
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="text-xs text-zinc-500">
                  <tr className="border-b border-zinc-800">
                    <th className="px-4 py-3 font-medium">Livro</th>
                    <th className="px-4 py-3 font-medium">Origem</th>
                    <th className="px-4 py-3 font-medium">Saída</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Resultado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {visibleQueue.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                        A fila aparece aqui quando você inicia a conversão.
                      </td>
                    </tr>
                  ) : (
                    visibleQueue.map((item) => (
                      <tr key={item.id} className="hover:bg-zinc-900/80">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-3">
                            <MiniCover book={item.book} />
                            <div className="min-w-0">
                              <p className="truncate font-medium text-zinc-200">
                                {getTitleWithoutExtension(item.book.title, item.book.fileType)}
                              </p>
                              <p className="truncate text-xs text-zinc-500">
                                {item.book.author || getBookFolderLabel(item.book.filePath)}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-zinc-300">
                          {item.sourceFormat.toUpperCase()}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="rounded-sm border border-green-500/50 bg-green-500/10 px-2 py-0.5 text-xs text-green-200">
                            {item.targetFormat.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`inline-flex items-center gap-1.5 ${
                              item.status === "done"
                                ? "text-green-400"
                                : item.status === "error"
                                  ? "text-red-400"
                                  : item.status === "running"
                                    ? "text-amber-300"
                                    : "text-zinc-500"
                            }`}
                          >
                            {item.status === "done" ? (
                              <CircleCheck size={15} />
                            ) : item.status === "error" ? (
                              <CircleAlert size={15} />
                            ) : item.status === "running" ? (
                              <RefreshCw size={15} className="animate-spin" />
                            ) : (
                              <Clock3 size={15} />
                            )}
                            {statusLabel(item)}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-zinc-400">
                          {item.outputPath ? (
                            <button
                              type="button"
                              onClick={() => window.api.showBookInFolder(item.outputPath)}
                              className="inline-flex items-center gap-2 rounded-sm px-2 py-1 text-zinc-300 hover:bg-zinc-800"
                            >
                              <FolderOpen size={14} />
                              Abrir pasta
                            </button>
                          ) : (
                            item.message
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="overflow-hidden rounded-sm border border-zinc-800 bg-zinc-900/40">
            <div className="border-b border-zinc-800 px-4 py-3">
              <h2 className="text-sm font-semibold text-zinc-100">Conversões recentes</h2>
            </div>
            <div className="divide-y divide-zinc-800">
              {queue.filter((item) => item.status === "done").slice(0, 4).map((item) => (
                <div key={`recent-${item.id}`} className="flex items-center gap-3 px-4 py-3">
                  <MiniCover book={item.book} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-200">
                      {getTitleWithoutExtension(item.book.title, item.book.fileType)}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {item.sourceFormat.toUpperCase()} → {item.targetFormat.toUpperCase()}
                    </p>
                  </div>
                  <span className="text-xs text-green-400">Concluído</span>
                </div>
              ))}
              {queue.every((item) => item.status !== "done") && (
                <div className="px-4 py-6 text-center text-sm text-zinc-500">
                  Nenhuma conversão concluída nesta sessão.
                </div>
              )}
            </div>
          </div>
        </main>

        <aside className="min-h-0 overflow-y-auto rounded-sm border border-zinc-800 bg-zinc-900/60">
          <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
            <h2 className="font-semibold text-zinc-100">Configuração de conversão</h2>
            <button
              onClick={() => navigate("/library")}
              className="rounded-sm p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
              title="Voltar"
            >
              <X size={16} />
            </button>
          </div>

          <div className="space-y-6 p-5">
            <section>
              <div className="mb-2 flex items-center gap-2">
                <h3 className="text-sm font-semibold text-zinc-100">Formato de saída</h3>
                <Info size={14} className="text-zinc-500" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                {outputFormats.map((format) => {
                  const usable = draftBooks.length === 0 ||
                    draftBooks.some((book) => canConvertBook(book, format.value));
                  const selected = targetFormat === format.value;
                  return (
                    <button
                      key={format.value}
                      type="button"
                      disabled={!usable}
                      onClick={() => setTargetFormat(format.value)}
                      className={`relative min-h-24 rounded-sm border p-3 text-center transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
                        selected
                          ? "border-green-400 bg-green-500/15 shadow-[0_0_18px_rgba(34,197,94,0.22)]"
                          : "border-zinc-800 bg-zinc-950 hover:border-zinc-700"
                      }`}
                    >
                      <FileText size={22} className={selected ? "mx-auto text-green-300" : "mx-auto text-zinc-400"} />
                      <span className="mt-2 block text-sm font-semibold text-zinc-100">
                        {format.label}
                      </span>
                      <span className="mt-1 block text-[11px] text-zinc-500">
                        {format.description}
                      </span>
                      {selected && (
                        <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-zinc-950">
                          <Check size={13} />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-sm font-semibold text-zinc-100">Perfil de conversão</h3>
              <div className="overflow-hidden rounded-sm border border-zinc-800">
                {profiles.map((item) => {
                  const selected = profile === item.value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setProfile(item.value)}
                      className={`flex w-full items-center gap-3 border-b border-zinc-800 px-3 py-3 text-left last:border-b-0 ${
                        selected ? "bg-green-500/10" : "bg-zinc-950 hover:bg-zinc-900"
                      }`}
                    >
                      <span
                        className={`h-3.5 w-3.5 rounded-full border ${
                          selected ? "border-green-400 bg-green-400" : "border-zinc-600"
                        }`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-zinc-100">
                          {item.label}
                        </span>
                        <span className="block truncate text-xs text-zinc-500">
                          {item.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-sm font-semibold text-zinc-100">Opções de conversão</h3>
              <div className="space-y-2 text-sm text-zinc-300">
                {[
                  ["Preservar capa", true],
                  ["Preservar metadados", true],
                  ["Otimizar imagens", profile !== "compatible"],
                  ["Gerar índice", profile !== "light"],
                  ["Ajustar para e-reader", profile === "ereader"],
                  ["Saída simplificada", profile === "light"],
                ].map(([label, checked]) => (
                  <div key={String(label)} className="flex items-center justify-between gap-3">
                    <span>{label}</span>
                    <Toggle checked={Boolean(checked)} />
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-sm font-semibold text-zinc-100">Destino</h3>
              <div className="flex h-9 min-w-0 items-center gap-2 rounded-sm border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-300">
                <Folder size={15} className="text-zinc-500" />
                <span className="truncate">Ao lado do arquivo original</span>
              </div>
            </section>

            <section className="rounded-sm border border-zinc-800 bg-zinc-950 p-4">
              <div className="flex items-center gap-4">
                <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-green-500/10 text-green-400">
                  <Sparkles size={24} />
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-zinc-100">
                    {convertibleCount} livros <span className="text-zinc-500">•</span>{" "}
                    saída {targetFormat.toUpperCase()}
                  </p>
                  <p className="mt-1 text-sm text-zinc-400">
                    {estimatedSize} estimados <span className="text-zinc-600">•</span>{" "}
                    roda em segundo plano
                  </p>
                </div>
              </div>
            </section>
          </div>

          <div className="sticky bottom-0 flex gap-3 border-t border-zinc-800 bg-zinc-900/95 p-4 backdrop-blur">
            <button
              type="button"
              onClick={() => {
                clearDraft();
                navigate("/library");
              }}
              className="h-11 flex-1 rounded-sm border border-zinc-800 bg-zinc-950 text-sm font-medium text-zinc-200 hover:bg-zinc-800"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={convertibleCount === 0}
              onClick={handleStart}
              className="flex h-11 flex-[1.8] items-center justify-center gap-2 rounded-sm bg-green-500 text-sm font-semibold text-zinc-950 hover:bg-green-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send size={16} />
              Converter {convertibleCount} livros
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
