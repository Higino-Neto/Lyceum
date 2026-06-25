const params = new URLSearchParams(window.location.search);
const title = params.get("title")?.trim() || "";

function getApp() {
  return globalThis.PDFViewerApplication ?? null;
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

function applyLyceumTitle() {
  if (title) {
    document.title = `${title} - PDF.js`;
  }
}

function configureBeforeRun() {
  const options = globalThis.PDFViewerApplicationOptions;
  if (!options) {
    return;
  }

  options.set("disablePreferences", true);
  options.set("disableHistory", true);
  options.set("historyUpdateUrl", false);
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

async function applyState(state) {
  const app = await whenReady();
  if (!app || !state) {
    return null;
  }

  const viewer = app.pdfViewer;
  const container = getViewerContainer(app);

  if (Number.isFinite(state.page) && state.page > 0) {
    app.page = Math.round(state.page);
  }

  if (viewer && Number.isFinite(state.currentScale) && state.currentScale > 0) {
    viewer.currentScaleValue = String(state.currentScale);
  }

  if (container && Number.isFinite(state.scrollTop) && state.scrollTop >= 0) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    container.scrollTop = state.scrollTop;
    await new Promise((resolve) => setTimeout(resolve, 50));
    container.scrollTop = state.scrollTop;
  }

  return getState();
}

globalThis.LyceumPdfJs = {
  applyState,
  getState,
};

document.addEventListener(
  "webviewerloaded",
  () => {
    configureBeforeRun();
    applyLyceumTitle();

    const app = getApp();
    app?.initializedPromise?.then(() => {
      applyLyceumTitle();
      app.eventBus?._on?.("documentloaded", applyLyceumTitle);
    });
  },
  true,
);
