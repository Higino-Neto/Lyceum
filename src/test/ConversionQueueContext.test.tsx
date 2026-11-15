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
    expect(screen.getByTestId("logs")).toHaveTextContent("pipeline de conversão em execução");
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
    expect(screen.getAllByRole("button", { name: "Fechar conversão" })).toHaveLength(1);
    expect(screen.getByAltText("Livro de teste.epub")).toHaveAttribute("src", book.thumbnail);
  });
});

describe("Kindle delivery from the conversion queue", () => {
  function KindleHarness({ book }: { book: BookWithThumbnail }) {
    const { queue, startConversionWithConfigs } = useConversionQueue();
    return (
      <>
        <button type="button" onClick={() => startConversionWithConfigs([{
          book,
          targetFormat: "azw3",
          profile: "ereader",
          options: { ...defaultConversionOptions, kindleFontSizes: "kindle", pageNumbers: "auto" },
          delivery: { deviceId: "fs:kindle", deviceName: "Kindle Paperwhite" },
        }])}>Enviar</button>
        <output data-testid="kstatus">{queue[0]?.status || "empty"}</output>
        <output data-testid="kmessage">{queue[0]?.message || ""}</output>
      </>
    );
  }

  it("converts and sends through the Kindle pipeline, also for AZW3 books", async () => {
    const sendBookToKindle = vi.fn().mockResolvedValue({ success: true, pageCount: 412, deviceName: "Kindle Paperwhite" });
    const convertBook = vi.fn();
    Object.defineProperty(window, "api", {
      value: { onConversionProgress: vi.fn(() => () => undefined), sendBookToKindle, convertBook },
      configurable: true,
      writable: true,
    });
    const azw3 = { ...createBook(), fileType: "azw3" as const, filePath: "C:\\livros\\teste.azw3", title: "Livro.azw3" };
    render(<ConversionQueueProvider><KindleHarness book={azw3} /></ConversionQueueProvider>);

    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    await waitFor(() => expect(screen.getByTestId("kstatus")).toHaveTextContent("done"));
    expect(screen.getByTestId("kmessage")).toHaveTextContent("Kindle Paperwhite");
    expect(screen.getByTestId("kmessage")).toHaveTextContent("412");
    expect(convertBook).not.toHaveBeenCalled();
    expect(sendBookToKindle).toHaveBeenCalledWith(expect.objectContaining({
      deviceId: "fs:kindle",
      jobId: expect.any(String),
      conversionOptions: expect.objectContaining({ kindleFontSizes: "kindle" }),
      book: expect.objectContaining({ fileHash: "book-hash" }),
    }));
  });
});

describe("Conversion window in Kindle mode", () => {
  function SeededKindleDialog({ book }: { book: BookWithThumbnail }) {
    const { prepareKindleSend } = useConversionQueue();
    useEffect(() => prepareKindleSend([book], { deviceId: "fs:kindle", deviceName: "Kindle Paperwhite" }), [book, prepareKindleSend]);
    return <ConversionDialog isOpen onClose={vi.fn()} />;
  }

  it("shows the Kindle destination, Kindle options and saves them as defaults", async () => {
    localStorage.clear();
    Object.defineProperty(window, "api", {
      value: {
        onConversionProgress: vi.fn(() => () => undefined),
        getThumbnail: vi.fn().mockResolvedValue(null),
        listConversionTargets: vi.fn().mockResolvedValue([]),
        previewConversionOutput: vi.fn().mockResolvedValue({ success: false }),
      },
      configurable: true,
      writable: true,
    });
    const pdf = { ...createBook(), fileType: "pdf" as const, filePath: "C:\\livros\\teste.pdf", title: "Livro.pdf" };
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ConversionQueueProvider><SeededKindleDialog book={pdf} /></ConversionQueueProvider>
      </QueryClientProvider>,
    );

    expect(await screen.findByText("Enviar para Kindle Paperwhite")).toBeInTheDocument();
    expect(screen.getByText("AZW3 para Kindle")).toBeInTheDocument();
    expect(screen.getByText("Layout do PDF")).toBeInTheDocument();
    expect(screen.getByText("Tamanho da fonte")).toBeInTheDocument();
    expect(screen.queryByText("Escolher pasta")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Converter e enviar 1 livro/ })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Salvar como padrão do Kindle" }));
    const saved = JSON.parse(localStorage.getItem("lyceum-kindle-conversion-defaults") || "{}");
    expect(saved).toMatchObject({ kindleFontSizes: "kindle", pageNumbers: "auto", epubLayout: "auto" });
  });
});
