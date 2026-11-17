export const OPEN_WHATS_NEW_EVENT = "lyceum:open-whats-new";

/** Opens the "What's new" dialog from anywhere in the renderer. */
export function openWhatsNew() {
  window.dispatchEvent(new CustomEvent(OPEN_WHATS_NEW_EVENT));
}
