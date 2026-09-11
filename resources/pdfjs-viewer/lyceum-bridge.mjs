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

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  return document.querySelector(`.page[data-page-number="${page}"]`);
}

async function waitForPageElement(page) {
  for (let attempt = 0; attempt < 18; attempt += 1) {
    const element = getPageElement(page);
    if (element) return element;
    await (attempt < 6 ? nextFrame() : wait(50));
  }
  return null;
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

  const appliedPage = await applyPageAndScroll(app, state);

  const nextState = await getState();
  return appliedPage && nextState ? { ...nextState, page: appliedPage } : nextState;
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

function updateLyceumChapterButton(open) {
  const button = document.getElementById("sidebarToggleButton");
  if (!button) {
    return;
  }

  button.classList.add("lyceumChapterToggle");
  button.classList.toggle("toggled", !!open);
  button.setAttribute("aria-expanded", open ? "true" : "false");
  button.setAttribute("aria-pressed", open ? "true" : "false");
  button.setAttribute("title", "Mostrar/ocultar painel de capitulos");
  button.removeAttribute("aria-haspopup");
  button.removeAttribute("data-l10n-id");

  const label = button.querySelector("span");
  if (label) {
    label.textContent = "Capitulos";
    label.removeAttribute("data-l10n-id");
  }
}

function updateLyceumAnnotationButton(open, count = 0) {
  const button = document.getElementById("lyceumAnnotationToggleButton");
  if (!button) {
    return;
  }

  button.classList.toggle("toggled", !!open);
  button.setAttribute("aria-expanded", open ? "true" : "false");
  button.setAttribute("aria-pressed", open ? "true" : "false");

  const badge = button.querySelector(".lyceumAnnotationBadge");
  const safeCount = Number.isFinite(Number(count)) ? Math.max(0, Math.round(Number(count))) : 0;
  if (safeCount > 0) {
    badge.textContent = String(Math.min(99, safeCount));
    badge.hidden = false;
  } else {
    badge.hidden = true;
  }
}

function sendChapterToggleRequest() {
  try {
    window.parent?.postMessage({ type: "lyceum-pdfjs:toggle-chapters" }, "*");
  } catch {
    // Cross-frame messaging is best-effort; the PDF reader remains usable.
  }
}

function sendAnnotationToggleRequest() {
  try {
    window.parent?.postMessage({ type: "lyceum-pdfjs:toggle-annotations" }, "*");
  } catch {
    // Cross-frame messaging is best-effort; the PDF reader remains usable.
  }
}

function closeNativeSidebar(app = getApp()) {
  const sidebar = app?.pdfSidebar;
  if (sidebar?.isOpen && typeof sidebar.close === "function") {
    sidebar.close();
  }

  document.getElementById("outerContainer")?.classList.remove("sidebarMoving", "sidebarOpen");
}

function installChapterToggleBridge() {
  const button = document.getElementById("sidebarToggleButton");
  if (!button || button.__lyceumChapterToggleInstalled) {
    return;
  }

  button.__lyceumChapterToggleInstalled = true;
  updateLyceumChapterButton(false);

  button.addEventListener(
    "click",
    event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      closeNativeSidebar();
      sendChapterToggleRequest();
    },
    true
  );

  window.addEventListener("message", event => {
    if (event.source !== window.parent) {
      return;
    }

    const data = event.data;
    if (!data || typeof data !== "object" || data.type !== "lyceum-pdfjs:chapters-state") {
      return;
    }

    closeNativeSidebar();
    updateLyceumChapterButton(!!data.open);
  });

  try {
    window.parent?.postMessage({ type: "lyceum-pdfjs:ready" }, "*");
  } catch {
    // Ignore: Lyceum also syncs state from the iframe load handler.
  }
}

