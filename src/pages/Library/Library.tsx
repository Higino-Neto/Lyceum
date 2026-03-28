import { useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { LibraryHeader, SectionTabs, FilterBar, BookDetailPanel, FolderTree, BooksSection, FilterOption, SortOption, StatisticsPanel } from "./components";
import BookGrid from "./components/BookGrid";
import useBooks from "./useBooks";
import { BookWithThumbnail } from "../../types/LibraryTypes";
import { FolderOpen } from "lucide-react";
import { getAllBooks, SupabaseBook, mergeBooks, updateBook, getUserReadings } from "../../api/database";
import { DocumentRecord } from "../../types/ReadingTypes";

interface FolderInfo {
  name: string;
  path: string;
  fullPath: string;
  bookCount: number;
  subfolders: FolderInfo[];
}

export default function Library() {
  const navigate = useNavigate();

  const { syncedBooks, unsyncedBooks, handleSync, refreshBooks } = useBooks();

  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("title");
  const [filter, setFilter] = useState<FilterOption>("all");
  const [activeSection, setActiveSection] = useState<
    "synced" | "unsynced" | "books"
  >("synced");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [selectedBook, setSelectedBook] = useState<BookWithThumbnail | null>(
    null,
  );
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [folderStructure, setFolderStructure] = useState<FolderInfo[]>([]);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showBooksSidebar, setShowBooksSidebar] = useState(true);

  const [supabaseBooks, setSupabaseBooks] = useState<SupabaseBook[]>([]);
  const [localDocuments, setLocalDocuments] = useState<DocumentRecord[]>([]);
  const [loadingBooks, setLoadingBooks] = useState(false);
  const [selectedSupabaseBook, setSelectedSupabaseBook] =
    useState<SupabaseBook | null>(null);

  const loadFolderStructure = useCallback(async () => {
    try {
      const structure = await window.api.getFolderStructure();
      setFolderStructure(structure);
    } catch (error) {
      console.error("Error loading folder structure:", error);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = window.api.onLibraryUpdated(() => {
      refreshBooks();
      loadFolderStructure();
    });
    return () => unsubscribe();
  }, [refreshBooks, loadFolderStructure]);

  useEffect(() => {
    loadFolderStructure();
  }, [loadFolderStructure]);

  useEffect(() => {
    if (activeSection === "books") {
      const loadSupabaseBooks = async () => {
        setLoadingBooks(true);
        try {
          const books = await getAllBooks();
          setSupabaseBooks(books);
          const docs = await window.api.getDocuments();
          setLocalDocuments(docs);
        } catch (error) {
          console.error("Error loading books:", error);
        } finally {
          setLoadingBooks(false);
        }
      };
      loadSupabaseBooks();
    }
  }, [activeSection]);

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
        (b) => b.fileHash === selectedBook.fileHash,
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

        if (selectedFolder !== null && book.filePath) {
          const libraryIndex = book.filePath.toLowerCase().indexOf("library");
          if (libraryIndex === -1) return false;

          const afterLibrary = book.filePath.substring(libraryIndex + 8);
          const lastSlash = afterLibrary.lastIndexOf("\\");
          const lastSlashFwd = afterLibrary.lastIndexOf("/");
          const lastSep = Math.max(lastSlash, lastSlashFwd);
          const bookFolder =
            lastSep > 0 ? afterLibrary.substring(0, lastSep) : "";

          if (
            !bookFolder.startsWith(selectedFolder) &&
            bookFolder !== selectedFolder
          ) {
            return false;
          }
        }

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
          (book.description &&
            book.description.toLowerCase().includes(searchLower))
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
          return (
            new Date(b.lastOpenedAt).getTime() -
            new Date(a.lastOpenedAt).getTime()
          );
        }

        return a.title.localeCompare(b.title);
      });
  };

  const currentBooks = activeSection === "synced" ? syncedBooks : unsyncedBooks;
  const filteredBooks = filterBooks(currentBooks);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex">
      {showSidebar && (
        <aside className="w-64 border-r border-zinc-800 bg-zinc-900/50 flex-shrink-0 overflow-y-auto">
          <FolderTree
            selectedFolder={selectedFolder}
            onFolderSelect={setSelectedFolder}
          />
        </aside>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <LibraryHeader
          syncedCount={syncedBooks.length}
          unsyncedCount={unsyncedBooks.length}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          showFavoritesOnly={showFavoritesOnly}
          onToggleFavorites={() => setShowFavoritesOnly(!showFavoritesOnly)}
          showSidebar={showSidebar}
          onToggleSidebar={() => setShowSidebar(!showSidebar)}
        />

        <main className="p-6 flex gap-4">
          <div className="flex-1 min-w-0">
            <SectionTabs
              activeSection={activeSection}
              onSectionChange={setActiveSection}
              syncedCount={syncedBooks.length}
              unsyncedCount={unsyncedBooks.length}
              booksCount={supabaseBooks.length}
            />

            <FilterBar
              search={search}
              onSearchChange={setSearch}
              sort={sort}
              onSortChange={setSort}
              filter={filter}
              onFilterChange={setFilter}
            />

            {activeSection === "books" ? (
              <BooksSection
                books={supabaseBooks}
                localDocuments={localDocuments}
                search={search}
                loading={loadingBooks}
                showSidebar={showBooksSidebar}
                selectedBook={selectedSupabaseBook}
                onSelectBook={setSelectedSupabaseBook}
                onToggleSidebar={() => setShowBooksSidebar(!showBooksSidebar)}
                onRefresh={async () => {
                  const books = await getAllBooks();
                  setSupabaseBooks(books);
                  const docs = await window.api.getDocuments();
                  setLocalDocuments(docs);
                }}
              />
            ) : (
              <BookGrid
                books={filteredBooks}
                viewMode={viewMode}
                onOpen={handleOpen}
                onSync={activeSection === "unsynced" ? handleSync : undefined}
                showSyncActions={activeSection === "unsynced"}
                onBookClick={handleBookClick}
                selectedBookId={selectedBook?.id}
              />
            )}
          </div>
          <div className="sticky top-0 h-fit">
            {selectedBook && (
              <BookDetailPanel
                book={selectedBook}
                onClose={handleClosePanel}
                onOpen={() => handleOpen(selectedBook.filePath)}
                onDelete={handleBookDeleted}
                onRefresh={() => {
                  handleBookRefresh();
                }}
              />
            )}

            {activeSection === "books" && showBooksSidebar && (
        <StatisticsPanel
          book={selectedSupabaseBook}
          onClose={() => setShowBooksSidebar(false)}
        />
      )}
            
          </div>

          
        </main>
      </div>

    </div>
  );
}
