import { describe, expect, it } from "vitest";
import {
  DEFAULT_LIST_COLUMNS_STATE,
  moveListColumn,
  nextSortForColumn,
  activeSortDirection,
  getListColumn,
  normalizeListColumnsState,
  resizeListColumn,
  toggleListColumn,
  visibleListColumns,
} from "../features/library/model/listColumns";
import { isReaderSupported, needsReaderConversion, readerErrorKey } from "../features/library/model/readerFormats";

describe("list columns", () => {
  it("shows the default columns with the title first", () => {
    const ids = visibleListColumns(DEFAULT_LIST_COLUMNS_STATE).map((column) => column.id);
    expect(ids[0]).toBe("title");
    expect(ids).toContain("author");
    expect(ids).not.toContain("isbn");
  });

  it("repairs stored state: unknown ids dropped, title pinned, new columns appended", () => {
    const state = normalizeListColumnsState({
      order: ["size", "bogus" as never, "title", "author"],
      hidden: ["author", "title"],
      widths: { size: 10, author: 250 },
    });
    expect(state.order.slice(0, 3)).toEqual(["title", "size", "author"]);
    expect(state.order).toContain("isbn");
    expect(state.hidden).toContain("isbn");
    expect(state.hidden).not.toContain("title");
    expect(state.widths.size).toBe(getListColumn("size").minWidth);
    expect(state.widths.author).toBe(250);
  });

  it("toggles, moves and resizes columns but never the title", () => {
    let state = normalizeListColumnsState(DEFAULT_LIST_COLUMNS_STATE);
    state = toggleListColumn(state, "isbn");
    expect(visibleListColumns(state).map((column) => column.id)).toContain("isbn");
    expect(toggleListColumn(state, "title")).toBe(state);

    const authorIndex = state.order.indexOf("author");
    expect(moveListColumn(state, "author", -1).order[0]).toBe("title");
    expect(moveListColumn(state, "author", 1).order.indexOf("author")).toBe(authorIndex + 1);
    expect(moveListColumn(state, "title", 1)).toBe(state);

    expect(resizeListColumn(state, "pages", 5).widths.pages).toBe(getListColumn("pages").minWidth);
  });

  it("toggles sort direction from headers, starting descending for numbers", () => {
    const pages = getListColumn("pages");
    const author = getListColumn("author");
    expect(nextSortForColumn(pages, "title_asc")).toBe("pages_desc");
    expect(nextSortForColumn(pages, "pages_desc")).toBe("pages_asc");
    expect(nextSortForColumn(author, "title_asc")).toBe("author_asc");
    expect(nextSortForColumn(getListColumn("progress"), "title_asc")).toBeNull();
    expect(activeSortDirection(getListColumn("lastOpened"), "recent")).toBe("desc");
  });
});

describe("reader formats", () => {
  it("knows which formats open directly, through conversion, or not at all", () => {
    expect(isReaderSupported("/b/livro.epub")).toBe(true);
    expect(isReaderSupported("/b/livro.MOBI")).toBe(true);
    expect(isReaderSupported("/b/livro.fb2.zip")).toBe(true);
    expect(isReaderSupported("/b/livro.kfx")).toBe(false);
    expect(needsReaderConversion("/b/livro.pdf")).toBe(false);
    expect(needsReaderConversion("/b/quadrinho.cbr")).toBe(true);
    expect(readerErrorKey("drm")).toBe("library:reader.errors.drm");
    expect(readerErrorKey("whatever")).toBeNull();
  });
});
