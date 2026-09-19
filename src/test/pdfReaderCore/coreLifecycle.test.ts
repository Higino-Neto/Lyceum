import { afterEach, describe, expect, it } from "vitest";
import { onViewerBooted } from "../../../resources/pdfjs-viewer/core/lifecycle.mjs";

// PDF.js 4.10.38 resolves PDFViewerApplication.initializedPromise with *no
// value* (viewer.mjs "this._initializedCapability.resolve();"). The overlay's
// boot hook therefore must hand the app to its callback itself; otherwise
// every boot-wired feature (state events, zoom re-seed, annotations, toolbar
// eventBus listeners) silently receives `undefined` and never activates.
// That was the root cause behind both "chapters never load" and "zoom broke".
describe("onViewerBooted", () => {
  afterEach(() => {
    delete globalThis.PDFViewerApplication;
  });

  it("hands the resolved app object to the callback", async () => {
    const app = {
      initializedPromise: Promise.resolve(), // resolves with undefined, like stock
      eventBus: { on: () => {} },
    };
    globalThis.PDFViewerApplication = app as never;

    let received: unknown = "never-called";
    onViewerBooted(value => {
      received = value;
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(received).toBe(app);
  });

  it("invokes the callback once the capability settles, even though it resolves undefined", async () => {
    globalThis.PDFViewerApplication = {
      initializedPromise: Promise.resolve(),
    } as never;

    let boots = 0;
    onViewerBooted(() => {
      boots++;
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(boots).toBe(1);
  });

  it("does not run the callback when the viewer never boots", async () => {
    delete globalThis.PDFViewerApplication;

    let boots = 0;
    onViewerBooted(() => {
      boots++;
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(boots).toBe(0);
  });
});
