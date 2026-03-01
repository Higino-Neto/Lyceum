import { useNavigate } from "react-router-dom";
import useGetBookData from "./ReadingPage/hooks/useGetBookData";
import { useEffect, useState } from "react";
import {
  FileText,
  BookOpen,
  LayoutGrid,
  List,
  Search,
  SlidersHorizontal,
  FolderSync,
  Folder,
  MoreVertical,
  Copy,
  Move,
  Trash2,
  FolderInput,
} from "lucide-react";
import { DocumentRecord } from "../types/ReadingTypes";

interface BookWithThumbnail extends DocumentRecord {
  thumbnail?: string;
}

type SortOption = "title" | "progress" | "pages";
type FilterOption = "all" | "reading" | "finished";

interface BookGridProps {
  books: BookWithThumbnail[];
  viewMode: "grid" | "list";
  onOpen: (filePath: string) => void;
  onSync?: (fileHash: string, action: "move" | "copy", category?: string) => void;
  showSyncActions?: boolean;
}

function BookGrid({ books, viewMode, onOpen, onSync, showSyncActions }: BookGridProps) {
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);

  if (books.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <BookOpen size={22} className="text-zinc-600" />
        <p className="text-zinc-500 text-sm">Nenhum livro nesta seção.</p>
      </div>
    );
  }

  const handleMouseLeave = () => {
    setHoveredId(null);
  };

  if (viewMode === "grid") {
    return (
      <div 
        className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6"
        onMouseLeave={handleMouseLeave}
      >
        {books.map((book) => {
          const progress =
            book.numPages > 0
              ? Math.min((book.currentPage / book.numPages) * 100, 100)
              : 0;

          const isMenuOpen = menuOpenId === book.id;

          return (
            <div
              key={book.id}
              className="flex flex-col gap-2 cursor-pointer group"
              onClick={() => onOpen(book.filePath)}
              onMouseEnter={() => setHoveredId(book.id)}
            >
              <div className="relative rounded-sm overflow-hidden aspect-[4/5] bg-zinc-900 border border-zinc-800">
                {book.thumbnail ? (
                  <img
                    src={book.thumbnail}
                    alt={book.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <FileText size={28} className="text-zinc-600" />
                  </div>
                )}
                {showSyncActions && onSync && hoveredId === book.id && (
                  <div className="absolute top-2 right-2 z-20">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setMenuOpenId(isMenuOpen ? null : book.id);
                      }}
                      className="p-1 bg-zinc-800 rounded hover:bg-zinc-700"
                    >
                      <MoreVertical size={14} />
                    </button>
                    {isMenuOpen && (
                      <div 
                        className="absolute right-0 mt-1 w-36 bg-zinc-800 border border-zinc-700 rounded-md shadow-lg z-30"
                        onMouseLeave={() => setMenuOpenId(null)}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            onSync(book.fileHash, "move");
                            setMenuOpenId(null);
                          }}
                          className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-zinc-700 rounded-t-md"
                        >
                          <Move size={12} /> Mover para library
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            onSync(book.fileHash, "copy");
                            setMenuOpenId(null);
                          }}
                          className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-zinc-700 rounded-b-md"
                        >
                          <Copy size={12} /> Copiar para library
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <p className="text-xs text-zinc-300 line-clamp-2">{book.title}</p>
              {book.category && (
                <span className="text-xs text-zinc-500">{book.category}</span>
              )}

              <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-green-500" style={{ width: `${progress}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {books.map((book) => {
        const progress =
          book.numPages > 0
            ? Math.min((book.currentPage / book.numPages) * 100, 100)
            : 0;

        return (
          <div
            key={book.id}
            onClick={() => onOpen(book.filePath)}
            className="cursor-pointer flex items-center gap-4 bg-zinc-900 border border-zinc-800 rounded-md p-3"
          >
            <div className="w-10 h-14 bg-zinc-800 rounded overflow-hidden">
              {book.thumbnail ? (
                <img src={book.thumbnail} className="w-full h-full object-cover" />
              ) : (
                <FileText size={14} className="text-zinc-600 m-auto" />
              )}
            </div>

            <div className="flex-1">
              <p className="text-sm text-zinc-200">{book.title}</p>
              {book.category && <span className="text-xs text-zinc-500">{book.category}</span>}
              <div className="h-1 mt-1 bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-green-500" style={{ width: `${progress}%` }} />
              </div>
            </div>

            {showSyncActions && onSync && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSync(book.fileHash, "move");
                }}
                className="p-2 hover:bg-zinc-800 rounded"
                title="Mover para library"
              >
                <FolderInput size={16} className="text-zinc-400" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function Library() {
  const books = useGetBookData();
  const navigate = useNavigate();

  const [syncedBooks, setSyncedBooks] = useState<BookWithThumbnail[]>([]);
  const [unsyncedBooks, setUnsyncedBooks] = useState<BookWithThumbnail[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("title");
  const [filter, setFilter] = useState<FilterOption>("all");
  const [activeSection, setActiveSection] = useState<"synced" | "unsynced">("synced");

  useEffect(() => {
    const loadData = async () => {
      if (!books) return;

      const synced = await Promise.all(
        books
          .filter((book) => book.isSynced === 1)
          .map(async (book) => {
            if (book.thumbnailPath) {
              const thumbnail = await window.api.getThumbnail(book.thumbnailPath);
              return { ...book, thumbnail: thumbnail || undefined };
            }
            return { ...book };
          })
      );

      const unsynced = await Promise.all(
        books
          .filter((book) => !book.isSynced || book.isSynced !== 1)
          .map(async (book) => {
            if (book.thumbnailPath) {
              const thumbnail = await window.api.getThumbnail(book.thumbnailPath);
              return { ...book, thumbnail: thumbnail || undefined };
            }
            return { ...book };
          })
      );

      setSyncedBooks(synced);
      setUnsyncedBooks(unsynced);

      const cats = await window.api.getCategories();
      setCategories(cats);
    };

    loadData();
  }, [books]);

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

  const handleSync = async (fileHash: string, action: "move" | "copy", category?: string) => {
    const result = await window.api.syncDocument(fileHash, action, category);
    if (result.success) {
      await window.api.scanLibrary();
      window.location.reload();
    } else {
      alert("Erro ao sincronizar: " + result.error);
    }
  };

  const filterBooks = (booksToFilter: BookWithThumbnail[]) => {
    return booksToFilter
      .filter((book) => {
        if (selectedCategory && book.category !== selectedCategory) return false;
        
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

  const filterLabels: Record<FilterOption, string> = {
    all: "Todos",
    reading: "Em leitura",
    finished: "Concluídos",
  };

  const currentBooks = activeSection === "synced" ? syncedBooks : unsyncedBooks;
  const filteredBooks = filterBooks(currentBooks);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <BookOpen size={20} className="text-green-500" />
          <h1 className="text-base font-semibold tracking-tight">Biblioteca</h1>
          <span className="text-zinc-700">|</span>
          <span className="text-xs text-zinc-500">
            {syncedBooks.length + unsyncedBooks.length} volumes
          </span>
        </div>

        <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-md p-0.5">
          <button
            onClick={() => setViewMode("grid")}
            className={`p-1.5 rounded ${
              viewMode === "grid" ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <LayoutGrid size={14} />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`p-1.5 rounded ${
              viewMode === "list" ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <List size={14} />
          </button>
        </div>
      </header>

      <main className="p-6 space-y-6">
        <div className="flex items-center gap-4 border-b border-zinc-800 pb-4">
          <button
            onClick={() => setActiveSection("synced")}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm ${
              activeSection === "synced"
                ? "bg-green-600 text-black"
                : "bg-zinc-900 border border-zinc-800 text-zinc-400"
            }`}
          >
            <FolderSync size={16} />
            Sincronizados ({syncedBooks.length})
          </button>
          <button
            onClick={() => setActiveSection("unsynced")}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm ${
              activeSection === "unsynced"
                ? "bg-zinc-700 text-white"
                : "bg-zinc-900 border border-zinc-800 text-zinc-400"
            }`}
          >
            <Folder size={16} />
            Não Sincronizados ({unsyncedBooks.length})
          </button>
        </div>

        <section className="flex flex-wrap items-center gap-3">
          {activeSection === "synced" && categories.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500">Categoria:</span>
              <select
                value={selectedCategory || ""}
                onChange={(e) => setSelectedCategory(e.target.value || null)}
                className="bg-zinc-900 border border-zinc-800 text-xs rounded-md px-2 py-1.5"
              >
                <option value="">Todas</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="relative flex-1 min-w-48 max-w-72">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
            />
            <input
              type="text"
              placeholder="Buscar livro..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-md pl-8 pr-3 py-2 text-sm text-zinc-200"
            />
          </div>

          <div className="flex items-center gap-1">
            {(Object.keys(filterLabels) as FilterOption[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-md text-xs ${
                  filter === f
                    ? "bg-green-600 text-black"
                    : "bg-zinc-900 border border-zinc-800 text-zinc-400"
                }`}
              >
                {filterLabels[f]}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <SlidersHorizontal size={13} className="text-zinc-500" />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOption)}
              className="bg-zinc-900 border border-zinc-800 text-xs rounded-md px-2 py-1.5"
            >
              <option value="title">Nome</option>
              <option value="progress">Progresso</option>
              <option value="pages">Nº de páginas</option>
            </select>
          </div>
        </section>

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
