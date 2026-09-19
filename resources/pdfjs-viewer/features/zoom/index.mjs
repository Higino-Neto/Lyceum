import { onViewerBooted } from "../../core/lifecycle.mjs";

// Chromium reports a touchpad pinch as a Ctrl+wheel event even though the
// Control key is not held. Distinguish that synthetic modifier from a real
// Ctrl+mouse-wheel gesture before asking PDF.js to zoom.
const FACTOR_KEY = "_lyceumWheelUnusedFactor";
const WHEEL_FACTOR = 1.1;
const heldModifiers = new Set();
let activeZoomListener = null;
let activeKeyDownListener = null;
let activeKeyUpListener = null;
let activeBlurListener = null;
let anchorGeneration = 0;

function seedAccumulator(app) {
  if (app && (!Number.isFinite(app[FACTOR_KEY]) || app[FACTOR_KEY] <= 0)) {
    app[FACTOR_KEY] = 1;
  }
}

function isLikelyMouseWheel(event) {
  if (event.deltaMode !== WheelEvent.DOM_DELTA_PIXEL) return true;
  // Chromium on Linux also reports a clicky wheel in pixel mode, typically
  // near 100px per notch. Prefer its legacy wheelDelta when available so a
  // fast two-finger swipe is not mistaken for a clicky wheel.
  const delta = Math.abs(event.deltaY);
  const legacyDelta = Math.abs(Number(event.wheelDeltaY) || 0);
  if (legacyDelta > 0) return delta >= 70 && legacyDelta >= 120 && legacyDelta % 120 === 0;
  return [100, 120].some(step => delta >= step && Math.abs(delta / step - Math.round(delta / step)) < 0.02);
}

function getPageAnchor(app, origin) {
  const viewer = app.pdfViewer;
  const container = viewer?.container ?? document.getElementById("viewerContainer");
  const pageNumber = viewer?.currentPageNumber;
  if (!container || !Number.isInteger(pageNumber) || pageNumber < 1) return null;
  const page = viewer?.getPageView?.(pageNumber - 1)?.div ??
    document.querySelector(`.page[data-page-number="${pageNumber}"]`);
  if (!page) return null;
  const rect = page.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  const x = Math.max(rect.left + 1, Math.min(rect.right - 1, origin[0]));
  const y = Math.max(rect.top + 1, Math.min(rect.bottom - 1, origin[1]));
  return {
    container, page, pageNumber,
    x, y,
    ratioX: (x - rect.left) / rect.width,
    ratioY: (y - rect.top) / rect.height,
  };
}

function restorePageAnchor(anchor, viewer) {
  if (!anchor.page.isConnected) return;
  const rect = anchor.page.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;
  anchor.container.scrollLeft += rect.left + rect.width * anchor.ratioX - anchor.x;
  anchor.container.scrollTop += rect.top + rect.height * anchor.ratioY - anchor.y;
  viewer.update?.();
  // PDF.js may have selected another page before the scroll correction. Keep
  // the page that was active when the user began the zoom gesture.
  if (viewer.currentPageNumber !== anchor.pageNumber) {
    viewer._setCurrentPageNumber?.(anchor.pageNumber);
  }
}

function zoomKeepingPage(app, factor, origin) {
  const anchor = getPageAnchor(app, origin);
  const generation = ++anchorGeneration;
  app.updateZoom(null, factor, origin);
  if (!anchor) return;
  restorePageAnchor(anchor, app.pdfViewer);
  requestAnimationFrame(() => {
    if (generation === anchorGeneration) restorePageAnchor(anchor, app.pdfViewer);
  });
}

export function installZoomFeature({ facade }) {
  anchorGeneration += 1;
  if (activeZoomListener) window.removeEventListener("wheel", activeZoomListener, true);
  if (activeKeyDownListener) window.removeEventListener("keydown", activeKeyDownListener, true);
  if (activeKeyUpListener) window.removeEventListener("keyup", activeKeyUpListener, true);
  if (activeBlurListener) window.removeEventListener("blur", activeBlurListener, true);
  heldModifiers.clear();

  activeKeyDownListener = event => {
    if (event.key === "Control" || event.key === "Meta") heldModifiers.add(event.key);
  };
  activeKeyUpListener = event => {
    if (event.key === "Control" || event.key === "Meta") heldModifiers.delete(event.key);
  };
  activeBlurListener = () => heldModifiers.clear();
  window.addEventListener("keydown", activeKeyDownListener, true);
  window.addEventListener("keyup", activeKeyUpListener, true);
  window.addEventListener("blur", activeBlurListener, true);

  onViewerBooted(app => {
    app?.eventBus?.on?.("documentloaded", () => {
      const current = facade.getApp?.();
      if (current) current[FACTOR_KEY] = 1;
    });
    seedAccumulator(facade.getApp?.());
  });

  activeZoomListener = event => {
    if (!event.ctrlKey && !event.metaKey) return;
    const app = facade.getApp?.();
    if (!app?.pdfViewer || typeof app.updateZoom !== "function" || app.pdfViewer.isInPresentationMode) return;

    const physicallyHeld = heldModifiers.size > 0;
    const mouseWheel = isLikelyMouseWheel(event);
    const pinch = event.ctrlKey && !physicallyHeld && !mouseWheel &&
      event.deltaMode === WheelEvent.DOM_DELTA_PIXEL && event.deltaX === 0 && event.deltaZ === 0;

    event.preventDefault();
    event.stopImmediatePropagation();
    const origin = [event.clientX, event.clientY];

    if (pinch) {
      seedAccumulator(app);
      // A missed keydown must never turn one large wheel event into a huge
      // scale jump. Ordinary pinch deltas are much smaller than this bound.
      const scaleFactor = Math.exp(-Math.max(-12, Math.min(12, event.deltaY)) / 100);
      const factor = typeof app._accumulateFactor === "function"
        ? app._accumulateFactor(app.pdfViewer.currentScale, scaleFactor, FACTOR_KEY)
        : scaleFactor;
      if (Number.isFinite(factor) && factor > 0 && factor !== 1) {
        zoomKeepingPage(app, factor, origin);
      }
      return;
    }

    if (physicallyHeld && !mouseWheel) {
      // Ctrl plus a two-finger swipe is neither a zoom command nor navigation.
      return;
    }

    if (event.deltaY !== 0) {
      // One wheel notch is one 10% step, irrespective of its raw pixel delta.
      zoomKeepingPage(app, event.deltaY < 0 ? WHEEL_FACTOR : 1 / WHEEL_FACTOR, origin);
    }
  };
  window.addEventListener("wheel", activeZoomListener, { passive: false, capture: true });
}
