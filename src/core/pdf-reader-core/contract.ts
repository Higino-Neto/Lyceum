export const PDF_BRIDGE_VERSION = 1 as const;
export const PDF_VIEWER_ORIGIN = "lyceum-pdfjs://viewer" as const;

// Events: viewer frame -> parent application.
export const EVT_READY = "lyceum-pdfjs:ready";
export const EVT_DOCUMENT_READY = "lyceum-pdfjs:document-ready";
export const EVT_STATE_CHANGED = "lyceum-pdfjs:state-changed";
export const EVT_RESTORE_COMPLETE = "lyceum-pdfjs:restore-complete";
export const EVT_CREATE_CONCEPT = "lyceum-pdfjs:create-concept-from-selection";
export const EVT_OUTLINE_LOADED = "lyceum-pdfjs:outline-loaded";
export const EVT_TOGGLE_CHAPTERS = "lyceum-pdfjs:toggle-chapters";
export const EVT_TOGGLE_ANNOTATIONS = "lyceum-pdfjs:toggle-annotations";

// Commands: parent application -> viewer frame.
export const CMD_NAVIGATE = "lyceum-pdfjs:cmd-navigate";
export const CMD_RESTORE = "lyceum-pdfjs:cmd-restore";
export const CMD_GET_STATE = "lyceum-pdfjs:cmd-get-state";
export const CMD_GET_OUTLINE = "lyceum-pdfjs:cmd-get-outline";
// Kept as the legacy down-message type names: Lyceum did not use dedicated
// "command" names for these, and Pdf.js consumers already rely on them.
export const CMD_SET_HIGHLIGHTS = "lyceum-pdfjs:key-concept-highlights";
export const CMD_SET_CHAPTERS_STATE = "lyceum-pdfjs:chapters-state";
export const CMD_SET_ANNOTATIONS_STATE = "lyceum-pdfjs:annotations-state";

export interface PdfViewState {
  page: number;
  currentScale: number;
  scrollTop: number;
  totalPages: number;
  canAccess: boolean;
}

