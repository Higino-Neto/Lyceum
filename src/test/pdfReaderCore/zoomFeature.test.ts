import { afterEach, describe, expect, it, vi } from "vitest";
import { installZoomFeature } from "../../../resources/pdfjs-viewer/features/zoom/index.mjs";

function createApp(options: {
  updateZoom?: unknown;
  accumulateFactor?: unknown;
  accumulateTicks?: unknown;
} = {}) {
  const {
    updateZoom,
    accumulateFactor,
    accumulateTicks,
  } = options;
  return {
    updateZoom: updateZoom ?? vi.fn(),
    _accumulateFactor: accumulateFactor ?? undefined,
    _accumulateTicks: accumulateTicks ?? undefined,
    pdfViewer: {
      currentScale: 1,
      isInPresentationMode: false,
    },
  };
}

// Faithful copy of PDF.js's PDFViewerApplication._accumulateTicks/_accumulateFactor
// (public/pdfjs/web/viewer.mjs). Operating on an unseeded custom prop produces
// NaN on the first gesture (undefined arithmetic); the zoom feature must seed
// the props before relying on them.
function installRealStockAccumulators(app: Record<string, unknown>): void {
  app._accumulateTicks = function (this: Record<string, unknown>, ticks: number, prop: string) {
    const before = this[prop] as number;
    if ((before > 0 && ticks < 0) || (before < 0 && ticks > 0)) {
      this[prop] = 0;
    }
    this[prop] = (this[prop] as number) + ticks;
    const wholeTicks = Math.trunc(this[prop] as number);
    this[prop] = (this[prop] as number) - wholeTicks;
    return wholeTicks;
  };
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

describe("viewer zoom feature", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("applies cursor-anchored pinch zoom for ctrl+wheel pixel deltas and prevents the event", () => {
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

  it("zooms by steps for ctrl+wheel line-mode deltas (mouse wheel)", () => {
    const updateZoom = vi.fn();
    const app = createApp({
      updateZoom,
      accumulateTicks: (ticks: number) => ticks,
    });
    installZoomFeature({ facade: { getApp: () => app } });

    // Wheel down reports a positive deltaY, which the stock viewer maps to a
    // negative step (zoom out); wheel up maps to +1 (zoom in).
    dispatchWheel({ ctrlKey: true, deltaY: 120, deltaMode: WheelEvent.DOM_DELTA_LINE });

    expect(updateZoom).toHaveBeenCalledWith(-1, null, [40, 60]);
  });

  it("does not react to plain scrolling (no ctrl/meta)", () => {
    const updateZoom = vi.fn();
    const app = createApp({ updateZoom });
    installZoomFeature({ facade: { getApp: () => app } });

    const event = dispatchWheel({ deltaY: 60, deltaMode: WheelEvent.DOM_DELTA_LINE });

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
    // The props are seeded into finite, valid seeds (factor 1, ticks 0).
    expect(app._lyceumWheelUnusedFactor).toEqual(expect.any(Number));
    expect(Number.isFinite(app._lyceumWheelUnusedFactor)).toBe(true);
    expect(app._lyceumWheelUnusedTicks).toBe(0);
  });

  it("accumulates tiny pixel deltas into whole zoom steps with the real stock accumulator", () => {
    const updateZoom = vi.fn();
    const app = createApp({ updateZoom }) as Record<string, unknown>;
    installRealStockAccumulators(app);
    installZoomFeature({ facade: { getApp: () => app as never } });

    // Not a pinch (factor jump too large): falls into the ticks path, which for
    // pixel mode accumulates delta/30 into whole steps. With an unseeded prop
    // the first _accumulateTicks returns NaN and no zoom step ever fires.
    for (let i = 0; i < 35; i += 1) {
      dispatchWheel({ ctrlKey: true, deltaY: 6 });
    }

    expect(updateZoom).toHaveBeenCalled();
    const anyTicks = updateZoom.mock.calls.some((call: unknown[]) => typeof call[0] === "number");
    expect(anyTicks).toBe(true);
    expect(Number.isFinite(app._lyceumWheelUnusedTicks)).toBe(true);
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
      (app as Record<string, unknown>)._lyceumWheelUnusedTicks = NaN;

      events.documentloaded?.();

      expect((app as Record<string, unknown>)._lyceumWheelUnusedFactor).toBe(1);
      expect((app as Record<string, unknown>)._lyceumWheelUnusedTicks).toBe(0);
    } finally {
      delete globalThis.PDFViewerApplication;
    }
  });
});