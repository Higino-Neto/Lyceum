import type { TranslationKey } from "../../../i18n";
import type { LibrarySortOption } from "../../../types/LibraryTypes";

/**
 * Column model for the library list (table) view. The user's choice of
 * visible columns, their order and widths is stored as {@link ListColumnsState};
 * this module keeps that state valid as columns are added in later versions.
 */

export type ListColumnId =
  | "title"
  | "author"
  | "series"
  | "format"
  | "pages"
  | "progress"
  | "status"
  | "rating"
  | "size"
  | "folder"
  | "added"
  | "lastOpened"
  | "publisher"
  | "language"
  | "published"
  | "isbn";

type SortBase = "title" | "author" | "series" | "type" | "pages" | "size" | "rating" | "added" | "recent";

export interface ListColumnDefinition {
  id: ListColumnId;
  labelKey: TranslationKey;
  defaultWidth: number;
  minWidth: number;
  /** Sort applied when the header is clicked; absent for unsortable columns. */
  sort?: SortBase;
  /** Direction used on the first click (numbers and dates start descending). */
  firstDirection?: "asc" | "desc";
  align?: "start" | "end";
  /** Always visible and first (the title column carries cover and selection). */
  locked?: boolean;
  defaultHidden?: boolean;
}

export const LIST_COLUMNS: ListColumnDefinition[] = [
  { id: "title", labelKey: "library:list.columns.name", defaultWidth: 360, minWidth: 220, sort: "title", locked: true },
  { id: "author", labelKey: "library:list.columns.author", defaultWidth: 200, minWidth: 110, sort: "author" },
  { id: "series", labelKey: "library:list.columns.series", defaultWidth: 180, minWidth: 110, sort: "series", defaultHidden: true },
  { id: "format", labelKey: "library:list.columns.type", defaultWidth: 96, minWidth: 70, sort: "type" },
  { id: "pages", labelKey: "library:list.columns.pages", defaultWidth: 104, minWidth: 80, sort: "pages", firstDirection: "desc", align: "end" },
  { id: "progress", labelKey: "library:list.columns.progress", defaultWidth: 130, minWidth: 96 },
  { id: "status", labelKey: "library:list.columns.status", defaultWidth: 140, minWidth: 100, defaultHidden: true },
  { id: "rating", labelKey: "library:list.columns.rating", defaultWidth: 96, minWidth: 76, sort: "rating", firstDirection: "desc", align: "end", defaultHidden: true },
  { id: "size", labelKey: "library:list.columns.size", defaultWidth: 96, minWidth: 76, sort: "size", firstDirection: "desc", align: "end" },
  { id: "folder", labelKey: "library:list.columns.folder", defaultWidth: 200, minWidth: 120, defaultHidden: true },
  { id: "added", labelKey: "library:list.columns.added", defaultWidth: 120, minWidth: 96, sort: "added", firstDirection: "desc", defaultHidden: true },
  { id: "lastOpened", labelKey: "library:list.columns.modified", defaultWidth: 120, minWidth: 96, sort: "recent", firstDirection: "desc" },
  { id: "publisher", labelKey: "library:list.columns.publisher", defaultWidth: 160, minWidth: 100, defaultHidden: true },
  { id: "language", labelKey: "library:list.columns.language", defaultWidth: 96, minWidth: 76, defaultHidden: true },
  { id: "published", labelKey: "library:list.columns.published", defaultWidth: 110, minWidth: 86, defaultHidden: true },
  { id: "isbn", labelKey: "library:list.columns.isbn", defaultWidth: 150, minWidth: 110, defaultHidden: true },
];

const COLUMN_BY_ID = new Map(LIST_COLUMNS.map((column) => [column.id, column]));

export interface ListColumnsState {
  order: ListColumnId[];
  hidden: ListColumnId[];
  widths: Partial<Record<ListColumnId, number>>;
}

export const DEFAULT_LIST_COLUMNS_STATE: ListColumnsState = {
  order: LIST_COLUMNS.map((column) => column.id),
  hidden: LIST_COLUMNS.filter((column) => column.defaultHidden).map((column) => column.id),
  widths: {},
};

