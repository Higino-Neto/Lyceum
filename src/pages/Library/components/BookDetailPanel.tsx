import { useState, useEffect } from "react";
import {
  X,
  Trash2,
  FolderOpen,
  RefreshCw,
  FileText,
  Calendar,
  User,
  BookOpen,
  Hash,
  Info,
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
  const [isDeleting, setIsDeleting] = useState(false);
  const [bookPath, setBookPath] = useState<string>("");

  const progress = calculateProgress(book);

  useEffect(() => {
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
    <div className="overflow-hidden w-100 bg-zinc-900 shadow-2xl z-50 flex flex-col h-full max-h-[calc(100vh-8.5rem)]">
      <div className="flex items-center justify-between p-4 border-b border-zinc-800">
        <h2 className="text-lg font-semibold text-zinc-100">Detalhes do Livro</h2>
        <button
          onClick={onClose}
          className="p-2 hover:bg-zinc-800 rounded-sm transition-colors cursor-pointer"
        >
          <X size={20} className="text-zinc-400" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="relative">
          <div className="h-48 bg-zinc-800 rounded-sm overflow-hidden shadow-lg">
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

        <h3 className="text-xl font-bold text-zinc-100">{book.title}</h3>

        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-sm text-zinc-400">
          {progress.toFixed(0)}% lido • Página {book.currentPage} de {book.numPages}
        </p>

        <button
          onClick={onOpen}
          className="w-full flex items-center justify-center gap-2 bg-zinc-100 text-zinc-900 hover:bg-zinc-200 py-3 rounded-sm font-medium transition-colors cursor-pointer"
        >
          <BookOpen size={18} />
          {book.currentPage > 1 ? "Continuar Leitura" : "Começar a Ler"}
        </button>

        <div className="border-t border-zinc-800 pt-4">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <User size={16} className="text-zinc-500 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs text-zinc-500">Autor</p>
                <p className="text-sm text-zinc-300">
                  {book.author || "Desconhecido"}
                </p>
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
      </div>

      <div className="p-4 border-t border-zinc-800 space-y-2">
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