export interface PdfSelectionRect {
  page: number;
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface PdfSelectionPayload {
  text: string;
  page: number;
  rects: PdfSelectionRect[];
}

export interface OutlineNode {
  title: string;
  page: number | null;
  items: OutlineNode[];
}

export interface NavigateState {
  page: number;
  currentScale?: number;
  scrollTop?: number;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNumber(value: unknown, { min = -Infinity } = {}): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min;
}

export function isPdfViewState(value: unknown): value is PdfViewState {
  return isRecord(value) &&
    Number.isInteger(value.page) && (value.page as number) > 0 &&
    isFiniteNumber(value.currentScale, { min: 0 }) && (value.currentScale as number) > 0 &&
    isFiniteNumber(value.scrollTop, { min: 0 }) &&
    Number.isInteger(value.totalPages) && (value.totalPages as number) >= 0 &&
    value.canAccess === true;
}

export function isPdfSelectionRect(value: unknown): value is PdfSelectionRect {
  return isRecord(value) &&
    ["page", "left", "top", "width", "height"].every((key) =>
      isFiniteNumber(value[key]),
    );
}

export function isPdfSelectionPayload(value: unknown): value is PdfSelectionPayload {
  return isRecord(value) &&
    typeof value.text === "string" &&
    Number.isInteger(value.page) && (value.page as number) > 0 &&
    Array.isArray(value.rects) && value.rects.every(isPdfSelectionRect);
}

export function isOutlineNode(value: unknown): value is OutlineNode {
  if (!isRecord(value) || typeof value.title !== "string") {
    return false;
  }
  if (value.page !== null && !isFiniteNumber(value.page, { min: 1 })) {
    return false;
  }
  return Array.isArray(value.items) && value.items.every(isOutlineNode);
}

export function isNavigateState(value: unknown): value is NavigateState {
  return isRecord(value) &&
    isFiniteNumber(value.page, { min: 1 }) &&
    (value.currentScale === undefined || isFiniteNumber(value.currentScale, { min: 0 })) &&
    (value.scrollTop === undefined || isFiniteNumber(value.scrollTop, { min: 0 }));
}
// Additive BookEdge landmark command; existing version-1 clients remain compatible.
export const CMD_SET_BOOK_LANDMARKS = "lyceum-pdfjs:book-landmarks";
export interface BookLandmark { page: number; kind: "highlight" | "note" }
export function isBookLandmark(value: unknown): value is BookLandmark {
  return isRecord(value) && Number.isInteger(value.page) && (value.page as number) > 0 &&
    (value.kind === "highlight" || value.kind === "note");
}

// Additive theme command for the isolated viewer document. The host sends the
// already-resolved semantic token values, so the viewer never needs to know
// which accent palette is active.
export const CMD_SET_THEME = "lyceum-pdfjs:cmd-set-theme";
export interface PdfViewerTheme {
  theme: "light" | "dark";
  colors: Record<string, string>;
}
const THEME_COLOR_NAME = /^[a-z][a-z0-9-]*$/;
export function isPdfViewerTheme(value: unknown): value is PdfViewerTheme {
  if (!isRecord(value) || (value.theme !== "light" && value.theme !== "dark")) {
    return false;
  }
  if (!isRecord(value.colors)) {
    return false;
  }
  return Object.entries(value.colors).every(
    ([name, color]) => THEME_COLOR_NAME.test(name) && typeof color === "string",
  );
}

// Additive i18n command for strings rendered inside the isolated viewer frame.
export const CMD_SET_STRINGS = "lyceum-pdfjs:cmd-set-strings";
export interface PdfViewerStrings {
  bookEdge?: {
    edgeAriaLabel?: string;
    edgeTitle?: string;
    dialogAriaLabelledBy?: string;
    dialogTitle?: string;
    closeLabel?: string;
    closeEsc?: string;
    gridAriaLabel?: string;
    closeLookAriaLabel?: string;
    bookmarkAdd?: string;
    bookmarkRemove?: string;
    openPage?: string;
    previous?: string;
    next?: string;
    help?: string;
    contextFallback?: string;
    contextPage?: string;
    range?: string;
    selection?: string;
    inspectPage?: string;
    marked?: string;
    loading?: string;
    loadError?: string;
    bookmarkSavedSession?: string;
    landmarkNote?: string;
    landmarkHighlight?: string;
    bookmarkTitle?: string;
    pickHint?: string;
    pickSummary?: string;
    pickClear?: string;
    pickExport?: string;
    pickExercises?: string;
    pickAdd?: string;
    pickRemove?: string;
    pickBusyExport?: string;
    pickBusyExercises?: string;
    pickedLabel?: string;
  };
}
export function isPdfViewerStrings(value: unknown): value is PdfViewerStrings {
  return isRecord(value);
}

// Additive page picking in the riffle dialog: the reader marks pages across the
// book and asks the host to export them (or to pick the detected exercises).
export const EVT_EXPORT_PAGES = "lyceum-pdfjs:export-pages";
export const EVT_REQUEST_EXERCISE_PAGES = "lyceum-pdfjs:request-exercise-pages";
export const CMD_SET_PAGE_PICKS = "lyceum-pdfjs:cmd-set-page-picks";
export const CMD_SET_PAGE_PICK_STATE = "lyceum-pdfjs:cmd-set-page-pick-state";

export interface PageListPayload {
  /** One-based page numbers. */
  pages: number[];
}
export interface PagePicksCommand extends PageListPayload {
  mode: "replace" | "add" | "remove";
}
export interface PagePickState {
  exportAvailable: boolean;
  exercisesAvailable: boolean;
  busy: "export" | "exercises" | null;
}

export function isPageList(value: unknown): value is number[] {
  return Array.isArray(value) && value.length <= 100_000 &&
    value.every((page) => Number.isInteger(page) && (page as number) > 0);
}
export function isPageListPayload(value: unknown): value is PageListPayload {
  return isRecord(value) && isPageList(value.pages);
}
export function isPagePicksCommand(value: unknown): value is PagePicksCommand {
  return isPageListPayload(value) && isRecord(value) &&
    (value.mode === "replace" || value.mode === "add" || value.mode === "remove");
}

/** "3–5, 9, 12–14" for a set of one-based pages. */
export function formatPageRanges(pages: Iterable<number>): string {
  const sorted = [...new Set(pages)].sort((a, b) => a - b);
  const parts: string[] = [];
  for (let index = 0; index < sorted.length; index += 1) {
    const start = sorted[index]!;
    let end = start;
    while (sorted[index + 1] === end + 1) {
      end += 1;
      index += 1;
    }
    parts.push(start === end ? `${start}` : `${start}–${end}`);
  }
  return parts.join(", ");
}

/** Contiguous runs of one-based pages, for drawing them on the book edge. */
export function pageRuns(pages: Iterable<number>): Array<{ from: number; to: number }> {
  const sorted = [...new Set(pages)].sort((a, b) => a - b);
  const runs: Array<{ from: number; to: number }> = [];
  for (const page of sorted) {
    const last = runs[runs.length - 1];
    if (last && last.to === page - 1) last.to = page;
    else runs.push({ from: page, to: page });
  }
  return runs;
}
