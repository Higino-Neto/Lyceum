import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import type { NavigationRouteId } from "../navigation/routes";
import {
  ACCENT_COLORS,
  DEFAULT_ACCENT_COLOR,
  isAccentColorId,
  type AccentColorId,
} from "../theme/palettes";
import {
  APP_SETTINGS_STORAGE_KEY,
  DEFAULT_APP_THEME,
  applyThemeToDocument,
  getSystemTheme,
  isAppTheme,
  resolveEffectiveTheme,
  type AppTheme,
  type EffectiveTheme,
} from "../theme/appearance";

// Kept as public re-exports for existing consumers (settings UI, tests).
export { ACCENT_COLORS };
export type { AccentColorId, AppTheme, EffectiveTheme };

export interface AppSettings {
  theme: AppTheme;
  accentColor: AccentColorId;
  copyYesterdayReadings: boolean;
  autoHideEnabled: boolean;
  autoHideOverlay: boolean;
  showSubfolderBooks: boolean;
  unifiedLibraryView: boolean;
  betaAtlasEnabled: boolean;
  betaConversionEnabled: boolean;
  betaHabitsEnabled: boolean;
  reducedEffects: boolean;
  hotkeysEnabled: boolean;
  hotkeysCustomized: boolean;
  hotkeyBindings: Partial<Record<NavigationRouteId, string>>;
  weeklyBackupEnabled: boolean;
  backupDocuments: boolean;
  backupHabits: boolean;
  backupCategories: boolean;
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
  setBetaAtlasEnabled: (value: boolean) => void;
  setBetaConversionEnabled: (value: boolean) => void;
  setBetaHabitsEnabled: (value: boolean) => void;
  setReducedEffects: (value: boolean) => void;
  setHotkeysEnabled: (value: boolean) => void;
  setHotkeyBinding: (routeId: NavigationRouteId, key: string) => void;
  resetHotkeyBindings: () => void;
  setWeeklyBackupEnabled: (value: boolean) => void;
  setBackupSelection: (key: "backupDocuments" | "backupHabits" | "backupCategories", value: boolean) => void;
}

const DEFAULT_SETTINGS: AppSettings = {
  theme: DEFAULT_APP_THEME,
  accentColor: DEFAULT_ACCENT_COLOR,
  copyYesterdayReadings: false,
  autoHideEnabled: false,
  autoHideOverlay: false,
  showSubfolderBooks: false,
  unifiedLibraryView: false,
  betaAtlasEnabled: true,
  betaConversionEnabled: true,
  betaHabitsEnabled: true,
  reducedEffects: false,
  hotkeysEnabled: true,
  hotkeysCustomized: false,
  hotkeyBindings: {},
  weeklyBackupEnabled: true,
  backupDocuments: true,
  backupHabits: true,
  backupCategories: true,
};

const AppSettingsContext = createContext<AppSettingsContextValue | null>(null);

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
    const stored = localStorage.getItem(APP_SETTINGS_STORAGE_KEY);
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
      theme: isAppTheme(parsed.theme) ? parsed.theme : DEFAULT_SETTINGS.theme,
      accentColor: isAccentColorId(parsed.accentColor)
        ? parsed.accentColor
        : DEFAULT_SETTINGS.accentColor,
      copyYesterdayReadings: parsed.copyYesterdayReadings ?? DEFAULT_SETTINGS.copyYesterdayReadings,
      autoHideEnabled: parsed.autoHideEnabled ?? legacy.autoHideEnabled,
      autoHideOverlay: parsed.autoHideOverlay ?? legacy.autoHideOverlay,
      showSubfolderBooks: parsed.showSubfolderBooks ?? DEFAULT_SETTINGS.showSubfolderBooks,
      unifiedLibraryView: parsed.unifiedLibraryView ?? DEFAULT_SETTINGS.unifiedLibraryView,
      betaAtlasEnabled: parsed.betaAtlasEnabled ?? DEFAULT_SETTINGS.betaAtlasEnabled,
      betaConversionEnabled:
        parsed.betaConversionEnabled ?? DEFAULT_SETTINGS.betaConversionEnabled,
      betaHabitsEnabled: parsed.betaHabitsEnabled ?? DEFAULT_SETTINGS.betaHabitsEnabled,
      reducedEffects: parsed.reducedEffects ?? DEFAULT_SETTINGS.reducedEffects,
      hotkeysEnabled: parsed.hotkeysEnabled ?? DEFAULT_SETTINGS.hotkeysEnabled,
      hotkeysCustomized: parsed.hotkeysCustomized ?? DEFAULT_SETTINGS.hotkeysCustomized,
      hotkeyBindings: parsed.hotkeyBindings ?? DEFAULT_SETTINGS.hotkeyBindings,
      weeklyBackupEnabled: parsed.weeklyBackupEnabled ?? DEFAULT_SETTINGS.weeklyBackupEnabled,
      backupDocuments: parsed.backupDocuments ?? DEFAULT_SETTINGS.backupDocuments,
      backupHabits: parsed.backupHabits ?? DEFAULT_SETTINGS.backupHabits,
      backupCategories: parsed.backupCategories ?? DEFAULT_SETTINGS.backupCategories,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.warn("Failed to save app settings:", error);
  }
}

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [systemTheme, setSystemTheme] = useState<EffectiveTheme>(getSystemTheme);
  const effectiveTheme = resolveEffectiveTheme(settings.theme, systemTheme);

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

  useEffect(() => {
    document.documentElement.dataset.reducedEffects = settings.reducedEffects
      ? "true"
      : "false";
  }, [settings.reducedEffects]);

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
      setBetaAtlasEnabled: (value) =>
        setSettings((current) => ({
          ...current,
          betaAtlasEnabled: value,
        })),
      setBetaConversionEnabled: (value) =>
        setSettings((current) => ({
          ...current,
          betaConversionEnabled: value,
        })),
      setBetaHabitsEnabled: (value) =>
        setSettings((current) => ({
          ...current,
          betaHabitsEnabled: value,
        })),
      setReducedEffects: (value) =>
        setSettings((current) => ({
          ...current,
          reducedEffects: value,
        })),
      setHotkeysEnabled: (value) =>
        setSettings((current) => ({ ...current, hotkeysEnabled: value })),
      setHotkeyBinding: (routeId, key) =>
        setSettings((current) => {
          const hotkeyBindings = Object.fromEntries(
            Object.entries(current.hotkeyBindings).filter(
              ([id, assignedKey]) => id === routeId || assignedKey !== key,
            ),
          );
          return {
            ...current,
            hotkeysCustomized: true,
            hotkeyBindings: { ...hotkeyBindings, [routeId]: key },
          };
        }),
      resetHotkeyBindings: () =>
        setSettings((current) => ({
          ...current,
          hotkeysCustomized: false,
          hotkeyBindings: {},
        })),
      setWeeklyBackupEnabled: (value) =>
        setSettings((current) => ({ ...current, weeklyBackupEnabled: value })),
      setBackupSelection: (key, value) =>
        setSettings((current) => ({ ...current, [key]: value })),
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
