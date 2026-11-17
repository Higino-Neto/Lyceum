export type NavigationRouteId =
  | "dashboard"
  | "library"
  | "reader"
  | "conversion"
  | "pdfBuilder";

export interface NavigationRoute {
  id: NavigationRouteId;
  /** Translation key of the route label, resolved with `getRouteLabel`. */
  labelKey: `navigation:routes.${NavigationRouteId}`;
  path: string | null;
}

export interface NavigationFeatureSettings {
  betaConversionEnabled: boolean;
}

export const NAVIGATION_ROUTES: NavigationRoute[] = [
  { id: "dashboard", labelKey: "navigation:routes.dashboard", path: "/" },
  { id: "library", labelKey: "navigation:routes.library", path: "/library" },
  { id: "reader", labelKey: "navigation:routes.reader", path: "/reading" },
  { id: "conversion", labelKey: "navigation:routes.conversion", path: null },
  { id: "pdfBuilder", labelKey: "navigation:routes.pdfBuilder", path: "/pdf-builder" },
];

/** Translates a route (or route id) into its localized label. */
export function getRouteLabel(
  route: NavigationRoute | NavigationRouteId,
  t: (key: string) => string,
): string {
  const labelKey = typeof route === "string" ? `navigation:routes.${route}` : route.labelKey;
  return t(labelKey);
}

export function getEnabledNavigationRoutes(
  settings: NavigationFeatureSettings,
): NavigationRoute[] {
  return NAVIGATION_ROUTES.filter((route) => {
    // The PDF Builder belongs to the same beta as the conversion tools.
    if (route.id === "conversion" || route.id === "pdfBuilder") return settings.betaConversionEnabled;
    return true;
  });
}

export function getDefaultHotkeyBindings(
  settings: NavigationFeatureSettings,
): Partial<Record<NavigationRouteId, string>> {
  return Object.fromEntries(
    getEnabledNavigationRoutes(settings).map((route, index) => [route.id, String(index + 1)]),
  );
}
