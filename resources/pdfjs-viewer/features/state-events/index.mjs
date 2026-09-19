// Reports viewer state and document readiness upward, debounced. The host uses
// these events both to persist the reading position and to know when to restore.
import { EVT_DOCUMENT_READY, EVT_STATE_CHANGED } from "../../lyceum-core.mjs";

export function installStateEventsFeature({ bus, facade, app }) {
  if (!app?.eventBus || app.__lyceumStateEventsInstalled) {
    return;
  }
  app.__lyceumStateEventsInstalled = true;

  let timer = null;
  const sendState = () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const state = await facade.getState();
      if (state) {
        bus.emit(EVT_STATE_CHANGED, { state });
      }
    }, 200);
  };

  app.eventBus.on("pagechanging", sendState);
  app.eventBus.on("scalechanging", sendState);
  app.eventBus.on("updateviewarea", sendState);

  let announcedDocument = false;
  const announceDocument = () => {
    if (!app.pdfDocument || !(app.pdfViewer?.pagesCount > 0)) {
      return;
    }
    if (!announcedDocument) {
      announcedDocument = true;
      bus.emit(EVT_DOCUMENT_READY);
    }
    sendState();
  };

  app.eventBus.on("pagesinit", announceDocument);
  app.eventBus.on("documentloaded", announceDocument);
  announceDocument();
}