import { act, renderHook } from "@testing-library/react";
import useReadingStatePersistence from "../../pages/ReadingPage/hooks/useReadingStatePersistence";

describe("useReadingStatePersistence", () => {
  const savedDocument = {
    currentPage: 3,
    currentZoom: 1.25,
    currentScroll: 420,
    annotations: JSON.stringify([{ id: "ann-1", pageIndex: 0, rect: {} }]),
  };

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    (window as any).api = {
      getReadingState: vi.fn().mockResolvedValue(savedDocument),
      saveReadingState: vi.fn().mockResolvedValue(undefined),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
    delete (window as any).api;
  });

  it("merges immediate partial saves with the loaded reading state", async () => {
    const { result } = renderHook(() => useReadingStatePersistence("book-hash"));

    await act(async () => {
      await result.current.loadState();
      await result.current.saveNow({ currentZoom: 1.5 });
    });

    expect(window.api.saveReadingState).toHaveBeenCalledWith({
      fileHash: "book-hash",
      state: {
        currentPage: 3,
        currentZoom: 1.5,
        currentScroll: 420,
        annotations: savedDocument.annotations,
      },
    });
  });

  it("flushes scheduled partial saves without losing annotations", async () => {
    const { result } = renderHook(() => useReadingStatePersistence("book-hash", 100));

    await act(async () => {
      await result.current.loadState();
    });

    act(() => {
      result.current.scheduleSave({
        currentPage: 9,
        currentScroll: 1200,
      });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(window.api.saveReadingState).toHaveBeenCalledWith({
      fileHash: "book-hash",
      state: {
        currentPage: 9,
        currentZoom: 1.25,
        currentScroll: 1200,
        annotations: savedDocument.annotations,
      },
    });
  });

  it("loads the synchronous local backup when the database path has no useful state", async () => {
    (window.api.getReadingState as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const localState = {
      currentPage: 187,
      currentZoom: 1,
      currentScroll: 1450,
      annotations: JSON.stringify({
        cfi: "epubcfi(/6/24!/4/2/10)",
        href: "chapter-8.xhtml",
        percentage: 0.06,
      }),
    };
    localStorage.setItem(
      "lyceum-reading-state:book-hash",
      JSON.stringify({
        savedAt: Date.now(),
        state: localState,
      }),
    );

    const { result } = renderHook(() => useReadingStatePersistence("book-hash"));

    await act(async () => {
      const loaded = await result.current.loadState();
      expect(loaded).toEqual(localState);
    });
  });

  it("does not let an empty local backup override a useful database state", async () => {
    localStorage.setItem(
      "lyceum-reading-state:book-hash",
      JSON.stringify({
        savedAt: Date.now(),
        state: {
          currentPage: 1,
          currentZoom: 1,
          currentScroll: 0,
          annotations: JSON.stringify({ scrollTop: 0 }),
        },
      }),
    );

    const { result } = renderHook(() => useReadingStatePersistence("book-hash"));

    await act(async () => {
      const loaded = await result.current.loadState();
      expect(loaded).toEqual(savedDocument);
    });
  });
});
