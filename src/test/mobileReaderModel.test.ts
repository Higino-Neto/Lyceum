import { describe, expect, it } from "vitest";
import { appendHistory, exportAnnotations, hitTestStroke, mergeAnnotations, migrateReaderData, rotateReaderRect, type ReaderAnnotation } from "../mobile/readerModel";
import { capturePdfAnchor, restorePdfAnchor } from "../mobile/pdfViewport";
import { createMobileBackup, parseMobileBackup } from "../mobile/mobileBackup";
import { emptyMobileState, migrateMobileState } from "../mobile/storage";
import { queryMobileBooks } from "../mobile/libraryModel";

const annotation: ReaderAnnotation = { id: "a", bookId: "b", type: "highlight", text: "Trecho", note: "Nota", color: "#facc15", locator: { format: "epub", cfi: "epubcfi(/6/2!/4:0)" }, createdAt: "2026-09-05T00:00:00Z", updatedAt: "2026-09-05T00:00:00Z" };
describe("mobile reader data", () => {
  it("preserves annotations for all formats through a serialized migration", () => {
    const annotations: ReaderAnnotation[] = [annotation, { ...annotation, id: "pdf", locator: { format: "pdf", page: 2, rects: [{ x: .1, y: .2, width: .4, height: .1 }] } }, { ...annotation, id: "txt", locator: { format: "txt", offset: 12, end: 24 } }];
    expect(migrateReaderData(JSON.parse(JSON.stringify({ annotations }))).annotations).toEqual(annotations);
    expect(migrateReaderData({ annotations: [{ ...annotation, locator: { format: "pdf", page: -1 } }] }).annotations).toEqual([]);
  });
  it("hit-tests each distant stroke on its own page, leaving blank space editable", () => {
    const locator = { format: "pdf" as const, page: 2, strokes: [[{ x: .05, y: .05 }, { x: .15, y: .15 }], [{ x: .85, y: .85 }, { x: .95, y: .95 }]] };
    expect(hitTestStroke(2, locator, { x: .1, y: .1 })).toBe(0);
    expect(hitTestStroke(2, locator, { x: .9, y: .9 })).toBe(1);
    expect(hitTestStroke(2, locator, { x: .5, y: .5 })).toBe(-1);
    expect(hitTestStroke(1, locator, { x: .1, y: .1 })).toBe(-1);
  });
  it("rotates highlights with the page and roundtrips", () => {
    const r = { x: .1, y: .2, width: .3, height: .1 };
    const rotated = rotateReaderRect(r, 90);
    expect(rotated.x).toBeCloseTo(.7);
    expect(rotated.y).toBeCloseTo(.1);
    const back = rotateReaderRect(rotated, 270);
    expect(back.x).toBeCloseTo(r.x); expect(back.y).toBeCloseTo(r.y);
  });
  it("keeps newer deletions and reports equal-time conflicts", () => {
    const deletion = { ...annotation, updatedAt: "2026-09-06T00:00:00Z", deletedAt: "2026-09-06T00:00:00Z" };
    expect(mergeAnnotations([deletion], [annotation]).annotations).toEqual([deletion]);
    expect(mergeAnnotations([annotation], [{ ...annotation, note: "Outro" }]).conflicts).toHaveLength(1);
  });
  it("exports quoted CSV without formulas, and omits deleted notes", () => {
    const output = exportAnnotations([{ ...annotation, text: '=HYPERLINK("bad")' }], "csv");
    expect(output).toContain('"\'=HYPERLINK(""bad"")"');
    expect(exportAnnotations([{ ...annotation, deletedAt: annotation.updatedAt }], "md")).not.toContain("Trecho");
  });
  it("truncates forward history only on a new jump", () => {
    expect(appendHistory([1, 2, 3], 1, 4)).toEqual({ items: [1, 2, 4], index: 2 });
    expect(appendHistory([1, 2, 3], 1, 2)).toEqual({ items: [1, 2, 3], index: 1 });
  });
  it("restores an anchor in the gap between PDF pages after scaling", () => {
    const container = document.createElement("div"), page = document.createElement("div");
    page.className = "page"; page.dataset.pageNumber = "2"; container.append(page);
    container.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 600 } as DOMRect);
    page.getBoundingClientRect = () => ({ left: 0, top: 320, bottom: 820, width: 400, height: 500 } as DOMRect);
    const anchor = capturePdfAnchor(container);
    expect(anchor?.page).toBe(2); expect(anchor?.y).toBeCloseTo(-.04);
    page.getBoundingClientRect = () => ({ left: 0, top: 640, bottom: 1640, width: 800, height: 1000 } as DOMRect);
    restorePdfAnchor(container, anchor);
    expect(container.scrollTop).toBe(300); expect(container.scrollLeft).toBe(200);
  });
});
describe("mobile library schema and backup", () => {
  const book = { id: "b", title: "Livro", fileName: "book.txt", fileType: "txt", importedAt: annotation.createdAt, storagePath: "lyceum-books/root/b.txt", readingStatus: "reading", tags: ["estudo", "estudo"], seriesName: "Série", seriesIndex: 2, textOffset: 123 };
  it("migrates old entries and retains new status, tags, series and offsets", () => {
    const state = migrateMobileState({ books: [book] });
    expect(state.books[0]).toMatchObject({ tags: ["estudo"], readingStatus: "reading", seriesIndex: 2, textOffset: 123 });
    expect(queryMobileBooks(state.books, [], [], { search: "", scope: "all", fileType: "all", sort: "series", tag: "estudo", status: "reading" })).toHaveLength(1);
    expect(queryMobileBooks(state.books, [], [], { search: "", scope: "all", fileType: "all", sort: "status", status: "finished" })).toHaveLength(0);
  });
  it("exports/restores annotations without trusting device paths", () => {
    const backup = createMobileBackup(migrateMobileState({ books: [book] }), migrateReaderData({ annotations: [annotation] }));
    const restored = parseMobileBackup(JSON.stringify(backup));
    expect(restored.library.books[0].storagePath).toBeUndefined();
    expect(restored.reader.annotations).toEqual([annotation]);
    expect(() => parseMobileBackup(JSON.stringify({ ...backup, version: 99 }))).toThrow();
    expect(() => parseMobileBackup(JSON.stringify({ ...backup, reader: { annotations: [{ id: "broken" }] } }))).toThrow();
  });
  it("rejects future schema without overwriting current state", () => {
    const backup = createMobileBackup(emptyMobileState(), migrateReaderData(null));
    backup.library.schemaVersion = 900;
    expect(() => parseMobileBackup(JSON.stringify(backup))).toThrow(/Atualize/);
  });
});
