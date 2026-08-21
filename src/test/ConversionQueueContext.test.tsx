import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ConversionQueueProvider,
  defaultConversionOptions,
  useConversionQueue,
} from "../contexts/ConversionQueueContext";
import { ConversionDialog } from "../pages/Conversion/ConversionPage";
import type { BookWithThumbnail } from "../types/LibraryTypes";

function createBook(): BookWithThumbnail {
  return {
    id: 1,
    title: "Livro de teste.epub",
    filePath: "C:\\livros\\teste.epub",
    fileHash: "book-hash",
    currentPage: 1,
    currentZoom: null,
    currentScroll: null,
    annotations: null,
    thumbnailPath: "C:\\thumbs\\book-hash.png",
    thumbnail: "data:image/png;base64,AA==",
    numPages: 10,
    createdAt: "2026-01-01T00:00:00.000Z",
    lastOpenedAt: "2026-01-01T00:00:00.000Z",
    isSynced: 0,
    category: null,
    isFavorite: 0,
    rating: 0,
    notes: null,
    author: "Autora",
    description: null,
    isbn: null,
    publisher: null,
    publishDate: null,
    fileSize: 2048,
    processingStatus: "completed",
    fileType: "epub",
  };
}

function QueueHarness({ book }: { book: BookWithThumbnail }) {
  const { queue, logs, startConversionWithConfigs, cancelConversion, deleteConversion } = useConversionQueue();
  return (
    <>
      <button type="button" onClick={() => startConversionWithConfigs([{
        book,
        targetFormat: "pdf",
        profile: "ereader",
        outputPath: "C:\\saida",
        options: { ...defaultConversionOptions, pdfMarginTopMm: 27, pdfLineHeight: 1.7 },
      }])}>Iniciar</button>
      <button type="button" disabled={!queue[0]} onClick={() => queue[0] && void cancelConversion(queue[0].id)}>Parar</button>
      <button type="button" disabled={!queue[0]} onClick={() => queue[0] && void deleteConversion(queue[0].id)}>Excluir</button>
      <output data-testid="status">{queue[0]?.status || "empty"}</output>
      <output data-testid="logs">{logs.map((entry) => entry.message).join("|")}</output>
    </>
  );
}

function SeededDialog({ book }: { book: BookWithThumbnail }) {
  const { prepareBooks } = useConversionQueue();
  useEffect(() => prepareBooks([book]), [book, prepareBooks]);
  return <ConversionDialog isOpen onClose={vi.fn()} />;
}

function MultiQueueHarness({ first, second }: { first: BookWithThumbnail; second: BookWithThumbnail }) {
  const { queue, startConversionWithConfigs } = useConversionQueue();
  const enqueue = (book: BookWithThumbnail) => startConversionWithConfigs([{
    book,
    targetFormat: "pdf",
    profile: "ereader",
    options: { ...defaultConversionOptions },
  }]);
  return (
    <>
      <button type="button" onClick={() => enqueue(first)}>Primeiro</button>
      <button type="button" onClick={() => enqueue(second)}>Segundo</button>
      <output data-testid="queue-statuses">{queue.map((item) => `${item.book.fileHash}:${item.status}`).join("|")}</output>
    </>
  );
}

