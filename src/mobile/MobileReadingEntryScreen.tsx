import { useMemo, useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, CalendarDays, Check, ChevronDown, Clock3, Edit3, Loader2, Plus, Search, Tags, Trash2, X } from "lucide-react";
import { useMobileConfirm } from "./MobileConfirmDialog";
import MobileAccountGate from "./MobileAccountGate";
import MobileQueryError from "./MobileQueryError";
import { MobileFieldFrame, MobileInput, MobileSelect } from "./MobileControls";
import { createMobileReadingEntry, deleteMobileReadingEntry, getMobileCategories, getMobileReadingQueryEnabled, getMobileUserReadings, getOrCreateMobileBook, updateMobileReadingEntry, type MobileCategory, type MobileReadingEntry } from "./readingApi";
import { formatReadingMinutes, toLocalIsoDate } from "./mobileReadingStats";
import type { MobileBook } from "./types";

interface Props { books: MobileBook[]; sessionEmail: string | null; selectedBook?: MobileBook | null; onOpenProfile: () => void }
interface Draft { sourceName: string; localBookId: string; remoteBookId: string; pages: string; minutes: string; date: string; categoryId: string }
type Field = keyof Draft;
type Errors = Partial<Record<"sourceName" | "pages" | "minutes" | "date" | "categoryId", string>>;

const today = () => toLocalIsoDate(new Date());
const yesterday = () => { const date = new Date(); date.setDate(date.getDate() - 1); return toLocalIsoDate(date); };
const emptyDraft = (book?: MobileBook | null): Draft => ({ sourceName: book?.title || "", localBookId: book?.id || "", remoteBookId: "", pages: "", minutes: "", date: today(), categoryId: "" });
const draftKey = (email: string | null) => `lyceum-mobile-reading-draft:${email?.toLowerCase() || "anonymous"}`;
function restoredDraft(email: string | null, book?: MobileBook | null): Draft {
  if (book) return emptyDraft(book);
  try { const saved = JSON.parse(localStorage.getItem(draftKey(email)) || "null") as Partial<Draft> | null; if (saved && typeof saved.sourceName === "string") return { ...emptyDraft(), ...saved }; } catch { /* Invalid old draft. */ }
  return emptyDraft();
}
function categoryForBook(book: MobileBook, categories: MobileCategory[]) { return categories.find((item) => item.name.toLocaleLowerCase("pt-BR") === book.category?.toLocaleLowerCase("pt-BR"))?.id || ""; }
function dateLabel(value: string) { const date = new Date(`${value}T12:00:00Z`); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(date); }
function validate(draft: Draft): Errors {
  const errors: Errors = {};
  if (!draft.sourceName.trim()) errors.sourceName = "Escolha ou informe um livro.";
  if (!/^\d+$/.test(draft.pages) || !Number.isSafeInteger(Number(draft.pages)) || Number(draft.pages) < 1) errors.pages = "Informe um número inteiro de páginas maior que zero.";
  if (!/^\d+$/.test(draft.minutes) || !Number.isSafeInteger(Number(draft.minutes)) || Number(draft.minutes) < 1) errors.minutes = "Informe os minutos de leitura.";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(draft.date) ? new Date(`${draft.date}T12:00:00Z`) : new Date(NaN);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== draft.date || draft.date > today()) errors.date = "Escolha uma data válida até hoje.";
  if (!draft.categoryId) errors.categoryId = "Escolha uma categoria.";
  return errors;
}
function invalidate(queryClient: ReturnType<typeof useQueryClient>) { for (const key of ["mobile-readings", "mobile-reading-stats", "mobile-ranking", "mobile-heatmap"]) void queryClient.invalidateQueries({ queryKey: [key] }); }

