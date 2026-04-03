import { useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  BookOpen,
  LayoutGrid,
  List,
  FolderOpen,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import {
  SectionTabs,
  FilterBar,
  BookDetailPanel,
  FolderTree,
  BooksSection,
  FilterOption,
  SortOption,
  StatisticsPanel,
} from "./components";
import BookGrid from "./components/BookGrid";
import useBooks from "./useBooks";
import { BookWithThumbnail, FolderInfo } from "../../types/LibraryTypes";
import toast from "react-hot-toast";
import {
  getAllBooks,
  SupabaseBook,
  mergeBooks,
  updateBook,
  getUserReadings,
  deleteBook,
} from "../../api/database";
import { DocumentRecord } from "../../types/ReadingTypes";
import { calculateSimilarity } from "./utils";

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
  const [editingSupabaseBook, setEditingSupabaseBook] =
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
    const unsubscribe = window.api.onLibraryUpdated(async () => {
      refreshBooks();
      loadFolderStructure();
      const docs = await window.api.getDocuments();
      setLocalDocuments(docs);
    });
    return () => unsubscribe();
  }, [refreshBooks, loadFolderStructure]);

  useEffect(() => {
    loadFolderStructure();
    const loadLocalDocs = async () => {
      try {
        const docs = await window.api.getDocuments();
        setLocalDocuments(docs);
      } catch (error) {
        console.error("Error loading local documents:", error);
      }
    };
    loadLocalDocs();
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

  const handleOpen = async (filePath: string, fileHash?: string) => {
    const result = await window.api.reopenPdf(filePath, fileHash);
    
    if (!result) {
      toast.error("Erro ao abrir o arquivo");
      return;
    }

    if ("error" in result) {
      toast.error(result.message || "Erro ao abrir o arquivo");
      return;
    }

    if (result.foundAt && result.foundAt !== filePath) {
      toast.success("Livro encontrado em nova localização");
      refreshBooks();
    }

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

  const handleSupabaseBookDelete = async (book: SupabaseBook) => {
    try {
      await deleteBook(book.id);
      setSelectedSupabaseBook(null);
      const books = await getAllBooks();
      setSupabaseBooks(books);
      toast.success("Livro excluído!");
    } catch (error) {
      console.error("Error deleting book:", error);
      toast.error("Erro ao excluir livro");
    }
  };

  const handleSupabaseBookEdit = (book: SupabaseBook) => {
    setSelectedSupabaseBook(book);
    setEditingSupabaseBook(book);
    setShowBooksSidebar(true);
  };

  const handleBookRefresh = async () => {
    await refreshBooks();
    if (selectedBook) {
      const allBooks = await window.api.getDocuments();
      const updatedBook = allBooks.find(
        (b: any) => b.fileHash === selectedBook.fileHash,
      );
      if (updatedBook) {
        const thumbnail = updatedBook.thumbnailPath 
          ? await window.api.getThumbnail(updatedBook.thumbnailPath) 
          : null;
        setSelectedBook({ ...updatedBook, thumbnail: thumbnail || undefined });
      } else {
        setSelectedBook(null);
      }
    }
  };

  const filterBooks = (booksToFilter: BookWithThumbnail[]) => {
    return booksToFilter
      .filter((book) => {
        if (selectedFolder !== null && book.filePath) {
          const normalizedFilePath = book.filePath.replace(/\\/g, "/").toLowerCase();
          const normalizedSelectedFolder = selectedFolder.replace(/\\/g, "/").toLowerCase();
          
          const lastSlashIdx = normalizedFilePath.lastIndexOf("/");
          const bookFolder = lastSlashIdx > 0 ? normalizedFilePath.substring(0, lastSlashIdx) : "";
          
          if (!bookFolder.includes(normalizedSelectedFolder)) {
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
        if (!search) return true;
        const { score } = calculateSimilarity(book.title, book.author, search);
        return score > 0.2;
      })
      .sort((a, b) => {
        if (search) {
          const scoreA = calculateSimilarity(a.title, a.author, search).score;
          const scoreB = calculateSimilarity(b.title, b.author, search).score;
          if (scoreA !== scoreB) return scoreB - scoreA;
        }

        if (sort === "progress") {
          const pa = a.numPages > 0 ? a.currentPage / a.numPages : 0;
          const pb = b.numPages > 0 ? b.currentPage / b.numPages : 0;
          return pb - pa;
        }

        if (sort === "pages") return b.numPages - a.numPages;

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
    <div className="h-[calc(100vh-40px)] bg-zinc-950 text-zinc-100 flex overflow-hidden">
      {showSidebar && (
        <aside className="w-64 border-r border-zinc-800 bg-zinc-900/50 flex-shrink-0 h-full overflow-y-auto">
          <div className="h-full flex flex-col">
            <FolderTree
              selectedFolder={selectedFolder}
              onFolderSelect={setSelectedFolder}
              localDocuments={localDocuments}
            />
          </div>
        </aside>
      )}

      <div className="flex-1 flex min-w-0 h-full overflow-hidden">
        <div className="flex flex-col flex-1 min-w-0 h-full">
          <header className="flex-shrink-0 border-b border-zinc-800 px-6 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <BookOpen size={20} className="text-zinc-400" />
              <h1 className="text-base font-semibold tracking-tight">Biblioteca</h1>
              <span className="text-zinc-700">|</span>
              <span className="text-xs text-zinc-500">
                {syncedBooks.length + unsyncedBooks.length} volumes
              </span>
            </div>

            <div className="flex items-center gap-2">
              {showSidebar !== undefined && (
                <button
                  onClick={() => setShowSidebar(!showSidebar)}
                  className="cursor-pointer p-2 bg-zinc-800 text-zinc-400 hover:bg-zinc-700 rounded-sm transition-colors"
                  title={showSidebar ? "Ocultar painel de pastas" : "Mostrar painel de pastas"}
                >
                  {showSidebar ? <PanelLeftClose size={18} /> : <PanelLeft size={18} />}
                </button>
              )}

              <button
                onClick={() => window.api.openLibraryFolder()}
                className="cursor-pointer p-2 bg-zinc-800 text-zinc-400 hover:bg-zinc-700 rounded-sm transition-colors"
                title="Abrir pasta da biblioteca"
              >
                <FolderOpen size={18} />
              </button>

              <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-sm p-0.5">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-1.5 cursor-pointer rounded-sm ${
                    viewMode === "grid"
                      ? "bg-zinc-700 text-white"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  <LayoutGrid size={14} />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`p-1.5 cursor-pointer rounded-sm ${
                    viewMode === "list"
                      ? "bg-zinc-700 text-white"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  <List size={14} />
                </button>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-6">
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
                selectedBook={selectedSupabaseBook}
                onSelectBook={setSelectedSupabaseBook}
                editingBook={editingSupabaseBook}
                onRefresh={async () => {
                  const books = await getAllBooks();
                  setSupabaseBooks(books);
                  const docs = await window.api.getDocuments();
                  setLocalDocuments(docs);
                  setEditingSupabaseBook(null);
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
          </main>
        </div>

        {selectedBook && (
          <aside className="w-80 border-l border-zinc-800 bg-zinc-900 flex-shrink-0 h-full overflow-y-auto">
            <BookDetailPanel
              book={selectedBook}
              onClose={handleClosePanel}
              onOpen={async () => {
                if (!selectedBook.filePath) {
                  toast.error("Caminho do arquivo não encontrado");
                  return;
                }
                await handleOpen(selectedBook.filePath, selectedBook.fileHash);
              }}
              onDelete={handleBookDeleted}
              onRefresh={() => {
                handleBookRefresh();
              }}
            />
          </aside>
        )}

        {activeSection === "books" && selectedSupabaseBook && (
          <aside className="w-96 border-l border-zinc-800 bg-zinc-900 flex-shrink-0 h-full overflow-y-auto">
            <StatisticsPanel
              book={selectedSupabaseBook}
              onClose={() => setSelectedSupabaseBook(null)}
              onEdit={handleSupabaseBookEdit}
              onDelete={handleSupabaseBookDelete}
            />
          </aside>
        )}
      </div>
    </div>
  );
}
