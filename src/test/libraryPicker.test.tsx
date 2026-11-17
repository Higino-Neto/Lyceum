import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LibraryPickerDialog } from "../components/library/LibraryPickerDialog";
import { buildPickerFolders, matchesPickerFolder } from "../components/library/libraryPickerFilters";
import type { BookWithThumbnail } from "../types/LibraryTypes";

const book = (id: number, title: string, filePath: string, readingStatus: BookWithThumbnail["readingStatus"] = "unknown") => ({
  id,
  title,
  fileHash: `hash-${id}`,
  filePath,
  fileType: "pdf",
  numPages: 10,
  currentPage: 1,
  readingStatus,
  createdAt: "2026-01-01",
  lastOpenedAt: "2026-01-01",
}) as unknown as BookWithThumbnail;

const books = [
  book(1, "Alpha", "/lib/Fiction/alpha.pdf", "reading"),
  book(2, "Beta", "/lib/Fiction/Classics/beta.pdf"),
  book(3, "Gamma", "/lib/Science/gamma.pdf", "not_a_book"),
];

describe("library picker", () => {
  it("builds a folder tree with nested counts", () => {
    const folders = buildPickerFolders(books);
    expect(folders.map((folder) => [folder.label, folder.depth, folder.count])).toEqual([
      ["Fiction", 0, 2],
      ["Classics", 1, 1],
      ["Science", 0, 1],
    ]);
    expect(matchesPickerFolder(books[1], "/lib/Fiction")).toBe(true);
    expect(matchesPickerFolder(books[2], "/lib/Fiction")).toBe(false);
  });

  it("selects several books with Shift and confirms them", () => {
    const onSelectMany = vi.fn();
    render(<LibraryPickerDialog open books={books} onClose={vi.fn()} multiple onSelectMany={onSelectMany} />);
    fireEvent.click(screen.getByText("Alpha"));
    fireEvent.click(screen.getByText("Gamma"), { shiftKey: true });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar 3 livros" }));
    expect(onSelectMany.mock.calls[0][0].map((item: BookWithThumbnail) => item.title)).toEqual(["Alpha", "Beta", "Gamma"]);
  });

  it("filters by reading status", () => {
    render(<LibraryPickerDialog open books={books} onClose={vi.fn()} onSelect={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Não é um livro/ }));
    expect(screen.getByText("Gamma")).toBeInTheDocument();
    expect(screen.queryByText("Alpha")).not.toBeInTheDocument();
  });
});
