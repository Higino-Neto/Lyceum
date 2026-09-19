// GENERATED FILE - do not edit. Built by scripts/build-lyceum-core.mjs from src/core/pdf-reader-core.

// src/core/pdf-reader-core/contract.ts
var PDF_BRIDGE_VERSION = 1;
var PDF_VIEWER_ORIGIN = "lyceum-pdfjs://viewer";
var EVT_READY = "lyceum-pdfjs:ready";
var EVT_DOCUMENT_READY = "lyceum-pdfjs:document-ready";
var EVT_STATE_CHANGED = "lyceum-pdfjs:state-changed";
var EVT_RESTORE_COMPLETE = "lyceum-pdfjs:restore-complete";
var EVT_CREATE_CONCEPT = "lyceum-pdfjs:create-concept-from-selection";
var EVT_OUTLINE_LOADED = "lyceum-pdfjs:outline-loaded";
var EVT_TOGGLE_CHAPTERS = "lyceum-pdfjs:toggle-chapters";
var EVT_TOGGLE_ANNOTATIONS = "lyceum-pdfjs:toggle-annotations";
var CMD_NAVIGATE = "lyceum-pdfjs:cmd-navigate";
var CMD_RESTORE = "lyceum-pdfjs:cmd-restore";
var CMD_GET_STATE = "lyceum-pdfjs:cmd-get-state";
var CMD_GET_OUTLINE = "lyceum-pdfjs:cmd-get-outline";
var CMD_SET_HIGHLIGHTS = "lyceum-pdfjs:key-concept-highlights";
var CMD_SET_CHAPTERS_STATE = "lyceum-pdfjs:chapters-state";
var CMD_SET_ANNOTATIONS_STATE = "lyceum-pdfjs:annotations-state";
function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function isFiniteNumber(value, { min = -Infinity } = {}) {
  return typeof value === "number" && Number.isFinite(value) && value >= min;
}
function isPdfViewState(value) {
  return isRecord(value) && Number.isInteger(value.page) && value.page > 0 && isFiniteNumber(value.currentScale, { min: 0 }) && value.currentScale > 0 && isFiniteNumber(value.scrollTop, { min: 0 }) && Number.isInteger(value.totalPages) && value.totalPages >= 0 && value.canAccess === true;
}
function isPdfSelectionRect(value) {
  return isRecord(value) && ["page", "left", "top", "width", "height"].every(
    (key) => isFiniteNumber(value[key])
  );
}
function isPdfSelectionPayload(value) {
  return isRecord(value) && typeof value.text === "string" && Number.isInteger(value.page) && value.page > 0 && Array.isArray(value.rects) && value.rects.every(isPdfSelectionRect);
}
function isOutlineNode(value) {
  if (!isRecord(value) || typeof value.title !== "string") {
    return false;
  }
  if (value.page !== null && !isFiniteNumber(value.page, { min: 1 })) {
    return false;
  }
  return Array.isArray(value.items) && value.items.every(isOutlineNode);
}
function isNavigateState(value) {
  return isRecord(value) && isFiniteNumber(value.page, { min: 1 }) && (value.currentScale === void 0 || isFiniteNumber(value.currentScale, { min: 0 })) && (value.scrollTop === void 0 || isFiniteNumber(value.scrollTop, { min: 0 }));
}
var CMD_SET_BOOK_LANDMARKS = "lyceum-pdfjs:book-landmarks";
function isBookLandmark(value) {
  return isRecord(value) && Number.isInteger(value.page) && value.page > 0 && (value.kind === "highlight" || value.kind === "note");
}

// src/core/pdf-reader-core/geometry.ts
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
function clusterIntoLines(items) {
  const lines = [];
  for (const item of items) {
    const rect = item.rects[0];
    if (!rect) {
      continue;
    }
    const center = (rect.top + rect.bottom) / 2;
    const threshold = Math.max(2, Math.min(8, rect.height * 0.45));
    let line = lines.find(
      (candidate) => Math.abs(candidate.center - center) <= candidate.threshold
    );
    if (!line) {
      line = {
        center,
        threshold,
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
        items: []
      };
      lines.push(line);
    }
    item.lineIndex = lines.indexOf(line);
    line.center = (line.center * line.items.length + center) / (line.items.length + 1);
    line.top = Math.min(line.top, rect.top);
    line.bottom = Math.max(line.bottom, rect.bottom);
    line.left = Math.min(line.left, ...item.rects.map((itemRect) => itemRect.left));
    line.right = Math.max(line.right, ...item.rects.map((itemRect) => itemRect.right));
    line.items.push(item);
  }
  return lines;
}
function mergeSelectionRects(rects) {
  if (rects.length <= 1) {
    return rects;
  }
  const sorted = rects.map((rect) => {
    const verticalInset = Math.min(1.5, rect.height * 0.12);
    return {
      left: rect.left,
      top: rect.top + verticalInset,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height - verticalInset
    };
  }).filter((rect) => rect.right - rect.left >= 0.5 && rect.bottom - rect.top >= 0.5).sort((a, b) => (a.top + a.bottom) / 2 - (b.top + b.bottom) / 2 || a.left - b.left);
  const lines = [];
  for (const rect of sorted) {
    const center = (rect.top + rect.bottom) / 2;
    const line = lines.find((candidate) => Math.abs(candidate.center - center) <= candidate.threshold);
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
        rects: [rect]
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
          height: line.bottom - line.top
        });
        current = { left: rect.left, right: rect.right };
      }
    }
    if (current) {
      merged.push({
        left: current.left,
        top: line.top,
        width: current.right - current.left,
        height: line.bottom - line.top
      });
    }
  }
  return merged;
}
function projectRectsToPage(rects, layerBounds, pageBounds, page) {
  if (pageBounds.width <= 0 || pageBounds.height <= 0) {
    return [];
  }
  const projected = [];
  for (const rect of rects) {
    projected.push({
      page,
      left: (layerBounds.left + rect.left - pageBounds.left) / pageBounds.width,
      top: (layerBounds.top + rect.top - pageBounds.top) / pageBounds.height,
      width: rect.width / pageBounds.width,
      height: rect.height / pageBounds.height
    });
  }
  return projected;
}

