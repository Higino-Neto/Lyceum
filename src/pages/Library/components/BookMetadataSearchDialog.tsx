import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  Download,
  ExternalLink,
  Image,
  Info,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  BookMetadataCandidate,
  MetadataSearchField,
  MetadataSearchScope,
  candidateToEditableMetadata,
  searchBookMetadataSources,
} from "../../../api/bookMetadataSearch";
import { BookWithThumbnail } from "../../../types/LibraryTypes";

type EditableMetadataForm = {
  title: string;
  subtitle: string;
  author: string;
  publisher: string;
  publishDate: string;
  language: string;
  isbn: string;
  pageCount: string;
  subject: string;
  description: string;
  identifier: string;
  asin: string;
  series: string;
  seriesIndex: string;
  authorSort: string;
  titleSort: string;
  coverUrl: string;
};

export type BookMetadataSavePayload = ReturnType<typeof normalizeForSave> & {
  coverUrl?: string;
};

interface BookMetadataSearchDialogProps {
  book: BookWithThumbnail;
  thumbnail?: string;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  onSaveMetadata?: (metadata: BookMetadataSavePayload) => Promise<void> | void;
}

const sourceOptions: Array<{ value: MetadataSearchScope; label: string }> = [
  { value: "all", label: "Todas" },
  { value: "openlibrary", label: "Open Library" },
  { value: "google", label: "Google Books" },
  { value: "loc", label: "Library of Congress" },
];

const fieldOptions: Array<{ value: MetadataSearchField; label: string }> = [
  { value: "title", label: "Titulo" },
  { value: "author", label: "Autor" },
  { value: "isbn", label: "ISBN" },
];

const formFields: Array<[keyof EditableMetadataForm, string, "input" | "textarea"]> = [
  ["title", "Titulo", "input"],
  ["subtitle", "Subtitulo", "input"],
  ["author", "Autor(es)", "input"],
  ["publisher", "Editora", "input"],
  ["publishDate", "Data", "input"],
  ["language", "Idioma", "input"],
  ["isbn", "ISBN", "input"],
  ["pageCount", "Paginas", "input"],
  ["subject", "Categorias", "input"],
  ["identifier", "Identificador", "input"],
  ["asin", "ASIN", "input"],
  ["series", "Serie", "input"],
  ["seriesIndex", "Indice", "input"],
  ["authorSort", "Autor sort", "input"],
  ["titleSort", "Titulo sort", "input"],
  ["description", "Descricao", "textarea"],
];

function titleWithoutExtension(book: BookWithThumbnail) {
  if (book.fileType) return book.title.replace(new RegExp(`\\.${book.fileType}$`, "i"), "");
  return book.title.replace(/\.[a-z0-9]+$/i, "");
}

function toInitialForm(book: BookWithThumbnail, thumbnail?: string): EditableMetadataForm {
  return {
    title: titleWithoutExtension(book),
    subtitle: "",
    author: book.author || "",
    publisher: book.publisher || "",
    publishDate: book.publishDate || "",
    language: book.language || "",
    isbn: book.isbn || "",
    pageCount: book.numPages ? String(book.numPages) : "",
    subject: book.subject || "",
    description: book.description || "",
    identifier: book.identifier || "",
    asin: book.asin || "",
    series: book.series || "",
    seriesIndex: book.seriesIndex || "",
    authorSort: book.authorSort || "",
    titleSort: book.titleSort || "",
    coverUrl: thumbnail || "",
  };
}

function compact(values: Array<string | undefined | null>) {
  return values.filter(Boolean).join(" - ");
}

function fieldState(original: EditableMetadataForm, form: EditableMetadataForm, key: keyof EditableMetadataForm) {
  if (!form[key]) return "Vazio";
  if (form[key] === original[key]) return "Atual";
  if (!original[key]) return "Importado";
  return "Editado";
}

