/// <reference types="vitest/globals" />
import "@testing-library/jest-dom";
import { cleanup } from "@testing-library/react";
import { i18next } from "../i18n";
import { DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY } from "../i18n/config";

// Importing the i18n module boots the shared i18next instance. Tests always run
// with the default language and no persisted preference so assertions on user
// facing copy stay deterministic.
beforeEach(async () => {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(LANGUAGE_STORAGE_KEY);
  }
  if (i18next.language !== DEFAULT_LANGUAGE) {
    await i18next.changeLanguage(DEFAULT_LANGUAGE);
  }
});

afterEach(() => {
  if (typeof window !== "undefined") {
    cleanup();
  }
});

if (typeof window !== "undefined") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}