function ReadingForm({ draft, onChange, books, readings, categories, pending, error, onSubmit, editing = false }: {
  draft: Draft; onChange: (field: Field, value: string) => void; books: MobileBook[]; readings: MobileReadingEntry[]; categories: MobileCategory[]; pending: boolean; error: string | null; onSubmit: () => void; editing?: boolean;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [showCalendar, setShowCalendar] = useState(draft.date !== today() && draft.date !== yesterday());
  const [errors, setErrors] = useState<Errors>({});
  const candidates = useMemo(() => {
    const result: Array<{ title: string; localBook?: MobileBook; reading?: MobileReadingEntry }> = [];
    const byTitle = new Map<string, typeof result[number]>();
    for (const reading of [...readings].sort((a, b) => b.reading_date.localeCompare(a.reading_date))) { const key = reading.source_name.trim().toLocaleLowerCase("pt-BR"); if (key && !byTitle.has(key)) { const item = { title: reading.source_name, reading }; byTitle.set(key, item); result.push(item); } }
    for (const book of [...books].sort((a, b) => String(b.lastOpenedAt || "").localeCompare(String(a.lastOpenedAt || "")))) { const key = book.title.trim().toLocaleLowerCase("pt-BR"); if (!key) continue; const existing = byTitle.get(key); if (existing) existing.localBook = book; else { const item = { title: book.title, localBook: book }; byTitle.set(key, item); result.push(item); } }
    return result;
  }, [books, readings]);
  const matches = candidates.filter((item) => item.title.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR"))).slice(0, search ? 12 : 6);
  const change = (field: Field, value: string) => { onChange(field, value); if (field in errors) setErrors((current) => ({ ...current, [field]: undefined })); };
  const choose = (item: typeof candidates[number]) => {
    change("sourceName", item.title); onChange("localBookId", item.localBook?.id || ""); onChange("remoteBookId", item.reading?.book_id || "");
    const id = item.localBook ? categoryForBook(item.localBook, categories) || item.reading?.category_id || "" : item.reading?.category_id || "";
    change("categoryId", categories.some((category) => category.id === id) ? id : ""); setPickerOpen(false); setSearch("");
  };
  const chooseManual = () => { change("sourceName", search.trim()); onChange("localBookId", ""); onChange("remoteBookId", ""); change("categoryId", ""); setPickerOpen(false); };
  return <form className="space-y-5" noValidate onSubmit={(event) => { event.preventDefault(); const next = validate(draft); setErrors(next); if (Object.keys(next).length === 0) onSubmit(); }}>
    <div><label className="mb-2 block text-sm font-semibold text-zinc-200" htmlFor={editing ? "reading-book" : "reading-book-trigger"}>Livro</label>
      {editing ? <input id="reading-book" className="mobile-field" value={draft.sourceName} onChange={(event) => change("sourceName", event.target.value)} /> : <>
        <button id="reading-book-trigger" className="mobile-field mobile-book-trigger text-left" onClick={() => setPickerOpen((value) => !value)} type="button" aria-label={draft.sourceName ? `Livro: ${draft.sourceName}. Alterar livro` : "Escolher livro ou digitar título"} aria-expanded={pickerOpen} aria-controls="reading-book-picker"><BookOpen size={19} className="shrink-0 text-emerald-400" /><span className={`min-w-0 flex-1 truncate ${draft.sourceName ? "text-zinc-100" : "text-zinc-500"}`}>{draft.sourceName || "Escolher livro ou digitar título"}</span><ChevronDown size={18} className="shrink-0 text-zinc-500" /></button>
        {pickerOpen && <div id="reading-book-picker" className="mt-2 rounded-2xl border border-zinc-700 bg-zinc-900 p-3"><MobileInput aria-label="Buscar livro" icon={Search} value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); if (matches[0]) choose(matches[0]); else if (search.trim()) chooseManual(); } }} placeholder="Buscar na biblioteca ou no histórico" autoFocus /><p className="mb-1 mt-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">{search ? "Resultados" : "Livros recentes"}</p><div className="max-h-56 overflow-y-auto">{matches.map((item) => <button key={item.localBook?.id || item.reading?.book_id || item.title} className="flex min-h-12 w-full items-center gap-3 border-b border-zinc-800 px-2 text-left text-sm last:border-0" onClick={() => choose(item)} type="button"><BookOpen size={17} className="shrink-0 text-zinc-500" /><span className="min-w-0 flex-1 truncate">{item.title}</span></button>)}{matches.length === 0 && <p className="px-2 py-3 text-sm text-zinc-500">Nenhum livro encontrado.</p>}</div><button className="mt-2 min-h-11 w-full rounded-xl bg-zinc-800 px-3 text-left text-sm font-semibold text-emerald-300" onClick={chooseManual} disabled={!search.trim()} type="button">Usar “{search.trim() || "outro livro"}”</button></div>}
      </>}{errors.sourceName && <p className="mobile-field-error">{errors.sourceName}</p>}
    </div>
    <div className="grid grid-cols-1 gap-4 min-[380px]:grid-cols-2">
      <MobileFieldFrame label="Páginas lidas" htmlFor="reading-pages" error={errors.pages}>
        <div className="relative"><MobileInput id="reading-pages" icon={BookOpen} className="pr-16" type="text" inputMode="numeric" pattern="[0-9]*" value={draft.pages} onChange={(event) => change("pages", event.target.value)} placeholder="Ex.: 24" /><span className="pointer-events-none absolute right-4 top-3.5 text-sm text-zinc-500">pág.</span></div>
      </MobileFieldFrame>
      <MobileFieldFrame label="Tempo de leitura" htmlFor="reading-minutes" error={errors.minutes}>
        <div className="relative"><MobileInput id="reading-minutes" icon={Clock3} className="pr-16" type="text" inputMode="numeric" pattern="[0-9]*" value={draft.minutes} onChange={(event) => change("minutes", event.target.value)} placeholder="Ex.: 30" /><span className="pointer-events-none absolute right-4 top-3.5 text-sm text-zinc-500">min</span></div>
      </MobileFieldFrame>
    </div>
    <div><span className="mb-2 block text-sm font-semibold text-zinc-200">Quando você leu?</span><div className="grid grid-cols-3 gap-2">{[{ label: "Hoje", value: today() }, { label: "Ontem", value: yesterday() }].map((item) => <button key={item.label} className={`mobile-choice ${draft.date === item.value ? "mobile-choice-active" : ""}`} onClick={() => { change("date", item.value); setShowCalendar(false); }} type="button" aria-pressed={draft.date === item.value}>{item.label}</button>)}<button className={`mobile-choice ${draft.date !== today() && draft.date !== yesterday() ? "mobile-choice-active" : ""}`} onClick={() => setShowCalendar(true)} type="button">Outra data</button></div>{showCalendar && <input aria-label="Data da leitura" className="mobile-field mt-2" type="date" max={today()} value={draft.date} onChange={(event) => change("date", event.target.value)} />}{errors.date && <p className="mobile-field-error">{errors.date}</p>}</div>
    <MobileFieldFrame label="Categoria" htmlFor="reading-category" error={errors.categoryId} hint="A categoria organiza seus gráficos e o ranking.">
      <MobileSelect id="reading-category" icon={Tags} value={draft.categoryId} onChange={(event) => change("categoryId", event.target.value)}><option value="">Escolha uma categoria</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</MobileSelect>
    </MobileFieldFrame>
    {error && <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200" role="alert">{error}</p>}
    <button className="mobile-primary-button" disabled={pending || categories.length === 0} type="submit">{pending ? <Loader2 size={18} className="animate-spin" /> : editing ? <Check size={18} /> : <Plus size={18} />}{pending ? "Salvando…" : editing ? "Salvar alterações" : "Salvar leitura"}</button>
  </form>;
}

