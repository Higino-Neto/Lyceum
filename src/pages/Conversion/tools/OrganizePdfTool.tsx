import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpDown, FileText, FolderOpen, Library, RotateCcw, RotateCw, Trash2, Undo2 } from "lucide-react";
import { useTranslation } from "../../../i18n/useTranslation";
import { LibraryPickerDialog } from "../../../components/library/LibraryPickerDialog";
import { parsePageRanges } from "../../../core/pdf/page-ranges";
import { fetchAtlasBooks } from "../../Atlas/atlasUtils";
import { formatFileSize, getTitleWithoutExtension } from "../../Library/utils";
import {
  IconButton,
  SortableGrid,
  ToolButton,
  ToolPanel,
  ToolRunStatus,
} from "./ToolShared";
import { baseName, createToolFileId, stripExtension, useToolRunner } from "./toolUtils";

type Rotation = 0 | 90 | 180 | 270;

interface PageEntry {
  id: string;
  index: number;
  rotation: Rotation;
  deleted: boolean;
}

interface SourcePdf {
  path: string;
  name: string;
  pageCount: number;
  size: number;
}

const THUMB_BATCH = 24;

function initialPages(pageCount: number): PageEntry[] {
  return Array.from({ length: pageCount }, (_, index) => ({ id: createToolFileId("page"), index, rotation: 0, deleted: false }));
}

function rotate(rotation: Rotation, delta: 90 | -90): Rotation {
  return (((rotation + delta) % 360) + 360) % 360 as Rotation;
}

/** Collects thumbnail requests from visible tiles and fetches them in batches. */
function useThumbnailLoader(filePath: string | null) {
  const [thumbs, setThumbs] = useState<Record<number, string>>({});
  const pendingRef = useRef(new Set<number>());
  const requestedRef = useRef(new Set<number>());
  const timerRef = useRef<number | null>(null);
  const pathRef = useRef(filePath);

  useEffect(() => {
    pathRef.current = filePath;
    pendingRef.current.clear();
    requestedRef.current.clear();
    setThumbs({});
  }, [filePath]);

  const flush = useCallback(() => {
    timerRef.current = null;
    const currentPath = pathRef.current;
    if (!currentPath) return;
    const batch = Array.from(pendingRef.current).sort((a, b) => a - b).slice(0, THUMB_BATCH);
    batch.forEach((index) => pendingRef.current.delete(index));
    if (batch.length === 0) return;
    void window.api.getToolPdfThumbnails(currentPath, batch.map((index) => index + 1)).then((result) => {
      if (pathRef.current !== currentPath) return;
      setThumbs((current) => {
        const next = { ...current };
        for (const thumb of result.thumbnails) next[thumb.page - 1] = thumb.dataUrl;
        return next;
      });
      if (pendingRef.current.size > 0) flush();
    });
  }, []);

  const request = useCallback((index: number) => {
    if (requestedRef.current.has(index)) return;
    requestedRef.current.add(index);
    pendingRef.current.add(index);
    if (timerRef.current === null) timerRef.current = window.setTimeout(flush, 60);
  }, [flush]);

  useEffect(() => () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
  }, []);

  return { thumbs, request };
}

function PageThumb({ index, rotation, src, onVisible, children }: {
  index: number;
  rotation: Rotation;
  src?: string;
  onVisible: (index: number) => void;
  children?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node || src) return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect();
        onVisible(index);
      }
    }, { rootMargin: "300px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [index, onVisible, src]);

  return (
    <div ref={ref} className="relative flex aspect-[3/4] items-center justify-center overflow-hidden rounded-sm border border-border bg-surface-muted">
      {src ? (
        <img
          src={src}
          alt=""
          draggable={false}
          className="max-h-full max-w-full object-contain shadow-sm transition-transform duration-200"
          style={{ transform: `rotate(${rotation}deg)${rotation % 180 ? " scale(0.75)" : ""}` }}
        />
      ) : (
        <FileText size={20} className="text-foreground-subtle" />
      )}
      {children}
    </div>
  );
}

