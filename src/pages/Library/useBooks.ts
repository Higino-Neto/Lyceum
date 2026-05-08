import { useCallback, useMemo, useState } from "react";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
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
  const queryClient = useQueryClient();
  const booksQueryKey = useMemo(() => ["books", options] as const, [options]);

  const booksQuery = useInfiniteQuery({
    queryKey: booksQueryKey,
    queryFn: ({ pageParam }) => loadPage(options, pageParam as number),
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.offset + lastPage.limit : undefined,
  });

  const countsQuery = useQuery({
    queryKey: ["book-counts", options],
    queryFn: () => loadCounts(options),
    staleTime: 30_000,
  });

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: () => window.api.getCategories(),
    staleTime: 60_000,
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
    () => countsQuery.data ?? { synced: 0, unsynced: 0 },
    [countsQuery.data],
  );
  const categories = useMemo(
    () => categoriesQuery.data ?? [],
    [categoriesQuery.data],
  );
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const fetchNextPage = useCallback(() => {
    booksQuery.fetchNextPage();
  }, [booksQuery]);

  const refreshBooks = useCallback(() => {
    queryClient.resetQueries({ queryKey: booksQueryKey, exact: true });
    queryClient.refetchQueries({ queryKey: ["book-counts"] });
    queryClient.refetchQueries({ queryKey: ["categories"] });
  }, [queryClient, booksQueryKey]);

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