function createLyceumAnnotationButton() {
  const existing = document.getElementById("lyceumAnnotationToggleButton");
  if (existing) {
    return existing;
  }

  const referenceButton = document.getElementById("sidebarToggleButton");
  const toolbarGroup = referenceButton?.parentElement ?? document.getElementById("toolbarViewerLeft");
  if (!toolbarGroup) {
    return null;
  }

  const button = document.createElement("button");
  button.id = "lyceumAnnotationToggleButton";
  button.type = "button";
  button.className = "toolbarButton lyceumAnnotationToggle";
  button.title = "Key Concepts";
  button.setAttribute("aria-label", "Key Concepts");
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-pressed", "false");

  const label = document.createElement("span");
  label.textContent = "Key Concepts";
  button.append(label);

  const badge = document.createElement("span");
  badge.className = "lyceumAnnotationBadge";
  badge.hidden = true;
  button.append(badge);

  button.addEventListener("click", event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    sendAnnotationToggleRequest();
  }, true);

  referenceButton?.after(button);
  if (!referenceButton) {
    toolbarGroup.prepend(button);
  }

  return button;
}

function installAnnotationToggleBridge() {
  const button = createLyceumAnnotationButton();
  if (!button || button.__lyceumAnnotationToggleInstalled) {
    return;
  }

  button.__lyceumAnnotationToggleInstalled = true;
  updateLyceumAnnotationButton(false, 0);

  window.addEventListener("message", event => {
    if (event.source !== window.parent) {
      return;
    }

    const data = event.data;
    if (!data || typeof data !== "object" || data.type !== "lyceum-pdfjs:annotations-state") {
      return;
    }

    updateLyceumAnnotationButton(!!data.open, data.count);
  });
}

const SELECTABLE_TEXT_SPAN_SELECTOR = ".textLayer span:not([role='img'])";
const TEXT_LAYER_SELECTOR = ".textLayer";
const SELECTION_LAYER_CLASS = "lyceumSelectionLayer";
const SELECTION_RECT_CLASS = "lyceumSelectionRect";
const CREATE_CONCEPT_BUTTON_ID = "lyceumCreateConceptButton";
const HIGHLIGHT_LAYER_CLASS = "lyceumKeyConceptHighlightLayer";
const HIGHLIGHT_RECT_CLASS = "lyceumKeyConceptHighlightRect";

const HIT_TEST_PADDING = 1.5;
const LINE_CLAMP_PADDING = 2;

let activeSelectionDrag = null;
let customSelection = null;
let customSelectionRenderQueued = false;
let currentSelectionPayload = null;
let selectedTextForClipboard = "";
let keyConceptHighlights = [];
let highlightBridgeInstalled = false;

const textLayerModelCache = new WeakMap();

function getTextLayerFromTarget(target) {
  return target instanceof Element ? target.closest(TEXT_LAYER_SELECTOR) : null;
}

function getSelectableTextSpan(target) {
  if (!(target instanceof Element)) {
    return null;
  }

  const span = target.closest(SELECTABLE_TEXT_SPAN_SELECTOR);
  if (!span || span.closest(`.${SELECTION_LAYER_CLASS}`)) {
    return null;
  }

  const text = span.textContent ?? "";
  if (text.length === 0 || span.classList.contains("markedContent")) {
    return null;
  }

  return span;
}

function clearNativeSelection() {
  const selection = document.getSelection();
  if (selection && selection.rangeCount > 0) {
    selection.removeAllRanges();
  }
}

function stopSelectionEvent(event) {
  event.preventDefault();
  event.stopImmediatePropagation();
}

function getOrCreateSelectionLayer(textLayer) {
  let layer = textLayer.querySelector(`:scope > .${SELECTION_LAYER_CLASS}`);
  if (!layer) {
    layer = document.createElement("div");
    layer.className = SELECTION_LAYER_CLASS;
    layer.setAttribute("aria-hidden", "true");
    textLayer.append(layer);
  }
  return layer;
}

function clearSelectionOverlays() {
  for (const layer of document.querySelectorAll(`.${SELECTION_LAYER_CLASS}`)) {
    layer.replaceChildren();
  }
}

function clearCreateConceptButton() {
  document.getElementById(CREATE_CONCEPT_BUTTON_ID)?.remove();
  currentSelectionPayload = null;
}

function clearCustomSelection() {
  activeSelectionDrag = null;
  customSelection = null;
  currentSelectionPayload = null;
  selectedTextForClipboard = "";
  clearNativeSelection();
  clearSelectionOverlays();
  clearCreateConceptButton();
}

