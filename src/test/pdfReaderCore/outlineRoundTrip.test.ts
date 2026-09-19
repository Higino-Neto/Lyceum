import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBus } from "../../../resources/pdfjs-viewer/core/bus.mjs";
import { createViewerFacade } from "../../../resources/pdfjs-viewer/core/viewer-facade.mjs";
import { installOutlineFeature } from "../../../resources/pdfjs-viewer/features/outline/index.mjs";
import { CMD_GET_OUTLINE, EVT_OUTLINE_LOADED, PDF_BRIDGE_VERSION, PDF_VIEWER_ORIGIN } from "../../core/pdf-reader-core/contract";
import { parsePdfViewerMessage } from "../../pages/ReadingPage/components/pdf-reader/pdfBridgeProtocol";

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

function collectBus() {
  const posted = [];
  const bus = createBus({
    post: (type, payload) => posted.push({ type, payload }),
    matchesParent: () => true,
  });
  return { bus, posted };
}

function outlinedResponse(posted) {
  const message = posted.find(item => item.type === EVT_OUTLINE_LOADED);
  if (!message) {
    return null;
  }
  const event = {
    source: window,
    origin: "null",
    data: { version: PDF_BRIDGE_VERSION, type: message.type, ...message.payload },
  } as unknown as MessageEvent;
  return { payload: message.payload, parsed: parsePdfViewerMessage(event, window) };
}

