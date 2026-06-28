import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Check,
  CircleAlert,
  CircleCheck,
  Clock3,
  FilePlus,
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
import FilterBar, {
  type FileTypeFilter,
  type SortOption,
} from "../Library/components/FilterBar";
import {
  fetchAtlasBooks,
  matchesLibraryBookFileTypes,
  matchesLibraryBookSearch,
  sortLibraryBooks,
} from "../Atlas/atlasUtils";
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
  { value: "kfx", label: "KFX", description: "Kindle Previewer" },
  { value: "lyceum", label: "LYCEUM", description: "Pacote canonico" },
  { value: "txt", label: "TXT", description: "Texto leve" },
  { value: "html", label: "HTML", description: "Arquivo web" },
];

function bookKey(book: BookWithThumbnail) {
  return `${book.fileHash}:${book.filePath}`;
}

function statusLabel(item: ConversionQueueItem) {
  if (item.status === "done") return "Concluido";
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
      aria-pressed={checked}
    >
      <span
        className={`h-4 w-4 rounded-full bg-white transition-transform ${
          checked ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
}

interface LibrarySearchPanelProps {
  selectedBooks: BookWithThumbnail[];
  onAddBooks: (books: BookWithThumbnail[]) => void;
}

function LibrarySearchPanel({
  selectedBooks,
  onAddBooks,
}: LibrarySearchPanelProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("title_asc");
  const [fileType, setFileType] = useState<FileTypeFilter[]>([]);
  const apiAvailable = Boolean(window.api?.listBooks);
  const selectedHashes = useMemo(
    () => new Set(selectedBooks.map((book) => book.fileHash)),
    [selectedBooks],
  );

  const booksQuery = useQuery({
    queryKey: ["conversion-library-books"],
    queryFn: fetchAtlasBooks,
    enabled: open && apiAvailable,
    staleTime: 20_000,
  });

  const filteredBooks = useMemo(() => {
    const books = booksQuery.data ?? [];
    return sortLibraryBooks(
      books.filter((book) => (
        !selectedHashes.has(book.fileHash) &&
        matchesLibraryBookSearch(book, search) &&
        matchesLibraryBookFileTypes(book, fileType)
      )),
      sort,
    ).slice(0, 24);
  }, [booksQuery.data, fileType, search, selectedHashes, sort]);

  return (
    <section className="mb-3 rounded-sm border border-zinc-800 bg-zinc-900/40">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-zinc-100">
            Adicionar da biblioteca
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            Mesmo filtro usado no Atlas.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-sm border border-zinc-700 bg-zinc-950 px-3 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
        >
          {open ? <X size={14} /> : <FilePlus size={14} />}
          {open ? "Fechar busca" : "Buscar livros"}
        </button>
      </div>

      {open && (
        <div className="p-3">
          <FilterBar
            search={search}
            onSearchChange={setSearch}
            sort={sort}
            onSortChange={setSort}
            fileType={fileType}
            onFileTypeChange={setFileType}
          />
          {!apiAvailable ? (
            <div className="rounded-sm border border-dashed border-zinc-800 px-4 py-8 text-center text-sm text-zinc-500">
              A busca da biblioteca esta disponivel no app desktop.
            </div>
          ) : booksQuery.isLoading || booksQuery.isFetching ? (
            <div className="flex items-center justify-center gap-2 rounded-sm border border-dashed border-zinc-800 px-4 py-8 text-sm text-zinc-500">
              <RefreshCw size={15} className="animate-spin" />
              Carregando livros...
            </div>
          ) : filteredBooks.length === 0 ? (
            <div className="rounded-sm border border-dashed border-zinc-800 px-4 py-8 text-center text-sm text-zinc-500">
              Nenhum livro encontrado.
            </div>
          ) : (
            <div className="grid max-h-72 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
              {filteredBooks.map((book) => (
                <button
                  key={bookKey(book)}
                  type="button"
                  onClick={() => onAddBooks([book])}
                  className="flex min-w-0 cursor-pointer items-center gap-3 rounded-sm border border-zinc-800 bg-zinc-950/80 p-2 text-left hover:border-green-500/50 hover:bg-green-500/5"
                >
                  <MiniCover book={book} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-zinc-200">
                      {getTitleWithoutExtension(book.title, book.fileType)}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-zinc-500">
                      {book.author || getBookFolderLabel(book.filePath)}
                    </span>
                  </span>
                  <FilePlus size={15} className="flex-shrink-0 text-green-400" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

interface ConversionWorkspaceProps {
  onClose?: () => void;
  className?: string;
}

function ConversionWorkspace({ onClose, className }: ConversionWorkspaceProps) {
  const {
    draftBooks,
    queue,
    addDraftBooks,
    removeDraftBook,
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
    if (draftBooks.length === 0) {
      setSelectedBookHash(null);
      return;
    }

    if (!selectedBookHash || !draftBooks.some((book) => book.fileHash === selectedBookHash)) {
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
      const multiplier =
        cfg.targetFormat === "txt"
          ? 0.22
          : cfg.targetFormat === "html"
            ? 0.7
            : cfg.targetFormat === "kfx"
              ? 1.18
              : cfg.targetFormat === "lyceum"
                ? 1.05
                : 1.05;
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

  const handleRemoveBook = (book: BookWithThumbnail) => {
    removeDraftBook(book.fileHash);
    setBookConfigs((current) => {
      const next = new Map(current);
      next.delete(book.fileHash);
      return next;
    });
  };

  const handleCancel = () => {
    clearDraft();
    onClose?.();
  };

  return (
    <div className={`lyceum-page-conversion flex h-full min-h-0 flex-col overflow-hidden bg-zinc-950 p-3 text-zinc-100 ${className ?? ""}`}>
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden 2xl:grid-cols-[minmax(0,1fr)_400px]">
        <main className="min-h-0 overflow-y-auto pr-0.5">
          <LibrarySearchPanel selectedBooks={draftBooks} onAddBooks={addDraftBooks} />

          <div className="mb-3 rounded-sm border border-zinc-800 bg-zinc-900/40">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
              <h2 className="text-sm font-semibold text-zinc-100">
                Livros selecionados ({draftBooks.length})
              </h2>
              <label className="flex h-9 min-w-0 flex-[1_1_16rem] items-center gap-2 rounded-sm border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-500 sm:max-w-sm">
                <Search size={15} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-zinc-200 outline-none placeholder:text-zinc-600"
                  placeholder="Filtrar selecao..."
                />
              </label>
            </div>
            {selectedBooks.length === 0 ? (
              <div className="flex min-h-44 flex-col items-center justify-center gap-3 p-6 text-center text-sm text-zinc-500">
                <CircleAlert size={22} className="text-zinc-600" />
                Busque livros da biblioteca ou selecione livros na Biblioteca e clique em Converter.
              </div>
             ) : (
               <div className="grid gap-3 p-3 lg:grid-cols-2 xl:grid-cols-3">
                 {selectedBooks.map((book) => {
                   const isSelected = selectedBookHash === book.fileHash;
                   const cfg = getBookConfig(book);
                   return (
                     <article
                       key={bookKey(book)}
                       onClick={() => setSelectedBookHash(book.fileHash)}
                       className={`relative flex min-w-0 cursor-pointer gap-3 rounded-sm border p-3 pr-10 transition-colors ${isSelected ? "border-green-500/60 bg-green-500/5 shadow-[0_0_20px_rgba(34,197,94,0.1)]" : "border-zinc-800 bg-zinc-950/70 hover:border-zinc-700"}`}
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
                           <span className="text-zinc-700">-</span> {formatFileSize(book.fileSize)}
                         </p>
                         <span className="mt-3 inline-flex items-center gap-1.5 rounded-sm bg-green-500/10 px-2 py-1 text-xs text-green-400">
                           <CircleCheck size={13} />
                           Saida: {cfg.targetFormat.toUpperCase()}
                         </span>
                       </div>
                       <button
                         type="button"
                         onClick={(event) => {
                           event.stopPropagation();
                           handleRemoveBook(book);
                         }}
                         className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-sm text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
                         title="Remover da conversao"
                         aria-label={`Remover ${book.title} da conversao`}
                       >
                         <X size={14} />
                       </button>
                       {isSelected && (
                         <span className="absolute bottom-3 right-3 flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-zinc-950">
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
                 Fila de conversao ({visibleQueue.length})
               </h2>
             </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px] text-left text-sm">
                  <thead className="text-xs text-zinc-500">
                    <tr className="border-b border-zinc-800">
                      <th className="w-72 px-4 py-3 font-medium">Livro</th>
                      <th className="px-4 py-3 font-medium">Origem - Saida</th>
                      <th className="w-44 px-4 py-3 font-medium">Progresso</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Tamanho</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {visibleQueue.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                          A fila aparece aqui quando voce inicia a conversao.
                        </td>
                      </tr>
                    ) : (
                      visibleQueue.map((item) => {
                        const estimatedOutputSize = item.outputSize || (() => {
                          const multiplier =
                            item.targetFormat === "txt"
                              ? 0.22
                              : item.targetFormat === "html"
                                ? 0.7
                                : item.targetFormat === "kfx"
                                  ? 1.18
                                  : item.targetFormat === "lyceum"
                                    ? 1.05
                                    : 1.05;
                          return Math.round((item.book.fileSize || 0) * multiplier);
                        })();

                        return (
                          <tr key={item.id} className="hover:bg-zinc-900/80">
                            <td className="w-72 px-4 py-2.5">
                              <div className="flex min-w-0 items-center gap-3">
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
                            <td className="w-44 px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-28 flex-shrink-0 overflow-hidden rounded-full bg-zinc-800">
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
                                <span className="w-10 flex-shrink-0 text-right text-xs text-zinc-400">
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
                            <td className="px-4 py-2.5 text-xs text-zinc-400">
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
              <h2 className="text-sm font-semibold text-zinc-100">Conversoes recentes</h2>
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
                      {item.sourceFormat.toUpperCase()} - {item.targetFormat.toUpperCase()}
                    </p>
                  </div>
                  <span className="text-xs text-green-400">Concluido</span>
                </div>
              ))}
              {queue.every((item) => item.status !== "done") && (
                <div className="px-4 py-6 text-center text-sm text-zinc-500">
                  Nenhuma conversao concluida nesta sessao.
                </div>
              )}
            </div>
          </div>
        </main>

        <aside className="min-h-0 overflow-y-auto rounded-sm border border-zinc-800 bg-zinc-900/60">
          <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
            <div className="min-w-0">
              <h2 className="font-semibold text-zinc-100">Configuracao de conversao</h2>
              {selectedBook && (
                <p className="truncate text-xs text-zinc-500">
                  {getTitleWithoutExtension(selectedBook.title, selectedBook.fileType)}
                </p>
              )}
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="rounded-sm p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
                title="Fechar"
                aria-label="Fechar conversao"
              >
                <X size={16} />
              </button>
            )}
          </div>

           {!selectedBook ? (
             <div className="flex min-h-64 flex-col items-center justify-center gap-3 p-6 text-center text-sm text-zinc-500">
               <Info size={28} className="text-zinc-600" />
               <p>Selecione ou adicione um livro para configurar a conversao</p>
             </div>
           ) : (
             (() => {
               const cfg = getBookConfig(selectedBook);
               const optionList: { label: string; key: keyof ConversionOptions }[] = [
                 { label: "Preservar capa", key: "preserveCover" },
                 { label: "Preservar metadados", key: "preserveMetadata" },
                 { label: "Otimizar imagens", key: "optimizeImages" },
                 { label: "Gerar indice", key: "generateIndex" },
                 { label: "Ajustar para e-reader", key: "adjustForEreader" },
                 { label: "Saida simplificada", key: "simplifiedOutput" },
               ];

               return (
                 <div className="space-y-6 p-5">
                   <section>
                     <div className="mb-2 flex items-center gap-2">
                       <h3 className="text-sm font-semibold text-zinc-100">Formato de saida</h3>
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
                     <h3 className="mb-2 text-sm font-semibold text-zinc-100">Opcoes de conversao</h3>
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
                           {convertibleCount} livros <span className="text-zinc-500">-</span> configuracoes individuais
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
              onClick={handleCancel}
              className="h-11 flex-1 rounded-sm border border-zinc-800 bg-zinc-950 text-sm font-medium text-zinc-200 hover:bg-zinc-800"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={convertibleCount === 0 || isRunning}
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

interface ConversionDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ConversionDialog({ isOpen, onClose }: ConversionDialogProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[88] flex items-center justify-center bg-black/45 px-3 py-5"
      onMouseDown={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="conversion-dialog-title"
    >
      <div
        className="flex h-[min(860px,calc(100vh-40px))] w-full max-w-7xl overflow-hidden rounded border border-zinc-700/90 bg-zinc-950 shadow-2xl shadow-black/60"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="flex min-h-14 items-center justify-between border-b border-zinc-800 bg-zinc-900 px-4 sm:px-6">
            <div className="min-w-0">
              <h2 id="conversion-dialog-title" className="truncate text-base font-semibold text-zinc-100">
                Conversao
              </h2>
              <p className="hidden text-xs text-zinc-500 sm:block">
                Escolha livros, formatos e destino sem sair da tela atual.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
              title="Fechar"
              aria-label="Fechar conversao"
            >
              <X size={17} />
            </button>
          </header>
          <ConversionWorkspace onClose={onClose} className="flex-1" />
        </div>
      </div>
    </div>
  );
}

export default function ConversionPage() {
  return <ConversionWorkspace />;
}