function getRenderedTextLayers() {
  return Array.from(document.querySelectorAll(TEXT_LAYER_SELECTOR));
}

function makeLayerRect(rect, layerBounds) {
  const left = Math.max(0, rect.left - layerBounds.left);
  const top = Math.max(0, rect.top - layerBounds.top);
  const right = Math.min(layerBounds.width, rect.right - layerBounds.left);
  const bottom = Math.min(layerBounds.height, rect.bottom - layerBounds.top);
  const width = right - left;
  const height = bottom - top;

  if (width < 0.5 || height < 0.5) {
    return null;
  }

  return { left, top, right, bottom, width, height };
}

function getTextNodesInSpan(span) {
  const nodes = [];
  const walker = document.createTreeWalker(span, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return node.nodeValue ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });

  let node;
  while ((node = walker.nextNode())) {
    nodes.push(node);
  }

  return nodes;
}

function getTextLayerModel(textLayer) {
  const bounds = textLayer.getBoundingClientRect();
  const signature = [
    textLayer.childElementCount,
    textLayer.textContent?.length ?? 0,
    Math.round(bounds.width * 100),
    Math.round(bounds.height * 100),
  ].join(":");
  const cached = textLayerModelCache.get(textLayer);

  if (cached?.signature === signature) {
    cached.bounds = bounds;
    return cached;
  }

  const items = [];
  const lines = [];
  let cursor = 0;

  for (const span of textLayer.querySelectorAll(SELECTABLE_TEXT_SPAN_SELECTOR)) {
    if (
      span.closest(`.${SELECTION_LAYER_CLASS}`) ||
      span.classList.contains("markedContent") ||
      !span.textContent
    ) {
      continue;
    }

    for (const node of getTextNodesInSpan(span)) {
      const text = node.nodeValue ?? "";
      if (!text) {
        continue;
      }

      const range = document.createRange();
      range.selectNodeContents(node);

      const rects = Array.from(range.getClientRects())
        .map(rect => makeLayerRect(rect, bounds))
        .filter(Boolean);

      range.detach?.();

      if (rects.length === 0) {
        continue;
      }

      const item = {
        node,
        span,
        text,
        start: cursor,
        end: cursor + text.length,
        rects,
        lineIndex: -1,
      };

      cursor = item.end;
      items.push(item);
    }
  }

  for (const item of items) {
    const rect = item.rects[0];
    const center = (rect.top + rect.bottom) / 2;
    const threshold = Math.max(2, Math.min(8, rect.height * 0.45));
    let line = lines.find(candidate => Math.abs(candidate.center - center) <= candidate.threshold);

    if (!line) {
      line = {
        center,
        threshold,
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
        items: [],
      };
      lines.push(line);
    }

    item.lineIndex = lines.indexOf(line);
    line.center = (line.center * line.items.length + center) / (line.items.length + 1);
    line.top = Math.min(line.top, rect.top);
    line.bottom = Math.max(line.bottom, rect.bottom);
    line.left = Math.min(line.left, ...item.rects.map(itemRect => itemRect.left));
    line.right = Math.max(line.right, ...item.rects.map(itemRect => itemRect.right));
    line.items.push(item);
  }

  lines.sort((a, b) => a.center - b.center || a.left - b.left);
  lines.forEach((line, index) => {
    line.items.sort((a, b) => a.start - b.start);
    for (const item of line.items) {
      item.lineIndex = index;
    }
  });

  const model = {
    signature,
    bounds,
    items,
    lines,
    textLength: cursor,
  };

  textLayerModelCache.set(textLayer, model);
  return model;
}

function getLayerIndex(textLayer) {
  return getRenderedTextLayers().indexOf(textLayer);
}

function comparePositions(first, second) {
  const firstIndex = getLayerIndex(first.textLayer);
  const secondIndex = getLayerIndex(second.textLayer);

  if (firstIndex !== secondIndex) {
    return firstIndex - secondIndex;
  }

  return first.offset - second.offset;
}

