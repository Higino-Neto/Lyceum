import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";

export type AppTheme = "system" | "light" | "dark";
export type EffectiveTheme = "light" | "dark";
export type AccentColorId =
  | "green"
  | "blue"
  | "violet"
  | "amber"
  | "rose"
  | "cyan";

interface AccentColor {
  id: AccentColorId;
  label: string;
  swatch: string;
  foreground: string;
  palette: Record<number, string>;
}

export const ACCENT_COLORS: AccentColor[] = [
  {
    id: "green",
    label: "Verde",
    swatch: "#16a34a",
    foreground: "#ffffff",
    palette: {
      50: "#f0fdf4",
      100: "#dcfce7",
      200: "#bbf7d0",
      300: "#86efac",
      400: "#4ade80",
      500: "#22c55e",
      600: "#16a34a",
      700: "#15803d",
      800: "#166534",
      900: "#14532d",
      950: "#052e16",
    },
  },
  {
    id: "blue",
    label: "Azul",
    swatch: "#2563eb",
    foreground: "#ffffff",
    palette: {
      50: "#eff6ff",
      100: "#dbeafe",
      200: "#bfdbfe",
      300: "#93c5fd",
      400: "#60a5fa",
      500: "#3b82f6",
      600: "#2563eb",
      700: "#1d4ed8",
      800: "#1e40af",
      900: "#1e3a8a",
      950: "#172554",
    },
  },
  {
    id: "violet",
    label: "Violeta",
    swatch: "#7c3aed",
    foreground: "#ffffff",
    palette: {
      50: "#f5f3ff",
      100: "#ede9fe",
      200: "#ddd6fe",
      300: "#c4b5fd",
      400: "#a78bfa",
      500: "#8b5cf6",
      600: "#7c3aed",
      700: "#6d28d9",
      800: "#5b21b6",
      900: "#4c1d95",
      950: "#2e1065",
    },
  },
  {
    id: "amber",
    label: "Âmbar",
    swatch: "#d97706",
    foreground: "#1c1917",
    palette: {
      50: "#fffbeb",
      100: "#fef3c7",
      200: "#fde68a",
      300: "#fcd34d",
      400: "#fbbf24",
      500: "#f59e0b",
      600: "#d97706",
      700: "#b45309",
      800: "#92400e",
      900: "#78350f",
      950: "#451a03",
    },
  },
  {
    id: "rose",
    label: "Rosa",
    swatch: "#e11d48",
    foreground: "#ffffff",
    palette: {
      50: "#fff1f2",
      100: "#ffe4e6",
      200: "#fecdd3",
      300: "#fda4af",
      400: "#fb7185",
      500: "#f43f5e",
      600: "#e11d48",
      700: "#be123c",
      800: "#9f1239",
      900: "#881337",
      950: "#4c0519",
    },
  },
  {
    id: "cyan",
    label: "Ciano",
    swatch: "#0891b2",
    foreground: "#ffffff",
    palette: {
      50: "#ecfeff",
      100: "#cffafe",
      200: "#a5f3fc",
      300: "#67e8f9",
      400: "#22d3ee",
      500: "#06b6d4",
      600: "#0891b2",
      700: "#0e7490",
      800: "#155e75",
      900: "#164e63",
      950: "#083344",
    },
  },
];

interface AppSettings {
  theme: AppTheme;
  accentColor: AccentColorId;
  copyYesterdayReadings: boolean;
  autoHideEnabled: boolean;
  autoHideOverlay: boolean;
  showSubfolderBooks: boolean;
  unifiedLibraryView: boolean;
}

interface AppSettingsContextValue {
  settings: AppSettings;
  effectiveTheme: EffectiveTheme;
  setTheme: (theme: AppTheme) => void;
  setAccentColor: (accentColor: AccentColorId) => void;
  setCopyYesterdayReadings: (value: boolean) => void;
  setAutoHideEnabled: (value: boolean) => void;
  setAutoHideOverlay: (value: boolean) => void;
  setShowSubfolderBooks: (value: boolean) => void;
  setUnifiedLibraryView: (value: boolean) => void;
}

const SETTINGS_STORAGE_KEY = "lyceum:app-settings";
const DEFAULT_SETTINGS: AppSettings = {
  theme: "dark",
  accentColor: "green",
  copyYesterdayReadings: false,
  autoHideEnabled: false,
  autoHideOverlay: false,
  showSubfolderBooks: false,
  unifiedLibraryView: false,
};

const AppSettingsContext = createContext<AppSettingsContextValue | null>(null);

function getSystemTheme(): EffectiveTheme {
  if (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: light)").matches
  ) {
    return "light";
  }

  return "dark";
}

