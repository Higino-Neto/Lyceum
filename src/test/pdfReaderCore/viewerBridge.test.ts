import { describe, expect, it, vi } from "vitest";
import { createBus } from "../../../resources/pdfjs-viewer/core/bus.mjs";
import { createStateStore } from "../../../resources/pdfjs-viewer/core/state.mjs";
import { installNavigationFeature } from "../../../resources/pdfjs-viewer/features/navigation/index.mjs";
import { installOutlineFeature } from "../../../resources/pdfjs-viewer/features/outline/index.mjs";
import { installStateEventsFeature } from "../../../resources/pdfjs-viewer/features/state-events/index.mjs";
import { CMD_GET_OUTLINE, CMD_NAVIGATE, EVT_OUTLINE_LOADED, EVT_RESTORE_COMPLETE, EVT_STATE_CHANGED } from "../../core/pdf-reader-core/contract";

describe("createBus", () => {
  it("posts events with type and payload", () => {
    const posted = [];
    const bus = createBus({ post: (type, payload) => posted.push({ type, payload }) });
    bus.emit("lyceum-pdfjs:test", { value: 1 });
    expect(posted).toEqual([{ type: "lyceum-pdfjs:test", payload: { value: 1 } }]);
  });

  it("delivers events to local listeners", () => {
    const bus = createBus({ post: () => {} });
    const listener = vi.fn();
    bus.onEvent("lyceum-pdfjs:test", listener);
    bus.emit("lyceum-pdfjs:test", { value: 2 });
    expect(listener).toHaveBeenCalledWith({ value: 2 });
  });

  it("dispatches parent messages to command handlers", () => {
    const bus = createBus({ post: () => {}, matchesParent: () => true });
    const handler = vi.fn();
    bus.onCommand(CMD_NAVIGATE, handler);
    bus.handleParentMessage({ data: { version: 1, type: CMD_NAVIGATE, page: 3 } });
    expect(handler).toHaveBeenCalledWith({ version: 1, type: CMD_NAVIGATE, page: 3 });
  });

  it("ignores unknown types and foreign messages", () => {
    const bus = createBus({ post: () => {}, matchesParent: () => true });
    const handler = vi.fn();
    bus.onCommand(CMD_NAVIGATE, handler);
    bus.handleParentMessage({ data: { version: 1, type: "nope" } });
    expect(handler).not.toHaveBeenCalled();
  });

  it("throws when emitting without a transport", () => {
    const bus = createBus();
    expect(() => bus.emit("lyceum-pdfjs:test")).toThrow(/post transport/);
  });
});

describe("navigation feature", () => {
  it("defers a navigate until the document is ready, then applies it", async () => {
    const posted = [];
    let documentReady = false;
    let flushed = null;
    let applied = null;

    const app = {
      eventBus: {
        on: (event, callback) => {
          if (event === "documentloaded") flushed = callback;
        },
      },
    };
    const facade = {
      getApp: () => app,
      whenDocumentReady: async () => (documentReady ? app : null),
      applyPageAndScroll: async (_readyApp, state) => {
        applied = state.page;
        return state.page;
      },
      getState: async () => ({ page: applied ?? 1, currentScale: 1, scrollTop: 0, totalPages: 1, canAccess: true }),
    };

    const bus = createBus({ post: (type, payload) => posted.push({ type, payload }), matchesParent: () => true });
    installNavigationFeature({ bus, facade });

    bus.handleParentMessage({ data: { version: 1, type: CMD_NAVIGATE, page: 5 } });
    await Promise.resolve();
    await Promise.resolve();
    expect(applied).toBeNull();
    expect(posted).toEqual([]);

    documentReady = true;
    expect(flushed).toBeTypeOf("function");
    const result = flushed();
    await result;
    await result;
    expect(applied).toBe(5);
    const types = posted.map(item => item.type);
    expect(types).toContain(EVT_STATE_CHANGED);
    expect(types).toContain(EVT_RESTORE_COMPLETE);
  });

  it("skips a queued task that already lost to a navigation", async () => {
    const posted = [];
    const documentReady = true;
    let applied = null;

    const app = { eventBus: { on: () => {} } };
    const facade = {
      getApp: () => app,
      whenDocumentReady: async () => (documentReady ? app : null),
      applyPageAndScroll: async (_readyApp, state) => {
        applied = state.page;
        return state.page;
      },
      getState: async () => ({ page: applied ?? 1, currentScale: 1, scrollTop: 0, totalPages: 1, canAccess: true }),
    };

    const bus = createBus({ post: (type, payload) => posted.push({ type, payload }), matchesParent: () => true });
    installNavigationFeature({ bus, facade });

    bus.handleParentMessage({ data: { version: 1, type: CMD_NAVIGATE, page: 7 } });
    await Promise.resolve();
    expect(applied).toBe(7);

    posted.length = 0;
    bus.handleParentMessage({ data: { version: 1, type: CMD_NAVIGATE, page: 9 } });
    await Promise.resolve();
    expect(applied).toBe(9);
  });
});

describe("outline feature", () => {
  it("reports the outline as an event on request", async () => {
    const posted = [];
    const bus = createBus({ post: (type, payload) => posted.push({ type, payload }), matchesParent: () => true });
    const facade = {
      getOutline: async () => [{ title: "Cap", page: 2, items: [] }],
    };
    installOutlineFeature({ bus, facade });

    bus.handleParentMessage({ data: { version: 1, type: CMD_GET_OUTLINE, requestId: "r1" } });
    await Promise.resolve();

    const response = posted.find(item => item.type === EVT_OUTLINE_LOADED);
    expect(response.payload).toEqual({ outline: [{ title: "Cap", page: 2, items: [] }], requestId: "r1" });
  });
});

describe("state events feature", () => {
  it("announces a ready document once and emits state afterwards", async () => {
    vi.useFakeTimers();
    const posted = [];
    const bus = createBus({ post: (type, payload) => posted.push({ type, payload }) });
    const events: Record<string, (event: unknown) => void> = {};
    const app = {
      pdfDocument: {},
      pdfViewer: { pagesCount: 3 },
      eventBus: {
        on: (event, callback) => {
          events[event] = callback;
        },
      },
    };
    const facade = {
      getState: async () => ({ page: 1, currentScale: 1, scrollTop: 0, totalPages: 3, canAccess: true }),
    };
    installStateEventsFeature({ bus, facade, app });

    events.pagesinit("evt");
    events.pagesinit("evt");
    events.documentloaded("evt");
    vi.runAllTimers();
    await Promise.resolve();
    await Promise.resolve();

    const ready = posted.filter(item => item.type === "lyceum-pdfjs:document-ready");
    expect(ready).toHaveLength(1);
    const states = posted.filter(item => item.type === EVT_STATE_CHANGED);
    expect(states.length).toBeGreaterThanOrEqual(1);
    vi.useRealTimers();
  });
});

describe("shared state store", () => {
  it("stores and clears values", () => {
    const state = createStateStore({ seed: 1 });
    expect(state.get("seed")).toBe(1);
    state.set("customSelection", { anchor: 1 });
    state.update({ extra: true });
    expect(state.get("customSelection")).toEqual({ anchor: 1 });
    expect(state.get("extra")).toBe(true);
    state.clear();
    expect(state.get("seed")).toBeUndefined();
  });
});