import { useEffect, useCallback, useMemo, useRef } from "react";
import { useLocation } from "react-router-dom";

const LAST_ROUTE_KEY = "lyceum_last_route";
const ROUTE_STATE_PREFIX = "lyceum_route_state_";

function normalizePath(pathname: string): string {
  return (pathname || "/").replace(/^#/, "").replace(/^\/+/, "/") || "/";
}

export interface PersistedState {
  [key: string]: unknown;
}

function getRouteStateKey(pathname: string): string {
  const normalized = normalizePath(pathname);
  const keyPart = normalized.replace(/^\//, "").replace(/\//g, "_") || "root";
  return `${ROUTE_STATE_PREFIX}${keyPart}`;
}

export function useRouteState(): {
  saveState: (state: PersistedState) => void;
  loadState: () => PersistedState | null;
  clearState: () => void;
} {
  const location = useLocation();
  const prevPathRef = useRef<string | null>(null);

  const normalizedPath = useMemo(
    () => normalizePath(location.pathname),
    [location.pathname]
  );

  const saveState = useCallback((state: PersistedState) => {
    const key = getRouteStateKey(normalizedPath);
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch (error) {
      console.warn("Error saving route state:", error);
    }
  }, [normalizedPath]);

  const loadState = useCallback((): PersistedState | null => {
    const key = getRouteStateKey(normalizedPath);
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }, [normalizedPath]);

  const clearState = useCallback(() => {
    const key = getRouteStateKey(normalizedPath);
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }, [normalizedPath]);

  useEffect(() => {
    if (prevPathRef.current !== null && prevPathRef.current !== normalizedPath) {
      localStorage.setItem(LAST_ROUTE_KEY, normalizedPath);
    }
    prevPathRef.current = normalizedPath;
  }, [normalizedPath]);

  return { saveState, loadState, clearState };
}

export function getLastRoute(): string | null {
  return localStorage.getItem(LAST_ROUTE_KEY);
}

export function clearLastRoute(): void {
  localStorage.removeItem(LAST_ROUTE_KEY);
}

export function clearAllRouteStates(): void {
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(ROUTE_STATE_PREFIX)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((key) => localStorage.removeItem(key));
}