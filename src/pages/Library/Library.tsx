import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { LibraryHeader, SectionTabs, FilterBar, FilterOption, SortOption } from "./components";
import BookGrid from "./components/BookGrid";
import useBooks from "./useBooks";

export default function Library() {
  const navigate = useNavigate();

  const {
    syncedBooks,
    unsyncedBooks,
    categories,
    selectedCategory,
    setSelectedCategory,
    handleSync,
  } = useBooks();

  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("title");
  const [filter, setFilter] = useState<FilterOption>("all");
  const [activeSection, setActiveSection] = useState<"synced" | "unsynced">(
    "synced",
  );

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

  const filterBooks = (booksToFilter: typeof syncedBooks) => {
    return booksToFilter
      .filter((book) => {
        if (selectedCategory && book.category !== selectedCategory)
          return false;

        if (filter === "reading")
          return book.currentPage > 0 && book.currentPage < book.numPages;

        if (filter === "finished")
          return book.numPages > 0 && book.currentPage >= book.numPages;

        return true;
      })
      .filter((book) => book.title.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => {
        if (sort === "progress") {
          const pa = a.numPages > 0 ? a.currentPage / a.numPages : 0;
          const pb = b.numPages > 0 ? b.currentPage / b.numPages : 0;
          return pb - pa;
        }

        if (sort === "pages") return b.numPages - a.numPages;

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
        />
      </main>
    </div>
  );
}
