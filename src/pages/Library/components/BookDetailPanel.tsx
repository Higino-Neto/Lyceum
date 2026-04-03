import { useState, useEffect } from "react";
import {
  X,
  Trash2,
  FolderOpen,
  RefreshCw,
  FileText,
  Calendar,
  BookOpen,
  Hash,
  Info,
  MapPin,
  Pencil,
  Save,
  XCircle,
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

type EditMode = "title" | "author" | null;

export default function BookDetailPanel({
  book,
  onClose,
  onOpen,
  onDelete,
  onRefresh,
}: BookDetailPanelProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [bookPath, setBookPath] = useState<string>("");
  const [editMode, setEditMode] = useState<EditMode>(null);
  const [editValue, setEditValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const progress = calculateProgress(book);

  useEffect(() => {
    if (book.filePath) {
      const normalizedPath = book.filePath.replace(/\\/g, "/").toLowerCase();
      const libraryIndex = normalizedPath.indexOf("library");
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

  const handleStartEditTitle = () => {
    setEditValue(book.title.replace(/\.pdf$/i, ""));
    setEditMode("title");
  };

  const handleStartEditAuthor = () => {
    setEditValue(book.author || "");
    setEditMode("author");
  };

  const handleSaveEdit = async () => {
    if (editMode === "title" && !editValue.trim()) {
      toast.error("O título não pode estar vazio");
      return;
    }

    setIsSaving(true);
    try {
      const newTitle = editMode === "title" ? editValue.trim() : book.title.replace(/\.pdf$/i, "");
      const newAuthor = editMode === "author" ? editValue.trim() : (book.author || "");
      
      const result = await window.api.renameBook(book.fileHash, newTitle, newAuthor);
      if (result.success) {
        toast.success("Livro atualizado com sucesso!");
        setEditMode(null);
        setEditValue("");
        onRefresh();
      } else {
        toast.error("Erro ao atualizar: " + result.error);
      }
    } catch (error) {
      toast.error("Erro ao atualizar livro");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditMode(null);
    setEditValue("");
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
    <div className="w-96 bg-zinc-900 border-l border-zinc-800 flex flex-col h-full max-h-[calc(100vh-8.5rem)]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900/50">
        <h2 className="text-base font-semibold text-zinc-100">Detalhes do Livro</h2>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-zinc-800 rounded-sm transition-colors cursor-pointer"
        >
          <X size={18} className="text-zinc-400" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="relative aspect-[3/4] bg-zinc-800 rounded-sm overflow-hidden shadow-lg">
            {book.thumbnail ? (
              <img
                src={book.thumbnail}
                alt={book.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <FileText size={32} className="text-zinc-600" />
              </div>
            )}
            {book.processingStatus === "processing" && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <RefreshCw size={24} className="text-white animate-spin" />
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <FileText size={14} className="text-zinc-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-zinc-500">Arquivo</p>
                <p className="text-sm text-zinc-300">
                  {book.numPages} páginas
                </p>
                <p className="text-xs text-zinc-500">{formatFileSize(book.fileSize)}</p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Calendar size={14} className="text-zinc-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-zinc-500">Adicionado em</p>
                <p className="text-sm text-zinc-300">{formatDate(book.createdAt)}</p>
              </div>
            </div>

            {bookPath && (
              <div className="flex items-start gap-2">
                <MapPin size={14} className="text-zinc-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-zinc-500">Localização</p>
                  <div className="flex items-center gap-1 flex-wrap">
                    {getPathParts().map((part, index) => (
                      <span key={index} className="flex items-center gap-1">
                        {index > 0 && <span className="text-zinc-600">/</span>}
                        <span className="text-sm text-zinc-300">{part}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {book.isbn && (
              <div className="flex items-start gap-2">
                <Hash size={14} className="text-zinc-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-zinc-500">ISBN</p>
                  <p className="text-sm text-zinc-300 truncate">{book.isbn}</p>
                </div>
              </div>
            )}

            {book.publisher && (
              <div className="flex items-start gap-2">
                <Info size={14} className="text-zinc-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-zinc-500">Editora</p>
                  <p className="text-sm text-zinc-300 truncate">{book.publisher}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-xs text-zinc-500 mb-1">Título</p>
            {editMode === "title" ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-sm px-2 py-1.5 text-sm text-zinc-100 focus:outline-none focus:border-green-500"
                  autoFocus
                />
                <button
                  onClick={handleSaveEdit}
                  disabled={isSaving}
                  className="p-1.5 bg-green-600 hover:bg-green-500 rounded-sm transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Save size={14} className="text-white" />
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="p-1.5 bg-zinc-700 hover:bg-zinc-600 rounded-sm transition-colors cursor-pointer"
                >
                  <XCircle size={14} className="text-zinc-300" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-zinc-100 leading-tight flex-1 line-clamp-2">
                  {book.title.replace(/\.pdf$/i, "")}
                </h3>
                <button
                  onClick={handleStartEditTitle}
                  className="p-1 hover:bg-zinc-800 rounded-sm transition-colors cursor-pointer flex-shrink-0"
                  title="Editar título"
                >
                  <Pencil size={14} className="text-zinc-500" />
                </button>
              </div>
            )}
          </div>

          <div>
            <p className="text-xs text-zinc-500 mb-1">Autor</p>
            {editMode === "author" ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-sm px-2 py-1.5 text-sm text-zinc-100 focus:outline-none focus:border-green-500"
                  placeholder="Nome do autor"
                  autoFocus
                />
                <button
                  onClick={handleSaveEdit}
                  disabled={isSaving}
                  className="p-1.5 bg-green-600 hover:bg-green-500 rounded-sm transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Save size={14} className="text-white" />
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="p-1.5 bg-zinc-700 hover:bg-zinc-600 rounded-sm transition-colors cursor-pointer"
                >
                  <XCircle size={14} className="text-zinc-300" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-sm text-zinc-300 flex-1 truncate">
                  {book.author || "Desconhecido"}
                </p>
                <button
                  onClick={handleStartEditAuthor}
                  className="p-1 hover:bg-zinc-800 rounded-sm transition-colors cursor-pointer flex-shrink-0"
                  title="Editar autor"
                >
                  <Pencil size={14} className="text-zinc-500" />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-zinc-500">
            {progress.toFixed(0)}% • Página {book.currentPage} de {book.numPages}
          </p>
        </div>

        <button
          onClick={onOpen}
          className="w-full flex items-center justify-center gap-2 bg-zinc-100 text-zinc-900 hover:bg-zinc-200 py-2.5 rounded-sm text-sm font-medium transition-colors cursor-pointer"
        >
          <BookOpen size={16} />
          {book.currentPage > 1 ? "Continuar Leitura" : "Começar a Ler"}
        </button>
      </div>

      <div className="p-4 border-t border-zinc-800 bg-zinc-900/50 space-y-2">
        <div className="flex gap-2">
          <button
            onClick={handleRegenerateThumbnail}
            className="flex-1 flex items-center justify-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 py-2 rounded-sm text-xs transition-colors cursor-pointer"
          >
            <RefreshCw size={12} />
            Thumbnail
          </button>
          <button
            onClick={handleShowInFolder}
            className="flex-1 flex items-center justify-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 py-2 rounded-sm text-xs transition-colors cursor-pointer"
          >
            <FolderOpen size={12} />
            Abrir Pasta
          </button>
        </div>

        <button
          onClick={handleDelete}
          className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-sm text-xs transition-colors cursor-pointer ${
            isDeleting
              ? "bg-red-600 hover:bg-red-500 text-white"
              : "bg-zinc-800 hover:bg-red-500/20 text-zinc-400 hover:text-red-400"
          }`}
        >
          <Trash2 size={12} />
          {isDeleting ? "Confirmar exclusão" : "Remover"}
        </button>
      </div>
    </div>
  );
}