function getNormalizedSelection(selection = customSelection) {
  if (!selection) {
    return null;
  }

  return comparePositions(selection.anchor, selection.focus) <= 0
    ? { start: selection.anchor, end: selection.focus }
    : { start: selection.focus, end: selection.anchor };
}

function findItemAtLayerPoint(model, x, y, padding = HIT_TEST_PADDING) {
  for (const item of model.items) {
    for (const rect of item.rects) {
      if (
        x >= rect.left - padding &&
        x <= rect.right + padding &&
        y >= rect.top - padding &&
        y <= rect.bottom + padding
      ) {
        return { item, rect };
      }
    }
  }

  return null;
}

function estimateOffsetInItem(item, rect, x) {
  if (item.text.length <= 1 || rect.width <= 0) {
    return item.start;
  }

  const ratio = Math.max(0, Math.min(1, (x - rect.left) / rect.width));
  return item.start + Math.round(ratio * item.text.length);
}

function getLineClampedPosition(textLayer, model, x, y) {
  const line = model.lines.find(
    candidate => y >= candidate.top - LINE_CLAMP_PADDING && y <= candidate.bottom + LINE_CLAMP_PADDING
  );

  if (!line || line.items.length === 0) {
    return null;
  }

  if (x <= line.left) {
    return { textLayer, offset: line.items[0].start };
  }
  if (x >= line.right) {
    return { textLayer, offset: line.items[line.items.length - 1].end };
  }

  let closest = null;
  for (const item of line.items) {
    for (const rect of item.rects) {
      if (x >= rect.left && x <= rect.right) {
        return { textLayer, offset: estimateOffsetInItem(item, rect, x) };
      }

      const leftDistance = Math.abs(x - rect.left);
      const rightDistance = Math.abs(x - rect.right);
      const leftCandidate = { distance: leftDistance, offset: item.start };
      const rightCandidate = { distance: rightDistance, offset: item.end };

      for (const candidate of [leftCandidate, rightCandidate]) {
        if (!closest || candidate.distance < closest.distance) {
          closest = candidate;
        }
      }
    }
  }

  return closest ? { textLayer, offset: closest.offset } : null;
}

function getTextPositionFromPoint(event, { allowLineClamp = false } = {}) {
  const textLayer =
    getTextLayerFromTarget(event.target) ??
    getRenderedTextLayers().find(layer => {
      const bounds = layer.getBoundingClientRect();
      return (
        event.clientX >= bounds.left &&
        event.clientX <= bounds.right &&
        event.clientY >= bounds.top &&
        event.clientY <= bounds.bottom
      );
    });

  if (!textLayer) {
    return null;
  }

  const model = getTextLayerModel(textLayer);
  const x = event.clientX - model.bounds.left;
  const y = event.clientY - model.bounds.top;
  const hit = findItemAtLayerPoint(model, x, y);

  if (hit) {
    return { textLayer, offset: estimateOffsetInItem(hit.item, hit.rect, x) };
  }

  return allowLineClamp ? getLineClampedPosition(textLayer, model, x, y) : null;
}

function getWordSelectionAtPoint(event) {
  const point = getTextPositionFromPoint(event);
  if (!point) {
    return null;
  }

  const model = getTextLayerModel(point.textLayer);
  const item = model.items.find(candidate => point.offset >= candidate.start && point.offset <= candidate.end);
  if (!item) {
    return null;
  }

  let offset = Math.max(0, Math.min(item.text.length - 1, point.offset - item.start));
  if (/\s/.test(item.text[offset]) && offset > 0) {
    offset -= 1;
  }
  if (/\s/.test(item.text[offset])) {
    return null;
  }

  let start = offset;
  let end = offset + 1;
  while (start > 0 && !/\s/.test(item.text[start - 1])) {
    start -= 1;
  }
  while (end < item.text.length && !/\s/.test(item.text[end])) {
    end += 1;
  }

  return {
    anchor: { textLayer: point.textLayer, offset: item.start + start },
    focus: { textLayer: point.textLayer, offset: item.start + end },
  };
}

