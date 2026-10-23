import {
  ACCENT_PALETTE_STEPS,
  DEFAULT_ACCENT_COLOR,
  getAccentColor,
  isAccentColorId,
  type AccentColorId,
} from "./palettes";
import {
  resolveThemeTokens,
  toCssCustomProperties,
  type EffectiveTheme,
} from "./tokens";

export type { EffectiveTheme } from "./tokens";

export const APP_SETTINGS_STORAGE_KEY = "lyceum:app-settings";
export const DEFAULT_APP_THEME: AppTheme = "dark";

export type AppTheme = "system" | "light" | "dark";

export interface StoredAppearance {
  theme: AppTheme;
  accentColor: AccentColorId;
  reducedEffects: boolean;
}

export function isAppTheme(value: unknown): value is AppTheme {
  return value === "system" || value === "light" || value === "dark";
}

export function getSystemTheme(): EffectiveTheme {
  if (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: light)").matches
  ) {
    return "light";
  }

  return "dark";
}

/**
 * Resolves the effective appearance independently from the saved preference:
 * `system` follows the OS, while `light`/`dark` are explicit.
 */
export function resolveEffectiveTheme(
  theme: unknown,
  systemTheme: EffectiveTheme = getSystemTheme(),
): EffectiveTheme {
  if (theme === "light" || theme === "dark") {
    return theme;
  }
  return systemTheme === "light" ? "light" : "dark";
}

export function parseStoredAppearance(raw: string | null): StoredAppearance {
  if (!raw) {
    return {
      theme: DEFAULT_APP_THEME,
      accentColor: DEFAULT_ACCENT_COLOR,
      reducedEffects: false,
    };
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown> | null;
    if (!parsed || typeof parsed !== "object") {
      throw new Error("invalid settings payload");
    }

    return {
      theme: isAppTheme(parsed.theme) ? parsed.theme : DEFAULT_APP_THEME,
      accentColor: isAccentColorId(parsed.accentColor)
        ? parsed.accentColor
        : DEFAULT_ACCENT_COLOR,
      reducedEffects: parsed.reducedEffects === true,
    };
  } catch {
    return {
      theme: DEFAULT_APP_THEME,
      accentColor: DEFAULT_ACCENT_COLOR,
      reducedEffects: false,
    };
  }
}

/** Reads only appearance-related persisted values (used before React mounts). */
export function readStoredAppearance(): StoredAppearance {
  if (typeof localStorage === "undefined") {
    return parseStoredAppearance(null);
  }

  try {
    return parseStoredAppearance(localStorage.getItem(APP_SETTINGS_STORAGE_KEY));
  } catch {
    return parseStoredAppearance(null);
  }
}

/**
 * Applies appearance + accent tokens to the document root. This is the single
 * write path used by the React provider and by the pre-mount boot script.
 */
export function applyThemeToDocument(
  effectiveTheme: EffectiveTheme,
  theme: AppTheme,
  accentColor: AccentColorId | string | null | undefined,
): void {
  if (typeof document === "undefined") return;

  const resolvedTheme: EffectiveTheme =
    effectiveTheme === "light" ? "light" : "dark";
  const accent = getAccentColor(accentColor);
  const tokens = resolveThemeTokens(resolvedTheme, accent.id);
  const root = document.documentElement;

  root.classList.toggle("lyceum-theme-light", resolvedTheme === "light");
  root.classList.toggle("lyceum-theme-dark", resolvedTheme === "dark");
  root.dataset.theme = isAppTheme(theme) ? theme : DEFAULT_APP_THEME;
  root.dataset.effectiveTheme = resolvedTheme;
  root.dataset.accentColor = accent.id;
  root.style.colorScheme = resolvedTheme;

  // Compatibility layer: the legacy accent variables remain the bridge for
  // components that still use the Tailwind green remap. New code must consume
  // the semantic tokens below.
  for (const step of ACCENT_PALETTE_STEPS) {
    root.style.setProperty(`--accent-${step}`, accent.palette[step]);
  }
  root.style.setProperty("--accent-foreground", accent.foreground);

  for (const [property, value] of Object.entries(toCssCustomProperties(tokens))) {
    root.style.setProperty(property, value);
  }

  // Keeps the native window backing / overscroll area in sync with the page.
  root.style.backgroundColor = tokens.background;
}
