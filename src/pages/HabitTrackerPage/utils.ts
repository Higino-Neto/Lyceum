export function getMonthDays(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

export function getMonthLabel(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(date);
}

export function getWeekdayLabel(year: number, month: number, day: number) {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "narrow",
  }).format(new Date(year, month, day));
}

export function createDateKey(year: number, month: number, day: number) {
  const safeMonth = String(month + 1).padStart(2, "0");
  const safeDay = String(day).padStart(2, "0");

  return `${year}-${safeMonth}-${safeDay}`;
}

export function isToday(year: number, month: number, day: number) {
  const today = new Date();

  return (
    today.getFullYear() === year &&
    today.getMonth() === month &&
    today.getDate() === day
  );
}

export function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function getCurrentMonthStreak(dateKeys: string[], monthDate: Date) {
  const visibleMonthKey = getMonthKey(monthDate);
  const monthDates = dateKeys
    .filter((dateKey) => dateKey.startsWith(visibleMonthKey))
    .sort();

  if (monthDates.length === 0) {
    return 0;
  }

  let longest = 1;
  let current = 1;

  for (let index = 1; index < monthDates.length; index += 1) {
    const previous = new Date(`${monthDates[index - 1]}T00:00:00`);
    const next = new Date(`${monthDates[index]}T00:00:00`);
    const diffInDays = Math.round(
      (next.getTime() - previous.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffInDays === 1) {
      current += 1;
      longest = Math.max(longest, current);
      continue;
    }

    current = 1;
  }

  return longest;
}

