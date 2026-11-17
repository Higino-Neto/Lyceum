import { useMemo } from "react";
import { BookA, BookMarked, GraduationCap, Languages, LineChart as LineChartIcon, Repeat2, ScanText } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { parseIsoDate } from "../../../features/stats/readingAnalytics";
import { formatNumber, useLanguage, useTranslation, type TranslationKey } from "../../../i18n";
import ChartLegend from "../components/stats/ChartLegend";
import { axisProps, BAR_RADIUS_HORIZONTAL, gridProps, viz } from "../components/stats/chartTheme";
import EmptyState from "../components/stats/EmptyState";
import ProgressBar from "../components/stats/ProgressBar";
import StatFigure from "../components/stats/StatFigure";
import StatPanel from "../components/stats/StatPanel";
import StatsTooltip from "../components/stats/StatsTooltip";
import { useLanguageSummary } from "../hooks/useDashboardData";

/** Approximate known-lemma milestones per CEFR level (vocabulary size only). */
const CEFR = [
  { level: "A1", words: 500 },
  { level: "A2", words: 1_000 },
  { level: "B1", words: 2_000 },
  { level: "B2", words: 4_000 },
  { level: "C1", words: 8_000 },
  { level: "C2", words: 16_000 },
];

function estimateLevel(known: number) {
  let reached: (typeof CEFR)[number] | null = null;
  for (const step of CEFR) if (known >= step.words) reached = step;
  const next = CEFR.find((step) => step.words > known) ?? null;
  return { level: reached?.level ?? null, next, floor: reached?.words ?? 0 };
}

const STATE_COLORS = { known: "var(--viz-3)", learning: "var(--viz-4)", unknown: "var(--foreground-subtle)", ignored: "var(--surface-muted)" };

