import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("../../utils/saveReadingEntries", () => ({
  default: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../lib/supabase", () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      then: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
  },
  default: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      then: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
  },
}));

import useReadingSession from "../../pages/ReadingPage/hooks/useReadingSession";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useReadingSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return initial state", () => {
    const { result } = renderHook(() => useReadingSession(), {
      wrapper: createWrapper(),
    });

    expect(result.current.session).toBeDefined();
    expect(result.current.sessionStart).toBe(false);
    expect(result.current.sessionFinish).toBe(false);
    expect(result.current.showModal).toBe(false);
  });

  it("should handle session start", () => {
    const { result } = renderHook(() => useReadingSession(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.handleSessionStart();
    });

    expect(result.current.sessionStart).toBe(true);
  });

  it("should handle session data", () => {
    const { result } = renderHook(() => useReadingSession(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.handleSessionData({
        id: "session-1",
        sourceName: "Test Book",
        date: new Date(),
        category: "fiction",
        spentTimeMinutes: 30,
      });
    });

    expect(result.current.session.spentTimeMinutes).toBe(30);
  });

  it("should handle timer done", () => {
    const { result } = renderHook(() => useReadingSession(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.handleTimerDone();
    });

    expect(result.current.sessionStart).toBe(false);
    expect(result.current.sessionFinish).toBe(true);
  });

  it("should handle reading info", () => {
    const { result } = renderHook(() => useReadingSession(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.handleReadingInfo({
        totalWords: 5000,
        initialPage: 1,
        finalPage: 10,
      });
    });

    expect(result.current.session.totalWords).toBe(5000);
    expect(result.current.session.initialPage).toBe(1);
    expect(result.current.session.finalPage).toBe(10);
  });

  it("should handle reset", () => {
    const { result } = renderHook(() => useReadingSession(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.handleSessionData({
        id: "session-1",
        sourceName: "Test Book",
        date: new Date(),
        category: "fiction",
        spentTimeMinutes: 30,
      });
      result.current.handleReset();
    });

    expect(result.current.session.spentTimeMinutes).toBe(0);
    expect(result.current.sessionStart).toBe(false);
  });

  it("should set showModal", () => {
    const { result } = renderHook(() => useReadingSession(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setShowModal(true);
    });

    expect(result.current.showModal).toBe(true);
  });
});
