import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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

  it("shows the root create input after library folders and before source folders", () => {
    const libraryFolder: FolderInfo = {
      name: "Library Folder",
      path: "Library Folder",
      fullPath: "C:\\library\\Library Folder",
      bookCount: 0,
      subfolders: [],
    };
    const sourceFolder: FolderInfo = {
      name: "Source Folder",
      path: "D:\\books",
      fullPath: "D:\\books",
      bookCount: 0,
      subfolders: [],
    };

    render(
      <FolderTree
        selectedFolder={null}
        onFolderSelect={() => undefined}
        localDocuments={[]}
        folderStructure={[libraryFolder, sourceFolder]}
        libraryRoots={[
          { id: null, type: "library", label: "Biblioteca", path: "C:\\library" },
          { id: 1, type: "source", label: "Source Folder", path: "D:\\books" },
        ]}
      />,
    );

    fireEvent.click(screen.getByTitle("Criar nova pasta"));

    const input = screen.getByPlaceholderText("Nome da pasta");
    const sourceHeading = screen.getByText("Pastas fonte");

    expect(screen.getByText("Library Folder")).toBeInTheDocument();
    expect(input.compareDocumentPosition(sourceHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows context-created folder input as a child without replacing the parent row", () => {
    const folder: FolderInfo = {
      name: "Parent",
      path: "Parent",
      fullPath: "C:\\library\\Parent",
      bookCount: 0,
      subfolders: [],
    };

    render(
      <FolderTree
        selectedFolder={null}
        onFolderSelect={() => undefined}
        localDocuments={[]}
        folderStructure={[folder]}
      />,
    );

    fireEvent.contextMenu(screen.getByText("Parent"));
    fireEvent.click(screen.getByRole("button", { name: "Nova pasta" }));

    expect(screen.getByText("Parent")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Nome da pasta")).toBeInTheDocument();
  });

  it("cancels an empty create input on blur", () => {
    render(
      <FolderTree
        selectedFolder={null}
        onFolderSelect={vi.fn()}
        localDocuments={[]}
        folderStructure={[
          {
            name: "Parent",
            path: "Parent",
            fullPath: "C:\\library\\Parent",
            bookCount: 0,
            subfolders: [],
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByTitle("Criar nova pasta"));
    fireEvent.blur(screen.getByPlaceholderText("Nome da pasta"));

    expect(screen.queryByPlaceholderText("Nome da pasta")).not.toBeInTheDocument();
  });
});
