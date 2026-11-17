import { useEffect, useRef } from "react";

/**
 * Android back gesture / browser back for the single-page mobile app.
 *
 * Native side (`MainActivity`) turns the system back into `history.back()`.
 * While the app is not at its root we keep one extra history entry; when it is
 * popped, a cancelable `lyceum:back` event lets open layers (sheets, word
 * cards) close themselves first. If nobody handles it, `onNavigateUp` runs.
 */
export const BACK_EVENT = "lyceum:back";
const MARKER = "lyceum-layer";

export function useBackNavigation(atRoot: boolean, onNavigateUp: () => void) {
  const navigateUp = useRef(onNavigateUp);
  navigateUp.current = onNavigateUp;
  const rootRef = useRef(atRoot);
  rootRef.current = atRoot;

  useEffect(() => {
    if (!atRoot && (window.history.state as { marker?: string } | null)?.marker !== MARKER) {
      window.history.pushState({ marker: MARKER }, "");
    }
  }, [atRoot]);

  useEffect(() => {
    const onPopState = () => {
      const event = new Event(BACK_EVENT, { cancelable: true });
      window.dispatchEvent(event);
      if (event.defaultPrevented) {
        window.history.pushState({ marker: MARKER }, "");
        return;
      }
      if (!rootRef.current) navigateUp.current();
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
}
