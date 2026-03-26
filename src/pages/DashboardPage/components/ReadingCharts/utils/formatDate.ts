export default function formatDate(dateStr: string | Date) {
  if (dateStr instanceof Date) {
    const d = String(dateStr.getDate()).padStart(2, "0");
    const m = String(dateStr.getMonth() + 1).padStart(2, "0");
    return `${d}/${m}`;
  }
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${d}/${m}`;
}
