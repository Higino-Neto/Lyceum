import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, BookOpen, Flame, Medal, Minus, Rss, Swords, Trophy, UserPlus, Users } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { friendsFeed, weeklyDuel, weeklyRanking, type FeedEvent } from "../../../features/stats/friendsAnalytics";
import { parseIsoDate } from "../../../features/stats/readingAnalytics";
import { formatNumber, getWeekdayShortNames, useLanguage, useTranslation } from "../../../i18n";
import ChartLegend from "../components/stats/ChartLegend";
import { axisProps, gridProps, viz } from "../components/stats/chartTheme";
import EmptyState from "../components/stats/EmptyState";
import ProgressBar from "../components/stats/ProgressBar";
import StatPanel from "../components/stats/StatPanel";
import StatsTooltip from "../components/stats/StatsTooltip";
import { useFriendsReadings } from "../hooks/useDashboardData";

const MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0];

function openFriendsSettings() {
  window.dispatchEvent(new CustomEvent("lyceum:open-settings", { detail: { tab: "friends" } }));
}

function FeedIcon({ event }: { event: FeedEvent }) {
  const Icon = event.kind === "read" ? BookOpen : event.kind === "bestDay" ? Trophy : Flame;
  return <Icon size={14} strokeWidth={1.5} className={event.kind === "read" ? "text-foreground-subtle" : "text-primary"} />;
}

