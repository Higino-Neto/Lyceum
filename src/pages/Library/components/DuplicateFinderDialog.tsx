import { Check, Copy, EyeOff, FileText, GitMerge, RefreshCw, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import AnimatedModal from "../../../components/ui/AnimatedModal";
import {
  findDuplicateGroups,
  type DuplicateGroup,
  type DuplicateReason,
} from "../../../features/library/model/duplicates";
import { useLocalStorage } from "../../../hooks/useLocalStorage";
import { useTranslation, type TranslationKey } from "../../../i18n";
import type { BookWithThumbnail, DocumentRecord } from "../../../types/LibraryTypes";
import {
  formatFileSize,
  formatPageCount,
  getBookFolderLabel,
  getFileTypeLabel,
  getTitleWithoutExtension,
} from "../utils";
import { useLazyThumbnail } from "./BookGrid/useLazyThumbnail";

interface DuplicateFinderDialogProps {
  open: boolean;
  onClose: () => void;
  /** Called after a merge or removal so the library can refresh. */
  onLibraryChanged: () => void | Promise<void>;
}

const REASON_LABEL_KEYS: Record<DuplicateReason, TranslationKey> = {
  isbn: "library:duplicates.reasons.isbn",
  sameTitle: "library:duplicates.reasons.sameTitle",
  similarTitle: "library:duplicates.reasons.similarTitle",
};

type BookGroup = DuplicateGroup<DocumentRecord>;

export default function DuplicateFinderDialog({ open, onClose, onLibraryChanged }: DuplicateFinderDialogProps) {
  const { t } = useTranslation();
  const [documents, setDocuments] = useState<DocumentRecord[] | null>(null);
  const [dismissedKeys, setDismissedKeys] = useLocalStorage<string[]>("library_duplicateDismissed", []);
  const [busyGroup, setBusyGroup] = useState<string | null>(null);

  const loadDocuments = useCallback(async () => {
    setDocuments(null);
    try {
      const all = (await window.api.getDocuments()) as DocumentRecord[];
      setDocuments(Array.isArray(all) ? all : []);
    } catch {
      setDocuments([]);
    }
  }, []);

  useEffect(() => {
    if (open) void loadDocuments();
  }, [loadDocuments, open]);

  const groups = useMemo(
    () => (documents ? findDuplicateGroups(documents, { dismissedKeys }) : []),
    [dismissedKeys, documents],
  );
  const bookCount = useMemo(() => groups.reduce((total, group) => total + group.books.length, 0), [groups]);

  const afterChange = useCallback(async () => {
    await onLibraryChanged();
    await loadDocuments();
  }, [loadDocuments, onLibraryChanged]);

  const handleMerge = useCallback(async (group: BookGroup, fileHashes: string[]) => {
    setBusyGroup(group.key);
    try {
      const result = await window.api.mergeBooks(fileHashes);
      if (result?.success) {
        toast.success(t("library:toasts.booksMerged"));
        await afterChange();
      } else {
        toast.error(result?.error || t("library:toasts.mergeBooksFailed"));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("library:toasts.mergeBooksFailed"));
    } finally {
      setBusyGroup(null);
    }
  }, [afterChange, t]);

  const handleRemove = useCallback(async (group: BookGroup, fileHashes: string[], deleteFiles: boolean) => {
    setBusyGroup(group.key);
    let removed = 0;
    let failed = 0;
    try {
      for (const fileHash of fileHashes) {
        const result = await window.api.deleteBook(fileHash, deleteFiles);
        if (result?.success) removed += 1;
        else failed += 1;
      }
      if (removed > 0) {
        toast.success(deleteFiles
          ? t("library:toasts.booksDeletedFromDisk", { count: removed })
          : t("library:toasts.booksRemovedFromLibrary", { count: removed }));
      }
      if (failed > 0) toast.error(t("library:toasts.itemsNotRemoved", { count: failed }));
      await afterChange();
    } finally {
      setBusyGroup(null);
    }
  }, [afterChange, t]);

  const handleDismiss = useCallback((group: BookGroup) => {
    setDismissedKeys((current) => (current.includes(group.key) ? current : [...current, group.key]));
  }, [setDismissedKeys]);

  return (
    <AnimatedModal
      open={open}
      ariaLabel={t("library:duplicates.title")}
      onBackdropClick={onClose}
      backdropClassName="px-4"
      className="flex h-[84vh] w-full max-w-4xl flex-col overflow-hidden rounded-sm border border-border bg-background shadow-2xl"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <Copy size={18} className="shrink-0 text-primary" />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">{t("library:duplicates.title")}</h2>
            <p className="mt-0.5 text-xs text-foreground-subtle">
              {documents === null
                ? t("library:duplicates.scanning")
                : t("library:duplicates.summary", { count: groups.length, books: bookCount })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {dismissedKeys.length > 0 && (
            <button
              type="button"
              onClick={() => setDismissedKeys([])}
              className="h-8 cursor-pointer rounded-sm border border-border px-3 text-xs text-foreground-muted transition-colors hover:bg-surface hover:text-foreground"
            >
              {t("library:duplicates.showHidden", { count: dismissedKeys.length })}
            </button>
          )}
          <button
            type="button"
            onClick={() => void loadDocuments()}
            disabled={documents === null}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-sm border border-border text-foreground-muted transition-colors hover:bg-surface hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            title={t("common:actions.refresh")}
            aria-label={t("common:actions.refresh")}
          >
            <RefreshCw size={14} className={documents === null ? "animate-spin" : ""} />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-sm text-foreground-muted transition-colors hover:bg-surface-muted hover:text-foreground"
            title={t("common:actions.close")}
            aria-label={t("common:actions.close")}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {documents === null ? (
          <div className="flex min-h-72 flex-col items-center justify-center gap-3 text-sm text-foreground-subtle">
            <RefreshCw size={20} className="animate-spin" />
            {t("library:duplicates.scanning")}
          </div>
        ) : groups.length === 0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center gap-2 rounded-sm border border-dashed border-border text-center">
            <Check size={22} className="text-success" />
            <p className="text-sm text-foreground">{t("library:duplicates.empty")}</p>
            <p className="max-w-sm text-xs text-foreground-subtle">{t("library:duplicates.emptyHint")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-foreground-subtle">{t("library:duplicates.hint")}</p>
            {groups.map((group) => (
              <DuplicateGroupCard
                key={group.key}
                group={group}
                busy={busyGroup === group.key}
                disabled={busyGroup !== null && busyGroup !== group.key}
                onMerge={handleMerge}
                onRemove={handleRemove}
                onDismiss={handleDismiss}
              />
            ))}
          </div>
        )}
      </div>
    </AnimatedModal>
  );
}

interface DuplicateGroupCardProps {
  group: BookGroup;
  busy: boolean;
  disabled: boolean;
  onMerge: (group: BookGroup, fileHashes: string[]) => void;
  onRemove: (group: BookGroup, fileHashes: string[], deleteFiles: boolean) => void;
  onDismiss: (group: BookGroup) => void;
}

function DuplicateGroupCard({ group, busy, disabled, onMerge, onRemove, onDismiss }: DuplicateGroupCardProps) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [deleteFiles, setDeleteFiles] = useState(false);
  const allHashes = group.books.map((book) => book.fileHash);
  const selectedHashes = allHashes.filter((fileHash) => selected.has(fileHash));
  const mergeHashes = selectedHashes.length >= 2 ? selectedHashes : allHashes;
  const locked = busy || disabled;

  const toggle = (fileHash: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(fileHash)) next.delete(fileHash);
      else next.add(fileHash);
      return next;
    });
  };

  return (
    <section className="overflow-hidden rounded-sm border border-border bg-surface">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        {group.reasons.map((reason) => (
          <span
            key={reason}
            className={`rounded-sm px-1.5 py-0.5 text-[11px] font-medium ${
              reason === "similarTitle" ? "bg-warning-muted text-warning" : "bg-primary-muted text-primary"
            }`}
          >
            {t(REASON_LABEL_KEYS[reason])}
          </span>
        ))}
        <span className="text-xs text-foreground-subtle">
          {t("library:duplicates.groupCount", { count: group.books.length })}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => onMerge(group, mergeHashes)}
            disabled={locked}
            className="flex h-8 cursor-pointer items-center gap-1.5 rounded-sm border border-border bg-surface-muted px-2.5 text-xs text-foreground transition-colors hover:bg-border-strong disabled:cursor-not-allowed disabled:opacity-50"
            title={t("library:duplicates.mergeHint")}
          >
            <GitMerge size={14} className="text-primary" />
            {selectedHashes.length >= 2
              ? t("library:duplicates.mergeSelected", { count: selectedHashes.length })
              : t("library:duplicates.merge")}
          </button>
          <button
            type="button"
            onClick={() => setConfirmingRemove(true)}
            disabled={locked || selectedHashes.length === 0}
            className="flex h-8 cursor-pointer items-center gap-1.5 rounded-sm border border-destructive/30 bg-destructive-muted px-2.5 text-xs text-destructive transition-colors hover:bg-destructive-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 size={14} />
            {selectedHashes.length > 0
              ? t("library:duplicates.removeSelected", { count: selectedHashes.length })
              : t("common:actions.remove")}
          </button>
          <button
            type="button"
            onClick={() => onDismiss(group)}
            disabled={locked}
            className="flex h-8 cursor-pointer items-center gap-1.5 rounded-sm px-2.5 text-xs text-foreground-muted transition-colors hover:bg-surface-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            title={t("library:duplicates.dismissHint")}
          >
            <EyeOff size={14} />
            {t("library:duplicates.dismiss")}
          </button>
        </div>
      </div>

      <ul className="divide-y divide-border">
        {group.books.map((book) => (
          <DuplicateBookRow
            key={book.fileHash}
            book={book}
            checked={selected.has(book.fileHash)}
            disabled={locked}
            onToggle={() => toggle(book.fileHash)}
          />
        ))}
      </ul>

      {confirmingRemove && (
        <div className="flex flex-wrap items-center gap-3 border-t border-border bg-destructive-muted/40 px-3 py-2.5">
          <p className="text-xs text-foreground">
            {t("library:page.removeFromLibraryBody", { count: selectedHashes.length })}
          </p>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-foreground">
            <input
              type="checkbox"
              checked={deleteFiles}
              onChange={(event) => setDeleteFiles(event.target.checked)}
              className="h-4 w-4 cursor-pointer accent-primary"
            />
            {t("library:page.deleteFilesAlso", { count: selectedHashes.length })}
          </label>
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={() => {
                setConfirmingRemove(false);
                setDeleteFiles(false);
              }}
              className="cursor-pointer rounded-sm bg-surface-muted px-3 py-1.5 text-xs transition-colors hover:bg-border-strong"
            >
              {t("common:actions.cancel")}
            </button>
            <button
              type="button"
              disabled={locked || selectedHashes.length === 0}
              onClick={() => {
                setConfirmingRemove(false);
                onRemove(group, selectedHashes, deleteFiles);
                setDeleteFiles(false);
                setSelected(new Set());
              }}
              className="cursor-pointer rounded-sm bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground transition-colors hover:bg-destructive-hover disabled:opacity-50"
            >
              {t("common:actions.remove")}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function DuplicateBookRow({
  book,
  checked,
  disabled,
  onToggle,
}: {
  book: DocumentRecord;
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const { thumbnail } = useLazyThumbnail(book as BookWithThumbnail);

  return (
    <li>
      <label className={`flex cursor-pointer items-center gap-3 px-3 py-2 transition-colors hover:bg-surface-muted/40 ${checked ? "bg-primary-muted/60" : ""}`}>
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={onToggle}
          className="h-4 w-4 shrink-0 cursor-pointer accent-primary"
          aria-label={t("library:duplicates.selectBook", { title: book.title })}
        />
        <div className="h-12 w-9 shrink-0 overflow-hidden rounded-sm bg-surface-muted shadow-sm">
          {thumbnail ? (
            <img src={thumbnail} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <FileText size={16} className="text-foreground-subtle" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {getTitleWithoutExtension(book.title, book.fileType)}
          </p>
          <p className="truncate text-xs text-foreground-subtle">
            {book.author || t("library:duplicates.unknownAuthor")}
            {book.isbn ? ` · ISBN ${book.isbn}` : ""}
          </p>
          <p className="truncate text-[11px] text-foreground-subtle" title={book.filePath}>
            {getBookFolderLabel(book.filePath)}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 text-[11px] text-foreground-subtle">
          <span className="rounded-sm bg-surface-muted px-1.5 py-0.5 uppercase text-foreground">
            {getFileTypeLabel(book.fileType, book.filePath)}
          </span>
          <span>
            {formatFileSize(book.fileSize)} · {formatPageCount(book.numPages, book.fileType)}
          </span>
        </div>
      </label>
    </li>
  );
}
