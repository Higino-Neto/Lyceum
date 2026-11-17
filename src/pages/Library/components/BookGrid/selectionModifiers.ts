import type { MouseEvent } from "react";

/** Keyboard modifiers held while clicking a book, for Ctrl/Shift multi-select. */
export interface SelectionModifiers {
  /** Shift: select the range from the last anchor to this book. */
  shiftKey: boolean;
  /** Ctrl (or Cmd on macOS): toggle this book in the selection. */
  ctrlKey: boolean;
}

export function getSelectionModifiers(event: MouseEvent): SelectionModifiers {
  return { shiftKey: event.shiftKey, ctrlKey: event.ctrlKey || event.metaKey };
}
