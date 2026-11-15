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
  Shuffle,
  Languages,
} from "lucide-react";
import {
  formatDate as formatLocalizedDate,
  i18next as i18n,
  useTranslation,
} from "../../../i18n";
import { BookWithThumbnail, ReadingStatus } from "../../../types/LibraryTypes";
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

const clampRating = (value: unknown): number =>
  Math.max(0, Math.min(10, Number(value) || 0));

/** Ratings are stored as 0 when unscored, which the input must show as empty. */
const formatRatingInput = (value: unknown): string => {
  const rating = clampRating(value);
  return rating === 0 ? "" : String(rating);
};

const parseRatingInput = (value: string): number | null => {
  if (value.trim() === "") return null;
  const parsed = Number.parseFloat(value.replace(",", "."));
  return Number.isFinite(parsed) ? clampRating(parsed) : null;
};
import toast from "react-hot-toast";
import SetThumbnailDialog from "../../../components/SetThumbnailDialog";
import BookMetadataSearchDialog from "./BookMetadataSearchDialog";
import AnimatedModal from "../../../components/ui/AnimatedModal";
import Select from "../../../components/ui/Select";
import { getEffectiveReadingStatus, getGroupRating, getGroupReadingStatus, isMergedGroup, LIBRARY_STATUS_SELECT_OPTIONS } from "../../../lib/readingStatus";

interface BookDetailPanelProps {
  book: BookWithThumbnail;
  onClose: () => void;
  onOpenReader: (book?: BookWithThumbnail) => void;
  onOpenPreview?: (book?: BookWithThumbnail) => void;
  /** Opens the book in the language-learning reader (.lyceum). */
  onOpenLearning?: (book?: BookWithThumbnail) => void;
  onConvert?: (book: BookWithThumbnail) => void;
  onDelete?: (deletedFileHash: string) => void | Promise<void>;
  onDissolve?: (book: BookWithThumbnail) => void | Promise<void>;
  onRemoveVariant?: (book: BookWithThumbnail) => Promise<boolean>;
  removeFromGroup?: boolean;
  onRefresh: (preferredFileHash?: string) => void | Promise<void>;
  readOnly?: boolean;
  previewOpen?: boolean;
}

type EditMode = "title" | "author" | null;
function DetailSkeleton() {
  return (
    <div className="animate-pulse space-y-4 p-4">
      <div className="grid grid-cols-[minmax(118px,160px)_minmax(0,1fr)] gap-4">
        <div className="aspect-[3/4] rounded-md bg-surface-muted" />
        <div className="space-y-3">
          <div className="h-4 w-20 rounded-sm bg-surface-muted" />
          <div className="h-3 w-28 rounded-sm bg-surface-muted" />
          <div className="h-3 w-24 rounded-sm bg-surface-muted" />
          <div className="h-3 w-32 rounded-sm bg-surface-muted" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-4 w-12 rounded-sm bg-surface-muted" />
        <div className="h-6 w-48 rounded-sm bg-surface-muted" />
      </div>
      <div className="space-y-2">
        <div className="h-4 w-12 rounded-sm bg-surface-muted" />
        <div className="h-5 w-36 rounded-sm bg-surface-muted" />
      </div>
      <div className="h-10 w-full rounded-sm bg-surface-muted" />
      <div className="grid grid-cols-3 gap-2">
        <div className="h-10 rounded-sm bg-surface-muted" />
        <div className="h-10 rounded-sm bg-surface-muted" />
        <div className="h-10 rounded-sm bg-surface-muted" />
      </div>
    </div>
  );
}