export default function MobileReadingEntryScreen({ books, sessionEmail, selectedBook, onOpenProfile }: Props) {
  const confirm = useMobileConfirm();
  const queryClient = useQueryClient();
  const enabled = getMobileReadingQueryEnabled(sessionEmail);
  const [view, setView] = useState<"register" | "history">("register");
  const [draft, setDraft] = useState(() => restoredDraft(sessionEmail, selectedBook));
  const [editDraft, setEditDraft] = useState<Draft | null>(null);
  const [editing, setEditing] = useState<MobileReadingEntry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Draft | null>(null);
  const [historySearch, setHistorySearch] = useState("");
  const { data: categories = [], isLoading: categoriesLoading, error: categoriesError, refetch: refetchCategories } = useQuery({ queryKey: ["mobile-categories"], queryFn: getMobileCategories, enabled });
  const { data: readings = [], isLoading: readingsLoading, error: readingsError, refetch: refetchReadings } = useQuery({ queryKey: ["mobile-readings"], queryFn: getMobileUserReadings, enabled });
  useEffect(() => { if (selectedBook && draft.localBookId === selectedBook.id && !draft.categoryId && categories.length) { const id = categoryForBook(selectedBook, categories); if (id) setDraft((current) => ({ ...current, categoryId: id })); } }, [selectedBook, draft.localBookId, draft.categoryId, categories]);
  useEffect(() => { if (sessionEmail) localStorage.setItem(draftKey(sessionEmail), JSON.stringify(draft)); }, [draft, sessionEmail]);
  const sorted = useMemo(() => [...readings].sort((a, b) => b.reading_date.localeCompare(a.reading_date) || String(b.created_at || "").localeCompare(String(a.created_at || ""))), [readings]);
  const grouped = new Map<string, MobileReadingEntry[]>();
  for (const reading of sorted.filter((item) => item.source_name.toLocaleLowerCase("pt-BR").includes(historySearch.toLocaleLowerCase("pt-BR")))) grouped.set(reading.reading_date, [...(grouped.get(reading.reading_date) || []), reading]);
  const change = (field: Field, value: string) => { setDraft((current) => ({ ...current, [field]: value })); setError(null); setSaved(null); };
  const changeEdit = (field: Field, value: string) => { setEditDraft((current) => current && ({ ...current, [field]: value })); setError(null); };
  const submit = useMutation({ mutationFn: async (input: Draft) => { if (navigator.onLine === false) throw new Error("Sem conexão. Seu rascunho foi guardado para tentar novamente."); const localBook = books.find((book) => book.id === input.localBookId) || null; const bookId = input.remoteBookId || await getOrCreateMobileBook(input.sourceName.trim(), input.categoryId, localBook); await createMobileReadingEntry({ sourceName: input.sourceName.trim(), pages: Number(input.pages), readingDate: input.date, readingTime: Number(input.minutes), categoryId: input.categoryId, bookId }); return input; }, onSuccess: (input) => { invalidate(queryClient); setSaved(input); setDraft((current) => ({ ...current, pages: "", minutes: "", date: today() })); setError(null); }, onError: (cause: Error) => setError(cause.message) });
  const update = useMutation({ mutationFn: async (input: Draft) => { if (!editing) return; if (navigator.onLine === false) throw new Error("Sem conexão. Tente salvar as alterações quando voltar."); await updateMobileReadingEntry({ readingId: editing.id, sourceName: input.sourceName.trim(), pages: Number(input.pages), readingDate: input.date, readingTime: Number(input.minutes), categoryId: input.categoryId }); }, onSuccess: () => { invalidate(queryClient); setEditing(null); setEditDraft(null); setError(null); }, onError: (cause: Error) => setError(cause.message) });
  const remove = useMutation({ mutationFn: deleteMobileReadingEntry, onSuccess: () => invalidate(queryClient), onError: (cause: Error) => setError(cause.message) });
  if (!enabled) return <MobileAccountGate title="Entre para registrar leituras" body="Seus registros, gráficos e ranking usam a mesma conta do Lyceum desktop." onOpenProfile={onOpenProfile} />;
  return <section className="space-y-4 px-4 py-5">
    <MobileQueryError error={categoriesError || readingsError} onRetry={() => { void Promise.all([refetchCategories(), refetchReadings()]); }} />
    <div className="rounded-3xl border border-white/[0.07] bg-gradient-to-br from-zinc-900 to-[#101714] p-5"><p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">Seu diário</p><h2 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-50">{view === "register" ? "Registrar leitura" : "Histórico de leituras"}</h2><p className="mt-1 text-sm leading-6 text-zinc-400">{view === "register" ? "Guarde o que você leu hoje em poucos passos." : "Revise e corrija seus registros."}</p><div className="mt-5 grid grid-cols-2 rounded-2xl bg-zinc-950 p-1" role="tablist" aria-label="Leituras"><button className={`min-h-11 rounded-xl text-sm font-semibold ${view === "register" ? "bg-zinc-800 text-zinc-50" : "text-zinc-500"}`} onClick={() => setView("register")} role="tab" aria-selected={view === "register"} type="button">Registrar</button><button className={`min-h-11 rounded-xl text-sm font-semibold ${view === "history" ? "bg-zinc-800 text-zinc-50" : "text-zinc-500"}`} onClick={() => setView("history")} role="tab" aria-selected={view === "history"} type="button">Histórico</button></div></div>
    {view === "register" ? <div className="rounded-3xl border border-white/[0.07] bg-zinc-900 p-5">{saved && <div className="mb-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4" role="status"><div className="flex items-center gap-2 text-sm font-semibold text-emerald-300"><Check size={18} />Leitura salva</div><p className="mt-2 text-sm text-zinc-300">{saved.sourceName} · {saved.pages} pág. · {formatReadingMinutes(Number(saved.minutes))} · {dateLabel(saved.date)}</p><button className="mt-3 min-h-11 text-sm font-semibold text-emerald-300" onClick={() => { setView("history"); setSaved(null); }} type="button">Ver histórico</button></div>}{categoriesLoading && <p className="mb-4 flex items-center gap-2 text-sm text-zinc-400"><Loader2 className="animate-spin" size={16} />Carregando categorias…</p>}<ReadingForm draft={draft} onChange={change} books={books} readings={readings} categories={categories} pending={submit.isPending} error={error} onSubmit={() => submit.mutate(draft)} />{!categoriesLoading && categories.length === 0 && <p className="mt-3 text-sm text-amber-300">Nenhuma categoria disponível. Configure as categorias da conta antes de registrar.</p>}</div> : <div className="space-y-4"><MobileInput icon={Search} aria-label="Buscar no histórico" value={historySearch} onChange={(event) => setHistorySearch(event.target.value)} placeholder="Buscar livro no histórico" />{error && <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200" role="alert">{error}</p>}{readingsLoading && <p className="flex items-center gap-2 text-sm text-zinc-400"><Loader2 size={17} className="animate-spin" />Carregando histórico…</p>}{!readingsLoading && grouped.size === 0 && <div className="rounded-3xl border border-white/[0.07] bg-zinc-900 p-8 text-center"><CalendarDays className="mx-auto text-emerald-400" size={28} /><p className="mt-3 text-sm font-semibold">{historySearch ? "Nenhum livro encontrado" : "Seu histórico começa aqui"}</p><p className="mt-1 text-sm text-zinc-500">{historySearch ? "Tente outro título." : "Registre uma leitura para acompanhar seu progresso."}</p></div>}{[...grouped.entries()].map(([date, entries]) => <div key={date}><h3 className="mb-2 px-1 text-sm font-semibold capitalize text-zinc-400">{dateLabel(date)}</h3><div className="divide-y divide-zinc-800 overflow-hidden rounded-2xl border border-white/[0.07] bg-zinc-900">{entries.map((reading) => <article key={reading.id} className="p-4"><div className="flex items-start gap-3"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-500/10 text-emerald-400"><BookOpen size={19} /></div><div className="min-w-0 flex-1"><p className="font-semibold text-zinc-100">{reading.source_name}</p><p className="mt-1 flex items-center gap-2 text-sm text-zinc-400"><span>{reading.pages} páginas</span><span aria-hidden="true">·</span><Clock3 size={14} />{formatReadingMinutes(Number(reading.reading_time || 0))}</p></div></div><div className="mt-3 flex justify-end gap-2"><button className="min-h-11 rounded-xl bg-zinc-800 px-4 text-sm font-semibold text-zinc-200" onClick={() => { setEditing(reading); setEditDraft({ sourceName: reading.source_name, localBookId: "", remoteBookId: reading.book_id || "", pages: String(reading.pages), minutes: String(reading.reading_time), date: reading.reading_date, categoryId: reading.category_id || "" }); setError(null); }} type="button"><Edit3 size={15} className="mr-2 inline" />Editar</button><button className="min-h-11 rounded-xl bg-red-950/50 px-4 text-sm font-semibold text-red-300" disabled={remove.isPending} onClick={async () => { if (await confirm(`Remover leitura de “${reading.source_name}”?`)) remove.mutate(reading.id); }} type="button"><Trash2 size={15} className="mr-2 inline" />Excluir</button></div></article>)}</div></div>)}</div>}
    {editing && editDraft && <div className="fixed inset-0 z-[90] flex items-end bg-black/70 backdrop-blur-sm" role="presentation"><div className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-zinc-700 bg-zinc-950 p-5 pb-[max(24px,env(safe-area-inset-bottom))]" role="dialog" aria-modal="true" aria-label="Editar leitura"><div className="mb-5 flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-wide text-emerald-400">Corrigir registro</p><h2 className="mt-1 text-xl font-semibold">Editar leitura</h2></div><button className="grid h-11 w-11 place-items-center rounded-full bg-zinc-900" onClick={() => { setEditing(null); setEditDraft(null); }} aria-label="Fechar edição" type="button"><X size={19} /></button></div><ReadingForm draft={editDraft} onChange={changeEdit} books={books} readings={readings} categories={categories} pending={update.isPending} error={error} onSubmit={() => update.mutate(editDraft)} editing /></div></div>}
  </section>;
}
