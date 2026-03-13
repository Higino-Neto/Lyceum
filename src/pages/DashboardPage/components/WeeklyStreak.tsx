import { useQuery } from "@tanstack/react-query";
import getReadings from "../../../utils/getReadings";
import { Flame, Plus } from "lucide-react";

interface DayStreak {
  date: string;
  dayName: string;
  dayNumber: number;
  hasRead: boolean;
  pagesRead: number;
}

function getWeekDays(): DayStreak[] {
  const today = new Date();
  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const days: DayStreak[] = [];

  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());

  for (let i = 0; i < 7; i++) {
    const currentDate = new Date(startOfWeek);
    currentDate.setDate(startOfWeek.getDate() + i);
    days.push({
      date: currentDate.toLocaleDateString("sv-SE"),
      dayName: weekDays[currentDate.getDay()],
      dayNumber: currentDate.getDate(),
      hasRead: false,
      pagesRead: 0,
    });
  }

  return days;
}

function computeCurrentStreak(
  readings: { reading_date: string; pages: number }[],
): number {
  if (!readings || readings.length === 0) return 0;

  const readDates = new Set(readings.map((r) => r.reading_date));

  let streak = 0;
  const today = new Date();

  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = d.toLocaleDateString("sv-SE");
    if (readDates.has(dateStr)) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

function CheckIcon({
  filled,
  isToday,
  isFuture,
}: {
  filled: boolean;
  isToday: boolean;
  isFuture: boolean;
  pages: number;
}) {
  if (isFuture) {
    return (
      <div className="w-9 h-9 rounded-full border-2 border-dashed border-zinc-700 flex items-center justify-center">
        <span className="text-zinc-600 text-xs">·</span>
      </div>
    );
  }

  if (filled) {
    return (
      <div
        className={`w-9 h-9 rounded-full flex items-center justify-center shadow-md shadow-green-900/40 ${isToday ? "bg-green-500 ring-2 ring-green-400 ring-offset-2 ring-offset-zinc-900" : "bg-green-600"}`}
      >
        <svg
          className="w-5 h-5 text-white"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 13l4 4L19 7"
          />
        </svg>
      </div>
    );
  }

  return (
    <div
      className={`w-9 h-9 rounded-full border-2 flex items-center justify-center ${isToday ? "border-amber-500 bg-amber-500/10" : "border-zinc-700 bg-zinc-800"}`}
    >
      {isToday ? (
        <span className="text-amber-400 text-xs font-bold">!</span>
      ) : (
        <span className="text-zinc-600 text-xs">—</span>
      )}
    </div>
  );
}

export function WeeklyStreak() {
  const { data: readings, isLoading } = useQuery({
    queryKey: ["readings"],
    queryFn: getReadings,
  });

  const weekDays = getWeekDays();

  if (readings) {
    readings.forEach((reading) => {
      const readingDate = reading.reading_date;
      const dayIndex = weekDays.findIndex((day) => day.date === readingDate);
      if (dayIndex !== -1) {
        weekDays[dayIndex].hasRead = true;
        weekDays[dayIndex].pagesRead += reading.pages;
      }
    });
  }

  const today = new Date().toLocaleDateString("sv-SE");
  const currentDayIndex = weekDays.findIndex((day) => day.date === today);
  const readDaysCount = weekDays.filter((day) => day.hasRead).length;
  const currentStreak = computeCurrentStreak(readings ?? []);
  const todayRead = weekDays[currentDayIndex]?.hasRead ?? false;
  const perfectWeek = readDaysCount === 7;

  if (isLoading) {
    return (
      <div className="bg-zinc-900 rounded-md border border-zinc-800 p-5 h-full">
        <div className="h-5 w-28 bg-zinc-800 animate-pulse rounded mb-5" />
        <div className="flex justify-between gap-2 mb-5">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-2 flex-1">
              <div className="w-9 h-9 rounded-full bg-zinc-800 animate-pulse" />
              <div className="h-3 w-5 bg-zinc-800 animate-pulse rounded" />
            </div>
          ))}
        </div>
        <div className="h-px bg-zinc-800 mb-4" />
        <div className="flex justify-between">
          <div className="h-8 w-24 bg-zinc-800 animate-pulse rounded" />
          <div className="h-8 w-24 bg-zinc-800 animate-pulse rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 rounded-md border border-zinc-800 p-5 h-full flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm text-zinc-400">Streak Semanal</h2>
        {/* <div className="flex items-center gap-1.5 bg-zinc-800 border border-zinc-700 rounded-sm px-2.5 py-1">
          <span className="text-base"></span>
          <span className="text-sm font-bold text-zinc-100">{readDaysCount}/7</span>
        </div> */}
      </div>

      {/* Day circles */}
      <div className="flex justify-between items-center gap-1 pt-5">
        {weekDays.map((day, index) => {
          const isToday = index === currentDayIndex;
          const isFuture = day.date > today;

          return (
            <div
              key={day.date}
              className="flex flex-col items-center gap-1.5 flex-1"
            >
              <div className="relative group">
                <CheckIcon
                  filled={day.hasRead}
                  isToday={isToday}
                  isFuture={isFuture}
                  pages={day.pagesRead}
                />
                {day.hasRead && (
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-zinc-700 text-zinc-100 text-[10px] font-medium px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                    {day.pagesRead}p
                  </div>
                )}
              </div>
              <span
                className={`text-[11px] font-medium ${
                  isFuture
                    ? "text-zinc-600"
                    : day.hasRead
                      ? "text-green-500"
                      : isToday
                        ? "text-green-800"
                        : "text-zinc-500"
                }`}
              >
                {day.dayName}
              </span>
            </div>
          );
        })}
      </div>

      {/* Divider */}
      {/* <div className="h-px bg-zinc-800" /> */}

      {/* Stats row */}
      <div className="flex justify-between items-center pt-5">
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] text-zinc-500">Streak atual</span>
          <div className="flex items-center gap-1">
            {/* <span className="text-base">🔥</span> */}
            <Flame className="text-green-500" size={20} />
            <span className="text-sm font-bold text-zinc-100">
              {currentStreak} dias
            </span>
          </div>
        </div>

        {/* <div className="h-8 w-px bg-zinc-800" /> */}

        <div className="flex flex-col gap-0.5 items-end">
          <span className="text-[11px] text-zinc-500">Hoje</span>
          <div className="flex items-center">
            <Plus className="text-green-500" size={16} />
            {/* <span className="text-base">{todayRead ? "" : "📌"}</span> */}
            <span
              className={`text-sm font-bold ${todayRead ? "text-green-500" : "text-amber-400"}`}
            >
              {todayRead
                ? `${weekDays[currentDayIndex]?.pagesRead} págs`
                : "Pendente"}
            </span>
          </div>
        </div>
      </div>

      {/* Perfect week banner */}
      {perfectWeek && (
        <div className="mt-auto bg-amber-500/10 border border-amber-500/20 rounded-sm px-3 py-2 flex items-center justify-center gap-2">
          <span className="text-base animate-bounce">🏆</span>
          <span className="text-xs font-semibold text-amber-400">
            Semana perfeita! Incrível!
          </span>
          <span
            className="text-base animate-bounce"
            style={{ animationDelay: "0.15s" }}
          >
            ✨
          </span>
        </div>
      )}

      {/* Today nudge */}
      {!todayRead && !perfectWeek && currentDayIndex !== -1 && (
        <div className="mt-auto bg-zinc-800 border border-zinc-700 rounded-sm px-3 py-2 flex items-center gap-2">
          <span className="text-base">💡</span>
          <span className="text-xs text-zinc-400">
            {currentStreak > 0
              ? `Mantenha o streak de ${currentStreak} dias! Leia hoje.`
              : "Que tal começar uma sequência hoje?"}
          </span>
        </div>
      )}
    </div>
  );
}

export default WeeklyStreak;
