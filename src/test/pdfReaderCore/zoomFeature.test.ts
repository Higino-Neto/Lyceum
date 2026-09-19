import { afterEach, describe, expect, it, vi } from "vitest";
import { installZoomFeature } from "../../../resources/pdfjs-viewer/features/zoom/index.mjs";

function createApp(options: {
  updateZoom?: unknown;
  accumulateFactor?: unknown;
} = {}) {
  const {
    updateZoom,
    accumulateFactor,
  } = options;
  return {
    updateZoom: updateZoom ?? vi.fn(),
    _accumulateFactor: accumulateFactor ?? undefined,
    pdfViewer: {
      currentScale: 1,
      isInPresentationMode: false,
    },
  };
}

// Faithful copy of PDF.js's _accumulateFactor. An unseeded custom property
// produces NaN on the first pinch gesture.
function installRealStockAccumulators(app: Record<string, unknown>): void {
  app._accumulateFactor = function (this: Record<string, unknown>, previousScale: number, factor: number, prop: string) {
    if (factor === 1) {
      return 1;
    }
    const before = this[prop] as number;
    if ((before > 1 && factor < 1) || (before < 1 && factor > 1)) {
      this[prop] = 1;
    }
    const newFactor = Math.floor(previousScale * factor * (this[prop] as number) * 100) / (100 * previousScale);
    this[prop] = factor / newFactor;
    return newFactor;
  };
}

const dispatchWheel = (overrides = {}) => {
  const event = new WheelEvent("wheel", {
    bubbles: true,
    cancelable: true,
    ctrlKey: false,
    metaKey: false,
    deltaX: 0,
    deltaY: 0,
    deltaMode: WheelEvent.DOM_DELTA_PIXEL,
    clientX: 40,
    clientY: 60,
    ...overrides,
  });
  window.dispatchEvent(event);
  return event;
};

const holdControl = () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Control", bubbles: true }));

