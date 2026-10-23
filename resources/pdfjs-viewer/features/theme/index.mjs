// Applies semantic token values sent by the host application. The viewer is an
// isolated document/origin, so parent CSS custom properties are not inherited;
// the host resolves theme + accent and sends plain values over the existing
// versioned postMessage bridge.
import { CMD_SET_THEME, isPdfViewerTheme } from "../../lyceum-core.mjs";

export function installThemeFeature({ bus }) {
  bus.onCommand(CMD_SET_THEME, data => {
    if (!isPdfViewerTheme(data)) {
      return;
    }

    const root = document.documentElement;
    for (const [name, value] of Object.entries(data.colors)) {
      root.style.setProperty(`--lyceum-${name}`, value);
    }
    root.dataset.lyceumTheme = data.theme;
    root.style.colorScheme = data.theme;
  });
}
