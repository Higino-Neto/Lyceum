import { useMemo, useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import { Award, CalendarCheck, Check, Copy, Flame, Lock, Pencil, Snowflake, Sparkles, Target, X } from "lucide-react";
import { computeAchievements } from "../../../features/stats/achievements";
import { goalProgress, type GoalId, type ReadingGoals } from "../../../features/stats/goals";
import { addDays, currentStreak, dailyTotals, longestStreak, parseIsoDate, startOfWeek, toIsoDate } from "../../../features/stats/readingAnalytics";
import { monthReview, readingYears, yearReview } from "../../../features/stats/retrospective";
import { formatDuration, formatNumber, getShortMonthNames, getWeekdayInitials, useLanguage, useTranslation, type TranslationKey } from "../../../i18n";
import ProgressBar from "../components/stats/ProgressBar";
import ProgressRing from "../components/stats/ProgressRing";
import StatFigure from "../components/stats/StatFigure";
import StatPanel from "../components/stats/StatPanel";
import { useCategories, useLanguageSummary, useLibrarySummary, useReadingGoals, useReadingRecords, useStreakFreeze } from "../hooks/useDashboardData";

const GOAL_FIELDS: Array<{ id: GoalId; field: keyof ReadingGoals | "daily" }> = [
  { id: "daily", field: "daily" },
  { id: "weekly", field: "weeklyPages" },
  { id: "monthly", field: "monthlyPages" },
  { id: "yearly", field: "yearlyPages" },
  { id: "yearlyBooks", field: "yearlyBooks" },
];

const delta = (current: number, previous: number) => (previous > 0 ? Math.round(((current - previous) / previous) * 100) : null);

export default function GoalsTab() {
  const { t } = useTranslation();
  const { language, locale } = useLanguage();
  const { records } = useReadingRecords();
  const { data: library } = useLibrarySummary();
  const { data: vocabulary } = useLanguageSummary();
  const { data: categories } = useCategories();
  const { dailyGoal, setDailyGoal, goals, setGoals } = useReadingGoals();
  const [freezeEnabled, setFreezeEnabled] = useStreakFreeze();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const now = useMemo(() => new Date(), []);
  const years = useMemo(() => readingYears(records, now), [now, records]);
  const [year, setYear] = useState(now.getFullYear());
  const [monthOffset, setMonthOffset] = useState(now.getDate() <= 7 ? 1 : 0);
  const months = getShortMonthNames(language);
  const initials = getWeekdayInitials(language);
  const fmt = (value: number) => formatNumber(value, language);
  const monthName = (key: string) => new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, 1).toLocaleDateString(locale, { month: "long", year: "numeric" });
  const categoryName = (id: string | null) => (id ? categories?.find((category) => category.id === id)?.name ?? null : null);

  const booksFinishedIn = (targetYear: number) => {
    if (!library) return null;
    if (targetYear === now.getFullYear()) return library.finishedThisYear;
    return library.growth.filter((point) => point.month.startsWith(String(targetYear))).reduce((sum, point) => sum + point.finished, 0);
  };

  const wordsLearnedIn = (from: string, to: string) => {
    if (!vocabulary || vocabulary.history.length === 0) return null;
    let total = 0;
    for (const { language: code } of vocabulary.languages) {
      const points = vocabulary.history.filter((point) => point.language === code);
      // Baseline: the last value before the period, or its first value when the
      // history starts inside it (so existing vocabulary is not counted as new).
      const before = [...points].reverse().find((point) => point.date < from)?.known
        ?? points.find((point) => point.date >= from && point.date <= to)?.known
        ?? 0;
      const end = [...points].reverse().find((point) => point.date <= to)?.known ?? before;
      total += Math.max(0, end - before);
    }
    return total;
  };

  const progress = useMemo(() => goalProgress(records, dailyGoal, goals, library?.finishedThisYear ?? 0, now), [dailyGoal, goals, library?.finishedThisYear, now, records]);
  const yearStats = useMemo(() => yearReview(records, year, now), [now, records, year]);
  const monthStats = useMemo(() => monthReview(records, now, monthOffset), [monthOffset, now, records]);

  const streak = useMemo(() => {
    const daily = dailyTotals(records);
    const withFreeze = currentStreak(daily, now, 1);
    const plain = currentStreak(daily, now, 0);
    const active = freezeEnabled ? withFreeze : plain;
    const weekStart = startOfWeek(now);
    const frozen = new Set(active.frozen);
    const week = Array.from({ length: 7 }, (_, index) => {
      const date = toIsoDate(addDays(weekStart, index));
      const day = daily.get(date);
      const state = date > toIsoDate(now) ? "future" : day && (day.pages > 0 || day.minutes > 0) ? "read" : frozen.has(date) ? "frozen" : "missed";
      return { date, weekday: (index + 1) % 7, state };
    });
    return { active, plain, withFreeze, week, longest: longestStreak(daily).days };
  }, [freezeEnabled, now, records]);

  const achievements = useMemo(() => {
    const daily = dailyTotals(records);
    let totalPages = 0;
    let activeDays = 0;
    let bestDay = 0;
    for (const day of daily.values()) {
      totalPages += day.pages;
      if (day.pages > 0 || day.minutes > 0) activeDays += 1;
      bestDay = Math.max(bestDay, day.pages);
    }
    return computeAchievements({
      totalPages,
      activeDays,
      bestDayPages: bestDay,
      longestStreak: longestStreak(daily).days,
      booksFinished: library?.totals.finished ?? 0,
      knownWords: vocabulary?.languages.reduce((sum, item) => sum + item.known, 0) ?? 0,
      languages: vocabulary?.languages.filter((item) => item.known >= 100).length ?? 0,
      annotations: library?.totals.annotations ?? 0,
    });
  }, [library, records, vocabulary]);

  const startEditing = () => {
    setDraft({
      daily: String(dailyGoal || ""),
      weeklyPages: String(goals.weeklyPages || ""),
      monthlyPages: String(goals.monthlyPages || ""),
      yearlyPages: String(goals.yearlyPages || ""),
      yearlyBooks: String(goals.yearlyBooks || ""),
    });
    setEditing(true);
  };

  const saveGoals = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = (key: string) => Math.max(0, Math.round(Number(draft[key]) || 0));
    setDailyGoal(value("daily"));
    setGoals({ weeklyPages: value("weeklyPages"), monthlyPages: value("monthlyPages"), yearlyPages: value("yearlyPages"), yearlyBooks: value("yearlyBooks") });
    setEditing(false);
    toast.success(t("dashboard:goals.saved"));
  };

  const yearBooks = booksFinishedIn(year);
  const yearWords = wordsLearnedIn(`${year}-01-01`, `${year}-12-31`);
  const monthWords = wordsLearnedIn(`${monthStats.month}-01`, `${monthStats.month}-31`);
  const monthBooks = library?.growth.find((point) => point.month === monthStats.month)?.finished ?? null;

  const copyYearSummary = async () => {
    const lines = [
      t("dashboard:goals.year.copyTitle", { year }),
      t("dashboard:goals.year.copyPages", { pages: fmt(yearStats.totals.pages), days: fmt(yearStats.totals.activeDays) }),
      t("dashboard:goals.year.copyTime", { time: formatDuration(yearStats.totals.minutes, language) }),
      yearBooks !== null ? t("dashboard:goals.year.copyBooks", { count: yearBooks }) : null,
      yearStats.topBook ? t("dashboard:goals.year.copyTopBook", { book: yearStats.topBook.title }) : null,
      yearStats.bestMonth ? t("dashboard:goals.year.copyBestMonth", { month: monthName(yearStats.bestMonth.month) }) : null,
      yearWords ? t("dashboard:goals.year.copyWords", { count: yearWords }) : null,
    ].filter(Boolean);
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      toast.success(t("dashboard:toasts.copied"));
    } catch {
      toast.error(t("dashboard:toasts.copyFailed"));
    }
  };

  const goalUnit = (id: GoalId) => (id === "yearlyBooks" ? t("dashboard:common.booksUnit") : t("dashboard:common.pagesUnit"));

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <StatPanel
        title={t("dashboard:goals.goals.title")}
        subtitle={t("dashboard:goals.goals.subtitle")}
        icon={Target}
        info={t("dashboard:goals.goals.info")}
        className="lg:col-span-12"
        actions={!editing && (
          <button type="button" onClick={startEditing} className="flex cursor-pointer items-center gap-1.5 rounded-sm border border-border-strong px-2.5 py-1 text-xs text-foreground transition hover:bg-surface-muted">
            <Pencil size={13} strokeWidth={1.5} /> {t("dashboard:goals.goals.edit")}
          </button>
        )}
      >
        {editing ? (
          <form onSubmit={saveGoals} className="grid grid-cols-2 gap-4 md:grid-cols-5">
            {GOAL_FIELDS.map(({ id, field }) => (
              <label key={id} className="text-xs text-foreground-subtle">
                {t(`dashboard:goals.goals.items.${id}` as TranslationKey)}
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    value={draft[field] ?? ""}
                    onChange={(event) => setDraft((current) => ({ ...current, [field]: event.target.value }))}
                    className="w-full rounded-sm border border-border-strong bg-surface-muted/50 px-2 py-1.5 text-sm text-foreground focus:outline-none focus:border-primary"
                  />
                  <span className="shrink-0">{goalUnit(id)}</span>
                </div>
              </label>
            ))}
            <div className="col-span-2 flex justify-end gap-2 md:col-span-5">
              <button type="button" onClick={() => setEditing(false)} className="flex cursor-pointer items-center gap-1.5 rounded-sm border border-border-strong px-3 py-1.5 text-sm text-foreground transition hover:bg-surface-muted">
                <X size={14} /> {t("dashboard:goals.goals.cancel")}
              </button>
              <button type="submit" className="flex cursor-pointer items-center gap-1.5 rounded-sm bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover">
                <Check size={14} /> {t("dashboard:goals.goals.save")}
              </button>
            </div>
          </form>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-5">
            {progress.map((goal) => (
              <div key={goal.id} className="flex items-center gap-4">
                <ProgressRing value={goal.current} max={goal.target} size={84} stroke={7} color={goal.status === "behind" ? "var(--warning)" : "var(--primary)"}>
                  <span className="text-base font-semibold tabular-nums text-foreground">{goal.target > 0 ? `${fmt(Math.round(goal.ratio * 100))}%` : "—"}</span>
                </ProgressRing>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground">{t(`dashboard:goals.goals.items.${goal.id}` as TranslationKey)}</div>
                  <div className="text-xs tabular-nums text-foreground-muted">
                    {goal.target > 0 ? `${fmt(goal.current)} / ${fmt(goal.target)} ${goalUnit(goal.id)}` : t("dashboard:goals.goals.unset")}
                  </div>
                  {goal.target > 0 && (
                    <div className="mt-1 text-[11px] text-foreground-subtle">
                      {goal.status === "done"
                        ? t("dashboard:goals.goals.status.done")
                        : goal.id === "daily"
                          ? t("dashboard:goals.goals.remainingToday", { count: goal.target - goal.current })
                          : t(`dashboard:goals.goals.status.${goal.status}` as TranslationKey, { value: fmt(goal.requiredPerDay), unit: goalUnit(goal.id) })}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </StatPanel>

      <StatPanel
        title={t("dashboard:goals.year.title", { year })}
        subtitle={t("dashboard:goals.year.subtitle")}
        icon={Sparkles}
        className="lg:col-span-7"
        actions={
          <>
            {years.length > 1 && (
              <div className="flex rounded-sm border border-border">
                {years.slice(0, 4).map((option) => (
                  <button key={option} type="button" onClick={() => setYear(option)} className={`cursor-pointer px-2 py-1 text-xs tabular-nums transition ${option === year ? "bg-surface-muted text-foreground" : "text-foreground-subtle hover:text-foreground"}`}>
                    {option}
                  </button>
                ))}
              </div>
            )}
            <button type="button" onClick={() => void copyYearSummary()} className="flex cursor-pointer items-center gap-1.5 rounded-sm border border-border-strong px-2.5 py-1 text-xs text-foreground transition hover:bg-surface-muted" title={t("dashboard:goals.year.copy")}>
              <Copy size={13} strokeWidth={1.5} /> {t("dashboard:goals.year.copy")}
            </button>
          </>
        }
      >
        <div className="border-l-2 border-primary pl-4">
          <div className="text-[11px] font-medium uppercase tracking-wider text-foreground-subtle">{t("dashboard:goals.year.pagesRead")}</div>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-3">
            <span className="text-4xl font-semibold tabular-nums text-foreground">{fmt(yearStats.totals.pages)}</span>
            {delta(yearStats.totals.pages, yearStats.previous.pages) !== null && (
              <span className="text-sm text-foreground-muted">
                {t("dashboard:goals.year.vsPrevious", { value: `${(delta(yearStats.totals.pages, yearStats.previous.pages) ?? 0) > 0 ? "+" : ""}${fmt(delta(yearStats.totals.pages, yearStats.previous.pages) ?? 0)}`, year: year - 1 })}
              </span>
            )}
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
          <StatFigure label={t("dashboard:goals.year.time")} value={formatDuration(yearStats.totals.minutes, language)} />
          <StatFigure label={t("dashboard:goals.year.activeDays")} value={fmt(yearStats.totals.activeDays)} />
          <StatFigure label={t("dashboard:goals.year.booksFinished")} value={yearBooks === null ? "—" : fmt(yearBooks)} hint={t("dashboard:goals.year.titlesLogged", { count: yearStats.books })} />
          <StatFigure label={t("dashboard:goals.year.words")} value={yearWords === null ? "—" : fmt(yearWords)} />
          <StatFigure label={t("dashboard:goals.year.bestMonth")} value={yearStats.bestMonth ? (months[Number(yearStats.bestMonth.month.slice(5, 7)) - 1] ?? "") : "—"} hint={yearStats.bestMonth ? t("dashboard:common.pagesShort", { count: yearStats.bestMonth.pages }) : undefined} />
          <StatFigure label={t("dashboard:goals.year.longestStreak")} value={t("dashboard:common.days", { count: yearStats.longestStreak })} />
          <StatFigure label={t("dashboard:goals.year.peakHour")} value={yearStats.peakHour === null ? "—" : `${String(yearStats.peakHour).padStart(2, "0")}h`} />
          <StatFigure label={t("dashboard:goals.year.topCategory")} value={<span className="block truncate text-base">{categoryName(yearStats.topCategoryId) ?? "—"}</span>} />
        </div>
        {yearStats.topBook && (
          <div className="mt-5 border-t border-border pt-3 text-sm text-foreground-muted">
            {t("dashboard:goals.year.bookOfYear")} <span className="font-medium text-foreground">{yearStats.topBook.title}</span>
            <span className="text-foreground-subtle"> · {t("dashboard:common.pagesShort", { count: yearStats.topBook.pages })}</span>
          </div>
        )}
      </StatPanel>

      <StatPanel
        title={t("dashboard:goals.month.title")}
        subtitle={monthName(monthStats.month)}
        icon={CalendarCheck}
        className="lg:col-span-5"
        actions={
          <div className="flex rounded-sm border border-border">
            {[1, 0].map((offset) => (
              <button key={offset} type="button" onClick={() => setMonthOffset(offset)} className={`cursor-pointer px-2 py-1 text-xs transition ${offset === monthOffset ? "bg-surface-muted text-foreground" : "text-foreground-subtle hover:text-foreground"}`}>
                {offset === 1 ? t("dashboard:goals.month.last") : t("dashboard:goals.month.current")}
              </button>
            ))}
          </div>
        }
      >
        <p className="text-sm leading-6 text-foreground-muted">
          {t("dashboard:goals.month.summary", {
            pages: fmt(monthStats.totals.pages),
            days: fmt(monthStats.totals.activeDays),
            time: formatDuration(monthStats.totals.minutes, language),
          })}
          {monthBooks ? ` ${t("dashboard:goals.month.books", { count: monthBooks })}` : ""}
          {monthWords ? ` ${t("dashboard:goals.month.words", { count: monthWords })}` : ""}
        </p>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <StatFigure label={t("dashboard:goals.month.pages")} value={fmt(monthStats.totals.pages)} delta={delta(monthStats.totals.pages, monthStats.previous.pages)} />
          <StatFigure label={t("dashboard:goals.month.minutes")} value={formatDuration(monthStats.totals.minutes, language)} delta={delta(monthStats.totals.minutes, monthStats.previous.minutes)} />
          <StatFigure label={t("dashboard:goals.month.days")} value={fmt(monthStats.totals.activeDays)} delta={delta(monthStats.totals.activeDays, monthStats.previous.activeDays)} />
        </div>
        <div className="mt-4 space-y-1 border-t border-border pt-3 text-xs text-foreground-subtle">
          {monthStats.bestDay && <div>{t("dashboard:goals.month.bestDay", { date: parseIsoDate(monthStats.bestDay.date).toLocaleDateString(locale, { day: "2-digit", month: "long" }), count: monthStats.bestDay.pages })}</div>}
          {monthStats.topBook && <div>{t("dashboard:goals.month.topBook", { book: monthStats.topBook.title })}</div>}
          <div>{t("dashboard:goals.month.streak", { count: monthStats.longestStreak })}</div>
          <div className="text-foreground-subtle/80">{t("dashboard:goals.month.comparison")}</div>
        </div>
      </StatPanel>

      <StatPanel title={t("dashboard:goals.achievements.title")} subtitle={t("dashboard:goals.achievements.subtitle", { unlocked: achievements.filter((item) => item.unlocked).length, total: achievements.length })} icon={Award} className="lg:col-span-8">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {achievements.map((achievement) => (
            <div key={achievement.id} className={`rounded-sm border p-3 ${achievement.unlocked ? "border-primary/40 bg-primary-muted" : "border-border"}`}>
              <div className="flex items-center gap-2">
                {achievement.unlocked ? <Award size={16} strokeWidth={1.5} className="shrink-0 text-primary" /> : <Lock size={14} strokeWidth={1.5} className="shrink-0 text-foreground-subtle" />}
                <span className={`truncate text-sm font-medium ${achievement.unlocked ? "text-foreground" : "text-foreground-muted"}`}>{t(`dashboard:achievements.${achievement.id}.title` as TranslationKey)}</span>
              </div>
              <div className="mt-1 text-[11px] text-foreground-subtle">{t(`dashboard:achievements.${achievement.id}.description` as TranslationKey)}</div>
              {!achievement.unlocked && (
                <div className="mt-2 flex items-center gap-2">
                  <ProgressBar value={achievement.current} max={achievement.target} color="var(--foreground-subtle)" />
                  <span className="shrink-0 text-[10px] tabular-nums text-foreground-subtle">{fmt(Math.round(achievement.ratio * 100))}%</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </StatPanel>

      <StatPanel title={t("dashboard:goals.streak.title")} subtitle={t("dashboard:goals.streak.subtitle")} icon={Flame} info={t("dashboard:goals.streak.info")} className="lg:col-span-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-4xl font-semibold tabular-nums text-foreground">{fmt(streak.active.days)}</div>
            <div className="text-xs text-foreground-subtle">{t("dashboard:goals.streak.days", { count: streak.active.days })}</div>
          </div>
          <div className="text-right text-xs text-foreground-subtle">
            <div>{t("dashboard:goals.streak.longest", { count: streak.longest })}</div>
            {!freezeEnabled && streak.withFreeze.days > streak.plain.days && <div className="mt-0.5">{t("dashboard:goals.streak.withFreeze", { count: streak.withFreeze.days })}</div>}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-7 gap-1.5">
          {streak.week.map((day) => (
            <div key={day.date} className="flex flex-col items-center gap-1">
              <div
                className={`flex h-8 w-full items-center justify-center rounded-sm ${
                  day.state === "read"
                    ? "bg-primary text-primary-foreground"
                    : day.state === "frozen"
                      ? "border border-info/50 bg-info/10 text-info"
                      : day.state === "missed"
                        ? "border border-border bg-surface-muted text-foreground-subtle"
                        : "border border-dashed border-border text-foreground-subtle"
                }`}
                title={day.date}
              >
                {day.state === "read" ? <Check size={14} /> : day.state === "frozen" ? <Snowflake size={14} /> : null}
              </div>
              <span className="text-[10px] text-foreground-subtle">{initials[day.weekday]}</span>
            </div>
          ))}
        </div>
        <label className="mt-4 flex cursor-pointer items-start gap-2 border-t border-border pt-3 text-sm text-foreground">
          <input type="checkbox" checked={freezeEnabled} onChange={(event) => setFreezeEnabled(event.target.checked)} className="mt-0.5 accent-[var(--primary)]" />
          <span>
            {t("dashboard:goals.streak.toggle")}
            <span className="block text-xs text-foreground-subtle">
              {freezeEnabled
                ? streak.active.freezeAvailable
                  ? t("dashboard:goals.streak.freezeAvailable")
                  : t("dashboard:goals.streak.freezeUsed")
                : t("dashboard:goals.streak.toggleHint")}
            </span>
          </span>
        </label>
      </StatPanel>
    </div>
  );
}
