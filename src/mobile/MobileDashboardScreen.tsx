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
import ContinueReadingRow from "./ContinueReadingRow";
import { formatNumber, getActiveLocale, translate, useTranslation } from "../i18n";
import MobileQueryError from "./MobileQueryError";
import {
  getCategories,
  isAccountQueryEnabled,
  getReadingStats,
  getUserReadings,
} from "../api/database";
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
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-foreground-subtle">{label}</p>
        <div className="text-foreground-subtle">{icon}</div>
      </div>
      <p className="mt-3 text-2xl font-semibold text-foreground">{value}</p>
      <p className="mt-1 text-xs text-foreground-subtle">{helper}</p>
    </div>
  );
}

function EmptyChart() {
  const { t } = useTranslation();

  return (
    <div className="grid h-56 place-items-center text-center text-sm text-foreground-subtle">
      {t("mobile:dashboard.chartEmpty")}
    </div>
  );
}

function formatShortDate(value: string) {
  const [, month, day] = value.split("-");
  return `${day}/${month}`;
}

function dateLabelForHeatmap(value: string) {
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat(getActiveLocale(), {
    day: "numeric",
    month: "short",
  }).format(date);
}

function getTodayReadingsText(readings: Array<{ source_name: string; pages: number; reading_date: string }>) {
  const today = toLocalIsoDate(new Date());
  const todayReadings = readings.filter((reading) => reading.reading_date === today);
  if (todayReadings.length === 0) return "";
  const total = todayReadings.reduce((sum, reading) => sum + reading.pages, 0);
  return `${todayReadings.map((reading) => `${reading.source_name}: ${reading.pages}`).join("\n")}\n\n${translate("mobile:dashboard.total")}: ${total}`;
}

