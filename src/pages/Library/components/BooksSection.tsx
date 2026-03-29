import { useState, useMemo, useEffect } from "react";
import { SupabaseBook, BookReading, getBookReadings, getOrCreateBook } from "../../../api/database";
import { DocumentRecord } from "../../../types/ReadingTypes";
import { AlertTriangle, Check, FileText, BookOpen, GitMerge } from "lucide-react";
import toast from "react-hot-toast";
import { updateBook, mergeBooks } from "../../../api/database";
import { LOCAL_BOOK_PREFIX, calculateSimilarity, normalizeText } from "../utils";

interface BooksSectionProps {
  books: SupabaseBook[];
  localDocuments: DocumentRecord[];
  search: string;
  loading: boolean;
  selectedBook?: SupabaseBook | null;
  onSelectBook?: (book: SupabaseBook | null) => void;
  onRefresh: () => void;
  editingBook?: SupabaseBook | null;
}

interface DuplicatedGroup {
  normalizedTitle: string;
  books: SupabaseBook[];
}

export default function BooksSection({ 
  books, 
  localDocuments, 
  search, 
  loading, 
  selectedBook,
  onSelectBook,
  onRefresh,
  editingBook: externalEditingBook
}: BooksSectionProps) {
  const [selectedGroup, setSelectedGroup] = useState<DuplicatedGroup | null>(null);
  const [showMergeConfirm, setShowMergeConfirm] = useState(false);
  const [merging, setMerging] = useState(false);
  const [editingBook, setEditingBook] = useState<SupabaseBook | null>(null);
  const [editForm, setEditForm] = useState({ title: "", author: "" });
  const [bookReadings, setBookReadings] = useState<BookReading[]>([]);
  const [loadingReadings, setLoadingReadings] = useState(false);

  useEffect(() => {
    if (externalEditingBook) {
      setEditingBook(externalEditingBook);
      setEditForm({ title: externalEditingBook.title, author: externalEditingBook.author || "" });
    }
  }, [externalEditingBook]);

  const [mergeMode, setMergeMode] = useState(false);
  const [selectedForMerge, setSelectedForMerge] = useState<Set<string>>(new Set());
  const [showMergeNameDialog, setShowMergeNameDialog] = useState(false);
  const [mergeFinalName, setMergeFinalName] = useState("");
  const [localThumbnails, setLocalThumbnails] = useState<Record<string, string>>({});

  const internalSelectedBook = selectedBook;

  useEffect(() => {
    const loadThumbnails = async () => {
      const thumbnails: Record<string, string> = {};
      const docsWithThumbnails = localDocuments.filter((doc) => doc.thumbnailPath);
      
      const results = await Promise.all(
        docsWithThumbnails.map(async (doc) => {
          try {
            const thumb = await window.api.getThumbnail(doc.thumbnailPath!);
            return { fileHash: doc.fileHash, thumbnail: thumb || undefined };
          } catch (e) {
            console.error("Error loading thumbnail:", e);
            return { fileHash: doc.fileHash, thumbnail: undefined };
          }
        })
      );

      results.forEach(({ fileHash, thumbnail }) => {
        if (thumbnail) {
          thumbnails[fileHash] = thumbnail;
        }
      });
      
      setLocalThumbnails(thumbnails);
    };
    loadThumbnails();
  }, [localDocuments]);

  useEffect(() => {
    if (internalSelectedBook) {
      setLoadingReadings(true);
      getBookReadings(internalSelectedBook.id)
        .then(setBookReadings)
        .catch(console.error)
        .finally(() => setLoadingReadings(false));
    } else {
      setBookReadings([]);
    }
  }, [internalSelectedBook]);

  const toggleMergeSelection = (itemId: string) => {
    const newSet = new Set(selectedForMerge);
    if (newSet.has(itemId)) {
      newSet.delete(itemId);
    } else {
      newSet.add(itemId);
    }
    setSelectedForMerge(newSet);
  };

  const handleMergeSelected = async () => {
    if (selectedForMerge.size < 2) {
      toast.error("Selecione pelo menos 2 livros para mesclar");
      return;
    }

    const hasSupabase = Array.from(selectedForMerge).some(id => !id.startsWith(LOCAL_BOOK_PREFIX));
    const hasLocal = Array.from(selectedForMerge).some(id => id.startsWith(LOCAL_BOOK_PREFIX));

    if (hasLocal && !hasSupabase) {
      toast.error("Selecione pelo menos um livro do Supabase para mesclar");
      return;
    }

    const selectedBooks = books.filter(b => selectedForMerge.has(b.id));
    if (selectedBooks.length > 0) {
      setMergeFinalName(selectedBooks[0]?.title || "");
    } else {
      const firstLocalId = Array.from(selectedForMerge).find(id => id.startsWith(LOCAL_BOOK_PREFIX));
      const firstLocalDoc = localDocuments.find(d => `${LOCAL_BOOK_PREFIX}${d.fileHash}` === firstLocalId);
      setMergeFinalName(firstLocalDoc?.title || "");
    }
    setShowMergeNameDialog(true);
  };

  const executeMerge = async () => {
    if (!mergeFinalName.trim() || selectedForMerge.size < 2) return;

    setMerging(true);
    try {
      const selectedIds = Array.from(selectedForMerge);
      const supabaseIds = selectedIds.filter(id => !id.startsWith(LOCAL_BOOK_PREFIX));
      const localIds = selectedIds.filter(id => id.startsWith(LOCAL_BOOK_PREFIX)).map(id => id.replace(LOCAL_BOOK_PREFIX, ''));

      if (supabaseIds.length > 0) {
        const selectedBooks = books.filter(b => supabaseIds.includes(b.id));
        const targetBook = selectedBooks[0];

        for (let i = 1; i < selectedBooks.length; i++) {
          await mergeBooks(selectedBooks[i].id, targetBook.id);
        }

        await updateBook(targetBook.id, { title: mergeFinalName.trim() });

        for (const fileHash of localIds) {
          const doc = localDocuments.find(d => d.fileHash === fileHash);
          if (doc && doc.thumbnailPath) {
            const thumb = await window.api.getThumbnail(doc.thumbnailPath);
            if (thumb) {
              await updateBook(targetBook.id, { thumbnail_url: thumb });
            }
          }
          await window.api.updateBookId(fileHash, targetBook.id);
        }
      } else {
        if (localIds.length >= 2) {
          const firstDoc = localDocuments.find(d => d.fileHash === localIds[0]);
          if (firstDoc) {
            let thumbUrl: string | undefined;
            if (firstDoc.thumbnailPath) {
              const thumb = await window.api.getThumbnail(firstDoc.thumbnailPath);
              thumbUrl = thumb || undefined;
            }
            const newBookId = await getOrCreateBook(
              mergeFinalName.trim(),
              firstDoc.author || undefined,
              thumbUrl,
              firstDoc.numPages || undefined
            );

            for (let i = 1; i < localIds.length; i++) {
              await window.api.updateBookId(localIds[i], newBookId);
            }
            await window.api.updateBookId(localIds[0], newBookId);
          }
        }
      }
      
      await onRefresh();
      setSelectedForMerge(new Set());
      setMergeMode(false);
      setShowMergeNameDialog(false);
      setMergeFinalName("");
      toast.success("Livros mesclados com sucesso!");
    } catch (error) {
      console.error("Error merging books:", error);
      toast.error("Erro ao mesclar livros");
    } finally {
      setMerging(false);
    }
  };

  const totalPages = useMemo(() => {
    return bookReadings.reduce((sum, r) => sum + r.pages, 0);
  }, [bookReadings]);

  const duplicatedGroups = useMemo(() => {
    const groups: DuplicatedGroup[] = [];
    books.forEach(book => {
      const normalized = book.title.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
      const existing = groups.find(g => g.normalizedTitle === normalized);
      if (existing) {
        existing.books.push(book);
      } else {
        groups.push({ normalizedTitle: normalized, books: [book] });
      }
    });
    return groups.filter(g => g.books.length > 1);
  }, [books]);

  const filteredBooks = search
    ? books.filter((b) => {
        const { score } = calculateSimilarity(b.title, b.author, search);
        return score > 0.2;
      })
    : books;

  const filteredLocalDocs = search
    ? localDocuments.filter((doc) => {
        const { score } = calculateSimilarity(doc.title, doc.author, search);
        return score > 0.2;
      })
    : [];

  const unlinkedDocuments = useMemo(() => {
    return localDocuments.filter(doc => !doc.bookId);
  }, [localDocuments]);

  const filteredUnlinkedDocs = search
    ? unlinkedDocuments.filter(doc =>
        doc.title.toLowerCase().includes(search.toLowerCase()) ||
        (doc.author?.toLowerCase().includes(search.toLowerCase()))
      )
    : unlinkedDocuments;

  const getLinkedDocuments = (bookId: string) => {
    return localDocuments.filter(doc => doc.bookId === bookId);
  };

  const getUnlinkedDocuments = (bookTitle: string) => {
    const normalized = bookTitle.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
    return localDocuments.filter(doc => {
      const docNormalized = doc.title.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
      return docNormalized.includes(normalized) || normalized.includes(docNormalized);
    });
  };

  const handleMerge = async () => {
    if (!selectedGroup || !selectedBook) return;
    
    setMerging(true);
    try {
      const targetId = selectedBook.id;
      const sourceIds = selectedGroup.books
        .filter(b => b.id !== targetId)
        .map(b => b.id);

      for (const sourceId of sourceIds) {
        await mergeBooks(sourceId, targetId);
      }

      await onRefresh();
      setSelectedGroup(null);
      onSelectBook?.(null);
      setShowMergeConfirm(false);
      toast.success("Livros mesclados com sucesso!");
    } catch (error) {
      console.error("Error merging books:", error);
      toast.error("Erro ao mesclar livros");
    } finally {
      setMerging(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingBook) return;

    try {
      await updateBook(editingBook.id, {
        title: editForm.title,
        author: editForm.author || null,
      });
      setEditingBook(null);
      await onRefresh();
      toast.success("Livro atualizado!");
    } catch (error) {
      console.error("Error updating book:", error);
      toast.error("Erro ao atualizar livro");
    }
  };

  const handleLinkDocument = async (book: SupabaseBook, doc: DocumentRecord) => {
    try {
      await window.api.updateBookId(doc.fileHash, book.id);
      await onRefresh();
      toast.success(`"${doc.title}" vinculado a "${book.title}"`);
    } catch (error) {
      console.error("Error linking document:", error);
      toast.error("Erro ao vincular documento");
    }
  };

  const handleLinkDocumentToLocal = async (doc: DocumentRecord, bookId: string) => {
    try {
      const book = books.find(b => b.id === bookId);
      if (!book) return;
      await window.api.updateBookId(doc.fileHash, bookId);
      await onRefresh();
      toast.success(`"${doc.title}" vinculado a "${book.title}"`);
    } catch (error) {
      console.error("Error linking document:", error);
      toast.error("Erro ao vincular documento");
    }
  };

  const startEdit = (book: SupabaseBook) => {
    setEditingBook(book);
    setEditForm({ title: book.title, author: book.author || "" });
  };

  if (loading) {
    return (
      <div className="w-full">
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-6 h-6 border-2 border-zinc-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-zinc-500 text-sm">Carregando livros...</p>
        </div>
      </div>
    );
  }

  const hasSearch = search.length > 0;
  const showLocalDocsInMerge = mergeMode && hasSearch && filteredLocalDocs.length > 0;

  if (filteredBooks.length === 0 && !showLocalDocsInMerge) {
    return (
      <div className="w-full">
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <BookOpen size={22} className="text-zinc-600" />
          <p className="text-zinc-500 text-sm">Nenhum livro encontrado.</p>
          <p className="text-zinc-600 text-xs">Registre uma leitura para criar um livro.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center gap-3 mt-3">
          {mergeMode ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400">{selectedForMerge.size} selecionado{selectedForMerge.size !== 1 ? 's' : ''}</span>
              <button
                onClick={handleMergeSelected}
                disabled={selectedForMerge.size < 2}
                className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-sm text-sm flex items-center gap-2 transition-colors"
              >
                <GitMerge size={14} />
                Mesclar
              </button>
              <button
                onClick={() => { setMergeMode(false); setSelectedForMerge(new Set()); }}
                className="cursor-pointer px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-sm text-sm transition-colors"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              onClick={() => setMergeMode(true)}
              className="cursor-pointer px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-sm text-sm flex items-center gap-2 transition-colors"
            >
              <GitMerge size={14} />
              Mesclar Livros
            </button>
          )}
        </div>

      {duplicatedGroups.length > 0 && (
        <div className="bg-yellow-900/20 border border-yellow-800 rounded-sm p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} className="text-yellow-500" />
            <h3 className="text-sm font-medium text-yellow-500">
              {duplicatedGroups.length} grupo{duplicatedGroups.length > 1 ? "s" : ""} de livros duplicados
            </h3>
          </div>
          <p className="text-xs text-zinc-400 mb-3">
            Agrupe e mescle livros com títulos semelhantes para unificar suas leituras.
          </p>
          <div className="flex flex-wrap gap-2">
            {duplicatedGroups.slice(0, 5).map((group, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedGroup(group)}
                className={`cursor-pointer px-3 py-1 rounded-sm text-xs transition-colors ${
                  selectedGroup?.normalizedTitle === group.normalizedTitle
                    ? "bg-yellow-600 text-white"
                    : "bg-yellow-900/50 text-yellow-200 hover:bg-yellow-800"
                }`}
              >
                {group.books[0].title} ({group.books.length})
              </button>
            ))}
            {duplicatedGroups.length > 5 && (
              <span className="text-xs text-zinc-500 py-1">
                +{duplicatedGroups.length - 5} mais
              </span>
            )}
          </div>
        </div>
      )}

      {selectedGroup && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium">Mesclar: "{selectedGroup.books[0].title}"</h3>
            <button
              onClick={() => { setSelectedGroup(null); onSelectBook?.(null); }}
              className="cursor-pointer text-zinc-400 hover:text-white p-1"
            >
              ✕
            </button>
          </div>
          <div className="space-y-2 mb-4">
            {selectedGroup.books.map((book) => (
              <div
                key={book.id}
                onClick={() => onSelectBook?.(book)}
                className={`p-3 rounded-sm border cursor-pointer flex items-center gap-3 transition-colors ${
                  selectedBook?.id === book.id
                    ? "border-zinc-500 bg-zinc-800"
                    : "border-zinc-800 bg-zinc-900 hover:border-zinc-700"
                }`}
              >
                <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                  selectedBook?.id === book.id
                    ? "bg-zinc-500 border-zinc-500"
                    : "border-zinc-600"
                }`}>
                  {selectedBook?.id === book.id && <Check size={10} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-200 truncate">{book.title}</p>
                  <p className="text-xs text-zinc-500 truncate">{book.author || "Autor desconhecido"}</p>
                </div>
                {book.thumbnail_url && (
                  <img src={book.thumbnail_url} alt="" className="w-8 h-12 object-cover rounded-sm" />
                )}
              </div>
            ))}
          </div>
          {selectedBook && selectedGroup.books.length > 1 && (
            <button
              onClick={() => setShowMergeConfirm(true)}
              className="cursor-pointer w-full py-2 bg-zinc-700 hover:bg-zinc-600 rounded-sm text-sm flex items-center justify-center gap-2 transition-colors"
            >
              Mesclar em "{selectedBook.title}"
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
        {filteredBooks.map((book) => {
          const linkedDocs = getLinkedDocuments(book.id);
          const unlinkedDocs = getUnlinkedDocuments(book.title);
          const isSelectedForMerge = selectedForMerge.has(book.id);
          
          return (
            <div
              key={book.id}
              className={`relative flex flex-col gap-2 group cursor-pointer transition-all ${
                internalSelectedBook?.id === book.id ? 'ring-2 ring-zinc-500 rounded-sm' : ''
              } ${isSelectedForMerge ? 'ring-2 ring-blue-500 rounded-sm' : ''}`}
              onClick={() => {
                if (mergeMode) {
                  toggleMergeSelection(book.id);
                } else {
                  onSelectBook?.(book);
                }
              }}
            >
              {mergeMode && (
                <div className={`absolute top-2 left-2 z-10 w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                  isSelectedForMerge 
                    ? 'bg-blue-500 border-blue-500' 
                    : 'bg-black/50 border-zinc-500 hover:border-zinc-400'
                }`}>
                  {isSelectedForMerge && <Check size={14} className="text-white" />}
                </div>
              )}
              <div className="relative rounded-sm overflow-hidden aspect-[4/5] bg-zinc-900 border border-zinc-800">
                {book.thumbnail_url ? (
                  <img
                    src={book.thumbnail_url}
                    alt={book.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <FileText size={28} className="text-zinc-600" />
                  </div>
                )}
                
              </div>
              
              <p className="text-xs text-zinc-300 line-clamp-2">{book.title}</p>
              <p className="text-xs text-zinc-500 truncate">{book.author || "Autor desconhecido"}</p>
              
              {linkedDocs.length > 0 && (
                <p className="text-xs text-green-500 flex items-center gap-1">
                  <Check size={10} /> {linkedDocs.length} vinculado{linkedDocs.length > 1 ? "s" : ""}
                </p>
              )}
            </div>
          );
        })}

        {mergeMode && search && filteredLocalDocs.map((doc) => {
          const isSelectedForMerge = selectedForMerge.has(`${LOCAL_BOOK_PREFIX}${doc.fileHash}`);
          const itemId = `${LOCAL_BOOK_PREFIX}${doc.fileHash}`;
          
          return (
            <div
              key={doc.fileHash}
              className={`relative flex flex-col gap-2 group cursor-pointer transition-all ${
                isSelectedForMerge ? 'ring-2 ring-blue-500 rounded-sm' : ''
              }`}
              onClick={() => toggleMergeSelection(itemId)}
            >
              {isSelectedForMerge && (
                <div className={`absolute top-2 left-2 z-10 w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                  isSelectedForMerge 
                    ? 'bg-blue-500 border-blue-500' 
                    : 'bg-black/50 border-zinc-500 hover:border-zinc-400'
                }`}>
                  {isSelectedForMerge && <Check size={14} className="text-white" />}
                </div>
              )}
              <div className="relative rounded-sm overflow-hidden aspect-[4/5] bg-zinc-900 border border-zinc-800">
                {localThumbnails[doc.fileHash] ? (
                  <img
                    src={localThumbnails[doc.fileHash]}
                    alt={doc.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <FileText size={28} className="text-zinc-600" />
                  </div>
                )}
              </div>
              <p className="text-xs text-zinc-300 line-clamp-2">{doc.title}</p>
              <p className="text-xs text-zinc-500 truncate">{doc.numPages} páginas</p>
              <span className="text-xs px-1.5 py-0.5 rounded bg-green-900 text-green-300 w-fit">
                Local
              </span>
            </div>
          );
        })}
      </div>

      {showMergeConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-sm max-w-md w-full mx-4">
            <h3 className="text-base font-medium mb-2">Confirmar mesclagem</h3>
            <p className="text-sm text-zinc-400 mb-4">
              As leituras dos livros duplicados serão transferidas para "{selectedBook?.title}".
              Os livros duplicados serão excluídos.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowMergeConfirm(false)}
                className="cursor-pointer px-4 py-2 rounded-sm bg-zinc-800 hover:bg-zinc-700 text-sm transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleMerge}
                disabled={merging}
                className="cursor-pointer px-4 py-2 rounded-sm bg-zinc-100 text-zinc-900 hover:bg-white text-sm transition-colors disabled:opacity-50"
              >
                {merging ? "Mesclando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingBook && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-sm max-w-md w-full mx-4">
            <h3 className="text-base font-medium mb-4">Editar Livro</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Título</label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-sm px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Autor</label>
                <input
                  type="text"
                  value={editForm.author}
                  onChange={(e) => setEditForm({ ...editForm, author: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-sm px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => setEditingBook(null)}
                className="cursor-pointer px-4 py-2 rounded-sm bg-zinc-800 hover:bg-zinc-700 text-sm transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveEdit}
                className="cursor-pointer px-4 py-2 rounded-sm bg-zinc-100 text-zinc-900 hover:bg-white text-sm transition-colors"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {showMergeNameDialog && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-sm max-w-md w-full mx-4">
            <h3 className="text-base font-medium mb-4">Definir nome do livro mesclado</h3>
            <p className="text-sm text-zinc-400 mb-4">
              Digite o nome final para o livro que será criado após a mesclagem de {selectedForMerge.size} livros.
            </p>
            <input
              type="text"
              value={mergeFinalName}
              onChange={(e) => setMergeFinalName(e.target.value)}
              placeholder="Nome do livro mesclado"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-sm px-3 py-2 text-sm mb-4"
              autoFocus
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setShowMergeNameDialog(false); setMergeFinalName(""); }}
                className="cursor-pointer px-4 py-2 rounded-sm bg-zinc-800 hover:bg-zinc-700 text-sm transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={executeMerge}
                disabled={merging || !mergeFinalName.trim()}
                className="cursor-pointer px-4 py-2 rounded-sm bg-zinc-100 text-zinc-900 hover:bg-white text-sm transition-colors disabled:opacity-50"
              >
                {merging ? "Mesclando..." : "Mesclar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
