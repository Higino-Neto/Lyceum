import {
  EVT_CREATE_CONCEPT,
  EVT_DOCUMENT_READY,
  EVT_OUTLINE_LOADED,
  EVT_READY,
  EVT_RESTORE_COMPLETE,
  EVT_STATE_CHANGED,
  EVT_TOGGLE_ANNOTATIONS,
  EVT_TOGGLE_CHAPTERS,
  CMD_GET_OUTLINE,
  CMD_NAVIGATE,
  CMD_RESTORE,
  CMD_SET_ANNOTATIONS_STATE,
  CMD_SET_CHAPTERS_STATE,
  CMD_SET_HIGHLIGHTS,
  isOutlineNode,
  isPdfSelectionPayload,
  isPdfViewState,
  isRecord,
  PDF_BRIDGE_VERSION,
  PDF_VIEWER_ORIGIN,
  type OutlineNode,
  type PdfSelectionPayload,
  type PdfViewState,
} from "../../../../core/pdf-reader-core/contract";

export {
  CMD_GET_OUTLINE,
  CMD_NAVIGATE,
  CMD_RESTORE,
  CMD_SET_ANNOTATIONS_STATE,
  CMD_SET_CHAPTERS_STATE,
  CMD_SET_HIGHLIGHTS,
  EVT_CREATE_CONCEPT,
  EVT_DOCUMENT_READY,
  EVT_OUTLINE_LOADED,
  EVT_READY,
  EVT_RESTORE_COMPLETE,
  EVT_STATE_CHANGED,
  EVT_TOGGLE_ANNOTATIONS,
  EVT_TOGGLE_CHAPTERS,
  PDF_BRIDGE_VERSION,
  PDF_VIEWER_ORIGIN,
};
export type {
  OutlineNode,
  PdfSelectionPayload,
  PdfViewState,
} from "../../../../core/pdf-reader-core/contract";

export type PdfViewerEvent =
  | { version: 1; type: typeof EVT_READY | typeof EVT_DOCUMENT_READY | typeof EVT_TOGGLE_CHAPTERS | typeof EVT_TOGGLE_ANNOTATIONS }
  | { version: 1; type: typeof EVT_STATE_CHANGED; state: PdfViewState }
  | { version: 1; type: typeof EVT_RESTORE_COMPLETE; state: PdfViewState | null }
  | { version: 1; type: typeof EVT_CREATE_CONCEPT; payload: PdfSelectionPayload }
  | { version: 1; type: typeof EVT_OUTLINE_LOADED; outline: OutlineNode[]; requestId?: string; error?: boolean; message?: string };

function isOutlineList(value: unknown): value is OutlineNode[] {
  return Array.isArray(value) && value.every(isOutlineNode);
}

export function parsePdfViewerMessage(
  event: MessageEvent,
  viewerWindow: Window | null | undefined,
): PdfViewerEvent | null {
  if (!viewerWindow || event.source !== viewerWindow ||
      (event.origin !== PDF_VIEWER_ORIGIN && event.origin !== "null") ||
      !isRecord(event.data) || event.data.version !== PDF_BRIDGE_VERSION) {
    return null;
  }
  const data = event.data;
  switch (data.type) {
    case EVT_READY:
    case EVT_DOCUMENT_READY:
    case EVT_TOGGLE_CHAPTERS:
    case EVT_TOGGLE_ANNOTATIONS:
      return data as PdfViewerEvent;
    case EVT_STATE_CHANGED:
      return isPdfViewState(data.state) ? data as PdfViewerEvent : null;
    case EVT_RESTORE_COMPLETE:
      return data.state === null || isPdfViewState(data.state) ? data as PdfViewerEvent : null;
    case EVT_CREATE_CONCEPT:
      return isPdfSelectionPayload(data.payload) ? data as PdfViewerEvent : null;
    case EVT_OUTLINE_LOADED:
      return isOutlineList(data.outline) ? data as PdfViewerEvent : null;
    default:
      return null;
  }
}

export function postToPdfViewer(
  viewerWindow: Window | null | undefined,
  type: string,
  payload: Record<string, unknown> = {},
): void {
  // Custom schemes may have opaque origins in Chromium. The receiver verifies
  // event.source, origin when available, version and message type.
  viewerWindow?.postMessage({ version: PDF_BRIDGE_VERSION, type, ...payload }, "*");
}