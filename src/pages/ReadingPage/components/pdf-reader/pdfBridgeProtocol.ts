import type { PdfSelectionPayload, PdfSelectionRect } from "../../../../types/AnnotationTypes";

export const PDF_BRIDGE_VERSION = 1;
export const PDF_VIEWER_ORIGIN = "lyceum-pdfjs://viewer";

export interface PdfViewState {
  page: number;
  currentScale: number;
  scrollTop: number;
  totalPages: number;
  canAccess: boolean;
}

export type PdfViewerMessage =
  | { version: 1; type: "lyceum-pdfjs:ready" | "lyceum-pdfjs:document-ready" | "lyceum-pdfjs:toggle-chapters" | "lyceum-pdfjs:toggle-annotations" }
  | { version: 1; type: "lyceum-pdfjs:state-changed"; state: PdfViewState }
  | { version: 1; type: "lyceum-pdfjs:create-concept-from-selection"; payload: PdfSelectionPayload };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isRect(value: unknown): value is PdfSelectionRect {
  return isRecord(value) &&
    ["page", "left", "top", "width", "height"].every((key) =>
      typeof value[key] === "number" && Number.isFinite(value[key]),
    );
}

function isState(value: unknown): value is PdfViewState {
  return isRecord(value) &&
    Number.isInteger(value.page) && (value.page as number) > 0 &&
    typeof value.currentScale === "number" && Number.isFinite(value.currentScale) && value.currentScale > 0 &&
    typeof value.scrollTop === "number" && Number.isFinite(value.scrollTop) && value.scrollTop >= 0 &&
    Number.isInteger(value.totalPages) && (value.totalPages as number) >= 0 &&
    value.canAccess === true;
}

export function parsePdfViewerMessage(
  event: MessageEvent,
  viewerWindow: Window | null | undefined,
): PdfViewerMessage | null {
  if (!viewerWindow || event.source !== viewerWindow ||
      (event.origin !== PDF_VIEWER_ORIGIN && event.origin !== "null") ||
      !isRecord(event.data) || event.data.version !== PDF_BRIDGE_VERSION) {
    return null;
  }
  const data = event.data;
  switch (data.type) {
    case "lyceum-pdfjs:ready":
    case "lyceum-pdfjs:document-ready":
    case "lyceum-pdfjs:toggle-chapters":
    case "lyceum-pdfjs:toggle-annotations":
      return data as PdfViewerMessage;
    case "lyceum-pdfjs:state-changed":
      return isState(data.state) ? data as PdfViewerMessage : null;
    case "lyceum-pdfjs:create-concept-from-selection": {
      const payload = data.payload;
      return isRecord(payload) && typeof payload.text === "string" &&
        Number.isInteger(payload.page) && (payload.page as number) > 0 &&
        Array.isArray(payload.rects) && payload.rects.every(isRect)
        ? data as PdfViewerMessage : null;
    }
    default:
      return null;
  }
}

export function postToPdfViewer(viewerWindow: Window | null | undefined, message: Record<string, unknown>): void {
  // Custom schemes may have opaque origins in Chromium. The receiver verifies
  // event.source, origin when available, version and message type.
  viewerWindow?.postMessage({ ...message, version: PDF_BRIDGE_VERSION }, "*");
}