export default function LanguageTab() {
  const { t } = useTranslation();
  const { language, locale } = useLanguage();
  const { data, available, isLoading } = useLanguageSummary();
  const fmt = (value: number) => formatNumber(value, language);
  const languageName = useMemo(() => {
    let names: Intl.DisplayNames | null = null;
    try {
      names = new Intl.DisplayNames([locale], { type: "language" });
    } catch {
      names = null;
    }
    return (code: string) => {
      const label = names?.of(code) ?? code;
      return label.charAt(0).toLocaleUpperCase(locale) + label.slice(1);
    };
  }, [locale]);

  const curve = useMemo(() => {
    if (!data) return { rows: [] as Array<Record<string, number | string>>, languages: [] as string[] };
    const languages = data.languages.map((item) => item.language);
    const byDate = new Map<string, Record<string, number | string>>();
    for (const point of data.history) {
      const row = byDate.get(point.date) ?? { date: point.date };
      row[point.language] = point.known;
      row[`${point.language}:learning`] = point.learning;
      byDate.set(point.date, row);
    }
    return { rows: [...byDate.values()].sort((a, b) => String(a.date).localeCompare(String(b.date))), languages };
  }, [data]);

  if (!available) return <EmptyState icon={Languages} message={t("dashboard:languages.desktopOnly")} />;
  if (isLoading) return null;
  if (!data || data.languages.length === 0) return <EmptyState icon={Languages} message={t("dashboard:languages.empty")} />;

  const totals = data.languages.reduce(
    (sum, item) => ({ known: sum.known + item.known, learning: sum.learning + item.learning, lookups: sum.lookups + item.lookups, saved: sum.saved + item.reviewItems }),
    { known: 0, learning: 0, lookups: 0, saved: 0 },
  );
  const dayLabel = (iso: string) => parseIsoDate(iso).toLocaleDateString(locale, { day: "2-digit", month: "short" });
  const single = curve.languages.length === 1 ? curve.languages[0] : null;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <StatPanel title={t("dashboard:languages.summary.title")} subtitle={t("dashboard:languages.summary.subtitle")} icon={Languages} className="lg:col-span-12">
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
          <StatFigure label={t("dashboard:languages.summary.known")} value={fmt(totals.known)} hint={t("dashboard:languages.summary.inLanguages", { count: data.languages.length })} />
          <StatFigure label={t("dashboard:languages.summary.learning")} value={fmt(totals.learning)} />
          <StatFigure label={t("dashboard:languages.summary.saved")} value={fmt(totals.saved)} hint={t("dashboard:languages.summary.savedHint")} />
          <StatFigure label={t("dashboard:languages.summary.lookups")} value={fmt(totals.lookups)} hint={t("dashboard:languages.summary.lookupsHint")} />
        </div>
      </StatPanel>

      <StatPanel title={t("dashboard:languages.curve.title")} subtitle={t("dashboard:languages.curve.subtitle")} icon={LineChartIcon} info={t("dashboard:languages.curve.info")} className="lg:col-span-8">
        <ChartLegend
          items={[
            ...curve.languages.map((code, index) => ({ label: single ? t("dashboard:languages.states.known") : languageName(code), color: viz(index + 1) })),
            ...(single ? [{ label: t("dashboard:languages.states.learning"), color: viz(4), dashed: true }] : []),
          ]}
        />
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={curve.rows} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="date" {...axisProps} tickFormatter={dayLabel} minTickGap={28} />
            <YAxis {...axisProps} allowDecimals={false} />
            <Tooltip content={<StatsTooltip labelFormatter={(label) => dayLabel(String(label))} unit={t("dashboard:languages.wordsUnit")} />} cursor={{ stroke: "var(--border-strong)" }} />
            {curve.languages.map((code, index) => (
              <Line key={code} dataKey={code} name={single ? t("dashboard:languages.states.known") : languageName(code)} type="monotone" stroke={viz(index + 1)} strokeWidth={2} dot={false} />
            ))}
            {single && <Line dataKey={`${single}:learning`} name={t("dashboard:languages.states.learning")} type="monotone" stroke={viz(4)} strokeWidth={2} strokeDasharray="4 3" dot={false} />}
          </LineChart>
        </ResponsiveContainer>
      </StatPanel>

      <StatPanel title={t("dashboard:languages.level.title")} subtitle={t("dashboard:languages.level.subtitle")} icon={GraduationCap} info={t("dashboard:languages.level.info")} className="lg:col-span-4">
        <div className="space-y-4">
          {data.languages.map((item) => {
            const estimate = estimateLevel(item.known);
            return (
              <div key={item.language}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm text-foreground-muted">{languageName(item.language)}</span>
                  <span className="text-2xl font-semibold tabular-nums text-foreground">{estimate.level ?? t("dashboard:languages.level.preA1")}</span>
                </div>
                <ProgressBar value={item.known - estimate.floor} max={(estimate.next?.words ?? item.known) - estimate.floor || 1} color={viz(3)} className="mt-1.5" />
                <div className="mt-1 text-[11px] text-foreground-subtle">
                  {estimate.next
                    ? t("dashboard:languages.level.next", { count: estimate.next.words - item.known, level: estimate.next.level })
                    : t("dashboard:languages.level.top")}
                </div>
              </div>
            );
          })}
        </div>
      </StatPanel>

      <StatPanel title={t("dashboard:languages.states.title")} subtitle={t("dashboard:languages.states.subtitle")} icon={BookA} className="lg:col-span-6">
        <ChartLegend items={(["known", "learning", "unknown", "ignored"] as const).map((state) => ({ label: t(`dashboard:languages.states.${state}` as TranslationKey), color: STATE_COLORS[state] }))} />
        <ResponsiveContainer width="100%" height={Math.max(90, data.languages.length * 44 + 30)}>
          <BarChart data={data.languages.map((item) => ({ ...item, name: languageName(item.language) }))} layout="vertical" margin={{ top: 10, right: 8, left: 0, bottom: 0 }} barCategoryGap={10}>
            <CartesianGrid stroke="var(--viz-grid)" horizontal={false} />
            <XAxis type="number" {...axisProps} allowDecimals={false} />
            <YAxis type="category" dataKey="name" {...axisProps} width={84} />
            <Tooltip content={<StatsTooltip unit={t("dashboard:languages.wordsUnit")} />} cursor={{ fill: "var(--surface-muted)" }} />
            {(["known", "learning", "unknown", "ignored"] as const).map((state, index, list) => (
              <Bar key={state} dataKey={state} name={t(`dashboard:languages.states.${state}` as TranslationKey)} stackId="states" fill={STATE_COLORS[state]} stroke="var(--surface)" strokeWidth={1} radius={index === list.length - 1 ? BAR_RADIUS_HORIZONTAL : undefined} maxBarSize={26} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </StatPanel>

      <StatPanel title={t("dashboard:languages.coverage.title")} subtitle={t("dashboard:languages.coverage.subtitle")} icon={ScanText} info={t("dashboard:languages.coverage.info")} className="lg:col-span-6">
        {data.coverage.length === 0 ? (
          <EmptyState compact message={t("dashboard:languages.coverage.empty")} />
        ) : (
          <div className="space-y-3">
            {data.coverage.slice(0, 8).map((book) => {
              const level = book.known >= 0.98 ? "comfortable" : book.known >= 0.9 ? "study" : "hard";
              return (
                <div key={book.documentId} className="min-w-0">
                  <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate text-foreground">{book.title}</span>
                    <span className="shrink-0 text-xs tabular-nums text-foreground-muted">
                      {fmt(Math.round(book.known * 1000) / 10)}% · {t(`dashboard:languages.coverage.levels.${level}` as TranslationKey)}
                    </span>
                  </div>
                  <div className="relative flex h-2 w-full bg-surface-muted">
                    <div style={{ width: `${book.known * 100}%`, background: STATE_COLORS.known }} />
                    <div style={{ width: `${book.learning * 100}%`, background: STATE_COLORS.learning }} />
                    <div className="absolute -top-0.5 h-3 w-px bg-foreground-muted" style={{ left: "90%" }} title="90%" />
                    <div className="absolute -top-0.5 h-3 w-px bg-foreground" style={{ left: "98%" }} title="98%" />
                  </div>
                  <div className="mt-1 text-[11px] text-foreground-subtle">
                    {languageName(book.language)} · {t("dashboard:languages.coverage.lexemes", { count: book.lexemes })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </StatPanel>

      <StatPanel title={t("dashboard:languages.byBook.title")} subtitle={t("dashboard:languages.byBook.subtitle")} icon={BookMarked} className="lg:col-span-6">
        {data.wordsByBook.length === 0 ? (
          <EmptyState compact message={t("dashboard:languages.byBook.empty")} />
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(120, data.wordsByBook.length * 32 + 20)}>
            <BarChart data={data.wordsByBook} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }} barCategoryGap={8}>
              <CartesianGrid stroke="var(--viz-grid)" horizontal={false} />
              <XAxis type="number" {...axisProps} allowDecimals={false} />
              <YAxis type="category" dataKey="title" {...axisProps} width={150} tickFormatter={(value: string) => (value.length > 22 ? `${value.slice(0, 21)}…` : value)} />
              <Tooltip content={<StatsTooltip unit={t("dashboard:languages.wordsUnit")} />} cursor={{ fill: "var(--surface-muted)" }} />
              <Bar dataKey="saved" name={t("dashboard:languages.byBook.series")} fill={viz(1)} radius={BAR_RADIUS_HORIZONTAL} maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </StatPanel>

      <StatPanel title={t("dashboard:languages.stubborn.title")} subtitle={t("dashboard:languages.stubborn.subtitle")} icon={Repeat2} info={t("dashboard:languages.stubborn.info")} className="lg:col-span-6">
        {data.stubborn.length === 0 ? (
          <EmptyState compact message={t("dashboard:languages.stubborn.empty")} />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-foreground-subtle">
                <th className="pb-2 font-medium">{t("dashboard:languages.stubborn.word")}</th>
                <th className="pb-2 font-medium">{t("dashboard:languages.stubborn.translation")}</th>
                <th className="pb-2 text-right font-medium">{t("dashboard:languages.stubborn.lookups")}</th>
              </tr>
            </thead>
            <tbody>
              {data.stubborn.map((word) => (
                <tr key={`${word.language}:${word.key}`} className="border-b border-border/60 last:border-0">
                  <td className="py-1.5 pr-3">
                    <span className="font-medium text-foreground">{word.label}</span>
                    <span className="ml-2 text-[11px] uppercase text-foreground-subtle">{word.language}</span>
                  </td>
                  <td className="max-w-48 truncate py-1.5 pr-3 text-foreground-muted">{word.translation || "—"}</td>
                  <td className="py-1.5 text-right tabular-nums text-foreground">{fmt(word.lookupCount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </StatPanel>
    </div>
  );
}
