import { describe, expect, it } from "vitest";
import {
  PDF_BRIDGE_VERSION,
  PDF_VIEWER_ORIGIN,
  parsePdfViewerMessage,
} from "../pages/ReadingPage/components/pdf-reader/pdfBridgeProtocol";

function message(data: unknown, origin = PDF_VIEWER_ORIGIN, source: Window | null = window) {
  return new MessageEvent("message", { data, origin, source });
}

describe("PDF.js frame protocol", () => {
  it("accepts a valid state update from the viewer frame", () => {
    const state = { page: 3, currentScale: 1.25, scrollTop: 540, totalPages: 20, canAccess: true };
    const parsed = parsePdfViewerMessage(message({
      version: PDF_BRIDGE_VERSION, type: "lyceum-pdfjs:state-changed", state,
    }), window);
    expect(parsed).toEqual({ version: PDF_BRIDGE_VERSION, type: "lyceum-pdfjs:state-changed", state });
  });

  it("rejects a foreign frame, origin, version, and malformed payload", () => {
    const ready = { version: PDF_BRIDGE_VERSION, type: "lyceum-pdfjs:ready" };
    expect(parsePdfViewerMessage(message(ready, "https://example.com"), window)).toBeNull();
    expect(parsePdfViewerMessage(message(ready, PDF_VIEWER_ORIGIN, null), window)).toBeNull();
    expect(parsePdfViewerMessage(message({ ...ready, version: 2 }), window)).toBeNull();
    expect(parsePdfViewerMessage(message({
      version: PDF_BRIDGE_VERSION,
      type: "lyceum-pdfjs:create-concept-from-selection",
      payload: { text: "x", page: 1, rects: [{ page: 1, left: "bad" }] },
    }), window)).toBeNull();
  });
});
