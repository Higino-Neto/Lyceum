import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FolderTree from "../../pages/Library/components/FolderTree";
import type { FolderInfo } from "../../types/LibraryTypes";
import { folderRange, removeFolderPaths } from "../../pages/Library/components/folder-tree/folderTreeUtils";

const folder = (name: string): FolderInfo => ({
  name,
  path: name,
  fullPath: `/library/${name}`,
  bookCount: 0,
  subfolders: [],
});

describe("FolderTree multi-selection", () => {
  const deleteFolders = vi.fn(async (paths: string[]) => ({
    success: true,
    deleted: paths.length,
    failed: 0,
    errors: [],
  }));

  beforeEach(() => {
    localStorage.clear();
    deleteFolders.mockClear();
    (window as unknown as { api: unknown }).api = {
      deleteFolders,
      deleteFolder: vi.fn(async () => ({ success: true })),
      getLibraryPath: vi.fn(async () => "/library"),
    };
  });

  afterEach(() => {
    delete (window as unknown as { api?: unknown }).api;
  });

  it("selects a range with Shift and deletes the batch optimistically", async () => {
    const onFolderSelect = vi.fn();
    render(
      <FolderTree
        selectedFolder={null}
        onFolderSelect={onFolderSelect}
        folderStructure={[folder("A"), folder("B"), folder("C"), folder("D")]}
      />,
    );

    fireEvent.click(screen.getByText("A"));
    fireEvent.click(screen.getByText("C"), { shiftKey: true });
    fireEvent.contextMenu(screen.getByText("B"));
    fireEvent.click(screen.getByRole("button", { name: /Excluir 3 pastas/ }));
    fireEvent.click(screen.getByRole("button", { name: "Mover para a lixeira" }));

    await waitFor(() => expect(deleteFolders).toHaveBeenCalledWith([
      "/library/A",
      "/library/B",
      "/library/C",
    ]));
    await waitFor(() => expect(screen.queryByText("B")).not.toBeInTheDocument());
    expect(screen.getByText("D")).toBeInTheDocument();
  });

  it("toggles individual folders with Ctrl", () => {
    render(
      <FolderTree
        selectedFolder={null}
        onFolderSelect={() => undefined}
        folderStructure={[folder("A"), folder("B"), folder("C")]}
      />,
    );
    fireEvent.click(screen.getByText("A"), { ctrlKey: true });
    fireEvent.click(screen.getByText("C"), { ctrlKey: true });
    const selected = document.querySelectorAll('[aria-selected="true"]');
    expect(selected).toHaveLength(2);
  });
});

describe("folder tree utils", () => {
  it("computes ranges in either direction", () => {
    expect(folderRange(["a", "b", "c", "d"], "c", "a")).toEqual(["a", "b", "c"]);
  });

  it("removes nested folders by path", () => {
    const tree = [{ ...folder("A"), subfolders: [folder("A/B")] }, folder("C")];
    expect(removeFolderPaths(tree, new Set(["A/B"]))[0].subfolders).toEqual([]);
  });
});
