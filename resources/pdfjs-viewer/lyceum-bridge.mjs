const params = new URLSearchParams(window.location.search);
const title = params.get("title")?.trim() || "";

function getApp() {
  return globalThis.PDFViewerApplication ?? null;
}

function getLinkService(app = getApp()) {
  return app?.pdfLinkService ?? null;
}

function getViewerContainer(app = getApp()) {
  return app?.pdfViewer?.container ?? document.getElementById("viewerContainer");
}

function finitePositive(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function finiteNonNegative(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

async function whenReady() {
  const app = getApp();
  if (!app) {
    return null;
  }

  try {
    await app.initializedPromise;
  } catch {
    // PDF.js keeps enough state available for Lyceum to report load failures.
  }

  return app;
}

// Wait until the document is open. `initializedPromise` resolves *before* the
// document is opened, so we must also check `pdfDocument`. This mirrors the
// guard used inside PDF.js's own `pdfLinkService.goToPage`.
async function whenDocumentReady() {
  const app = await whenReady();
  if (!app) {
    return null;
  }

  if (!app.pdfDocument || !(app.pdfViewer?.pagesCount > 0)) {
    return null;
  }

  return app;
}

function applyPageAndScroll(app, state) {
  const linkService = getLinkService(app);
  const viewer = app.pdfViewer;
  const container = getViewerContainer(app);

  if (Number.isFinite(state.page) && state.page > 0) {
    // Replicate the viewer's own "go to page" path exactly.
    if (linkService?.goToPage) {
      linkService.goToPage(Math.round(state.page));
    } else if (viewer?.scrollPageIntoView) {
      viewer.scrollPageIntoView({ pageNumber: Math.round(state.page) });
    } else {
      app.page = Math.round(state.page);
    }
  }

  if (viewer && Number.isFinite(state.currentScale) && state.currentScale > 0) {
    viewer.currentScaleValue = String(state.currentScale);
  }

  if (container && Number.isFinite(state.scrollTop) && state.scrollTop >= 0) {
    requestAnimationFrame(() => {
      container.scrollTop = state.scrollTop;
      requestAnimationFrame(() => {
        container.scrollTop = state.scrollTop;
      });
    });
  }
}

async function getState() {
  const app = await whenReady();
  if (!app) {
    return null;
  }

  const viewer = app.pdfViewer;
  const container = getViewerContainer(app);
  const page = finitePositive(app.page ?? viewer?.currentPageNumber, 1);
  const currentScale = finitePositive(viewer?.currentScale, 1);
  const scrollTop = finiteNonNegative(container?.scrollTop, 0);
  const totalPages = finiteNonNegative(app.pagesCount ?? viewer?.pagesCount, 0);

  return {
    page,
    currentScale,
    scrollTop,
    totalPages,
    canAccess: true,
  };
}

// Tracks whether the reader navigated on its own (e.g. a chapter click) so that
// Lyceum's *restore* (re-applying the saved position) never overrides it.
let userNavigated = false;

// Holds a request that arrived before the document was ready so it can be
// applied as soon as PDF.js finishes opening the file.
let pending = null;
let pendingHandlerAttached = false;

function flushPending() {
  const app = getApp();
  const next = pending;
  pending = null;
  pendingHandlerAttached = false;
  if (app && next) {
    void applyState(next.state, { restore: next.isRestore });
  }
}

async function applyState(state, { restore = false } = {}) {
  const app = await whenDocumentReady();
  if (!app || !state) {
    // Document not ready yet: queue and apply once it has loaded.
    if (state && getApp()) {
      // A real navigation always wins over a queued restore, and a restore is
      // meaningless once the reader has navigated on its own.
      if (!restore) {
        userNavigated = true;
      }
      if (!restore || !userNavigated) {
        pending = { state, isRestore: restore };
      }
      if (!pendingHandlerAttached) {
        pendingHandlerAttached = true;
        getApp().eventBus._on?.("documentloaded", flushPending);
      }
    }
    return null;
  }

  // Once the reader has navigated on its own, a restore must not clobber it
  // (this also guards against a late iframe `onLoad` firing after a click).
  if (restore && userNavigated) {
    return getState();
  }

  if (!restore) {
    userNavigated = true;
  }

  pending = null;
  pendingHandlerAttached = false;

  applyPageAndScroll(app, state);

  return getState();
}

globalThis.LyceumPdfJs = {
  applyState,
  getState,
};

function applyLyceumTitle() {
  if (title) {
    document.title = `${title} - PDF.js`;
  }
}

// Wrap PDF.js's `setInitialView` so the *late* re-apply of the stored view
// (viewer.mjs:13992, for PDFs with unequal page sizes, firing on `pagesloaded`)
// is skipped once the reader has navigated on its own. This keeps PDF.js's
// "remember last page" memory (re-enabled via the default `viewOnLoad`) while
// preventing the chapter-click snap-back. The first `setInitialView` (which
// restores the saved page on reopen) still runs because `userNavigated` is
// false at that point.
function wrapSetInitialView() {
  const app = getApp();
  if (!app || typeof app.setInitialView !== "function" || app.__lyceumSetInitialViewWrapped) {
    return;
  }
  const original = app.setInitialView.bind(app);
  app.__lyceumSetInitialViewWrapped = true;
  app.setInitialView = function (hash, options) {
    if (userNavigated) {
      return;
    }
    return original(hash, options);
  };
}

function configureBeforeRun() {
  const options = globalThis.PDFViewerApplicationOptions;
  if (!options) {
    return;
  }

  options.set("disablePreferences", true);
  options.set("disableHistory", true);
  options.set("historyUpdateUrl", false);
  // Keep PDF.js's own "remember last page" (ViewHistory/`viewOnLoad` defaults to
  // STORED), so reopening a book restores the saved page. The chapter-click
  // snap-back that this previously caused is prevented by `wrapSetInitialView`.
}

document.addEventListener(
  "webviewerloaded",
  () => {
    configureBeforeRun();
    wrapSetInitialView();
    applyLyceumTitle();

    const app = getApp();
    app?.initializedPromise?.then(() => {
      applyLyceumTitle();
      app.eventBus?._on?.("documentloaded", applyLyceumTitle);
    });
  },
  true,
);
