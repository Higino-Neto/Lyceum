import { useState, useEffect, useRef } from "react";
import {
  AlertTriangle,
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
  Search,
  PanelRightOpen,
  Unlink,
} from "lucide-react";
import { BookWithThumbnail } from "../../../types/LibraryTypes";
import {
  formatPageCount,
  getBookFolderLabel,
  getFileTypeLabel,
} from "../utils";

const getTitleWithoutExtension = (title: string, fileType?: string) => {
  if (fileType) {
    return title.replace(new RegExp(`\\.${fileType}$`, "i"), "");
  }
  return title.replace(/\.[a-z0-9]+$/i, "");
};
import toast from "react-hot-toast";
import SetThumbnailDialog from "../../../components/SetThumbnailDialog";
import BookMetadataSearchDialog from "./BookMetadataSearchDialog";

interface BookDetailPanelProps {
  book: BookWithThumbnail;
  onClose: () => void;
  onOpenReader: (book?: BookWithThumbnail) => void;
  onOpenPreview?: (book?: BookWithThumbnail) => void;
  onConvert?: (book: BookWithThumbnail) => void;
  onDelete?: (deletedFileHash: string) => void | Promise<void>;
  onDissolve?: (book: BookWithThumbnail) => void | Promise<void>;
  onRefresh: (preferredFileHash?: string) => void | Promise<void>;
  readOnly?: boolean;
  previewOpen?: boolean;
}

type EditMode = "title" | "author" | null;
function DetailSkeleton() {
  return (
    <div className="animate-pulse space-y-4 p-4">
      <div className="grid grid-cols-[minmax(118px,160px)_minmax(0,1fr)] gap-4">
        <div className="aspect-[3/4] rounded-md bg-zinc-800" />
        <div className="space-y-3">
          <div className="h-4 w-20 rounded-sm bg-zinc-800" />
          <div className="h-3 w-28 rounded-sm bg-zinc-800" />
          <div className="h-3 w-24 rounded-sm bg-zinc-800" />
          <div className="h-3 w-32 rounded-sm bg-zinc-800" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-4 w-12 rounded-sm bg-zinc-800" />
        <div className="h-6 w-48 rounded-sm bg-zinc-800" />
      </div>
      <div className="space-y-2">
        <div className="h-4 w-12 rounded-sm bg-zinc-800" />
        <div className="h-5 w-36 rounded-sm bg-zinc-800" />
      </div>
      <div className="h-10 w-full rounded-sm bg-zinc-800" />
      <div className="grid grid-cols-3 gap-2">
        <div className="h-10 rounded-sm bg-zinc-800" />
        <div className="h-10 rounded-sm bg-zinc-800" />
        <div className="h-10 rounded-sm bg-zinc-800" />
      </div>
    </div>
  );
}

