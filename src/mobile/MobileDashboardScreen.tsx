import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  Copy,
  Flame,
  Loader2,
  Plus,
  Trophy,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import MobileAccountGate from "./MobileAccountGate";
import MobileQueryError from "./MobileQueryError";
import {
  getMobileCategories,
  getMobileReadingQueryEnabled,
  getMobileReadingStats,
  getMobileUserReadings,
} from "./readingApi";
import {
  buildCategoryTotals,
  buildDailyReadingData,
  buildWeekStreakDays,
  formatReadingMinutes,
  summarizeMobileReadings,
  toLocalIsoDate,
} from "./mobileReadingStats";
import type { MobileBook } from "./types";

interface MobileDashboardScreenProps {
  sessionEmail: string | null;
  onOpenProfile: () => void;
  onOpenRegister: () => void;
  onOpenLeaderboard: () => void;
  books: MobileBook[];
  onOpenBook: (bookId: string) => void;
}

type ChartMode = "daily" | "category";

function StatTile({
  label,
  value,
  helper,
  icon,
}: {
  label: string;
  value: string;
  helper: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
        <div className="text-zinc-500">{icon}</div>
      </div>
      <p className="mt-3 text-2xl font-semibold text-zinc-50">{value}</p>
      <p className="mt-1 text-xs text-zinc-500">{helper}</p>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="grid h-56 place-items-center text-center text-sm text-zinc-500">
      Registre uma leitura para ver os graficos.
    </div>
  );
}

function formatShortDate(value: string) {
  const [, month, day] = value.split("-");
  return `${day}/${month}`;
}

function dateLabelForHeatmap(value: string) {
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short" }).format(date);
}

function getTodayReadingsText(readings: Array<{ source_name: string; pages: number; reading_date: string }>) {
  const today = toLocalIsoDate(new Date());
  const todayReadings = readings.filter((reading) => reading.reading_date === today);
  if (todayReadings.length === 0) return "";
  const total = todayReadings.reduce((sum, reading) => sum + reading.pages, 0);
  return `${todayReadings.map((reading) => `${reading.source_name}: ${reading.pages}`).join("\n")}\n\nTotal: ${total}`;
}

