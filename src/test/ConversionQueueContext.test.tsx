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
  const { queue, logs, startConversionWithConfigs } = useConversionQueue();
  return (
    <>
      <button type="button" onClick={() => startConversionWithConfigs([{
        book,
        targetFormat: "pdf",
        profile: "ereader",
        outputPath: "C:\\saida",
        options: { ...defaultConversionOptions, pdfMarginTopMm: 27, pdfLineHeight: 1.7 },
      }])}>Iniciar</button>
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
      },
    });
  });

  it("sends per-format options and destination to the conversion IPC and records logs", async () => {
    render(<ConversionQueueProvider><QueueHarness book={book} /></ConversionQueueProvider>);

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Iniciar" })));

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("done"));
    expect(window.api.convertBook).toHaveBeenCalledWith("book-hash", "pdf", {
      conversionOptions: expect.objectContaining({ pdfMarginTopMm: 27, pdfLineHeight: 1.7 }),
      outputDirectory: "C:\\saida",
    });
    expect(screen.getByTestId("logs")).toHaveTextContent("Pipeline de conversao em execucao");
    expect(screen.getByTestId("logs")).toHaveTextContent("Aviso controlado");
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