describe("outline feature round trip", () => {
  afterEach(() => {
    delete globalThis.PDFViewerApplication;
  });

  it("returns the walked outline through postMessage(tx) -> parse(tx)", async () => {
    const { bus, posted } = collectBus();
    const tree = [
      { title: "Introdução", page: 1, items: [{ title: "Contexto", page: 2, items: [] }] },
      { title: "Anexos", page: null, items: [] },
    ];
    const facade = {
      getApp: () => null,
      getOutline: async () => tree,
    };
    installOutlineFeature({ bus, facade });

    bus.handleParentMessage({ data: { version: 1, type: CMD_GET_OUTLINE, requestId: "cap-1" } });
    await flush();

    const result = outlinedResponse(posted);
    expect(result).not.toBeNull();
    expect(result.payload.outline).toEqual(tree);
    expect(result.payload.requestId).toBe("cap-1");
    expect(result.payload.error).toBeUndefined();
    if (result?.parsed.type !== EVT_OUTLINE_LOADED) {
      throw new Error("expected an outline-loaded event");
    }
    expect(result.parsed.outline).toEqual(tree);
  });

  it("answers an empty outline immediately for a loaded document without bookmarks", async () => {
    const { bus, posted } = collectBus();
    const facade = {
      getApp: () => ({ pdfDocument: {}, pdfViewer: { pagesCount: 12 } }),
      readPageCount: () => 12,
      getOutline: async () => [],
    };
    installOutlineFeature({ bus, facade });

    bus.handleParentMessage({ data: { version: 1, type: CMD_GET_OUTLINE, requestId: "cap-empty" } });
    await flush();

    const result = outlinedResponse(posted);
    expect(result).not.toBeNull();
    expect(result.payload).toEqual({ outline: [], requestId: "cap-empty" });
    if (result?.parsed.type !== EVT_OUTLINE_LOADED) {
      throw new Error("expected an outline-loaded event");
    }
    expect(result.parsed.outline).toEqual([]);
    expect(result.parsed.error).toBeUndefined();
  });

  it("waits for outlineloaded when the document is not loaded yet", async () => {
    const { bus, posted } = collectBus();
    const facade = {
      getApp: () => null,
      getOutline: async () => null,
      getOutlineWhenReady: async ({ timeoutMs, signalSeen }) => (
        timeoutMs === 9000 && !signalSeen ? [{ title: "Capítulo 1", page: 3, items: [] }] : []
      ),
    };
    installOutlineFeature({ bus, facade });

    bus.handleParentMessage({ data: { version: 1, type: CMD_GET_OUTLINE, requestId: "cap-wait" } });
    await flush();
    await flush();

    const result = outlinedResponse(posted);
    expect(result).not.toBeNull();
    expect(result.payload.outline).toEqual([{ title: "Capítulo 1", page: 3, items: [] }]);
  });

  it("retries when an outlineloaded signal contradicts an empty read", async () => {
    const { bus, posted } = collectBus();
    const events: Record<string, (value: unknown) => void> = {};
    const app = {
      pdfDocument: {},
      pdfViewer: { pagesCount: 8 },
      eventBus: {
        on: (event, callback) => {
          events[event] = callback;
        },
        off: () => {},
      },
    };
    let release;
    const gate = new Promise(resolve => {
      release = resolve;
    });
    const facade = {
      getApp: () => app,
      readPageCount: () => 8,
      getOutline: async () => {
        await gate;
        return [];
      },
      getOutlineWhenReady: async ({ signalSeen }) => (
        signalSeen ? [{ title: "Recuperado", page: 4, items: [] }] : []
      ),
    };
    installOutlineFeature({ bus, facade });

    bus.handleParentMessage({ data: { version: 1, type: CMD_GET_OUTLINE, requestId: "cap-retry" } });
    await flush();
    // While the read is still pending, the viewer signals that an outline exists.
    events.outlineloaded({ outlineCount: 1 });
    release();
    await flush();
    await flush();

    const result = outlinedResponse(posted);
    expect(result).not.toBeNull();
    expect(result.payload.outline).toEqual([{ title: "Recuperado", page: 4, items: [] }]);
  });

  it("reports an error channel when the read itself throws", async () => {
    const { bus, posted } = collectBus();
    const facade = {
      getApp: () => null,
      getOutline: async () => {
        throw new Error("getOutline boom");
      },
    };
    installOutlineFeature({ bus, facade });

    bus.handleParentMessage({ data: { version: 1, type: CMD_GET_OUTLINE, requestId: "cap-err" } });
    await flush();

    const result = outlinedResponse(posted);
    expect(result).not.toBeNull();
    expect(result.payload.outline).toEqual([]);
    expect(result.payload.error).toBe(true);
    expect(result.payload.message).toBeTypeOf("string");
    if (result?.parsed.type !== EVT_OUTLINE_LOADED) {
      throw new Error("expected an outline-loaded event");
    }
    expect(result.parsed.outline).toEqual([]);
    expect(result.parsed.error).toBe(true);
  });

  it("recovers from the rendered OutlineView when the direct read stays empty", async () => {
    const { bus, posted } = collectBus();
    const events: Record<string, (value: unknown) => void> = {};
    const app = {
      pdfDocument: {},
      pdfViewer: { pagesCount: 40 },
      eventBus: {
        on: (event, callback) => {
          events[event] = callback;
        },
        off: () => {},
      },
    };
    let release;
    const gate = new Promise(resolve => {
      release = resolve;
    });
    const facade = {
      getApp: () => app,
      readPageCount: () => 40,
      getOutline: async () => {
        await gate;
        return [];
      },
      getOutlineWhenReady: async () => [],
      getOutlineFromOutlineView: async () => [
        { title: "Rendido", page: 9, items: [{ title: "Sub", page: 10, items: [] }] },
      ],
    };
    installOutlineFeature({ bus, facade });

    bus.handleParentMessage({ data: { version: 1, type: CMD_GET_OUTLINE, requestId: "cap-fallback" } });
    await flush();
    // The viewer renders an outline while the direct read is (still) empty.
    events.outlineloaded({ outlineCount: 1 });
    release();
    await flush();
    await flush();

    const result = outlinedResponse(posted);
    expect(result).not.toBeNull();
    expect(result.payload.outline).toEqual([
      { title: "Rendido", page: 9, items: [{ title: "Sub", page: 10, items: [] }] },
    ]);
  });

  it("recovers chapters when outlineloaded fired before CMD_GET_OUTLINE arrived", async () => {
    // Regression: a fast-rendering book signals its outline before the host
    // asks for it. The signal state is wired at boot, so the command handler
    // must still accept it and fall back to the rendered OutlineView instead of
    // answering "no chapters".
    const { bus, posted } = collectBus();
    const events: Record<string, () => void> = {};
    const app = {
      pdfDocument: {},
      pdfViewer: { pagesCount: 30 },
      eventBus: {
        on: (event, callback) => {
          events[event] = callback;
        },
        off: () => {},
      },
    };
    globalThis.PDFViewerApplication = {
      initializedPromise: Promise.resolve(),
      eventBus: app.eventBus,
    } as never;
    const facade = {
      getApp: () => app,
      readPageCount: () => 30,
      getOutline: async () => [],
      getOutlineWhenReady: async () => [],
      getOutlineFromOutlineView: async () => [
        { title: "Aviso", page: 2, items: [] },
        { title: "Fim", page: 30, items: [] },
      ],
    };
    installOutlineFeature({ bus, facade });

    await flush();
    // The viewer rendered the outline before the host asked for it.
    expect(events.outlineloaded).toBeTypeOf("function");
    events.outlineloaded();

    bus.handleParentMessage({ data: { version: 1, type: CMD_GET_OUTLINE, requestId: "cap-early" } });
    await flush();
    await flush();

    const result = outlinedResponse(posted);
    expect(result).not.toBeNull();
    expect(result.payload.outline).toEqual([
      { title: "Aviso", page: 2, items: [] },
      { title: "Fim", page: 30, items: [] },
    ]);
    delete globalThis.PDFViewerApplication;
  });

  it("answers an empty outline immediately once the viewer reported count 0", async () => {
    // Regression: outlineloaded fires for every document, with outlineCount 0
    // for books without bookmarks. That observation is authoritative and must
    // short-circuit the retry/wait dance.
    const { bus, posted } = collectBus();
    const events: Record<string, () => void> = {};
    const app = {
      pdfDocument: {},
      pdfViewer: { pagesCount: 12 },
      eventBus: {
        on: (event, callback) => {
          events[event] = callback;
        },
        off: () => {},
      },
    };
    globalThis.PDFViewerApplication = {
      initializedPromise: Promise.resolve(),
      eventBus: app.eventBus,
    } as never;
    const waitWhenReady = vi.fn(async () => []);
    const facade = {
      getApp: () => app,
      readPageCount: () => 12,
      getOutline: async () => [],
      getOutlineWhenReady: waitWhenReady,
    };
    installOutlineFeature({ bus, facade });

    await flush();
    events.outlineloaded();

    bus.handleParentMessage({ data: { version: 1, type: CMD_GET_OUTLINE, requestId: "cap-count0" } });
    await flush();

    const result = outlinedResponse(posted);
    expect(result).not.toBeNull();
    expect(result.payload.outline).toEqual([]);
    expect(waitWhenReady).not.toHaveBeenCalled();
    delete globalThis.PDFViewerApplication;
  });
});

