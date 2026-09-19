import { onViewerBooted } from "../../core/lifecycle.mjs";

// Touchpad/mouse-wheel zoom with Ctrl/Meta. The stock viewer gates its own
// ctrl+wheel handler behind scroll-tracking that, in practice, suppresses
// pinch zoom (Linux Chromium synthesizes pinch as ctrl+wheel pixel deltas and
// the "recently scrolled" flag stays true). Lyceum's reader needs pinch zoom,
// so this feature owns ctrl/meta+wheel at capture time — before the stock
// handler can swallow it — and drives the same public updateZoom() API the
// stock handler uses, preserving cursor-anchored zooming and scale smoothing.
//
// PDF.js's _accumulateFactor/_accumulateTicks keep a per-prop residual on the
// app object. The stock viewer initializes only its own props ("_wheelUnused*",
// "_touchUnused*"); a custom prop starts as `undefined` and produces NaN in
// _accumulateFactor on the very first gesture, silently killing pinch zoom.
// Lyceum seeds and resets its own props and guards every computed value.
const FACTOR_KEY = "_lyceumWheelUnusedFactor";
const TICKS_KEY = "_lyceumWheelUnusedTicks";
const PIXELS_PER_LINE_SCALE = 30;

function seedAccumulators(app) {
  if (!app) {
    return;
  }
  if (typeof app[FACTOR_KEY] !== "number" || !Number.isFinite(app[FACTOR_KEY])) {
    app[FACTOR_KEY] = 1;
  }
  if (typeof app[TICKS_KEY] !== "number" || !Number.isFinite(app[TICKS_KEY])) {
    app[TICKS_KEY] = 0;
  }
}

export function installZoomFeature({ facade }) {
  // The application is a long-lived singleton across documents; a fresh
  // document must not inherit a leftover zoom residual from the previous one.
  // eventBus only exists after the viewer boots, so wire the reset there.
  onViewerBooted(app => {
    app?.eventBus?.on?.("documentloaded", () => seedAccumulators(facade.getApp?.()));
    seedAccumulators(app);
  });

  window.addEventListener(
    "wheel",
    event => {
      if (!event.ctrlKey && !event.metaKey) {
        return;
      }

      const app = facade.getApp?.();
      if (!app?.pdfViewer || typeof app.updateZoom !== "function") {
        return;
      }
      if (app.pdfViewer.isInPresentationMode) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      seedAccumulators(app);

      const { deltaX, deltaY, deltaMode } = event;
      const origin = [event.clientX, event.clientY];
      const scaleFactor = Math.exp(-deltaY / 100);
      const isPinch =
        deltaMode === WheelEvent.DOM_DELTA_PIXEL &&
        deltaX === 0 &&
        Math.abs(scaleFactor - 1) < 0.05;

      if (isPinch) {
        const factor =
          typeof app._accumulateFactor === "function"
            ? app._accumulateFactor(app.pdfViewer.currentScale, scaleFactor, FACTOR_KEY)
            : scaleFactor;
        const resolvedFactor = Number.isFinite(factor) && factor !== 1 ? factor : scaleFactor;
        if (resolvedFactor !== 1) {
          app.updateZoom(null, resolvedFactor, origin);
        }
        return;
      }

      // Mirror the stock viewer's direction convention (negative = scroll
      // down/right) so ctrl+wheel mouse zoom behaves exactly like the native
      // viewer instead of being inverted.
      const hypot = Math.hypot(deltaX, deltaY);
      const angle = Math.atan2(deltaY, deltaX);
      const delta = -0.25 * Math.PI < angle && angle < 0.75 * Math.PI ? -hypot : hypot;
      let ticks = 0;
      if (deltaMode === WheelEvent.DOM_DELTA_LINE || deltaMode === WheelEvent.DOM_DELTA_PAGE) {
        ticks = Math.abs(delta) >= 1
          ? Math.sign(delta)
          : typeof app._accumulateTicks === "function"
            ? app._accumulateTicks(delta, TICKS_KEY)
            : delta;
      } else if (typeof app._accumulateTicks === "function") {
        ticks = app._accumulateTicks(delta / PIXELS_PER_LINE_SCALE, TICKS_KEY);
      } else {
        ticks = delta / PIXELS_PER_LINE_SCALE;
      }

      const resolvedTicks = Number.isFinite(ticks) && ticks !== 0 ? ticks : 0;
      if (resolvedTicks !== 0) {
        app.updateZoom(resolvedTicks, null, origin);
      }
    },
    { passive: false, capture: true },
  );
}