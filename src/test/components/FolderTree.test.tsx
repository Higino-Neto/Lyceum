import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import FolderTree from "../../pages/Library/components/FolderTree";
import { FolderInfo } from "../../types/LibraryTypes";

describe("FolderTree", () => {
  it("updates when the shared folder structure changes", async () => {
    const folder: FolderInfo = {
      name: "Nova Pasta",
      path: "Nova Pasta",
      fullPath: "C:\\library\\Nova Pasta",
      bookCount: 0,
      subfolders: [],
    };

    const { rerender } = render(
      <FolderTree
        selectedFolder={null}
        onFolderSelect={() => undefined}
        localDocuments={[]}
        folderStructure={[]}
      />,
    );

    expect(screen.getByText("Nenhuma pasta na biblioteca")).toBeInTheDocument();

    rerender(
      <FolderTree
        selectedFolder={null}
        onFolderSelect={() => undefined}
        localDocuments={[]}
        folderStructure={[folder]}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Nova Pasta")).toBeInTheDocument();
    });
  });
});
