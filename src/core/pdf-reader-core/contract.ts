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
