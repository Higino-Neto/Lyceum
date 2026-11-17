import type { BookWithThumbnail, LibraryListResult } from "../../types/LibraryTypes";

/** Loads every library book page by page (used by pickers that filter locally). */
export async function fetchAllLibraryBooks(): Promise<BookWithThumbnail[]> {
  const books: BookWithThumbnail[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const page = await window.api.listBooks({
      section: "all",
      search: "",
      sort: "title_asc",
      fileType: "all",
      folderPath: null,
      limit: 200,
      offset,
    }) as LibraryListResult;

    books.push(...page.items);
    hasMore = page.hasMore;
    offset = page.offset + page.limit;
  }

  return books;
}
