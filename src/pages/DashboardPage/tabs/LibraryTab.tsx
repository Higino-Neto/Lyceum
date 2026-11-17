import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Filter, FileType2, Hourglass, LibraryBig, Network, PauseCircle, PenLine, Play, Shapes, Star, TrendingUp, UserRound, Waypoints } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Sankey, Tooltip, Treemap, XAxis, YAxis } from "recharts";
import { averagePagesPerDay, dailyTotals } from "../../../features/stats/readingAnalytics";
import { formatNumber, getShortMonthNames, useLanguage, useTranslation } from "../../../i18n";
import { BookCover } from "../components/ContinueReading";
import ChartLegend from "../components/stats/ChartLegend";
import { axisProps, BAR_RADIUS, gridProps, seq, viz } from "../components/stats/chartTheme";
import ConceptMap from "../components/stats/ConceptMap";
import EmptyState from "../components/stats/EmptyState";
import ProgressBar from "../components/stats/ProgressBar";
import StatFigure from "../components/stats/StatFigure";
import StatPanel from "../components/stats/StatPanel";
import StatsTooltip from "../components/stats/StatsTooltip";
import { useLibrarySummary, useReadingRecords, useThumbnails } from "../hooks/useDashboardData";
import { useOpenBook } from "../hooks/useOpenBook";

interface TreeCellProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  index?: number;
  name?: string;
  size?: number;
  unit?: string;
}

function TreeCell({ x = 0, y = 0, width = 0, height = 0, index = 0, name, size, unit }: TreeCellProps) {
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={viz((index % 8) + 1)} stroke="var(--surface)" strokeWidth={2} />
      {width > 70 && height > 34 && (
        <>
          <text x={x + 8} y={y + 18} fontSize={12} fontWeight={600} fill="white">
            {name && name.length > width / 7.5 ? `${name.slice(0, Math.floor(width / 7.5) - 1)}…` : name}
          </text>
          <text x={x + 8} y={y + 33} fontSize={10} fill="white" opacity={0.85}>
            {size} {unit}
          </text>
        </>
      )}
    </g>
  );
}

interface SankeyNodeProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  index?: number;
  payload?: { name: string; value: number; depth?: number };
}

function SankeyNode({ x = 0, y = 0, width = 0, height = 0, index = 0, payload }: SankeyNodeProps) {
  // Nodes on the last column (depth 2) are labelled on their left side.
  const right = (payload?.depth ?? 0) < 2;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={viz((index % 8) + 1)} />
      <text x={right ? x + width + 6 : x - 6} y={y + height / 2 + 4} textAnchor={right ? "start" : "end"} fontSize={11} fill="var(--foreground-muted)">
        {payload?.name} · {payload?.value}
      </text>
    </g>
  );
}

