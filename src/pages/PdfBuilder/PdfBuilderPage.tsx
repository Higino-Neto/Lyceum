import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  ArrowUpDown,
  CheckSquare,
  FilePlus,
  FileStack,
  FileText,
  Library,
  RotateCcw,
  RotateCw,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { useTranslation } from "../../i18n/useTranslation";
import { LibraryPickerDialog } from "../../components/library/LibraryPickerDialog";
import { parsePageRanges } from "../../core/pdf/page-ranges";
import { fetchAllLibraryBooks } from "../../components/library/fetchAllLibraryBooks";
import { formatFileSize, getTitleWithoutExtension } from "../Library/utils";
import { NumberOption } from "../Conversion/components/OptionControls";
import {
  IconButton,
  ImageThumb,
  OptionSection,
  Segmented,
  SortableGrid,
  TextField,
  ToolButton,
  ToolEmptyState,
  ToolLayout,
  ToolRunStatus,
} from "./BuilderShared";
import { createToolFileId, stripExtension, toToolFiles, useFileDrop, useToolRunner, type ToolFile } from "./builderUtils";
import { thumbKey, usePdfThumbnails } from "./usePdfThumbnails";

type Rotation = 0 | 90 | 180 | 270;
type ThumbSize = "small" | "medium" | "large";
type ImagePageSize = "image" | "A4" | "Letter";
type OutputFormat = "pdf" | "cbz";

interface SourceFile {
  id: string;
  letter: string;
  path: string;
  name: string;
  kind: "pdf" | "image";
  size: number;
  pageCount: number;
}

interface BuilderPage {
  id: string;
  sourceId: string;
  pageIndex: number;
  rotation: Rotation;
  deleted: boolean;
}

const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "gif", "bmp", "tif", "tiff", "avif"];
const ACCEPTED = ["pdf", ...IMAGE_EXTENSIONS];
const THUMB_WIDTHS: Record<ThumbSize, number> = { small: 110, medium: 150, large: 210 };
const HISTORY_LIMIT = 50;

function sourceLetter(index: number) {
  let value = index;
  let letter = "";
  do {
    letter = String.fromCharCode(65 + (value % 26)) + letter;
    value = Math.floor(value / 26) - 1;
  } while (value >= 0);
  return letter;
}

function rotate(rotation: Rotation, delta: 90 | -90): Rotation {
  return ((((rotation + delta) % 360) + 360) % 360) as Rotation;
}

function isTyping(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  return Boolean(element && (element.tagName === "INPUT" || element.tagName === "TEXTAREA" || element.isContentEditable));
}

function PdfPageImage({ path, pageIndex, rotation, src, onVisible }: {
  path: string;
  pageIndex: number;
  rotation: Rotation;
  src?: string;
  onVisible: (path: string, pageIndex: number) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node || src) return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect();
        onVisible(path, pageIndex);
      }
    }, { rootMargin: "400px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [onVisible, pageIndex, path, src]);

  return (
    <div ref={ref} className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded-sm bg-surface-muted">
      {src ? (
        <img
          src={src}
          alt=""
          draggable={false}
          className="max-h-full max-w-full object-contain shadow-md transition-transform duration-200"
          style={{ transform: `rotate(${rotation}deg)${rotation % 180 ? " scale(0.75)" : ""}` }}
        />
      ) : (
        <FileText size={20} className="text-foreground-subtle" />
      )}
    </div>
  );
}