function scheduleCustomSelectionRender() {
  if (customSelectionRenderQueued) {
    return;
  }

  customSelectionRenderQueued = true;
  requestAnimationFrame(() => {
    customSelectionRenderQueued = false;
    renderCustomSelection();
  });
}

function getPartialItemRects(item, startOffset, endOffset, layerBounds) {
  const rects = [];

  if (startOffset <= item.start && endOffset >= item.end) {
    return item.rects;
  }

  const localStart = Math.max(0, startOffset - item.start);
  const localEnd = Math.min(item.text.length, endOffset - item.start);
  if (localStart >= localEnd) {
    return rects;
  }

  const range = document.createRange();
  range.setStart(item.node, localStart);
  range.setEnd(item.node, localEnd);

  for (const rect of range.getClientRects()) {
    const layerRect = makeLayerRect(rect, layerBounds);
    if (layerRect) {
      rects.push(layerRect);
    }
  }

  range.detach?.();
  return rects;
}

function mergeSelectionRects(rects) {
  if (rects.length <= 1) {
    return rects;
  }

  const sorted = rects
    .map(rect => {
      const verticalInset = Math.min(1.5, rect.height * 0.12);
      return {
        left: rect.left,
        top: rect.top + verticalInset,
        right: rect.left + rect.width,
        bottom: rect.top + rect.height - verticalInset,
      };
    })
    .filter(rect => rect.right - rect.left >= 0.5 && rect.bottom - rect.top >= 0.5)
    .sort((a, b) => (a.top + a.bottom) / 2 - (b.top + b.bottom) / 2 || a.left - b.left);

  const lines = [];
  for (const rect of sorted) {
    const center = (rect.top + rect.bottom) / 2;
    const line = lines.find(candidate => Math.abs(candidate.center - center) <= candidate.threshold);

    if (line) {
      line.center = (line.center * line.rects.length + center) / (line.rects.length + 1);
      line.top = Math.min(line.top, rect.top);
      line.bottom = Math.max(line.bottom, rect.bottom);
      line.rects.push(rect);
    } else {
      const height = rect.bottom - rect.top;
      lines.push({
        center,
        threshold: Math.max(2, Math.min(7, height * 0.35)),
        top: rect.top,
        bottom: rect.bottom,
        rects: [rect],
      });
    }
  }

  const merged = [];
  for (const line of lines) {
    const intervals = line.rects.sort((a, b) => a.left - b.left);
    let current = null;

    for (const rect of intervals) {
      if (!current) {
        current = { left: rect.left, right: rect.right };
        continue;
      }

      if (rect.left <= current.right + 1.5) {
        current.right = Math.max(current.right, rect.right);
      } else {
        merged.push({
          left: current.left,
          top: line.top,
          width: current.right - current.left,
          height: line.bottom - line.top,
        });
        current = { left: rect.left, right: rect.right };
      }
    }

    if (current) {
      merged.push({
        left: current.left,
        top: line.top,
        width: current.right - current.left,
        height: line.bottom - line.top,
      });
    }
  }

  return merged;
}

function getPageElementForTextLayer(textLayer) {
  return textLayer.closest?.(".page") ?? null;
}

function getPageNumberForTextLayer(textLayer) {
  const pageElement = getPageElementForTextLayer(textLayer);
  const pageNumber = Number(pageElement?.dataset?.pageNumber);
  return Number.isFinite(pageNumber) && pageNumber > 0
    ? Math.round(pageNumber)
    : finitePositive(getApp()?.page, 1);
}

function toPageRatioRect(rect, textLayer, pageElement) {
  const layerBounds = textLayer.getBoundingClientRect();
  const pageBounds = pageElement.getBoundingClientRect();
  if (pageBounds.width <= 0 || pageBounds.height <= 0) {
    return null;
  }

  return {
    page: getPageNumberForTextLayer(textLayer),
    left: (layerBounds.left + rect.left - pageBounds.left) / pageBounds.width,
    top: (layerBounds.top + rect.top - pageBounds.top) / pageBounds.height,
    width: rect.width / pageBounds.width,
    height: rect.height / pageBounds.height,
  };
}

