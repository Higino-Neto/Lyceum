import { afterEach, describe, expect, it, vi } from "vitest";
import { createStateStore } from "../../../resources/pdfjs-viewer/core/state.mjs";
import { installSelectionFeature } from "../../../resources/pdfjs-viewer/features/selection/index.mjs";

function addTextLayer() {
  const page = document.createElement("div");
  page.className = "page";
  page.dataset.pageNumber = "1";
  const layer = document.createElement("div");
  layer.className = "textLayer";
  const span = document.createElement("span");
  span.textContent = "Hello world";
  layer.append(span);
  page.append(layer);
  document.body.append(page);
  Object.defineProperty(page, "getBoundingClientRect", { value: () => new DOMRect(0, 0, 200, 100) });
  Object.defineProperty(layer, "getBoundingClientRect", { value: () => new DOMRect(0, 0, 200, 100) });
  return { page, layer, span };
}

describe("PDF selection actions", () => {
  const originalRects = Range.prototype.getClientRects;
  const originalBounds = Range.prototype.getBoundingClientRect;
  const originalRaf = globalThis.requestAnimationFrame;

  afterEach(() => {
    Range.prototype.getClientRects = originalRects;
    Range.prototype.getBoundingClientRect = originalBounds;
    globalThis.requestAnimationFrame = originalRaf;
    document.body.replaceChildren();
    delete (globalThis as { PDFViewerApplication?: unknown }).PDFViewerApplication;
  });

  it("waits for release before showing actions and rebuilds the highlight after a text-layer replacement", async () => {
    Range.prototype.getClientRects = function () {
      return [new DOMRect(10 + this.startOffset * 10, 10, (this.endOffset - this.startOffset) * 10, 16)] as unknown as DOMRectList;
    };
    Range.prototype.getBoundingClientRect = function () {
      return new DOMRect(10 + this.startOffset * 10, 10, (this.endOffset - this.startOffset) * 10, 16);
    };
    globalThis.requestAnimationFrame = (callback) => { callback(0); return 1; };
    const callbacks = new Map<string, () => void>();
    (globalThis as { PDFViewerApplication?: unknown }).PDFViewerApplication = {
      initializedPromise: Promise.resolve(),
      eventBus: { on: (name: string, callback: () => void) => callbacks.set(name, callback) },
    };
    const { page, span } = addTextLayer();
    const emit = vi.fn();
    installSelectionFeature({ bus: { emit }, facade: { getApp: () => ({ page: 1 }) }, state: createStateStore() });
    await Promise.resolve();
    const pointer = window.PointerEvent ? "pointer" : "mouse";
    span.dispatchEvent(new MouseEvent(`${pointer}down`, { bubbles: true, cancelable: true, button: 0, clientX: 15, clientY: 15 }));
    span.dispatchEvent(new MouseEvent(`${pointer}move`, { bubbles: true, cancelable: true, button: 0, clientX: 65, clientY: 15 }));
    expect(document.querySelectorAll(".lyceumSelectionRect").length).toBeGreaterThan(0);
    expect(document.getElementById("lyceumSelectionToolbar")).toBeNull();
    span.dispatchEvent(new MouseEvent(`${pointer}up`, { bubbles: true, cancelable: true, button: 0, clientX: 65, clientY: 15 }));
    expect(document.querySelectorAll("#lyceumSelectionToolbar button")).toHaveLength(2);

    page.querySelector(".textLayer")?.remove();
    const next = addTextLayer();
    page.replaceChildren(next.layer);
    next.page.remove();
    callbacks.get("textlayerrendered")?.();
    expect(page.querySelectorAll(".lyceumSelectionRect").length).toBeGreaterThan(0);
    expect(document.getElementById("lyceumSelectionToolbar")).not.toBeNull();
    expect(emit).not.toHaveBeenCalled();
    (document.querySelector("#lyceumSelectionToolbar button") as HTMLButtonElement).click();
    expect(emit).toHaveBeenCalledWith("lyceum-pdfjs:create-concept-from-selection", {
      payload: expect.objectContaining({ text: expect.stringContaining("Hello"), page: 1 }),
    });
  });
});
