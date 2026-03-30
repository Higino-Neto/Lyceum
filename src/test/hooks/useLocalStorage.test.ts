import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useLocalStorage } from "../../hooks/useLocalStorage";

describe("useLocalStorage", () => {
  const TEST_KEY = "test_key";
  
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("returns initial value when no value exists", () => {
    const { result } = renderHook(() => useLocalStorage(TEST_KEY, "initial"));
    expect(result.current[0]).toBe("initial");
  });

  it("returns stored value when exists", () => {
    localStorage.setItem(`lyceum_${TEST_KEY}`, JSON.stringify("stored"));
    const { result } = renderHook(() => useLocalStorage(TEST_KEY, "initial"));
    expect(result.current[0]).toBe("stored");
  });

  it("sets value to localStorage", () => {
    const { result } = renderHook(() => useLocalStorage(TEST_KEY, "initial"));
    
    act(() => {
      result.current[1]("new value");
    });
    
    expect(localStorage.getItem(`lyceum_${TEST_KEY}`)).toBe(JSON.stringify("new value"));
    expect(result.current[0]).toBe("new value");
  });

  it("sets value using function updater", () => {
    localStorage.setItem(`lyceum_${TEST_KEY}`, JSON.stringify(10));
    const { result } = renderHook(() => useLocalStorage(TEST_KEY, 0));
    
    act(() => {
      result.current[1]((prev: number) => prev + 5);
    });
    
    expect(localStorage.getItem(`lyceum_${TEST_KEY}`)).toBe(JSON.stringify(15));
    expect(result.current[0]).toBe(15);
  });

  it("removes value from localStorage", () => {
    localStorage.setItem(`lyceum_${TEST_KEY}`, JSON.stringify("value"));
    const { result } = renderHook(() => useLocalStorage(TEST_KEY, "default"));
    
    act(() => {
      result.current[2]();
    });
    
    expect(localStorage.getItem(`lyceum_${TEST_KEY}`)).toBeNull();
  });

  it("handles invalid JSON gracefully", () => {
    localStorage.setItem(`lyceum_${TEST_KEY}`, "invalid-json");
    const { result } = renderHook(() => useLocalStorage(TEST_KEY, "default"));
    expect(result.current[0]).toBe("default");
  });

  it("handles object values", () => {
    const { result } = renderHook(() => useLocalStorage<{ name: string; count?: number }>(TEST_KEY, { name: "test" }));
    
    act(() => {
      result.current[1]({ name: "updated", count: 1 });
    });
    
    const stored = localStorage.getItem(`lyceum_${TEST_KEY}`);
    expect(JSON.parse(stored!)).toEqual({ name: "updated", count: 1 });
    expect(result.current[0]).toEqual({ name: "updated", count: 1 });
  });

  it("handles array values", () => {
    const { result } = renderHook(() => useLocalStorage(TEST_KEY, [1, 2, 3]));
    
    act(() => {
      result.current[1]([...result.current[0], 4]);
    });
    
    expect(result.current[0]).toEqual([1, 2, 3, 4]);
  });

  it("handles boolean values", () => {
    const { result } = renderHook(() => useLocalStorage(TEST_KEY, false));
    
    act(() => {
      result.current[1](true);
    });
    
    expect(result.current[0]).toBe(true);
  });

  it("handles null values", () => {
    const { result } = renderHook(() => useLocalStorage(TEST_KEY, null));
    
    act(() => {
      result.current[1]("value");
    });
    
    expect(result.current[0]).toBe("value");
    
    act(() => {
      result.current[1](null);
    });
    
    expect(result.current[0]).toBe(null);
  });
});
