export interface ReaderPoint { x: number; y: number }
export interface ReaderRect extends ReaderPoint { width: number; height: number }
export type ReaderLocator =
  | { format: "pdf"; page: number; rotation?: number; rects?: ReaderRect[]; strokes?: ReaderPoint[][] }
  | { format: "epub"; cfi: string }
  | { format: "txt"; offset: number; end?: number; percent?: number };
export interface ReaderAnnotation {
  id: string; bookId: string; type: "highlight" | "note" | "bookmark" | "ink";
  color: string; text: string; note: string; locator: ReaderLocator;
  createdAt: string; updatedAt: string; deletedAt?: string;
}
export interface ReaderData { schemaVersion: 1; annotations: ReaderAnnotation[]; listening: Record<string, number> }
export const emptyReaderData = (): ReaderData => ({ schemaVersion: 1, annotations: [], listening: {} });
export function validLocator(value: unknown): value is ReaderLocator {
  if (!value || typeof value !== "object") return false;
  const l = value as ReaderLocator;
  if (l.format === "epub") return typeof l.cfi === "string" && l.cfi.startsWith("epubcfi(");
  if (l.format === "txt") return Number.isInteger(l.offset) && l.offset >= 0 && (l.end === undefined || Number.isInteger(l.end) && l.end >= l.offset);
  if (l.format !== "pdf" || !Number.isInteger(l.page) || l.page < 1) return false;
  const point = (p: ReaderPoint) => p && Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1;
  return (!l.rects || Array.isArray(l.rects) && l.rects.every(r => point(r) && Number.isFinite(r.width) && Number.isFinite(r.height) && r.width >= 0 && r.width <= 1 && r.height >= 0 && r.height <= 1))
    && (!l.strokes || Array.isArray(l.strokes) && l.strokes.every(s => Array.isArray(s) && s.every(point)));
}
export function migrateReaderData(value: unknown): ReaderData {
  if (!value || typeof value !== "object") return emptyReaderData();
  const data = value as Partial<ReaderData>;
  return { schemaVersion: 1, annotations: Array.isArray(data.annotations) ? data.annotations.filter(a => a && typeof a.id === "string" && typeof a.bookId === "string"
    && ["highlight", "note", "bookmark", "ink"].includes(a.type) && validLocator(a.locator) && Number.isFinite(Date.parse(a.updatedAt)))
    .map(a => ({ ...a, text: String(a.text || ""), note: String(a.note || ""), color: /^#[0-9a-f]{6}$/i.test(a.color) ? a.color : "#facc15" })) : [],
    listening: Object.fromEntries(Object.entries(data.listening || {}).filter(([, offset]) => Number.isInteger(offset) && offset >= 0)) };
}
export function mergeAnnotations(local: ReaderAnnotation[], remote: ReaderAnnotation[]) {
  const items = new Map(local.map(a => [a.id, a]));
  const conflicts: ReaderAnnotation[] = [];
  for (const incoming of remote) {
    const current = items.get(incoming.id);
    if (current && current.updatedAt === incoming.updatedAt && JSON.stringify(current) !== JSON.stringify(incoming)) { conflicts.push(incoming); continue; }
    if (!current || Date.parse(incoming.updatedAt) > Date.parse(current.updatedAt)) items.set(incoming.id, incoming);
  }
  return { annotations: [...items.values()], conflicts };
}
export function exportAnnotations(items: ReaderAnnotation[], format: "md" | "csv") {
  const live = items.filter(a => !a.deletedAt);
  // Prevent spreadsheet formulas when opening untrusted book text as CSV.
  const cell = (value: string) => '"' + (/^[=+@\-\t\r]/.test(value) ? "'" + value : value).replace(/"/g, '""') + '"';
  if (format === "csv") return "id,bookId,type,text,note,locator,updatedAt\r\n" + live.map(a => [a.id, a.bookId, a.type, a.text, a.note, JSON.stringify(a.locator), a.updatedAt].map(cell).join(",")).join("\r\n");
  return "# Anotações Lyceum\n\n" + live.map(a => `## ${a.type} — ${a.bookId}\n\n${a.text.split("\n").map(line => "> " + line).join("\n")}\n\n${a.note}\n\nLocal: \`${JSON.stringify(a.locator)}\`\n`).join("\n");
}
export function hitTestStroke(page: number, locator: ReaderLocator, point: ReaderPoint, tolerance = 0.015) {
  if (locator.format !== "pdf" || locator.page !== page) return -1;
  return (locator.strokes || []).findIndex(stroke => stroke.some((a, i) => {
    const b = stroke[Math.max(0, i - 1)];
    const dx = b.x - a.x, dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(point.x - a.x - t * dx, point.y - a.y - t * dy) <= tolerance;
  }));
}
export function appendHistory<T>(items: T[], index: number, next: T): { items: T[]; index: number } {
  if (JSON.stringify(items[index]) === JSON.stringify(next)) return { items, index };
  const result = [...items.slice(0, index + 1), next].slice(-100);
  return { items: result, index: result.length - 1 };
}

export function rotateReaderRect(rect: ReaderRect, rotation: number): ReaderRect {
  let result = { ...rect };
  for (let turns = 0; turns < ((rotation % 360 + 360) % 360) / 90; turns++) result = { x: 1 - result.y - result.height, y: result.x, width: result.height, height: result.width };
  return result;
}
