import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, Award, CalendarDays, CalendarRange, Clock, Flame, Gauge, Layers, LineChart as LineChartIcon, Radar as RadarIcon, Timer, TrendingUp, Trophy, Zap, type LucideIcon } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getAllBooks } from "../../../api/database";
import {
  addDays,
  calendarDays,
  categoryMonthly,
  comparePeriod,
  dailyTotals,
  hourDistribution,
  monthlyPages,
  monthlySeries,
  paceByCategory,
  parseIsoDate,
  personalRecords,
  projectFinish,
  readerProfile,
  recentDays,
  startOfDay,
  toIsoDate,
  totalsBetween,
  weekdayAverages,
  type BookProgressInput,
} from "../../../features/stats/readingAnalytics";
import { formatDuration, formatNumber, getShortMonthNames, getWeekdayShortNames, useLanguage, useTranslation, type TranslationKey } from "../../../i18n";
import CalendarHeatmap from "../components/stats/CalendarHeatmap";
import ChartLegend from "../components/stats/ChartLegend";
import { axisProps, BAR_RADIUS, gridProps, seq, viz } from "../components/stats/chartTheme";
import EmptyState from "../components/stats/EmptyState";
import ProgressBar from "../components/stats/ProgressBar";
import ReadingClock from "../components/stats/ReadingClock";
import StatFigure from "../components/stats/StatFigure";
import StatPanel from "../components/stats/StatPanel";
import StatsTooltip from "../components/stats/StatsTooltip";
import { useCategories, useFriendsReadings, useLibrarySummary, useReadingRecords } from "../hooks/useDashboardData";

const MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0];