export default function BookDetailPanel({
  book,
  onClose,
  onOpenReader,
  onOpenPreview,
  onConvert,
  onDelete,
  onDissolve,
  onRefresh,
  readOnly = false,
  previewOpen = false,
}: BookDetailPanelProps) {
  const formatVariants = book.mergedBooks?.length ? book.mergedBooks : [book];
  const initialVariantHash = formatVariants[0]?.fileHash || book.fileHash;
  const [selectedVariantHash, setSelectedVariantHash] = useState(initialVariantHash);
  const selectedVariant =
    formatVariants.find((variant) => variant.fileHash === selectedVariantHash) ||
    formatVariants[0] ||
    book;
  const variantSignature = formatVariants.map((variant) => variant.fileHash).join("\u001f");
  const [thumbnail, setThumbnail] = useState(selectedVariant.thumbnail);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDissolveDialog, setShowDissolveDialog] = useState(false);
  const [deleteFileAlso, setDeleteFileAlso] = useState(false);

  useEffect(() => {
    let canceled = false;
    setThumbnail(selectedVariant.thumbnail);

    if (!selectedVariant.thumbnail && selectedVariant.thumbnailPath) {
      window.api.getThumbnail(selectedVariant.thumbnailPath).then((value: string | null) => {
        if (!canceled) {
          setThumbnail(value || undefined);
        }
      });
    }

    return () => { canceled = true; };
  }, [selectedVariant.fileHash, selectedVariant.thumbnail, selectedVariant.thumbnailPath]);
  const [bookPath, setBookPath] = useState<string>("");
  const [editMode, setEditMode] = useState<EditMode>(null);
  const [editValue, setEditValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showMetadataSearchDialog, setShowMetadataSearchDialog] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [thumbnailDialog, setThumbnailDialog] = useState<{
    open: boolean;
    imagePath: string;
  }>({ open: false, imagePath: "" });
  const [thumbnailKey, setThumbnailKey] = useState(0);
  const [vocabularyStats, setVocabularyStats] = useState<{ hasIndex: boolean; totalWords: number; uniqueWords: number } | null>(null);
  const [isExtractingVocabulary, setIsExtractingVocabulary] = useState(false);

  const prevHashRef = useRef<string | undefined>(undefined);
  const wasPanelOpenRef = useRef(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    if (!book) {
      wasPanelOpenRef.current = false;
      return;
    }

    if (!wasPanelOpenRef.current) {
      wasPanelOpenRef.current = true;
      prevHashRef.current = book.fileHash;
      return;
    }

    if (book.fileHash === prevHashRef.current) return;

    prevHashRef.current = book.fileHash;
    setIsTransitioning(true);
    requestAnimationFrame(() => {
      setIsTransitioning(false);
    });
  }, [book]);

  useEffect(() => {
    if (selectedVariant.filePath) {
      const normalizedPath = selectedVariant.filePath.replace(/\\/g, "/").toLowerCase();
      const libraryIndex = normalizedPath.indexOf("library");
      if (libraryIndex !== -1) {
        const pathAfterLibrary = selectedVariant.filePath.substring(libraryIndex + 8);
        const lastSep = Math.max(
          pathAfterLibrary.lastIndexOf("\\"),
          pathAfterLibrary.lastIndexOf("/")
        );
        const folderPath = lastSep > 0 ? pathAfterLibrary.substring(0, lastSep) : "";
        setBookPath(folderPath);
      } else {
        setBookPath("");
      }
    } else {
      setBookPath("");
    }
  }, [selectedVariant.fileHash, selectedVariant.filePath]);

  useEffect(() => {
    setSelectedVariantHash((current) =>
      formatVariants.some((variant) => variant.fileHash === current)
        ? current
        : formatVariants[0]?.fileHash || book.fileHash,
    );
  }, [book.fileHash, variantSignature]);

  useEffect(() => {
    if (selectedVariant.fileType === "epub") {
      (window.api as any).getVocabularyStats(selectedVariant.fileHash).then(setVocabularyStats);
    } else {
      setVocabularyStats(null);
    }
  }, [selectedVariant.fileHash, selectedVariant.fileType]);

  const handleExtractVocabulary = async () => {
    if (selectedVariant.fileType !== "epub") {
      toast.error("Vocabulário só disponível para EPUBs");
      return;
    }
    setIsExtractingVocabulary(true);
    try {
      const result = await (window.api as any).extractVocabulary(selectedVariant.fileHash);
      if (result.success) {
        toast.success(`Vocabulário extraído: ${result.uniqueWords?.toLocaleString()} palavras únicas`);
        setVocabularyStats({
          hasIndex: true,
          totalWords: result.totalWords || 0,
          uniqueWords: result.uniqueWords || 0,
        });
        await onRefresh?.(selectedVariant.fileHash);
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
    if (readOnly) return;
    setEditValue(getTitleWithoutExtension(selectedVariant.title, selectedVariant.fileType));
    setEditMode("title");
  };

  const handleStartEditAuthor = () => {
    if (readOnly) return;
    setEditValue(selectedVariant.author || "");
    setEditMode("author");
  };

  const handleSaveEdit = async () => {
    if (editMode === "title" && !editValue.trim()) {
      toast.error("O título não pode estar vazio");
      return;
    }

    setIsSaving(true);
    try {
      const newTitle = editMode === "title" ? editValue.trim() : getTitleWithoutExtension(selectedVariant.title, selectedVariant.fileType);
      const newAuthor = editMode === "author" ? editValue.trim() : (selectedVariant.author || "");
      
      const result = await window.api.updateMetadata(selectedVariant.fileHash, {
        title: newTitle,
        author: newAuthor,
      });
      if (result.success) {
        toast.success("Metadados gravados no arquivo.");
        setEditMode(null);
        setEditValue("");
        const nextHash = result.fileHash || selectedVariant.fileHash;
        setSelectedVariantHash(nextHash);
        await onRefresh(nextHash);
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

    const deletedHash = selectedVariant.fileHash;
    const result = await window.api.deleteBook(deletedHash, deleteFileAlso);
    if (result.success) {
      toast.success(deleteFileAlso ? "Livro excluído do disco" : "Livro removido da biblioteca");
      setShowDeleteDialog(false);
      setDeleteFileAlso(false);
      await onDelete?.(deletedHash);
    } else {
      toast.error("Erro ao remover: " + result.error);
    }
  };

  const cancelDelete = () => {
    setShowDeleteDialog(false);
    setDeleteFileAlso(false);
  };

  const handleDissolve = async () => {
    if (!showDissolveDialog) {
      setShowDissolveDialog(true);
      return;
    }

    await onDissolve?.(book);
    setShowDissolveDialog(false);
  };

  const handleRegenerateThumbnail = async () => {
    const result = await window.api.regenerateThumbnail(selectedVariant.fileHash);
    if (result.success) {
      toast.success("Thumbnail regenerada!");
      if (result.thumbnailPath) {
        const refreshedThumbnail = await window.api.getThumbnail(result.thumbnailPath);
        setThumbnail(refreshedThumbnail || undefined);
      }
      setThumbnailKey(prev => prev + 1);
      await onRefresh(selectedVariant.fileHash);
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
    if (readOnly) return;
    const result = await window.api.openImageDialog();
    if (result) {
      setThumbnailDialog({ open: true, imagePath: result });
    }
  };

  const handleSetThumbnail = async (mode: "replace" | "prepend") => {
    const result = await window.api.setThumbnail(
      selectedVariant.fileHash,
      thumbnailDialog.imagePath,
      mode
    );

    if (result.success) {
      toast.success(mode === "replace" ? "Thumbnail substituída!" : "Página adicionada!");
      setThumbnailDialog({ open: false, imagePath: "" });
      if (result.thumbnailPath) {
        const refreshedThumbnail = await window.api.getThumbnail(result.thumbnailPath);
        setThumbnail(refreshedThumbnail || undefined);
      }
      setThumbnailKey(prev => prev + 1);
      const nextHash = result.fileHash || selectedVariant.fileHash;
      setSelectedVariantHash(nextHash);
      await onRefresh(nextHash);
    } else {
      toast.error(result.error || "Erro ao definir thumbnail");
    }
  };

  const handleShowInFolder = () => {
    window.api.showBookInFolder(selectedVariant.filePath);
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

  const canOpenInReader = selectedVariant.fileType === "pdf" || selectedVariant.fileType === "epub";
  const hasFormatVariants = formatVariants.length > 1;

  return (
    <div className="flex h-full w-full min-w-0 flex-col bg-zinc-900">
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900/50">
        <h2 className="text-base font-semibold text-zinc-100">Detalhes do Livro</h2>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-zinc-800 rounded-sm transition-colors cursor-pointer"
        >
          <X size={18} className="text-zinc-400" />
        </button>

      </div>

      {hasFormatVariants && (
        <div
          role="tablist"
          aria-label="Formatos do livro"
          className="flex flex-shrink-0 gap-1 overflow-x-auto border-b border-zinc-800 bg-zinc-950/70 px-3 pt-2"
        >
          {formatVariants.map((variant, index) => {
            const formatLabel = getFileTypeLabel(variant.fileType, variant.filePath);
            const duplicateIndex = formatVariants
              .slice(0, index + 1)
              .filter((candidate) => getFileTypeLabel(candidate.fileType, candidate.filePath) === formatLabel)
              .length;
            const duplicateCount = formatVariants
              .filter((candidate) => getFileTypeLabel(candidate.fileType, candidate.filePath) === formatLabel)
              .length;
            const label = duplicateCount > 1 ? `${formatLabel} ${duplicateIndex}` : formatLabel;

            return (
              <button
                key={variant.fileHash}
                type="button"
                role="tab"
                aria-selected={selectedVariant.fileHash === variant.fileHash}
                aria-label={`${label}: ${variant.fileName || variant.title}`}
                title={variant.fileName || variant.filePath}
                onClick={() => {
                  setEditMode(null);
                  setSelectedVariantHash(variant.fileHash);
                }}
                className={`min-w-16 whitespace-nowrap border-b-2 px-3 py-2 text-xs font-semibold transition-colors ${
                  selectedVariant.fileHash === variant.fileHash
                    ? "border-green-400 text-green-300"
                    : "border-transparent text-zinc-500 hover:text-zinc-200"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      <div className="relative flex-1 overflow-y-auto p-4">
        <div className={`absolute inset-0 z-10 transition-opacity duration-100 ${isTransitioning ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <DetailSkeleton />
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-[minmax(118px,160px)_minmax(0,1fr)] gap-4">
          <div 
            className={`relative aspect-[3/4] bg-zinc-800 rounded-md overflow-hidden shadow-lg cursor-pointer transition-all group ${
              isDragging ? "ring-2 ring-green-500 ring-offset-2 ring-offset-zinc-900" : "hover:ring-2 hover:ring-zinc-600"
            }`}
            onClick={handleThumbnailClick}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            title={readOnly ? selectedVariant.title : "Clique para selecionar ou arraste uma imagem"}
          >
            {thumbnail ? (
              <img
                key={thumbnailKey}
                src={thumbnail}
                alt={selectedVariant.title}
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600">
                <FileText size={32} />
              </div>
            )}
            {selectedVariant.processingStatus === "processing" && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <RefreshCw size={24} className="text-white animate-spin" />
              </div>
            )}
            {selectedVariant.processingStatus === "failed" && (
              <div className="absolute top-1.5 left-1.5 z-20" title="Arquivo corrompido ou não suportado">
                <AlertTriangle size={18} className="text-amber-400 drop-shadow-sm" />
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
            {!readOnly && !isDragging && (
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
                  {selectedVariant.numPages} páginas
                </p>
                <p className="text-xs text-zinc-500">{formatFileSize(selectedVariant.fileSize)}</p>
              </div>
            </div>

            {selectedVariant.processingStatus === "failed" && (
              <div className="flex items-start gap-2 rounded-sm bg-amber-500/10 border border-amber-500/20 px-3 py-2">
                <AlertTriangle size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-amber-400">Arquivo corrompido</p>
                  <p className="text-[11px] text-amber-300/70">O arquivo não é um PDF válido ou está danificado</p>
                </div>
              </div>
            )}

            <div className="flex items-start gap-2">
              <Calendar size={14} className="text-zinc-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-zinc-500">Adicionado em</p>
                <p className="text-sm text-zinc-300">{formatDate(selectedVariant.createdAt)}</p>
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
                  {selectedVariant.fileType && (
                    <div className="flex items-center gap-1 mt-1">
                      <FileType size={12} className="text-zinc-500" />
                      <span className="text-xs text-zinc-400 uppercase">{selectedVariant.fileType}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {selectedVariant.isbn && (
              <div className="flex items-start gap-2">
                <Hash size={14} className="text-zinc-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-zinc-500">ISBN</p>
                  <p className="text-sm text-zinc-300 truncate">{selectedVariant.isbn}</p>
                </div>
              </div>
            )}

            {selectedVariant.publisher && (
              <div className="flex items-start gap-2">
                <Info size={14} className="text-zinc-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-zinc-500">Editora</p>
                  <p className="text-sm text-zinc-300 truncate">{selectedVariant.publisher}</p>
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
                  {getTitleWithoutExtension(selectedVariant.title, selectedVariant.fileType)}
                </h3>
                {!readOnly && (
                <button
                  onClick={handleStartEditTitle}
                  className="p-1 hover:bg-zinc-800 rounded-sm transition-colors cursor-pointer flex-shrink-0"
                  title="Editar título"
                >
                  <Pencil size={14} className="text-zinc-500" />
                </button>
                )}
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
                  {selectedVariant.author || "Desconhecido"}
                </p>
                {!readOnly && (
                <button
                  onClick={handleStartEditAuthor}
                  className="p-1 hover:bg-zinc-800 rounded-sm transition-colors cursor-pointer flex-shrink-0"
                  title="Editar autor"
                >
                  <Pencil size={14} className="text-zinc-500" />
                </button>
                )}
              </div>
            )}
          </div>
        </div>

        {!readOnly && (
          <button
            type="button"
            onClick={() => setShowMetadataSearchDialog(true)}
            className="flex w-full items-center justify-center gap-2 rounded-sm border border-green-500/40 bg-green-500/10 px-3 py-2 text-sm font-medium text-green-200 transition-colors hover:bg-green-500/20"
          >
            <Search size={15} />
            Pesquisar e editar metadados
          </button>
        )}

        <div className="space-y-2">
          <p className="text-xs text-zinc-500">
            {formatPageCount(selectedVariant.numPages, selectedVariant.fileType)}{" "}
            <span className="text-zinc-700">|</span>{" "}
            {getFileTypeLabel(selectedVariant.fileType, selectedVariant.filePath)}{" "}
            <span className="text-zinc-700">|</span>{" "}
            {getBookFolderLabel(selectedVariant.filePath)}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onOpenReader(selectedVariant)}
            disabled={!canOpenInReader}
            className="flex min-w-0 flex-1 cursor-pointer items-center justify-center gap-2 rounded-sm bg-green-500 px-2 py-2.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-green-400 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
          >
            <BookOpen size={16} />
            {canOpenInReader
              ? selectedVariant.currentPage > 1
                ? "Continuar Leitura"
                : "Começar a Ler"
              : "Formato não suportado no leitor"}
          </button>
        {onOpenPreview && (
          <button
            type="button"
            onClick={() => onOpenPreview(selectedVariant)}
            disabled={!canOpenInReader}
            className={`flex h-10 w-11 flex-shrink-0 cursor-pointer items-center justify-center rounded-sm border transition-colors disabled:cursor-not-allowed disabled:border-zinc-800 disabled:bg-zinc-800 disabled:text-zinc-500 ${
              previewOpen
                ? "border-green-500/70 bg-green-500/15 text-green-200 hover:bg-green-500/25"
                : "border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-green-500/60 hover:bg-green-500/10 hover:text-green-200"
            }`}
            title={previewOpen ? "Atualizar previa lateral" : "Abrir previa lateral"}
            aria-label={previewOpen ? "Atualizar previa lateral" : "Abrir previa lateral"}
          >
            <PanelRightOpen size={16} />
          </button>
        )}
        </div>
        {!readOnly && (
        <div className="space-y-2">
          <div className={`grid gap-2 ${selectedVariant.fileType === "epub" ? "grid-cols-2" : "grid-cols-3"}`}>
            <button
              onClick={() => onConvert?.(selectedVariant)}
              className="flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-sm bg-zinc-800 px-2 text-xs text-zinc-300 transition-colors hover:bg-zinc-700"
              title="Converter"
            >
              <FileType size={13} />
              <span className="truncate">Converter</span>
            </button>
            {selectedVariant.fileType === "epub" && (
            <button
              onClick={handleExtractVocabulary}
              disabled={isExtractingVocabulary}
              className="flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-sm bg-zinc-800 px-2 text-xs text-zinc-300 transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
              title={vocabularyStats?.hasIndex ? "Atualizar Vocabulário" : "Extrair Vocabulário"}
            >
              {isExtractingVocabulary ? (
                <RefreshCw size={13} className="animate-spin" />
              ) : (
                <Sparkles size={13} />
              )}
              <span className="truncate">Vocabulário</span>
            </button>
            )}
          <button
            onClick={handleRegenerateThumbnail}
            className="flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-sm bg-zinc-800 px-2 text-xs text-zinc-300 transition-colors hover:bg-zinc-700"
            title="Regenerar thumbnail"
          >
            <RefreshCw size={13} />
            <span className="truncate">Thumbnail</span>
          </button>
          <button
            onClick={handleShowInFolder}
            className="flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-sm bg-zinc-800 px-2 text-xs text-zinc-300 transition-colors hover:bg-zinc-700"
            title="Abrir pasta"
          >
            <FolderOpen size={13} />
            <span className="truncate">Pasta</span>
          </button>
          </div>

          {vocabularyStats?.hasIndex && (
            <div className="flex items-center justify-between gap-2 rounded-sm border border-zinc-800/70 px-2 py-1.5 text-xs text-zinc-500">
              <span>Palavras únicas</span>
              <span className="text-zinc-300">
                {vocabularyStats.uniqueWords.toLocaleString()}
                <span className="text-zinc-600"> / </span>
                {vocabularyStats.totalWords.toLocaleString()}
              </span>
            </div>
          )}
        </div>
        )}

        {!readOnly && (
        <>
        <div className="pt-1">
        {hasFormatVariants && onDissolve && ((book.syntheticFolderType === "merged" && book.syntheticFolderPath) || book.bookId) && (
          <button
            onClick={handleDissolve}
            disabled={showDissolveDialog}
            className="mb-2 flex w-full items-center justify-center gap-1.5 rounded-sm bg-amber-500/10 py-2 text-xs text-amber-300 transition-colors hover:bg-amber-500/20 disabled:opacity-50"
          >
            <Unlink size={12} />
            Desmesclar e manter arquivos
          </button>
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
                Tem certeza que deseja remover a variante "{selectedVariant.title}" da biblioteca?
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
        {showDissolveDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="mx-4 w-full max-w-md rounded-sm border border-zinc-800 bg-zinc-900 p-6">
              <h3 className="mb-2 text-base font-medium">Desmesclar livro</h3>
              <p className="mb-4 text-sm text-zinc-400">
                Os {formatVariants.length} arquivos serão movidos para a pasta pai e continuarão na biblioteca como livros independentes.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDissolveDialog(false)}
                  className="rounded-sm bg-zinc-800 px-4 py-2 text-sm hover:bg-zinc-700"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDissolve}
                  className="rounded-sm bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-400"
                >
                  Desmesclar
                </button>
              </div>
            </div>
          </div>
        )}
        </div>

        <SetThumbnailDialog
          isOpen={thumbnailDialog.open}
          imagePath={thumbnailDialog.imagePath}
          onSetThumbnail={handleSetThumbnail}
          onClose={() => setThumbnailDialog({ open: false, imagePath: "" })}
        />
        <BookMetadataSearchDialog
          isOpen={showMetadataSearchDialog}
          book={selectedVariant}
          thumbnail={thumbnail}
          onClose={() => setShowMetadataSearchDialog(false)}
          onSaved={(fileHash) => {
            const nextHash = fileHash || selectedVariant.fileHash;
            setSelectedVariantHash(nextHash);
            void onRefresh(nextHash);
          }}
        />
        </>
        )}
      </div>
      </div>

    </div>
  );
}