function renderCreateConceptButton(payload, anchorRect) {
  clearCreateConceptButton();
  if (!payload?.text || !anchorRect) {
    return;
  }

  currentSelectionPayload = payload;

  const button = document.createElement("button");
  button.id = CREATE_CONCEPT_BUTTON_ID;
  button.type = "button";
  button.className = "lyceumCreateConceptButton";
  button.textContent = "+ Concept";
  button.title = "Criar Key Concept";
  button.setAttribute("aria-label", "Criar Key Concept a partir da selecao");

  const left = Math.min(window.innerWidth - 112, Math.max(8, anchorRect.right + 8));
  const top = Math.min(window.innerHeight - 42, Math.max(8, anchorRect.top + anchorRect.height / 2 - 16));
  button.style.left = `${left}px`;
  button.style.top = `${top}px`;

  button.addEventListener("pointerdown", stopSelectionEvent, true);
  button.addEventListener("mousedown", stopSelectionEvent, true);
  button.addEventListener("click", event => {
    stopSelectionEvent(event);
    try {
      window.parent?.postMessage({
        type: "lyceum-pdfjs:create-concept-from-selection",
        payload: currentSelectionPayload,
      }, "*");
      button.remove();
    } catch {
      // Ignore; the selection itself remains available for copying.
    }
  }, true);

  document.body.append(button);
}

function getSelectedLayerRects(textLayer, startOffset, endOffset) {
  const model = getTextLayerModel(textLayer);
  const rects = [];

  for (const item of model.items) {
    if (item.end <= startOffset || item.start >= endOffset) {
      continue;
    }

    rects.push(...getPartialItemRects(item, startOffset, endOffset, model.bounds));
  }

  return mergeSelectionRects(rects);
}

function getSelectedTextForLayer(textLayer, startOffset, endOffset) {
  const model = getTextLayerModel(textLayer);
  const pieces = [];
  let previousLine = null;

  for (const item of model.items) {
    if (item.end <= startOffset || item.start >= endOffset) {
      continue;
    }

    const localStart = Math.max(0, startOffset - item.start);
    const localEnd = Math.min(item.text.length, endOffset - item.start);
    const text = item.text.slice(localStart, localEnd);
    if (!text) {
      continue;
    }

    if (previousLine !== null && previousLine !== item.lineIndex) {
      pieces.push("\n");
    }

    pieces.push(text);
    previousLine = item.lineIndex;
  }

  return pieces.join("");
}

function renderCustomSelection() {
  clearSelectionOverlays();
  clearCreateConceptButton();

  const normalized = getNormalizedSelection();
  if (!normalized || comparePositions(normalized.start, normalized.end) === 0) {
    selectedTextForClipboard = "";
    return;
  }

  const textLayers = getRenderedTextLayers();
  const startLayerIndex = textLayers.indexOf(normalized.start.textLayer);
  const endLayerIndex = textLayers.indexOf(normalized.end.textLayer);
  const textParts = [];
  const payloadRects = [];
  let payloadPage = null;
  let buttonAnchorRect = null;

  if (startLayerIndex < 0 || endLayerIndex < 0) {
    selectedTextForClipboard = "";
    return;
  }

  for (let index = startLayerIndex; index <= endLayerIndex; index++) {
    const textLayer = textLayers[index];
    const model = getTextLayerModel(textLayer);
    const startOffset = index === startLayerIndex ? normalized.start.offset : 0;
    const endOffset = index === endLayerIndex ? normalized.end.offset : model.textLength;

    if (startOffset >= endOffset) {
      continue;
    }

    const rects = getSelectedLayerRects(textLayer, startOffset, endOffset);
    const layer = getOrCreateSelectionLayer(textLayer);
    const pageElement = getPageElementForTextLayer(textLayer);
    for (const rect of rects) {
      const selectionRect = document.createElement("div");
      selectionRect.className = SELECTION_RECT_CLASS;
      selectionRect.style.left = `${rect.left}px`;
      selectionRect.style.top = `${rect.top}px`;
      selectionRect.style.width = `${rect.width}px`;
      selectionRect.style.height = `${rect.height}px`;
      layer.append(selectionRect);

      if (pageElement) {
        const ratioRect = toPageRatioRect(rect, textLayer, pageElement);
        if (ratioRect) {
          payloadRects.push(ratioRect);
          payloadPage ??= ratioRect.page;
          const bounds = textLayer.getBoundingClientRect();
          buttonAnchorRect = {
            left: bounds.left + rect.left,
            top: bounds.top + rect.top,
            right: bounds.left + rect.left + rect.width,
            bottom: bounds.top + rect.top + rect.height,
            width: rect.width,
            height: rect.height,
          };
        }
      }
    }

    const layerText = getSelectedTextForLayer(textLayer, startOffset, endOffset);
    if (layerText) {
      if (textParts.length > 0) {
        textParts.push("\n");
      }
      textParts.push(layerText);
    }
  }

  selectedTextForClipboard = textParts.join("");
  const text = selectedTextForClipboard.trim();
  if (text && payloadRects.length > 0) {
    renderCreateConceptButton({
      text,
      page: payloadPage ?? finitePositive(getApp()?.page, 1),
      rects: payloadRects,
    }, buttonAnchorRect);
  }
}

