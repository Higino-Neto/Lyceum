// Custom text selection over PDF.js text layers. Lyceum renders its own
// selection overlay so the reader can offer "create Key Concept" from a clean,
// zoom-independent payload while native selection stays available for copying.
import {
  buildTextLayerModel,
  findWordBounds,
  makeLayerRect,
  mergeSelectionRects,
  projectRectsToPage,
  EVT_CREATE_CONCEPT,
} from "../../lyceum-core.mjs";

const SELECTABLE_TEXT_SPAN_SELECTOR = ".textLayer span:not([role='img'])";
const TEXT_LAYER_SELECTOR = ".textLayer";
const SELECTION_LAYER_CLASS = "lyceumSelectionLayer";
const SELECTION_RECT_CLASS = "lyceumSelectionRect";
const CREATE_CONCEPT_BUTTON_ID = "lyceumCreateConceptButton";

const HIT_TEST_PADDING = 1.5;
const LINE_CLAMP_PADDING = 2;

export function installSelectionFeature({ bus, facade, state }) {
  const modelCache = new WeakMap();

  const getApp = () => facade.getApp();
  const finitePositive = (value, fallback) => {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : fallback;
  };

  function getTextLayerFromTarget(target) {
    return target instanceof Element ? target.closest(TEXT_LAYER_SELECTOR) : null;
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
    const cached = modelCache.get(textLayer);

    if (cached?.signature === signature) {
      cached.bounds = bounds;
      return cached;
    }

    const seeds = [];
    let seedIndex = 0;
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

        seeds.push({ key: String(seedIndex), node, span, text, rects });
        seedIndex += 1;
      }
    }

    const base = buildTextLayerModel(
      seeds.map(seed => ({ key: seed.key, text: seed.text, rects: seed.rects })),
      signature,
    );

    const byKey = new Map(seeds.map(seed => [seed.key, seed]));
    for (const item of base.items) {
      const seed = byKey.get(item.key);
      item.node = seed?.node ?? null;
      item.span = seed?.span ?? null;
    }

    const model = { ...base, bounds };
    modelCache.set(textLayer, model);
    return model;
  }

  function getRenderedTextLayers() {
    return Array.from(document.querySelectorAll(TEXT_LAYER_SELECTOR));
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

  function getNormalizedSelection() {
    if (!state.get("customSelection")) {
      return null;
    }

    const selection = state.get("customSelection");
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
      candidate => y >= candidate.top - LINE_CLAMP_PADDING && y <= candidate.bottom + LINE_CLAMP_PADDING,
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

    const bounds = findWordBounds(item.text, point.offset - item.start);
    if (!bounds) {
      return null;
    }

    return {
      anchor: { textLayer: point.textLayer, offset: item.start + bounds.start },
      focus: { textLayer: point.textLayer, offset: item.start + bounds.end },
    };
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
    state.set("currentSelectionPayload", null);
  }

  function clearCustomSelection() {
    state.set("activeSelectionDrag", null);
    state.set("customSelection", null);
    state.set("currentSelectionPayload", null);
    state.set("selectedTextForClipboard", "");
    clearNativeSelection();
    clearSelectionOverlays();
    clearCreateConceptButton();
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

  function renderCreateConceptButton(payload, anchorRect) {
    clearCreateConceptButton();
    if (!payload?.text || !anchorRect) {
      return;
    }

    state.set("currentSelectionPayload", payload);

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
        const payloadToSend = state.get("currentSelectionPayload");
        bus.emit(EVT_CREATE_CONCEPT, { payload: payloadToSend });
        button.remove();
      } catch {
        // Ignore; the selection itself remains available for copying.
      }
    }, true);

    document.body.append(button);
  }

  function renderCustomSelection() {
    clearSelectionOverlays();
    clearCreateConceptButton();

    const normalized = getNormalizedSelection();
    if (!normalized || comparePositions(normalized.start, normalized.end) === 0) {
      state.set("selectedTextForClipboard", "");
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
      state.set("selectedTextForClipboard", "");
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
      const layerBounds = textLayer.getBoundingClientRect();

      for (const rect of rects) {
        const selectionRect = document.createElement("div");
        selectionRect.className = SELECTION_RECT_CLASS;
        selectionRect.style.left = `${rect.left}px`;
        selectionRect.style.top = `${rect.top}px`;
        selectionRect.style.width = `${rect.width}px`;
        selectionRect.style.height = `${rect.height}px`;
        layer.append(selectionRect);

        buttonAnchorRect = {
          left: layerBounds.left + rect.left,
          top: layerBounds.top + rect.top,
          right: layerBounds.left + rect.left + rect.width,
          bottom: layerBounds.top + rect.top + rect.height,
          width: rect.width,
          height: rect.height,
        };
      }

      if (pageElement) {
        const ratioRects = projectRectsToPage(
          rects,
          layerBounds,
          pageElement.getBoundingClientRect(),
          getPageNumberForTextLayer(textLayer),
        );
        payloadRects.push(...ratioRects);
        payloadPage ??= ratioRects[0]?.page;
      }

      const layerText = getSelectedTextForLayer(textLayer, startOffset, endOffset);
      if (layerText) {
        if (textParts.length > 0) {
          textParts.push("\n");
        }
        textParts.push(layerText);
      }
    }

    state.set("selectedTextForClipboard", textParts.join(""));
    const text = state.get("selectedTextForClipboard").trim();
    if (text && payloadRects.length > 0) {
      renderCreateConceptButton({
        text,
        page: payloadPage ?? finitePositive(getApp()?.page, 1),
        rects: payloadRects,
      }, buttonAnchorRect);
    }
  }

  function scheduleCustomSelectionRender() {
    if (state.get("customSelectionRenderQueued")) {
      return;
    }

    state.set("customSelectionRenderQueued", true);
    requestAnimationFrame(() => {
      state.set("customSelectionRenderQueued", false);
      renderCustomSelection();
    });
  }

  function updateCustomSelection(focus) {
    if (!state.get("activeSelectionDrag")) {
      return;
    }

    state.set("customSelection", {
      anchor: state.get("activeSelectionDrag").anchor,
      focus,
    });
    state.get("activeSelectionDrag").focus = focus;
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

        state.set("activeSelectionDrag", {
          anchor: point,
          focus: point,
        });
        state.set("customSelection", { anchor: point, focus: point });

        clearNativeSelection();
        clearSelectionOverlays();
        state.set("selectedTextForClipboard", "");
        event.target?.setPointerCapture?.(event.pointerId);
        stopSelectionEvent(event);
      },
      true,
    );

    document.addEventListener(
      pointerMoveEvent,
      event => {
        if (!state.get("activeSelectionDrag")) {
          return;
        }

        const point = getTextPositionFromPoint(event, { allowLineClamp: true });
        if (point) {
          updateCustomSelection(point);
        }

        stopSelectionEvent(event);
      },
      true,
    );

    document.addEventListener(
      pointerEndEvent,
      event => {
        if (!state.get("activeSelectionDrag")) {
          return;
        }

        state.set("activeSelectionDrag", null);
        scheduleCustomSelectionRender();
        stopSelectionEvent(event);
      },
      true,
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

        state.set("activeSelectionDrag", null);
        state.set("customSelection", wordSelection);
        clearNativeSelection();
        scheduleCustomSelectionRender();
        stopSelectionEvent(event);
      },
      true,
    );

    document.addEventListener(
      "copy",
      event => {
        if (!state.get("selectedTextForClipboard")) {
          return;
        }

        event.clipboardData?.setData("text/plain", state.get("selectedTextForClipboard"));
        stopSelectionEvent(event);
      },
      true,
    );

    document.addEventListener(
      "selectionchange",
      () => {
        if (state.get("activeSelectionDrag")) {
          clearNativeSelection();
        }
      },
      true,
    );

    document.addEventListener(
      "keydown",
      event => {
        if (event.key === "Escape" && state.get("customSelection")) {
          clearCustomSelection();
        }
      },
      true,
    );

    window.addEventListener(
      "blur",
      () => {
        state.set("activeSelectionDrag", null);
        scheduleCustomSelectionRender();
      },
      true,
    );
  }

  installTextSelectionGuards();
}