export function getListColumn(id: ListColumnId): ListColumnDefinition {
  return COLUMN_BY_ID.get(id)!;
}

/**
 * Repairs stored state: drops unknown ids, keeps the locked title first and
 * appends columns introduced after the state was saved (with their default
 * visibility).
 */
export function normalizeListColumnsState(state: Partial<ListColumnsState> | null | undefined): ListColumnsState {
  const storedOrder = Array.isArray(state?.order) ? state!.order.filter((id) => COLUMN_BY_ID.has(id)) : [];
  const known = new Set(storedOrder);
  const appended = LIST_COLUMNS.map((column) => column.id).filter((id) => !known.has(id));
  const order = Array.from(new Set([...storedOrder, ...appended])).filter((id) => id !== "title");
  const storedHidden = Array.isArray(state?.hidden) ? state!.hidden.filter((id) => COLUMN_BY_ID.has(id)) : [];
  const hidden = Array.from(new Set([
    ...storedHidden,
    ...appended.filter((id) => getListColumn(id).defaultHidden),
  ])).filter((id) => id !== "title");
  const widths: Partial<Record<ListColumnId, number>> = {};
  for (const [id, width] of Object.entries(state?.widths || {}) as Array<[ListColumnId, number]>) {
    const column = COLUMN_BY_ID.get(id);
    if (column && Number.isFinite(width)) widths[id] = Math.max(column.minWidth, Math.round(width));
  }
  return { order: ["title", ...order], hidden, widths };
}

export function visibleListColumns(state: ListColumnsState): ListColumnDefinition[] {
  const hidden = new Set(state.hidden);
  return state.order.filter((id) => id === "title" || !hidden.has(id)).map(getListColumn);
}

export function columnWidth(state: ListColumnsState, column: ListColumnDefinition): number {
  return state.widths[column.id] ?? column.defaultWidth;
}

export function toggleListColumn(state: ListColumnsState, id: ListColumnId): ListColumnsState {
  if (getListColumn(id).locked) return state;
  const hidden = state.hidden.includes(id)
    ? state.hidden.filter((candidate) => candidate !== id)
    : [...state.hidden, id];
  return { ...state, hidden };
}

/** Moves a column one step; the locked title column never moves. */
export function moveListColumn(state: ListColumnsState, id: ListColumnId, direction: -1 | 1): ListColumnsState {
  const index = state.order.indexOf(id);
  const target = index + direction;
  if (index <= 0 || target <= 0 || target >= state.order.length) return state;
  const order = [...state.order];
  // Both indexes are in range (checked above).
  [order[index], order[target]] = [order[target]!, order[index]!];
  return { ...state, order };
}

export function resizeListColumn(state: ListColumnsState, id: ListColumnId, width: number): ListColumnsState {
  const column = getListColumn(id);
  return { ...state, widths: { ...state.widths, [id]: Math.max(column.minWidth, Math.round(width)) } };
}

/** "author_desc" -> { base: "author", direction: "desc" }; legacy aliases map to their default direction. */
export function parseSortOption(sort: LibrarySortOption): { base: string; direction: "asc" | "desc" } {
  if (sort === "title") return { base: "title", direction: "asc" };
  if (sort === "recent" || sort === "pages" || sort === "size") return { base: sort, direction: "desc" };
  const separator = sort.lastIndexOf("_");
  return { base: sort.slice(0, separator), direction: sort.slice(separator + 1) as "asc" | "desc" };
}

/** Sort produced by clicking a header: toggles direction when the column is already the active sort. */
export function nextSortForColumn(
  column: ListColumnDefinition,
  current: LibrarySortOption,
): LibrarySortOption | null {
  if (!column.sort) return null;
  const active = parseSortOption(current);
  const direction = active.base === column.sort
    ? active.direction === "asc" ? "desc" : "asc"
    : column.firstDirection || "asc";
  return `${column.sort}_${direction}` as LibrarySortOption;
}

export function activeSortDirection(
  column: ListColumnDefinition,
  current: LibrarySortOption,
): "asc" | "desc" | null {
  if (!column.sort) return null;
  const active = parseSortOption(current);
  return active.base === column.sort ? active.direction : null;
}
