import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MobileConfirmProvider } from "../mobile/MobileConfirmDialog";
import MobileReadingEntryScreen from "../mobile/MobileReadingEntryScreen";

const api = vi.hoisted(() => ({
  getMobileCategories: vi.fn(), getMobileUserReadings: vi.fn(), getOrCreateMobileBook: vi.fn(),
  createMobileReadingEntry: vi.fn(), updateMobileReadingEntry: vi.fn(), deleteMobileReadingEntry: vi.fn(),
}));
vi.mock("../mobile/readingApi", () => ({ ...api, getMobileReadingQueryEnabled: () => true }));

function renderScreen() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><MobileConfirmProvider><MobileReadingEntryScreen books={[]} sessionEmail="reader@example.com" onOpenProfile={vi.fn()} /></MobileConfirmProvider></QueryClientProvider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  api.getMobileCategories.mockResolvedValue([{ id: "fiction", name: "Ficção" }]);
  api.getMobileUserReadings.mockResolvedValue([]);
  api.getOrCreateMobileBook.mockResolvedValue("remote-book");
  api.createMobileReadingEntry.mockResolvedValue("entry-1");
  api.updateMobileReadingEntry.mockResolvedValue(undefined);
});

describe("mobile reading entry", () => {
  it("shows field errors before sending an incomplete reading", async () => {
    renderScreen();
    await screen.findByRole("option", { name: "Ficção" });
    fireEvent.click(screen.getByRole("button", { name: "Salvar leitura" }));
    expect(screen.getByText("Escolha ou informe um livro.")).toBeInTheDocument();
    expect(screen.getByText("Informe um número inteiro de páginas maior que zero.")).toBeInTheDocument();
    expect(api.createMobileReadingEntry).not.toHaveBeenCalled();
  });

  it("registers a manual book and keeps a visible receipt", async () => {
    renderScreen();
    await screen.findByRole("option", { name: "Ficção" });
    fireEvent.click(screen.getByRole("button", { name: /Escolher livro ou digitar título/ }));
    const bookSearch = screen.getByPlaceholderText("Buscar na biblioteca ou no histórico");
    expect(bookSearch).toHaveClass("mobile-field-with-icon");
    fireEvent.change(bookSearch, { target: { value: "Livro manual" } });
    fireEvent.click(screen.getByRole("button", { name: /Usar “Livro manual”/ }));
    fireEvent.change(screen.getByLabelText("Páginas lidas"), { target: { value: "24" } });
    fireEvent.change(screen.getByLabelText("Tempo de leitura"), { target: { value: "30" } });
    fireEvent.change(screen.getByLabelText("Categoria"), { target: { value: "fiction" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar leitura" }));
    await waitFor(() => expect(api.createMobileReadingEntry).toHaveBeenCalledWith(expect.objectContaining({ sourceName: "Livro manual", pages: 24, readingTime: 30, categoryId: "fiction", bookId: "remote-book" })));
    expect(await screen.findByText("Leitura salva")).toBeInTheDocument();
  });

  it("edits a past reading with the shared validation", async () => {
    api.getMobileUserReadings.mockResolvedValue([{ id: "entry-1", source_name: "Livro antigo", pages: 10, reading_time: 20, reading_date: "2026-09-01", category_id: "fiction", book_id: "remote-book" }]);
    renderScreen();
    await screen.findByRole("option", { name: "Ficção" });
    fireEvent.click(screen.getByRole("tab", { name: "Histórico" }));
    fireEvent.click(await screen.findByRole("button", { name: "Editar" }));
    fireEvent.change(screen.getByLabelText("Páginas lidas"), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    expect(screen.getByText("Informe um número inteiro de páginas maior que zero.")).toBeInTheDocument();
    expect(api.updateMobileReadingEntry).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Páginas lidas"), { target: { value: "18" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    await waitFor(() => expect(api.updateMobileReadingEntry).toHaveBeenCalledWith(expect.objectContaining({ readingId: "entry-1", pages: 18 })));
  });
});