function formatBytes(bytes: number, language: string) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${formatNumber(value, language, { maximumFractionDigits: value >= 100 ? 0 : 1 })} ${units[unit]}`;
}

export default function LibraryTab() {
  const { t } = useTranslation();
  const { language, locale } = useLanguage();
  const queryClient = useQueryClient();
  const { data, available, isLoading } = useLibrarySummary();
  const { records } = useReadingRecords();
  const openBook = useOpenBook();
  const thumbnails = useThumbnails(data?.forgotten.map((book) => book.thumbnailPath) ?? []);
  const months = getShortMonthNames(language);
  const fmt = (value: number) => formatNumber(value, language);
  const derived = useMemo(() => {
    if (!data) return null;
    const monthLabel = (key: string) => `${months[Number(key.slice(5, 7)) - 1] ?? ""} ${key.slice(2, 4)}`;
    const pace = averagePagesPerDay(dailyTotals(records), new Date(), 90);
    const backlogDays = pace > 0 ? data.totals.backlogPages / pace : null;
    let cumulativeAdded = 0;
    let cumulativeFinished = 0;
    const growth = data.growth.map((point) => {
      cumulativeAdded += point.added;
      cumulativeFinished += point.finished;
      return { ...point, label: monthLabel(point.month) };
    });
    // Share of the library read at each month end (approximation: books
    // added before the window count towards the total from the start).
    const before = Math.max(0, data.totals.books - cumulativeAdded);
    const finishedBefore = Math.max(0, data.totals.finished - cumulativeFinished);
    let added = before;
    let finished = finishedBefore;
    const share = data.growth.map((point) => {
      added += point.added;
      finished += point.finished;
      return { label: monthLabel(point.month), share: added > 0 ? Math.min(100, Math.round((finished / added) * 1000) / 10) : 0 };
    });
    const status = data.status;
    const notStarted = Math.max(0, data.totals.books - status.started);
    const startedOther = Math.max(0, status.started - status.reading - status.paused - status.read);
    const nodes = [
      { name: t("dashboard:library.journey.library") },
      { name: t("dashboard:library.journey.notStarted") },
      { name: t("dashboard:library.journey.started") },
      { name: t("dashboard:library.journey.queue") },
      { name: t("dashboard:library.journey.noStatus") },
      { name: t("dashboard:library.journey.reading") },
      { name: t("dashboard:library.journey.paused") },
      { name: t("dashboard:library.journey.finished") },
      { name: t("dashboard:library.journey.inProgress") },
    ];
    const queueNotStarted = Math.min(status.wantToRead, notStarted);
    const links = [
      { source: 0, target: 1, value: notStarted },
      { source: 0, target: 2, value: status.started },
      { source: 1, target: 3, value: queueNotStarted },
      { source: 1, target: 4, value: notStarted - queueNotStarted },
      { source: 2, target: 5, value: status.reading },
      { source: 2, target: 6, value: status.paused },
      { source: 2, target: 7, value: status.read },
      { source: 2, target: 8, value: startedOther },
    ].filter((link) => link.value > 0);
    const used = new Set(links.flatMap((link) => [link.source, link.target]));
    const remap = new Map([...used].sort((a, b) => a - b).map((original, index) => [original, index]));
    const sankey = {
      nodes: nodes.filter((_, index) => used.has(index)),
      links: links.map((link) => ({ ...link, source: remap.get(link.source) ?? 0, target: remap.get(link.target) ?? 0 })),
    };
    const ratingsTotal = data.ratings.reduce((sum, item) => sum + item.count, 0);
    const ratingAverage = ratingsTotal > 0 ? data.ratings.reduce((sum, item) => sum + item.rating * item.count, 0) / ratingsTotal : 0;
    const books = [...new Set(data.conceptGraph.nodes.map((node) => node.bookId))];
    return { pace, backlogDays, growth, share, sankey, ratingsTotal, ratingAverage, books };
  }, [data, months, records, t]);

  if (!available) return <EmptyState icon={LibraryBig} message={t("dashboard:library.desktopOnly")} />;
  if (isLoading) return null;
  if (!data || !derived || data.totals.books === 0) return <EmptyState icon={LibraryBig} message={t("dashboard:library.empty")} />;

  const backlog = derived.backlogDays === null
    ? "—"
    : derived.backlogDays >= 365
      ? t("dashboard:library.size.years", { value: fmt(Math.round((derived.backlogDays / 365) * 10) / 10) })
      : t("dashboard:common.days", { count: Math.round(derived.backlogDays) });
  const totalFormats = data.formats.reduce((sum, item) => sum + item.count, 0);
  // "Reading now" and "finished" are both shares of the started books.
  const funnel = [
    { key: "library", value: data.totals.books, base: null },
    { key: "started", value: data.status.started, base: data.totals.books },
    { key: "reading", value: data.status.reading, base: data.status.started },
    { key: "finished", value: data.status.read, base: data.status.started },
  ] as const;
  const completion = data.status.started > 0 ? Math.round((data.status.read / data.status.started) * 100) : 0;

  const pauseBook = async (fileHash: string) => {
    const result = (await window.api?.updateReadingStatus(fileHash, "paused")) as { success?: boolean } | undefined;
    if (result?.success === false) {
      toast.error(t("dashboard:library.forgotten.pauseFailed"));
      return;
    }
    toast.success(t("dashboard:library.forgotten.paused"));
    await queryClient.invalidateQueries({ queryKey: ["stats", "library"] });
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <StatPanel title={t("dashboard:library.size.title")} subtitle={t("dashboard:library.size.subtitle")} icon={LibraryBig} info={t("dashboard:library.size.info")} className="lg:col-span-12">
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-3 xl:grid-cols-6">
          <StatFigure label={t("dashboard:library.size.books")} value={fmt(data.totals.books)} hint={t("dashboard:library.size.finished", { count: data.totals.finished })} />
          <StatFigure label={t("dashboard:library.size.pages")} value={fmt(data.totals.pages)} />
          <StatFigure label={t("dashboard:library.size.pagesRead")} value={fmt(data.totals.pagesRead)} hint={t("dashboard:library.size.ofLibrary", { value: fmt(data.totals.pages > 0 ? Math.round((data.totals.pagesRead / data.totals.pages) * 1000) / 10 : 0) })} />
          <StatFigure label={t("dashboard:library.size.disk")} value={formatBytes(data.totals.bytes, language)} />
          <StatFigure label={t("dashboard:library.size.backlogPages")} value={fmt(data.totals.backlogPages)} />
          <StatFigure label={t("dashboard:library.size.backlog")} value={backlog} hint={derived.pace > 0 ? t("dashboard:library.size.atPace", { value: fmt(Math.round(derived.pace)) }) : undefined} />
        </div>
      </StatPanel>

      <StatPanel title={t("dashboard:library.journey.title")} subtitle={t("dashboard:library.journey.subtitle")} icon={Waypoints} className="lg:col-span-7">
        <ResponsiveContainer width="100%" height={250}>
          <Sankey data={derived.sankey} nodePadding={22} nodeWidth={10} margin={{ top: 10, right: 16, bottom: 10, left: 10 }} link={{ stroke: "var(--primary)", strokeOpacity: 0.16 }} node={<SankeyNode />}>
            <Tooltip content={<StatsTooltip unit={t("dashboard:common.booksUnit")} />} />
          </Sankey>
        </ResponsiveContainer>
      </StatPanel>

      <StatPanel title={t("dashboard:library.funnel.title")} subtitle={t("dashboard:library.funnel.subtitle")} icon={Filter} className="lg:col-span-5">
        <div className="space-y-3 pt-1">
          {funnel.map((stage, index) => {
            const previous = stage.base ?? 0;
            return (
              <div key={stage.key}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-foreground">{t(`dashboard:library.funnel.${stage.key}`)}</span>
                  <span className="tabular-nums text-foreground-muted">
                    {fmt(stage.value)}
                    {previous > 0 && <span className="ml-2 text-xs text-foreground-subtle">{fmt(Math.round((stage.value / previous) * 100))}%</span>}
                  </span>
                </div>
                <div className="h-5 bg-surface-muted">
                  <div className="h-full" style={{ width: `${data.totals.books > 0 ? (stage.value / data.totals.books) * 100 : 0}%`, background: viz(index + 1) }} />
                </div>
              </div>
            );
          })}
          <div className="pt-1 text-xs text-foreground-subtle">{t("dashboard:library.funnel.completion", { value: fmt(completion), paused: fmt(data.status.paused) })}</div>
        </div>
      </StatPanel>

      <StatPanel title={t("dashboard:library.forgotten.title")} subtitle={t("dashboard:library.forgotten.subtitle")} icon={Hourglass} className="lg:col-span-6">
        {data.forgotten.length === 0 ? (
          <EmptyState compact message={t("dashboard:library.forgotten.empty")} />
        ) : (
          <div className="space-y-2">
            {data.forgotten.map((book) => {
              const days = book.lastOpenedAt ? Math.max(0, Math.round((Date.now() - new Date(book.lastOpenedAt.replace(" ", "T") + (book.lastOpenedAt.includes("T") ? "" : "Z")).getTime()) / 86_400_000)) : 0;
              return (
                <div key={book.id} className="flex items-center gap-3 rounded-sm border border-border p-2">
                  <BookCover src={book.thumbnailPath ? thumbnails[book.thumbnailPath] : null} title={book.title} className="h-11 w-8" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-foreground">{book.title}</div>
                    <div className="text-[11px] text-foreground-subtle">
                      {t("dashboard:library.forgotten.idle", { count: days })} · {fmt(book.numPages > 0 ? Math.round((book.currentPage / book.numPages) * 100) : 0)}%
                    </div>
                  </div>
                  <button type="button" onClick={() => void openBook(book.id)} className="flex cursor-pointer items-center gap-1 rounded-sm border border-border-strong px-2 py-1 text-xs text-foreground transition hover:bg-surface-muted">
                    <Play size={12} strokeWidth={1.5} /> {t("dashboard:library.forgotten.resume")}
                  </button>
                  <button type="button" onClick={() => void pauseBook(book.fileHash)} className="flex cursor-pointer items-center gap-1 rounded-sm px-2 py-1 text-xs text-foreground-subtle transition hover:bg-surface-muted hover:text-foreground" title={t("dashboard:library.forgotten.pauseHint")}>
                    <PauseCircle size={12} strokeWidth={1.5} /> {t("dashboard:library.forgotten.pause")}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </StatPanel>

      <StatPanel title={t("dashboard:library.formats.title")} subtitle={t("dashboard:library.formats.subtitle")} icon={FileType2} className="lg:col-span-6">
        <div className="flex items-center gap-4">
          <div className="h-[180px] w-1/2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.formats} dataKey="count" nameKey="format" innerRadius={52} outerRadius={78} paddingAngle={1} stroke="var(--surface)" strokeWidth={2}>
                  {data.formats.map((item, index) => (
                    <Cell key={item.format} fill={index < 7 ? viz(index + 1) : "var(--foreground-subtle)"} />
                  ))}
                </Pie>
                <Tooltip content={<StatsTooltip unit={t("dashboard:common.booksUnit")} />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1 space-y-1.5">
            {data.formats.slice(0, 8).map((item, index) => (
              <div key={item.format} className="flex items-center gap-2 text-sm">
                <span className="h-2.5 w-2.5" style={{ background: index < 7 ? viz(index + 1) : "var(--foreground-subtle)" }} />
                <span className="uppercase text-foreground">{item.format}</span>
                <span className="ml-auto tabular-nums text-foreground-muted">
                  {fmt(item.count)} · {fmt(totalFormats > 0 ? Math.round((item.count / totalFormats) * 100) : 0)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </StatPanel>

      <StatPanel title={t("dashboard:library.subjects.title")} subtitle={t("dashboard:library.subjects.subtitle")} icon={Shapes} className="lg:col-span-7">
        {data.subjects.length === 0 ? (
          <EmptyState compact message={t("dashboard:library.subjects.empty")} />
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <Treemap data={data.subjects.map((subject) => ({ name: subject.name, size: subject.count }))} dataKey="size" aspectRatio={16 / 9} content={<TreeCell unit={t("dashboard:common.booksUnit")} />} isAnimationActive={false}>
              <Tooltip content={<StatsTooltip unit={t("dashboard:common.booksUnit")} />} />
            </Treemap>
          </ResponsiveContainer>
        )}
      </StatPanel>

      <StatPanel title={t("dashboard:library.authors.title")} subtitle={t("dashboard:library.authors.subtitle")} icon={UserRound} className="lg:col-span-5">
        {data.authors.length === 0 ? (
          <EmptyState compact message={t("dashboard:library.authors.empty")} />
        ) : (
          <div className="space-y-2.5">
            {data.authors.map((author) => (
              <div key={author.name}>
                <div className="mb-1 flex justify-between gap-3 text-sm">
                  <span className="truncate text-foreground">{author.name}</span>
                  <span className="shrink-0 text-xs tabular-nums text-foreground-muted">
                    {t("dashboard:library.authors.books", { count: author.count })} · {t("dashboard:common.pagesShort", { count: author.pages })}
                  </span>
                </div>
                <ProgressBar value={author.count} max={data.authors[0]?.count ?? 1} color={viz(7)} />
              </div>
            ))}
          </div>
        )}
      </StatPanel>

      <StatPanel title={t("dashboard:library.growth.title")} subtitle={t("dashboard:library.growth.subtitle")} icon={TrendingUp} info={t("dashboard:library.growth.info")} className="lg:col-span-8">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <ChartLegend items={[{ label: t("dashboard:library.growth.added"), color: seq(2) }, { label: t("dashboard:library.growth.finished"), color: viz(2) }]} />
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={derived.growth} margin={{ top: 10, right: 0, left: -22, bottom: 0 }} barGap={1}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="label" {...axisProps} interval={5} />
                <YAxis {...axisProps} allowDecimals={false} />
                <Tooltip content={<StatsTooltip unit={t("dashboard:common.booksUnit")} />} cursor={{ fill: "var(--surface-muted)" }} />
                <Bar dataKey="added" name={t("dashboard:library.growth.added")} fill={seq(2)} radius={BAR_RADIUS} />
                <Bar dataKey="finished" name={t("dashboard:library.growth.finished")} fill={viz(2)} radius={BAR_RADIUS} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div>
            <div className="text-xs text-foreground-muted">{t("dashboard:library.growth.share")}</div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={derived.share} margin={{ top: 10, right: 8, left: -22, bottom: 0 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="label" {...axisProps} interval={5} />
                <YAxis {...axisProps} unit="%" />
                <Tooltip content={<StatsTooltip unit="%" />} cursor={{ stroke: "var(--border-strong)" }} />
                <Area dataKey="share" name={t("dashboard:library.growth.shareSeries")} type="monotone" stroke={viz(2)} strokeWidth={2} fill={viz(2)} fillOpacity={0.12} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </StatPanel>

      <StatPanel title={t("dashboard:library.ratings.title")} subtitle={t("dashboard:library.ratings.subtitle")} icon={Star} className="lg:col-span-4">
        {derived.ratingsTotal === 0 ? (
          <EmptyState compact message={t("dashboard:library.ratings.empty")} />
        ) : (
          <>
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={[1, 2, 3, 4, 5].map((rating) => ({ rating: `${rating}★`, count: data.ratings.find((item) => item.rating === rating)?.count ?? 0 }))} margin={{ top: 10, right: 0, left: -24, bottom: 0 }}>
                <XAxis dataKey="rating" {...axisProps} />
                <YAxis {...axisProps} allowDecimals={false} />
                <Tooltip content={<StatsTooltip unit={t("dashboard:common.booksUnit")} />} cursor={{ fill: "var(--surface-muted)" }} />
                <Bar dataKey="count" name={t("dashboard:library.ratings.series")} fill={viz(4)} radius={BAR_RADIUS} maxBarSize={30} />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-1 text-xs text-foreground-subtle">
              {t("dashboard:library.ratings.summary", { average: fmt(Math.round(derived.ratingAverage * 10) / 10), count: data.totals.favorites })}
            </div>
            {data.topRated.length > 0 && (
              <ul className="mt-3 space-y-1 border-t border-border pt-3 text-xs">
                {data.topRated.slice(0, 4).map((book) => (
                  <li key={book.id} className="flex justify-between gap-2">
                    <span className="truncate text-foreground">{book.title}</span>
                    <span className="shrink-0 tabular-nums text-foreground-muted">{fmt(book.rating)}★</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </StatPanel>

      <StatPanel title={t("dashboard:library.annotations.title")} subtitle={t("dashboard:library.annotations.subtitle")} icon={PenLine} className="lg:col-span-6">
        {data.recentAnnotations.length === 0 ? (
          <EmptyState compact message={t("dashboard:library.annotations.empty")} />
        ) : (
          <div className="space-y-2">
            {data.recentAnnotations.slice(0, 6).map((annotation) => (
              <div key={`${annotation.kind}-${annotation.id}`} className="border-l-2 border-primary bg-surface-muted/60 px-3 py-2">
                <div className="line-clamp-2 text-sm text-foreground">{annotation.title}</div>
                {annotation.note && annotation.note !== annotation.title && <div className="mt-0.5 line-clamp-2 text-xs text-foreground-muted">{annotation.note}</div>}
                <div className="mt-1 text-[11px] text-foreground-subtle">
                  {[annotation.bookTitle, t(`dashboard:library.annotations.kinds.${annotation.kind}`), new Date(annotation.createdAt.includes("T") ? annotation.createdAt : `${annotation.createdAt.replace(" ", "T")}Z`).toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" })].filter(Boolean).join(" · ")}
                </div>
              </div>
            ))}
          </div>
        )}
      </StatPanel>

      <StatPanel title={t("dashboard:library.concepts.title")} subtitle={t("dashboard:library.concepts.subtitle")} icon={Network} info={t("dashboard:library.concepts.info")} className="lg:col-span-6">
        {data.conceptGraph.nodes.length === 0 ? (
          <EmptyState compact message={t("dashboard:library.concepts.empty")} />
        ) : (
          <>
            <ConceptMap graph={data.conceptGraph} books={derived.books} />
            <ChartLegend
              items={derived.books.slice(0, 8).map((bookId, index) => ({
                label: data.conceptGraph.nodes.find((node) => node.bookId === bookId)?.bookTitle || t("dashboard:library.concepts.unknownBook"),
                color: viz(index + 1),
              }))}
            />
          </>
        )}
      </StatPanel>
    </div>
  );
}