function normalizeForSave(form: EditableMetadataForm) {
  const pageCount = Number.parseInt(form.pageCount, 10);
  return {
    title: form.title.trim() || undefined,
    author: form.author.trim() || undefined,
    description: form.description.trim() || undefined,
    isbn: form.isbn.trim() || undefined,
    publisher: form.publisher.trim() || undefined,
    publishDate: form.publishDate.trim() || undefined,
    language: form.language.trim() || undefined,
    identifier: form.identifier.trim() || undefined,
    asin: form.asin.trim() || undefined,
    subject: form.subject.trim() || undefined,
    series: form.series.trim() || undefined,
    seriesIndex: form.seriesIndex.trim() || undefined,
    authorSort: form.authorSort.trim() || undefined,
    titleSort: form.titleSort.trim() || undefined,
    pageCount: Number.isFinite(pageCount) && pageCount > 0 ? pageCount : undefined,
  };
}

function mergeCandidate(current: EditableMetadataForm, candidate: BookMetadataCandidate, overwrite: boolean) {
  const imported = candidateToEditableMetadata(candidate);
  const next = { ...current };
  const assign = (key: keyof EditableMetadataForm, value: string | number | undefined) => {
    const normalized = value === undefined ? "" : String(value);
    if (!normalized) return;
    if (overwrite || !next[key]) next[key] = normalized;
  };

  assign("title", imported.title);
  assign("subtitle", candidate.subtitle);
  assign("author", imported.author);
  assign("publisher", imported.publisher);
  assign("publishDate", imported.publishDate);
  assign("language", imported.language);
  assign("isbn", imported.isbn);
  assign("pageCount", imported.pageCount);
  assign("subject", imported.subject);
  assign("description", imported.description);
  assign("identifier", imported.identifier);
  assign("authorSort", imported.authorSort);
  assign("titleSort", imported.titleSort);
  assign("coverUrl", candidate.thumbnailUrl);
  return next;
}

function SourcePill({ source }: { source: BookMetadataCandidate["source"] }) {
  const label = source === "openlibrary" ? "OL" : source === "google" ? "GB" : "LOC";
  const className = source === "openlibrary"
    ? "bg-emerald-500/12 text-emerald-300"
    : source === "google"
      ? "bg-sky-500/12 text-sky-300"
      : "bg-violet-500/12 text-violet-300";
  return <span className={`rounded-sm px-1.5 py-0.5 text-[10px] font-medium ${className}`}>{label}</span>;
}

function FieldBadge({ state }: { state: string }) {
  const className = state === "Atual"
    ? "bg-zinc-800 text-zinc-500"
    : state === "Importado"
      ? "bg-emerald-500/12 text-emerald-300"
      : state === "Editado"
        ? "bg-sky-500/12 text-sky-300"
        : "bg-zinc-900 text-zinc-600";
  return <span className={`rounded-sm px-1.5 py-0.5 text-[10px] ${className}`}>{state}</span>;
}

