import { useQuery } from "@tanstack/react-query";
import getReadings from "../../../utils/getReadings";
import { Flame, Check, Circle } from "lucide-react";

const ICON_SIZE = 16;
const STROKE_WIDTH = 1.5;

interface DayStreak {
  date: string;
  dayName: string;
  dayNumber: number;
  hasRead: boolean;
  pagesRead: number;
}

function getWeekDays(): DayStreak[] {
  const today = new Date();
  const weekDays = ["D", "S", "T", "Q", "Q", "S", "S"];
  const days: DayStreak[] = [];

  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());

  for (let i = 0; i < 7; i++) {
    const currentDate = new Date(startOfWeek);
    currentDate.setDate(startOfWeek.getDate() + i);
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, "0");
    const day = String(currentDate.getDate()).padStart(2, "0");
    days.push({
      date: `${year}-${month}-${day}`,
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
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const dateStr = `${year}-${month}-${day}`;
    if (readDates.has(dateStr)) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

function DayIcon({
  filled,
  isToday,
  isFuture,
}: {
  filled: boolean;
  isToday: boolean;
  isFuture: boolean;
}) {
  if (isFuture) {
    return (
      <div className="w-9 h-9 rounded-full border-2 border-dashed border-zinc-700 flex items-center justify-center">
        <Circle size={8} className="text-zinc-700" strokeWidth={1} />
      </div>
    );
  }

  if (filled) {
    return (
      <div
        className={`w-9 h-9 rounded-full flex items-center justify-center ${isToday ? "bg-green-500 ring-2 ring-green-400 ring-offset-2 ring-offset-zinc-900" : "bg-green-600"}`}
      >
        <Check size={ICON_SIZE} className="text-white" strokeWidth={STROKE_WIDTH + 1} />
      </div>
    );
  }

  return (
    <div
      className={`w-9 h-9 rounded-full border-2 flex items-center justify-center ${isToday ? "border-amber-500 bg-amber-500/10" : "border-zinc-700 bg-zinc-800"}`}
    >
      {isToday ? (
        <span className="text-amber-400 text-[10px] font-bold">!</span>
      ) : (
        <Circle size={6} className="text-zinc-600" strokeWidth={STROKE_WIDTH} />
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

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = String(now.getMonth() + 1).padStart(2, "0");
  const currentDay = String(now.getDate()).padStart(2, "0");
  const todayStr = `${currentYear}-${currentMonth}-${currentDay}`;
  const currentDayIndex = weekDays.findIndex((day) => day.date === todayStr);
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
    <div className="bg-zinc-900 rounded-md border border-zinc-800 p-4 h-full flex flex-col gap-3 justify-between">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame size={ICON_SIZE} className="text-zinc-500" strokeWidth={STROKE_WIDTH} />
        </div>
      </div>

      {/* Day circles */}
      <div className="flex justify-between items-center gap-1 pt-3">
        {weekDays.map((day, index) => {
          const isToday = index === currentDayIndex;
          const isFuture = day.date > todayStr;

          return (
            <div
              key={day.date}
              className="flex flex-col items-center gap-1.5 flex-1"
            >
              <div className="relative group">
                <DayIcon
                  filled={day.hasRead}
                  isToday={isToday}
                  isFuture={isFuture}
                />
                {day.hasRead && (
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-zinc-700 text-zinc-100 text-[10px] font-medium px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                    {day.pagesRead} págs
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

      {/* Stats row */}
      <div className="flex justify-between items-center pt-3">
        <div className="flex items-center gap-1">
          <Flame className="text-zinc-400" size={ICON_SIZE} strokeWidth={STROKE_WIDTH} />
          <span className="text-sm font-bold text-zinc-400">
            {currentStreak} dias
          </span>
        </div>

        <div className="flex items-center gap-2">
            <Circle 
              size={ICON_SIZE} 
              className={todayRead ? "text-green-500" : "text-amber-400"} 
              strokeWidth={STROKE_WIDTH} 
              fill={todayRead ? "currentColor" : "none"}
            />
            <span
              className={`text-sm font-bold ${todayRead ? "text-green-500" : "text-amber-400"}`}
            >
              {todayRead
                ? `${weekDays[currentDayIndex]?.pagesRead} págs`
                : "—"}
            </span>
        </div>
      </div>

      {/* Perfect week banner
      {perfectWeek && (
        <div className="mt-auto bg-green-500/10 border border-green-500/20 rounded-sm px-3 py-2 flex items-center justify-center gap-2">
          <span className="text-xs font-semibold text-green-400">
            Semana completa
          </span>
        </div>
      )} */}

      {/* Today nudge */}
      {/* {!todayRead && !perfectWeek && currentDayIndex !== -1 && (
        <div className="mt-auto flex items-center justify-center">
          <span className="text-xs text-zinc-500">
            {currentStreak > 0
              ? `Streak: ${currentStreak} dias`
              : "Leia hoje"}
          </span>
        </div>
      )} */}
    </div>
  );
}

export default WeeklyStreak;
