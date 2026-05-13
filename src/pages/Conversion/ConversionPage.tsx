import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Check,
  CircleAlert,
  CircleCheck,
  Clock3,
  FileText,
  Folder,
  FolderOpen,
  Info,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import {
  canConvertBook,
  useConversionQueue,
  type ConversionOutputFormat,
  type ConversionProfile,
  type ConversionQueueItem,
  type BookConversionConfig,
  type ConversionOptions,
  defaultConversionOptions,
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
  { value: "azw3", label: "AZW3", description: "Kindle KF8" },
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

interface ToggleProps {
  checked: boolean;
  onChange?: () => void;
}

function Toggle({ checked, onChange }: ToggleProps) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`flex h-5 w-9 items-center rounded-full p-0.5 transition-colors ${
        checked ? "bg-green-500" : "bg-zinc-700"
      }`}
    >
      <span
        className={`h-4 w-4 rounded-full bg-white transition-transform ${
          checked ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
}

export default function ConversionPage() {
  const navigate = useNavigate();
  const {
    draftBooks,
    queue,
    isRunning,
    clearDraft,
    startConversionWithConfigs,
  } = useConversionQueue();
  const [selectedBookHash, setSelectedBookHash] = useState<string | null>(null);
  const [bookConfigs, setBookConfigs] = useState<Map<string, {
    targetFormat: ConversionOutputFormat;
    profile: ConversionProfile;
    options: ConversionOptions;
    outputPath?: string;
  }>>(
    new Map(),
  );
  const [search, setSearch] = useState("");

  const getBookConfig = useCallback(
    (book: BookWithThumbnail): {
      targetFormat: ConversionOutputFormat;
      profile: ConversionProfile;
      options: ConversionOptions;
      outputPath?: string;
    } => {
      return (
        bookConfigs.get(book.fileHash) || {
          targetFormat: "epub" as ConversionOutputFormat,
          profile: "ereader" as ConversionProfile,
          options: { ...defaultConversionOptions },
        }
      );
    },
    [bookConfigs],
  );

  const setBookConfig = useCallback(
    (bookHash: string, updates: Partial<{
      targetFormat: ConversionOutputFormat;
      profile: ConversionProfile;
      options: ConversionOptions;
      outputPath?: string;
    }>) => {
      setBookConfigs((prev) => {
        const next = new Map(prev);
        const existing = next.get(bookHash) || {
          targetFormat: "epub" as ConversionOutputFormat,
          profile: "ereader" as ConversionProfile,
          options: { ...defaultConversionOptions },
        };
        next.set(bookHash, { ...existing, ...updates });
        return next;
      });
    },
    [],
  );

  const toggleBookOption = useCallback(
    (bookHash: string, optionKey: keyof ConversionOptions) => {
      setBookConfigs((prev) => {
        const next = new Map(prev);
        const existing = next.get(bookHash) || {
          targetFormat: "epub" as ConversionOutputFormat,
          profile: "ereader" as ConversionProfile,
          options: { ...defaultConversionOptions },
        };
        next.set(bookHash, {
          ...existing,
          options: {
            ...existing.options,
            [optionKey]: !existing.options[optionKey],
          },
        });
        return next;
      });
    },
    [],
  );

  const selectedBook = useMemo(
    () => draftBooks.find((book) => book.fileHash === selectedBookHash) || null,
    [draftBooks, selectedBookHash],
  );

  useEffect(() => {
    if (selectedBookHash === null && draftBooks.length > 0) {
      setSelectedBookHash(draftBooks[0].fileHash);
    }
  }, [draftBooks, selectedBookHash]);

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
    () =>
      draftBooks.filter((book) => {
        const cfg = getBookConfig(book);
        return canConvertBook(book, cfg.targetFormat);
      }).length,
    [draftBooks, getBookConfig],
  );
  const estimatedSize = useMemo(() => {
    const totalEstimated = draftBooks.reduce((sum, book) => {
      const cfg = getBookConfig(book);
      const multiplier = cfg.targetFormat === "txt" ? 0.22 : cfg.targetFormat === "html" ? 0.7 : 1.05;
      return sum + (book.fileSize || 0) * multiplier;
    }, 0);
    if (!totalEstimated) return "-";
    return formatFileSize(Math.max(1, Math.round(totalEstimated)));
  }, [draftBooks, getBookConfig]);
  const handleStart = () => {
    const configs: BookConversionConfig[] = draftBooks.map((book) => ({
      book,
      ...getBookConfig(book),
    }));
    startConversionWithConfigs(configs);
  };

  return (
    <div className="lyceum-page-conversion flex h-full min-h-0 flex-col overflow-hidden bg-zinc-950 p-3 text-zinc-100">
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden 2xl:grid-cols-[minmax(0,1fr)_400px]">
        <main className="min-h-0 overflow-y-auto pr-0.5">

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
                 {selectedBooks.map((book) => {
                   const isSelected = selectedBookHash === book.fileHash;
                   const cfg = getBookConfig(book);
                   return (
                     <article
                       key={bookKey(book)}
                       onClick={() => setSelectedBookHash(book.fileHash)}
                       className={`relative flex min-w-0 cursor-pointer gap-3 rounded-sm border p-3 transition-colors ${isSelected ? "border-green-500/60 bg-green-500/5 shadow-[0_0_20px_rgba(34,197,94,0.1)]" : "border-zinc-800 bg-zinc-950/70 hover:border-zinc-700"}`}
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
                           Saída: {cfg.targetFormat.toUpperCase()}
                         </span>
                       </div>
                       {isSelected && (
                         <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-zinc-950">
                           <Check size={13} />
                         </span>
                       )}
                     </article>
                   );
                 })}
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
                <table className="w-full min-w-[800px] text-left text-sm">
                  <thead className="text-xs text-zinc-500">
                    <tr className="border-b border-zinc-800">
                      <th className="px-4 py-3 font-medium w-72">Livro</th>
                      <th className="px-4 py-3 font-medium">Origem → Saída</th>
                      <th className="px-4 py-3 font-medium w-44">Progresso</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Tamanho</th>
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
                      visibleQueue.map((item) => {
                        const estimatedOutputSize = item.outputSize || (() => {
                          const multiplier = item.targetFormat === "txt" ? 0.22 : item.targetFormat === "html" ? 0.7 : 1.05;
                          return Math.round((item.book.fileSize || 0) * multiplier);
                        })();

                        return (
                          <tr key={item.id} className="hover:bg-zinc-900/80">
                            <td className="px-4 py-2.5 w-72">
                              <div className="flex items-center gap-3 min-w-0">
                                <MiniCover book={item.book} />
                                <div className="min-w-0 flex-1">
                                  <p className="truncate font-medium text-zinc-200">
                                    {getTitleWithoutExtension(item.book.title, item.book.fileType)}
                                  </p>
                                  <p className="truncate text-xs text-zinc-500">
                                    {item.book.author || getBookFolderLabel(item.book.filePath)}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <span className="text-zinc-300">{item.sourceFormat.toUpperCase()}</span>
                                <ArrowRight size={14} className="text-zinc-600" />
                                <span className="rounded-sm border border-green-500/50 bg-green-500/10 px-2 py-0.5 text-xs text-green-200">
                                  {item.targetFormat.toUpperCase()}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-2.5 w-44">
                              <div className="flex items-center gap-2">
                                <div className="w-28 h-2 bg-zinc-800 rounded-full overflow-hidden flex-shrink-0">
                                  <div
                                    className={`h-full rounded-full transition-all duration-300 ${
                                      item.status === "done"
                                        ? "bg-green-500"
                                        : item.status === "error"
                                          ? "bg-red-500"
                                          : item.status === "running"
                                            ? "bg-green-500"
                                            : "bg-zinc-700"
                                    }`}
                                    style={{ width: `${item.progress}%` }}
                                  />
                                </div>
                                <span className="text-xs text-zinc-400 w-10 text-right flex-shrink-0">
                                  {item.progress}%
                                </span>
                              </div>
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
                            <td className="px-4 py-2.5 text-zinc-400 text-xs">
                              {item.status === "done" ? (
                                formatFileSize(estimatedOutputSize)
                              ) : (
                                <span className="text-zinc-600">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
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
            <div className="min-w-0">
              <h2 className="font-semibold text-zinc-100">Configuração de conversão</h2>
              {selectedBook && (
                <p className="truncate text-xs text-zinc-500">
                  {getTitleWithoutExtension(selectedBook.title, selectedBook.fileType)}
                </p>
              )}
            </div>
            <button
              onClick={() => navigate("/library")}
              className="rounded-sm p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
              title="Voltar"
            >
              <X size={16} />
            </button>
          </div>

           {!selectedBook ? (
             <div className="flex min-h-64 flex-col items-center justify-center gap-3 p-6 text-center text-sm text-zinc-500">
               <Info size={28} className="text-zinc-600" />
               <p>Selecione um livro para configurar sua conversão</p>
             </div>
           ) : (
             (() => {
               const cfg = getBookConfig(selectedBook);
               const optionList: { label: string; key: keyof ConversionOptions }[] = [
                 { label: "Preservar capa", key: "preserveCover" },
                 { label: "Preservar metadados", key: "preserveMetadata" },
                 { label: "Otimizar imagens", key: "optimizeImages" },
                 { label: "Gerar índice", key: "generateIndex" },
                 { label: "Ajustar para e-reader", key: "adjustForEreader" },
                 { label: "Saída simplificada", key: "simplifiedOutput" },
               ];

               return (
                 <div className="space-y-6 p-5">
                   <section>
                     <div className="mb-2 flex items-center gap-2">
                       <h3 className="text-sm font-semibold text-zinc-100">Formato de saída</h3>
                       <Info size={14} className="text-zinc-500" />
                     </div>
                     <div className="grid grid-cols-2 gap-2">
                       {outputFormats.map((format) => {
                         const usable = canConvertBook(selectedBook, format.value);
                         const selected = cfg.targetFormat === format.value;
                         return (
                           <button
                             key={format.value}
                             type="button"
                             disabled={!usable}
                             onClick={() => setBookConfig(selectedBook.fileHash, { targetFormat: format.value })}
                             className={`relative min-h-24 rounded-sm border p-3 text-center transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${selected ? "border-green-400 bg-green-500/15 shadow-[0_0_18px_rgba(34,197,94,0.22)]" : "border-zinc-800 bg-zinc-950 hover:border-zinc-700"}`}
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
                     <h3 className="mb-2 text-sm font-semibold text-zinc-100">Opções de conversão</h3>
                     <div className="space-y-2 text-sm text-zinc-300">
                       {optionList.map(({ label, key }) => (
                         <div key={key} className="flex items-center justify-between gap-3">
                           <span>{label}</span>
                           <Toggle
                             checked={cfg.options[key]}
                             onChange={() => toggleBookOption(selectedBook.fileHash, key)}
                           />
                         </div>
                       ))}
                     </div>
                   </section>

                   <section>
                     <h3 className="mb-2 text-sm font-semibold text-zinc-100">Destino</h3>
                     <div className="space-y-2">
                       {cfg.outputPath ? (
                         <div className="flex min-h-9 items-center justify-between gap-2 rounded-sm border border-zinc-800 bg-zinc-950 px-3">
                           <div className="flex min-w-0 items-center gap-2">
                             <Folder size={15} className="flex-shrink-0 text-zinc-500" />
                             <span className="truncate text-sm text-zinc-300">{cfg.outputPath}</span>
                           </div>
                           <button
                             type="button"
                             onClick={() => setBookConfig(selectedBook.fileHash, { outputPath: undefined })}
                             className="flex-shrink-0 text-xs text-zinc-500 hover:text-zinc-300"
                           >
                             Limpar
                           </button>
                         </div>
                       ) : (
                         <div className="flex h-9 items-center gap-2 rounded-sm border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-300">
                           <Folder size={15} className="text-zinc-500" />
                           <span>Ao lado do arquivo original</span>
                         </div>
                       )}
                       <button
                         type="button"
                         onClick={async () => {
                           const result = await (window.api as unknown as { selectFolder: () => Promise<{ canceled: boolean; filePaths: string[] }> }).selectFolder();
                           if (result && !result.canceled && result.filePaths.length > 0) {
                             setBookConfig(selectedBook.fileHash, { outputPath: result.filePaths[0] });
                           }
                         }}
                         className="flex h-9 w-full items-center justify-center gap-2 rounded-sm border border-zinc-700 bg-zinc-900 text-sm text-zinc-300 hover:bg-zinc-800"
                       >
                         <FolderOpen size={14} />
                         Escolher pasta
                       </button>
                     </div>
                   </section>

                   <section className="rounded-sm border border-zinc-800 bg-zinc-950 p-4">
                     <div className="flex items-center gap-4">
                       <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-green-500/10 text-green-400">
                         <Sparkles size={24} />
                       </span>
                       <div className="min-w-0">
                         <p className="font-semibold text-zinc-100">
                           {convertibleCount} livros <span className="text-zinc-500">•</span> configurações individuais
                         </p>
                         <p className="mt-1 text-sm text-zinc-400">
                           {estimatedSize} estimados
                         </p>
                       </div>
                     </div>
                   </section>
                 </div>
               );
             })()
           )}

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
