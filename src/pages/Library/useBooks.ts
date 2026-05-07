import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  BookWithThumbnail,
  LibraryFileTypeFilter,
  LibraryListResult,
  LibrarySection,
  LibrarySortOption,
} from "../../types/LibraryTypes";

const PAGE_SIZE = 80;

interface UseBooksOptions {
  section: LibrarySection;
  search: string;
  sort: LibrarySortOption;
  fileType: LibraryFileTypeFilter;
  folderPath: string | null;
}

interface SectionCounts {
  synced: number;
  unsynced: number;
}

async function loadPage(options: UseBooksOptions, offset: number): Promise<LibraryListResult> {
  return window.api.listBooks({
    section: options.section,
    search: options.search,
    sort: options.sort,
    fileType: options.fileType,
    folderPath: options.folderPath,
    limit: PAGE_SIZE,
    offset,
  });
}

async function loadCounts(options: UseBooksOptions): Promise<SectionCounts> {
  const base = {
    search: options.search,
    sort: options.sort,
    fileType: options.fileType,
    folderPath: options.folderPath,
    limit: 1,
    offset: 0,
  };

  const [synced, unsynced] = await Promise.all([
    window.api.listBooks({ ...base, section: "synced" }),
    window.api.listBooks({ ...base, section: "unsynced" }),
  ]);

  return {
    synced: synced.total,
    unsynced: unsynced.total,
  };
}

export default function useBooks(options: UseBooksOptions) {
  const requestId = useRef(0);
  const [books, setBooks] = useState<BookWithThumbnail[]>([]);
  const [total, setTotal] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [counts, setCounts] = useState<SectionCounts>({ synced: 0, unsynced: 0 });
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const offset = pageIndex * PAGE_SIZE;

  const refreshBooks = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);

    try {
      const [page, nextCounts, cats] = await Promise.all([
        loadPage(options, offset),
        loadCounts(options),
        window.api.getCategories(),
      ]);

      if (id !== requestId.current) return;

      setBooks(page.items);
      setTotal(page.total);
      setHasMore(page.hasMore);
      setCounts(nextCounts);
      setCategories(cats);
    } catch (error) {
      console.error("Error loading library page:", error);
      toast.error("Erro ao carregar biblioteca");
    } finally {
      if (id === requestId.current) {
        setLoading(false);
      }
    }
  }, [offset, options]);

  const nextPage = useCallback(() => {
    setPageIndex((current) => Math.min(current + 1, pageCount - 1));
  }, [pageCount]);

  const previousPage = useCallback(() => {
    setPageIndex((current) => Math.max(current - 1, 0));
  }, []);

  const handleSync = async (
    fileHash: string,
    action: "move" | "copy",
    category?: string,
  ) => {
    const result = await window.api.syncDocument(fileHash, action, category);
    if (result.success) {
      toast.success("Livro sincronizado com sucesso!");
      await refreshBooks();
    } else {
      toast.error("Erro ao sincronizar: " + result.error);
    }
  };

  useEffect(() => {
    refreshBooks();
  }, [refreshBooks]);

  useEffect(() => {
    setPageIndex(0);
  }, [options]);

  useEffect(() => {
    if (pageIndex > 0 && pageIndex >= pageCount) {
      setPageIndex(pageCount - 1);
    }
  }, [pageCount, pageIndex]);

  return {
    books,
    total,
    pageIndex,
    pageCount,
    pageSize: PAGE_SIZE,
    offset,
    counts,
    hasMore,
    loading,
    categories,
    selectedCategory,
    setSelectedCategory,
    handleSync,
    nextPage,
    previousPage,
    refreshBooks,
  };
}