const LEGACY_AUTO_HIDE_KEY = "lyceum_auto_hide";
const LEGACY_AUTO_HIDE_OVERLAY_KEY = "lyceum_auto_hide_overlay";

function loadLegacyAutoHideSettings(): { autoHideEnabled: boolean; autoHideOverlay: boolean } {
  try {
    const autoHide = localStorage.getItem(LEGACY_AUTO_HIDE_KEY);
    const autoHideOverlay = localStorage.getItem(LEGACY_AUTO_HIDE_OVERLAY_KEY);
    return {
      autoHideEnabled: autoHide === "true",
      autoHideOverlay: autoHideOverlay === "true",
    };
  } catch {
    return {
      autoHideEnabled: false,
      autoHideOverlay: false,
    };
  }
}

function loadSettings(): AppSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
    const legacy = loadLegacyAutoHideSettings();

    if (!stored) {
      return {
        ...DEFAULT_SETTINGS,
        autoHideEnabled: legacy.autoHideEnabled,
        autoHideOverlay: legacy.autoHideOverlay,
      };
    }

    const parsed = JSON.parse(stored) as Partial<AppSettings>;
    return {
      theme: parsed.theme || DEFAULT_SETTINGS.theme,
      accentColor: parsed.accentColor || DEFAULT_SETTINGS.accentColor,
      copyYesterdayReadings: parsed.copyYesterdayReadings ?? DEFAULT_SETTINGS.copyYesterdayReadings,
      autoHideEnabled: parsed.autoHideEnabled ?? legacy.autoHideEnabled,
      autoHideOverlay: parsed.autoHideOverlay ?? legacy.autoHideOverlay,
      showSubfolderBooks: parsed.showSubfolderBooks ?? DEFAULT_SETTINGS.showSubfolderBooks,
      unifiedLibraryView: parsed.unifiedLibraryView ?? DEFAULT_SETTINGS.unifiedLibraryView,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.warn("Failed to save app settings:", error);
  }
}

function getAccentColor(accentColor: AccentColorId): AccentColor {
  return (
    ACCENT_COLORS.find((color) => color.id === accentColor) ||
    ACCENT_COLORS[0]
  );
}

function applyThemeToDocument(
  effectiveTheme: EffectiveTheme,
  theme: AppTheme,
  accentColor: AccentColorId,
) {
  const root = document.documentElement;
  const accent = getAccentColor(accentColor);

  root.classList.toggle("lyceum-theme-light", effectiveTheme === "light");
  root.classList.toggle("lyceum-theme-dark", effectiveTheme === "dark");
  root.dataset.theme = theme;
  root.dataset.effectiveTheme = effectiveTheme;
  root.dataset.accentColor = accentColor;
  root.style.colorScheme = effectiveTheme;

  for (const [step, value] of Object.entries(accent.palette)) {
    root.style.setProperty(`--accent-${step}`, value);
  }
  root.style.setProperty("--accent-foreground", accent.foreground);
}

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [systemTheme, setSystemTheme] = useState<EffectiveTheme>(getSystemTheme);
  const effectiveTheme =
    settings.theme === "system" ? systemTheme : settings.theme;

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const handleChange = () => setSystemTheme(getSystemTheme());

    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    applyThemeToDocument(
      effectiveTheme,
      settings.theme,
      settings.accentColor,
    );
  }, [effectiveTheme, settings.accentColor, settings.theme]);

  const value = useMemo<AppSettingsContextValue>(
    () => ({
      settings,
      effectiveTheme,
      setTheme: (theme) =>
        setSettings((current) => ({
          ...current,
          theme,
        })),
      setAccentColor: (accentColor) =>
        setSettings((current) => ({
          ...current,
          accentColor,
        })),
      setCopyYesterdayReadings: (value) =>
        setSettings((current) => ({
          ...current,
          copyYesterdayReadings: value,
        })),
      setAutoHideEnabled: (value) =>
        setSettings((current) => ({
          ...current,
          autoHideEnabled: value,
        })),
      setAutoHideOverlay: (value) =>
        setSettings((current) => ({
          ...current,
          autoHideOverlay: value,
        })),
      setShowSubfolderBooks: (value) =>
        setSettings((current) => ({
          ...current,
          showSubfolderBooks: value,
        })),
      setUnifiedLibraryView: (value) =>
        setSettings((current) => ({
          ...current,
          unifiedLibraryView: value,
        })),
    }),
    [effectiveTheme, settings],
  );

  return (
    <AppSettingsContext.Provider value={value}>
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings() {
  const context = useContext(AppSettingsContext);
  if (!context) {
    throw new Error("useAppSettings must be used within AppSettingsProvider");
  }
  return context;
}
