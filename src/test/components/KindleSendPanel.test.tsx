import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import KindleSendPanel from "../../pages/Library/components/KindleSendPanel";
import type { BookWithThumbnail } from "../../types/LibraryTypes";

const book: BookWithThumbnail = {
  id: 1,
  title: "Kindle Book.azw3",
  filePath: "C:\\library\\Kindle Book.azw3",
  fileHash: "kindle-hash",
  currentPage: 0,
  currentZoom: null,
  currentScroll: null,
  annotations: null,
  thumbnailPath: null,
  numPages: 100,
  createdAt: "2026-01-01T00:00:00.000Z",
  lastOpenedAt: "2026-01-01T00:00:00.000Z",
  isSynced: 1,
  category: null,
  isFavorite: 0,
  rating: 0,
  notes: null,
  author: "Author",
  description: null,
  isbn: null,
  publisher: null,
  publishDate: null,
  fileSize: 2048,
  processingStatus: "completed",
  fileType: "azw3",
};

describe("KindleSendPanel", () => {
  beforeEach(() => {
    Object.defineProperty(window, "api", {
      value: {
        listKindleDevices: vi.fn().mockResolvedValue([{
          id: "fs:kindle",
          name: "Kindle",
          kind: "kindle",
          isMtp: false,
          rootPath: "E:\\",
          destinationLabel: "E:\\documents\\Downloads",
        }]),
        sendBooksToKindle: vi.fn().mockResolvedValue({
          success: true,
          sent: 1,
          failed: 0,
          results: [{
            fileHash: book.fileHash,
            title: book.title,
            success: true,
            status: "sent",
            verified: true,
            bytes: book.fileSize,
            note: "Copia verificada por tamanho",
            outputPath: "E:/documents/Downloads/Kindle Book.azw3",
          }],
        }),
      },
      configurable: true,
      writable: true,
    });
  });

  it("shows whether a Kindle transfer was structurally verified", async () => {
    render(<KindleSendPanel books={[book]} onClose={vi.fn()} />);

    await screen.findByText("Kindle");
    fireEvent.click(screen.getByRole("button", { name: "Enviar 1" }));

    await waitFor(() => {
      expect(screen.getByText("Enviado e verificado")).toBeInTheDocument();
      expect(screen.getByText("Copia verificada por tamanho")).toBeInTheDocument();
      expect(screen.getByText("1 verificado(s)")).toBeInTheDocument();
    });
  });
});
