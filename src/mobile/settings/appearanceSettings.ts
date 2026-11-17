import {
  APP_SETTINGS_STORAGE_KEY,
  applyThemeToDocument,
  readStoredAppearance,
  resolveEffectiveTheme,
  type AppTheme,
  type StoredAppearance,
} from "../../theme/appearance";

/**
 * Appearance on the phone: same storage key and format as desktop's app
 * settings (theme, accent, reduced effects), applied through the shared
 * document theming path. Unknown keys in the stored JSON are preserved.
 */
export function readMobileAppearance(): StoredAppearance {
  return readStoredAppearance();
}

export function saveMobileAppearance(patch: Partial<StoredAppearance>): StoredAppearance {
  let stored: Record<string, unknown> = {};
  try {
    const raw = localStorage.getItem(APP_SETTINGS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === "object") stored = parsed as Record<string, unknown>;
  } catch {
    stored = {};
  }
  const next = { ...readStoredAppearance(), ...patch };
  try {
    localStorage.setItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify({ ...stored, ...next }));
  } catch {
    /* The choice still applies for this session. */
  }
  applyMobileAppearance(next);
  return next;
}

export function applyMobileAppearance(appearance: StoredAppearance) {
  applyThemeToDocument(resolveEffectiveTheme(appearance.theme), appearance.theme, appearance.accentColor);
  document.documentElement.dataset.reducedEffects = appearance.reducedEffects ? "true" : "false";
}

export type { AppTheme };
