import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import type { SupportedStorage } from "@supabase/supabase-js";

/**
 * Supabase session storage for the Capacitor app. The prefix and the legacy
 * localStorage fallback must stay stable: changing them signs every mobile user out.
 */
export const MOBILE_AUTH_STORAGE_PREFIX = "lyceum.mobile.auth.";

export const capacitorAuthStorage: SupportedStorage = {
  async getItem(key) {
    const namespacedKey = `${MOBILE_AUTH_STORAGE_PREFIX}${key}`;
    if (Capacitor.isNativePlatform()) {
      const stored = (await Preferences.get({ key: namespacedKey })).value;
      if (stored) return stored;
      try {
        const legacy = localStorage.getItem(key);
        if (legacy) await Preferences.set({ key: namespacedKey, value: legacy });
        return legacy;
      } catch {
        return null;
      }
    }
    try {
      return localStorage.getItem(namespacedKey) || localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  async setItem(key, value) {
    const namespacedKey = `${MOBILE_AUTH_STORAGE_PREFIX}${key}`;
    if (Capacitor.isNativePlatform()) {
      await Preferences.set({ key: namespacedKey, value });
      return;
    }
    localStorage.setItem(namespacedKey, value);
  },
  async removeItem(key) {
    const namespacedKey = `${MOBILE_AUTH_STORAGE_PREFIX}${key}`;
    if (Capacitor.isNativePlatform()) {
      await Preferences.remove({ key: namespacedKey });
      try { localStorage.removeItem(key); } catch { /* legacy WebView storage may be unavailable */ }
      return;
    }
    localStorage.removeItem(namespacedKey);
    localStorage.removeItem(key);
  },
};
