import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import KindleSendPanel from "../../pages/Library/components/KindleSendPanel";
import { ConversionQueueProvider, useConversionQueue } from "../../contexts/ConversionQueueContext";
import { KINDLE_CONVERSION_DEFAULTS_KEY } from "../../features/kindle/kindleConversion";
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
    localStorage.clear();
    Object.defineProperty(window, "api", {
      value: {
        onConversionProgress: vi.fn(() => () => undefined),
        onKindleSendProgress: vi.fn(() => () => undefined),
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
    render(<ConversionQueueProvider><KindleSendPanel books={[book]} onClose={vi.fn()} /></ConversionQueueProvider>);

    await screen.findByText("Kindle");
    fireEvent.click(screen.getByRole("button", { name: "Enviar 1" }));

    await waitFor(() => {
      expect(screen.getByText("Enviado e verificado")).toBeInTheDocument();
      expect(screen.getByText("Copia verificada por tamanho")).toBeInTheDocument();
      expect(screen.getByText("1 verificado")).toBeInTheDocument();
    });
  });

  it("sends with the saved Kindle conversion settings", async () => {
    localStorage.setItem(KINDLE_CONVERSION_DEFAULTS_KEY, JSON.stringify({ kindleFontSizes: "original", epubLayout: "reflow" }));
    render(<ConversionQueueProvider><KindleSendPanel books={[book]} onClose={vi.fn()} /></ConversionQueueProvider>);

    await screen.findByText("Kindle");
    expect(screen.getByText("Fonte: tamanho do livro")).toBeInTheDocument();
    expect(screen.getByText("PDF: texto fluido")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Enviar 1" }));

    await waitFor(() => expect(window.api.sendBooksToKindle).toHaveBeenCalled());
    const call = (window.api.sendBooksToKindle as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.conversionOptions).toMatchObject({ kindleFontSizes: "original", epubLayout: "reflow", kindleProfile: "kindle-compatible" });
  });

  it("opens the conversion window in Kindle mode with the selected books", async () => {
    const onClose = vi.fn();
    const opened = vi.fn();
    window.addEventListener("lyceum:open-conversion", opened);
    let delivery: unknown = null;
    let draft: string[] = [];
    function Probe() {
      const queue = useConversionQueue();
      delivery = queue.kindleDelivery;
      draft = queue.draftBooks.map((item) => item.fileHash);
      return null;
    }
    render(<ConversionQueueProvider><KindleSendPanel books={[book]} onClose={onClose} /><Probe /></ConversionQueueProvider>);

    await screen.findByText("Kindle");
    fireEvent.click(screen.getByRole("button", { name: "Configurar conversão…" }));

    await waitFor(() => expect(opened).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
    expect(delivery).toEqual({ deviceId: "fs:kindle", deviceName: "Kindle" });
    expect(draft).toEqual([book.fileHash]);
    window.removeEventListener("lyceum:open-conversion", opened);
  });
});
