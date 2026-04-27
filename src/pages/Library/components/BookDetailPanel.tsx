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
  Image,
  Upload,
  FileType,
  Sparkles,
} from "lucide-react";
import { BookWithThumbnail } from "../../../types/LibraryTypes";

const getTitleWithoutExtension = (title: string, fileType?: string) => {
  if (fileType === "epub") {
    return title.replace(/\.epub$/i, "");
  }
  return title.replace(/\.pdf$/i, "");
};
import { calculateProgress } from "./BookGrid/progress";
import toast from "react-hot-toast";
import SetThumbnailDialog from "../../../components/SetThumbnailDialog";

interface BookDetailPanelProps {
  book: BookWithThumbnail;
  onClose: () => void;
  onOpenEmbed: () => void;
  onDelete?: () => void;
  onRefresh: () => void;
}

type EditMode = "title" | "author" | null;

export default function BookDetailPanel({
  book,
  onClose,
  onOpenEmbed,
  onDelete,
  onRefresh,
}: BookDetailPanelProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteFileAlso, setDeleteFileAlso] = useState(false);
  const [bookPath, setBookPath] = useState<string>("");
  const [editMode, setEditMode] = useState<EditMode>(null);
  const [editValue, setEditValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [thumbnailDialog, setThumbnailDialog] = useState<{
    open: boolean;
    imagePath: string;
  }>({ open: false, imagePath: "" });
  const [thumbnailKey, setThumbnailKey] = useState(0);
  const [vocabularyStats, setVocabularyStats] = useState<{ hasIndex: boolean; totalWords: number; uniqueWords: number } | null>(null);
  const [isExtractingVocabulary, setIsExtractingVocabulary] = useState(false);

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

  useEffect(() => {
    if (book.fileType === "epub") {
      (window.api as any).getVocabularyStats(book.fileHash).then(setVocabularyStats);
    } else {
      setVocabularyStats(null);
    }
  }, [book.fileHash, book.fileType]);

  const handleExtractVocabulary = async () => {
    if (book.fileType !== "epub") {
      toast.error("Vocabulário só disponível para EPUBs");
      return;
    }
    setIsExtractingVocabulary(true);
    try {
      const result = await (window.api as any).extractVocabulary(book.fileHash);
      if (result.success) {
        toast.success(`Vocabulário extraído: ${result.uniqueWords?.toLocaleString()} palavras únicas`);
        setVocabularyStats({
          hasIndex: true,
          totalWords: result.totalWords || 0,
          uniqueWords: result.uniqueWords || 0,
        });
        onRefresh?.();
      } else {
        toast.error(result.error || "Erro ao extrair vocabulário");
      }
    } catch (error) {
      toast.error("Erro ao extrair vocabulário");
    } finally {
      setIsExtractingVocabulary(false);
    }
  };

  const handleStartEditTitle = () => {
    setEditValue(getTitleWithoutExtension(book.title, book.fileType));
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
      const newTitle = editMode === "title" ? editValue.trim() : getTitleWithoutExtension(book.title, book.fileType);
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
    if (!showDeleteDialog) {
      setShowDeleteDialog(true);
      return;
    }

    const result = await window.api.deleteBook(book.fileHash, deleteFileAlso);
    if (result.success) {
      toast.success(deleteFileAlso ? "Livro excluído do disco" : "Livro removido da biblioteca");
      setShowDeleteDialog(false);
      setDeleteFileAlso(false);
      onDelete?.();
    } else {
      toast.error("Erro ao remover: " + result.error);
    }
    setIsDeleting(false);
  };

  const cancelDelete = () => {
    setShowDeleteDialog(false);
    setDeleteFileAlso(false);
    setIsDeleting(false);
  };

  const handleRegenerateThumbnail = async () => {
    const result = await window.api.regenerateThumbnail(book.fileHash);
    if (result.success) {
      toast.success("Thumbnail regenerada!");
      setThumbnailKey(prev => prev + 1);
      onRefresh();
    } else {
      toast.error("Erro ao regenerar thumbnail");
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length === 0) return;

    const file = files[0];
    const ext = file.name.toLowerCase().split(".").pop();
    
    if (ext !== "jpg" && ext !== "jpeg" && ext !== "png") {
      toast.error("Formato não suportado. Use JPG ou PNG.");
      return;
    }

    setThumbnailDialog({ open: true, imagePath: file.path });
  };

  const handleThumbnailClick = async () => {
    const result = await window.api.openImageDialog();
    if (result) {
      setThumbnailDialog({ open: true, imagePath: result });
    }
  };

  const handleSetThumbnail = async (mode: "replace" | "prepend") => {
    const result = await window.api.setThumbnail(
      book.fileHash,
      thumbnailDialog.imagePath,
      mode
    );

    if (result.success) {
      toast.success(mode === "replace" ? "Thumbnail substituída!" : "Página adicionada!");
      setThumbnailDialog({ open: false, imagePath: "" });
      setThumbnailKey(prev => prev + 1);
      onRefresh();
    } else {
      toast.error(result.error || "Erro ao definir thumbnail");
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
    <div className="w-80 bg-zinc-900 border-l border-zinc-800 flex flex-col h-full">
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900/50">
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
          <div 
            className={`relative aspect-[3/4] bg-zinc-800 rounded-md overflow-hidden shadow-lg cursor-pointer transition-all group ${
              isDragging ? "ring-2 ring-green-500 ring-offset-2 ring-offset-zinc-900" : "hover:ring-2 hover:ring-zinc-600"
            }`}
            onClick={handleThumbnailClick}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            title="Clique para selecionar ou arraste uma imagem"
          >
            {book.thumbnail ? (
              <img
                key={thumbnailKey}
                src={book.thumbnail}
                alt={book.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600">
                <FileText size={32} />
              </div>
            )}
            {book.processingStatus === "processing" && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <RefreshCw size={24} className="text-white animate-spin" />
              </div>
            )}
            {isDragging && (
              <div className="absolute inset-0 bg-green-500/30 flex items-center justify-center">
                <div className="flex flex-col items-center gap-2 text-green-400">
                  <Image size={32} />
                  <span className="text-sm font-medium">Solte para definir capa</span>
                </div>
              </div>
            )}
            {!isDragging && (
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <div className="flex flex-col items-center gap-2 text-white">
                  <Upload size={24} />
                  <span className="text-xs font-medium">Definir capa</span>
                </div>
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
                  {book.fileType && (
                    <div className="flex items-center gap-1 mt-1">
                      <FileType size={12} className="text-zinc-500" />
                      <span className="text-xs text-zinc-400 uppercase">{book.fileType}</span>
                    </div>
                  )}
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
                  {getTitleWithoutExtension(book.title, book.fileType)}
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
          onClick={onOpenEmbed}
          className="w-full flex items-center justify-center gap-2 bg-green-500 text-zinc-900 hover:bg-green-400 py-2.5 rounded-sm text-sm font-medium transition-colors cursor-pointer"
        >
          <BookOpen size={16} />
          {/* <span className="rounded-full bg-zinc-900/10 px-2 py-0.5 text-[11px] uppercase tracking-wide">
            EmbedPDF
          </span> */}
          {book.currentPage > 1 ? "Continuar Leitura" : "Começar a Ler"}
        </button>
      </div>

      <div className="flex-shrink-0 p-4 border-t border-zinc-800 bg-zinc-900/50 space-y-2">
        <div className="flex gap-2">
          {book.fileType === "epub" && (
            <button
              onClick={handleExtractVocabulary}
              disabled={isExtractingVocabulary}
              className="flex-1 flex items-center justify-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 py-2 rounded-sm text-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {isExtractingVocabulary ? (
                <RefreshCw size={12} className="animate-spin" />
              ) : (
                <Sparkles size={12} />
              )}
              {vocabularyStats?.hasIndex ? "Atualizar Vocabulário" : "Extrair Vocabulário"}
            </button>
          )}
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

        {vocabularyStats?.hasIndex && (
          <div className="px-2 py-1.5 bg-zinc-800/50 rounded-sm text-xs text-zinc-400">
            <span className="text-zinc-300">{vocabularyStats.uniqueWords.toLocaleString()}</span> palavras únicas em{' '}
            <span className="text-zinc-300">{vocabularyStats.totalWords.toLocaleString()}</span> palavras
          </div>
        )}

        <button
          onClick={handleDelete}
          disabled={showDeleteDialog}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-sm text-xs transition-colors cursor-pointer bg-zinc-800 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 disabled:opacity-50"
        >
          <Trash2 size={12} />
          Remover
        </button>

        {showDeleteDialog && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-sm max-w-md w-full mx-4">
              <h3 className="text-base font-medium mb-2">Confirmar exclusão</h3>
              <p className="text-sm text-zinc-400 mb-4">
                Tem certeza que deseja remover "{book.title}" da biblioteca?
              </p>
              <label className="flex items-center gap-2 mb-4 text-sm text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={deleteFileAlso}
                  onChange={(e) => setDeleteFileAlso(e.target.checked)}
                  className="w-4 h-4 accent-green-500 cursor-pointer"
                />
                Também excluir arquivo do disco
              </label>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={cancelDelete}
                  className="cursor-pointer px-4 py-2 rounded-sm bg-zinc-800 hover:bg-zinc-700 text-sm transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDelete}
                  className="cursor-pointer px-4 py-2 rounded-sm bg-red-600 hover:bg-red-500 text-zinc-800 text-sm font-medium transition-colors"
                >
                  Excluir
                </button>
              </div>
            </div>
          </div>
        )}

        <SetThumbnailDialog
          isOpen={thumbnailDialog.open}
          imagePath={thumbnailDialog.imagePath}
          onSetThumbnail={handleSetThumbnail}
          onClose={() => setThumbnailDialog({ open: false, imagePath: "" })}
        />
      </div>
    </div>
  );
}
