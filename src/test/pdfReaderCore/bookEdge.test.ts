import { afterEach, describe, expect, it, vi } from "vitest";
import { bookSections, edgePage, rifflePages } from "../../core/pdf-reader-core/book-edge";
import { installBookEdgeFeature } from "../../../resources/pdfjs-viewer/features/book-edge/index.mjs";

const settle = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };

describe("BookEdge geometry", () => {
  it("covers the entire book with proportional sections, preserving front matter", () => {
    expect(bookSections([{ page: 11, title: "One" }, { page: 31, title: "Two" }], 100)).toEqual([
      { title: "Início", page: 1, end: 10 }, { title: "One", page: 11, end: 30 }, { title: "Two", page: 31, end: 100 },
    ]);
    expect(bookSections([], 1)).toEqual([{ title: "Livro", page: 1, end: 1 }]);
    expect(bookSections([{ page: null, title: "Part", items: [{ page: 1, title: "Chapter" }] }], 8)[0].title).toBe("Chapter");
  });
  it("clamps boundaries and fills windows at both ends without repeated pages", () => {
    expect(edgePage(1, 100)).toBe(100);
    expect(edgePage(-1, 100)).toBe(1);
    expect(rifflePages(100, 100, 6)).toEqual([95, 96, 97, 98, 99, 100]);
    expect(rifflePages(1, 2, 12)).toEqual([1, 2]);
  });
});

describe("Riffle exploration", () => {
  afterEach(() => { vi.restoreAllMocks(); document.body.replaceChildren(); localStorage.clear(); });
  async function setup() {
    HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
    HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D);
    const navigate = vi.fn();
    const pdfPage = { getViewport: ({ scale }: { scale: number }) => ({ width: 600 * scale, height: 800 * scale }), render: () => ({ promise: Promise.resolve(), cancel: vi.fn() }) };
    const app = { pdfDocument: { fingerprints: ["test-book"], getPage: vi.fn(async () => pdfPage) }, eventBus: { on: vi.fn() } };
    const handle = installBookEdgeFeature({ app, facade: { readPageCount: () => 100, readCurrentPage: () => 30, getOutline: async () => [], applyPageAndScroll: navigate } });
    await settle();
    return { handle, navigate, app };
  }
  it("preserves the origin through previews, keyboard navigation and cancellation", async () => {
    const { handle, navigate } = await setup();
    handle.open(70);
    await settle();
    document.querySelector<HTMLButtonElement>('[aria-label="Inspecionar página 71"]')!.click();
    document.querySelector("dialog")!.dispatchEvent(new KeyboardEvent("keydown", { key: "PageDown", bubbles: true }));
    await settle();
    const globalShortcut = vi.fn();
    window.addEventListener("keydown", globalShortcut);
    document.querySelector("dialog")!.dispatchEvent(new KeyboardEvent("keydown", { key: "n", bubbles: true }));
    window.removeEventListener("keydown", globalShortcut);
    expect(globalShortcut).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(document.querySelector(".riffleContext")!.textContent).toContain("30");
    document.querySelector("dialog")!.dispatchEvent(new Event("cancel", { cancelable: true }));
    expect(document.querySelector("dialog")!.open).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });
  it("commits only on explicit open and persists bookmarks without navigating", async () => {
    const { handle, navigate } = await setup();
    handle.open(70);
    document.querySelector<HTMLButtonElement>('[data-action="bookmark"]')!.click();
    expect(JSON.parse(localStorage.getItem("lyceum:book-edge:v1:test-book")!)).toEqual([70]);
    expect(document.querySelectorAll(".bookEdgeBookmark")).toHaveLength(1);
    expect(navigate).not.toHaveBeenCalled();
    document.querySelector<HTMLButtonElement>('[data-action="open"]')!.click();
    expect(navigate).toHaveBeenCalledWith(expect.anything(), { page: 70 });
    expect(document.querySelector("dialog")!.open).toBe(false);
  });
  it("does not populate closed previews when asynchronous rendering finishes", async () => {
    const { handle, app } = await setup();
    let resolvePage: (page: unknown) => void = () => {};
    app.pdfDocument.getPage.mockImplementation(() => new Promise(resolve => { resolvePage = resolve; }) as never);
    handle.open(80);
    handle.close();
    resolvePage({ getViewport: vi.fn() });
    await settle();
    expect(document.querySelectorAll(".rifflePreview canvas")).toHaveLength(0);
  });
});
