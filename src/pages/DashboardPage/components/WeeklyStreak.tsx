import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Circle, Flame, Save, Target } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useSelectedUsers } from "../../../contexts/SelectedUsersContext";
import { useLocalStorage } from "../../../hooks/useLocalStorage";
import getReadings from "../../../utils/getReadings";
import getUserReadings from "../../../utils/getUserReadings";

const ICON_SIZE = 16;
const STROKE_WIDTH = 1.5;

interface StreakReading {
  reading_date: string;
  pages: number;
}

interface DayStreak {
  date: string;
  dayName: string;
  dayNumber: number;
  hasRead: boolean;
  pagesRead: number;
  goalRatio: number;
  goalComplete: boolean;
}

interface StreakPerson {
  userId: string;
  username: string;
  isCurrentUser: boolean;
  readings: StreakReading[];
}

const WEEKDAY_LABELS = ["D", "S", "T", "Q", "Q", "S", "S"];

function toLocalIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getTodayIso(): string {
  return toLocalIsoDate(new Date());
}

function sumPagesByDate(readings: StreakReading[]): Map<string, number> {
  const pagesByDate = new Map<string, number>();

  readings.forEach((reading) => {
    pagesByDate.set(
      reading.reading_date,
      (pagesByDate.get(reading.reading_date) ?? 0) + reading.pages,
    );
  });

  return pagesByDate;
}

function getWeekDays(readings: StreakReading[], dailyGoal: number): DayStreak[] {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const startOfWeek = new Date(today.getTime());
  startOfWeek.setDate(startOfWeek.getDate() - daysToSubtract);
  startOfWeek.setHours(0, 0, 0, 0);

  const pagesByDate = sumPagesByDate(readings);

  return Array.from({ length: 7 }, (_, index) => {
    const currentDate = new Date(startOfWeek);
    currentDate.setDate(startOfWeek.getDate() + index);
    const date = toLocalIsoDate(currentDate);
    const pagesRead = pagesByDate.get(date) ?? 0;
    const goalRatio =
      dailyGoal > 0 ? Math.min(1, pagesRead / dailyGoal) : pagesRead > 0 ? 1 : 0;

    return {
      date,
      dayName: WEEKDAY_LABELS[currentDate.getDay()],
      dayNumber: currentDate.getDate(),
      hasRead: pagesRead > 0,
      pagesRead,
      goalRatio,
      goalComplete: dailyGoal > 0 ? pagesRead >= dailyGoal : pagesRead > 0,
    };
  });
}

function computeCurrentStreak(
  readings: StreakReading[],
  dailyGoal: number,
): number {
  if (!readings || readings.length === 0) return 0;

  const pagesByDate = sumPagesByDate(readings);
  let streak = 0;
  const today = new Date();

  for (let index = 0; index < 365; index++) {
    const date = new Date(today);
    date.setDate(today.getDate() - index);
    const pagesRead = pagesByDate.get(toLocalIsoDate(date)) ?? 0;
    const countsForStreak =
      dailyGoal > 0 ? pagesRead >= dailyGoal : pagesRead > 0;

    if (!countsForStreak) break;
    streak++;
  }

  return streak;
}

function getWeeklyPages(readings: StreakReading[]): number {
  return getWeekDays(readings, 0).reduce((sum, day) => sum + day.pagesRead, 0);
}

function getDeltaLabel(delta: number): string {
  if (delta > 0) return `+${delta}p`;
  if (delta < 0) return `-${Math.abs(delta)}p`;
  return "empate";
}