export default function OrganizePdfTool() {
  const { t } = useTranslation();
  const [source, setSource] = useState<SourcePdf | null>(null);
  const [pages, setPages] = useState<PageEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [range, setRange] = useState("");
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const { state, run, reset } = useToolRunner();
  const { thumbs, request } = useThumbnailLoader(source?.path ?? null);
  const running = state.status === "running";

  const booksQuery = useQuery({
    queryKey: ["conversion-library-books"],
    queryFn: fetchAtlasBooks,
    enabled: pickerOpen,
    staleTime: 20_000,
  });
  const libraryPdfs = useMemo(
    () => (booksQuery.data ?? []).filter((book) => (book.fileType || "").toLowerCase() === "pdf" && !book.fileHash.includes(":")),
    [booksQuery.data],
  );

  const openSource = async (filePath: string, name: string, size: number) => {
    setLoading(true);
    setLoadError(null);
    reset();
    try {
      const info = await window.api.getToolPdfInfo(filePath);
      if (!info.success || !info.pageCount) {
        setLoadError(info.error || "PDF");
        return;
      }
      setSource({ path: filePath, name, pageCount: info.pageCount, size: info.fileSize ?? size });
      setPages(initialPages(info.pageCount));
      setRange("");
      setRangeError(null);
    } finally {
      setLoading(false);
    }
  };

  const chooseFromComputer = async () => {
    const [picked] = await window.api.pickToolFiles("pdf");
    if (picked) await openSource(picked.path, picked.name, picked.size);
  };

  const update = (next: PageEntry[]) => {
    reset();
    setPages(next);
  };

  const applyRange = () => {
    if (!source) return;
    try {
      const indices = parsePageRanges(range, source.pageCount);
      const byIndex = new Map(pages.map((page) => [page.index, page]));
      update(indices.map((index) => ({
        id: createToolFileId("page"),
        index,
        rotation: byIndex.get(index)?.rotation ?? 0,
        deleted: false,
      })));
      setRangeError(null);
    } catch (error) {
      setRangeError(error instanceof Error ? error.message : String(error));
    }
  };

  const kept = pages.filter((page) => !page.deleted);
  const pristine = source
    ? pages.length === source.pageCount && pages.every((page, position) => page.index === position && page.rotation === 0 && !page.deleted)
    : true;

  const handleRun = async () => {
    if (!source || kept.length === 0) return;
    const outputPath = await window.api.pickToolSavePath("pdf", `${stripExtension(source.name)} (organizado)`, source.path);
    if (!outputPath) return;
    await run({
      operation: "organize-pdf",
      input: { inputPath: source.path, outputPath, pages: kept.map((page) => ({ index: page.index, rotation: page.rotation })) },
    });
  };

  const sourceActions = (
    <>
      <ToolButton onClick={() => setPickerOpen(true)} disabled={running || loading}>
        <Library size={14} />
        {t("conversion:tools.organize.chooseLibrary")}
      </ToolButton>
      <ToolButton onClick={() => void chooseFromComputer()} disabled={running || loading}>
        <FolderOpen size={14} />
        {source ? t("conversion:tools.organize.change") : t("conversion:tools.organize.choose")}
      </ToolButton>
    </>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:overflow-hidden xl:grid-cols-[minmax(0,1fr)_400px]">
      <main className="flex-none lg:min-h-0 lg:overflow-y-auto">
        <ToolPanel title={t("conversion:tools.organize.title")} description={t("conversion:tools.organize.description")} actions={sourceActions}>
          {!source ? (
            <div className="flex min-h-44 flex-col items-center justify-center gap-3 p-6 text-center text-sm text-foreground-subtle">
              <FileText size={24} />
              {loading ? t("conversion:tools.organize.loading") : loadError ? <span className="text-destructive">{loadError}</span> : t("conversion:tools.organize.empty")}
            </div>
          ) : (
            <>
              <p className="border-b border-border px-4 py-2 text-xs text-foreground-subtle">
                <span className="font-medium text-foreground">{source.name}</span> · {formatFileSize(source.size)} ·{" "}
                {t("conversion:tools.organize.summary", { kept: kept.length, total: source.pageCount })} · {t("conversion:tools.common.dropHint")}
              </p>
              <SortableGrid items={pages} onChange={update}>
                {(page, position, handle) => (
                  <div className={`rounded-sm border bg-background/70 p-2 ${page.deleted ? "border-destructive/50 opacity-50" : "border-border"}`}>
                    <PageThumb index={page.index} rotation={page.rotation} src={thumbs[page.index]} onVisible={request}>
                      <span className="absolute left-1 top-1 rounded-sm bg-overlay px-1.5 py-0.5 text-[10px] tabular-nums text-foreground">{position + 1}</span>
                    </PageThumb>
                    <div className="mt-1.5 flex items-center justify-between gap-1">
                      {handle}
                      <span className="min-w-0 flex-1 truncate text-center text-[11px] text-foreground-subtle">
                        {t("conversion:tools.organize.page", { page: page.index + 1 })}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-center gap-0.5">
                      <IconButton label={t("conversion:tools.organize.rotateLeft")} disabled={page.deleted} onClick={() => update(pages.map((item) => item.id === page.id ? { ...item, rotation: rotate(item.rotation, -90) } : item))}>
                        <RotateCcw size={13} />
                      </IconButton>
                      <IconButton label={t("conversion:tools.organize.rotateRight")} disabled={page.deleted} onClick={() => update(pages.map((item) => item.id === page.id ? { ...item, rotation: rotate(item.rotation, 90) } : item))}>
                        <RotateCw size={13} />
                      </IconButton>
                      <IconButton
                        label={page.deleted ? t("conversion:tools.organize.restore") : t("conversion:tools.organize.delete")}
                        danger={!page.deleted}
                        active={page.deleted}
                        onClick={() => update(pages.map((item) => item.id === page.id ? { ...item, deleted: !item.deleted } : item))}
                      >
                        {page.deleted ? <Undo2 size={13} /> : <Trash2 size={13} />}
                      </IconButton>
                    </div>
                  </div>
                )}
              </SortableGrid>
            </>
          )}
        </ToolPanel>
      </main>

      <aside className="flex flex-none flex-col rounded-sm border border-border bg-surface/60 lg:min-h-0 lg:overflow-y-auto">
        <div className="border-b border-border px-5 py-4">
          <h2 className="font-semibold text-foreground">{t("conversion:tools.common.options")}</h2>
          {source && <p className="truncate text-xs text-foreground-subtle">{baseName(source.path)}</p>}
        </div>
        <div className="flex-1 space-y-6 p-5">
          <section className="space-y-2">
            <label className="block space-y-1 text-xs text-foreground-muted">
              <span>{t("conversion:tools.organize.rangeLabel")}</span>
              <div className="flex gap-2">
                <input
                  value={range}
                  disabled={!source}
                  onChange={(event) => { setRange(event.target.value); setRangeError(null); }}
                  onKeyDown={(event) => { if (event.key === "Enter") applyRange(); }}
                  placeholder={t("conversion:tools.organize.rangePlaceholder")}
                  className="h-9 min-w-0 flex-1 rounded-sm border border-border bg-background px-3 text-sm text-foreground outline-none placeholder:text-input-placeholder focus:border-primary disabled:opacity-50"
                />
                <ToolButton onClick={applyRange} disabled={!source || !range.trim()}>
                  {t("conversion:tools.organize.applyRange")}
                </ToolButton>
              </div>
            </label>
            <p className={`text-[11px] leading-snug ${rangeError ? "text-destructive" : "text-foreground-subtle"}`}>
              {rangeError ? t("conversion:tools.organize.invalidRange", { message: rangeError }) : t("conversion:tools.organize.rangeHint")}
            </p>
          </section>

          <section className="flex flex-wrap gap-2">
            <ToolButton onClick={() => update([...pages].reverse())} disabled={!source || pages.length < 2}>
              <ArrowUpDown size={14} />
              {t("conversion:tools.organize.reverse")}
            </ToolButton>
            <ToolButton onClick={() => source && update(initialPages(source.pageCount))} disabled={!source || pristine}>
              <Undo2 size={14} />
              {t("conversion:tools.organize.reset")}
            </ToolButton>
          </section>

          {source && kept.length === 0 && <p className="text-xs text-warning">{t("conversion:tools.organize.noPages")}</p>}
          <ToolRunStatus state={state} />
        </div>
        <div className="sticky bottom-0 border-t border-border bg-overlay p-4 backdrop-blur">
          <ToolButton variant="primary" fullWidth onClick={() => void handleRun()} disabled={!source || kept.length === 0 || running || pristine}>
            {running ? t("conversion:tools.common.running") : t("conversion:tools.organize.run")}
          </ToolButton>
        </div>
      </aside>

      <LibraryPickerDialog
        open={pickerOpen}
        books={libraryPdfs}
        title={t("conversion:tools.merge.pickerTitle")}
        description={t("conversion:tools.merge.pickerDescription")}
        onClose={() => setPickerOpen(false)}
        onSelect={(book) => {
          setPickerOpen(false);
          void openSource(book.filePath, `${getTitleWithoutExtension(book.title, book.fileType)}.pdf`, book.fileSize || 0);
        }}
      />
    </div>
  );
}