export default function MobileDashboardScreen({
  sessionEmail,
  onOpenProfile,
  onOpenRegister,
  onOpenLeaderboard,
  books,
  onOpenBook,
}: MobileDashboardScreenProps) {
  const { t, i18n } = useTranslation();
  const number = (value: number) => formatNumber(value, i18n.language);
  const enabled = isAccountQueryEnabled(sessionEmail);
  const [chartMode, setChartMode] = useState<ChartMode>("daily");

  const { data: readings = [], isLoading: readingsLoading, error: readingsError, refetch: refetchReadings } = useQuery({
    queryKey: ["mobile-readings"],
    queryFn: getUserReadings,
    enabled,
  });

  const { data: stats, isLoading: statsLoading, error: statsError, refetch: refetchStats } = useQuery({
    queryKey: ["mobile-reading-stats"],
    queryFn: getReadingStats,
    enabled,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["mobile-categories"],
    queryFn: getCategories,
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
  const heatmapMax = Math.max(1, ...heatmapData.map((day) => day.pages));

  if (!enabled) {
    return (
      <div className="space-y-2 pt-4">
        <div className="px-4"><ContinueReadingRow books={books} onOpenBook={onOpenBook} /></div>
        <MobileAccountGate
          title={t("mobile:dashboard.gateTitle")}
          body={t("mobile:dashboard.gateBody")}
          onOpenProfile={onOpenProfile}
        />
      </div>
    );
  }

  const copyDailyReadings = async () => {
    const text = getTodayReadingsText(readings);
    if (!text) {
      toast.error(t("mobile:dashboard.noReadingsToday"));
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t("mobile:dashboard.readingsCopied"));
    } catch {
      toast.error(t("mobile:dashboard.copyFailed"));
    }
  };

  return (
    <section className="space-y-4 p-4">
      <ContinueReadingRow books={books} onOpenBook={onOpenBook} />
      <MobileQueryError
        error={readingsError || statsError}
        onRetry={() => { void Promise.all([refetchReadings(), refetchStats()]); }}
      />
      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              {t("mobile:dashboard.todayKicker")}
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-foreground">
              {summary.todayPages > 0
                ? t("mobile:dashboard.pagesToday", { count: summary.todayPages })
                : t("mobile:dashboard.logYourReading")}
            </h1>
            <p className="mt-2 text-sm leading-6 text-foreground-muted">
              {t("mobile:dashboard.body")}
            </p>
          </div>
          {isLoading && <Loader2 className="mt-1 animate-spin text-foreground-subtle" size={20} />}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            className="flex h-12 items-center justify-center gap-2 rounded bg-primary text-sm font-semibold text-primary-foreground"
            onClick={onOpenRegister}
            type="button"
          >
            <Plus size={18} />
            {t("mobile:dashboard.log")}
          </button>
          <button
            className="flex h-12 items-center justify-center gap-2 rounded border border-border bg-background text-sm font-semibold text-foreground"
            onClick={copyDailyReadings}
            type="button"
          >
            <Copy size={17} />
            {t("mobile:dashboard.copyToday")}
          </button>
        </div>
      </div>

            <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">
            {t("mobile:dashboard.weekPace")}
          </h2>
          <span className="text-xs text-foreground-subtle">{number(summary.weekPages)}p</span>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((day) => (
            <div key={day.date} className="text-center">
              <div
                className={`mx-auto grid h-9 w-9 place-items-center rounded-full border text-xs font-semibold ${
                  day.hasRead
                    ? "border-primary bg-primary text-primary-foreground"
                    : day.date === toLocalIsoDate(new Date())
                      ? "border-primary/60 bg-primary-muted text-primary"
                      : "border-border bg-background text-foreground-subtle"
                }`}
                title={`${day.date}: ${number(day.pages)}p`}
                role="img"
                aria-label={`${day.date}: ${number(day.pages)} ${t("common:fields.pages")}`}
              >
                {day.hasRead ? day.pages : day.dayNumber}
              </div>
              <p className="mt-1 text-[11px] font-medium text-foreground-subtle">{day.dayLabel}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-surface">
        <div className="flex border-b border-border">
          {(["daily", "category"] as const).map((mode) => (
            <button
              key={mode}
              className={`h-11 flex-1 text-sm font-semibold ${
                chartMode === mode
                  ? "bg-surface-muted text-foreground"
                  : "text-foreground-subtle"
              }`}
              onClick={() => setChartMode(mode)}
              type="button"
            >
              {t(
                mode === "daily"
                  ? "mobile:dashboard.chartTabs.daily"
                  : "mobile:dashboard.chartTabs.category",
              )}
            </button>
          ))}
        </div>

        <div className="p-3" role="img" aria-label={
            chartMode === "daily"
              ? t("mobile:dashboard.dailyChartAria", {
                  items: dailyData
                    .map((item) => `${formatShortDate(item.date)} ${number(item.pages)}`)
                    .join(", "),
                })
              : t("mobile:dashboard.categoryChartAria", {
                  items: categoryTotals
                    .map((item) => `${item.name} ${number(item.pages)}`)
                    .join(", "),
                })
          }>
          {!hasAnyReading ? (
            <EmptyChart />
          ) : chartMode === "daily" ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={dailyData} margin={{ left: -18, right: 8, top: 12, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="2 3" vertical={false} />
                <XAxis dataKey="date" tickFormatter={formatShortDate} stroke="var(--foreground-subtle)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--foreground-subtle)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ background: "var(--surface)", border: "1px solid var(--border-strong)", borderRadius: 4, color: "var(--foreground)" }}
                  labelFormatter={formatShortDate}
                />
                <Line type="monotone" dataKey="pages" stroke="var(--primary)" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : categoryTotals.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={categoryTotals} layout="vertical" margin={{ left: 12, right: 8, top: 8, bottom: 8 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="2 3" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={88} stroke="var(--foreground-subtle)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border-strong)", borderRadius: 4, color: "var(--foreground)" }} />
                <Bar dataKey="pages" fill="var(--primary)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </div>
      </div>

      <div className="mobile-card p-4">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              {t("mobile:dashboard.consistency")}
            </h2>
            <p className="mt-1 text-xs text-foreground-subtle">{t("mobile:dashboard.lastWeeks")}</p>
          </div>
          <CalendarDays size={18} className="text-primary" />
        </div>
        <div className="grid grid-flow-col grid-rows-7 gap-1.5 overflow-hidden" role="img" aria-label={t("mobile:dashboard.heatmapAria", { count: summary.readingDays })}>
          {heatmapData.map((day) => {
            const intensity = day.pages <= 0 ? 0 : Math.max(1, Math.ceil((day.pages / heatmapMax) * 4));
            const tones = ["bg-surface-muted", "bg-primary-muted", "bg-primary-muted", "bg-primary", "bg-primary"];
            return <span key={day.date} className={`aspect-square min-w-0 rounded-[4px] ${tones[intensity]}`} title={t("mobile:dashboard.heatmapCellTitle", {
                date: dateLabelForHeatmap(day.date),
                count: day.pages,
              })}
              aria-label={t("mobile:dashboard.heatmapCellAria", {
                date: dateLabelForHeatmap(day.date),
                count: day.pages,
              })}
            />;
          })}
        </div>
        <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-foreground-subtle"><span>{t("mobile:dashboard.less")}</span>{["bg-surface-muted", "bg-primary-muted", "bg-primary-muted", "bg-primary", "bg-primary"].map((tone) => <span key={tone} className={`h-2.5 w-2.5 rounded-[3px] ${tone}`} />)}<span>{t("mobile:dashboard.more")}</span></div>
      </div>


      <div className="grid grid-cols-2 gap-3">
        <StatTile
          label={t("mobile:dashboard.total")}
          value={`${number(totalPages)}p`}
          helper={formatReadingMinutes(Number(totalMinutes || 0))}
          icon={<BookOpen size={17} />}
        />
        <StatTile
          label={t("mobile:dashboard.month")}
          value={`${number(monthPages)}p`}
          helper={t("mobile:dashboard.readingDays", { count: summary.readingDays })}
          icon={<CalendarDays size={17} />}
        />
        <StatTile
          label={t("mobile:dashboard.streak")}
          value={`${number(currentStreak)}d`}
          helper={
            summary.todayPages > 0
              ? t("mobile:dashboard.readingDoneToday")
              : t("mobile:dashboard.todayStillEmpty")
          }
          icon={<Flame size={17} />}
        />
        <StatTile
          label={t("mobile:dashboard.week")}
          value={`${number(summary.weekPages)}p`}
          helper={t("mobile:dashboard.pagesPerEntry", {
            count: Math.round(summary.averagePagesPerReading),
          })}
          icon={<BarChart3 size={17} />}
        />
      </div>

      <button className="flex min-h-12 w-full items-center justify-center gap-2 text-sm font-semibold text-foreground-muted" onClick={onOpenLeaderboard} type="button"><Trophy size={17} className="text-primary" />
        {t("mobile:dashboard.viewLeaderboard")}
      </button>
    </section>
  );
}
