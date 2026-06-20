import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AtlasPage from "../pages/Atlas/AtlasPage";
import { renderWithBasicProviders } from "./helpers/renderWithProviders";
import type {
  BookWithThumbnail,
  ReadingMapPayload,
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

function createMapPayload(book: BookWithThumbnail): ReadingMapPayload {
  return {
    maps: [
      {
        id: "map-1",
        title: "Meu Mapa de Leitura",
        description: "Mapa inicial",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    activeMap: {
      id: "map-1",
      title: "Meu Mapa de Leitura",
      description: "Mapa inicial",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    sections: [
      {
        id: "section-1",
        mapId: "map-1",
        title: "Preambulo",
        description: "Introducao ao caminho.\n\nCobre:\n- leitura ativa",
        order: 0,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        items: [
          {
            id: "item-1",
            sectionId: "section-1",
            bookId: book.fileHash,
            title: book.title,
            author: book.author,
            coverPath: null,
            status: "want_to_read",
            order: 0,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
            book,
            missingDocument: false,
          },
        ],
      },
      {
        id: "section-2",
        mapId: "map-1",
        title: "Fundamentos",
        description: "Conceitos essenciais.",
        order: 1,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        items: [],
      },
    ],
  };
}

function createStatusPayload(
  activeBook: BookWithThumbnail,
  doneBook: BookWithThumbnail,
): ReadingStatusPayload {
  return {
    vaultPath: "C:\\vault",
    items: [
      {
        id: "status-1",
        bookId: activeBook.fileHash,
        title: activeBook.title,
        author: activeBook.author,
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
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        book: activeBook,
        missingDocument: false,
      },
      {
        id: "status-2",
        bookId: null,
        title: "Reading Next",
        author: "Manual Author",
        coverPath: null,
        description: null,
        isbn: null,
        publisher: null,
        publishDate: null,
        subject: null,
        status: "reading",
        order: 1,
        isPrimary: false,
        manualBasePage: 0,
        manualCurrentPage: 0,
        manualTotalPages: null,
        localProgressPages: 0,
        notePath: null,
        notesMarkdown: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        book: null,
        missingDocument: false,
      },
      {
        id: "status-3",
        bookId: null,
        title: "Future Manual",
        author: null,
        coverPath: null,
        description: null,
        isbn: null,
        publisher: null,
        publishDate: null,
        subject: null,
        status: "want_to_read",
        order: 0,
        isPrimary: false,
        manualBasePage: 0,
        manualCurrentPage: 0,
        manualTotalPages: null,
        localProgressPages: 0,
        notePath: null,
        notesMarkdown: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        book: null,
        missingDocument: false,
      },
      {
        id: "status-5",
        bookId: null,
        title: "Paused Manual",
        author: null,
        coverPath: null,
        description: null,
        isbn: null,
        publisher: null,
        publishDate: null,
        subject: null,
        status: "paused",
        order: 0,
        isPrimary: false,
        manualBasePage: 0,
        manualCurrentPage: 40,
        manualTotalPages: 120,
        localProgressPages: 0,
        notePath: null,
        notesMarkdown: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        book: null,
        missingDocument: false,
      },
      {
        id: "status-4",
        bookId: doneBook.fileHash,
        title: doneBook.title,
        author: doneBook.author,
        coverPath: null,
        description: null,
        isbn: null,
        publisher: null,
        publishDate: null,
        subject: null,
        status: "read",
        order: 0,
        isPrimary: false,
        manualBasePage: 0,
        manualCurrentPage: 100,
        manualTotalPages: 100,
        localProgressPages: 0,
        notePath: null,
        notesMarkdown: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        book: doneBook,
        missingDocument: false,
      },
    ],
  };
}

describe("AtlasPage", () => {
  const listBooks = vi.fn();
  const updateReadingStatus = vi.fn();
  const getReadingMap = vi.fn();
  const addLibraryBookToReadingMap = vi.fn();
  const updateReadingMapItemStatus = vi.fn();
  const positionReadingMapItem = vi.fn();
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
  const setAtlasNotesVault = vi.fn();
  const getReadingStatusItemNote = vi.fn();
  const saveReadingStatusItemNote = vi.fn();

  const backlogBook = createBook({ id: 1, title: "Backlog.epub", fileHash: "backlog" });
  const activeBook = createBook({
    id: 2,
    title: "Active.epub",
    fileHash: "active",
    currentPage: 25,
    readingStatus: null,
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
    const payload = createMapPayload(backlogBook);
    const statusPayload = createStatusPayload(activeBook, doneBook);

    listBooks.mockResolvedValue({
      items: [backlogBook, activeBook, doneBook],
      total: 3,
      limit: 200,
      offset: 0,
      hasMore: false,
    });
    updateReadingStatus.mockResolvedValue({ success: true });
    getReadingMap.mockResolvedValue({ success: true, payload });
    addLibraryBookToReadingMap.mockResolvedValue({ success: true, payload });
    updateReadingMapItemStatus.mockResolvedValue({ success: true, payload });
    positionReadingMapItem.mockResolvedValue({ success: true, payload });
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
    setAtlasNotesVault.mockResolvedValue({ success: true, payload: statusPayload });
    getReadingStatusItemNote.mockResolvedValue({
      success: true,
      payload: {
        itemId: "status-1",
        content: "# Active\n\nNotas",
        notePath: "C:\\vault\\Active.md",
        vaultPath: "C:\\vault",
      },
    });
    saveReadingStatusItemNote.mockResolvedValue({
      success: true,
      payload: {
        itemId: "status-1",
        content: "# Active\n\nNotas atualizadas",
        notePath: "C:\\vault\\Active.md",
        vaultPath: "C:\\vault",
      },
    });

    Object.defineProperty(window, "api", {
      configurable: true,
      writable: true,
      value: {
        listBooks,
        updateReadingStatus,
        getReadingMap,
        addLibraryBookToReadingMap,
        addManualBookToReadingMap: vi.fn().mockResolvedValue({ success: true, payload }),
        createReadingMap: vi.fn().mockResolvedValue({ success: true, payload }),
        createReadingMapSection: vi.fn().mockResolvedValue({ success: true, payload }),
        updateReadingMapSection: vi.fn().mockResolvedValue({ success: true, payload }),
        updateReadingMapItemStatus,
        reorderReadingMapItem: vi.fn().mockResolvedValue({ success: true, payload }),
        moveReadingMapItem: vi.fn().mockResolvedValue({ success: true, payload }),
        positionReadingMapItem,
        deleteReadingMapItem: vi.fn().mockResolvedValue({ success: true, payload }),
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
        setAtlasNotesVault,
        getReadingStatusItemNote,
        saveReadingStatusItemNote,
        selectFolder: vi.fn().mockResolvedValue({ canceled: false, filePaths: ["C:\\vault"] }),
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

  it("renders the roadmap canvas with section details", async () => {
    renderWithBasicProviders(<AtlasPage />);

    expect((await screen.findAllByText("Preambulo")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Fundamentos").length).toBeGreaterThan(0);
    expect(screen.getByText("Backlog")).toBeInTheDocument();
    expect(screen.getAllByText("Livros").length).toBeGreaterThan(0);
  });

  it("adds an existing library book to the active section", async () => {
    renderWithBasicProviders(<AtlasPage />);

    await screen.findByText("Backlog");
    fireEvent.click(screen.getByRole("button", { name: "Adicionar livro" }));
    fireEvent.click(await screen.findByText("Active"));

    await waitFor(() => {
      expect(addLibraryBookToReadingMap).toHaveBeenCalledWith("section-1", "active");
    });
  });

  it("updates roadmap item status", async () => {
    renderWithBasicProviders(<AtlasPage />);

    const title = await screen.findByText("Backlog");
    const card = title.closest("article");
    expect(card).toBeTruthy();
    fireEvent.click(within(card!).getByRole("button", { name: "Concluido - Backlog.epub" }));

    await waitFor(() => {
      expect(updateReadingMapItemStatus).toHaveBeenCalledWith("item-1", "read");
    });
  });

  it("repositions roadmap items with drag and drop", async () => {
    renderWithBasicProviders(<AtlasPage />);

    const title = await screen.findByText("Backlog");
    const card = title.closest("article");
    expect(card).toBeTruthy();
    const targetSection = screen.getByText("Fundamentos").closest("section");
    expect(targetSection).toBeTruthy();

    fireEvent.dragStart(card!, {
      dataTransfer: {
        effectAllowed: "",
        setData: vi.fn(),
        getData: vi.fn((key: string) => (key.includes("roadmap") ? "item-1" : "")),
      },
    });
    fireEvent.dragOver(targetSection!, {
      dataTransfer: { dropEffect: "" },
    });
    fireEvent.drop(targetSection!, {
      dataTransfer: {
        getData: vi.fn((key: string) => (key.includes("roadmap") ? "item-1" : "")),
      },
    });

    await waitFor(() => {
      expect(positionReadingMapItem).toHaveBeenCalledWith("item-1", "section-2", 0);
    });
  });

  it("shows one selected status lane at a time", async () => {
    renderWithBasicProviders(<AtlasPage />);

    fireEvent.click(screen.getByRole("button", { name: "Estados" }));
    await screen.findByText("Active");

    expect(screen.getByText("Reading Next")).toBeInTheDocument();
    expect(screen.queryByText("Future Manual")).not.toBeInTheDocument();
    expect(screen.queryByText("Done")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ver Fila" }));
    expect((await screen.findAllByText("Future Manual")).length).toBeGreaterThan(0);
    expect(screen.queryByText("Active")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ver Pausado" }));
    expect((await screen.findAllByText("Paused Manual")).length).toBeGreaterThan(0);
    expect(screen.queryByText("Future Manual")).not.toBeInTheDocument();
  });

  it("adds an existing library book to the selected status lane", async () => {
    renderWithBasicProviders(<AtlasPage />);

    fireEvent.click(screen.getByRole("button", { name: "Estados" }));
    await screen.findByText("Active");
    fireEvent.click(screen.getByRole("button", { name: "Adicionar livro" }));
    fireEvent.click(await screen.findByText("Done"));

    await waitFor(() => {
      expect(addLibraryBookToReadingStatus).toHaveBeenCalledWith("reading", "done");
    });
  });

  it("updates manual progress for reading status items", async () => {
    renderWithBasicProviders(<AtlasPage />);

    fireEvent.click(screen.getByRole("button", { name: "Estados" }));
    await screen.findByText("Active");
    const activeCard = screen.getByText("Active").closest("article");
    expect(activeCard).toBeTruthy();
    fireEvent.click(within(activeCard!).getByTitle("Acoes"));
    fireEvent.click(await screen.findByText("Ajustar paginas e progresso"));
    fireEvent.change(screen.getByLabelText("Pagina atual de Active.epub"), {
      target: { value: "30" },
    });
    fireEvent.change(screen.getByLabelText("Total de paginas de Active.epub"), {
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

    fireEvent.click(screen.getByRole("button", { name: "Estados" }));
    const title = await screen.findByText("Active");
    const card = title.closest("article");
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
      expect(card!.className).toContain("opacity-45");
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
