export type NavigationRouteId =
  | "dashboard"
  | "register"
  | "library"
  | "reader"
  | "atlas"
  | "conversion"
  | "habits";

export interface NavigationRoute {
  id: NavigationRouteId;
  label: string;
  path: string | null;
}

export interface NavigationFeatureSettings {
  betaAtlasEnabled: boolean;
  betaConversionEnabled: boolean;
  betaHabitsEnabled: boolean;
}

export const NAVIGATION_ROUTES: NavigationRoute[] = [
  { id: "dashboard", label: "Dashboard", path: "/" },
  { id: "register", label: "Registrar", path: "/add_reading" },
  { id: "library", label: "Biblioteca", path: "/library" },
  { id: "reader", label: "Ler", path: "/reading" },
  { id: "atlas", label: "Atlas", path: "/atlas" },
  { id: "conversion", label: "Conversao", path: null },
  { id: "habits", label: "Habitos", path: "/habit_tracker" },
];

export function getEnabledNavigationRoutes(
  settings: NavigationFeatureSettings,
): NavigationRoute[] {
  return NAVIGATION_ROUTES.filter((route) => {
    if (route.id === "atlas") return settings.betaAtlasEnabled;
    if (route.id === "conversion") return settings.betaConversionEnabled;
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