export default function BookDetailPanel({
  book,
  onClose,
  onOpenReader,
  onOpenPreview,
  onOpenLearning,
  onConvert,
  onDelete,
  onDissolve,
  onRemoveVariant,
  removeFromGroup = false,
  onRefresh,
  readOnly = false,
  previewOpen = false,
}: BookDetailPanelProps) {
  const { t } = useTranslation();
  const formatVariants = book.mergedBooks?.length ? book.mergedBooks : [book];
  const canRemoveFromGroup = Boolean(
    onRemoveVariant && (removeFromGroup || formatVariants.length > 1),
  );
  const initialVariantHash = formatVariants[0]?.fileHash || book.fileHash;
  const [selectedVariantHash, setSelectedVariantHash] = useState(initialVariantHash);
  const selectedVariant =
    formatVariants.find((variant) => variant.fileHash === selectedVariantHash) ||
    formatVariants[0] ||
    book;
  const variantSignature = formatVariants.map((variant) => variant.fileHash).join("\u001f");
  // A merged book (shared bookId or a merged folder) is shown as one book, so
  // status and score are written to every format variant to keep it consistent.
  // Collections group independent books, so they are excluded from these writes.
  const mergedGroupVariants =
    isMergedGroup(book) && formatVariants.length > 1 ? formatVariants : null;
  const writeTargets = mergedGroupVariants ?? [selectedVariant];
  const groupStatus = mergedGroupVariants
    ? getGroupReadingStatus(book)
    : getEffectiveReadingStatus(selectedVariant);
  const groupRating = mergedGroupVariants
    ? getGroupRating(book)
    : clampRating(selectedVariant.rating);
  const [thumbnail, setThumbnail] = useState(selectedVariant.thumbnail);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDissolveDialog, setShowDissolveDialog] = useState(false);
  const [deleteFileAlso, setDeleteFileAlso] = useState(false);

  useEffect(() => {
    let canceled = false;
    setThumbnail(selectedVariant.thumbnail);
    setStatus(groupStatus);
    const nextRating = groupRating;
    setRatingInput(formatRatingInput(nextRating));
    savedRatingRef.current = nextRating;

    if (!selectedVariant.thumbnail && selectedVariant.thumbnailPath) {
      window.api.getThumbnail(selectedVariant.thumbnailPath).then((value: string | null) => {
        if (!canceled) {
          setThumbnail(value || undefined);
        }
      });
    }

    return () => { canceled = true; };
  }, [selectedVariant.fileHash, selectedVariant.thumbnail, selectedVariant.thumbnailPath, variantSignature, groupStatus, groupRating]);
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
  const [status, setStatus] = useState<ReadingStatus>(groupStatus);
  // Score input is string-backed so an unscored book shows an empty field
  // instead of a stray "0".
  const [ratingInput, setRatingInput] = useState<string>(formatRatingInput(groupRating));
  const savedRatingRef = useRef<number>(groupRating);

  const handlePersistRating = async () => {
    const parsed = parseRatingInput(ratingInput);
    const value = Number((parsed ?? 0).toFixed(1));
    if (value === savedRatingRef.current) return;
    savedRatingRef.current = value;
    setRatingInput(formatRatingInput(value));
    try {
      for (const target of writeTargets) {
        await window.api.updateRating(target.fileHash, value);
      }
      await onRefresh(selectedVariant.fileHash);
    } catch {
      toast.error(t("library:detail.updateRatingFailed"));
    }
  };
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
      toast.error(t("library:detail.toasts.vocabularyEpubOnly"));
      return;
    }
    setIsExtractingVocabulary(true);
    try {
      const result = await (window.api as any).extractVocabulary(selectedVariant.fileHash);
      if (result.success) {
        toast.success(
          t("library:detail.toasts.vocabularyExtracted", {
            count: result.uniqueWords ?? 0,
          }),
        );
        setVocabularyStats({
          hasIndex: true,
          totalWords: result.totalWords || 0,
          uniqueWords: result.uniqueWords || 0,
        });
        await onRefresh?.(selectedVariant.fileHash);
      } else {
        toast.error(result.error || t("library:detail.toasts.vocabularyFailed"));
      }
    } catch (error) {
      toast.error(t("library:detail.toasts.vocabularyFailed"));
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
      toast.error(t("library:detail.toasts.emptyTitle"));
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
        const metadataHash = result.fileHash || selectedVariant.fileHash;
        if (editMode === "title") {
          const renameResult = await window.api.renameBook(metadataHash, newTitle, newAuthor);
          if (!renameResult.success) {
            toast.error(
              renameResult.error || t("library:detail.toasts.renameFailed"),
            );
            return;
          }
        }
        if (result.writtenToFile === false) {
          toast(
            t("library:metadata.toasts.savedLibraryOnly", {
              reason: result.warnings?.[0] || t("library:metadata.toasts.unknownReason"),
            }),
            { icon: "⚠️", duration: 7000 },
          );
        } else {
          toast.success(t("library:detail.toasts.metadataWritten"));
        }
        setEditMode(null);
        setEditValue("");
        const nextHash = metadataHash;
        setSelectedVariantHash(nextHash);
        await onRefresh(nextHash);
      } else {
        toast.error(t("library:detail.toasts.updateError", { message: result.error }));
      }
    } catch (error) {
      toast.error(t("library:detail.toasts.updateFailed"));
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
    if (canRemoveFromGroup && onRemoveVariant && !deleteFileAlso) {
      const removed = await onRemoveVariant(selectedVariant);
      if (removed) {
        toast.success(t("library:detail.toasts.removedFromGroup"));
        setShowDeleteDialog(false);
        await onDelete?.(deletedHash);
      }
      return;
    }
    const result = await window.api.deleteBook(deletedHash, deleteFileAlso);
    if (result.success) {
      toast.success(
        deleteFileAlso
          ? t("library:detail.toasts.deletedFromDisk")
          : t("library:detail.toasts.removedFromLibrary"),
      );
      setShowDeleteDialog(false);
      setDeleteFileAlso(false);
      await onDelete?.(deletedHash);
    } else {
      toast.error(t("library:detail.toasts.removeError", { message: result.error }));
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
      toast.success(t("library:detail.toasts.thumbnailRegenerated"));
      if (result.thumbnailPath) {
        const refreshedThumbnail = await window.api.getThumbnail(result.thumbnailPath);
        setThumbnail(refreshedThumbnail || undefined);
      }
      setThumbnailKey(prev => prev + 1);
      await onRefresh(selectedVariant.fileHash);
    } else {
      toast.error(t("library:detail.toasts.thumbnailRegenerateFailed"));
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
      toast.error(t("library:detail.toasts.unsupportedImageFormat"));
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
      toast.success(
        mode === "replace"
          ? t("library:detail.toasts.thumbnailReplaced")
          : t("library:detail.toasts.pageAdded"),
      );
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
      toast.error(result.error || t("library:detail.toasts.setThumbnailFailed"));
    }
  };

  const handleShowInFolder = () => {
    window.api.showBookInFolder(selectedVariant.filePath);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return t("common:fields.unknown");
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return t("common:fields.unknown");
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return dateStr;
    return formatLocalizedDate(date, i18n.resolvedLanguage);
  };

  const getPathParts = (): string[] => {
    if (!bookPath) return [];
    return bookPath.split(/[/\\]/).filter(Boolean);
  };

  const isLyceumPackage = selectedVariant.fileType === "lyceum";
  const canOpenInReader = selectedVariant.fileType === "pdf" || selectedVariant.fileType === "epub" || isLyceumPackage;
  const canOpenForLearning = ["epub", "pdf", "txt", "html", "lyceum"].includes(String(selectedVariant.fileType));
  const hasFormatVariants = formatVariants.length > 1;

  return (
    <div className="flex h-full w-full min-w-0 flex-col bg-surface">
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-border bg-surface/50">
        <h2 className="text-base font-semibold text-foreground">
          {t("library:detail.title")}
        </h2>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-surface-muted rounded-sm transition-colors cursor-pointer"
        >
          <X size={18} className="text-foreground-muted" />
        </button>

      </div>

      {hasFormatVariants && (
        <div
          role="tablist"
          aria-label={t("library:detail.formats")}
          className={`flex flex-shrink-0 gap-2 overflow-x-auto border-b border-border bg-background/70 px-3 py-2 ${formatVariants.length <= 3 ? "justify-center" : "justify-start"}`}
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
                className={`min-w-16 whitespace-nowrap rounded border px-3 py-2 text-xs font-semibold transition-all ${
                  selectedVariant.fileHash === variant.fileHash
                    ? "border-primary/50 bg-primary-muted text-primary shadow-sm"
                    : "border-border bg-surface text-foreground-subtle hover:border-border-strong hover:bg-surface-muted hover:text-foreground"
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
            className={`relative aspect-[3/4] bg-surface-muted rounded-md overflow-hidden shadow-lg cursor-pointer transition-all group ${
              isDragging ? "ring-2 ring-focus-ring ring-offset-2 ring-offset-surface" : "hover:ring-2 hover:ring-border-strong"
            }`}
            onClick={handleThumbnailClick}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            title={
              readOnly
                ? selectedVariant.title
                : t("library:detail.selectOrDropImage")
            }
          >
            {thumbnail ? (
              <img
                key={thumbnailKey}
                src={thumbnail}
                alt={selectedVariant.title}
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-foreground-subtle">
                <FileText size={32} />
              </div>
            )}
            {selectedVariant.processingStatus === "processing" && (
              <div className="absolute inset-0 bg-backdrop flex items-center justify-center">
                <RefreshCw size={24} className="text-foreground animate-spin" />
              </div>
            )}
            {selectedVariant.processingStatus === "failed" && (
              <div className="absolute top-1.5 left-1.5 z-20" title={t("library:detail.corruptedOrUnsupported")}>
                <AlertTriangle size={18} className="text-warning drop-shadow-sm" />
              </div>
            )}
            {isDragging && (
              <div className="absolute inset-0 bg-primary-muted flex items-center justify-center">
                <div className="flex flex-col items-center gap-2 text-primary">
                  <Image size={32} />
                  <span className="text-sm font-medium">
                    {t("library:detail.dropToSetCover")}
                  </span>
                </div>
              </div>
            )}
            {!readOnly && !isDragging && (
              <div className="absolute inset-0 bg-backdrop opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <div className="flex flex-col items-center gap-2 text-foreground">
                  <Upload size={24} />
                  <span className="text-xs font-medium">
                    {t("library:detail.setCover")}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <FileText size={14} className="text-foreground-subtle flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-foreground-subtle">{t("library:detail.file")}</p>
                <p className="text-sm text-foreground">
                  {t("library:units.pagesAbbrev", { count: selectedVariant.numPages })}
                </p>
                <p className="text-xs text-foreground-subtle">{formatFileSize(selectedVariant.fileSize)}</p>
              </div>
            </div>

            {selectedVariant.processingStatus === "failed" && (
              <div className="flex items-start gap-2 rounded-sm bg-warning-muted border border-warning/20 px-3 py-2">
                <AlertTriangle size={14} className="text-warning flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-warning">
                    {t("library:detail.corrupted")}
                  </p>
                  <p className="text-[11px] text-warning">
                    {t("library:detail.corruptedHint")}
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-start gap-2">
              <Calendar size={14} className="text-foreground-subtle flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-foreground-subtle">Adicionado em</p>
                <p className="text-sm text-foreground">{formatDate(selectedVariant.createdAt)}</p>
              </div>
            </div>

            {bookPath && (
              <div className="flex items-start gap-2">
                <MapPin size={14} className="text-foreground-subtle flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-foreground-subtle">Localização</p>
                  <div className="flex items-center gap-1 flex-wrap">
                    {getPathParts().map((part, index) => (
                      <span key={index} className="flex items-center gap-1">
                        {index > 0 && <span className="text-foreground-subtle">/</span>}
                        <span className="text-sm text-foreground">{part}</span>
                      </span>
                    ))}
                  </div>
                  {selectedVariant.fileType && (
                    <div className="flex items-center gap-1 mt-1">
                      <FileType size={12} className="text-foreground-subtle" />
                      <span className="text-xs text-foreground-muted uppercase">{selectedVariant.fileType}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {selectedVariant.isbn && (
              <div className="flex items-start gap-2">
                <Hash size={14} className="text-foreground-subtle flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-foreground-subtle">ISBN</p>
                  <p className="text-sm text-foreground truncate">{selectedVariant.isbn}</p>
                </div>
              </div>
            )}

            {selectedVariant.publisher && (
              <div className="flex items-start gap-2">
                <Info size={14} className="text-foreground-subtle flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-foreground-subtle">Editora</p>
                  <p className="text-sm text-foreground truncate">{selectedVariant.publisher}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-xs text-foreground-subtle mb-1">Título</p>
            {editMode === "title" ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="flex-1 bg-surface-muted border border-border-strong rounded-sm px-2 py-1.5 text-sm text-foreground focus:outline-none focus:border-primary"
                  autoFocus
                />
                <button
                  onClick={handleSaveEdit}
                  disabled={isSaving}
                  aria-label={t("common:actions.save")}
                  className="p-1.5 bg-primary text-primary-foreground hover:bg-primary-hover rounded-sm transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Save size={14} className="text-foreground" />
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="p-1.5 bg-border-strong hover:bg-border-strong rounded-sm transition-colors cursor-pointer"
                >
                  <XCircle size={14} className="text-foreground" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-foreground leading-tight flex-1 line-clamp-2">
                  {getTitleWithoutExtension(selectedVariant.title, selectedVariant.fileType)}
                </h3>
                {!readOnly && (
                <button
                  onClick={handleStartEditTitle}
                  className="p-1 hover:bg-surface-muted rounded-sm transition-colors cursor-pointer flex-shrink-0"
                  title={t("library:detail.editTitle")}
                >
                  <Pencil size={14} className="text-foreground-subtle" />
                </button>
                )}
              </div>
            )}
          </div>

          <div>
            <p className="text-xs text-foreground-subtle mb-1">{t("common:fields.author")}</p>
            {editMode === "author" ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="flex-1 bg-surface-muted border border-border-strong rounded-sm px-2 py-1.5 text-sm text-foreground focus:outline-none focus:border-primary"
                  placeholder={t("library:detail.authorPlaceholder")}
                  autoFocus
                />
                <button
                  onClick={handleSaveEdit}
                  disabled={isSaving}
                  aria-label={t("common:actions.save")}
                  className="p-1.5 bg-primary text-primary-foreground hover:bg-primary-hover rounded-sm transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Save size={14} className="text-foreground" />
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="p-1.5 bg-border-strong hover:bg-border-strong rounded-sm transition-colors cursor-pointer"
                >
                  <XCircle size={14} className="text-foreground" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-sm text-foreground flex-1 truncate">
                  {selectedVariant.author || t("common:fields.unknown")}
                </p>
                {!readOnly && (
                <button
                  onClick={handleStartEditAuthor}
                  className="p-1 hover:bg-surface-muted rounded-sm transition-colors cursor-pointer flex-shrink-0"
                  title={t("library:detail.editAuthor")}
                >
                  <Pencil size={14} className="text-foreground-subtle" />
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
            className="flex w-full items-center justify-center gap-2 rounded-sm bg-surface-muted px-3 py-2 text-sm text-foreground transition-colors hover:bg-border-strong cursor-pointer"
          >
            <Search size={15} />
            {t("library:detail.searchMetadata")}
          </button>
        )}

        {/* <div className="space-y-2">
          <p className="text-xs text-foreground-subtle">
            {formatPageCount(selectedVariant.numPages, selectedVariant.fileType)}{" "}
            <span className="text-foreground">|</span>{" "}
            {getFileTypeLabel(selectedVariant.fileType, selectedVariant.filePath)}{" "}
            <span className="text-foreground">|</span>{" "}
            {getBookFolderLabel(selectedVariant.filePath)}
          </p>
        </div> */}

        <div className="space-y-1.5">
          <label className="text-xs text-foreground-subtle">{t("library:sections.readingStatus")}</label>
          <Select
            value={status}
            onChange={async (value) => {
              const newStatus = value as ReadingStatus;
              setStatus(newStatus);
              try {
                // Merged variants are one book: keep every format in the same
                // status so the group never shows a contradictory state.
                let failed = false;
                for (const variant of writeTargets) {
                  const result = await window.api.updateReadingStatus(variant.fileHash, newStatus);
                  if (result && result.success === false) failed = true;
                }
                await onRefresh(selectedVariant.fileHash);
                if (failed) toast.error(t("library:detail.updateStatusFailed"));
              } catch (err) {
                toast.error(t("library:detail.updateStatusFailed"));
              }
            }}
            items={LIBRARY_STATUS_SELECT_OPTIONS.map((option) => ({
              value: option.value,
              label: t(option.labelKey),
            }))}
          />
          {status === "read" && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-foreground-subtle whitespace-nowrap">{t("library:detail.score")}</label>
              <input
                type="number"
                min="0"
                max="10"
                step="0.1"
                value={ratingInput}
                placeholder="0"
                onChange={(e) => setRatingInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.currentTarget.blur();
                  }
                }}
                onBlur={handlePersistRating}
                className="h-8 flex-1 rounded-sm border border-border bg-surface px-2 text-xs text-foreground focus:outline-none focus:border-primary"
              />
              <span className="text-xs text-foreground-subtle">/10</span>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => (isLyceumPackage && onOpenLearning ? onOpenLearning(selectedVariant) : onOpenReader(selectedVariant))}
            disabled={!canOpenInReader}
            className="flex min-w-0 flex-1 cursor-pointer items-center justify-center gap-2 rounded-sm bg-primary px-2 py-2.5 text-sm font-bold transition-colors  hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-primary-foreground"
          >
            <BookOpen size={16} strokeWidth={3} />
            {canOpenInReader
              ? selectedVariant.currentPage > 1
                ? t("library:detail.continueReading")
                : t("library:detail.startReading")
              : t("library:detail.unsupportedFormat")}
          </button>

        {onOpenLearning && canOpenForLearning && !isLyceumPackage && (
          <button
            type="button"
            onClick={() => onOpenLearning(selectedVariant)}
            className="bg-surface-muted text-foreground hover:bg-border-strong hover:text-primary flex h-10 w-11 flex-shrink-0 cursor-pointer items-center justify-center rounded-sm transition-colors"
            title={t("library:detail.openForLearning")}
            aria-label={t("library:detail.openForLearning")}
          >
            <Languages size={16} />
          </button>
        )}
        {onOpenPreview && !isLyceumPackage && (
          <button
            type="button"
            onClick={() => onOpenPreview(selectedVariant)}
            disabled={!canOpenInReader}
            className={`bg-surface-muted text-foreground hover:bg-border-strong hover:text-primary flex h-10 w-11 flex-shrink-0 cursor-pointer items-center justify-center rounded-sm transition-colors disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-muted disabled:text-foreground-subtle`}
            title={
              previewOpen
                ? t("library:detail.closePreview")
                : t("library:detail.openPreview")
            }
            aria-label={
              previewOpen
                ? t("library:detail.closePreview")
                : t("library:detail.openPreview")
            }
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
              className="flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-sm bg-surface-muted px-2 text-xs text-foreground transition-colors hover:bg-border-strong cursor-pointer"
              title={t("library:detail.convert")}
            >
              <Shuffle size={14} />
              <span className="truncate">{t("library:detail.convert")}</span>
            </button>
            {selectedVariant.fileType === "epub" && (
            <button
              onClick={handleExtractVocabulary}
              disabled={isExtractingVocabulary}
              className="cursor-pointer flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-sm bg-surface-muted px-2 text-xs text-foreground transition-colors hover:bg-border-strong disabled:cursor-not-allowed disabled:opacity-50"
              title={
                vocabularyStats?.hasIndex
                  ? t("library:detail.updateVocabulary")
                  : t("library:detail.extractVocabulary")
              }
            >
              {isExtractingVocabulary ? (
                <RefreshCw size={13} className="animate-spin" />
              ) : (
                <Sparkles size={13} />
              )}
              <span className="truncate">{t("library:detail.vocabulary")}</span>
            </button>
            )}
          <button
            onClick={handleRegenerateThumbnail}
            className="cursor-pointer flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-sm bg-surface-muted px-2 text-xs text-foreground transition-colors hover:bg-border-strong"
            title={t("library:detail.regenerateThumbnail")}
          >
            <RefreshCw size={13} />
            <span className="truncate">
              Thumbnail
            </span>
          </button>
          <button
            onClick={handleShowInFolder}
            className="cursor-pointer flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-sm bg-surface-muted px-2 text-xs text-foreground transition-colors hover:bg-border-strong"
            title={t("library:detail.openFolder")}
          >
            <FolderOpen size={13} />
            <span className="truncate">{t("library:detail.folder")}</span>
          </button>
          </div>

          {vocabularyStats?.hasIndex && (
            <div className="flex items-center justify-between gap-2 rounded-sm border border-border/70 px-2 py-1.5 text-xs text-foreground-subtle">
              <span>{t("library:detail.uniqueWords")}</span>
              <span className="text-foreground">
                {vocabularyStats.uniqueWords.toLocaleString()}
                <span className="text-foreground-subtle"> / </span>
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
          className="mb-2 flex w-full items-center justify-center gap-1.5 rounded-sm bg-destructive-muted py-2 text-xs text-destructive transition-colors hover:bg-destructive-muted disabled:opacity-50"
          >
            <Unlink size={12} />
            {t("library:detail.dissolveKeepFiles")}
          </button>
        )}
        <button
          onClick={handleDelete}
          disabled={showDeleteDialog}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-sm text-xs transition-colors cursor-pointer bg-surface-muted hover:bg-destructive-muted text-foreground-muted hover:text-destructive disabled:opacity-50"
        >
          <Trash2 size={12} />
          {t('common:actions.remove')}
        </button>

        <AnimatedModal
          open={showDeleteDialog}
          ariaLabel={t("library:detail.confirmRemoval")}
          onBackdropClick={cancelDelete}
          backdropClassName="px-4"
          className="w-full max-w-md rounded-sm border border-border bg-surface p-6"
        >
              <h3 className="text-base font-medium mb-2">
                {t("library:detail.removeTitle")}
              </h3>
              <p className="text-sm text-foreground-muted mb-4">
                {canRemoveFromGroup
                  ? t("library:detail.removeFromGroupConfirm", {
                      title: selectedVariant.title,
                    })
                  : t("library:detail.removeVariantConfirm", {
                      title: selectedVariant.title,
                    })}
              </p>
              {!canRemoveFromGroup && <label className="flex items-center gap-2 mb-4 text-sm text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={deleteFileAlso}
                  onChange={(e) => setDeleteFileAlso(e.target.checked)}
                  className="w-4 h-4 accent-primary cursor-pointer"
                />
                {t("library:detail.deleteFileAlso")}
              </label>}
              <div className="flex gap-3 justify-end">
                <button
                  onClick={cancelDelete}
                  className="cursor-pointer px-4 py-2 rounded-sm bg-surface-muted hover:bg-border-strong text-sm transition-colors"
                >
                  {t("common:actions.cancel")}
                </button>
                <button
                  onClick={handleDelete}
                  className="cursor-pointer px-4 py-2 rounded-sm bg-destructive hover:bg-destructive-hover text-destructive-foreground text-sm font-medium transition-colors"
                >
                  {canRemoveFromGroup
                    ? t("common:actions.remove")
                    : t("common:actions.delete")}
                </button>
              </div>
        </AnimatedModal>
        <AnimatedModal
          open={showDissolveDialog}
          ariaLabel={t("library:detail.dissolveAria")}
          onBackdropClick={() => setShowDissolveDialog(false)}
          backdropClassName="px-4"
          className="w-full max-w-md rounded-sm border border-border bg-surface p-6"
        >
              <h3 className="mb-2 text-base font-medium">
                {t("library:detail.dissolveTitle")}
              </h3>
              <p className="mb-4 text-sm text-foreground-muted">
                {t("library:detail.dissolveBody", { count: formatVariants.length })}
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDissolveDialog(false)}
                  className="rounded-sm bg-surface-muted px-4 py-2 text-sm hover:bg-border-strong"
                >
                  {t("common:actions.cancel")}
                </button>
                <button
                  onClick={handleDissolve}
                  className="rounded-sm bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive-hover"
                >
                  {t("library:detail.dissolve")}
                </button>
              </div>
        </AnimatedModal>
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
