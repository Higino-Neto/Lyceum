import { useEffect, useRef } from "react";
import type { NavigateFunction } from "react-router-dom";
import { getLastRoute } from "../../hooks/useRouteState";

const AUTH_ROUTES = new Set([
  "/signin",
  "/signup",
  "/forgot-password",
  "/reset-password",
]);

interface NavigationBootstrapOptions {
  isLoggedIn: boolean | null;
  pathname: string;
  navigate: NavigateFunction;
}

/** Restores app navigation and translates native auth deep links into routes. */
export function useNavigationBootstrap({
  isLoggedIn,
  pathname,
  navigate,
}: NavigationBootstrapOptions) {
  const restoredRef = useRef(false);

  useEffect(() => {
    if (isLoggedIn !== true || restoredRef.current) return;
    restoredRef.current = true;
    if (AUTH_ROUTES.has(pathname)) return;

    const lastRoute = getLastRoute();
    if (lastRoute && !AUTH_ROUTES.has(lastRoute)) {
      navigate(lastRoute, { replace: true });
    }
  }, [isLoggedIn, navigate, pathname]);

  useEffect(() => {
    const unsubscribe = window.api?.onAuthDeepLink?.((payload) => {
      navigate(payload.route || "/reset-password", { replace: true });
    });
    return () => { unsubscribe?.(); };
  }, [navigate]);
}
