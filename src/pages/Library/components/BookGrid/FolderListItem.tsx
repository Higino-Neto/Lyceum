import {
  BookOpen,
  Boxes,
  ChevronRight,
  Folder,
  MoreVertical,
} from "lucide-react";
import type {
  DragEventHandler,
  KeyboardEvent,
  MouseEvent,
} from "react";
import type { FolderInfo } from "../../../../types/LibraryTypes";
import {
  translate,
  useTranslation,
  type TranslationKey,
} from "../../../../i18n";

interface FolderListItemProps {
  folder: FolderInfo;
  bookCount: number;
  folderCount: number;
  detail?: string;
  gridTemplateColumns: string;
  /** Narrow table: title cell only, details on a second line. */
  compact: boolean;
  isSelected?: boolean;
  isDropTarget?: boolean;
  onOpen?: (folderPath: string) => void;
  onContextMenu?: (event: MouseEvent) => void;
  onDragOver?: DragEventHandler<HTMLDivElement>;
  onDragLeave?: DragEventHandler<HTMLDivElement>;
  onDrop?: DragEventHandler<HTMLDivElement>;
}

function formatCount(
  count: number,
  singularKey: TranslationKey,
  pluralKey: TranslationKey,
) {
  return translate(count === 1 ? singularKey : pluralKey, { count });
}

export default function FolderListItem({
  folder,
  bookCount,
  folderCount,
  detail,
  gridTemplateColumns,
  compact,
  isSelected = false,
  isDropTarget = false,
  onOpen,
  onContextMenu,
  onDragOver,
  onDragLeave,
  onDrop,
}: FolderListItemProps) {
  const { t } = useTranslation();
  const open = () => onOpen?.(folder.path);
  const metadata = `${formatCount(folderCount, "library:counts.subfolder_one", "library:counts.subfolder_other")} - ${formatCount(bookCount, "library:counts.book_one", "library:counts.book_other")}`;

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    open();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={t("library:folders.openFolder", { name: folder.name })}
      aria-pressed={isSelected || undefined}
      title={detail ? `${folder.name}\n${detail}` : folder.name}
      onClick={open}
      onKeyDown={handleKeyDown}
      onContextMenu={(event) => {
        if (!onContextMenu) return;
        event.preventDefault();
        onContextMenu(event);
      }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={[
        "grid min-h-12 cursor-pointer items-center rounded-sm border bg-background/70 transition-colors",
        "hover:border-primary/55 hover:bg-surface",
        isSelected ? "border-primary/80 bg-primary-muted ring-1 ring-focus-ring" : "border-border",
        isDropTarget ? "border-primary bg-primary-muted ring-1 ring-focus-ring" : "",
      ].join(" ")}
      style={{ gridTemplateColumns }}
    >
      <div className="flex min-w-0 items-center gap-3 px-3 py-2">
        <div className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-sm border border-primary/20 bg-primary-muted text-primary">
          <Folder size={22} strokeWidth={1.5} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {folder.name}
          </p>
          {compact && (
            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5 text-[11px] text-foreground-subtle">
              <span className="rounded-sm bg-primary-muted px-1.5 py-0.5 uppercase text-primary">
                {t("library:list.folderFallback")}
              </span>
              <span className="min-w-0 truncate">{metadata}</span>
            </div>
          )}
        </div>
      </div>

      {!compact && (
        // Folder rows have no per-column data: one cell spans the book columns.
        <div className="flex min-w-0 items-center gap-4 px-3 py-2 text-xs" style={{ gridColumn: "2 / -2" }}>
          <span className="inline-flex shrink-0 items-center gap-1 text-foreground-muted">
            <BookOpen size={12} className={bookCount > 0 ? "text-warning" : "text-foreground-subtle"} />
            {formatCount(
              bookCount,
              "library:counts.book_one",
              "library:counts.book_other",
            )}
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 text-foreground-muted">
            <Boxes size={12} className={folderCount > 0 ? "text-primary" : "text-foreground-subtle"} />
            {formatCount(
              folderCount,
              "library:counts.subfolder_one",
              "library:counts.subfolder_other",
            )}
          </span>
          {detail && <span className="min-w-0 truncate text-foreground-subtle">{detail}</span>}
        </div>
      )}

      <div className="flex justify-end gap-1 px-2">
        {onContextMenu && (
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onContextMenu(event);
            }}
            className="cursor-pointer rounded p-2 text-foreground-subtle hover:bg-surface-muted hover:text-foreground"
            aria-label={t("library:folders.moreActions", {
              name: folder.name,
            })}
            title={t("library:folders.moreActions", { name: folder.name })}
          >
            <MoreVertical size={15} />
          </button>
        )}
        <span className="flex h-8 w-8 items-center justify-center rounded-sm text-primary">
          <ChevronRight size={16} />
        </span>
      </div>
    </div>
  );
}
