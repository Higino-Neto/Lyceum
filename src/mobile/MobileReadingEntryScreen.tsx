import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  Check,
  Clock3,
  Edit3,
  Loader2,
  NotebookPen,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import MobileAccountGate from "./MobileAccountGate";
import {
  createMobileReadingEntry,
  deleteMobileReadingEntry,
  getMobileCategories,
  getMobileReadingQueryEnabled,
  getMobileUserReadings,
  getOrCreateMobileBook,
  updateMobileReadingEntry,
  type MobileCategory,
  type MobileReadingEntry,
} from "./readingApi";
import { formatReadingMinutes, toLocalIsoDate } from "./mobileReadingStats";
import type { MobileBook } from "./types";

interface MobileReadingEntryScreenProps {
  books: MobileBook[];
  sessionEmail: string | null;
  selectedBook?: MobileBook | null;
  onOpenProfile: () => void;
}

interface EditingDraft {
  id: string;
  sourceName: string;
  pages: string;
  readingTime: string;
  readingDate: string;
  categoryId: string;
}

function invalidateReadingQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["mobile-readings"] });
  queryClient.invalidateQueries({ queryKey: ["mobile-reading-stats"] });
  queryClient.invalidateQueries({ queryKey: ["mobile-ranking"] });
  queryClient.invalidateQueries({ queryKey: ["mobile-heatmap"] });
}

function categoryIdForBook(book: MobileBook | null | undefined, categories: MobileCategory[]) {
  if (!book?.category) return categories[0]?.id || "";
  return (
    categories.find(
      (category) =>
        category.name.toLocaleLowerCase("pt-BR") ===
        book.category.toLocaleLowerCase("pt-BR"),
    )?.id ||
    categories[0]?.id ||
    ""
  );
}