function DayIcon({
  day,
  dailyGoal,
  isToday,
  isFuture,
  isWinningDay,
  reduceMotion,
}: {
  day: DayStreak;
  dailyGoal: number;
  isToday: boolean;
  isFuture: boolean;
  isWinningDay: boolean;
  reduceMotion: boolean;
}) {
  const winRing = isWinningDay ? "ring-2 ring-green-400 ring-offset-2 ring-offset-zinc-900" : "";

  if (isFuture) {
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-dashed border-zinc-700">
        <Circle size={8} className="text-zinc-700" strokeWidth={1} />
      </div>
    );
  }

  if (dailyGoal > 0) {
    return (
      <div
        className={`relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border-2 ${
          isToday ? "border-green-400" : "border-zinc-700"
        } bg-zinc-800 ${winRing}`}
      >
        <motion.div
          className="absolute inset-x-0 bottom-0 bg-green-500"
          initial={reduceMotion ? false : { height: 0 }}
          animate={{ height: `${day.goalRatio * 100}%` }}
          transition={{ duration: reduceMotion ? 0 : 0.55, ease: "easeOut" }}
        />
        {day.goalComplete && (
          <Check
            size={ICON_SIZE}
            className="relative text-white"
            strokeWidth={STROKE_WIDTH + 1}
          />
        )}
      </div>
    );
  }

  if (day.hasRead) {
    return (
      <div
        className={`flex h-9 w-9 items-center justify-center rounded-full ${
          isToday ? "bg-green-500" : "bg-green-600"
        } ${winRing}`}
      >
        <Check size={ICON_SIZE} className="text-white" strokeWidth={STROKE_WIDTH + 1} />
      </div>
    );
  }

  return (
    <div
      className={`flex h-9 w-9 items-center justify-center rounded-full border-2 ${
        isToday
          ? "border-zinc-500 bg-zinc-500/10"
          : "border-zinc-700 bg-zinc-800"
      } ${winRing}`}
    >
      {isToday ? (
        <span className="text-[10px] font-bold text-zinc-400">!</span>
      ) : (
        <Circle size={6} className="text-zinc-600" strokeWidth={STROKE_WIDTH} />
      )}
    </div>
  );
}

