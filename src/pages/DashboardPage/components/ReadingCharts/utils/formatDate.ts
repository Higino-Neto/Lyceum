import { formatShortDate, i18next } from "../../../../../i18n";

/** `dd/mm` in pt-BR, `mm/dd` in en, following the active language. */
export default function formatDate(dateStr: string | Date) {
  const date =
    dateStr instanceof Date
      ? dateStr
      : (() => {
          const [year, month, day] = dateStr.split("-").map(Number);
          return new Date(year, month - 1, day);
        })();

  return formatShortDate(date, i18next.language);
}
