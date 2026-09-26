/**
 * Locale-aware formatters shared by the app. Everything here derives from the
 * active language, so no screen needs to hard-code a date or number shape.
 */
import { getIntlLocale } from "./config";

/** `dd/mm` for pt-BR, `mm/dd` for en, always two digits. */
export function formatShortDate(date: Date, locale: string): string {
  try {
    return new Intl.DateTimeFormat(getIntlLocale(locale), {
      day: "2-digit",
      month: "2-digit",
    }).format(date);
  } catch {
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `${day}/${month}`;
  }
}

/** Full date, e.g. `15/01/2024` in pt-BR. */
export function formatDate(date: Date, locale: string): string {
  try {
    return new Intl.DateTimeFormat(getIntlLocale(locale)).format(date);
  } catch {
    return date.toISOString().split("T")[0]!;
  }
}

export function formatNumber(
  value: number,
  locale: string,
  options?: Intl.NumberFormatOptions,
): string {
  try {
    return new Intl.NumberFormat(getIntlLocale(locale), options).format(value);
  } catch {
    return String(value);
  }
}

/** Weekday initials from Sunday to Sunday, e.g. `["D","S","T","Q","Q","S","S"]`. */
export function getWeekdayInitials(locale: string): string[] {
  try {
    const formatter = new Intl.DateTimeFormat(getIntlLocale(locale), {
      weekday: "narrow",
    });

    return Array.from({ length: 7 }, (_, index) =>
      formatter.format(new Date(2021, 7, 1 + index)),
    );
  } catch {
    return ["D", "S", "T", "Q", "Q", "S", "S"];
  }
}

/** Short weekday names from Sunday to Sunday, e.g. `["dom", "seg", ...]`. */
export function getWeekdayShortNames(locale: string): string[] {
  try {
    const formatter = new Intl.DateTimeFormat(getIntlLocale(locale), {
      weekday: "short",
    });

    return Array.from({ length: 7 }, (_, index) =>
      formatter.format(new Date(2021, 8, 5 + index)),
    );
  } catch {
    return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  }
}

/** Short month names from January to December. */
export function getShortMonthNames(locale: string): string[] {
  try {
    const formatter = new Intl.DateTimeFormat(getIntlLocale(locale), {
      month: "short",
    });

    return Array.from({ length: 12 }, (_, index) =>
      formatter.format(new Date(2021, index, 1)),
    );
  } catch {
    return [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
  }
}
