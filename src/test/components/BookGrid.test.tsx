import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import BookGrid from "../../pages/Library/components/BookGrid";
import BookCard from "../../pages/Library/components/BookGrid/BookCard";
import type {
  BookWithThumbnail,
  FolderInfo,
} from "../../types/LibraryTypes";

const folders: FolderInfo[] = [
  {
    name: "Computer Science",
    path: "Computer Science",
    fullPath: "C:\\library\\Computer Science",
    bookCount: 3,
    subfolders: [
      {
        name: "Machine Learning",
        path: "Computer Science\\Machine Learning",
        fullPath: "C:\\library\\Computer Science\\Machine Learning",
        bookCount: 1,
        subfolders: [],
      },
    ],
  },
];

function createBook(overrides: Partial<BookWithThumbnail> = {}): BookWithThumbnail {
  return {
    id: 1,
    title: "Algorithms.epub",
    filePath: "C:\\library\\Computer Science\\Algorithms.epub",
    fileHash: "book-1",
    folderPath: "C:\\library\\Computer Science",
    currentPage: 0,
    currentZoom: null,
    currentScroll: null,
    annotations: null,
    thumbnailPath: null,
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
    fileType: "epub",
    ...overrides,
  };
}

describe("BookGrid unified folders", () => {
  it("renders grid folders even when there are no books", () => {
    const onFolderSelect = vi.fn();

    render(
      <BookGrid
        books={[]}
        folders={folders}
        viewMode="grid"
        onOpen={vi.fn()}
        onFolderSelect={onFolderSelect}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Abrir pasta Computer Science" }));

    expect(onFolderSelect).toHaveBeenCalledWith("Computer Science");
    expect(screen.queryByText("Nenhum livro nesta secao.")).not.toBeInTheDocument();
  });

  it("renders folders as list rows with the shared folder menu", () => {
    const onRenameFolder = vi.fn();

    render(
      <BookGrid
        books={[createBook()]}
        folders={folders}
        viewMode="list"
        onOpen={vi.fn()}
        onFolderSelect={vi.fn()}
        onRenameFolder={onRenameFolder}
      />,
    );

    expect(screen.getByRole("button", { name: "Abrir pasta Computer Science" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Mais/i }));
    fireEvent.click(screen.getByRole("button", { name: "Renomear" }));

    expect(onRenameFolder).toHaveBeenCalledWith(folders[0]);
  });

  it("shows one chip per format and toggles a single file of a merged book", () => {
    const epub = createBook({ id: 21, fileHash: "dune-epub", fileType: "epub", bookId: "dune" });
    const pdf = createBook({ id: 22, fileHash: "dune-pdf", fileType: "pdf", bookId: "dune" });
    const onToggleFile = vi.fn();
    const onToggleSelection = vi.fn();

    const onClick = vi.fn();
    render(
      <BookCard
        book={createBook({ ...epub, title: "Dune", mergedBooks: [epub, pdf] })}
        onOpen={vi.fn()}
        onClick={onClick}
        showSyncActions={false}
        selectionMode
        selectedFilesKey="dune-pdf"
        onToggleFile={onToggleFile}
        onToggleSelection={onToggleSelection}
      />,
    );

    const pdfChip = screen.getByRole("button", { name: "PDF" });
    expect(pdfChip).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "EPUB" })).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(pdfChip);
    expect(onToggleFile).toHaveBeenCalledWith(pdf);
    expect(onToggleSelection).not.toHaveBeenCalled();
    expect(onClick).not.toHaveBeenCalled();
  });
});
