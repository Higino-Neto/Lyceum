import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useFolderDragDrop } from "../../hooks/useFolderDragDrop";

describe("useFolderDragDrop", () => {
  it("deduplicates dragged books and clears drag state", () => {
    const { result } = renderHook(() => useFolderDragDrop());

    act(() => {
      result.current.startBookDrag(["a", "b", "a"]);
      result.current.setDropTarget("Target");
    });

    expect(result.current.draggedBooks).toEqual(["a", "b"]);
    expect(result.current.dropTarget).toBe("Target");
    expect(result.current.isDraggingBooks).toBe(true);

    act(() => {
      result.current.clearDrag();
    });

    expect(result.current.draggedBooks).toEqual([]);
    expect(result.current.dropTarget).toBeNull();
    expect(result.current.isDraggingBooks).toBe(false);
  });
});
