import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useRouteState, getLastRoute, clearLastRoute, clearAllRouteStates } from "../../hooks/useRouteState";

function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <MemoryRouter initialEntries={["/test"]}>
      {children}
    </MemoryRouter>
  );
}

describe("useRouteState", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe("useRouteState hook", () => {
    it("provides saveState, loadState, and clearState functions", () => {
      const { result } = renderHook(() => useRouteState(), { wrapper: TestWrapper });
      expect(result.current.saveState).toBeDefined();
      expect(result.current.loadState).toBeDefined();
      expect(result.current.clearState).toBeDefined();
    });

    it("saves state to localStorage", () => {
      const { result } = renderHook(() => useRouteState(), { wrapper: TestWrapper });
      
      act(() => {
        result.current.saveState({ page: 1, filter: "active" });
      });
      
      const key = "lyceum_route_state_test";
      expect(localStorage.getItem(key)).toBe(JSON.stringify({ page: 1, filter: "active" }));
    });

    it("loads state from localStorage", () => {
      const key = "lyceum_route_state_test";
      localStorage.setItem(key, JSON.stringify({ page: 2, filter: "completed" }));
      
      const { result } = renderHook(() => useRouteState(), { wrapper: TestWrapper });
      
      act(() => {
        const state = result.current.loadState();
        expect(state).toEqual({ page: 2, filter: "completed" });
      });
    });

    it("returns null when no state exists", () => {
      const { result } = renderHook(() => useRouteState(), { wrapper: TestWrapper });
      
      act(() => {
        const state = result.current.loadState();
        expect(state).toBeNull();
      });
    });

    it("clears state from localStorage", () => {
      const key = "lyceum_route_state_test";
      localStorage.setItem(key, JSON.stringify({ page: 1 }));
      
      const { result } = renderHook(() => useRouteState(), { wrapper: TestWrapper });
      
      act(() => {
        result.current.clearState();
      });
      
      expect(localStorage.getItem(key)).toBeNull();
    });

    it("handles invalid JSON in loadState", () => {
      const key = "lyceum_route_state_test";
      localStorage.setItem(key, "invalid");
      
      const { result } = renderHook(() => useRouteState(), { wrapper: TestWrapper });
      
      act(() => {
        const state = result.current.loadState();
        expect(state).toBeNull();
      });
    });
  });

  describe("getLastRoute", () => {
    it("returns last saved route", () => {
      localStorage.setItem("lyceum_last_route", "/previous");
      expect(getLastRoute()).toBe("/previous");
    });

    it("returns null when no route saved", () => {
      expect(getLastRoute()).toBeNull();
    });
  });

  describe("clearLastRoute", () => {
    it("clears last route from localStorage", () => {
      localStorage.setItem("lyceum_last_route", "/test");
      clearLastRoute();
      expect(localStorage.getItem("lyceum_last_route")).toBeNull();
    });
  });

  describe("clearAllRouteStates", () => {
    it("clears all route state keys", () => {
      localStorage.setItem("lyceum_route_state_test1", "{}");
      localStorage.setItem("lyceum_route_state_test2", "{}");
      localStorage.setItem("lyceum_last_route", "/");
      localStorage.setItem("other_key", "value");
      
      clearAllRouteStates();
      
      expect(localStorage.getItem("lyceum_route_state_test1")).toBeNull();
      expect(localStorage.getItem("lyceum_route_state_test2")).toBeNull();
      expect(localStorage.getItem("lyceum_last_route")).toBe("/");
      expect(localStorage.getItem("other_key")).toBe("value");
    });

    it("handles empty localStorage", () => {
      expect(() => clearAllRouteStates()).not.toThrow();
    });
  });
});