// src/core/pdf-reader-core/navigation-policy.ts
function createNavigationGuard() {
  let userNavigated = false;
  let pending = null;
  return {
    get userNavigated() {
      return userNavigated;
    },
    decide(mode, documentReady) {
      if (!documentReady) {
        if (mode === "navigate") {
          userNavigated = true;
        }
        return mode === "navigate" || !userNavigated ? { kind: "defer" } : { kind: "skip" };
      }
      if (mode === "restore" && userNavigated) {
        return { kind: "skip" };
      }
      if (mode === "navigate") {
        userNavigated = true;
      }
      return { kind: "apply" };
    },
    wait(state, mode) {
      pending = { state, mode };
    },
    consumePending() {
      const next = pending;
      pending = null;
      return next;
    }
  };
}

// src/core/pdf-reader-core/textModel.ts
function buildTextLayerModel(seeds, signature) {
  let cursor = 0;
  const items = [];
  for (const seed of seeds) {
    const start = cursor;
    const textLength = seed.text.length;
    const item = {
      key: seed.key,
      text: seed.text,
      rects: seed.rects,
      start,
      end: start + textLength,
      lineIndex: -1
    };
    cursor = item.end;
    items.push(item);
  }
  const lines = clusterIntoLines(items);
  lines.sort((a, b) => a.center - b.center || a.left - b.left);
  lines.forEach((line, index) => {
    line.items.sort((first, second) => first.start - second.start);
    for (const item of line.items) {
      item.lineIndex = index;
    }
  });
  return {
    signature,
    textLength: cursor,
    items,
    lines
  };
}

// src/core/pdf-reader-core/words.ts
var SEPARATOR_CHARS = new Set(' 	\n\r\v\f.,;:!?()[]{}|<>\xAB\xBB\u201C\u201D\u2018\u2019"\u201E\u2026\xB7/\\\u2013\u2014');
function isWordCharacter(char) {
  if (!char) {
    return false;
  }
  return !SEPARATOR_CHARS.has(char);
}
function findWordBounds(text, index) {
  if (!text) {
    return null;
  }
  const length = text.length;
  let offset = Math.max(0, Math.min(length - 1, index));
  if (!isWordCharacter(text[offset]) && offset > 0) {
    offset -= 1;
  }
  if (!isWordCharacter(text[offset])) {
    return null;
  }
  let start = offset;
  let end = offset + 1;
  while (start > 0 && isWordCharacter(text[start - 1])) {
    start -= 1;
  }
  while (end < length && isWordCharacter(text[end])) {
    end += 1;
  }
  return { start, end };
}

// src/core/pdf-reader-core/book-edge.ts
function edgePage(fraction, total) {
  return Math.max(1, Math.min(total, Math.floor(Math.max(0, fraction) * total) + 1));
}
function rifflePages(page, total, count) {
  const size = Math.min(total, count);
  const first = Math.max(1, Math.min(page - Math.floor(size / 2), total - size + 1));
  return Array.from({ length: size }, (_, index) => first + index);
}
function bookSections(outline, total) {
  const usable = (items) => items.flatMap((item) => item.page && item.page >= 1 && item.page <= total ? [item] : usable(item.items ?? []));
  const starts = [...new Map(usable(outline).sort((a, b) => a.page - b.page).map((item) => [item.page, item])).values()];
  if (!starts.length || starts[0]?.page !== 1) starts.unshift({ page: 1, title: starts.length ? "In\xEDcio" : "Livro" });
  return starts.map((item, index) => ({ title: item.title, page: item.page, end: (starts[index + 1]?.page ?? total + 1) - 1 }));
}
export {
  CMD_GET_OUTLINE,
  CMD_GET_STATE,
  CMD_NAVIGATE,
  CMD_RESTORE,
  CMD_SET_ANNOTATIONS_STATE,
  CMD_SET_BOOK_LANDMARKS,
  CMD_SET_CHAPTERS_STATE,
  CMD_SET_HIGHLIGHTS,
  EVT_CREATE_CONCEPT,
  EVT_DOCUMENT_READY,
  EVT_OUTLINE_LOADED,
  EVT_READY,
  EVT_RESTORE_COMPLETE,
  EVT_STATE_CHANGED,
  EVT_TOGGLE_ANNOTATIONS,
  EVT_TOGGLE_CHAPTERS,
  PDF_BRIDGE_VERSION,
  PDF_VIEWER_ORIGIN,
  bookSections,
  buildTextLayerModel,
  clusterIntoLines,
  createNavigationGuard,
  edgePage,
  findWordBounds,
  isBookLandmark,
  isNavigateState,
  isOutlineNode,
  isPdfSelectionPayload,
  isPdfSelectionRect,
  isPdfViewState,
  isRecord,
  isWordCharacter,
  makeLayerRect,
  mergeSelectionRects,
  projectRectsToPage,
  rifflePages
};