export default function BookMetadataSearchDialog({
  book,
  thumbnail,
  isOpen,
  onClose,
  onSaved,
  onSaveMetadata,
}: BookMetadataSearchDialogProps) {
  const originalForm = useMemo(() => toInitialForm(book, thumbnail), [book, thumbnail]);
  const [form, setForm] = useState(originalForm);
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<MetadataSearchScope>("all");
  const [searchField, setSearchField] = useState<MetadataSearchField>("title");
  const [results, setResults] = useState<BookMetadataCandidate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [overwrite, setOverwrite] = useState(true);
  const [saveCover, setSaveCover] = useState(true);
  const [showChangedOnly, setShowChangedOnly] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setForm(originalForm);
    setQuery(book.isbn || titleWithoutExtension(book) || book.author || "");
    setSearchField(book.isbn ? "isbn" : "title");
    setSource("all");
    setResults([]);
    setSelectedId(null);
    setWarnings([]);
    setSearchError(null);
    setShowChangedOnly(false);
  }, [book, isOpen, originalForm]);

  if (!isOpen) return null;

  const selected = results.find((result) => result.id === selectedId) || null;
  const changedCount = (Object.keys(form) as Array<keyof EditableMetadataForm>)
    .filter((key) => form[key] !== originalForm[key]).length;
  const visibleFields = formFields.filter(([key]) => !showChangedOnly || form[key] !== originalForm[key]);
  const hasRemoteCover = /^https?:\/\//i.test(form.coverUrl);

  const runSearch = async () => {
    const cleanQuery = query.trim();
    if (cleanQuery.length < 2) {
      toast.error("Digite pelo menos 2 caracteres para pesquisar.");
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    setWarnings([]);
    try {
      const response = window.api?.searchBookMetadata
        ? await window.api.searchBookMetadata(source, cleanQuery, searchField, 18)
        : { success: true, ...(await searchBookMetadataSources(source, cleanQuery, searchField, 18)) };

      if (!response.success) {
        setResults([]);
        setSelectedId(null);
        setSearchError(response.error || "Nao foi possivel pesquisar metadados.");
        return;
      }

      setResults(response.results);
      setSelectedId(response.results[0]?.id || null);
      setWarnings(response.warnings || []);
      if (response.results.length === 0) {
        setSearchError(response.warnings?.length ? null : "Nenhum resultado encontrado.");
      }
    } catch (error) {
      setResults([]);
      setSelectedId(null);
      setSearchError(error instanceof Error ? error.message : "Erro ao pesquisar metadados.");
    } finally {
      setIsSearching(false);
    }
  };

  const applySelected = () => {
    if (!selected) return;
    setForm((current) => mergeCandidate(current, selected, overwrite));
  };

  const saveMetadata = async () => {
    if (!form.title.trim()) {
      toast.error("O titulo nao pode ficar vazio.");
      return;
    }

    setIsSaving(true);
    const loadingToast = toast.loading("Salvando metadados...");
    try {
      if (onSaveMetadata) {
        await onSaveMetadata({
          ...normalizeForSave(form),
          coverUrl: saveCover ? form.coverUrl.trim() || undefined : undefined,
        });
        toast.success("Metadados salvos.", { id: loadingToast });
        onSaved();
        onClose();
        return;
      }

      let currentHash = book.fileHash;
      const metadataResult = await window.api.updateMetadata(book.fileHash, normalizeForSave(form));
      if (!metadataResult.success) {
        toast.error(metadataResult.error || "Erro ao salvar metadados", { id: loadingToast });
        return;
      }

      currentHash = metadataResult.fileHash || currentHash;
      const saveWarnings = [...(metadataResult.warnings || [])];
      if (saveCover && hasRemoteCover && form.coverUrl !== originalForm.coverUrl) {
        const coverResult = await window.api.setThumbnailFromUrl(currentHash, form.coverUrl, "replace");
        if (coverResult.success) {
          currentHash = coverResult.fileHash || currentHash;
          saveWarnings.push(...(coverResult.warnings || []));
        } else {
          saveWarnings.push(coverResult.error || "Nao foi possivel atualizar a capa.");
        }
      }

      toast.success(
        saveWarnings.length
          ? `Metadados salvos com ${saveWarnings.length} aviso(s).`
          : "Metadados salvos.",
        { id: loadingToast },
      );
      onSaved();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar metadados", { id: loadingToast });
    } finally {
      setIsSaving(false);
    }
  };

  const updateField = (key: keyof EditableMetadataForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
      <div className="flex h-[min(860px,94vh)] w-full max-w-6xl flex-col overflow-hidden rounded-md border border-zinc-800 bg-zinc-950 shadow-2xl">
        <div className="flex flex-shrink-0 items-start justify-between border-b border-zinc-800 px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-zinc-100">Editar metadados</h2>
            <p className="mt-1 truncate text-xs text-zinc-500">{titleWithoutExtension(book)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-sm p-2 text-zinc-500 transition-colors hover:bg-zinc-900 hover:text-zinc-200 disabled:opacity-50"
            title="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[370px_minmax(0,1fr)]">
          <aside className="flex min-h-0 flex-col border-b border-zinc-800 bg-zinc-950 lg:border-b-0 lg:border-r">
            <div className="space-y-3 border-b border-zinc-800 p-4">
              <div className="flex h-10 items-center gap-2 rounded-sm border border-zinc-800 bg-zinc-900 px-3">
                <Search size={15} className="text-zinc-500" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void runSearch();
                  }}
                  className="min-w-0 flex-1 bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
                  placeholder="Titulo, autor ou ISBN"
                />
              </div>

              <div className="grid grid-cols-4 gap-1 rounded-sm bg-zinc-900 p-1">
                {sourceOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setSource(option.value)}
                    className={`h-8 min-w-0 rounded-sm px-1 text-[11px] transition-colors ${
                      source === option.value
                        ? "bg-emerald-500 text-zinc-950"
                        : "text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
                    }`}
                    title={option.label}
                  >
                    <span className="block truncate">{option.label}</span>
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="flex gap-1 rounded-sm bg-zinc-900 p-1">
                  {fieldOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setSearchField(option.value)}
                      className={`h-8 rounded-sm px-3 text-xs transition-colors ${
                        searchField === option.value
                          ? "bg-zinc-800 text-emerald-300"
                          : "text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => void runSearch()}
                  disabled={isSearching}
                  className="flex h-9 items-center gap-1.5 rounded-sm bg-emerald-500 px-3 text-xs font-medium text-zinc-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSearching ? <RefreshCw size={13} className="animate-spin" /> : <Search size={13} />}
                  Buscar
                </button>
              </div>
            </div>

            {(searchError || warnings.length > 0) && (
              <div className="space-y-1 border-b border-zinc-800 bg-zinc-950 px-4 py-3 text-xs">
                {searchError && (
                  <div className="flex gap-2 text-red-300">
                    <AlertCircle size={13} className="mt-0.5 flex-shrink-0" />
                    <span>{searchError}</span>
                  </div>
                )}
                {warnings.map((warning) => (
                  <div key={warning} className="flex gap-2 text-amber-300">
                    <AlertCircle size={13} className="mt-0.5 flex-shrink-0" />
                    <span>{warning}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2 text-xs text-zinc-500">
              <span>{results.length} resultado(s)</span>
              {selected && <span>{selected.sourceLabel}</span>}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {results.length === 0 ? (
                <div className="flex h-full min-h-[260px] flex-col items-center justify-center rounded-sm border border-dashed border-zinc-800 px-6 text-center">
                  <Search size={22} className="mb-3 text-zinc-600" />
                  <p className="text-sm text-zinc-500">Pesquise para encontrar metadados gratuitos.</p>
                  <p className="mt-1 text-xs text-zinc-700">Open Library, Google Books e Library of Congress.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {results.map((result) => (
                    <button
                      key={result.id}
                      type="button"
                      onClick={() => setSelectedId(result.id)}
                      className={`flex w-full gap-3 rounded-sm border p-2 text-left transition-colors ${
                        selectedId === result.id
                          ? "border-emerald-500/70 bg-emerald-500/10"
                          : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700"
                      }`}
                    >
                      <div className="h-24 w-16 flex-shrink-0 overflow-hidden rounded-sm bg-zinc-900">
                        {result.thumbnailUrl ? (
                          <img src={result.thumbnailUrl} alt="" className="h-full w-full object-contain" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-zinc-700">
                            <Image size={18} />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="line-clamp-2 text-sm font-medium text-zinc-100">{result.title}</p>
                          {selectedId === result.id && <Check size={15} className="mt-0.5 flex-shrink-0 text-emerald-300" />}
                        </div>
                        <p className="mt-1 truncate text-xs text-zinc-400">{result.authors.join(", ") || "Autor desconhecido"}</p>
                        <p className="mt-1 truncate text-xs text-zinc-600">
                          {compact([result.publishedDate, result.publisher, result.language]) || result.sourceLabel}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          <SourcePill source={result.source} />
                          {(result.isbn13 || result.isbn10) && (
                            <span className="rounded-sm bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-500">ISBN</span>
                          )}
                          {result.pageCount && (
                            <span className="rounded-sm bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-500">{result.pageCount}p</span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 border-t border-zinc-800 p-3">
              <button
                type="button"
                onClick={applySelected}
                disabled={!selected}
                className="flex h-9 items-center justify-center gap-1.5 rounded-sm bg-emerald-500 px-3 text-xs font-medium text-zinc-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Download size={13} />
                Aplicar
              </button>
              <button
                type="button"
                onClick={() => setShowChangedOnly((value) => !value)}
                className="flex h-9 items-center justify-center rounded-sm border border-zinc-800 bg-zinc-900 px-3 text-xs text-zinc-300 transition-colors hover:bg-zinc-800"
              >
                {showChangedOnly ? "Mostrar todos" : "Comparar"}
              </button>
            </div>
          </aside>

          <section className="min-h-0 overflow-y-auto p-5">
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_160px]">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {visibleFields.map(([key, label, type]) => (
                  <label key={key} className={type === "textarea" ? "sm:col-span-2" : ""}>
                    <span className="mb-1 flex items-center justify-between gap-2 text-xs text-zinc-500">
                      {label}
                      <FieldBadge state={fieldState(originalForm, form, key)} />
                    </span>
                    {type === "textarea" ? (
                      <textarea
                        value={form[key]}
                        onChange={(event) => updateField(key, event.target.value)}
                        rows={5}
                        className="w-full resize-none rounded-sm border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 outline-none transition-colors focus:border-emerald-500"
                      />
                    ) : (
                      <input
                        value={form[key]}
                        onChange={(event) => updateField(key, event.target.value)}
                        className="h-9 w-full rounded-sm border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-200 outline-none transition-colors focus:border-emerald-500"
                      />
                    )}
                  </label>
                ))}
              </div>

              <div className="space-y-3">
                <div className="aspect-[3/4] overflow-hidden rounded-sm border border-zinc-800 bg-zinc-900">
                  {form.coverUrl ? (
                    <img src={form.coverUrl} alt="" className="h-full w-full object-contain" />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-zinc-700">
                      <Image size={24} />
                      <span className="text-xs">Sem capa</span>
                    </div>
                  )}
                </div>

                {selected?.externalUrl && (
                  <a
                    href={selected.externalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex h-9 items-center justify-center gap-1.5 rounded-sm border border-zinc-800 text-xs text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-200"
                  >
                    <ExternalLink size={13} />
                    Fonte
                  </a>
                )}

                <label className="flex items-start gap-2 text-xs text-zinc-400">
                  <input
                    type="checkbox"
                    checked={overwrite}
                    onChange={(event) => setOverwrite(event.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-emerald-500"
                  />
                  Sobrescrever campos existentes ao aplicar
                </label>
                <label className="flex items-start gap-2 text-xs text-zinc-400">
                  <input
                    type="checkbox"
                    checked={saveCover}
                    onChange={(event) => setSaveCover(event.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-emerald-500"
                  />
                  Salvar capa/thumbnail remoto
                </label>

                <div className="rounded-sm border border-zinc-800 bg-zinc-900/60 p-2 text-xs text-zinc-500">
                  <div className="mb-1 flex items-center gap-1.5 text-zinc-400">
                    <Info size={12} />
                    {changedCount} campo(s) alterados
                  </div>
                  Biblioteca atualizada em todos os formatos; arquivo fisico atualizado quando houver suporte.
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-2 border-t border-zinc-800 px-5 py-4">
          <button
            type="button"
            onClick={() => setForm(originalForm)}
            disabled={isSaving}
            className="flex h-9 items-center gap-1.5 rounded-sm px-3 text-xs text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-100 disabled:opacity-50"
          >
            <RotateCcw size={13} />
            Restaurar original
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="h-9 rounded-sm border border-zinc-800 bg-zinc-900 px-4 text-sm text-zinc-300 transition-colors hover:bg-zinc-800 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void saveMetadata()}
              disabled={isSaving}
              className="flex h-9 items-center gap-1.5 rounded-sm bg-emerald-500 px-4 text-sm font-medium text-zinc-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
              Salvar metadados
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
