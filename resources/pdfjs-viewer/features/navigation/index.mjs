// Navigation + restore policy. React drives the viewer through commands only;
// this feature owns the "user navigation wins over queued restore" order both
// for the message channel and for PDF.js's own ViewHistory.
import { createNavigationGuard, isNavigateState, CMD_NAVIGATE, CMD_RESTORE, CMD_GET_STATE, EVT_STATE_CHANGED, EVT_RESTORE_COMPLETE } from "../../lyceum-core.mjs";

export function installNavigationFeature({ bus, facade }) {
  const guard = createNavigationGuard();
  let pendingHandlerAttached = false;

  function attachPendingFlush() {
    if (pendingHandlerAttached) {
      return;
    }
    const app = facade.getApp();
    if (!app?.eventBus?.on) {
      return;
    }

    pendingHandlerAttached = true;
    app.eventBus.on("documentloaded", () => {
      pendingHandlerAttached = false;
      const intent = guard.consumePending();
      return intent ? applyState(intent.state, intent.mode) : undefined;
    });
  }

  async function applyState(state, mode) {
    const app = await facade.whenDocumentReady();
    const documentReady = Boolean(app);
    const decision = guard.decide(mode, documentReady);

    if (decision.kind === "defer") {
      // Document not ready yet: queue and apply once it has loaded.
      guard.wait(state, mode);
      attachPendingFlush();
      return;
    }

    let currentState = null;
    if (decision.kind === "skip") {
      // Reader navigated on its own; keep the reported state consistent.
      currentState = await facade.getState();
    } else {
      await facade.applyPageAndScroll(app, state);
      currentState = await facade.getState();
    }

    if (currentState) {
      bus.emit(EVT_STATE_CHANGED, { state: currentState });
    }
    bus.emit(EVT_RESTORE_COMPLETE, { state: currentState });
  }

  bus.onCommand(CMD_NAVIGATE, data => {
    if (!isNavigateState(data)) {
      return;
    }
    void applyState({ page: data.page, currentScale: data.currentScale, scrollTop: data.scrollTop }, "navigate");
  });

  bus.onCommand(CMD_RESTORE, data => {
    if (!isNavigateState(data)) {
      return;
    }
    void applyState({ page: data.page, currentScale: data.currentScale, scrollTop: data.scrollTop }, "restore");
  });

  bus.onCommand(CMD_GET_STATE, async () => {
    const state = await facade.getState();
    if (state) {
      bus.emit(EVT_STATE_CHANGED, { state });
    }
  });

  return {
    applyState: (state, { restore = false } = {}) => applyState(state, restore ? "restore" : "navigate"),
    guard,
  };
}