export default function FriendsTab() {
  const { t } = useTranslation();
  const { language, locale } = useLanguage();
  const { people, isLoading, hasFriends } = useFriendsReadings(t("dashboard:common.you"));
  const friends = people.filter((person) => !person.isCurrentUser);
  const [rivalId, setRivalId] = useState<string | null>(null);
  const weekdays = getWeekdayShortNames(language);
  const fmt = (value: number) => formatNumber(value, language);
  const now = useMemo(() => new Date(), []);

  const ranking = useMemo(() => weeklyRanking(people, now), [now, people]);
  const feed = useMemo(() => friendsFeed(people, now, 7, 16), [now, people]);
  // Default rival: the closest friend in this week's ranking.
  const me = ranking.find((row) => row.isCurrentUser);
  const defaultRival = useMemo(() => {
    const others = ranking.filter((row) => !row.isCurrentUser);
    return [...others].sort((a, b) => Math.abs(a.pages - (me?.pages ?? 0)) - Math.abs(b.pages - (me?.pages ?? 0)))[0]?.userId ?? null;
  }, [me?.pages, ranking]);
  const rival = friends.find((person) => person.userId === (rivalId ?? defaultRival));
  const self = people.find((person) => person.isCurrentUser);
  const duel = useMemo(
    () => (rival && self ? weeklyDuel(self.readings, rival.readings, now).map((point) => ({ ...point, label: weekdays[MONDAY_FIRST[point.day] ?? 0] ?? "" })) : []),
    [now, rival, self, weekdays],
  );

  if (!isLoading && !hasFriends) {
    return (
      <EmptyState
        icon={Users}
        message={t("dashboard:friends.empty")}
        action={
          <button type="button" onClick={openFriendsSettings} className="mt-2 flex cursor-pointer items-center gap-1.5 rounded-sm bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover">
            <UserPlus size={14} /> {t("dashboard:friends.addFriend")}
          </button>
        }
      />
    );
  }

  const last = [...duel].reverse().find((point) => point.me !== null);
  const myTotal = last?.me ?? 0;
  const rivalTotal = last?.rival ?? 0;
  const maxPages = Math.max(1, ...ranking.map((row) => row.pages));
  const dayLabel = (iso: string) => parseIsoDate(iso).toLocaleDateString(locale, { weekday: "short", day: "2-digit", month: "short" });

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <StatPanel title={t("dashboard:friends.ranking.title")} subtitle={t("dashboard:friends.ranking.subtitle")} icon={Medal} info={t("dashboard:friends.ranking.info")} className="lg:col-span-5">
        <ol className="space-y-1">
          {ranking.map((row) => (
            <li key={row.userId} className={`grid grid-cols-[1.75rem_minmax(0,1fr)_4.5rem_2.5rem] items-center gap-2 rounded-sm px-2 py-1.5 ${row.isCurrentUser ? "bg-primary-muted" : ""}`}>
              <span className="text-sm font-semibold tabular-nums text-foreground-muted">{row.rank}º</span>
              <div className="min-w-0">
                <div className={`truncate text-sm ${row.isCurrentUser ? "font-semibold text-foreground" : "text-foreground"}`}>{row.name}</div>
                <ProgressBar value={row.pages} max={maxPages} color={row.isCurrentUser ? "var(--primary)" : "var(--foreground-subtle)"} className="mt-1" />
              </div>
              <span className="text-right text-sm tabular-nums text-foreground">{t("dashboard:common.pagesShort", { count: row.pages })}</span>
              <span
                className={`flex items-center justify-end gap-0.5 text-xs tabular-nums ${row.movement && row.movement > 0 ? "text-success" : row.movement && row.movement < 0 ? "text-destructive" : "text-foreground-subtle"}`}
                title={row.previousRank ? t("dashboard:friends.ranking.previous", { rank: row.previousRank }) : t("dashboard:friends.ranking.new")}
              >
                {row.movement === null ? <Minus size={12} /> : row.movement > 0 ? <ArrowUp size={12} /> : row.movement < 0 ? <ArrowDown size={12} /> : <Minus size={12} />}
                {row.movement ? Math.abs(row.movement) : ""}
              </span>
            </li>
          ))}
        </ol>
      </StatPanel>

      <StatPanel
        title={t("dashboard:friends.duel.title")}
        subtitle={t("dashboard:friends.duel.subtitle")}
        icon={Swords}
        className="lg:col-span-7"
        actions={friends.length > 1 && (
          <select
            value={rival?.userId ?? ""}
            onChange={(event) => setRivalId(event.target.value)}
            className="rounded-sm border border-border-strong bg-surface px-2 py-1 text-xs text-foreground focus:outline-none focus:border-primary"
            aria-label={t("dashboard:friends.duel.choose")}
          >
            {friends.map((friend) => (
              <option key={friend.userId} value={friend.userId}>{friend.name}</option>
            ))}
          </select>
        )}
      >
        {!rival ? (
          <EmptyState compact message={t("dashboard:friends.duel.empty")} />
        ) : (
          <>
            <div className="mb-3 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
              <div>
                <div className="text-xs text-foreground-subtle">{t("dashboard:common.you")}</div>
                <div className="text-2xl font-semibold tabular-nums text-foreground">{fmt(myTotal)}</div>
              </div>
              <div className="text-xs font-medium uppercase tracking-wider text-foreground-subtle">vs</div>
              <div className="text-right">
                <div className="truncate text-xs text-foreground-subtle">{rival.name}</div>
                <div className="text-2xl font-semibold tabular-nums text-foreground">{fmt(rivalTotal)}</div>
              </div>
            </div>
            <div className="mb-2 flex h-1.5 w-full bg-surface-muted">
              <div style={{ width: `${myTotal + rivalTotal > 0 ? (myTotal / (myTotal + rivalTotal)) * 100 : 50}%`, background: viz(1) }} />
              <div className="flex-1" style={{ background: viz(2) }} />
            </div>
            <ChartLegend items={[{ label: t("dashboard:common.you"), color: viz(1) }, { label: rival.name, color: viz(2) }]} />
            <ResponsiveContainer width="100%" height={190}>
              <LineChart data={duel} margin={{ top: 10, right: 8, left: -14, bottom: 0 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="label" {...axisProps} />
                <YAxis {...axisProps} allowDecimals={false} />
                <Tooltip content={<StatsTooltip unit={t("dashboard:common.pagesUnit")} />} cursor={{ stroke: "var(--border-strong)" }} />
                <Line dataKey="me" name={t("dashboard:common.you")} stroke={viz(1)} strokeWidth={2} dot={{ r: 3, fill: viz(1), stroke: "var(--surface)", strokeWidth: 2 }} connectNulls={false} />
                <Line dataKey="rival" name={rival.name} stroke={viz(2)} strokeWidth={2} dot={{ r: 3, fill: viz(2), stroke: "var(--surface)", strokeWidth: 2 }} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
            <div className="mt-2 text-xs text-foreground-subtle">
              {myTotal === rivalTotal
                ? t("dashboard:friends.duel.tied")
                : myTotal > rivalTotal
                  ? t("dashboard:friends.duel.leading", { count: myTotal - rivalTotal })
                  : t("dashboard:friends.duel.behind", { count: rivalTotal - myTotal, name: rival.name })}
            </div>
          </>
        )}
      </StatPanel>

      <StatPanel title={t("dashboard:friends.feed.title")} subtitle={t("dashboard:friends.feed.subtitle")} icon={Rss} className="lg:col-span-12">
        {feed.length === 0 ? (
          <EmptyState compact message={t("dashboard:friends.feed.empty")} />
        ) : (
          <ul className="divide-y divide-border">
            {feed.map((event, index) => (
              <li key={`${event.userId}-${event.kind}-${event.date}-${index}`} className="flex items-center gap-3 py-2 text-sm">
                <FeedIcon event={event} />
                <span className="min-w-0 flex-1 truncate text-foreground-muted">
                  <span className="font-medium text-foreground">{event.name}</span>{" "}
                  {event.kind === "read"
                    ? t("dashboard:friends.feed.read", { count: event.pages, book: event.book })
                    : event.kind === "bestDay"
                      ? t("dashboard:friends.feed.bestDay", { count: event.pages })
                      : t("dashboard:friends.feed.streak", { count: event.days })}
                </span>
                <span className="shrink-0 text-xs text-foreground-subtle">{dayLabel(event.date)}</span>
              </li>
            ))}
          </ul>
        )}
      </StatPanel>
    </div>
  );
}
