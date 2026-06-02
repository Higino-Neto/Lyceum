import { useState, useEffect, useRef } from "react";
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
  Search,
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
  onOpenEmbed: (book?: BookWithThumbnail) => void;
  onDelete?: () => void;
  onRefresh: () => void;
  readOnly?: boolean;
}

type EditMode = "title" | "author" | null;
type ConversionFormat = "pdf" | "epub" | "docx" | "html" | "cbz" | "mobi" | "azw" | "azw3" | "azw4" | "kfx" | "prc" | "txt" | "lyceum";

interface ConversionTarget {
  format: ConversionFormat;
  supported: boolean;
  reason?: string;
}

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
  onOpenEmbed,
  onDelete,
  onRefresh,
  readOnly = false,
}: BookDetailPanelProps) {
  const [thumbnail, setThumbnail] = useState(book.thumbnail);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteFileAlso, setDeleteFileAlso] = useState(false);

  useEffect(() => {
    let canceled = false;
    setThumbnail(book.thumbnail);

    if (!book.thumbnail && book.thumbnailPath) {
      window.api.getThumbnail(book.thumbnailPath).then((value: string | null) => {
        if (!canceled) {
          setThumbnail(value || undefined);
        }
      });
    }

    return () => { canceled = true; };
  }, [book.thumbnail, book.thumbnailPath]);
  const [bookPath, setBookPath] = useState<string>("");
  const [editMode, setEditMode] = useState<EditMode>(null);
  const [editValue, setEditValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showMetadataSearchDialog, setShowMetadataSearchDialog] = useState(false);
  const [selectedVariantHash, setSelectedVariantHash] = useState(book.fileHash);
  const [isDragging, setIsDragging] = useState(false);
  const [thumbnailDialog, setThumbnailDialog] = useState<{
    open: boolean;
    imagePath: string;
  }>({ open: false, imagePath: "" });
  const [thumbnailKey, setThumbnailKey] = useState(0);
  const [vocabularyStats, setVocabularyStats] = useState<{ hasIndex: boolean; totalWords: number; uniqueWords: number } | null>(null);
  const [isExtractingVocabulary, setIsExtractingVocabulary] = useState(false);
  const [isConvertingToEpub, setIsConvertingToEpub] = useState(false);
  const [isConvertingToPdf, setIsConvertingToPdf] = useState(false);
  const [showConversionDialog, setShowConversionDialog] = useState(false);
  const [conversionTargets, setConversionTargets] = useState<ConversionTarget[]>([]);
  const [selectedConversionTarget, setSelectedConversionTarget] = useState<ConversionFormat | null>(null);
  const isConverting = isConvertingToEpub || isConvertingToPdf;

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

  const formatVariants = book.mergedBooks?.length ? book.mergedBooks : [book];
  const selectedVariant =
    formatVariants.find((variant) => variant.fileHash === selectedVariantHash) ||
    formatVariants[0] ||
    book;

  useEffect(() => {
    setSelectedVariantHash(book.fileHash);
  }, [book.fileHash]);

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

  const handleConvertToEpub = async () => {
    if (book.fileType === "epub") {
      toast.error("Este livro jÃ¡ Ã© um EPUB");
      return;
    }

    setIsConvertingToEpub(true);
    const loadingToast = toast.loading("Convertendo PDF para EPUB...");

    try {
      const result = await window.api.convertPdfToEpub(book.fileHash);

      if (result.success) {
        const warnings = result.report?.warnings?.length || 0;
        toast.success(
          warnings
            ? `EPUB criado com ${warnings} aviso(s).`
            : "EPUB criado na biblioteca!",
          { id: loadingToast },
        );
        setShowConversionDialog(false);
        onRefresh();
      } else {
        toast.error(result.error || "Erro ao converter PDF", { id: loadingToast });
      }
    } catch (error) {
      toast.error("Erro ao converter PDF", { id: loadingToast });
    } finally {
      setIsConvertingToEpub(false);
    }
  };

  const handleConvertToPdf = async () => {
    if (book.fileType !== "epub") {
      toast.error("Este livro não é um EPUB");
      return;
    }

    setIsConvertingToPdf(true);
    const loadingToast = toast.loading("Convertendo EPUB para PDF...");

    try {
      const result = await window.api.convertEpubToPdf(book.fileHash);

      if (result.success) {
        const warnings = result.report?.warnings?.length || 0;
        toast.success(
          warnings
            ? `PDF criado com ${warnings} aviso(s).`
            : "PDF criado na biblioteca!",
          { id: loadingToast },
        );
        setShowConversionDialog(false);
        onRefresh();
      } else {
        toast.error(result.error || "Erro ao converter EPUB", { id: loadingToast });
      }
    } catch (error) {
      toast.error("Erro ao converter EPUB", { id: loadingToast });
    } finally {
      setIsConvertingToPdf(false);
    }
  };

  useEffect(() => {
    if (!showConversionDialog) return;

    let canceled = false;
    setConversionTargets([]);
    setSelectedConversionTarget(null);

    window.api.listConversionTargets(book.fileHash).then((result) => {
      if (canceled) return;
      if (result.success) {
        const targets = result.targets.filter((target) => target.supported);
        setConversionTargets(targets);
        setSelectedConversionTarget(targets[0]?.format || null);
      } else {
        toast.error(result.error || "Erro ao carregar conversoes disponiveis");
      }
    });

    return () => {
      canceled = true;
    };
  }, [book.fileHash, showConversionDialog]);

  const handleConvertSelected = async () => {
    if (!selectedConversionTarget) {
      toast.error("Selecione um formato de saida");
      return;
    }

    setIsConvertingToEpub(selectedConversionTarget === "epub");
    setIsConvertingToPdf(selectedConversionTarget !== "epub");
    const targetLabel = selectedConversionTarget.toUpperCase();
    const loadingToast = toast.loading(`Convertendo para ${targetLabel}...`);

    try {
      const result = await window.api.convertBook(book.fileHash, selectedConversionTarget);

      if (result.success) {
        const warnings = result.report?.warnings?.length || 0;
        toast.success(
          warnings
            ? `${targetLabel} criado com ${warnings} aviso(s).`
            : `${targetLabel} criado na biblioteca!`,
          { id: loadingToast },
        );
        setShowConversionDialog(false);
        onRefresh();
      } else {
        toast.error(result.error || `Erro ao converter para ${targetLabel}`, { id: loadingToast });
      }
    } catch {
      toast.error(`Erro ao converter para ${targetLabel}`, { id: loadingToast });
    } finally {
      setIsConvertingToEpub(false);
      setIsConvertingToPdf(false);
    }
  };

  const handleStartEditTitle = () => {
    if (readOnly) return;
    setEditValue(getTitleWithoutExtension(book.title, book.fileType));
    setEditMode("title");
  };

  const handleStartEditAuthor = () => {
    if (readOnly) return;
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
      
      const result = await window.api.updateMetadata(book.fileHash, {
        title: newTitle,
        author: newAuthor,
      });
      if (result.success) {
        toast.success("Metadados gravados no arquivo.");
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
    if (readOnly) return;
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
            title={readOnly ? book.title : "Clique para selecionar ou arraste uma imagem"}
          >
            {thumbnail ? (
              <img
                key={thumbnailKey}
                src={thumbnail}
                alt={book.title}
                className="h-full w-full object-contain"
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
                  {book.author || "Desconhecido"}
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
            {formatPageCount(book.numPages, book.fileType)}{" "}
            <span className="text-zinc-700">|</span>{" "}
            {getFileTypeLabel(book.fileType, book.filePath)}{" "}
            <span className="text-zinc-700">|</span>{" "}
            {getBookFolderLabel(book.filePath)}
          </p>
        </div>

        {hasFormatVariants && (
          <div className="space-y-2 rounded-sm border border-zinc-800 bg-zinc-950/50 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Formato para abrir
            </p>
            <div className="grid gap-2">
              {formatVariants.map((variant) => (
                <button
                  key={variant.fileHash}
                  type="button"
                  onClick={() => setSelectedVariantHash(variant.fileHash)}
                  className={`flex min-w-0 items-center justify-between gap-3 rounded-sm border px-3 py-2 text-left transition-colors ${
                    selectedVariantHash === variant.fileHash
                      ? "border-green-500/70 bg-green-500/10 text-green-100"
                      : "border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700"
                  }`}
                >
                  <span className="min-w-0 truncate text-xs">
                    {variant.fileName || variant.filePath.split(/[/\\]/).pop() || variant.title}
                  </span>
                  <span className="flex-shrink-0 rounded-sm bg-zinc-800 px-1.5 py-0.5 text-[11px] uppercase text-zinc-300">
                    {getFileTypeLabel(variant.fileType, variant.filePath)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={() => onOpenEmbed(selectedVariant)}
          disabled={!canOpenInReader}
          className="w-full flex items-center justify-center gap-2 bg-green-500 text-zinc-900 hover:bg-green-400 py-2.5 rounded-sm text-sm font-medium transition-colors cursor-pointer disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
        >
          <BookOpen size={16} />
          {/* <span className="rounded-full bg-zinc-900/10 px-2 py-0.5 text-[11px] uppercase tracking-wide">
            EmbedPDF
          </span> */}
          {canOpenInReader
            ? book.currentPage > 1
              ? "Continuar Leitura"
              : "Começar a Ler"
            : "Formato não suportado no leitor"}
        </button>
        {!readOnly && (
        <div className="space-y-2">
          <div className={`grid gap-2 ${book.fileType === "epub" ? "grid-cols-2" : "grid-cols-3"}`}>
            <button
              onClick={() => setShowConversionDialog(true)}
              disabled={isConverting}
              className="flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-sm bg-zinc-800 px-2 text-xs text-zinc-300 transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
              title="Converter"
            >
              {isConverting ? (
                <RefreshCw size={13} className="animate-spin" />
              ) : (
                <FileType size={13} />
              )}
              <span className="truncate">Converter</span>
            </button>
            {book.fileType === "epub" && (
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
        </div>

        <SetThumbnailDialog
          isOpen={thumbnailDialog.open}
          imagePath={thumbnailDialog.imagePath}
          onSetThumbnail={handleSetThumbnail}
          onClose={() => setThumbnailDialog({ open: false, imagePath: "" })}
        />
        <BookMetadataSearchDialog
          isOpen={showMetadataSearchDialog}
          book={book}
          thumbnail={thumbnail}
          onClose={() => setShowMetadataSearchDialog(false)}
          onSaved={onRefresh}
        />
        </>
        )}
      </div>
      </div>

      {showConversionDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-sm border border-zinc-800 bg-zinc-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-700 p-4">
              <div className="flex items-center gap-2">
                <FileType size={20} className="text-green-400" />
                <h2 className="text-lg font-semibold text-zinc-100">Converter</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowConversionDialog(false)}
                disabled={isConverting}
                className="cursor-pointer rounded-sm p-2 transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                title="Fechar"
              >
                <X size={20} className="text-zinc-400" />
              </button>
            </div>

            <div className="space-y-3 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Formato de saída
              </p>
              <div className="space-y-2">
                {conversionTargets.length === 0 ? (
                  <div className="rounded-sm border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-500">
                    Nenhuma conversao disponivel para este formato.
                  </div>
                ) : (
                  conversionTargets.map((target) => (
                    <button
                      key={target.format}
                      type="button"
                      onClick={() => setSelectedConversionTarget(target.format)}
                      className={`flex w-full items-start gap-3 rounded-sm border p-3 text-left transition-colors ${
                        selectedConversionTarget === target.format
                          ? "border-green-500/70 bg-green-500/10"
                          : "border-zinc-800 bg-zinc-950 hover:border-zinc-700"
                      }`}
                    >
                      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-sm bg-zinc-800 text-green-400">
                        <FileType size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-zinc-100">
                          {target.format.toUpperCase()}
                        </p>
                        <p className="truncate text-xs text-zinc-500">
                          {book.fileType?.toUpperCase() || "LIVRO"} para {target.format.toUpperCase()} - {getTitleWithoutExtension(book.title, book.fileType)}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-zinc-700 p-4">
              <button
                type="button"
                onClick={() => setShowConversionDialog(false)}
                disabled={isConverting}
                className="cursor-pointer rounded-sm px-4 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConvertSelected}
                disabled={isConverting || !selectedConversionTarget}
                className="flex cursor-pointer items-center gap-2 rounded-sm bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isConverting && <RefreshCw size={14} className="animate-spin" />}
                Converter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
