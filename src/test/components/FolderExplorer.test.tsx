import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  FolderGrid,
  FolderPathBar,
} from "../../pages/Library/components/FolderExplorer";
import { getFolderChildren } from "../../pages/Library/utils";
import { BookWithThumbnail, FolderInfo } from "../../types/LibraryTypes";

const folders: FolderInfo[] = [
  {
    name: "Computer Science",
    path: "Computer Science",
    fullPath: "C:\\library\\Computer Science",
    bookCount: 17,
    subfolders: [
      {
        name: "Machine Learning",
        path: "Computer Science\\Machine Learning",
        fullPath: "C:\\library\\Computer Science\\Machine Learning",
        bookCount: 2,
        subfolders: [
          {
            name: "Deep Learning",
            path: "Computer Science\\Machine Learning\\Deep Learning",
            fullPath:
              "C:\\library\\Computer Science\\Machine Learning\\Deep Learning",
            bookCount: 8,
            subfolders: [],
          },
        ],
      },
    ],
  },
];

const previewBook = {
  id: 1,
  title: "Algorithms",
  filePath: "C:\\library\\Computer Science\\Algorithms.pdf",
  fileHash: "book-1",
  folderPath: "C:\\library\\Computer Science",
  currentPage: 0,
  currentZoom: null,
  currentScroll: null,
  annotations: null,
  thumbnailPath: null,
  thumbnail: "data:image/png;base64,iVBORw0KGgo=",
  numPages: 120,
  createdAt: "2026-01-01T00:00:00.000Z",
  lastOpenedAt: "2026-01-01T00:00:00.000Z",
  isSynced: 1,
  category: null,
  isFavorite: 0,
  rating: 0,
  notes: null,
  author: null,
  description: null,
  isbn: null,
  publisher: null,
  publishDate: null,
  fileSize: 1024,
  processingStatus: "completed",
} as BookWithThumbnail;

describe("FolderExplorer", () => {
  it("returns folders visible at the selected level", () => {
    expect(getFolderChildren(folders, null).map((folder) => folder.name)).toEqual([
      "Computer Science",
    ]);
    expect(
      getFolderChildren(folders, "Computer Science/Machine Learning").map(
        (folder) => folder.name,
      ),
    ).toEqual(["Deep Learning"]);
  });

  it("opens a folder card when clicked", () => {
    const onFolderSelect = vi.fn();
    render(
      <FolderGrid folders={folders} onFolderSelect={onFolderSelect} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Abrir pasta Computer Science" }));

    expect(onFolderSelect).toHaveBeenCalledWith("Computer Science");
  });

  it("opens a folder card with keyboard activation", () => {
    const onFolderSelect = vi.fn();
    render(
      <FolderGrid folders={folders} onFolderSelect={onFolderSelect} />,
    );

    fireEvent.keyDown(screen.getByRole("button", { name: "Abrir pasta Computer Science" }), {
      key: "Enter",
    });

    expect(onFolderSelect).toHaveBeenCalledWith("Computer Science");
  });

  it("renders folder cards with separate content counts and cover previews", () => {
    render(
      <FolderGrid
        folders={folders}
        books={[previewBook]}
        onFolderSelect={vi.fn()}
      />,
    );

    expect(screen.getByText("Computer Science")).toBeInTheDocument();
    expect(screen.getByText("1 subpasta")).toBeInTheDocument();
    expect(screen.getByText("17 livros")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "" })).toBeInTheDocument();
  });

  it("opens the shared folder menu from the three-dot button", () => {
    const onFolderSelect = vi.fn();
    const onRenameFolder = vi.fn();
    render(
      <FolderGrid
        folders={folders}
        onFolderSelect={onFolderSelect}
        onRenameFolder={onRenameFolder}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Mais ações de Computer Science" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Renomear" }));

    expect(onFolderSelect).not.toHaveBeenCalled();
    expect(onRenameFolder).toHaveBeenCalledWith(folders[0]);
  });

  it("opens the shared folder menu from right click", () => {
    const onDeleteFolder = vi.fn();
    render(
      <FolderGrid
        folders={folders}
        onFolderSelect={vi.fn()}
        onDeleteFolder={onDeleteFolder}
      />,
    );

    fireEvent.contextMenu(
      screen.getByRole("button", { name: "Abrir pasta Computer Science" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));

    expect(onDeleteFolder).toHaveBeenCalledWith(folders[0]);
  });

  it("navigates through breadcrumbs", () => {
    const onFolderSelect = vi.fn();
    render(
      <FolderPathBar
        folders={folders}
        selectedFolder="Computer Science/Machine Learning"
        onFolderSelect={onFolderSelect}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Computer Science" }));

    expect(onFolderSelect).toHaveBeenCalledWith("Computer Science");
  });

  it("offers create and import actions for the current folder", () => {
    const onCreateFolder = vi.fn();
    const onImportBook = vi.fn();
    render(
      <FolderPathBar
        folders={folders}
        selectedFolder="Computer Science"
        onFolderSelect={vi.fn()}
        onCreateFolder={onCreateFolder}
        onImportBook={onImportBook}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Nova pasta/i }));
    fireEvent.click(screen.getByRole("button", { name: /Adicionar livro/i }));

    expect(onCreateFolder).toHaveBeenCalledWith("Computer Science");
    expect(onImportBook).toHaveBeenCalledWith("Computer Science");
  });
});