function GoalControls({
  dailyGoal,
  setDailyGoal,
}: {
  dailyGoal: number;
  setDailyGoal: (goal: number) => void;
}) {
  const reduceMotion = useReducedMotion();
  const [isOpen, setIsOpen] = useState(false);
  const [goalDraft, setGoalDraft] = useState(dailyGoal > 0 ? String(dailyGoal) : "");

  useEffect(() => {
    if (isOpen) {
      setGoalDraft(dailyGoal > 0 ? String(dailyGoal) : "");
    }
  }, [dailyGoal, isOpen]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextGoal = Math.max(0, Math.floor(Number(goalDraft) || 0));
    setDailyGoal(nextGoal);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-sm border transition ${
          dailyGoal > 0
            ? "border-green-600 bg-green-500/10 text-green-400"
            : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:text-zinc-100"
        }`}
        aria-label="Meta diaria"
        title={dailyGoal > 0 ? `${dailyGoal}p/dia` : "Meta diaria"}
      >
        <Target size={ICON_SIZE} strokeWidth={STROKE_WIDTH} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.form
            onSubmit={handleSubmit}
            className="absolute right-0 top-10 z-20 flex items-center gap-2 rounded-sm border border-zinc-700 bg-zinc-950 p-2 shadow-xl"
            initial={reduceMotion ? false : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
            transition={{ duration: reduceMotion ? 0 : 0.14 }}
          >
            <input
              type="number"
              min="0"
              inputMode="numeric"
              value={goalDraft}
              onChange={(event) => setGoalDraft(event.target.value)}
              placeholder="p/dia"
              aria-label="Paginas por dia"
              className="h-8 w-20 rounded-sm border border-zinc-700 bg-zinc-900 px-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-green-500"
            />
            <button
              type="submit"
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-sm bg-green-600 text-black transition hover:bg-green-500"
              aria-label="Salvar meta"
            >
              <Save size={ICON_SIZE} strokeWidth={STROKE_WIDTH} />
            </button>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}

function WeeklyStreakPanel({
  person,
  dailyGoal,
  todayStr,
  index,
  comparisonDelta,
  comparisonActive,
  winningDates,
  goalControls,
}: {
  person: StreakPerson;
  dailyGoal: number;
  todayStr: string;
  index: number;
  comparisonDelta: number;
  comparisonActive: boolean;
  winningDates: Set<string>;
  goalControls?: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const [pulse, setPulse] = useState(false);
  const [floatText, setFloatText] = useState<{
    pages: number;
    metaBatida: boolean;
  } | null>(null);

  useEffect(() => {
    if (!person.isCurrentUser) return;
    const handler = (event: Event) => {
      setPulse(true);
      setTimeout(() => setPulse(false), 500);

      const detail = (event as CustomEvent).detail;
      if (detail?.pages) {
        setFloatText({ pages: detail.pages, metaBatida: detail.metaBatida ?? false });
        setTimeout(() => setFloatText(null), 3500);
      }
    };
    window.addEventListener("lyceum:reading-submitted", handler);
    return () => window.removeEventListener("lyceum:reading-submitted", handler);
  }, [person.isCurrentUser]);

  const weekDays = useMemo(
    () => getWeekDays(person.readings, dailyGoal),
    [dailyGoal, person.readings],
  );
  const currentDayIndex = weekDays.findIndex((day) => day.date === todayStr);
  const currentStreak = computeCurrentStreak(person.readings, dailyGoal);
  const todayPages = weekDays[currentDayIndex]?.pagesRead ?? 0;
  const todayComplete = weekDays[currentDayIndex]?.goalComplete ?? false;
  const deltaText = getDeltaLabel(comparisonDelta);
  const deltaClass =
    comparisonDelta > 0
      ? "text-green-400"
      : comparisonDelta < 0
        ? "text-red-400"
        : "text-zinc-400";

  return (
    <section className={index === 0 ? "space-y-12" : "space-y-3 border-t border-zinc-800 pt-3"}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Flame size={ICON_SIZE} className="text-zinc-500" strokeWidth={STROKE_WIDTH} />
          <span
            className={`truncate text-sm font-semibold ${
              person.isCurrentUser ? "text-zinc-200" : "text-zinc-400"
            }`}
          >
            {person.username}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* {comparisonActive && (
            <span className={`text-xs font-semibold ${deltaClass}`}>{deltaText}</span>
          )} */}
          {goalControls}
        </div>
      </div>

      <div className="relative">
        <div className="flex items-center justify-between gap-1 pt-1">
          {weekDays.map((day, dayIndex) => {
            const isToday = dayIndex === currentDayIndex;
            const isFuture = day.date > todayStr;

            return (
              <motion.div
                key={day.date}
                className="flex flex-1 flex-col h-full items-center gap-1.5"
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: reduceMotion ? 0 : dayIndex * 0.03, duration: 0.18 }}
              >
                <div className="group relative">
                  <motion.div whileHover={reduceMotion ? undefined : { y: -1 }}>
                    <DayIcon
                      day={day}
                      dailyGoal={dailyGoal}
                      isToday={isToday}
                      isFuture={isFuture}
                      isWinningDay={winningDates.has(day.date)}
                      reduceMotion={Boolean(reduceMotion)}
                    />
                  </motion.div>
                  {day.hasRead && (
                    <div className="pointer-events-none absolute -top-8 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded bg-zinc-700 px-2 py-0.5 text-[10px] font-medium text-zinc-100 opacity-0 transition-opacity group-hover:opacity-100">
                      {day.pagesRead} pags
                    </div>
                  )}
                </div>
                <span
                  className={`text-[11px] font-medium ${
                    isFuture
                      ? "text-zinc-600"
                      : day.goalComplete
                        ? "text-green-500"
                        : isToday
                          ? "text-green-800"
                          : "text-zinc-500"
                  }`}
                >
                  {day.dayName}
                </span>
              </motion.div>
            );
          })}
        </div>

        {floatText && currentDayIndex >= 0 && (
          <motion.div
            key={floatText.pages}
            initial={{ opacity: 1, y: 0 }}
            animate={{ opacity: 0, y: -120 }}
            transition={{
              duration: reduceMotion ? 0 : 3,
              ease: "easeOut",
            }}
            className="pointer-events-none absolute z-10 whitespace-nowrap text-sm font-bold"
            style={{
              left: `${((currentDayIndex + 0.5) / 7) * 100}%`,
              top: "-0.25rem",
              transform: "translateX(-50%)",
            }}
          >
            {floatText.metaBatida ? (
              <span className="text-amber-400">{'\u{1F525} Meta batida!'}</span>
            ) : (
              <span className="text-green-400">+{floatText.pages}p</span>
            )}
          </motion.div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <motion.div
            animate={pulse ? { scale: [1, 1.4, 1] } : { scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <Flame className="text-zinc-400" size={ICON_SIZE} strokeWidth={STROKE_WIDTH} />
          </motion.div>
          <span className="text-sm font-bold text-zinc-400">{currentStreak} dias</span>
        </div>

        <div className="flex items-center gap-2">
          <Circle
            size={ICON_SIZE}
            className={todayComplete ? "text-green-500" : "text-zinc-400"}
            strokeWidth={STROKE_WIDTH}
            fill={todayComplete ? "currentColor" : "none"}
          />
          <span
            className={`text-sm font-bold ${
              todayComplete ? "text-green-500" : "text-zinc-400"
            }`}
          >
            {dailyGoal > 0
              ? `${todayPages}/${dailyGoal}p`
              : todayPages > 0
                ? `${todayPages} pags`
                : "-"}
          </span>
        </div>
      </div>
    </section>
  );
}

function getWinningDatesByUser(people: StreakPerson[]): Map<string, Set<string>> {
  const weeklyPagesByUser = people.map((person) => ({
    userId: person.userId,
    pagesByDate: new Map(
      getWeekDays(person.readings, 0).map((day) => [day.date, day.pagesRead]),
    ),
  }));
  const winners = new Map<string, Set<string>>();

  weeklyPagesByUser.forEach(({ userId }) => {
    winners.set(userId, new Set());
  });

  if (weeklyPagesByUser.length < 2) {
    return winners;
  }

  const dates = new Set<string>();
  weeklyPagesByUser.forEach(({ pagesByDate }) => {
    pagesByDate.forEach((_pages, date) => dates.add(date));
  });

  dates.forEach((date) => {
    const scores = weeklyPagesByUser.map(({ userId, pagesByDate }) => ({
      userId,
      pages: pagesByDate.get(date) ?? 0,
    }));
    const maxPages = Math.max(...scores.map((score) => score.pages));
    if (maxPages <= 0) return;

    const dayWinners = scores.filter((score) => score.pages === maxPages);
    if (dayWinners.length !== 1) return;

    winners.get(dayWinners[0].userId)?.add(date);
  });

  return winners;
}

export function WeeklyStreak() {
  const reduceMotion = useReducedMotion();
  const { selectedUsers } = useSelectedUsers();
  const [dailyGoal, setDailyGoal] = useLocalStorage<number>(
    "daily_reading_goal_pages",
    0,
  );
  const { data: readings, isLoading } = useQuery({
    queryKey: ["readings"],
    queryFn: getReadings,
  });

  const selectedUserIds = selectedUsers.map((user) => user.user_id).join(",");
  const { data: selectedPeople, isLoading: isLoadingSelected } = useQuery<
    StreakPerson[]
  >({
    queryKey: ["weeklyStreakSelectedReadings", selectedUserIds],
    queryFn: async () => {
      const results = await Promise.all(
        selectedUsers.map(async (user) => ({
          userId: user.user_id,
          username: user.username,
          isCurrentUser: false,
          readings: await getUserReadings(user.user_id),
        })),
      );
      return results;
    },
    enabled: selectedUsers.length > 0,
    staleTime: 0,
  });

  const people = useMemo<StreakPerson[]>(() => {
    return [
      {
        userId: "current-user",
        username: "Voce",
        isCurrentUser: true,
        readings: readings ?? [],
      },
      ...(selectedPeople ?? []),
    ];
  }, [readings, selectedPeople]);

  const todayStr = getTodayIso();
  const weeklyTotals = people.map((person) => getWeeklyPages(person.readings));
  const currentWeeklyPages = weeklyTotals[0] ?? 0;
  const bestFriendWeeklyPages = Math.max(0, ...weeklyTotals.slice(1));
  const comparisonActive = people.length > 1;
  const winningDatesByUser = useMemo(
    () => getWinningDatesByUser(people),
    [people],
  );

  if (isLoading || isLoadingSelected) {
    return (
      <div className="h-full rounded-sm border border-zinc-800 bg-zinc-900 p-5">
        <div className="mb-5 h-5 w-28 animate-pulse rounded bg-zinc-800" />
        <div className="mb-5 flex justify-between gap-2">
          {[...Array(7)].map((_, index) => (
            <div key={index} className="flex flex-1 flex-col items-center gap-2">
              <div className="h-9 w-9 animate-pulse rounded-full bg-zinc-800" />
              <div className="h-3 w-5 animate-pulse rounded bg-zinc-800" />
            </div>
          ))}
        </div>
        <div className="mb-4 h-px bg-zinc-800" />
        <div className="flex justify-between">
          <div className="h-8 w-24 animate-pulse rounded bg-zinc-800" />
          <div className="h-8 w-24 animate-pulse rounded bg-zinc-800" />
        </div>
      </div>
    );
  }

  return (
    <motion.div
      className="flex h-full flex-col gap-3 rounded-sm border border-zinc-800 bg-zinc-900 p-4"
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduceMotion ? 0 : 0.16 }}
    >
      {people.map((person, index) => {
        const comparisonDelta = person.isCurrentUser
          ? currentWeeklyPages - bestFriendWeeklyPages
          : weeklyTotals[index] - currentWeeklyPages;

        return (
          <WeeklyStreakPanel
            key={person.userId}
            person={person}
            dailyGoal={dailyGoal}
            todayStr={todayStr}
            index={index}
            comparisonDelta={comparisonDelta}
            comparisonActive={comparisonActive}
            winningDates={winningDatesByUser.get(person.userId) ?? new Set()}
            goalControls={
              index === 0 ? (
                <GoalControls dailyGoal={dailyGoal} setDailyGoal={setDailyGoal} />
              ) : undefined
            }
          />
        );
      })}
    </motion.div>
  );
}

export default WeeklyStreak;
