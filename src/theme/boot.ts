// Runs before the React entry point (see index.html) so the document receives
// the same semantic tokens the provider uses. Keeping this as a module import
// avoids duplicating palette/token definitions in an inline script.
import {
  applyThemeToDocument,
  readStoredAppearance,
  resolveEffectiveTheme,
} from "./appearance";

const appearance = readStoredAppearance();
const effectiveTheme = resolveEffectiveTheme(appearance.theme);

applyThemeToDocument(effectiveTheme, appearance.theme, appearance.accentColor);
document.documentElement.dataset.reducedEffects = appearance.reducedEffects
  ? "true"
  : "false";
