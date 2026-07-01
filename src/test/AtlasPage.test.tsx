import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AtlasPage from "../pages/Atlas/AtlasPage";
import { renderWithBasicProviders } from "./helpers/renderWithProviders";
import type {
  BookWithThumbnail,
  ReadingStatusItem,
  ReadingStatusPayload,
} from "../types/LibraryTypes";

vi.mock("../hooks/useGetReadings", () => ({
  default: () => ({
    data: [],
    isLoading: false,
    isFetching: false,
  }),
}));

const originalWindowApi = window.api;

function createBook(overrides: Partial<BookWithThumbnail> = {}): BookWithThumbnail {
  return {
    id: 1,
    title: "Book.epub",
    filePath: "C:\\library\\Book.epub",
    fileHash: "book-1",
    currentPage: 1,
    currentZoom: null,
    currentScroll: null,
    annotations: null,
    thumbnailPath: null,
    numPages: 100,
    createdAt: "2026-01-01T00:00:00.000Z",
    lastOpenedAt: "2026-01-02T00:00:00.000Z",
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

function createStatusItem(overrides: Partial<ReadingStatusItem> = {}): ReadingStatusItem {
  return {
    id: "status-1",
    bookId: "active",
    title: "Active.epub",
    author: null,
    coverPath: null,
    description: null,
    isbn: null,
    publisher: null,
    publishDate: null,
    subject: null,
    status: "reading",
    order: 0,
    isPrimary: true,
    manualBasePage: 0,
    manualCurrentPage: 10,
    manualTotalPages: 200,
    localProgressPages: 5,
    notePath: null,
    notesMarkdown: null,
    rating: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    book: null,
    missingDocument: false,
    ...overrides,
  };
}

function createStatusPayload(
  activeBook: BookWithThumbnail,
  doneBook: BookWithThumbnail,
): ReadingStatusPayload {
  return {
    items: [
      createStatusItem({
        id: "status-1",
        bookId: activeBook.fileHash,
        title: activeBook.title,
        status: "reading",
        isPrimary: true,
        manualCurrentPage: 10,
        manualTotalPages: 200,
        localProgressPages: 5,
        book: activeBook,
      }),
      createStatusItem({
        id: "status-2",
        bookId: null,
        title: "Reading Next",
        author: "Manual Author",
        status: "reading",
        order: 1,
        isPrimary: false,
        manualCurrentPage: 0,
        manualTotalPages: null,
        localProgressPages: 0,
      }),
      createStatusItem({
        id: "status-3",
        bookId: null,
        title: "Future Manual",
        status: "want_to_read",
        order: 0,
        isPrimary: false,
      }),
      createStatusItem({
        id: "status-4",
        bookId: null,
        title: "Paused Manual",
        status: "paused",
        order: 0,
        isPrimary: false,
        manualCurrentPage: 40,
        manualTotalPages: 120,
      }),
      createStatusItem({
        id: "status-5",
        bookId: doneBook.fileHash,
        title: doneBook.title,
        status: "read",
        order: 0,
        isPrimary: false,
        manualCurrentPage: 100,
        manualTotalPages: 100,
        rating: 4,
        book: doneBook,
      }),
    ],
  };
}

describe("AtlasPage", () => {
  const listBooks = vi.fn();
  const updateReadingStatus = vi.fn();
  const getReadingStatusItems = vi.fn();
  const addLibraryBookToReadingStatus = vi.fn();
  const updateReadingStatusItemStatus = vi.fn();
  const positionReadingStatusItem = vi.fn();
  const updateReadingStatusItemProgress = vi.fn();
  const addReadingStatusProgressEvent = vi.fn();
  const deleteReadingStatusItem = vi.fn();
  const setPrimaryReadingStatusItem = vi.fn();
  const updateReadingStatusItemCover = vi.fn();
  const updateReadingStatusItemMetadata = vi.fn();
  const updateRating = vi.fn();

  const activeBook = createBook({
    id: 2,
    title: "Active.epub",
    fileHash: "active",
    currentPage: 25,
  });
  const doneBook = createBook({
    id: 3,
    title: "Done.epub",
    fileHash: "done",
    currentPage: 100,
    rating: 4,
    notes: "Good",
    readingStatus: "read",
    completedAt: "2026-02-03T12:00:00.000Z",
  });

  beforeEach(() => {
    const statusPayload = createStatusPayload(activeBook, doneBook);

    listBooks.mockResolvedValue({
      items: [activeBook, doneBook],
      total: 2,
      limit: 200,
      offset: 0,
      hasMore: false,
    });
    updateReadingStatus.mockResolvedValue({ success: true });
    getReadingStatusItems.mockResolvedValue({ success: true, payload: statusPayload });
    addLibraryBookToReadingStatus.mockResolvedValue({ success: true, payload: statusPayload });
    updateReadingStatusItemStatus.mockResolvedValue({ success: true, payload: statusPayload });
    positionReadingStatusItem.mockResolvedValue({ success: true, payload: statusPayload });
    updateReadingStatusItemProgress.mockResolvedValue({ success: true, payload: statusPayload });
    addReadingStatusProgressEvent.mockResolvedValue({ success: true, payload: statusPayload });
    deleteReadingStatusItem.mockResolvedValue({ success: true, payload: statusPayload });
    setPrimaryReadingStatusItem.mockResolvedValue({ success: true, payload: statusPayload });
    updateReadingStatusItemCover.mockResolvedValue({ success: true, payload: statusPayload });
    updateReadingStatusItemMetadata.mockResolvedValue({ success: true, payload: statusPayload });
    updateRating.mockResolvedValue(true);

    Object.defineProperty(window, "api", {
      configurable: true,
      writable: true,
      value: {
        listBooks,
        updateReadingStatus,
        getReadingStatusItems,
        addLibraryBookToReadingStatus,
        addManualBookToReadingStatus: vi.fn().mockResolvedValue({ success: true, payload: statusPayload }),
        updateReadingStatusItemStatus,
        positionReadingStatusItem,
        updateReadingStatusItemProgress,
        addReadingStatusProgressEvent,
        deleteReadingStatusItem,
        setPrimaryReadingStatusItem,
        updateReadingStatusItemCover,
        updateReadingStatusItemMetadata,
        updateRating,
        openImageDialog: vi.fn().mockResolvedValue("C:\\covers\\cover.jpg"),
        setThumbnail: vi.fn().mockResolvedValue({ success: true }),
        searchBookMetadata: vi.fn().mockResolvedValue({ success: true, results: [] }),
        updateMetadata: vi.fn().mockResolvedValue({ success: true }),
        setThumbnailFromUrl: vi.fn().mockResolvedValue({ success: true }),
        onLibraryUpdated: vi.fn(() => vi.fn()),
        openDocumentByHash: vi.fn(),
      },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "api", {
      configurable: true,
      writable: true,
      value: originalWindowApi,
    });
  });

  it("shows status filter tabs and book list", async () => {
    renderWithBasicProviders(<AtlasPage />);

    await screen.findByText("Reading Next");
    expect(screen.getAllByText("Lendo").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Concluido").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Fila").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Pausado").length).toBeGreaterThan(0);
  });

  it("shows one selected status lane at a time", async () => {
    renderWithBasicProviders(<AtlasPage />);

    await screen.findByText("Reading Next");
    expect(screen.getAllByText("Active").length).toBeGreaterThan(0);
    expect(screen.getByText("Reading Next")).toBeInTheDocument();
    expect(screen.queryByText("Future Manual")).not.toBeInTheDocument();
    expect(screen.queryByText("Done")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ver Fila" }));
    expect((await screen.findAllByText("Future Manual")).length).toBeGreaterThan(0);
    expect(screen.queryByText("Active")).not.toBeInTheDocument();
    expect(screen.queryByText("Reading Next")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ver Pausado" }));
    expect((await screen.findAllByText("Paused Manual")).length).toBeGreaterThan(0);
    expect(screen.queryByText("Active")).not.toBeInTheDocument();
  });

  it("shows Concluido tab with rated books", async () => {
    renderWithBasicProviders(<AtlasPage />);

    await screen.findByText("Reading Next");
    fireEvent.click(screen.getByRole("button", { name: "Ver Concluido" }));
    expect((await screen.findAllByText("Done")).length).toBeGreaterThan(0);
  });

  it("adds an existing library book to the selected status lane", async () => {
    renderWithBasicProviders(<AtlasPage />);

    await screen.findByText("Reading Next");
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    fireEvent.click((await screen.findAllByText("Done"))[0]);

    await waitFor(() => {
      expect(addLibraryBookToReadingStatus).toHaveBeenCalledWith("reading", "done");
    });
  });

  it("updates manual progress for reading status items", async () => {
    renderWithBasicProviders(<AtlasPage />);

    await screen.findByText("Reading Next");
    const activeCards = screen.getAllByText("Active");
    const activeCard = activeCards[0].closest("article");
    expect(activeCard).toBeTruthy();
    fireEvent.click(within(activeCard!).getByTitle("Acoes"));
    fireEvent.click(await screen.findByText("Ajustar paginas e progresso"));
    const currentPageInputs = screen.getAllByLabelText("Pagina atual");
    fireEvent.change(currentPageInputs[currentPageInputs.length - 1], {
      target: { value: "30" },
    });
    const totalInputs = screen.getAllByLabelText("Total");
    fireEvent.change(totalInputs[totalInputs.length - 1], {
      target: { value: "250" },
    });
    const saveButtons = screen.getAllByRole("button", { name: "Salvar" });
    fireEvent.click(saveButtons[saveButtons.length - 1]);

    await waitFor(() => {
      expect(updateReadingStatusItemProgress).toHaveBeenCalledWith("status-1", {
        manualBasePage: 0,
        manualCurrentPage: 30,
        manualTotalPages: 250,
      });
    });
  });

  it("reorders status items with drag and drop", async () => {
    renderWithBasicProviders(<AtlasPage />);

    await screen.findByText("Reading Next");
    const titles = screen.getAllByText("Active");
    const card = titles[0].closest("article");
    const lane = card?.parentElement?.parentElement;
    expect(card).toBeTruthy();
    expect(lane).toBeTruthy();

    fireEvent.dragStart(card!, {
      dataTransfer: {
        effectAllowed: "",
        setData: vi.fn(),
        getData: vi.fn((key: string) => (key.includes("status") ? "status-1" : "")),
      },
    });
    await waitFor(() => {
      expect(card!.className).toContain("opacity-40");
    });
    fireEvent.dragOver(lane!, {
      dataTransfer: { dropEffect: "" },
    });
    fireEvent.drop(lane!, {
      dataTransfer: {
        getData: vi.fn((key: string) => (key.includes("status") ? "status-1" : "")),
      },
    });

    await waitFor(() => {
      expect(positionReadingStatusItem).toHaveBeenCalledWith("status-1", "reading", 2);
    });
  });
});
