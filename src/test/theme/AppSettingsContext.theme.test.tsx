import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AppSettingsProvider,
  useAppSettings,
} from "../../contexts/AppSettingsContext";
import { APP_SETTINGS_STORAGE_KEY } from "../../theme/appearance";
import { resolveThemeTokens } from "../../theme/tokens";

const originalMatchMedia = window.matchMedia;

type MediaListener = () => void;

function installSystemTheme(initialMatches = false) {
  let matches = initialMatches;
  const listeners = new Set<MediaListener>();

  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    get matches() {
      return matches;
    },
    media: query,
    onchange: null,
    addListener: (listener: MediaListener) => listeners.add(listener),
    removeListener: (listener: MediaListener) => listeners.delete(listener),
    addEventListener: (_event: string, listener: MediaListener) =>
      listeners.add(listener),
    removeEventListener: (_event: string, listener: MediaListener) =>
      listeners.delete(listener),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;

  return {
    set(matchesValue: boolean) {
      matches = matchesValue;
      for (const listener of listeners) {
        listener();
      }
    },
  };
}

function resetDocumentRoot() {
  const root = document.documentElement;
  root.className = "";
  root.removeAttribute("style");
  root.removeAttribute("data-theme");
  root.removeAttribute("data-effective-theme");
  root.removeAttribute("data-accent-color");
  root.removeAttribute("data-reduced-effects");
}

function ThemeProbe() {
  const {
    settings,
    effectiveTheme,
    setTheme,
    setAccentColor,
    setReducedEffects,
  } = useAppSettings();

  return (
    <div>
      <output data-testid="theme">{settings.theme}</output>
      <output data-testid="effective">{effectiveTheme}</output>
      <output data-testid="accent">{settings.accentColor}</output>
      <output data-testid="reduced">{String(settings.reducedEffects)}</output>
      <button type="button" onClick={() => setTheme("light")}>
        light
      </button>
      <button type="button" onClick={() => setTheme("system")}>
        system
      </button>
      <button type="button" onClick={() => setAccentColor("cyan")}>
        cyan
      </button>
      <button type="button" onClick={() => setReducedEffects(true)}>
        reduce
      </button>
    </div>
  );
}

function renderProvider() {
  return render(
    <AppSettingsProvider>
      <ThemeProbe />
    </AppSettingsProvider>,
  );
}

function readPersistedSettings() {
  return JSON.parse(localStorage.getItem(APP_SETTINGS_STORAGE_KEY) ?? "{}");
}

beforeEach(() => {
  localStorage.clear();
  resetDocumentRoot();
  installSystemTheme(false);
});

afterEach(() => {
  window.matchMedia = originalMatchMedia;
  resetDocumentRoot();
  vi.restoreAllMocks();
});

describe("AppSettingsProvider theme integration", () => {
  it("applies and persists the default dark appearance on mount", () => {
    renderProvider();

    const root = document.documentElement;
    const tokens = resolveThemeTokens("dark", "green");

    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
    expect(screen.getByTestId("effective")).toHaveTextContent("dark");
    expect(root.classList.contains("lyceum-theme-dark")).toBe(true);
    expect(root.dataset.accentColor).toBe("green");
    expect(root.style.getPropertyValue("--background")).toBe(tokens.background);
    expect(root.style.getPropertyValue("--primary")).toBe(tokens.primary);
    expect(readPersistedSettings()).toMatchObject({
      theme: "dark",
      accentColor: "green",
    });
  });

  it("hydrates a persisted light appearance and accent", () => {
    localStorage.setItem(
      APP_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        theme: "light",
        accentColor: "blue",
        reducedEffects: true,
      }),
    );

    renderProvider();

    const root = document.documentElement;
    const tokens = resolveThemeTokens("light", "blue");

    expect(screen.getByTestId("theme")).toHaveTextContent("light");
    expect(screen.getByTestId("effective")).toHaveTextContent("light");
    expect(screen.getByTestId("accent")).toHaveTextContent("blue");
    expect(screen.getByTestId("reduced")).toHaveTextContent("true");
    expect(root.classList.contains("lyceum-theme-light")).toBe(true);
    expect(root.dataset.effectiveTheme).toBe("light");
    expect(root.dataset.accentColor).toBe("blue");
    expect(root.dataset.reducedEffects).toBe("true");
    expect(root.style.getPropertyValue("--background")).toBe(tokens.background);
    expect(root.style.getPropertyValue("--primary")).toBe(tokens.primary);
  });

  it("updates the document and persistence when the user changes appearance", () => {
    renderProvider();

    fireEvent.click(screen.getByRole("button", { name: "light" }));
    fireEvent.click(screen.getByRole("button", { name: "cyan" }));
    fireEvent.click(screen.getByRole("button", { name: "reduce" }));

    const root = document.documentElement;
    const tokens = resolveThemeTokens("light", "cyan");

    expect(screen.getByTestId("theme")).toHaveTextContent("light");
    expect(root.classList.contains("lyceum-theme-light")).toBe(true);
    expect(root.classList.contains("lyceum-theme-dark")).toBe(false);
    expect(root.dataset.accentColor).toBe("cyan");
    expect(root.dataset.reducedEffects).toBe("true");
    expect(root.style.getPropertyValue("--primary")).toBe(tokens.primary);
    expect(root.style.getPropertyValue("--accent-700")).toBe("#0e7490");
    expect(readPersistedSettings()).toMatchObject({
      theme: "light",
      accentColor: "cyan",
      reducedEffects: true,
    });
  });

  it("follows system appearance changes while the preference is system", () => {
    const system = installSystemTheme(false);
    renderProvider();

    fireEvent.click(screen.getByRole("button", { name: "system" }));
    expect(screen.getByTestId("effective")).toHaveTextContent("dark");

    act(() => {
      system.set(true);
    });

    expect(screen.getByTestId("effective")).toHaveTextContent("light");
    expect(document.documentElement.classList.contains("lyceum-theme-light")).toBe(
      true,
    );
    expect(document.documentElement.dataset.theme).toBe("system");
  });

  it("sanitizes invalid persisted appearance values", () => {
    localStorage.setItem(
      APP_SETTINGS_STORAGE_KEY,
      JSON.stringify({ theme: "sepia", accentColor: "orange" }),
    );

    renderProvider();

    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
    expect(screen.getByTestId("accent")).toHaveTextContent("green");
    expect(document.documentElement.dataset.accentColor).toBe("green");
  });
});
