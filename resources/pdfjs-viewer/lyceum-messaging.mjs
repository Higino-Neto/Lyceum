// The viewer runs in a separate origin. Keep all cross-frame transport here so
// new reader features share one versioned channel, one origin check and one
// protocol table (imported from the generated, shared core).
import { PDF_BRIDGE_VERSION } from "./lyceum-core.mjs";

function parentOrigin() {
  try {
    const origin = new URL(document.referrer).origin;
    return origin === "null" ? "*" : origin;
  } catch {
    return "*"; // Packaged file:// pages often have no usable referrer.
  }
}

export function postToParent(type, payload = {}) {
  window.parent?.postMessage({ version: PDF_BRIDGE_VERSION, type, ...payload }, parentOrigin());
}

export function isParentEvent(event) {
  if (event.source !== window.parent || !event.data || typeof event.data !== "object") {
    return false;
  }
  const expectedOrigin = parentOrigin();
  return (expectedOrigin === "*" || event.origin === expectedOrigin) &&
    event.data.version === PDF_BRIDGE_VERSION;
}

export function isParentMessage(event, type) {
  return isParentEvent(event) && event.data.type === type;
}