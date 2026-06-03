import {
  BookOpen,
  Boxes,
  ChevronRight,
  Folder,
  MoreVertical,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
  type DragEventHandler,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { thumbnailCache } from "./BookGrid/thumbnailCache";

export type FolderCardProps = {
  id: string;
  name: string;
  bookCount: number;
  folderCount: number;
  coverPreviews?: string[];
  coverPreviewPaths?: string[];
  isSelected?: boolean;
  isEmpty?: boolean;
  onOpen?: (id: string) => void;
  onContextMenu?: (id: string, event?: MouseEvent) => void;
  onDragOver?: DragEventHandler<HTMLDivElement>;
  onDragLeave?: DragEventHandler<HTMLDivElement>;
  onDrop?: DragEventHandler<HTMLDivElement>;
  isDropTarget?: boolean;
};

function formatCount(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function useFolderPreviewImages(
  coverPreviews: string[] = [],
  coverPreviewPaths: string[] = [],
) {
  const initialPreviews = useMemo(
    () => coverPreviews.filter(Boolean).slice(0, 3),
    [coverPreviews],
  );
  const [loadedFromPaths, setLoadedFromPaths] = useState<string[]>([]);
  const previewPaths = useMemo(
    () => coverPreviewPaths.filter(Boolean).slice(0, 3),
    [coverPreviewPaths],
  );

  useEffect(() => {
    if (initialPreviews.length > 0) return;
    if (previewPaths.length === 0) {
      setLoadedFromPaths([]);
      return;
    }

    let canceled = false;

    for (const thumbnailPath of previewPaths) {
      const cached = thumbnailCache.get(thumbnailPath);
      if (cached) {
        setLoadedFromPaths((current) =>
          current.includes(cached) ? current : [...current, cached].slice(0, 3),
        );
        continue;
      }

      if (typeof window.api?.getThumbnail !== "function") continue;

      window.api.getThumbnail(thumbnailPath).then((value: string | null) => {
        if (canceled || !value) return;
        setLoadedFromPaths((current) =>
          current.includes(value) ? current : [...current, value].slice(0, 3),
        );
      });
    }

    return () => {
      canceled = true;
    };
  }, [initialPreviews.length, previewPaths]);

  return initialPreviews.length > 0 ? initialPreviews : loadedFromPaths;
}

function CoverPreview({
  images,
  bookCount,
  folderCount,
}: {
  images: string[];
  bookCount: number;
  folderCount: number;
}) {
  const isEmpty = bookCount === 0 && folderCount === 0;

  return (
    <div className="relative h-28 overflow-hidden rounded-sm border border-zinc-800 bg-zinc-950 p-3">
      {images.length > 0 ? (
        <div className="flex h-full items-end pl-2">
          {images.slice(0, 3).map((src, index) => (
            <div
              key={`${src}-${index}`}
              className="h-[78px] w-[52px] overflow-hidden rounded-sm border border-zinc-700 bg-zinc-950 shadow-xl shadow-black/40"
              style={{
                marginLeft: index === 0 ? 0 : -18,
                transform: `rotate(${[-6, 2, 7][index] || 0}deg) translateY(${index === 1 ? -7 : 0}px)`,
                zIndex: 3 - index,
              }}
            >
              <img
                src={src}
                alt=""
                className="h-full w-full object-cover"
                draggable={false}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex h-full items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-zinc-500">
            <div className="flex h-11 w-14 items-center justify-center rounded-sm border border-dashed border-zinc-700 bg-zinc-950/70">
              <Folder size={24} strokeWidth={1.4} />
            </div>
            {isEmpty && (
              <span className="text-[11px] font-medium uppercase tracking-wide">Vazia</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function FolderCard({
  id,
  name,
  bookCount,
  folderCount,
  coverPreviews,
  coverPreviewPaths,
  isSelected = false,
  isEmpty,
  onOpen,
  onContextMenu,
  onDragOver,
  onDragLeave,
  onDrop,
  isDropTarget = false,
}: FolderCardProps) {
  const images = useFolderPreviewImages(coverPreviews, coverPreviewPaths);
  const empty = isEmpty ?? (bookCount === 0 && folderCount === 0);
  const metadata = `${formatCount(folderCount, "subpasta", "subpastas")} • ${formatCount(bookCount, "livro", "livros")}`;

  const open = () => onOpen?.(id);
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    open();
  };
  const handleContextMenu = (event: MouseEvent) => {
    onContextMenu?.(id, event);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Abrir pasta ${name}`}
      aria-pressed={isSelected || undefined}
      title={name}
      onClick={open}
      onKeyDown={handleKeyDown}
      onContextMenu={handleContextMenu}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={[
        "group relative flex h-full min-h-[196px] cursor-pointer flex-col rounded-md border bg-zinc-950/60 p-2.5 text-left shadow-sm transition-all duration-200",
        "hover:-translate-y-0.5 hover:border-emerald-400/60 hover:bg-zinc-900/90 hover:shadow-lg hover:shadow-emerald-950/25",
        "focus:outline-none focus-visible:border-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-400/35",
        isSelected ? "border-emerald-400/80 bg-emerald-500/10 shadow-emerald-950/30" : "border-zinc-800",
        isDropTarget ? "border-emerald-400 bg-emerald-500/10 ring-1 ring-emerald-400/70" : "",
      ].join(" ")}
    >
      {onContextMenu && (
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onContextMenu(id, event);
          }}
          onKeyDown={(event) => event.stopPropagation()}
          className="absolute right-4 top-4 z-20 flex h-7 w-7 items-center justify-center rounded-sm border border-zinc-800 bg-zinc-950/75 text-zinc-500 opacity-0 shadow-sm transition-all hover:border-zinc-700 hover:bg-zinc-900 hover:text-zinc-200 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/35 group-hover:opacity-100"
          aria-label={`Mais ações de ${name}`}
          title={`Mais ações de ${name}`}
        >
          <MoreVertical size={15} />
        </button>
      )}

      <CoverPreview
        images={images}
        bookCount={bookCount}
        folderCount={folderCount}
      />

      <div className="mt-3 flex min-w-0 items-end gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-zinc-100">{name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-zinc-500">
            <span className="inline-flex items-center gap-1">
              <Boxes size={12} className={folderCount > 0 ? "text-emerald-300/80" : "text-zinc-600"} />
              {formatCount(folderCount, "subpasta", "subpastas")}
            </span>
            <span className="inline-flex items-center gap-1">
              <BookOpen size={12} className={bookCount > 0 ? "text-amber-200/80" : "text-zinc-600"} />
              {formatCount(bookCount, "livro", "livros")}
            </span>
          </div>
          <span className="sr-only">{metadata}</span>
        </div>

        <div
          className={[
            "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-sm border transition-all",
            empty
              ? "border-zinc-800 text-zinc-600"
              : "border-emerald-400/20 bg-emerald-400/10 text-emerald-200 group-hover:translate-x-0.5 group-hover:border-emerald-300/45",
          ].join(" ")}
          aria-hidden="true"
        >
          <ChevronRight size={16} />
        </div>
      </div>
    </div>
  );
}