export default function PdfBuilderPage() {
  const { t } = useTranslation();
  const [sources, setSources] = useState<SourceFile[]>([]);
  const [pages, setPages] = useState<BuilderPage[]>([]);
  const [history, setHistory] = useState<BuilderPage[][]>([]);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [anchorId, setAnchorId] = useState<string | null>(null);
  const [range, setRange] = useState("");
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [thumbSize, setThumbSize] = useState<ThumbSize>("medium");
  const [format, setFormat] = useState<OutputFormat>("pdf");
  const [imagePageSize, setImagePageSize] = useState<ImagePageSize>("image");
  const [marginMm, setMarginMm] = useState(0);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [adding, setAdding] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const letterCounter = useRef(0);
  const { state, run, reset } = useToolRunner();
  const { thumbs, request } = usePdfThumbnails();
  const running = state.status === "running";
  const available = Boolean(window.api?.runTool);

  const sourceById = useMemo(() => new Map(sources.map((source) => [source.id, source])), [sources]);

  const booksQuery = useQuery({
    queryKey: ["conversion-library-books"],
    queryFn: fetchAllLibraryBooks,
    enabled: pickerOpen,
    staleTime: 20_000,
  });
  const libraryPdfs = useMemo(
    () => (booksQuery.data ?? []).filter((book) => (book.fileType || "").toLowerCase() === "pdf" && !book.fileHash.includes(":")),
    [booksQuery.data],
  );

  // ----- editing with undo -------------------------------------------------

  // The ref always holds the latest pages, so async additions never overwrite
  // edits made while files were loading, and consecutive commits chain.
  const pagesRef = useRef(pages);
  pagesRef.current = pages;
  const historyRef = useRef(history);
  historyRef.current = history;

  const commit = useCallback((next: BuilderPage[] | ((previous: BuilderPage[]) => BuilderPage[])) => {
    reset();
    const previous = pagesRef.current;
    const resolved = typeof next === "function" ? next(previous) : next;
    pagesRef.current = resolved;
    setHistory((current) => [...current.slice(-(HISTORY_LIMIT - 1)), previous]);
    setPages(resolved);
  }, [reset]);

  const undo = useCallback(() => {
    const previous = historyRef.current[historyRef.current.length - 1];
    if (!previous) return;
    reset();
    pagesRef.current = previous;
    setHistory((current) => current.slice(0, -1));
    setPages(previous);
  }, [reset]);

  const targets = useCallback((page: BuilderPage) => (selection.has(page.id) ? selection : new Set([page.id])), [selection]);

  const patch = (ids: Set<string>, change: (page: BuilderPage) => BuilderPage) =>
    commit(pages.map((page) => (ids.has(page.id) ? change(page) : page)));

  // ----- adding files ------------------------------------------------------

  const addFiles = async (files: ToolFile[]) => {
    const usable = files.filter((file) => ACCEPTED.includes(file.extension));
    if (usable.length === 0) return;
    setAdding(true);
    const newSources: SourceFile[] = [];
    const newPages: BuilderPage[] = [];
    try {
      for (const file of usable) {
        const kind = file.extension === "pdf" ? "pdf" : "image";
        let pageCount = 1;
        if (kind === "pdf") {
          const info = await window.api.getToolPdfInfo(file.path);
          if (!info.success || !info.pageCount) {
            toast.error(t("conversion:builder.unreadable", { name: file.name, message: info.error || "" }));
            continue;
          }
          pageCount = info.pageCount;
        }
        const source: SourceFile = {
          id: createToolFileId("source"),
          letter: sourceLetter(letterCounter.current++),
          path: file.path,
          name: file.name,
          kind,
          size: file.size,
          pageCount,
        };
        newSources.push(source);
        for (let index = 0; index < pageCount; index += 1) {
          newPages.push({ id: createToolFileId("page"), sourceId: source.id, pageIndex: index, rotation: 0, deleted: false });
        }
      }
    } finally {
      setAdding(false);
    }
    if (newSources.length === 0) return;
    setSources((current) => [...current, ...newSources]);
    commit((previous) => [...previous, ...newPages]);
    setTitle((current) => current || stripExtension(newSources[0]!.name));
  };

  const drop = useFileDrop(ACCEPTED, (files) => void addFiles(files), "file");
  const pick = () => void window.api.pickToolFiles("builder").then((picked) => addFiles(toToolFiles(picked, "file")));

  const removeSource = (sourceId: string) => {
    commit((previous) => previous.filter((page) => page.sourceId !== sourceId));
    setSources((current) => current.filter((source) => source.id !== sourceId));
    setSelection(new Set());
  };

  const clearAll = () => {
    commit([]);
    setSources([]);
    setSelection(new Set());
    letterCounter.current = 0;
  };

  // ----- selection ---------------------------------------------------------

  const onCardClick = (event: MouseEvent, page: BuilderPage, position: number) => {
    if (event.shiftKey && anchorId) {
      const anchorPosition = pages.findIndex((candidate) => candidate.id === anchorId);
      const [from, to] = anchorPosition < position ? [anchorPosition, position] : [position, anchorPosition];
      setSelection(new Set(pages.slice(Math.max(0, from), to + 1).map((candidate) => candidate.id)));
      return;
    }
    setAnchorId(page.id);
    if (event.ctrlKey || event.metaKey) {
      setSelection((current) => {
        const next = new Set(current);
        if (next.has(page.id)) next.delete(page.id);
        else next.add(page.id);
        return next;
      });
      return;
    }
    setSelection((current) => (current.size === 1 && current.has(page.id) ? new Set() : new Set([page.id])));
  };

  const selectedPages = pages.filter((page) => selection.has(page.id));
  const allSelectedDeleted = selectedPages.length > 0 && selectedPages.every((page) => page.deleted);

  const onKeyDown = (event: KeyboardEvent) => {
    if (isTyping(event.target)) return;
    const mod = event.ctrlKey || event.metaKey;
    if (mod && event.key.toLowerCase() === "z") {
      event.preventDefault();
      undo();
    } else if (mod && event.key.toLowerCase() === "a" && pages.length) {
      event.preventDefault();
      setSelection(new Set(pages.map((page) => page.id)));
    } else if (event.key === "Escape") {
      setSelection(new Set());
    } else if ((event.key === "Delete" || event.key === "Backspace") && selection.size) {
      event.preventDefault();
      patch(selection, (page) => ({ ...page, deleted: !allSelectedDeleted }));
    }
  };

  // ----- range extraction (by current position) ----------------------------

  const applyRange = () => {
    try {
      const positions = parsePageRanges(range, pages.length);
      commit(positions.map((position) => ({ ...pages[position]!, id: createToolFileId("page"), deleted: false })));
      setSelection(new Set());
      setRangeError(null);
    } catch (error) {
      setRangeError(error instanceof Error ? error.message : String(error));
    }
  };

  // ----- export -------------------------------------------------------------

  const kept = pages.filter((page) => !page.deleted);
  const keptSources = new Set(kept.map((page) => page.sourceId));
  const hasImagePages = kept.some((page) => sourceById.get(page.sourceId)?.kind === "image");
  const cbzPossible = kept.length > 0 && kept.every((page) => sourceById.get(page.sourceId)?.kind === "image" && page.rotation === 0);
  const effectiveFormat: OutputFormat = format === "cbz" && !cbzPossible ? "pdf" : format;

  const handleExport = async () => {
    if (kept.length === 0) return;
    const first = sourceById.get(kept[0]!.sourceId);
    const outputPath = await window.api.pickToolSavePath(effectiveFormat, title || "documento", first?.path);
    if (!outputPath) return;
    if (effectiveFormat === "cbz") {
      await run({ operation: "images-to-cbz", input: { imagePaths: kept.map((page) => sourceById.get(page.sourceId)!.path), outputPath, title, author } });
      return;
    }
    await run({
      operation: "build-pdf",
      input: {
        outputPath,
        title,
        author,
        imagePageSize,
        marginMm,
        pages: kept.map((page) => {
          const source = sourceById.get(page.sourceId)!;
          return { source: source.path, kind: source.kind, pageIndex: page.pageIndex, rotation: page.rotation };
        }),
      },
    });
  };

  const deletedCount = pages.length - kept.length;
  const idle = pages.length === 0
    ? t("conversion:builder.emptyFooter")
    : [
        t("conversion:builder.summary", { count: kept.length, files: keptSources.size }),
        deletedCount ? t("conversion:builder.deletedCount", { count: deletedCount }) : null,
      ].filter(Boolean).join(" · ");

  const addButtons = (
    <>
      <ToolButton onClick={() => setPickerOpen(true)} disabled={running || adding}>
        <Library size={14} />
        {t("conversion:builder.addFromLibrary")}
      </ToolButton>
      <ToolButton onClick={pick} disabled={running || adding}>
        <FilePlus size={14} />
        {t("conversion:builder.addFiles")}
      </ToolButton>
    </>
  );

  if (!available) {
    return <div className="p-6 text-sm text-foreground-subtle">{t("conversion:builder.desktopOnly")}</div>;
  }

  return (
    <div className="lyceum-page-pdf-builder flex h-full min-h-0 flex-col bg-background p-3 text-foreground outline-none" tabIndex={-1} onKeyDown={onKeyDown}>
      <ToolLayout
        title={t("conversion:builder.title")}
        description={t("conversion:builder.description")}
        actions={pages.length > 0 || sources.length > 0 ? addButtons : undefined}
        dropzone={{ ...drop, label: t("conversion:builder.dropHere") }}
        toolbar={pages.length > 0 ? (
          selection.size > 0 ? (
            <>
              <span className="mr-1 text-xs font-medium text-foreground">{t("conversion:builder.selected", { count: selection.size })}</span>
              <ToolButton variant="ghost" onClick={() => patch(selection, (page) => ({ ...page, rotation: rotate(page.rotation, -90) }))}>
                <RotateCcw size={14} />
                {t("conversion:builder.rotateLeft")}
              </ToolButton>
              <ToolButton variant="ghost" onClick={() => patch(selection, (page) => ({ ...page, rotation: rotate(page.rotation, 90) }))}>
                <RotateCw size={14} />
                {t("conversion:builder.rotateRight")}
              </ToolButton>
              <ToolButton variant="ghost" onClick={() => patch(selection, (page) => ({ ...page, deleted: !allSelectedDeleted }))}>
                {allSelectedDeleted ? <Undo2 size={14} /> : <Trash2 size={14} />}
                {allSelectedDeleted ? t("conversion:builder.restore") : t("conversion:builder.delete")}
              </ToolButton>
              <ToolButton variant="ghost" onClick={() => setSelection(new Set())}>
                <X size={14} />
                {t("conversion:builder.clearSelection")}
              </ToolButton>
              <span className="ml-auto text-[11px] text-foreground-subtle">{t("conversion:builder.selectionHint")}</span>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1.5">
                <input
                  value={range}
                  onChange={(event) => { setRange(event.target.value); setRangeError(null); }}
                  onKeyDown={(event) => { if (event.key === "Enter") applyRange(); }}
                  placeholder={t("conversion:builder.rangePlaceholder")}
                  title={t("conversion:builder.rangeHint")}
                  aria-label={t("conversion:builder.rangeLabel")}
                  aria-invalid={Boolean(rangeError)}
                  className={`h-8 w-36 rounded-sm border bg-background px-2.5 text-xs text-foreground outline-none placeholder:text-input-placeholder focus:border-primary ${rangeError ? "border-destructive" : "border-border"}`}
                />
                <ToolButton onClick={applyRange} disabled={!range.trim()} title={t("conversion:builder.rangeHint")}>
                  {t("conversion:builder.applyRange")}
                </ToolButton>
              </div>
              <ToolButton variant="ghost" onClick={() => commit([...pages].reverse())} disabled={pages.length < 2}>
                <ArrowUpDown size={14} />
                {t("conversion:builder.reverse")}
              </ToolButton>
              <ToolButton variant="ghost" onClick={() => setSelection(new Set(pages.map((page) => page.id)))}>
                <CheckSquare size={14} />
                {t("conversion:builder.selectAll")}
              </ToolButton>
              <ToolButton variant="ghost" onClick={undo} disabled={history.length === 0} title="Ctrl+Z">
                <Undo2 size={14} />
                {t("conversion:builder.undo")}
              </ToolButton>
              <div className="ml-auto w-36">
                <Segmented<ThumbSize>
                  label={t("conversion:builder.thumbSize")}
                  value={thumbSize}
                  onChange={setThumbSize}
                  options={[
                    { value: "small", label: t("conversion:builder.sizes.small") },
                    { value: "medium", label: t("conversion:builder.sizes.medium") },
                    { value: "large", label: t("conversion:builder.sizes.large") },
                  ]}
                />
              </div>
              {rangeError && <p className="w-full text-[11px] text-destructive" role="alert">{t("conversion:builder.invalidRange", { message: rangeError })}</p>}
            </>
          )
        ) : undefined}
        sidebar={sources.length > 0 ? (
          <>
            <OptionSection title={t("conversion:builder.files", { count: sources.length })}>
              <ul className="space-y-1">
                {sources.map((source) => (
                  <li key={source.id} className="flex items-center gap-2 rounded-sm border border-border bg-background px-2 py-1.5">
                    <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-sm bg-primary-muted text-[11px] font-bold text-primary">{source.letter}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs text-foreground" title={source.path}>{source.name}</p>
                      <p className="text-[11px] text-foreground-subtle">
                        {source.kind === "pdf" ? t("conversion:tools.common.pages", { count: source.pageCount }) : t("conversion:builder.image")} · {formatFileSize(source.size)}
                      </p>
                    </div>
                    <IconButton label={t("conversion:builder.removeFile", { name: source.name })} danger onClick={() => removeSource(source.id)}>
                      <X size={13} />
                    </IconButton>
                  </li>
                ))}
              </ul>
              <ToolButton variant="ghost" onClick={clearAll} disabled={running}>
                <Trash2 size={14} />
                {t("conversion:builder.clearAll")}
              </ToolButton>
            </OptionSection>

            <OptionSection title={t("conversion:builder.outputFormat")}>
              <Segmented<OutputFormat>
                label={t("conversion:builder.outputFormat")}
                value={effectiveFormat}
                onChange={setFormat}
                options={[
                  { value: "pdf", label: "PDF" },
                  { value: "cbz", label: "CBZ", disabled: !cbzPossible, hint: t("conversion:builder.cbzHint") },
                ]}
              />
              <p className="text-[11px] text-foreground-subtle">
                {effectiveFormat === "cbz" ? t("conversion:tools.images.cbzDescription") : cbzPossible ? t("conversion:tools.images.pdfDescription") : t("conversion:builder.cbzHint")}
              </p>
            </OptionSection>

            {effectiveFormat === "pdf" && hasImagePages && (
              <OptionSection title={t("conversion:builder.imagePageSize")}>
                <Segmented<ImagePageSize>
                  label={t("conversion:builder.imagePageSize")}
                  value={imagePageSize}
                  onChange={setImagePageSize}
                  options={[
                    { value: "image", label: t("conversion:tools.images.pageSizes.image") },
                    { value: "A4", label: t("conversion:tools.images.pageSizes.A4") },
                    { value: "Letter", label: t("conversion:tools.images.pageSizes.Letter") },
                  ]}
                />
                {imagePageSize !== "image" && (
                  <NumberOption label={t("conversion:tools.images.margin")} value={marginMm} min={0} max={50} suffix="mm" onChange={setMarginMm} />
                )}
              </OptionSection>
            )}

            <OptionSection title={t("conversion:tools.common.metadata")}>
              <TextField label={t("conversion:tools.common.documentTitle")} value={title} onChange={setTitle} />
              <TextField label={t("conversion:tools.common.documentAuthor")} value={author} onChange={setAuthor} />
            </OptionSection>
          </>
        ) : undefined}
        footer={
          <>
            <ToolRunStatus state={state} idle={idle} />
            <ToolButton variant="primary" onClick={() => void handleExport()} disabled={kept.length === 0 || running || adding}>
              {running ? t("conversion:tools.common.running") : t("conversion:builder.export", { format: effectiveFormat.toUpperCase() })}
            </ToolButton>
          </>
        }
      >
        {pages.length === 0 ? (
          <ToolEmptyState
            icon={adding ? <FileStack size={22} className="animate-pulse" /> : <FileStack size={22} />}
            title={t("conversion:builder.emptyTitle")}
            hint={t("conversion:builder.emptyHint")}
            actions={addButtons}
          />
        ) : (
          <SortableGrid
            items={pages}
            onChange={commit}
            columnWidth={THUMB_WIDTHS[thumbSize]}
            itemLabel={(page, position) => {
              const source = sourceById.get(page.sourceId);
              return t("conversion:builder.pageLabel", { position: position + 1, letter: source?.letter ?? "?", page: page.pageIndex + 1 });
            }}
          >
            {(page, position, dragging) => {
              const source = sourceById.get(page.sourceId);
              if (!source) return null;
              const selected = selection.has(page.id);
              return (
                <div
                  onClick={(event) => onCardClick(event, page, position)}
                  className={`relative rounded-sm border bg-background p-1.5 transition-colors ${
                    dragging || selected ? "border-primary ring-1 ring-primary" : page.deleted ? "border-destructive/50" : "border-border group-hover:border-border-strong"
                  }`}
                >
                  <div className={page.deleted ? "opacity-35 grayscale" : undefined}>
                    {source.kind === "pdf" ? (
                      <PdfPageImage path={source.path} pageIndex={page.pageIndex} rotation={page.rotation} src={thumbs[thumbKey(source.path, page.pageIndex)]} onVisible={request} />
                    ) : (
                      <div className="aspect-[3/4] overflow-hidden rounded-sm bg-surface-muted" style={{ transform: page.rotation ? `rotate(${page.rotation}deg) scale(${page.rotation % 180 ? 0.75 : 1})` : undefined }}>
                        <ImageThumb path={source.path} className="h-full w-full" fit="contain" />
                      </div>
                    )}
                  </div>
                  <span className="absolute left-3 top-3 rounded-sm bg-overlay px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-foreground">{position + 1}</span>
                  {page.deleted && (
                    <span className="absolute right-3 top-3 rounded-sm bg-destructive px-1.5 py-0.5 text-[10px] font-semibold text-destructive-foreground">
                      {t("conversion:builder.deleted")}
                    </span>
                  )}
                  {/* Page actions float over the thumbnail so the caption keeps its room. */}
                  <div className={`absolute inset-x-3 bottom-9 flex justify-center gap-0.5 rounded-sm bg-overlay p-0.5 backdrop-blur-sm transition-opacity ${
                    selected ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
                  }`}>
                    {!page.deleted && (
                      <>
                        <IconButton label={t("conversion:builder.rotateLeft")} onClick={() => patch(targets(page), (item) => ({ ...item, rotation: rotate(item.rotation, -90) }))}>
                          <RotateCcw size={13} />
                        </IconButton>
                        <IconButton label={t("conversion:builder.rotateRight")} onClick={() => patch(targets(page), (item) => ({ ...item, rotation: rotate(item.rotation, 90) }))}>
                          <RotateCw size={13} />
                        </IconButton>
                      </>
                    )}
                    <IconButton
                      label={page.deleted ? t("conversion:builder.restore") : t("conversion:builder.delete")}
                      danger={!page.deleted}
                      active={page.deleted}
                      onClick={() => patch(targets(page), (item) => ({ ...item, deleted: !page.deleted }))}
                    >
                      {page.deleted ? <Undo2 size={13} /> : <Trash2 size={13} />}
                    </IconButton>
                  </div>
                  <p className="mt-1.5 flex min-w-0 items-center gap-1 px-0.5 text-[11px] text-foreground-subtle" title={source.name}>
                    <span className="rounded-sm bg-primary-muted px-1 font-bold text-primary">{source.letter}</span>
                    <span className="truncate">
                      {source.kind === "pdf" ? t("conversion:builder.pageShort", { page: page.pageIndex + 1 }) : t("conversion:builder.image")}
                      {page.rotation ? ` · ${page.rotation}°` : ""}
                    </span>
                  </p>
                </div>
              );
            }}
          </SortableGrid>
        )}
      </ToolLayout>

      <LibraryPickerDialog
        open={pickerOpen}
        books={libraryPdfs}
        title={t("conversion:builder.pickerTitle")}
        description={t("conversion:builder.pickerDescription")}
        onClose={() => setPickerOpen(false)}
        multiple
        onSelectMany={(books) => {
          setPickerOpen(false);
          void addFiles(books.map((book) => ({
            id: createToolFileId("file"),
            path: book.filePath,
            name: `${getTitleWithoutExtension(book.title, book.fileType)}.pdf`,
            size: book.fileSize || 0,
            extension: "pdf",
          })));
        }}
      />
    </div>
  );
}