function ReadingEditor({
  reading,
  categories,
  onClose,
}: {
  reading: MobileReadingEntry;
  categories: MobileCategory[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<EditingDraft>({
    id: reading.id,
    sourceName: reading.source_name,
    pages: String(reading.pages),
    readingTime: String(reading.reading_time),
    readingDate: reading.reading_date,
    categoryId: reading.category_id || categories[0]?.id || "",
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      updateMobileReadingEntry({
        readingId: draft.id,
        sourceName: draft.sourceName.trim(),
        pages: Number(draft.pages),
        readingDate: draft.readingDate,
        readingTime: Number(draft.readingTime),
        categoryId: draft.categoryId,
      }),
    onSuccess: () => {
      invalidateReadingQueries(queryClient);
      toast.success("Leitura atualizada");
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="fixed inset-0 z-[90] flex items-end bg-black/70 backdrop-blur-sm">
      <form
        className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-zinc-800 bg-zinc-950 p-5 pb-[max(24px,env(safe-area-inset-bottom))]"
        onSubmit={(event) => {
          event.preventDefault();
          updateMutation.mutate();
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-400">Editar registro</p>
            <h2 className="mt-1 text-lg font-semibold text-zinc-100">{reading.source_name}</h2>
          </div>
          <button className="grid h-10 w-10 place-items-center rounded bg-zinc-900" onClick={onClose} type="button" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <div className="mt-5 space-y-3">
          <input
            className="h-11 w-full rounded border border-zinc-800 bg-zinc-900 px-3 text-sm"
            value={draft.sourceName}
            onChange={(event) => setDraft((current) => ({ ...current, sourceName: event.target.value }))}
            placeholder="Livro"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              className="h-11 rounded border border-zinc-800 bg-zinc-900 px-3 text-sm"
              type="number"
              inputMode="numeric"
              min="1"
              value={draft.pages}
              onChange={(event) => setDraft((current) => ({ ...current, pages: event.target.value }))}
              placeholder="Paginas"
            />
            <input
              className="h-11 rounded border border-zinc-800 bg-zinc-900 px-3 text-sm"
              type="number"
              inputMode="numeric"
              min="1"
              value={draft.readingTime}
              onChange={(event) => setDraft((current) => ({ ...current, readingTime: event.target.value }))}
              placeholder="Minutos"
            />
          </div>
          <input
            className="h-11 w-full rounded border border-zinc-800 bg-zinc-900 px-3 text-sm"
            type="date"
            value={draft.readingDate}
            onChange={(event) => setDraft((current) => ({ ...current, readingDate: event.target.value }))}
          />
          <select
            className="h-11 w-full rounded border border-zinc-800 bg-zinc-900 px-3 text-sm"
            value={draft.categoryId}
            onChange={(event) => setDraft((current) => ({ ...current, categoryId: event.target.value }))}
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
          <button
            className="flex h-12 w-full items-center justify-center gap-2 rounded bg-emerald-600 text-sm font-semibold text-white disabled:opacity-60"
            disabled={updateMutation.isPending}
            type="submit"
          >
            {updateMutation.isPending ? <Loader2 className="animate-spin" size={17} /> : <Save size={17} />}
            Salvar
          </button>
        </div>
      </form>
    </div>
  );
}

export default function MobileReadingEntryScreen({
  books,
  sessionEmail,
  selectedBook,
  onOpenProfile,
}: MobileReadingEntryScreenProps) {
  const queryClient = useQueryClient();
  const enabled = getMobileReadingQueryEnabled(sessionEmail);
  const [bookId, setBookId] = useState(selectedBook?.id || "");
  const [sourceName, setSourceName] = useState(selectedBook?.title || "");
  const [pages, setPages] = useState("");
  const [readingTime, setReadingTime] = useState("");
  const [readingDate, setReadingDate] = useState(() => toLocalIsoDate(new Date()));
  const [categoryId, setCategoryId] = useState("");
  const [editingReading, setEditingReading] = useState<MobileReadingEntry | null>(null);

  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ["mobile-categories"],
    queryFn: getMobileCategories,
    enabled,
  });

  const { data: readings = [], isLoading: readingsLoading } = useQuery({
    queryKey: ["mobile-readings"],
    queryFn: getMobileUserReadings,
    enabled,
  });

  useEffect(() => {
    if (!selectedBook) return;
    setBookId(selectedBook.id);
    setSourceName(selectedBook.title);
    setCategoryId(categoryIdForBook(selectedBook, categories));
  }, [categories, selectedBook]);

  useEffect(() => {
    if (!categoryId && categories[0]) {
      setCategoryId(categories[0].id);
    }
  }, [categories, categoryId]);

  const selectedLocalBook = useMemo(
    () => books.find((book) => book.id === bookId) || null,
    [bookId, books],
  );

  const recentReadings = useMemo(
    () =>
      [...readings].sort((left, right) => {
        const byDate = right.reading_date.localeCompare(left.reading_date);
        if (byDate !== 0) return byDate;
        return String(right.created_at || "").localeCompare(String(left.created_at || ""));
      }),
    [readings],
  );

  const submitMutation = useMutation({
    mutationFn: async () => {
      const cleanTitle = sourceName.trim();
      const pageCount = Number(pages);
      const minutes = Number(readingTime);

      if (!cleanTitle) throw new Error("Informe o livro.");
      if (!categoryId) throw new Error("Escolha uma categoria.");
      if (!Number.isFinite(pageCount) || pageCount <= 0) throw new Error("Informe paginas validas.");
      if (!Number.isFinite(minutes) || minutes <= 0) throw new Error("Informe minutos validos.");

      const remoteBookId = await getOrCreateMobileBook(cleanTitle, categoryId, selectedLocalBook);
      await createMobileReadingEntry({
        sourceName: cleanTitle,
        pages: pageCount,
        readingDate,
        readingTime: minutes,
        categoryId,
        bookId: remoteBookId,
      });
    },
    onSuccess: () => {
      invalidateReadingQueries(queryClient);
      setPages("");
      setReadingTime("");
      toast.success("Leitura registrada");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteMobileReadingEntry,
    onSuccess: () => {
      invalidateReadingQueries(queryClient);
      toast.success("Leitura removida");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!enabled) {
    return (
      <MobileAccountGate
        title="Entre para registrar leituras"
        body="O registro, os graficos e o ranking usam a mesma conta do Lyceum desktop."
        onOpenProfile={onOpenProfile}
      />
    );
  }

  return (
    <section className="space-y-4 p-4">
      <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-400">Registrar leitura</p>
            <h2 className="mt-1 text-xl font-semibold text-zinc-100">O que voce leu?</h2>
          </div>
          <div className="grid h-11 w-11 place-items-center rounded bg-emerald-500/10 text-emerald-400">
            <NotebookPen size={22} />
          </div>
        </div>

        <form
          className="mt-5 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            submitMutation.mutate();
          }}
        >
          <select
            className="h-11 w-full rounded border border-zinc-800 bg-zinc-950 px-3 text-sm"
            value={bookId}
            onChange={(event) => {
              const nextBook = books.find((book) => book.id === event.target.value) || null;
              setBookId(event.target.value);
              if (nextBook) {
                setSourceName(nextBook.title);
                setCategoryId(categoryIdForBook(nextBook, categories));
              }
            }}
          >
            <option value="">Livro manual</option>
            {books.map((book) => (
              <option key={book.id} value={book.id}>{book.title}</option>
            ))}
          </select>

          <input
            className="h-11 w-full rounded border border-zinc-800 bg-zinc-950 px-3 text-sm"
            value={sourceName}
            onChange={(event) => {
              setSourceName(event.target.value);
              setBookId("");
            }}
            placeholder="Titulo do livro"
          />

          <div className="grid grid-cols-2 gap-3">
            <input
              className="h-11 rounded border border-zinc-800 bg-zinc-950 px-3 text-sm"
              type="number"
              inputMode="numeric"
              min="1"
              value={pages}
              onChange={(event) => setPages(event.target.value)}
              placeholder="Paginas"
            />
            <input
              className="h-11 rounded border border-zinc-800 bg-zinc-950 px-3 text-sm"
              type="number"
              inputMode="numeric"
              min="1"
              value={readingTime}
              onChange={(event) => setReadingTime(event.target.value)}
              placeholder="Minutos"
            />
          </div>

          <div className="grid grid-cols-[1fr_auto_auto] gap-2">
            <input
              className="h-11 min-w-0 rounded border border-zinc-800 bg-zinc-950 px-3 text-sm"
              type="date"
              value={readingDate}
              onChange={(event) => setReadingDate(event.target.value)}
            />
            <button
              className="h-11 rounded border border-zinc-800 bg-zinc-950 px-3 text-xs font-semibold text-zinc-300"
              onClick={() => setReadingDate(toLocalIsoDate(new Date()))}
              type="button"
            >
              Hoje
            </button>
            <button
              className="h-11 rounded border border-zinc-800 bg-zinc-950 px-3 text-xs font-semibold text-zinc-300"
              onClick={() => {
                const date = new Date();
                date.setDate(date.getDate() - 1);
                setReadingDate(toLocalIsoDate(date));
              }}
              type="button"
            >
              Ontem
            </button>
          </div>

          <select
            className="h-11 w-full rounded border border-zinc-800 bg-zinc-950 px-3 text-sm"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            disabled={categoriesLoading}
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>

          <button
            className="flex h-12 w-full items-center justify-center gap-2 rounded bg-emerald-600 text-sm font-semibold text-white disabled:opacity-60"
            disabled={submitMutation.isPending}
            type="submit"
          >
            {submitMutation.isPending ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
            Registrar
          </button>
        </form>
      </div>

      <div className="rounded border border-zinc-800 bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-800 p-4">
          <div className="flex items-center gap-2">
            <Clock3 size={16} className="text-zinc-500" />
            <h2 className="text-sm font-semibold text-zinc-100">Historico recente</h2>
          </div>
          {readingsLoading && <Loader2 size={16} className="animate-spin text-zinc-500" />}
        </div>

        <div className="divide-y divide-zinc-800">
          {recentReadings.slice(0, 20).map((reading) => (
            <article key={reading.id} className="flex items-center gap-3 p-4">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded bg-zinc-950 text-emerald-400">
                <CalendarDays size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-zinc-100">{reading.source_name}</p>
                <p className="mt-1 text-xs text-zinc-500">
                  {reading.reading_date} · {reading.pages}p · {formatReadingMinutes(Number(reading.reading_time || 0))}
                </p>
              </div>
              <button className="grid h-9 w-9 place-items-center rounded bg-zinc-950 text-zinc-400" onClick={() => setEditingReading(reading)} type="button" aria-label="Editar">
                <Edit3 size={15} />
              </button>
              <button
                className="grid h-9 w-9 place-items-center rounded bg-red-950/40 text-red-300 disabled:opacity-50"
                onClick={() => {
                  if (window.confirm(`Remover leitura de "${reading.source_name}"?`)) {
                    deleteMutation.mutate(reading.id);
                  }
                }}
                disabled={deleteMutation.isPending}
                type="button"
                aria-label="Remover"
              >
                {deleteMutation.isPending ? <Loader2 className="animate-spin" size={15} /> : <Trash2 size={15} />}
              </button>
            </article>
          ))}

          {!readingsLoading && recentReadings.length === 0 && (
            <div className="p-8 text-center text-sm text-zinc-500">
              Nenhuma leitura registrada ainda.
            </div>
          )}
        </div>
      </div>

      {editingReading && (
        <ReadingEditor
          reading={editingReading}
          categories={categories}
          onClose={() => setEditingReading(null)}
        />
      )}

      {!categoriesLoading && categories.length === 0 && (
        <div className="flex items-center gap-2 rounded border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
          <Check size={16} />
          Configure categorias no banco para registrar leituras.
        </div>
      )}
    </section>
  );
}
