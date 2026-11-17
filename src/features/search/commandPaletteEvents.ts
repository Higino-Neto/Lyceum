export const OPEN_COMMAND_PALETTE_EVENT = "lyceum:open-command-palette";

/** Opens the global search (same as Ctrl/Cmd+K). */
export function openCommandPalette() {
  window.dispatchEvent(new CustomEvent(OPEN_COMMAND_PALETTE_EVENT));
}
