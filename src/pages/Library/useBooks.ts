import { useCallback, useMemo, useState } from "react";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  LibraryListResult,
  LibrarySection,
  LibrarySortOption,
} from "../../types/LibraryTypes";

const PAGE_SIZE = 80;

interface UseBooksOptions {
  section: LibrarySection;
  search: string;
  sort: LibrarySortOption;
  fileType: string;
  folderPath: string | null;
  includeSubfolders: boolean;
}

interface SectionCounts {
  synced: number;
  unsynced: number;
  usb: number;
}

interface UsbBooksApi {
  listUsbBooks: (query: {
    search?: string;
    sort?: LibrarySortOption;
    fileType?: string;
    limit?: number;
    offset?: number;
    countOnly?: boolean;
  }) => Promise<LibraryListResult>;
}

function getUsbApi(): UsbBooksApi {
  return window.api as unknown as UsbBooksApi;
}

function hasLibraryApi(): boolean {
  return !!window.api?.listBooks;
}

async function loadPage(options: UseBooksOptions, offset: number): Promise<LibraryListResult> {
  if (options.section === "usb") {
    return getUsbApi().listUsbBooks({
      search: options.search,
      sort: options.sort,
      fileType: options.fileType,
      limit: PAGE_SIZE,
      offset,
    });
  }

  return window.api.listBooks({
    section: options.section,
    search: options.search,
    sort: options.sort,
    fileType: options.fileType,
    folderPath: options.folderPath,
    includeSubfolders: options.includeSubfolders,
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
    includeSubfolders: options.includeSubfolders,
    limit: 1,
    offset: 0,
  };

  const [synced, unsynced, usb] = await Promise.all([
    window.api.listBooks({ ...base, section: "synced" }),
    window.api.listBooks({ ...base, section: "unsynced" }),
    getUsbApi()
      .listUsbBooks({
        search: options.search,
        sort: options.sort,
        fileType: options.fileType,
        limit: 1,
        offset: 0,
        countOnly: true,
      })
      .catch(() => ({ total: 0 })),
  ]);

  return {
    synced: synced.total,
    unsynced: unsynced.total,
    usb: usb.total,
  };
}

export default function useBooks(options: UseBooksOptions) {
  const queryClient = useQueryClient();
  const booksQueryKey = useMemo(() => ["books", options] as const, [options]);
  const apiAvailable = hasLibraryApi();

  const booksQuery = useInfiniteQuery({
    queryKey: booksQueryKey,
    queryFn: ({ pageParam }) => loadPage(options, pageParam as number),
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.offset + lastPage.limit : undefined,
    enabled: apiAvailable,
  });

  const countsQuery = useQuery({
    queryKey: ["book-counts", options],
    queryFn: () => loadCounts(options),
    staleTime: 30_000,
    enabled: apiAvailable,
  });

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: () => window.api.getCategories(),
    staleTime: 60_000,
    enabled: apiAvailable,
  });

  const books = useMemo(
    () => booksQuery.data?.pages.flatMap((p) => p.items) ?? [],
    [booksQuery.data],
  );

  const total = booksQuery.data?.pages[0]?.total ?? 0;
  const hasMore = !!booksQuery.hasNextPage;
  const loading = booksQuery.isLoading;
  const loadingMore = booksQuery.isFetchingNextPage;
  const counts = useMemo(
    () => countsQuery.data ?? { synced: 0, unsynced: 0, usb: 0 },
    [countsQuery.data],
  );
  const categories = useMemo(
    () => categoriesQuery.data ?? [],
    [categoriesQuery.data],
  );
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const fetchNextPage = useCallback(() => {
    if (!apiAvailable) return;
    booksQuery.fetchNextPage();
  }, [apiAvailable, booksQuery]);

  const refreshBooks = useCallback(async () => {
    if (!apiAvailable) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: booksQueryKey, exact: true }),
      queryClient.invalidateQueries({ queryKey: ["book-counts"] }),
      queryClient.invalidateQueries({ queryKey: ["categories"] }),
    ]);
  }, [apiAvailable, queryClient, booksQueryKey]);

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

  return {
    books,
    total,
    counts,
    hasMore,
    loading,
    loadingMore,
    categories,
    selectedCategory,
    setSelectedCategory,
    handleSync,
    fetchNextPage,
    refreshBooks,
  };
}
