/**
 * Guards for app-level Ctrl/Cmd+C/X/V shortcuts that act on *files* (copying
 * selected books, cutting folders...). The browser's own text clipboard must
 * always win: when the user has text selected, is typing, or is working inside
 * a dialog layered over the page, the shortcut belongs to the focused content.
 */
export function hasTextSelection(doc: Document = document): boolean {
  const selection = doc.getSelection?.();
  return Boolean(selection && !selection.isCollapsed && selection.toString().trim().length > 0);
}

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return target.matches("input, textarea, select, [contenteditable=''], [contenteditable='true']");
}

/** True when the event originated in (or focus sits in) a modal dialog or popover over the page. */
export function isInsideOverlay(target: EventTarget | null): boolean {
  const element = target instanceof Element ? target : null;
  if (element?.closest("[role='dialog'], [role='alertdialog'], [aria-modal='true'], [role='menu']")) return true;
  // A dialog can be open while focus stays on <body> (e.g. after clicking text).
  return Boolean(document.querySelector("[aria-modal='true']"));
}

/**
 * Whether a file clipboard shortcut may run for this keyboard event. Returns
 * false whenever the native text clipboard should handle it instead.
 */
export function shouldHandleFileClipboardShortcut(event: KeyboardEvent): boolean {
  if (event.defaultPrevented) return false;
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return false;
  if (isEditableTarget(event.target) || isEditableTarget(document.activeElement)) return false;
  if (isInsideOverlay(event.target)) return false;
  const key = event.key.toLowerCase();
  if ((key === "c" || key === "x") && hasTextSelection()) return false;
  return true;
}
