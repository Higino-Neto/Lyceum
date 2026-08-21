import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BookOpen,
  Check,
  CircleAlert,
  CircleCheck,
  Clock3,
  FilePlus,
  FileText,
  Folder,
  FolderOpen,
  Info,
  ListTree,
  RefreshCw,
  Search,
  Send,
  Square,
  Sparkles,
  Trash2,
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
import { useLazyThumbnail } from "../Library/components/BookGrid/useLazyThumbnail";

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
  if (item.status === "canceled") return "Cancelada";
  if (item.status === "running") return "Convertendo";
  return "Aguardando";
}

function Cover({ book }: { book: BookWithThumbnail }) {
  const { thumbnail, thumbnailRef } = useLazyThumbnail(book);
  if (thumbnail) {
    return (
      <div ref={thumbnailRef} className="h-20 w-14 flex-shrink-0 overflow-hidden rounded-sm">
        <img src={thumbnail} alt={book.title} className="h-full w-full object-cover" />
      </div>
    );
  }

  return (
    <div className="flex h-20 w-14 flex-shrink-0 items-center justify-center rounded-sm border border-zinc-800 bg-zinc-950 text-zinc-600">
      <FileText size={18} />
    </div>
  );
}

function MiniCover({ book }: { book: BookWithThumbnail }) {
  const { thumbnail, thumbnailRef } = useLazyThumbnail(book);
  if (thumbnail) {
    return (
      <div ref={thumbnailRef} className="h-10 w-7 flex-shrink-0 overflow-hidden rounded-sm">
        <img src={thumbnail} alt={book.title} className="h-full w-full object-cover" />
      </div>
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

function NumberOption({
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="space-y-1 text-xs text-zinc-400">
      <span>{label}</span>
      <span className="flex h-9 items-center rounded-sm border border-zinc-800 bg-zinc-950 px-2">
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Math.min(max, Math.max(min, Number(event.target.value))))}
          className="min-w-0 flex-1 bg-transparent text-sm text-zinc-200 outline-none"
        />
        {suffix && <span className="text-zinc-600">{suffix}</span>}
      </span>
    </label>
  );
}

function ToggleOption({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <div className="flex min-h-8 items-center justify-between gap-3 text-sm text-zinc-300">
      <span>{label}</span>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

function FormatOptions({
  format,
  options,
  onChange,
}: {
  format: ConversionOutputFormat;
  options: ConversionOptions;
  onChange: (updates: Partial<ConversionOptions>) => void;
}) {
  if (format === "pdf") {
    return (
      <div className="space-y-4">
        <label className="block space-y-1 text-xs text-zinc-400">
          <span>Tamanho da pagina</span>
          <select value={options.pdfPageSize} onChange={(event) => onChange({ pdfPageSize: event.target.value as ConversionOptions["pdfPageSize"] })} className="h-9 w-full rounded-sm border border-zinc-800 bg-zinc-950 px-2 text-sm text-zinc-200 outline-none">
            <option value="A4">A4</option><option value="A5">A5</option><option value="Letter">Carta</option><option value="Legal">Oficio</option>
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <NumberOption label="Margem superior" value={options.pdfMarginTopMm} min={0} max={60} suffix="mm" onChange={(value) => onChange({ pdfMarginTopMm: value })} />
          <NumberOption label="Margem inferior" value={options.pdfMarginBottomMm} min={0} max={60} suffix="mm" onChange={(value) => onChange({ pdfMarginBottomMm: value })} />
          <NumberOption label="Margem esquerda" value={options.pdfMarginLeftMm} min={0} max={60} suffix="mm" onChange={(value) => onChange({ pdfMarginLeftMm: value })} />
          <NumberOption label="Margem direita" value={options.pdfMarginRightMm} min={0} max={60} suffix="mm" onChange={(value) => onChange({ pdfMarginRightMm: value })} />
          <NumberOption label="Tamanho do texto" value={options.pdfFontSizePt} min={7} max={24} step={0.5} suffix="pt" onChange={(value) => onChange({ pdfFontSizePt: value })} />
          <NumberOption label="Entrelinha" value={options.pdfLineHeight} min={1} max={2.4} step={0.05} onChange={(value) => onChange({ pdfLineHeight: value })} />
          <NumberOption label="Espaco entre paragrafos" value={options.pdfParagraphSpacingEm} min={0} max={3} step={0.05} suffix="em" onChange={(value) => onChange({ pdfParagraphSpacingEm: value })} />
        </div>
        <ToggleOption label="Novo capitulo em nova pagina" checked={options.pdfChapterPageBreaks} onChange={() => onChange({ pdfChapterPageBreaks: !options.pdfChapterPageBreaks })} />
        <ToggleOption label="Gerar marcadores de capitulos" checked={options.pdfGenerateOutline} onChange={() => onChange({ pdfGenerateOutline: !options.pdfGenerateOutline })} />
      </div>
    );
  }

  if (format === "epub") {
    return (
      <div className="space-y-4">
        <label className="block space-y-1 text-xs text-zinc-400">
          <span>Layout</span>
          <select value={options.epubLayout} onChange={(event) => onChange({ epubLayout: event.target.value as ConversionOptions["epubLayout"] })} className="h-9 w-full rounded-sm border border-zinc-800 bg-zinc-950 px-2 text-sm text-zinc-200 outline-none">
            <option value="auto">Automatico</option><option value="fixed-layout">Visual, pagina por pagina</option><option value="reflow">Texto fluido</option>
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <NumberOption label="Entrelinha" value={options.epubLineHeight} min={1} max={2.2} step={0.05} onChange={(value) => onChange({ epubLineHeight: value })} />
          <NumberOption label="Espaco entre paragrafos" value={options.epubParagraphSpacingEm} min={0} max={3} step={0.05} suffix="em" onChange={(value) => onChange({ epubParagraphSpacingEm: value })} />
        </div>
        <ToggleOption label="Gerar sumario" checked={options.generateIndex} onChange={() => onChange({ generateIndex: !options.generateIndex })} />
      </div>
    );
  }

  if (format === "azw3" || format === "kfx") {
    return (
      <div className="space-y-4">
        <label className="block space-y-1 text-xs text-zinc-400">
          <span>Perfil Kindle</span>
          <select value={options.kindleProfile} onChange={(event) => onChange({ kindleProfile: event.target.value as ConversionOptions["kindleProfile"] })} className="h-9 w-full rounded-sm border border-zinc-800 bg-zinc-950 px-2 text-sm text-zinc-200 outline-none">
            <option value="legacy-paperwhite">Paperwhite antigo</option><option value="kindle-compatible">Compatibilidade ampla</option><option value="modern-kindle">Kindle moderno</option><option value="scribe">Kindle Scribe</option>
          </select>
        </label>
        <ToggleOption label="Preservar capa" checked={options.preserveCover} onChange={() => onChange({ preserveCover: !options.preserveCover })} />
        <ToggleOption label="Preservar metadados" checked={options.preserveMetadata} onChange={() => onChange({ preserveMetadata: !options.preserveMetadata })} />
        <ToggleOption label="Gerar sumario" checked={options.generateIndex} onChange={() => onChange({ generateIndex: !options.generateIndex })} />
      </div>
    );
  }

  if (format === "html") return <ToggleOption label="Preservar metadados" checked={options.preserveMetadata} onChange={() => onChange({ preserveMetadata: !options.preserveMetadata })} />;
  if (format === "txt") return (
    <label className="block space-y-1 text-xs text-zinc-400">
      <span>Quebra de linha</span>
      <select value={options.txtLineEnding} onChange={(event) => onChange({ txtLineEnding: event.target.value as ConversionOptions["txtLineEnding"] })} className="h-9 w-full rounded-sm border border-zinc-800 bg-zinc-950 px-2 text-sm text-zinc-200 outline-none">
        <option value="crlf">Windows (CRLF)</option><option value="lf">Unix (LF)</option>
      </select>
    </label>
  );
  return (
    <div className="space-y-2">
      <ToggleOption label="Preservar capa" checked={options.preserveCover} onChange={() => onChange({ preserveCover: !options.preserveCover })} />
      <ToggleOption label="Preservar metadados" checked={options.preserveMetadata} onChange={() => onChange({ preserveMetadata: !options.preserveMetadata })} />
    </div>
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
  onOpenConverted?: (item: ConversionQueueItem) => void;
  className?: string;
}

function ConversionWorkspace({ onClose, onOpenConverted, className }: ConversionWorkspaceProps) {
  const {
    draftBooks,
    queue,
    logs,
    clearLogs,
    addDraftBooks,
    removeDraftBook,
    clearDraft,
    startConversionWithConfigs,
    cancelConversion,
    deleteConversion,
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

  const defaultConfigFor = useCallback((book: BookWithThumbnail) => ({
    targetFormat: (outputFormats.find((format) => canConvertBook(book, format.value))?.value || "epub") as ConversionOutputFormat,
    profile: "ereader" as ConversionProfile,
    options: { ...defaultConversionOptions },
  }), []);

  const getBookConfig = useCallback(
    (book: BookWithThumbnail): {
      targetFormat: ConversionOutputFormat;
      profile: ConversionProfile;
      options: ConversionOptions;
      outputPath?: string;
    } => {
      return (
        bookConfigs.get(book.fileHash) || defaultConfigFor(book)
      );
    },
    [bookConfigs, defaultConfigFor],
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
        const book = draftBooks.find((candidate) => candidate.fileHash === bookHash);
        const existing = next.get(bookHash) || (book ? defaultConfigFor(book) : {
          targetFormat: "epub" as ConversionOutputFormat,
          profile: "ereader" as ConversionProfile,
          options: { ...defaultConversionOptions },
        });
        next.set(bookHash, { ...existing, ...updates });
        return next;
      });
    },
    [defaultConfigFor, draftBooks],
  );

  const updateBookOptions = useCallback(
    (bookHash: string, updates: Partial<ConversionOptions>) => {
      setBookConfigs((prev) => {
        const next = new Map(prev);
        const book = draftBooks.find((candidate) => candidate.fileHash === bookHash);
        const existing = next.get(bookHash) || (book ? defaultConfigFor(book) : {
          targetFormat: "epub" as ConversionOutputFormat,
          profile: "ereader" as ConversionProfile,
          options: { ...defaultConversionOptions },
        });
        next.set(bookHash, {
          ...existing,
          options: {
            ...existing.options,
            ...updates,
          },
        });
        return next;
      });
    },
    [defaultConfigFor, draftBooks],
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

  const visibleQueue = queue;
  const visibleItemIds = useMemo(() => new Set(visibleQueue.map((item) => item.id)), [visibleQueue]);
  const visibleLogs = useMemo(
    () => logs.filter((entry) => !entry.itemId || visibleItemIds.size === 0 || visibleItemIds.has(entry.itemId)),
    [logs, visibleItemIds],
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
    clearDraft();
  };

  const handleDeleteConversion = async (item: ConversionQueueItem) => {
    if (item.status === "done" && !window.confirm(`Excluir o arquivo convertido de "${getTitleWithoutExtension(item.book.title, item.book.fileType)}" do disco?`)) {
      return;
    }
    await deleteConversion(item.id);
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
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:overflow-hidden xl:grid-cols-[minmax(0,1fr)_400px]">
        <main className="flex-none overflow-visible pr-0.5 lg:min-h-0 lg:overflow-y-auto">
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
                <table className="w-full min-w-[800px] table-fixed text-left text-sm">
                  <thead className="text-xs text-zinc-500">
                    <tr className="border-b border-zinc-800">
                      <th className="w-[200px] px-4 py-3 font-medium">Livro</th>
                      <th className="w-[120px] px-3 py-3 font-medium">Origem - Saida</th>
                      <th className="w-[170px] px-3 py-3 font-medium">Progresso</th>
                      <th className="w-[130px] px-3 py-3 font-medium">Status</th>
                      <th className="w-[60px] px-2 py-3 font-medium">Tamanho</th>
                      <th className="w-[120px] px-2 py-3 font-medium">Acoes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {visibleQueue.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
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
                            <td className="w-[200px] px-4 py-2.5">
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
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-2">
                                <span className="text-zinc-300">{item.sourceFormat.toUpperCase()}</span>
                                <ArrowRight size={14} className="text-zinc-600" />
                                <span className="rounded-sm border border-green-500/50 bg-green-500/10 px-2 py-0.5 text-xs text-green-200">
                                  {item.targetFormat.toUpperCase()}
                                </span>
                              </div>
                            </td>
                            <td className="w-[170px] px-3 py-2.5">
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-24 flex-shrink-0 overflow-hidden rounded-full bg-zinc-800">
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
                            <td className="truncate px-3 py-2.5">
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
                                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-amber-300/30 border-t-amber-300" aria-hidden="true" />
                                ) : (
                                  <Clock3 size={15} />
                                )}
                                {statusLabel(item)}
                              </span>
                            </td>
                            <td className="px-2 py-2.5 text-xs text-zinc-400">
                              {item.status === "done" ? (
                                formatFileSize(estimatedOutputSize)
                              ) : (
                                <span className="text-zinc-600">-</span>
                              )}
                            </td>
                            <td className="px-2 py-2.5">
                              <div className="flex items-center gap-1">
                                {["pending", "running"].includes(item.status) && (
                                  <button
                                    type="button"
                                    onClick={() => void cancelConversion(item.id)}
                                    className="inline-flex h-7 w-7 items-center justify-center rounded-sm text-zinc-400 hover:bg-zinc-800 hover:text-amber-300"
                                    title="Parar conversao"
                                    aria-label={`Parar conversao de ${item.book.title}`}
                                  >
                                    <Square size={13} fill="currentColor" />
                                  </button>
                                )}
                                {item.status === "done" && (
                                  <>
                                    <button
                                      type="button"
                                      disabled={!item.outputHash || !["pdf", "epub"].includes(item.targetFormat)}
                                      onClick={() => onOpenConverted?.(item)}
                                      className="inline-flex h-7 w-7 items-center justify-center rounded-sm text-zinc-400 hover:bg-zinc-800 hover:text-green-300 disabled:cursor-not-allowed disabled:opacity-30"
                                      title="Abrir no Lyceum"
                                      aria-label={`Abrir ${item.book.title} convertido no Lyceum`}
                                    >
                                      <BookOpen size={15} />
                                    </button>
                                    <button
                                      type="button"
                                      disabled={!item.outputPath}
                                      onClick={() => item.outputPath && window.api.showBookInFolder(item.outputPath)}
                                      className="inline-flex h-7 w-7 items-center justify-center rounded-sm text-zinc-400 hover:bg-zinc-800 hover:text-green-300 disabled:cursor-not-allowed disabled:opacity-30"
                                      title="Mostrar na pasta"
                                      aria-label={`Mostrar ${item.book.title} convertido na pasta`}
                                    >
                                      <FolderOpen size={15} />
                                    </button>
                                  </>
                                )}
                                {["done", "error", "canceled"].includes(item.status) && (
                                  <button
                                    type="button"
                                    onClick={() => void handleDeleteConversion(item)}
                                    className="inline-flex h-7 w-7 items-center justify-center rounded-sm text-zinc-400 hover:bg-red-500/10 hover:text-red-300"
                                    title={item.status === "done" ? "Excluir arquivo convertido" : "Remover da fila"}
                                    aria-label={item.status === "done" ? `Excluir arquivo convertido de ${item.book.title}` : `Remover ${item.book.title} da fila`}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <section className="mb-3 overflow-hidden rounded-sm border border-zinc-800 bg-zinc-950">
              <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
                  <ListTree size={15} className="text-green-400" />
                  Logs da conversao
                </h2>
                <button type="button" onClick={clearLogs} disabled={logs.length === 0} className="inline-flex h-8 w-8 items-center justify-center rounded-sm text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-30" title="Limpar logs" aria-label="Limpar logs de conversao">
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="max-h-56 overflow-y-auto font-mono text-xs">
                {visibleLogs.length === 0 ? (
                  <div className="px-4 py-6 text-center font-sans text-sm text-zinc-600">Nenhum evento registrado nesta sessao.</div>
                ) : visibleLogs.map((entry) => (
                  <div key={entry.id} className="grid grid-cols-[5.25rem_4.5rem_minmax(0,1fr)] gap-2 border-b border-zinc-900 px-4 py-2 last:border-0">
                    <time className="text-zinc-600">{new Date(entry.timestamp).toLocaleTimeString("pt-BR", { hour12: false })}</time>
                    <span className={entry.level === "error" ? "text-red-400" : entry.level === "warning" ? "text-amber-300" : entry.level === "success" ? "text-green-400" : "text-sky-300"}>{entry.level.toUpperCase()}</span>
                    <span className="min-w-0 break-words text-zinc-300">{entry.message}{entry.detail && <span className="mt-0.5 block text-zinc-600">{entry.detail}</span>}</span>
                  </div>
                ))}
              </div>
            </section>

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
                  <div className="flex items-center gap-1">
                    <button type="button" disabled={!item.outputHash || !["pdf", "epub"].includes(item.targetFormat)} onClick={() => onOpenConverted?.(item)} className="inline-flex h-8 w-8 items-center justify-center rounded-sm text-zinc-400 hover:bg-zinc-800 hover:text-green-300 disabled:opacity-30" title="Abrir no Lyceum"><BookOpen size={14} /></button>
                    <button type="button" disabled={!item.outputPath} onClick={() => item.outputPath && window.api.showBookInFolder(item.outputPath)} className="inline-flex h-8 w-8 items-center justify-center rounded-sm text-zinc-400 hover:bg-zinc-800 hover:text-green-300 disabled:opacity-30" title="Mostrar na pasta"><FolderOpen size={14} /></button>
                    <button type="button" onClick={() => void handleDeleteConversion(item)} className="inline-flex h-8 w-8 items-center justify-center rounded-sm text-zinc-400 hover:bg-red-500/10 hover:text-red-300" title="Excluir arquivo convertido" aria-label={`Excluir arquivo convertido de ${item.book.title}`}><Trash2 size={14} /></button>
                  </div>
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

        <aside className="flex-none overflow-visible rounded-sm border border-zinc-800 bg-zinc-900/60 lg:min-h-0 lg:overflow-y-auto">
          <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
            <div className="min-w-0">
              <h2 className="font-semibold text-zinc-100">Configuracao de conversao</h2>
              {selectedBook && (
                <p className="truncate text-xs text-zinc-500">
                  {getTitleWithoutExtension(selectedBook.title, selectedBook.fileType)}
                </p>
              )}
            </div>
          </div>

           {!selectedBook ? (
             <div className="flex min-h-64 flex-col items-center justify-center gap-3 p-6 text-center text-sm text-zinc-500">
               <Info size={28} className="text-zinc-600" />
               <p>Selecione ou adicione um livro para configurar a conversao</p>
             </div>
           ) : (
             (() => {
               const cfg = getBookConfig(selectedBook);

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
                     <h3 className="mb-3 text-sm font-semibold text-zinc-100">Opcoes para {cfg.targetFormat.toUpperCase()}</h3>
                     <FormatOptions
                       format={cfg.targetFormat}
                       options={cfg.options}
                       onChange={(updates) => updateBookOptions(selectedBook.fileHash, updates)}
                     />
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
                           {convertibleCount} {convertibleCount === 1 ? "livro" : "livros"} <span className="text-zinc-500">-</span> configuracoes individuais
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
              disabled={convertibleCount === 0}
              onClick={handleStart}
              className="flex h-11 flex-[1.8] items-center justify-center gap-2 rounded-sm bg-green-500 text-sm font-semibold text-zinc-950 hover:bg-green-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send size={16} />
              Converter {convertibleCount} {convertibleCount === 1 ? "livro" : "livros"}
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
  onOpenConverted?: (item: ConversionQueueItem) => void;
}

export function ConversionDialog({ isOpen, onClose, onOpenConverted }: ConversionDialogProps) {
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
          <ConversionWorkspace onClose={onClose} onOpenConverted={onOpenConverted} className="flex-1" />
        </div>
      </div>
    </div>
  );
}

export default function ConversionPage() {
  return <ConversionWorkspace />;
}
