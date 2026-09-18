import { useEffect } from "react";
import toast from "react-hot-toast";

interface UseLibraryEventsOptions {
  enabled: boolean;
  refresh: () => Promise<void>;
}

/** Owns subscriptions from the native library boundary to renderer state. */
export function useLibraryEvents({ enabled, refresh }: UseLibraryEventsOptions) {
  useEffect(() => {
    if (!enabled) return;
    return window.api.onLibraryUpdated(() => { void refresh(); });
  }, [enabled, refresh]);

  useEffect(() => {
    if (!enabled) return;
    return window.api.onLibraryNotification((notification) => {
      if (notification.type === "error") {
        toast.error(notification.message);
      } else if (notification.type === "warning") {
        toast(notification.message, {
          icon: "⚠️",
          style: {
            background: "#1c1917",
            border: "1px solid #d97706",
            color: "#fbbf24",
          },
        });
      } else {
        toast.success(notification.message);
      }
    });
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    return window.api.onUsbDevicesUpdated(() => { void refresh(); });
  }, [enabled, refresh]);
}