describe("viewer facade getOutlineWhenReady", () => {
  beforeEach(() => {
    globalThis.PDFViewerApplication = {
      initializedPromise: Promise.resolve(),
      pdfViewer: {},
    };
  });

  afterEach(() => {
    delete globalThis.PDFViewerApplication;
  });

  it("resolves once outlineloaded fires and the outline is re-read", async () => {
    const events: Record<string, (value: unknown) => void> = {};
    let outlineValue = null;
    globalThis.PDFViewerApplication.eventBus = {
      on: (event, callback) => {
        events[event] = callback;
      },
      off: (event, callback) => {
        if (events[event] === callback) {
          delete events[event];
        }
      },
    };
    globalThis.PDFViewerApplication.pdfDocument = {
      getOutline: async () => outlineValue,
    };

    const facade = createViewerFacade();
    const pending = facade.getOutlineWhenReady({ timeoutMs: 1000 });
    await flush();

    outlineValue = [{ title: "Tardio", dest: [4], items: [] }];
    events.outlineloaded({ outlineCount: 1 });

    await expect(pending).resolves.toEqual([{ title: "Tardio", page: 5, items: [] }]);
  });

  it("walks an outline rendered by the OutlineView widget as a fallback source", async () => {
    globalThis.PDFViewerApplication.pdfDocument = {
      getOutline: async () => null,
    };
    globalThis.PDFViewerApplication.pdfOutlineViewer = {
      _outline: [
        { title: "Capítulo A", dest: [2], items: [{ title: "Seção 1", dest: "named-1", items: [] }] },
      ],
    };
    globalThis.PDFViewerApplication.pdfDocument.getDestination = async () => [5];

    const facade = createViewerFacade();
    await expect(facade.getOutlineFromOutlineView(globalThis.PDFViewerApplication)).resolves
      .toEqual([
        { title: "Capítulo A", page: 3, items: [{ title: "Seção 1", page: 6, items: [] }] },
      ]);
  });

  it("returns null when the OutlineView never rendered an outline", async () => {
    globalThis.PDFViewerApplication.pdfDocument = { getOutline: async () => null };

    const facade = createViewerFacade();
    await expect(facade.getOutlineFromOutlineView(globalThis.PDFViewerApplication)).resolves
      .toBeNull();
  });

  it("times out to an empty result when the outline never signals", async () => {
    globalThis.PDFViewerApplication.eventBus = {
      on: () => {},
      off: () => {},
    };
    globalThis.PDFViewerApplication.pdfDocument = {
      getOutline: async () => null,
    };

    const facade = createViewerFacade();
    const pending = facade.getOutlineWhenReady({ timeoutMs: 30 });
    await new Promise(resolve => setTimeout(resolve, 80));
    await expect(pending).resolves.toEqual([]);
  });

  it("uses the immediate non-empty read without waiting", async () => {
    const on = vi.fn();
    globalThis.PDFViewerApplication.eventBus = { on, off: () => {} };
    globalThis.PDFViewerApplication.pdfDocument = {
      getOutline: async () => [{ title: "Pronto", dest: [1], items: [] }],
    };

    const facade = createViewerFacade();
    await expect(facade.getOutlineWhenReady({ timeoutMs: 1000 })).resolves.toEqual([
      { title: "Pronto", page: 2, items: [] },
    ]);
    expect(on).not.toHaveBeenCalled();
  });
});

describe("bus rejection diagnostics", () => {
  it("keeps the viewer alive and logs a warn when a handler rejects", async () => {
    const warned = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { bus } = collectBus();
    bus.onCommand(CMD_GET_OUTLINE, () => Promise.reject(new Error("handler boom")));

    bus.handleParentMessage({ data: { version: 1, type: CMD_GET_OUTLINE } });
    await flush();

    expect(warned).toHaveBeenCalledWith(
      expect.stringContaining(`command "${CMD_GET_OUTLINE}" rejected`),
      expect.any(Error),
    );
    warned.mockRestore();
  });
});

describe("PDF_VIEWER_ORIGIN cross-check", () => {
  it("accepts the viewer origin constant used by parsePdfViewerMessage", () => {
    expect(PDF_VIEWER_ORIGIN).toBeTypeOf("string");
    expect(PDF_VIEWER_ORIGIN.length).toBeGreaterThan(0);
  });
});