describe("viewer zoom feature", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("zooms on a two-finger pinch without the user holding Ctrl", () => {
    const updateZoom = vi.fn();
    const accumulateFactor = vi.fn((_scale: number, factor: number) => factor);
    const app = createApp({ updateZoom, accumulateFactor });
    installZoomFeature({ facade: { getApp: () => app } });

    const event = dispatchWheel({ ctrlKey: true, deltaY: -3 });

    expect(event.defaultPrevented).toBe(true);
    expect(accumulateFactor).toHaveBeenCalledWith(1, expect.any(Number), "_lyceumWheelUnusedFactor");
    expect(updateZoom).toHaveBeenCalledTimes(1);
    expect(updateZoom.mock.calls[0][0]).toBeNull();
    expect(updateZoom.mock.calls[0][1]).toBeCloseTo(Math.exp(0.03), 5);
    expect(updateZoom.mock.calls[0][2]).toEqual([40, 60]);
  });

  it("zooms exactly one 10% step for a Ctrl plus mouse-wheel notch", () => {
    const updateZoom = vi.fn();
    const app = createApp({ updateZoom });
    installZoomFeature({ facade: { getApp: () => app } });
    holdControl();
    dispatchWheel({ ctrlKey: true, deltaY: 120, deltaMode: WheelEvent.DOM_DELTA_LINE });
    expect(updateZoom).toHaveBeenCalledWith(null, 1 / 1.1, [40, 60]);
  });

  it("caps a pixel-mode mouse-wheel notch to a single 10% step", () => {
    const updateZoom = vi.fn();
    const app = createApp({ updateZoom });
    installZoomFeature({ facade: { getApp: () => app } });
    holdControl();
    dispatchWheel({ ctrlKey: true, deltaY: -120, deltaMode: WheelEvent.DOM_DELTA_PIXEL });
    expect(updateZoom).toHaveBeenCalledTimes(1);
    expect(updateZoom).toHaveBeenCalledWith(null, 1.1, [40, 60]);
  });

  it("recognizes a pixel-mode mouse notch when Ctrl was pressed before the iframe gained focus", () => {
    const updateZoom = vi.fn();
    const app = createApp({ updateZoom });
    installZoomFeature({ facade: { getApp: () => app } });
    dispatchWheel({ ctrlKey: true, deltaY: -120, deltaMode: WheelEvent.DOM_DELTA_PIXEL });
    expect(updateZoom).toHaveBeenCalledWith(null, 1.1, [40, 60]);
  });

  it("ignores Ctrl plus a two-finger vertical swipe", () => {
    const updateZoom = vi.fn();
    const viewport = document.createElement("div");
    viewport.id = "viewerContainer";
    document.body.append(viewport);
    const app = createApp({ updateZoom });
    installZoomFeature({ facade: { getApp: () => app } });
    holdControl();
    const downstreamWheel = vi.fn();
    window.addEventListener("wheel", downstreamWheel);
    const event = dispatchWheel({ ctrlKey: true, deltaY: 12, deltaMode: WheelEvent.DOM_DELTA_PIXEL });
    expect(event.defaultPrevented).toBe(true);
    expect(downstreamWheel).not.toHaveBeenCalled();
    expect(viewport.scrollTop).toBe(0);
    expect(updateZoom).not.toHaveBeenCalled();
    window.removeEventListener("wheel", downstreamWheel);
    viewport.remove();
  });

  it.each([
    ["mouse wheel", { ctrlKey: true, deltaY: -120, deltaMode: WheelEvent.DOM_DELTA_LINE }, true],
    ["touchpad pinch", { ctrlKey: true, deltaY: -3, deltaMode: WheelEvent.DOM_DELTA_PIXEL }, false],
  ])("keeps the same page and visual anchor when zooming by %s", (_name, wheel, holdCtrl) => {
    const viewport = document.createElement("div");
    const page = document.createElement("div");
    viewport.append(page);
    document.body.append(viewport);
    viewport.scrollTop = 650;
    let scale = 1;
    page.getBoundingClientRect = () => ({
      left: 20,
      right: 20 + 200 * scale,
      top: 600 * scale - viewport.scrollTop,
      bottom: 1600 * scale - viewport.scrollTop,
      width: 200 * scale,
      height: 1000 * scale,
    }) as DOMRect;
    const viewer = {
      container: viewport,
      currentScale: 1,
      currentPageNumber: 1,
      isInPresentationMode: false,
      getPageView: () => ({ div: page }),
      update: vi.fn(),
      _setCurrentPageNumber: vi.fn((value: number) => { viewer.currentPageNumber = value; }),
    };
    const updateZoom = vi.fn((_steps: null, factor: number) => {
      scale *= factor;
      viewer.currentScale = scale;
      // PDF.js adjusts for the cursor but omits the resized preceding pages.
      viewport.scrollTop += 60 * (factor - 1);
      viewer.currentPageNumber = 2;
    });
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    try {
      installZoomFeature({ facade: { getApp: () => ({ pdfViewer: viewer, updateZoom }) } });
      if (holdCtrl) holdControl();
      dispatchWheel(wheel);
      expect(updateZoom).toHaveBeenCalledTimes(1);
      const rect = page.getBoundingClientRect();
      const anchorY = rect.top + rect.height * 0.11;
      expect(anchorY).toBeCloseTo(60, 5);
      expect(viewer.currentPageNumber).toBe(1);
      expect(viewer._setCurrentPageNumber).toHaveBeenCalledWith(1);
      frames.forEach(callback => callback(0));
      expect(page.getBoundingClientRect().top + page.getBoundingClientRect().height * 0.11).toBeCloseTo(60, 5);
    } finally {
      vi.unstubAllGlobals();
      viewport.remove();
    }
  });

  it("does not react to plain scrolling (no ctrl/meta)", () => {
    const updateZoom = vi.fn();
    const app = createApp({ updateZoom });
    installZoomFeature({ facade: { getApp: () => app } });

    const event = dispatchWheel({ deltaY: 60, deltaMode: WheelEvent.DOM_DELTA_PIXEL });

    expect(event.defaultPrevented).toBe(false);
    expect(updateZoom).not.toHaveBeenCalled();
  });

  it("gives up silently when the application is not ready yet", () => {
    installZoomFeature({ facade: { getApp: () => null } });

    expect(() =>
      dispatchWheel({ ctrlKey: true, deltaY: -3 }),
    ).not.toThrow();
  });

  it("zooms with the real stock accumulators across a touchpad pinch (no NaN)", () => {
    // Regression: the feature's accumulator props start undefined. Without
    // seeding, PDF.js's _accumulateFactor computes Math.floor(prev * factor *
    // undefined * 100) = NaN on the first gesture, so updateZoom is silently
    // skipped and pinch zoom is dead. The feature must seed the props.
    const updateZoom = vi.fn();
    const app = createApp({ updateZoom }) as Record<string, unknown>;
    installRealStockAccumulators(app);
    installZoomFeature({ facade: { getApp: () => app as never } });

    for (let i = 0; i < 4; i += 1) {
      dispatchWheel({ ctrlKey: true, deltaY: -2 });
    }

    expect(updateZoom).toHaveBeenCalled();
    for (const call of updateZoom.mock.calls as [null | number, number | null, number[]][]) {
      const factor = call[1];
      expect(factor).toBeTypeOf("number");
      expect(Number.isFinite(factor)).toBe(true);
      expect(factor).toBeGreaterThan(1);
    }
    // The accumulator is seeded to a finite value.
    expect(app._lyceumWheelUnusedFactor).toEqual(expect.any(Number));
    expect(Number.isFinite(app._lyceumWheelUnusedFactor)).toBe(true);
  });

  it("keeps touchpad pixel deltas continuous even when a gesture exceeds the old pinch threshold", () => {
    const updateZoom = vi.fn();
    const app = createApp({ updateZoom }) as Record<string, unknown>;
    installRealStockAccumulators(app);
    installZoomFeature({ facade: { getApp: () => app as never } });

    dispatchWheel({ ctrlKey: true, deltaY: 6 });

    expect(updateZoom).toHaveBeenCalledTimes(1);
    expect(updateZoom.mock.calls[0][0]).toBeNull();
    expect(updateZoom.mock.calls[0][1]).toBeGreaterThan(0.9);
    expect(updateZoom.mock.calls[0][1]).toBeLessThan(1);
  });

  it("re-seeds the accumulators when a new document loads", async () => {
    const events: Record<string, (value?: unknown) => void> = {};
    const updateZoom = vi.fn();
    const app = {
      updateZoom,
      pdfViewer: { currentScale: 1, isInPresentationMode: false },
      eventBus: {
        on: (event: string, callback: (value?: unknown) => void) => {
          events[event] = callback;
        },
        off: () => {},
      },
    };
    globalThis.PDFViewerApplication = {
      initializedPromise: Promise.resolve(),
      eventBus: app.eventBus,
    } as never;
    try {
      installZoomFeature({ facade: { getApp: () => app } });
      await new Promise(resolve => setTimeout(resolve, 0));

      // Corrupt the seeds as if the previous document left a NaN behind.
      (app as Record<string, unknown>)._lyceumWheelUnusedFactor = NaN;

      events.documentloaded?.();

      expect((app as Record<string, unknown>)._lyceumWheelUnusedFactor).toBe(1);
    } finally {
      delete globalThis.PDFViewerApplication;
    }
  });
});
