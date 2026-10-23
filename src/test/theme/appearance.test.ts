import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  APP_SETTINGS_STORAGE_KEY,
  DEFAULT_APP_THEME,
  applyThemeToDocument,
  getSystemTheme,
  isAppTheme,
  parseStoredAppearance,
  readStoredAppearance,
  resolveEffectiveTheme,
} from "../../theme/appearance";
import { DEFAULT_ACCENT_COLOR } from "../../theme/palettes";
import { resolveThemeTokens } from "../../theme/tokens";

const originalMatchMedia = window.matchMedia;

function resetDocumentRoot() {
  const root = document.documentElement;
  root.className = "";
  root.removeAttribute("data-theme");
  root.removeAttribute("data-effective-theme");
  root.removeAttribute("data-accent-color");
  root.removeAttribute("data-reduced-effects");
  root.removeAttribute("style");
}

function mockSystemTheme(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  localStorage.clear();
  resetDocumentRoot();
});

afterEach(() => {
  window.matchMedia = originalMatchMedia;
  resetDocumentRoot();
  vi.restoreAllMocks();
});

describe("appearance resolution", () => {
  it("validates saved theme values", () => {
    expect(isAppTheme("system")).toBe(true);
    expect(isAppTheme("light")).toBe(true);
    expect(isAppTheme("dark")).toBe(true);
    expect(isAppTheme("sepia")).toBe(false);
    expect(isAppTheme(undefined)).toBe(false);
  });

  it("reads the system appearance", () => {
    mockSystemTheme(true);
    expect(getSystemTheme()).toBe("light");

    mockSystemTheme(false);
    expect(getSystemTheme()).toBe("dark");
  });

  it("lets explicit preferences override the system appearance", () => {
    expect(resolveEffectiveTheme("light", "dark")).toBe("light");
    expect(resolveEffectiveTheme("dark", "light")).toBe("dark");
    expect(resolveEffectiveTheme("system", "light")).toBe("light");
    expect(resolveEffectiveTheme("system", "dark")).toBe("dark");
    expect(resolveEffectiveTheme("unknown", "light")).toBe("light");
  });
});

describe("stored appearance", () => {
  it("parses a valid persisted payload", () => {
    expect(
      parseStoredAppearance(
        JSON.stringify({
          theme: "light",
          accentColor: "violet",
          reducedEffects: true,
        }),
      ),
    ).toEqual({
      theme: "light",
      accentColor: "violet",
      reducedEffects: true,
    });
  });

  it("sanitizes unknown or missing fields", () => {
    expect(parseStoredAppearance(null)).toEqual({
      theme: DEFAULT_APP_THEME,
      accentColor: DEFAULT_ACCENT_COLOR,
      reducedEffects: false,
    });
    expect(
      parseStoredAppearance(
        JSON.stringify({
          theme: "sepia",
          accentColor: "orange",
          reducedEffects: "yes",
        }),
      ),
    ).toEqual({
      theme: DEFAULT_APP_THEME,
      accentColor: DEFAULT_ACCENT_COLOR,
      reducedEffects: false,
    });
    expect(parseStoredAppearance("{not-json")).toEqual({
      theme: DEFAULT_APP_THEME,
      accentColor: DEFAULT_ACCENT_COLOR,
      reducedEffects: false,
    });
  });

  it("reads the appearance from the shared settings key", () => {
    localStorage.setItem(
      APP_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        theme: "system",
        accentColor: "blue",
        reducedEffects: true,
        unrelatedSetting: "ignored",
      }),
    );

    expect(readStoredAppearance()).toEqual({
      theme: "system",
      accentColor: "blue",
      reducedEffects: true,
    });
  });
});

describe("document application", () => {
  it("applies theme classes, datasets and semantic variables", () => {
    applyThemeToDocument("light", "light", "blue");

    const root = document.documentElement;
    const tokens = resolveThemeTokens("light", "blue");

    expect(root.classList.contains("lyceum-theme-light")).toBe(true);
    expect(root.classList.contains("lyceum-theme-dark")).toBe(false);
    expect(root.dataset.theme).toBe("light");
    expect(root.dataset.effectiveTheme).toBe("light");
    expect(root.dataset.accentColor).toBe("blue");
    expect(root.style.colorScheme).toBe("light");

    expect(root.style.getPropertyValue("--background")).toBe(tokens.background);
    expect(root.style.getPropertyValue("--foreground")).toBe(tokens.foreground);
    expect(root.style.getPropertyValue("--primary")).toBe(tokens.primary);
    expect(root.style.getPropertyValue("--accent-700")).toBe("#1d4ed8");
    expect(root.style.getPropertyValue("--accent-foreground")).toBe("#ffffff");
  });

  it("switches from dark to light without leaving stale classes", () => {
    applyThemeToDocument("dark", "dark", "green");
    applyThemeToDocument("light", "system", "rose");

    const root = document.documentElement;
    const tokens = resolveThemeTokens("light", "rose");

    expect(root.classList.contains("lyceum-theme-dark")).toBe(false);
    expect(root.classList.contains("lyceum-theme-light")).toBe(true);
    expect(root.dataset.theme).toBe("system");
    expect(root.dataset.effectiveTheme).toBe("light");
    expect(root.dataset.accentColor).toBe("rose");
    expect(root.style.getPropertyValue("--background")).toBe(tokens.background);
    expect(root.style.getPropertyValue("--primary")).toBe(tokens.primary);
    expect(root.style.getPropertyValue("--accent-700")).toBe("#be123c");
  });

  it("falls back safely for unknown accents and themes", () => {
    applyThemeToDocument("dark", "unsupported" as never, "orange");

    const root = document.documentElement;
    const tokens = resolveThemeTokens("dark", "green");

    expect(root.dataset.theme).toBe(DEFAULT_APP_THEME);
    expect(root.dataset.accentColor).toBe(DEFAULT_ACCENT_COLOR);
    expect(root.style.getPropertyValue("--primary")).toBe(tokens.primary);
  });

  it("keeps the accent palette independent from appearance", () => {
    applyThemeToDocument("light", "light", "amber");
    const lightPrimary = document.documentElement.style.getPropertyValue("--primary");

    applyThemeToDocument("dark", "dark", "amber");
    const darkPrimary = document.documentElement.style.getPropertyValue("--primary");

    expect(lightPrimary).toBe("#b45309");
    expect(darkPrimary).toBe("#fbbf24");
    expect(darkPrimary).not.toBe(lightPrimary);
  });
});
