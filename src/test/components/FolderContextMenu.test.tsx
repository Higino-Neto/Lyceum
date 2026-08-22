import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import FolderContextMenu from "../../pages/Library/components/FolderContextMenu";
import type { FolderInfo } from "../../types/LibraryTypes";

function createFolder(name: string): FolderInfo {
  return {
    name,
    path: name,
    fullPath: `C:\\library\\${name}`,
    bookCount: 2,
    subfolders: [],
  };
}

describe("FolderContextMenu", () => {
  it("offers non-destructive collection removal for special collection folders", () => {
    const folder = createFolder("__Classicos");
    const onDissolveFolder = vi.fn();

    render(
      <FolderContextMenu
        folder={folder}
        x={10}
        y={20}
        onCreateFolder={vi.fn()}
        onRenameFolder={vi.fn()}
        onDeleteFolder={vi.fn()}
        onDissolveFolder={onDissolveFolder}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Remover colecao" }));
    expect(onDissolveFolder).toHaveBeenCalledWith(folder);
  });

  it("does not offer dissolve for a regular folder", () => {
    render(
      <FolderContextMenu
        folder={createFolder("Ficcao")}
        x={10}
        y={20}
        onCreateFolder={vi.fn()}
        onRenameFolder={vi.fn()}
        onDeleteFolder={vi.fn()}
        onDissolveFolder={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: /Remover colecao|Desmesclar/ })).not.toBeInTheDocument();
  });
});
