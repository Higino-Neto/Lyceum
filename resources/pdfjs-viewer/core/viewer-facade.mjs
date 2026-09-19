// Stable API over the vendored PDF.js application. Features depend on this
// facade (not on PDFViewerApplication internals) so the overlay is resilient to
// upstream viewer changes and easy to fake in tests.
function finitePositive(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function finiteNonNegative(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

export function createViewerFacade({
  getApp = () => globalThis.PDFViewerApplication ?? null,
  documentRef = null,
} = {}) {
  const dom = documentRef ?? globalThis.document ?? null;

  const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

  function getLinkService(app) {
    return app?.pdfLinkService ?? null;
  }

  function getViewerContainer(app) {
    return app?.pdfViewer?.container ?? dom?.getElementById("viewerContainer");
  }

  function readPageCount(app) {
    return finiteNonNegative(app?.pagesCount ?? app?.pdfViewer?.pagesCount, 0);
  }

  function readCurrentPage(app) {
    return finitePositive(app?.page ?? app?.pdfViewer?.currentPageNumber, 1);
  }

  function clampPage(app, page) {
    const rounded = Math.round(finitePositive(page, 1));
    const totalPages = readPageCount(app);
    return totalPages > 0 ? Math.min(Math.max(rounded, 1), totalPages) : Math.max(rounded, 1);
  }

  function getPageElement(page) {
    return dom?.querySelector(`.page[data-page-number="${page}"]`) ?? null;
  }

  async function waitForPageElement(page) {
    for (let attempt = 0; attempt < 18; attempt += 1) {
      const element = getPageElement(page);
      if (element) {
        return element;
      }
      await (attempt < 6 ? nextFrame() : wait(50));
    }
    return null;
  }

  // Wait until the application object exists (and its initialization settled).
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

  // Wait until a document is actually open. `initializedPromise` resolves
  // *before* the document is opened, so we must also check `pdfDocument`. This
  // mirrors the guard used inside PDF.js's own `pdfLinkService.goToPage`.
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

  async function applyScrollTop(container, scrollTop) {
    if (!container || !Number.isFinite(scrollTop) || scrollTop < 0) {
      return;
    }

    await nextFrame();
    container.scrollTop = scrollTop;
    await nextFrame();
    container.scrollTop = scrollTop;
  }

  async function applyPageAndScroll(app, state) {
    const linkService = getLinkService(app);
    const viewer = app.pdfViewer;
    const container = getViewerContainer(app);
    let appliedPage = null;

    if (Number.isFinite(state.page) && state.page > 0) {
      const targetPage = clampPage(app, state.page);
      appliedPage = targetPage;

      // PDF.js has a few valid navigation entry points depending on load timing,
      // sidebar state and build target. Use all stable APIs, then verify below.
      try {
        linkService?.goToPage?.(targetPage);
      } catch {}
      try {
        if (viewer) viewer.currentPageNumber = targetPage;
      } catch {}
      try {
        app.page = targetPage;
      } catch {}
      try {
        viewer?.scrollPageIntoView?.({ pageNumber: targetPage });
      } catch {}

      await nextFrame();
      await nextFrame();

      if (readCurrentPage(app) !== targetPage) {
        try {
          linkService?.goToPage?.(targetPage);
        } catch {}
        try {
          app.page = targetPage;
        } catch {}
        try {
          viewer?.scrollPageIntoView?.({ pageNumber: targetPage });
        } catch {}
      }
    }

    if (viewer && Number.isFinite(state.currentScale) && state.currentScale > 0) {
      viewer.currentScaleValue = String(state.currentScale);
    }

    if (container && Number.isFinite(state.scrollTop) && state.scrollTop >= 0) {
      await applyScrollTop(container, state.scrollTop);
    } else if (container && appliedPage) {
      const pageElement = await waitForPageElement(appliedPage);
      if (pageElement instanceof HTMLElement) {
        await applyScrollTop(container, Math.max(0, pageElement.offsetTop - 8));
      }
    }

    return appliedPage;
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

  // Walks raw PDF.js outline items (title + dest + items) into the Lyceum
  // tree shape, resolving each destination to a 1-based page number.
  async function walkRawOutline(app, items) {
    const document = app?.pdfDocument;
    if (!document) {
      return [];
    }

    async function resolvePage(destination) {
      if (!destination) return null;
      try {
        const explicit = typeof destination === "string"
          ? await document.getDestination(destination)
          : destination;
        if (!Array.isArray(explicit) || explicit.length === 0) return null;
        const target = explicit[0];
        if (typeof target === "number") return target + 1;
        const index = await document.getPageIndex(target);
        return Number.isInteger(index) ? index + 1 : null;
      } catch {
        return null;
      }
    }

    async function walk(list) {
      return Promise.all(list.map(async item => ({
        title: item.title || "(sem título)",
        page: await resolvePage(item.dest),
        items: await walk(Array.isArray(item.items) ? item.items : []),
      })));
    }

    return walk(items);
  }

  async function getOutline() {
    const app = await whenReady();
    if (!app?.pdfDocument) return null;
    const outline = await app.pdfDocument.getOutline().catch(() => null);
    if (!outline) return [];
    return walkRawOutline(app, outline);
  }

  // Second source: the OutlineView widget already rendered an outline for the
  // current document (pdfDocument.getOutline() parsed just-in-time at that
  // point). Used when the direct read is empty but the viewer clearly owns one.
  async function getOutlineFromOutlineView(app) {
    const raw = app?.pdfOutlineViewer?._outline;
    if (!Array.isArray(raw) || raw.length === 0) {
      return null;
    }
    return walkRawOutline(app, raw);
  }

  // Re-reads the outline until it is available. The viewer dispatches
  // "outlineloaded" for every document once the first page renders, with an
  // outlineCount of 0 for documents without bookmarks and > 0 for those that
  // have one. A count of 0 is authoritative: the document finished rendering
  // and simply has no outline, so we answer immediately instead of retrying.
  // A positive count that contradicts an empty direct read is suspicious, so we
  // retry and fall back to the already-rendered OutlineView widget.
  async function getOutlineWhenReady({ timeoutMs = 9000, signalSeen = false } = {}) {
    const read = async () => {
      const outline = await getOutline();
      return Array.isArray(outline) && outline.length > 0 ? outline : null;
    };

    // Second source used when the direct read stays empty but the viewer
    // clearly rendered an outline for the current document.
    const readOrFallback = async () => {
      const outline = await read();
      if (outline) {
        return outline;
      }
      const app = await whenReady();
      const rendered = await getOutlineFromOutlineView(app);
      return rendered && rendered.length > 0 ? rendered : null;
    };

    let resolved = await read();

    if (!resolved && !signalSeen) {
      const app = await whenReady();
      if (app?.eventBus) {
        resolved = await new Promise(resolve => {
          let settled = false;
          const cleanup = () => {
            if (typeof app.eventBus.off === "function") {
              app.eventBus.off("outlineloaded", onSignal);
            }
            clearTimeout(timer);
          };
          const onSignal = async ({ outlineCount } = {}) => {
            if (settled) return;
            settled = true;
            cleanup();
            if (outlineCount === 0) {
              // The viewer rendered the outline and it is empty: the document
              // has no bookmarks, so an empty direct read is authoritative.
              resolve(await read());
              return;
            }
            resolve(await readOrFallback());
          };
          app.eventBus.on("outlineloaded", onSignal);
          const timer = setTimeout(async () => {
            if (settled) return;
            settled = true;
            cleanup();
            resolve(await readOrFallback());
          }, timeoutMs);
        });
      }
    }

    for (let attempt = 0; !resolved && attempt < 4; attempt += 1) {
      await wait(120 * (attempt + 1));
      resolved = await readOrFallback();
    }

    return resolved ?? [];
  }

  function applyLyceumTitle(title) {
    if (title && dom) {
      dom.title = `${title} - PDF.js`;
    }
  }

  return {
    getApp,
    whenReady,
    whenDocumentReady,
    getLinkService,
    getViewerContainer,
    readPageCount,
    readCurrentPage,
    clampPage,
    getPageElement,
    waitForPageElement,
    applyPageAndScroll,
    getState,
    getOutline,
    getOutlineFromOutlineView,
    getOutlineWhenReady,
    applyLyceumTitle,
  };
}