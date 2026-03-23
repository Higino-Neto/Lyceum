import { useState, useEffect } from "react";
import {
  X,
  Star,
  Heart,
  Trash2,
  Edit3,
  FolderOpen,
  RefreshCw,
  FileText,
  Calendar,
  User,
  BookOpen,
  Hash,
  Info,
  Save,
  MapPin,
} from "lucide-react";
import { BookWithThumbnail } from "../../../types/LibraryTypes";
import { calculateProgress } from "./BookGrid/progress";
import toast from "react-hot-toast";

interface BookDetailPanelProps {
  book: BookWithThumbnail;
  onClose: () => void;
  onOpen: () => void;
  onDelete?: () => void;
  onRefresh: () => void;
}

export default function BookDetailPanel({
  book,
  onClose,
  onOpen,
  onDelete,
  onRefresh,
}: BookDetailPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(book.title);
  const [editedAuthor, setEditedAuthor] = useState(book.author || "");
  const [editedDescription, setEditedDescription] = useState(book.description || "");
  const [editedNotes, setEditedNotes] = useState(book.notes || "");
  const [hoverRating, setHoverRating] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [bookPath, setBookPath] = useState<string>("");

  const progress = calculateProgress(book);

  useEffect(() => {
    setEditedTitle(book.title);
    setEditedAuthor(book.author || "");
    setEditedDescription(book.description || "");
    setEditedNotes(book.notes || "");
    
    if (book.filePath) {
      const libraryIndex = book.filePath.toLowerCase().indexOf("library");
      if (libraryIndex !== -1) {
        const pathAfterLibrary = book.filePath.substring(libraryIndex + 8);
        const lastSep = Math.max(
          pathAfterLibrary.lastIndexOf("\\"),
          pathAfterLibrary.lastIndexOf("/")
        );
        const folderPath = lastSep > 0 ? pathAfterLibrary.substring(0, lastSep) : "";
        setBookPath(folderPath);
      }
    }
  }, [book]);

  const handleToggleFavorite = async () => {
    const result = await window.api.toggleFavorite(book.fileHash);
    if (result !== undefined) {
      onRefresh();
    }
  };

  const handleRating = async (rating: number) => {
    await window.api.updateRating(book.fileHash, rating);
    onRefresh();
  };

  const handleSaveEdits = async () => {
    try {
      if (editedTitle !== book.title) {
        await window.api.updateTitle(book.fileHash, editedTitle);
      }
      if (editedAuthor !== (book.author || "") || editedDescription !== (book.description || "")) {
        await window.api.updateMetadata(book.fileHash, {
          author: editedAuthor,
          description: editedDescription,
        });
      }
      if (editedNotes !== (book.notes || "")) {
        await window.api.updateNotes(book.fileHash, editedNotes);
      }
      setIsEditing(false);
      onRefresh();
      toast.success("Alterações salvas!");
    } catch (error) {
      toast.error("Erro ao salvar alterações");
    }
  };

  const handleDelete = async () => {
    if (!isDeleting) {
      setIsDeleting(true);
      return;
    }
    
    const result = await window.api.deleteBook(book.fileHash);
    if (result.success) {
      toast.success("Livro removido da biblioteca");
      onDelete?.();
    } else {
      toast.error("Erro ao remover: " + result.error);
      setIsDeleting(false);
    }
  };

  const handleRegenerateThumbnail = async () => {
    const result = await window.api.regenerateThumbnail(book.fileHash);
    if (result.success) {
      toast.success("Thumbnail regenerada!");
      onRefresh();
    } else {
      toast.error("Erro ao regenerar thumbnail");
    }
  };

  const handleShowInFolder = () => {
    window.api.showBookInFolder(book.filePath);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "Desconhecido";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Desconhecida";
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("pt-BR");
    } catch {
      return dateStr;
    }
  };

  const getPathParts = (): string[] => {
    if (!bookPath) return [];
    return bookPath.split(/[/\\]/).filter(Boolean);
  };

  return (
    <div className="fixed inset-y-0 right-0 w-[400px] bg-zinc-900 border-l border-zinc-800 shadow-2xl z-50 flex flex-col animate-slide-in">
      <div className="flex items-center justify-between p-4 border-b border-zinc-800">
        <h2 className="text-lg font-semibold text-zinc-100">Detalhes do Livro</h2>
        <button
          onClick={onClose}
          className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
        >
          <X size={20} className="text-zinc-400" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div className="relative">
          <div className="aspect-[4/5] bg-zinc-800 rounded-lg overflow-hidden shadow-lg">
            {book.thumbnail ? (
              <img
                src={book.thumbnail}
                alt={book.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <FileText size={64} className="text-zinc-600" />
              </div>
            )}
          </div>
          {book.processingStatus === "processing" && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <RefreshCw size={32} className="text-white animate-spin" />
            </div>
          )}
        </div>

        <div className="space-y-4">
          {isEditing ? (
            <input
              type="text"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xl font-bold text-zinc-100 focus:outline-none focus:border-zinc-500"
            />
          ) : (
            <h3 className="text-xl font-bold text-zinc-100">{book.title}</h3>
          )}

          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                onClick={() => handleRating(star)}
                className="p-1 hover:scale-110 transition-transform"
              >
                <Star
                  size={24}
                  className={
                    star <= (hoverRating || book.rating)
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-zinc-600"
                  }
                />
              </button>
            ))}
            {book.rating > 0 && (
              <span className="text-sm text-zinc-400 ml-2">
                {book.rating.toFixed(1)}
              </span>
            )}
          </div>

          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-sm text-zinc-400">
            {progress.toFixed(0)}% lido • Página {book.currentPage} de {book.numPages}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onOpen}
            className="flex-1 flex items-center justify-center gap-2 bg-zinc-100 text-zinc-900 hover:bg-zinc-200 py-3 rounded-sm font-medium transition-colors cursor-pointer"
          >
            <BookOpen size={18} />
            {book.currentPage > 1 ? "Continuar Leitura" : "Começar a Ler"}
          </button>
          <button
            onClick={handleToggleFavorite}
            className={`p-3 rounded-sm transition-colors cursor-pointer ${
              book.isFavorite
                ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            }`}
          >
            <Heart
              size={20}
              className={book.isFavorite ? "fill-red-400" : ""}
            />
          </button>
        </div>

        <div className="border-t border-zinc-800 pt-4">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <User size={16} className="text-zinc-500 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs text-zinc-500">Autor</p>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedAuthor}
                    onChange={(e) => setEditedAuthor(e.target.value)}
                    placeholder="Adicionar autor..."
                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500"
                  />
                ) : (
                  <p className="text-sm text-zinc-300">
                    {book.author || "Desconhecido"}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-start gap-3">
              <FileText size={16} className="text-zinc-500 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs text-zinc-500">Formato</p>
                <p className="text-sm text-zinc-300">
                  PDF • {book.numPages} páginas • {formatFileSize(book.fileSize)}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Calendar size={16} className="text-zinc-500 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs text-zinc-500">Adicionado em</p>
                <p className="text-sm text-zinc-300">{formatDate(book.createdAt)}</p>
              </div>
            </div>

            {bookPath && (
              <div className="flex items-start gap-3">
                <MapPin size={16} className="text-zinc-500 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs text-zinc-500">Localização</p>
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-sm text-zinc-300">Biblioteca</span>
                    {getPathParts().map((part, index) => (
                      <span key={index} className="flex items-center gap-1">
                        <span className="text-zinc-600">/</span>
                        <span className="text-sm text-zinc-300">{part}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {book.isbn && (
              <div className="flex items-start gap-3">
                <Hash size={16} className="text-zinc-500 mt-0.5" />
                <div>
                  <p className="text-xs text-zinc-500">ISBN</p>
                  <p className="text-sm text-zinc-300">{book.isbn}</p>
                </div>
              </div>
            )}

            {book.publisher && (
              <div className="flex items-start gap-3">
                <Info size={16} className="text-zinc-500 mt-0.5" />
                <div>
                  <p className="text-xs text-zinc-500">Editora</p>
                  <p className="text-sm text-zinc-300">{book.publisher}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {isEditing && (
          <div className="border-t border-zinc-800 pt-4">
            <div className="space-y-3">
              <div>
                <label className="text-xs text-zinc-500 block mb-1">Descrição</label>
                <textarea
                  value={editedDescription}
                  onChange={(e) => setEditedDescription(e.target.value)}
                  placeholder="Adicionar descrição..."
                  rows={3}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500 resize-none"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-500 block mb-1">Minhas Anotações</label>
                <textarea
                  value={editedNotes}
                  onChange={(e) => setEditedNotes(e.target.value)}
                  placeholder="Suas anotações pessoais..."
                  rows={4}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500 resize-none"
                />
              </div>
            </div>
          </div>
        )}

        {!isEditing && book.notes && (
          <div className="border-t border-zinc-800 pt-4">
            <h4 className="text-sm font-medium text-zinc-300 mb-2">Minhas Anotações</h4>
            <p className="text-sm text-zinc-400 whitespace-pre-wrap">{book.notes}</p>
          </div>
        )}

        {!isEditing && book.description && (
          <div className="border-t border-zinc-800 pt-4">
            <h4 className="text-sm font-medium text-zinc-300 mb-2">Descrição</h4>
            <p className="text-sm text-zinc-400 whitespace-pre-wrap">{book.description}</p>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-zinc-800 space-y-2">
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <button
                onClick={() => setIsEditing(false)}
                className="flex-1 flex items-center justify-center gap-2 bg-zinc-700 hover:bg-zinc-600 text-white py-2 rounded-sm text-sm transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveEdits}
                className="flex-1 flex items-center justify-center gap-2 bg-zinc-100 text-zinc-900 hover:bg-zinc-200 py-2 rounded-sm text-sm transition-colors cursor-pointer"
              >
                <Save size={16} />
                Salvar
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="flex-1 flex items-center justify-center gap-2 bg-zinc-700 hover:bg-zinc-600 text-white py-2 rounded-sm text-sm transition-colors cursor-pointer"
            >
              <Edit3 size={16} />
              Editar
            </button>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleRegenerateThumbnail}
            className="flex-1 flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 py-2 rounded-sm text-sm transition-colors cursor-pointer"
          >
            <RefreshCw size={16} />
            Regenerar Thumbnail
          </button>
          <button
            onClick={handleShowInFolder}
            className="flex-1 flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 py-2 rounded-sm text-sm transition-colors cursor-pointer"
          >
            <FolderOpen size={16} />
            Abrir Pasta
          </button>
        </div>

        <button
          onClick={handleDelete}
          className={`w-full flex items-center justify-center gap-2 py-2 rounded-sm text-sm transition-colors cursor-pointer ${
            isDeleting
              ? "bg-red-600 hover:bg-red-500 text-white"
              : "bg-zinc-800 hover:bg-red-500/20 text-zinc-400 hover:text-red-400"
          }`}
        >
          <Trash2 size={16} />
          {isDeleting ? "Confirmar exclusão" : "Remover da Biblioteca"}
        </button>
      </div>
    </div>
  );
}
