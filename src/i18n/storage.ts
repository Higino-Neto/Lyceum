import { LANGUAGE_STORAGE_KEY } from "./config";

function getStorage(): Storage | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readStoredLanguage(): string | null {
  try {
    return getStorage()?.getItem(LANGUAGE_STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

export function writeStoredLanguage(code: string): void {
  try {
    getStorage()?.setItem(LANGUAGE_STORAGE_KEY, code);
  } catch {
    // Storage can be unavailable (private mode, quota, tests): ignore.
  }
}
