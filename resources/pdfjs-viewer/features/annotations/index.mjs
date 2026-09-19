// Key Concept highlights: receives highlight models from the host and paints
// them on the page, re-rendering when the viewer changes scale, renders pages
// or initializes.
import { CMD_SET_HIGHLIGHTS } from "../../lyceum-core.mjs";

const HIGHLIGHT_LAYER_CLASS = "lyceumKeyConceptHighlightLayer";
const HIGHLIGHT_RECT_CLASS = "lyceumKeyConceptHighlightRect";
const HIGHLIGHTS_KEY = "keyConceptHighlights";

export function installAnnotationsFeature({ bus, state, app = null }) {
  let commandInstalled = false;

  function installCommand() {
    if (commandInstalled) {
      return;
    }
    commandInstalled = true;
    bus.onCommand(CMD_SET_HIGHLIGHTS, data => {
      state.set(HIGHLIGHTS_KEY, Array.isArray(data.highlights) ? data.highlights : []);
      render();
    });
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

  function render() {
    clearHighlightLayers();

    const highlights = Array.isArray(state.get(HIGHLIGHTS_KEY)) ? state.get(HIGHLIGHTS_KEY) : [];
    for (const item of highlights) {
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

  installCommand();

  if (app?.eventBus && !app.__lyceumHighlightEventsInstalled) {
    app.__lyceumHighlightEventsInstalled = true;
    app.eventBus.on?.("pagerendered", render);
    app.eventBus.on?.("scalechanging", render);
    app.eventBus.on?.("pagesinit", render);
  }

  return { render };
}