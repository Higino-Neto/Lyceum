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

  it("shows the plan, then whether the copy was verified on the Kindle", async () => {
    render(<ConversionQueueProvider><KindleSendPanel books={[book]} onClose={vi.fn()} /></ConversionQueueProvider>);

    await screen.findByText("Kindle");
    expect(screen.getByText("Copiado como AZW3")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Enviar 1" }));

    await waitFor(() => {
      expect(screen.getByText("Cópia conferida no Kindle")).toBeInTheDocument();
      expect(screen.getByText("1 enviado")).toBeInTheDocument();
      expect(screen.getAllByRole("button", { name: "Fechar" })).toHaveLength(2);
    });
  });

  it("sends with the saved Kindle conversion settings and remembers changes", async () => {
    localStorage.setItem(KINDLE_CONVERSION_DEFAULTS_KEY, JSON.stringify({ kindleFontSizes: "original", epubLayout: "reflow" }));
    const epub = { ...book, fileHash: "epub-hash", title: "Novel.epub", filePath: "C:\\library\\Novel.epub", fileType: "epub" as const };
    render(<ConversionQueueProvider><KindleSendPanel books={[epub]} onClose={vi.fn()} /></ConversionQueueProvider>);

    await screen.findByText("Kindle");
    expect(screen.getByText("EPUB → AZW3")).toBeInTheDocument();
    expect(screen.getByText("Mantém os tamanhos definidos pelo livro")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Enviar 1" }));

    await waitFor(() => expect(window.api.sendBooksToKindle).toHaveBeenCalled());
    const call = (window.api.sendBooksToKindle as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.conversionOptions).toMatchObject({ kindleFontSizes: "original", epubLayout: "reflow", kindleProfile: "kindle-compatible" });
  });

  it("explains failures in plain language and retries only the failed books", async () => {
    const send = window.api.sendBooksToKindle as unknown as ReturnType<typeof vi.fn>;
    send.mockResolvedValueOnce({
      success: false,
      sent: 0,
      failed: 1,
      results: [{ fileHash: book.fileHash, title: book.title, success: false, status: "error", errorCode: "copy-failed", error: "EIO: i/o error" }],
    });
    render(<ConversionQueueProvider><KindleSendPanel books={[book]} onClose={vi.fn()} /></ConversionQueueProvider>);

    await screen.findByText("Kindle");
    fireEvent.click(screen.getByRole("button", { name: "Enviar 1" }));

    expect(await screen.findByText(/Não foi possível copiar para o Kindle/)).toBeInTheDocument();
    expect(screen.getByText("EIO: i/o error")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo 1 com falha" }));

    await waitFor(() => expect(send).toHaveBeenCalledTimes(2));
    expect(send.mock.calls[1][0].books.map((item: { fileHash: string }) => item.fileHash)).toEqual([book.fileHash]);
    expect(await screen.findByText("Cópia conferida no Kindle")).toBeInTheDocument();
  });

  it("converts Kindle-only formats to EPUB when sending by email", async () => {
    localStorage.setItem("lyceum-kindle-send-mode", "email");
    Object.assign(window.api, {
      getKindleEmailConfig: vi.fn().mockResolvedValue({
        kindleAddress: "me@kindle.com",
        senderAddress: "me@gmail.com",
        provider: "gmail",
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        username: "me@gmail.com",
        authMethod: "password",
        hasPassword: true,
        passwordPersisted: true,
        encryptionAvailable: true,
        configured: true,
        googleSignInAvailable: false,
        googleConnected: false,
        maxAttachmentBytes: 18 * 1024 * 1024,
      }),
      sendBooksToKindleEmail: vi.fn().mockResolvedValue({
        success: true,
        sent: 1,
        failed: 0,
        results: [{ fileHash: book.fileHash, title: book.title, success: true, status: "converted", outputFormat: "epub" }],
      }),
      openKindlePersonalDocuments: vi.fn(),
    });
    render(<ConversionQueueProvider><KindleSendPanel books={[book]} onClose={vi.fn()} /></ConversionQueueProvider>);

    expect(await screen.findByText("AZW3 → EPUB · imagens menores")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Enviar por e-mail (1)" }));

    expect(await screen.findByText("Entregue como EPUB")).toBeInTheDocument();
    expect(window.api.sendBooksToKindleEmail).toHaveBeenCalledWith(expect.objectContaining({ compressImages: true }));
    fireEvent.click(screen.getByRole("button", { name: "Abrir configurações da Amazon" }));
    expect(window.api.openKindlePersonalDocuments).toHaveBeenCalled();
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
    fireEvent.click(screen.getByRole("button", { name: "Mais opções…" }));

    await waitFor(() => expect(opened).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
    expect(delivery).toEqual({ deviceId: "fs:kindle", deviceName: "Kindle" });
    expect(draft).toEqual([book.fileHash]);
    window.removeEventListener("lyceum:open-conversion", opened);
  });
});