function updateCustomSelection(focus) {
  if (!activeSelectionDrag) {
    return;
  }

  customSelection = {
    anchor: activeSelectionDrag.anchor,
    focus,
  };
  activeSelectionDrag.focus = focus;
  clearNativeSelection();
  scheduleCustomSelectionRender();
}

function installTextSelectionGuards() {
  const pointerStartEvent = window.PointerEvent ? "pointerdown" : "mousedown";
  const pointerMoveEvent = window.PointerEvent ? "pointermove" : "mousemove";
  const pointerEndEvent = window.PointerEvent ? "pointerup" : "mouseup";

  document.addEventListener(
    pointerStartEvent,
    event => {
      if (event.button !== 0) {
        return;
      }

      if (event.target?.closest?.(`#${CREATE_CONCEPT_BUTTON_ID}`)) {
        return;
      }

      const textLayer = getTextLayerFromTarget(event.target);
      if (!textLayer) {
        if (!event.target?.closest?.(`.${SELECTION_LAYER_CLASS}`)) {
          clearCustomSelection();
        }
        return;
      }

      const point = getTextPositionFromPoint(event);
      if (!point) {
        clearCustomSelection();
        stopSelectionEvent(event);
        return;
      }

      activeSelectionDrag = {
        anchor: point,
        focus: point,
      };
      customSelection = { anchor: point, focus: point };

      clearNativeSelection();
      clearSelectionOverlays();
      selectedTextForClipboard = "";
      event.target?.setPointerCapture?.(event.pointerId);
      stopSelectionEvent(event);
    },
    true
  );

  document.addEventListener(
    pointerMoveEvent,
    event => {
      if (!activeSelectionDrag) {
        return;
      }

      const point = getTextPositionFromPoint(event, { allowLineClamp: true });
      if (point) {
        updateCustomSelection(point);
      }

      stopSelectionEvent(event);
    },
    true
  );

  document.addEventListener(
    pointerEndEvent,
    event => {
      if (!activeSelectionDrag) {
        return;
      }

      activeSelectionDrag = null;
      scheduleCustomSelectionRender();
      stopSelectionEvent(event);
    },
    true
  );

  document.addEventListener(
    "dblclick",
    event => {
      if (!getTextLayerFromTarget(event.target)) {
        return;
      }

      const wordSelection = getWordSelectionAtPoint(event);
      if (!wordSelection) {
        clearCustomSelection();
        stopSelectionEvent(event);
        return;
      }

      activeSelectionDrag = null;
      customSelection = wordSelection;
      clearNativeSelection();
      scheduleCustomSelectionRender();
      stopSelectionEvent(event);
    },
    true
  );

  document.addEventListener(
    "copy",
    event => {
      if (!selectedTextForClipboard) {
        return;
      }

      event.clipboardData?.setData("text/plain", selectedTextForClipboard);
      stopSelectionEvent(event);
    },
    true
  );

  document.addEventListener(
    "selectionchange",
    () => {
      if (activeSelectionDrag) {
        clearNativeSelection();
      }
    },
    true
  );

  document.addEventListener(
    "keydown",
    event => {
      if (event.key === "Escape" && customSelection) {
        clearCustomSelection();
      }
    },
    true
  );

  window.addEventListener(
    "blur",
    () => {
      activeSelectionDrag = null;
      scheduleCustomSelectionRender();
    },
    true
  );
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

function clearHighlightLayers() {
  for (const layer of document.querySelectorAll(`.${HIGHLIGHT_LAYER_CLASS}`)) {
    layer.remove();
  }
}

function getOrCreateHighlightLayer(pageElement) {
  let layer = pageElement.querySelector(`:scope > .${HIGHLIGHT_LAYER_CLASS}`);
  if (!layer) {
    layer = document.createElement("div");
    layer.className = HIGHLIGHT_LAYER_CLASS;
    layer.setAttribute("aria-hidden", "true");
    pageElement.append(layer);
  }
  return layer;
}

function renderKeyConceptHighlights() {
  clearHighlightLayers();
  for (const item of keyConceptHighlights) {
    const rects = Array.isArray(item?.rects) ? item.rects : [];
    for (const rect of rects) {
      const page = Number(rect?.page);
      const pageElement = Number.isFinite(page)
        ? document.querySelector(`.page[data-page-number="${Math.round(page)}"]`)
        : null;
      if (!pageElement) {
        continue;
      }

      const highlightRect = document.createElement("div");
      highlightRect.className = HIGHLIGHT_RECT_CLASS;
      highlightRect.title = item.title || "Key Concept";
      highlightRect.dataset.conceptId = item.id || "";
      highlightRect.style.left = `${Math.max(0, Math.min(1, Number(rect.left) || 0)) * 100}%`;
      highlightRect.style.top = `${Math.max(0, Math.min(1, Number(rect.top) || 0)) * 100}%`;
      highlightRect.style.width = `${Math.max(0, Math.min(1, Number(rect.width) || 0)) * 100}%`;
      highlightRect.style.height = `${Math.max(0, Math.min(1, Number(rect.height) || 0)) * 100}%`;
      getOrCreateHighlightLayer(pageElement).append(highlightRect);
    }
  }
}

function installHighlightBridge() {
  if (!highlightBridgeInstalled) {
    highlightBridgeInstalled = true;
    window.addEventListener("message", event => {
      if (event.source !== window.parent) {
        return;
      }

      const data = event.data;
      if (!data || typeof data !== "object" || data.type !== "lyceum-pdfjs:key-concept-highlights") {
        return;
      }

      keyConceptHighlights = Array.isArray(data.highlights) ? data.highlights : [];
      renderKeyConceptHighlights();
    });
  }

  const app = getApp();
  if (app?.eventBus && !app.__lyceumHighlightEventsInstalled) {
    app.__lyceumHighlightEventsInstalled = true;
    app.eventBus._on?.("pagerendered", renderKeyConceptHighlights);
    app.eventBus._on?.("scalechanging", renderKeyConceptHighlights);
    app.eventBus._on?.("pagesinit", renderKeyConceptHighlights);
  }
}

function wrapNativeSidebarToggle() {
  const app = getApp();
  const sidebar = app?.pdfSidebar;
  if (!sidebar || typeof sidebar.toggle !== "function" || sidebar.__lyceumToggleWrapped) {
    return;
  }

  sidebar.__lyceumToggleWrapped = true;
  sidebar.toggle = function () {
    closeNativeSidebar(app);
    sendChapterToggleRequest();
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
    installTextSelectionGuards();
    installChapterToggleBridge();
    installAnnotationToggleBridge();
    installHighlightBridge();
    wrapSetInitialView();
    applyLyceumTitle();

    const app = getApp();
    app?.initializedPromise?.then(() => {
      applyLyceumTitle();
      installChapterToggleBridge();
      installAnnotationToggleBridge();
      installHighlightBridge();
      wrapNativeSidebarToggle();
      closeNativeSidebar(app);
      app.eventBus?._on?.("documentloaded", applyLyceumTitle);
    });
  },
  true,
);
