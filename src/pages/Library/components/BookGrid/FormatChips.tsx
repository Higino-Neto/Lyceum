import { BookWithThumbnail } from "../../../../types/LibraryTypes";
import { getBookFolderLabel, getFileTypeLabel } from "../../utils";
import { useTranslation } from "../../../../i18n";
import { getBookFiles } from "./bookFiles";

interface FormatChipsProps {
  book: BookWithThumbnail;
  selectedFilesKey: string;
  onToggleFile?: (file: BookWithThumbnail) => void;
  className?: string;
}

/**
 * One chip per file. For a merged book each chip is a toggle that selects only
 * that file, so a single format can be copied, moved, converted or deleted
 * without touching the others.
 */
export default function FormatChips({ book, selectedFilesKey, onToggleFile, className = "" }: FormatChipsProps) {
  const { t } = useTranslation();
  const files = getBookFiles(book);

  if (files.length <= 1 || !onToggleFile) {
    const label = files.length <= 1
      ? getFileTypeLabel(book.fileType, book.filePath)
      : Array.from(new Set(files.map((file) => getFileTypeLabel(file.fileType, file.filePath)))).join(" · ");
    return (
      <span className={`rounded-sm bg-surface-muted px-1.5 py-0.5 uppercase text-foreground ${className}`}>
        {label}
      </span>
    );
  }

  const selected = new Set(selectedFilesKey ? selectedFilesKey.split(",") : []);

  return (
    <span
      className={`flex min-w-0 flex-wrap items-center gap-1 ${className}`}
      role="group"
      aria-label={t("library:formats.groupLabel", { count: files.length })}
    >
      {files.map((file) => {
        const isFileSelected = selected.has(file.fileHash);
        const fileName = file.fileName || file.filePath?.split(/[\\/]/).pop() || file.title;
        return (
          <button
            key={file.fileHash}
            type="button"
            aria-pressed={isFileSelected}
            title={t("library:formats.chipTitle", {
              file: fileName,
              folder: getBookFolderLabel(file.filePath),
            })}
            onClick={(event) => {
              event.stopPropagation();
              onToggleFile(file);
            }}
            onContextMenu={(event) => event.stopPropagation()}
            className={`cursor-pointer rounded-sm border px-1.5 py-0.5 uppercase transition-colors ${
              isFileSelected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-surface-muted text-foreground hover:border-border-strong"
            }`}
          >
            {getFileTypeLabel(file.fileType, file.filePath)}
          </button>
        );
      })}
    </span>
  );
}
