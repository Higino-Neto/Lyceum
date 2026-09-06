import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MobileConfirmProvider, useMobileConfirm } from "../mobile/MobileConfirmDialog";
import { ReaderDataProvider } from "../mobile/ReaderData";
import MobileLibraryScreen from "../mobile/MobileLibraryScreen";
import { emptyMobileState, migrateMobileState } from "../mobile/storage";
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
beforeEach(() => localStorage.clear());
describe("mobile confirmations", () => {
  it("cancels without running destruction and only resolves true after confirmation", async () => {
    const remove = vi.fn();
    function Harness() { const confirm = useMobileConfirm(); return <button onClick={async () => { if (await confirm("Excluir livro?")) remove(); }}>Excluir</button>; }
    render(<MobileConfirmProvider><Harness /></MobileConfirmProvider>);
    fireEvent.click(screen.getByText("Excluir")); fireEvent.click(screen.getByText("Cancelar"));
    expect(remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Excluir")); fireEvent.click(screen.getByText("Confirmar"));
    await waitFor(() => expect(remove).toHaveBeenCalledTimes(1));
  });
});
describe("mobile library screen", () => {
  const props = () => ({ state: emptyMobileState(), query: { search: "", scope: "all" as const, fileType: "all" as const, sort: "title_asc" as const }, view: "grid" as const,
    onQueryChange: vi.fn(), onViewChange: vi.fn(), onOpenBook: vi.fn(), onImportFiles: vi.fn(), onImportSourceFolder: vi.fn(), onCreateFolder: vi.fn(), onRenameFolder: vi.fn(), onMoveFolder: vi.fn(), onDeleteFolder: vi.fn(), onDeleteSourceFolder: vi.fn(), onUpdateBook: vi.fn(), onMoveBooks: vi.fn().mockResolvedValue(undefined), onDeleteBooks: vi.fn().mockResolvedValue(undefined) });
  it("offers import for an empty library", () => {
    const p = props(); render(<MobileConfirmProvider><ReaderDataProvider><MobileLibraryScreen {...p} /></ReaderDataProvider></MobileConfirmProvider>);
    const buttons = screen.getAllByRole("button").filter(b => /importar/i.test(b.textContent || ""));
    expect(buttons.length).toBeGreaterThan(0); fireEvent.click(buttons[0]); expect(p.onImportFiles).toHaveBeenCalled();
  });
  it("filters by reading status and exposes bulk selection", () => {
    const p = props(); p.state = migrateMobileState({ books: [{ id: "b", title: "Teste", fileType: "txt", fileName: "test.txt" }] });
    render(<MobileConfirmProvider><ReaderDataProvider><MobileLibraryScreen {...p} /></ReaderDataProvider></MobileConfirmProvider>);
    fireEvent.change(screen.getByLabelText("Filtrar status"), { target: { value: "reading" } });
    expect(p.onQueryChange).toHaveBeenCalledWith(expect.objectContaining({ status: "reading" }));
    fireEvent.click(screen.getByLabelText("Selecao em lote"));
    expect(screen.getByPlaceholderText("Tags para os selecionados")).toBeInTheDocument();
  });
});