export default function MobileDashboardScreen({
  sessionEmail,
  onOpenProfile,
  onOpenRegister,
  onOpenLeaderboard,
  books,
  onOpenBook,
}: MobileDashboardScreenProps) {
  const enabled = getMobileReadingQueryEnabled(sessionEmail);
  const [chartMode, setChartMode] = useState<ChartMode>("daily");

  const { data: readings = [], isLoading: readingsLoading, error: readingsError, refetch: refetchReadings } = useQuery({
    queryKey: ["mobile-readings"],
    queryFn: getMobileUserReadings,
    enabled,
  });

  const { data: stats, isLoading: statsLoading, error: statsError, refetch: refetchStats } = useQuery({
    queryKey: ["mobile-reading-stats"],
    queryFn: getMobileReadingStats,
    enabled,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["mobile-categories"],
    queryFn: getMobileCategories,
    enabled,
  });

  const summary = useMemo(() => summarizeMobileReadings(readings), [readings]);
  const dailyData = useMemo(() => buildDailyReadingData(readings, 14), [readings]);
  const heatmapData = useMemo(() => buildDailyReadingData(readings, 84), [readings]);
  const categoryTotals = useMemo(
    () => buildCategoryTotals(readings, categories).slice(0, 6),
    [categories, readings],
  );
  const weekDays = useMemo(() => buildWeekStreakDays(readings), [readings]);
  const isLoading = readingsLoading || statsLoading;
  const totalPages = stats?.readingStats.total_pages ?? summary.totalPages;
  const totalMinutes = stats?.readingStats.total_minutes ?? summary.totalMinutes;
  const monthPages = stats?.readingStats.month_pages ?? summary.monthPages;
  const currentStreak = stats?.userStreak ?? summary.currentStreak;
  const hasAnyReading = readings.length > 0;
  const recentBook = useMemo(() => [...books].filter((book) => book.lastOpenedAt).sort((a, b) => String(b.lastOpenedAt).localeCompare(String(a.lastOpenedAt)))[0], [books]);
  const heatmapMax = Math.max(1, ...heatmapData.map((day) => day.pages));

  if (!enabled) {
    return (
      <MobileAccountGate
        title="Seu painel de leitura"
        body="Entre com a mesma conta do desktop para registrar leituras, ver graficos e carregar seus amigos."
        onOpenProfile={onOpenProfile}
      />
    );
  }

  const copyDailyReadings = async () => {
    const text = getTodayReadingsText(readings);
    if (!text) {
      toast.error("Nenhuma leitura registrada hoje");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Leituras de hoje copiadas");
    } catch {
      toast.error("Nao foi possivel copiar");
    }
  };

  return (
    <section className="space-y-4 p-4">
      <MobileQueryError
        error={readingsError || statsError}
        onRetry={() => { void Promise.all([refetchReadings(), refetchStats()]); }}
      />
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-400">Hoje no Lyceum</p>
            <h1 className="mt-1 text-2xl font-semibold text-zinc-50">
              {summary.todayPages > 0 ? `${summary.todayPages} paginas hoje` : "Registre sua leitura"}
            </h1>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Acompanhe progresso, ritmo e disputa com amigos da sua conta.
            </p>
          </div>
          {isLoading && <Loader2 className="mt-1 animate-spin text-zinc-500" size={20} />}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            className="flex h-12 items-center justify-center gap-2 rounded bg-emerald-600 text-sm font-semibold text-white"
            onClick={onOpenRegister}
            type="button"
          >
            <Plus size={18} />
            Registrar
          </button>
          <button
            className="flex h-12 items-center justify-center gap-2 rounded border border-zinc-800 bg-zinc-950 text-sm font-semibold text-zinc-200"
            onClick={copyDailyReadings}
            type="button"
          >
            <Copy size={17} />
            Copiar hoje
          </button>
        </div>
      </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-100">Ritmo da semana</h2>
          <span className="text-xs text-zinc-500">{summary.weekPages}p</span>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((day) => (
            <div key={day.date} className="text-center">
              <div
                className={`mx-auto grid h-9 w-9 place-items-center rounded-full border text-xs font-semibold ${
                  day.hasRead
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : day.date === toLocalIsoDate(new Date())
                      ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-300"
                      : "border-zinc-800 bg-zinc-950 text-zinc-600"
                }`}
                title={`${day.date}: ${day.pages}p`}
                role="img"
                aria-label={`${day.date}: ${day.pages} páginas`}
              >
                {day.hasRead ? day.pages : day.dayNumber}
              </div>
              <p className="mt-1 text-[11px] font-medium text-zinc-500">{day.dayLabel}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900">
        <div className="flex border-b border-zinc-800">
          {([
            ["daily", "Diario"],
            ["category", "Categorias"],
          ] as const).map(([mode, label]) => (
            <button
              key={mode}
              className={`h-11 flex-1 text-sm font-semibold ${
                chartMode === mode
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-500"
              }`}
              onClick={() => setChartMode(mode)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>

        <div className="p-3" role="img" aria-label={chartMode === "daily" ? `Páginas lidas nos últimos 14 dias: ${dailyData.map((item) => `${formatShortDate(item.date)} ${item.pages}`).join(", ")}` : `Páginas por categoria: ${categoryTotals.map((item) => `${item.name} ${item.pages}`).join(", ")}`}>
          {!hasAnyReading ? (
            <EmptyChart />
          ) : chartMode === "daily" ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={dailyData} margin={{ left: -18, right: 8, top: 12, bottom: 0 }}>
                <CartesianGrid stroke="var(--ui-zinc-800)" strokeDasharray="2 3" vertical={false} />
                <XAxis dataKey="date" tickFormatter={formatShortDate} stroke="var(--ui-zinc-600)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--ui-zinc-600)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 4 }}
                  labelFormatter={formatShortDate}
                />
                <Line type="monotone" dataKey="pages" stroke="var(--accent-500)" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : categoryTotals.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={categoryTotals} layout="vertical" margin={{ left: 12, right: 8, top: 8, bottom: 8 }}>
                <CartesianGrid stroke="var(--ui-zinc-800)" strokeDasharray="2 3" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={88} stroke="var(--ui-zinc-500)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 4 }} />
                <Bar dataKey="pages" fill="var(--accent-500)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </div>
      </div>

      <div className="mobile-card p-4">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div><h2 className="text-sm font-semibold text-zinc-100">Constância de leitura</h2><p className="mt-1 text-xs text-zinc-500">Suas últimas 12 semanas</p></div>
          <CalendarDays size={18} className="text-emerald-400" />
        </div>
        <div className="grid grid-flow-col grid-rows-7 gap-1.5 overflow-hidden" role="img" aria-label={`Mapa de leitura das últimas 12 semanas. ${summary.readingDays} dias com leitura no total.`}>
          {heatmapData.map((day) => {
            const intensity = day.pages <= 0 ? 0 : Math.max(1, Math.ceil((day.pages / heatmapMax) * 4));
            const tones = ["bg-zinc-800", "bg-emerald-950", "bg-emerald-800", "bg-emerald-600", "bg-emerald-400"];
            return <span key={day.date} className={`aspect-square min-w-0 rounded-[4px] ${tones[intensity]}`} title={`${dateLabelForHeatmap(day.date)}: ${day.pages} páginas`} aria-label={`${dateLabelForHeatmap(day.date)}, ${day.pages} páginas`} />;
          })}
        </div>
        <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-zinc-500"><span>Menos</span>{["bg-zinc-800", "bg-emerald-950", "bg-emerald-800", "bg-emerald-600", "bg-emerald-400"].map((tone) => <span key={tone} className={`h-2.5 w-2.5 rounded-[3px] ${tone}`} />)}<span>Mais</span></div>
      </div>

      {recentBook && <button className="flex min-h-20 w-full items-center gap-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-left" onClick={() => onOpenBook(recentBook.id)} type="button"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-emerald-500/15 text-emerald-300"><BookOpen size={22} /></div><div className="min-w-0 flex-1"><p className="text-xs font-semibold uppercase tracking-wide text-emerald-400">Continue lendo</p><p className="mt-1 truncate text-sm font-semibold text-zinc-100">{recentBook.title}</p><p className="mt-0.5 text-xs text-zinc-400">{Math.round(recentBook.progressPercent || 0)}% concluído</p></div></button>}

      <div className="grid grid-cols-2 gap-3">
        <StatTile
          label="Total"
          value={`${totalPages}p`}
          helper={formatReadingMinutes(Number(totalMinutes || 0))}
          icon={<BookOpen size={17} />}
        />
        <StatTile
          label="Mes"
          value={`${monthPages}p`}
          helper={`${summary.readingDays} dias com leitura`}
          icon={<CalendarDays size={17} />}
        />
        <StatTile
          label="Sequencia"
          value={`${currentStreak}d`}
          helper={summary.todayPages > 0 ? "Leitura feita hoje" : "Hoje ainda vazio"}
          icon={<Flame size={17} />}
        />
        <StatTile
          label="Semana"
          value={`${summary.weekPages}p`}
          helper={`${summary.averagePagesPerReading}p por registro`}
          icon={<BarChart3 size={17} />}
        />
      </div>

      <button className="flex min-h-12 w-full items-center justify-center gap-2 text-sm font-semibold text-zinc-400" onClick={onOpenLeaderboard} type="button"><Trophy size={17} className="text-emerald-400" />Ver ranking e amigos</button>
    </section>
  );
}
