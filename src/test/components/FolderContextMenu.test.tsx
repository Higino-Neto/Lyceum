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
  it.each(["Ficcao", "_Dune", "__Classicos"])("treats %s as an ordinary folder", (name) => {
    const folder = createFolder(name);
    const onDeleteFolder = vi.fn();

    render(
      <FolderContextMenu
        folder={folder}
        x={10}
        y={20}
        onCreateFolder={vi.fn()}
        onRenameFolder={vi.fn()}
        onDeleteFolder={onDeleteFolder}
      />,
    );

    expect(screen.queryByRole("button", { name: /Remover colecao|Desmesclar/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button").at(-1)!);
    expect(onDeleteFolder).toHaveBeenCalledWith(folder);
  });
});
