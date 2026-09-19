// App lifecycle: options that must exist before PDF.js initializes, plus a
// small guard that runs our overlay once the viewer is reachable.
export function configureBeforeRun() {
  const options = globalThis.PDFViewerApplicationOptions;
  if (!options) {
    return;
  }

  options.set("disablePreferences", true);
  options.set("disableHistory", true);
  options.set("historyUpdateUrl", false);
  // Lyceum owns the persisted position. PDF.js must not restore a competing
  // ViewHistory position after the user or Lyceum navigates.
  options.set("viewOnLoad", 1); // ViewOnLoad.INITIAL in PDF.js 4.10.
}

export function onViewerBooted(callback) {
  const app = globalThis.PDFViewerApplication ?? null;
  app?.initializedPromise?.then(callback).catch(() => {});
}