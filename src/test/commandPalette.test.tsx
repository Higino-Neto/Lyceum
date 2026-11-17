import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppSettingsProvider } from "../contexts/AppSettingsContext";
import CommandPalette from "../features/search/CommandPalette";
import { openCommandPalette } from "../features/search/commandPaletteEvents";

function renderPalette(onOpenSettings = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AppSettingsProvider>
          <CommandPalette onOpenSettings={onOpenSettings} />
        </AppSettingsProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return onOpenSettings;
}

describe("command palette", () => {
  beforeEach(() => {
    (window as unknown as { api: unknown }).api = {
      listBooks: vi.fn(async () => ({
        items: [
          { id: 1, title: "O Pequeno Príncipe", author: "Saint-Exupéry", fileHash: "a", filePath: "/l/a.epub", fileType: "epub" },
          { id: 2, title: "Dom Casmurro", author: "Machado de Assis", fileHash: "b", filePath: "/l/b.pdf", fileType: "pdf" },
        ],
        hasMore: false,
        offset: 0,
        limit: 200,
        total: 2,
      })),
      getAllFolders: vi.fn(async () => ["Clássicos"]),
    };
  });

  afterEach(() => {
    delete (window as unknown as { api?: unknown }).api;
  });

  it("opens with Ctrl+K and finds books despite typos and accents", async () => {
    renderPalette();
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    const input = await screen.findByRole("combobox");
    fireEvent.change(input, { target: { value: "pequeno prinicpe" } });
    expect(await screen.findByText("O Pequeno Príncipe")).toBeInTheDocument();
    expect(screen.queryByText("Dom Casmurro")).not.toBeInTheDocument();
  });

  it("runs settings results with Enter", async () => {
    const onOpenSettings = renderPalette();
    act(() => openCommandPalette());
    const input = await screen.findByRole("combobox");
    fireEvent.change(input, { target: { value: "dicionarios" } });
    await waitFor(() => expect(screen.getAllByRole("option").length).toBeGreaterThan(0));
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onOpenSettings).toHaveBeenCalledWith("dictionaries");
  });
});
