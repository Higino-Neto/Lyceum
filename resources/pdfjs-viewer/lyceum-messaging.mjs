// The viewer runs in a separate origin. Keep all cross-frame messages here so
// new reader features share one versioned transport and one origin check.
export const PDF_BRIDGE_VERSION = 1;

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

export function isParentMessage(event, type) {
  if (event.source !== window.parent || !event.data || typeof event.data !== "object") {
    return false;
  }
  const expectedOrigin = parentOrigin();
  return (expectedOrigin === "*" || event.origin === expectedOrigin) &&
    event.data.version === PDF_BRIDGE_VERSION && event.data.type === type;
}
