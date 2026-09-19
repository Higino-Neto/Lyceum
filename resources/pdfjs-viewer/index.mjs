// Overlay entry point for the vendored PDF.js viewer. Boots after the base
// viewer sets its options, installs every Lyceum feature against the shared
// bus + facade, and exposes a minimal diagnostics surface (kept for the
// Electron smoke test; the UI itself only uses the postMessage channel).
import { postToParent } from "./lyceum-messaging.mjs";
import { configureBeforeRun, onViewerBooted } from "./core/lifecycle.mjs";
import { createBus } from "./core/bus.mjs";
import { createStateStore } from "./core/state.mjs";
import { createViewerFacade } from "./core/viewer-facade.mjs";
import { installToolbarFeature } from "./features/toolbar/index.mjs";
import { installSelectionFeature } from "./features/selection/index.mjs";
import { installAnnotationsFeature } from "./features/annotations/index.mjs";
import { installNavigationFeature } from "./features/navigation/index.mjs";
import { installOutlineFeature } from "./features/outline/index.mjs";
import { installZoomFeature } from "./features/zoom/index.mjs";
import { installStateEventsFeature } from "./features/state-events/index.mjs";

const params = new URLSearchParams(window.location.search);
const title = params.get("title")?.trim() || "";

const fac = createViewerFacade({ getApp: () => globalThis.PDFViewerApplication ?? null });
const state = createStateStore();
const bus = createBus({ post: postToParent });

window.addEventListener("message", event => bus.handleParentMessage(event));

document.addEventListener(
  "webviewerloaded",
  () => {
    configureBeforeRun();

    installSelectionFeature({ bus, facade: fac, state });
    const toolbarHandle = installToolbarFeature({ bus, facade: fac, title });
    installAnnotationsFeature({ bus, state });
    const navigationHandle = installNavigationFeature({ bus, facade: fac });
    installOutlineFeature({ bus, facade: fac });
    installZoomFeature({ facade: fac });

    // Diagnostics kept for scripts/smoke-pdfjs-electron.cjs.
    globalThis.LyceumPdfJs = {
      applyState: (viewerState, options) =>
        navigationHandle.applyState(viewerState, options),
      getState: () => fac.getState(),
      getOutline: () => fac.getOutline(),
    };

    onViewerBooted(app => {
      toolbarHandle.onAppReady(app);
      installAnnotationsFeature({ bus, state, app });
      installStateEventsFeature({ bus, facade: fac, app });
    });
  },
  true,
);