describe("conversion workspace", () => {
  const book = createBook();

  beforeEach(() => {
    Object.defineProperty(window, "api", {
      configurable: true,
      writable: true,
      value: {
        convertBook: vi.fn().mockResolvedValue({
          success: true,
          outputPath: "C:\\saida\\teste-convertido.pdf",
          fileHash: "output-hash",
          fileSize: 4096,
          report: { warnings: ["Aviso controlado"] },
        }),
        getThumbnail: vi.fn().mockResolvedValue(null),
        listBooks: vi.fn().mockResolvedValue({ items: [], hasMore: false, offset: 0, limit: 200, total: 0 }),
        showBookInFolder: vi.fn(),
        cancelConversion: vi.fn().mockResolvedValue({ success: true, active: true }),
        deleteConvertedOutput: vi.fn().mockResolvedValue({ success: true }),
      },
    });
  });

  it("sends per-format options and destination to the conversion IPC and records logs", async () => {
    render(<ConversionQueueProvider><QueueHarness book={book} /></ConversionQueueProvider>);

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Iniciar" })));

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("done"));
    expect(window.api.convertBook).toHaveBeenCalledWith("book-hash", "pdf", {
      jobId: expect.any(String),
      conversionOptions: expect.objectContaining({ pdfMarginTopMm: 27, pdfLineHeight: 1.7 }),
      outputDirectory: "C:\\saida",
    });
    expect(screen.getByTestId("logs")).toHaveTextContent("pipeline de conversao em execucao");
    expect(screen.getByTestId("logs")).toHaveTextContent("Aviso controlado");
  });

  it("cancels an active worker job and keeps it canceled when the IPC settles", async () => {
    let finish: ((value: { success: boolean; canceled: boolean; error: string }) => void) | undefined;
    vi.mocked(window.api.convertBook).mockImplementationOnce(() => new Promise((resolve) => {
      finish = resolve;
    }));
    render(<ConversionQueueProvider><QueueHarness book={book} /></ConversionQueueProvider>);

    fireEvent.click(screen.getByRole("button", { name: "Iniciar" }));
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("running"));
    fireEvent.click(screen.getByRole("button", { name: "Parar" }));

    const jobId = vi.mocked(window.api.convertBook).mock.calls[0][2]?.jobId;
    expect(window.api.cancelConversion).toHaveBeenCalledWith(jobId);
    await act(async () => finish?.({ success: false, canceled: true, error: "Conversao cancelada" }));
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("canceled"));
  });

  it("deletes the converted file and removes its queue item", async () => {
    render(<ConversionQueueProvider><QueueHarness book={book} /></ConversionQueueProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Iniciar" }));
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("done"));
    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("empty"));
    expect(window.api.deleteConvertedOutput).toHaveBeenCalledWith("C:\\saida\\teste-convertido.pdf", "output-hash");
  });

  it("accepts another book while the current conversion is still running", async () => {
    const second = { ...book, id: 2, fileHash: "second-hash", title: "Segundo livro.epub", filePath: "C:\\livros\\segundo.epub" };
    let finishFirst: ((value: { success: boolean; outputPath: string; fileHash: string; fileSize: number; report: { warnings: never[] } }) => void) | undefined;
    vi.mocked(window.api.convertBook)
      .mockImplementationOnce(() => new Promise((resolve) => { finishFirst = resolve; }))
      .mockResolvedValueOnce({ success: true, outputPath: "C:\\saida\\segundo.pdf", fileHash: "second-output", fileSize: 100, report: { warnings: [] } });
    render(<ConversionQueueProvider><MultiQueueHarness first={book} second={second} /></ConversionQueueProvider>);

    fireEvent.click(screen.getByRole("button", { name: "Primeiro" }));
    await waitFor(() => expect(screen.getByTestId("queue-statuses")).toHaveTextContent("book-hash:running"));
    fireEvent.click(screen.getByRole("button", { name: "Segundo" }));
    expect(screen.getByTestId("queue-statuses")).toHaveTextContent("second-hash:pending");
    expect(window.api.convertBook).toHaveBeenCalledTimes(1);

    await act(async () => finishFirst?.({ success: true, outputPath: "C:\\saida\\primeiro.pdf", fileHash: "first-output", fileSize: 100, report: { warnings: [] } }));
    await waitFor(() => expect(window.api.convertBook).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByTestId("queue-statuses")).toHaveTextContent("second-hash:done"));
  });

  it("shows one close control and PDF-specific settings for an EPUB", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <ConversionQueueProvider><SeededDialog book={book} /></ConversionQueueProvider>
      </QueryClientProvider>,
    );

    expect(await screen.findByText("Margem superior")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Fechar conversao" })).toHaveLength(1);
    expect(screen.getByAltText("Livro de teste.epub")).toHaveAttribute("src", book.thumbnail);
  });
});