export default function ReadingTab() {
  const { t } = useTranslation();
  const { language, locale } = useLanguage();
  const { records, isLoading } = useReadingRecords();
  const { data: categories } = useCategories();
  const { data: library } = useLibrarySummary();
  const { people } = useFriendsReadings(t("dashboard:common.you"));
  const { data: remoteBooks } = useQuery({ queryKey: ["books"], queryFn: getAllBooks, staleTime: 5 * 60_000 });
  const months = getShortMonthNames(language);
  const weekdays = getWeekdayShortNames(language);
  const fmt = (value: number) => formatNumber(value, language);
  const monthLabel = (key: string) => `${months[Number(key.slice(5, 7)) - 1] ?? ""}${key.slice(0, 4) !== String(new Date().getFullYear()) ? ` ${key.slice(2, 4)}` : ""}`;
  const dayLabel = (iso: string) => parseIsoDate(iso).toLocaleDateString(locale, { day: "2-digit", month: "short" });

  const stats = useMemo(() => {
    const now = new Date();
    const daily = dailyTotals(records);
    const year = now.getFullYear();
    const thisYear = monthlyPages(daily, year);
    const lastYear = monthlyPages(daily, year - 1);
    const categoryNames = new Map((categories ?? []).map((category) => [category.id, category.name]));
    const categoryRows = categoryMonthly(records, now, 12);
    const categoryTotals = new Map<string, number>();
    for (const row of categoryRows) {
      for (const [key, value] of Object.entries(row)) if (key !== "month") categoryTotals.set(key, (categoryTotals.get(key) ?? 0) + Number(value));
    }
    const topCategories = [...categoryTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([key]) => key);
    const hasOther = categoryTotals.size > topCategories.length;
    const categorySeries = categoryRows.map((row) => {
      const output: Record<string, number | string> = { month: String(row.month) };
      let other = 0;
      for (const [key, value] of Object.entries(row)) {
        if (key === "month") continue;
        if (topCategories.includes(key)) output[key] = Number(value);
        else other += Number(value);
      }
      if (hasOther) output.other = other;
      return output;
    });

    const progressInputs = new Map<string, BookProgressInput>();
    for (const book of library?.inProgress ?? []) {
      progressInputs.set(book.bookId ?? book.title.toLocaleLowerCase(), { key: `local-${book.id}`, title: book.title, totalPages: book.numPages, currentPage: book.currentPage, bookId: book.bookId });
    }
    const recentTitles = new Set(records.filter((reading) => reading.reading_date >= toIsoDate(addDays(now, -13))).map((reading) => reading.book_id ?? reading.source_name.toLocaleLowerCase()));
    for (const book of remoteBooks ?? []) {
      if (!book.total_pages || progressInputs.has(book.id) || !(recentTitles.has(book.id) || recentTitles.has(book.title.toLocaleLowerCase()))) continue;
      progressInputs.set(book.id, { key: book.id, title: book.title, totalPages: book.total_pages, currentPage: 0, bookId: book.id });
    }

    const friends = people.filter((person) => !person.isCurrentUser && person.readings.length > 0);
    const myProfile = readerProfile(records, now);
    const friendProfiles = friends.map((person) => readerProfile(person.readings, now));
    const profile = myProfile.map((axis, index) => ({
      key: axis.key,
      you: axis.value,
      raw: axis.raw,
      friends: friendProfiles.length > 0 ? Math.round(friendProfiles.reduce((sum, item) => sum + (item[index]?.value ?? 0), 0) / friendProfiles.length) : undefined,
    }));

    const last30 = totalsBetween(daily, addDays(now, -29), now);
    const series = monthlySeries(records, now, 12);
    const weekdayValues = weekdayAverages(daily, now);
    return {
      week: comparePeriod(daily, "week", now),
      month: comparePeriod(daily, "month", now),
      year: comparePeriod(daily, "year", now),
      recent: recentDays(daily, now, 30, 7),
      records: personalRecords(records, daily),
      calendar: calendarDays(daily, addDays(startOfDay(now), -364), startOfDay(now)),
      yoy: thisYear.map((pages, index) => ({ month: months[index] ?? "", previous: lastYear[index] ?? 0, current: index > now.getMonth() ? null : pages })),
      yoyTotals: { current: thisYear.reduce((a, b) => a + b, 0), previous: lastYear.slice(0, now.getMonth() + 1).reduce((a, b) => a + b, 0) },
      series,
      pace: paceByCategory(records).map((item) => ({ ...item, name: categoryNames.get(item.categoryId) ?? t("dashboard:reading.categories.none") })).slice(0, 5),
      categorySeries,
      categoryKeys: [...topCategories, ...(hasOther ? ["other"] : [])],
      categoryName: (key: string) => (key === "other" ? t("dashboard:reading.categories.other") : key === "none" ? t("dashboard:reading.categories.none") : categoryNames.get(key) ?? key),
      projections: projectFinish(records, [...progressInputs.values()], now).slice(0, 6),
      profile,
      hasFriendProfile: friendProfiles.length > 0,
      weekday: MONDAY_FIRST.map((day) => ({ label: weekdays[day] ?? "", pages: weekdayValues[day] ?? 0 })),
      hours: hourDistribution(records),
      last30,
      deepDays: calendarDays(daily, addDays(now, -89), now).filter((day) => day.minutes >= 60).length,
      strip: calendarDays(daily, addDays(startOfDay(now), -29), startOfDay(now)),
    };
  }, [categories, library?.inProgress, months, people, records, remoteBooks, t, weekdays]);

  if (!isLoading && records.length === 0) {
    return <EmptyState icon={LineChartIcon} message={t("dashboard:reading.empty")} />;
  }

  const maxWeekday = Math.max(...stats.weekday.map((day) => day.pages));
  const latestPace = [...stats.series].reverse().find((point) => point.pagesPerHour !== null)?.pagesPerHour ?? null;
  const firstPace = stats.series.find((point) => point.pagesPerHour !== null)?.pagesPerHour ?? null;
  const yearDelta = stats.yoyTotals.previous > 0 ? Math.round(((stats.yoyTotals.current - stats.yoyTotals.previous) / stats.yoyTotals.previous) * 100) : null;
  const recordTiles: Array<{ icon: LucideIcon; label: string; value: string; detail: string }> = [
    { icon: Trophy, label: t("dashboard:reading.records.bestDay"), value: stats.records.bestDay ? t("dashboard:common.pagesShort", { count: stats.records.bestDay.pages }) : "—", detail: stats.records.bestDay ? dayLabel(stats.records.bestDay.date) : "" },
    { icon: CalendarRange, label: t("dashboard:reading.records.bestWeek"), value: stats.records.bestWeek ? t("dashboard:common.pagesShort", { count: stats.records.bestWeek.pages }) : "—", detail: stats.records.bestWeek ? t("dashboard:reading.records.weekOf", { date: dayLabel(stats.records.bestWeek.start) }) : "" },
    { icon: Award, label: t("dashboard:reading.records.bestMonth"), value: stats.records.bestMonth ? t("dashboard:common.pagesShort", { count: stats.records.bestMonth.pages }) : "—", detail: stats.records.bestMonth ? `${months[Number(stats.records.bestMonth.month.slice(5, 7)) - 1]} ${stats.records.bestMonth.month.slice(0, 4)}` : "" },
    { icon: Flame, label: t("dashboard:reading.records.longestStreak"), value: t("dashboard:common.days", { count: stats.records.longestStreak.days }), detail: stats.records.longestStreak.start && stats.records.longestStreak.end ? `${dayLabel(stats.records.longestStreak.start)} – ${dayLabel(stats.records.longestStreak.end)}` : "" },
    { icon: Clock, label: t("dashboard:reading.records.longestDay"), value: stats.records.longestDay ? formatDuration(stats.records.longestDay.minutes, language) : "—", detail: stats.records.longestDay ? dayLabel(stats.records.longestDay.date) : "" },
    { icon: Zap, label: t("dashboard:reading.records.fastestDay"), value: stats.records.fastestDay ? t("dashboard:common.pagesPerHour", { value: fmt(stats.records.fastestDay.pagesPerHour) }) : "—", detail: stats.records.fastestDay ? dayLabel(stats.records.fastestDay.date) : "" },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <StatPanel title={t("dashboard:reading.comparison.title")} subtitle={t("dashboard:reading.comparison.subtitle")} icon={Activity} info={t("dashboard:reading.comparison.info")} className="lg:col-span-12">
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-3 xl:grid-cols-6">
          <StatFigure label={t("dashboard:reading.comparison.weekPages")} value={fmt(stats.week.current.pages)} delta={stats.week.delta.pages} hint={t("dashboard:reading.comparison.vsLastWeek")} />
          <StatFigure label={t("dashboard:reading.comparison.weekTime")} value={formatDuration(stats.week.current.minutes, language)} delta={stats.week.delta.minutes} hint={t("dashboard:reading.comparison.vsLastWeek")} />
          <StatFigure label={t("dashboard:reading.comparison.monthPages")} value={fmt(stats.month.current.pages)} delta={stats.month.delta.pages} hint={t("dashboard:reading.comparison.vsLastMonth")} />
          <StatFigure label={t("dashboard:reading.comparison.monthDays")} value={fmt(stats.month.current.activeDays)} delta={stats.month.delta.activeDays} hint={t("dashboard:reading.comparison.vsLastMonth")} />
          <StatFigure label={t("dashboard:reading.comparison.yearPages")} value={fmt(stats.year.current.pages)} delta={stats.year.delta.pages} hint={t("dashboard:reading.comparison.vsLastYear")} />
          <StatFigure label={t("dashboard:reading.comparison.yearTime")} value={formatDuration(stats.year.current.minutes, language)} delta={stats.year.delta.minutes} hint={t("dashboard:reading.comparison.vsLastYear")} />
        </div>
      </StatPanel>

      <StatPanel title={t("dashboard:reading.recent.title")} subtitle={t("dashboard:reading.recent.subtitle")} icon={TrendingUp} className="lg:col-span-7">
        <ChartLegend items={[{ label: t("dashboard:reading.recent.pages"), color: seq(2) }, { label: t("dashboard:reading.recent.average"), color: viz(2) }]} />
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={stats.recent} margin={{ top: 10, right: 8, left: -14, bottom: 0 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="date" {...axisProps} tickFormatter={dayLabel} minTickGap={24} />
            <YAxis {...axisProps} allowDecimals={false} />
            <Tooltip content={<StatsTooltip labelFormatter={(label) => dayLabel(String(label))} />} cursor={{ fill: "var(--surface-muted)" }} />
            <Bar dataKey="pages" name={t("dashboard:reading.recent.pages")} fill={seq(2)} radius={BAR_RADIUS} maxBarSize={18} />
            <Line dataKey="average" name={t("dashboard:reading.recent.average")} type="monotone" stroke={viz(2)} strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </StatPanel>

      <StatPanel title={t("dashboard:reading.records.title")} subtitle={t("dashboard:reading.records.subtitle")} icon={Trophy} className="lg:col-span-5">
        <div className="grid grid-cols-2 gap-2">
          {recordTiles.map((tile) => (
            <div key={tile.label} className="flex min-w-0 items-center gap-3 rounded-sm border border-border bg-surface-muted/50 p-2.5">
              <tile.icon size={16} strokeWidth={1.5} className="shrink-0 text-primary" />
              <div className="min-w-0">
                <div className="truncate text-[11px] text-foreground-subtle">{tile.label}</div>
                <div className="truncate text-sm font-semibold tabular-nums text-foreground">{tile.value}</div>
                <div className="truncate text-[11px] text-foreground-subtle">{tile.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </StatPanel>

      <StatPanel title={t("dashboard:reading.calendar.title")} subtitle={t("dashboard:reading.calendar.subtitle", { pages: fmt(stats.calendar.reduce((sum, day) => sum + day.pages, 0)), days: fmt(stats.calendar.filter((day) => day.pages > 0).length) })} icon={CalendarDays} className="lg:col-span-12">
        <div className="overflow-x-auto">
          <CalendarHeatmap days={stats.calendar} />
        </div>
      </StatPanel>

      <StatPanel title={t("dashboard:reading.yoy.title")} subtitle={t("dashboard:reading.yoy.subtitle")} icon={LineChartIcon} className="lg:col-span-7">
        <div className="mb-2 flex flex-wrap items-end justify-between gap-3">
          <ChartLegend items={[{ label: String(new Date().getFullYear() - 1), color: "var(--foreground-subtle)", dashed: true }, { label: String(new Date().getFullYear()), color: viz(1) }]} />
          <StatFigure label={t("dashboard:reading.yoy.toDate")} value={fmt(stats.yoyTotals.current)} delta={yearDelta} hint={t("dashboard:reading.comparison.vsLastYear")} />
        </div>
        <ResponsiveContainer width="100%" height={210}>
          <LineChart data={stats.yoy} margin={{ top: 10, right: 8, left: -14, bottom: 0 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="month" {...axisProps} />
            <YAxis {...axisProps} allowDecimals={false} />
            <Tooltip content={<StatsTooltip unit={t("dashboard:common.pagesUnit")} />} cursor={{ stroke: "var(--border-strong)" }} />
            <Line dataKey="previous" name={String(new Date().getFullYear() - 1)} stroke="var(--foreground-subtle)" strokeWidth={2} dot={false} strokeDasharray="4 3" />
            <Line dataKey="current" name={String(new Date().getFullYear())} stroke={viz(1)} strokeWidth={2} dot={{ r: 3, fill: viz(1), stroke: "var(--surface)", strokeWidth: 2 }} connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      </StatPanel>

      <StatPanel title={t("dashboard:reading.consistency.title")} subtitle={t("dashboard:reading.consistency.subtitle")} icon={Timer} info={t("dashboard:reading.consistency.info")} className="lg:col-span-5">
        <div className="grid grid-cols-2 gap-4">
          <StatFigure label={t("dashboard:reading.consistency.active30")} value={`${fmt(Math.round((stats.last30.activeDays / 30) * 100))}%`} hint={t("dashboard:reading.consistency.daysOf30", { count: stats.last30.activeDays })} />
          <StatFigure label={t("dashboard:reading.consistency.deepDays")} value={fmt(stats.deepDays)} hint={t("dashboard:reading.consistency.deepHint")} />
        </div>
        <div className="mt-4 flex gap-[3px]">
          {stats.strip.map((day) => (
            <div
              key={day.date}
              className="h-7 flex-1"
              title={`${dayLabel(day.date)}: ${t("dashboard:common.pagesShort", { count: day.pages })} · ${formatDuration(day.minutes, language)}`}
              style={{ background: day.minutes >= 60 ? viz(7) : day.pages > 0 ? seq(2) : "var(--surface-muted)" }}
            />
          ))}
        </div>
        <div className="mt-2">
          <ChartLegend items={[{ label: t("dashboard:reading.consistency.read"), color: seq(2) }, { label: t("dashboard:reading.consistency.deep"), color: viz(7) }, { label: t("dashboard:reading.consistency.none"), color: "var(--surface-muted)" }]} />
        </div>
        <ResponsiveContainer width="100%" height={110} className="mt-3">
          <BarChart data={stats.series.map((point) => ({ month: monthLabel(point.month), share: Math.round((point.activeDays / point.daysInMonth) * 100) }))} margin={{ top: 6, right: 0, left: -24, bottom: 0 }}>
            <XAxis dataKey="month" {...axisProps} fontSize={10} interval={1} />
            <YAxis {...axisProps} domain={[0, 100]} ticks={[0, 50, 100]} fontSize={10} />
            <Tooltip content={<StatsTooltip unit="%" />} cursor={{ fill: "var(--surface-muted)" }} />
            <Bar dataKey="share" name={t("dashboard:reading.consistency.activeShare")} fill={seq(3)} radius={BAR_RADIUS} maxBarSize={16} />
          </BarChart>
        </ResponsiveContainer>
      </StatPanel>

      <StatPanel title={t("dashboard:reading.pace.title")} subtitle={t("dashboard:reading.pace.subtitle")} icon={Gauge} info={t("dashboard:reading.pace.info")} className="lg:col-span-6">
        {latestPace === null ? (
          <EmptyState compact message={t("dashboard:reading.pace.empty")} />
        ) : (
          <>
            <div className="mb-2 flex items-baseline gap-2">
              <span className="text-2xl font-semibold tabular-nums text-foreground">{fmt(latestPace)}</span>
              <span className="text-xs text-foreground-subtle">
                {t("dashboard:reading.pace.current")}
                {firstPace && firstPace !== latestPace ? ` · ${latestPace > firstPace ? "+" : ""}${fmt(Math.round(((latestPace - firstPace) / firstPace) * 100))}% ${t("dashboard:reading.pace.inPeriod")}` : ""}
              </span>
            </div>
            <ResponsiveContainer width="100%" height={150}>
              <AreaChart data={stats.series.map((point) => ({ month: monthLabel(point.month), pace: point.pagesPerHour }))} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="dashboard-pace" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={viz(3)} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={viz(3)} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="month" {...axisProps} />
                <YAxis {...axisProps} allowDecimals={false} />
                <Tooltip content={<StatsTooltip unit={t("dashboard:common.pagesPerHourUnit")} />} cursor={{ stroke: "var(--border-strong)" }} />
                <Area dataKey="pace" name={t("dashboard:reading.pace.series")} type="monotone" stroke={viz(3)} strokeWidth={2} fill="url(#dashboard-pace)" connectNulls />
              </AreaChart>
            </ResponsiveContainer>
            {stats.pace.length > 0 && (
              <div className="mt-3 space-y-1.5 border-t border-border pt-3">
                {stats.pace.map((item) => (
                  <div key={item.categoryId} className="grid grid-cols-12 items-center gap-2 text-xs">
                    <span className="col-span-4 truncate text-foreground-muted">{item.name}</span>
                    <div className="col-span-6"><ProgressBar value={item.pagesPerHour} max={stats.pace[0]?.pagesPerHour ?? 1} color={viz(3)} /></div>
                    <span className="col-span-2 text-right tabular-nums text-foreground">{fmt(item.pagesPerHour)}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </StatPanel>

      <StatPanel title={t("dashboard:reading.projection.title")} subtitle={t("dashboard:reading.projection.subtitle")} icon={CalendarRange} info={t("dashboard:reading.projection.info")} className="lg:col-span-6">
        {stats.projections.length === 0 ? (
          <EmptyState compact message={t("dashboard:reading.projection.empty")} />
        ) : (
          <div className="space-y-3.5">
            {stats.projections.map((book, index) => (
              <div key={book.key} className="min-w-0">
                <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate text-foreground">{book.title}</span>
                  <span className="shrink-0 text-xs tabular-nums text-foreground-muted">
                    {book.finishDate ? t("dashboard:reading.projection.finish", { date: dayLabel(book.finishDate), count: book.daysLeft ?? 0 }) : ""}
                  </span>
                </div>
                <ProgressBar value={book.pagesDone} max={book.totalPages} color={viz(index + 1)} />
                <div className="mt-1 text-[11px] tabular-nums text-foreground-subtle">
                  {t("dashboard:reading.projection.detail", { done: fmt(book.pagesDone), total: fmt(book.totalPages), pace: fmt(book.pagesPerDay) })}
                </div>
              </div>
            ))}
          </div>
        )}
      </StatPanel>

      <StatPanel title={t("dashboard:reading.categories.title")} subtitle={t("dashboard:reading.categories.subtitle")} icon={Layers} className="lg:col-span-8">
        <ChartLegend items={stats.categoryKeys.map((key, index) => ({ label: stats.categoryName(key), color: key === "other" ? "var(--foreground-subtle)" : viz(index + 1) }))} />
        <ResponsiveContainer width="100%" height={230}>
          <AreaChart data={stats.categorySeries.map((row) => ({ ...row, month: monthLabel(String(row.month)) }))} margin={{ top: 10, right: 8, left: -14, bottom: 0 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="month" {...axisProps} />
            <YAxis {...axisProps} allowDecimals={false} />
            <Tooltip content={<StatsTooltip unit={t("dashboard:common.pagesUnit")} />} cursor={{ stroke: "var(--border-strong)" }} />
            {stats.categoryKeys.map((key, index) => (
              <Area key={key} dataKey={key} name={stats.categoryName(key)} stackId="categories" type="monotone" stroke="var(--surface)" strokeWidth={1.5} fill={key === "other" ? "var(--foreground-subtle)" : viz(index + 1)} fillOpacity={0.85} />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </StatPanel>

      <StatPanel title={t("dashboard:reading.profile.title")} subtitle={t("dashboard:reading.profile.subtitle")} icon={RadarIcon} info={t("dashboard:reading.profile.info")} className="lg:col-span-4">
        <ChartLegend items={[{ label: t("dashboard:common.you"), color: viz(1) }, ...(stats.hasFriendProfile ? [{ label: t("dashboard:reading.profile.friends"), color: viz(2) }] : [])]} />
        <ResponsiveContainer width="100%" height={230}>
          <RadarChart data={stats.profile.map((axis) => ({ ...axis, label: t(`dashboard:reading.profile.axes.${axis.key}` as TranslationKey) }))} outerRadius="70%">
            <PolarGrid stroke="var(--viz-grid)" />
            <PolarAngleAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--foreground-subtle)" }} />
            {stats.hasFriendProfile && <Radar name={t("dashboard:reading.profile.friends")} dataKey="friends" stroke={viz(2)} fill={viz(2)} fillOpacity={0.1} strokeWidth={1.5} />}
            <Radar name={t("dashboard:common.you")} dataKey="you" stroke={viz(1)} fill={viz(1)} fillOpacity={0.22} strokeWidth={2} />
            <Tooltip content={<StatsTooltip unit="/100" />} />
          </RadarChart>
        </ResponsiveContainer>
      </StatPanel>

      <StatPanel title={t("dashboard:reading.weekday.title")} subtitle={t("dashboard:reading.weekday.subtitle")} icon={CalendarDays} className="lg:col-span-6">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={stats.weekday} margin={{ top: 10, right: 0, left: -22, bottom: 0 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="label" {...axisProps} />
            <YAxis {...axisProps} allowDecimals={false} />
            <Tooltip content={<StatsTooltip unit={t("dashboard:common.pagesUnit")} />} cursor={{ fill: "var(--surface-muted)" }} />
            <Bar dataKey="pages" name={t("dashboard:reading.weekday.average")} radius={BAR_RADIUS} maxBarSize={32}>
              {stats.weekday.map((day) => (
                <Cell key={day.label} fill={day.pages === maxWeekday && maxWeekday > 0 ? viz(1) : seq(2)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </StatPanel>

      <StatPanel title={t("dashboard:reading.clock.title")} subtitle={t("dashboard:reading.clock.subtitle")} icon={Clock} info={t("dashboard:reading.clock.info")} className="lg:col-span-6">
        {stats.hours.some((value) => value > 0) ? <ReadingClock hours={stats.hours} /> : <EmptyState compact message={t("dashboard:reading.clock.empty")} />}
      </StatPanel>
    </div>
  );
}

