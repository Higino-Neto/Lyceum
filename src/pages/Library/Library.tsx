import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { LibraryHeader, SectionTabs, FilterBar, BookDetailPanel, FilterOption, SortOption } from "./components";
import BookGrid from "./components/BookGrid";
import useBooks from "./useBooks";
import { BookWithThumbnail } from "../../types/LibraryTypes";

export default function Library() {
  const navigate = useNavigate();

  const {
    syncedBooks,
    unsyncedBooks,
    categories,
    selectedCategory,
    setSelectedCategory,
    handleSync,
    refreshBooks,
  } = useBooks();

  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("title");
  const [filter, setFilter] = useState<FilterOption>("all");
  const [activeSection, setActiveSection] = useState<"synced" | "unsynced">("synced");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [selectedBook, setSelectedBook] = useState<BookWithThumbnail | null>(null);

  useEffect(() => {
    const unsubscribe = window.api.onLibraryUpdated(() => {
      refreshBooks();
    });
    return () => unsubscribe();
  }, [refreshBooks]);

  const handleOpen = async (filePath: string) => {
    const result = await window.api.reopenPdf(filePath);
    if (!result) return;

    navigate("/reading", {
      state: {
        fileBuffer: result.fileBuffer,
        fileHash: result.fileHash,
      },
    });
  };

  const handleBookClick = (book: BookWithThumbnail) => {
    setSelectedBook(book);
  };

  const handleClosePanel = () => {
    setSelectedBook(null);
  };

  const handleBookDeleted = () => {
    setSelectedBook(null);
    refreshBooks();
  };

  const handleBookRefresh = () => {
    refreshBooks();
    if (selectedBook) {
      const updatedBook = [...syncedBooks, ...unsyncedBooks].find(
        (b) => b.fileHash === selectedBook.fileHash
      );
      if (updatedBook) {
        setSelectedBook(updatedBook);
      } else {
        setSelectedBook(null);
      }
    }
  };

  const filterBooks = (booksToFilter: BookWithThumbnail[]) => {
    return booksToFilter
      .filter((book) => {
        if (showFavoritesOnly && !book.isFavorite) return false;
        if (selectedCategory && book.category !== selectedCategory) return false;

        if (filter === "reading")
          return book.currentPage > 0 && book.currentPage < book.numPages;

        if (filter === "finished")
          return book.numPages > 0 && book.currentPage >= book.numPages;

        return true;
      })
      .filter((book) => {
        const searchLower = search.toLowerCase();
        return (
          book.title.toLowerCase().includes(searchLower) ||
          (book.author && book.author.toLowerCase().includes(searchLower)) ||
          (book.description && book.description.toLowerCase().includes(searchLower))
        );
      })
      .sort((a, b) => {
        if (sort === "progress") {
          const pa = a.numPages > 0 ? a.currentPage / a.numPages : 0;
          const pb = b.numPages > 0 ? b.currentPage / b.numPages : 0;
          return pb - pa;
        }

        if (sort === "pages") return b.numPages - a.numPages;

        if (sort === "rating") return b.rating - a.rating;

        if (sort === "recent") {
          return new Date(b.lastOpenedAt).getTime() - new Date(a.lastOpenedAt).getTime();
        }

        return a.title.localeCompare(b.title);
      });
  };

  const currentBooks = activeSection === "synced" ? syncedBooks : unsyncedBooks;
  const filteredBooks = filterBooks(currentBooks);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <LibraryHeader
        syncedCount={syncedBooks.length}
        unsyncedCount={unsyncedBooks.length}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        showFavoritesOnly={showFavoritesOnly}
        onToggleFavorites={() => setShowFavoritesOnly(!showFavoritesOnly)}
      />

      <main className="p-6 space-y-6">
        <SectionTabs
          activeSection={activeSection}
          onSectionChange={setActiveSection}
          syncedCount={syncedBooks.length}
          unsyncedCount={unsyncedBooks.length}
        />

        <FilterBar
          search={search}
          onSearchChange={setSearch}
          sort={sort}
          onSortChange={setSort}
          filter={filter}
          onFilterChange={setFilter}
          categories={categories}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          showCategorySelect={activeSection === "synced"}
        />

        <BookGrid
          books={filteredBooks}
          viewMode={viewMode}
          onOpen={handleOpen}
          onSync={activeSection === "unsynced" ? handleSync : undefined}
          showSyncActions={activeSection === "unsynced"}
          onBookClick={handleBookClick}
          selectedBookId={selectedBook?.id}
        />
      </main>

      {selectedBook && (
        <BookDetailPanel
          book={selectedBook}
          onClose={handleClosePanel}
          onOpen={() => handleOpen(selectedBook.filePath)}
          onDelete={handleBookDeleted}
          onRefresh={handleBookRefresh}
        />
      )}
    </div>
  );
}
