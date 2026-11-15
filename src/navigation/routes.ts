export type NavigationRouteId =
  | "dashboard"
  | "register"
  | "library"
  | "reader"
  | "atlas"
  | "conversion"
  | "pdfBuilder"
  | "habits";

export interface NavigationRoute {
  id: NavigationRouteId;
  /** Translation key of the route label, resolved with `getRouteLabel`. */
  labelKey: `navigation:routes.${NavigationRouteId}`;
  path: string | null;
}

export interface NavigationFeatureSettings {
  betaAtlasEnabled: boolean;
  betaConversionEnabled: boolean;
  betaHabitsEnabled: boolean;
}

export const NAVIGATION_ROUTES: NavigationRoute[] = [
  { id: "dashboard", labelKey: "navigation:routes.dashboard", path: "/" },
  { id: "register", labelKey: "navigation:routes.register", path: "/add_reading" },
  { id: "library", labelKey: "navigation:routes.library", path: "/library" },
  { id: "reader", labelKey: "navigation:routes.reader", path: "/reading" },
  { id: "atlas", labelKey: "navigation:routes.atlas", path: "/atlas" },
  { id: "conversion", labelKey: "navigation:routes.conversion", path: null },
  { id: "pdfBuilder", labelKey: "navigation:routes.pdfBuilder", path: "/pdf-builder" },
  { id: "habits", labelKey: "navigation:routes.habits", path: "/habit_tracker" },
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
    if (route.id === "atlas") return settings.betaAtlasEnabled;
    // The PDF Builder belongs to the same beta as the conversion tools.
    if (route.id === "conversion" || route.id === "pdfBuilder") return settings.betaConversionEnabled;
    if (route.id === "habits") return settings.betaHabitsEnabled;
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
