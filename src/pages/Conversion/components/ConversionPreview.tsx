import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ChevronLeft, ChevronRight, Eye, LoaderCircle, Maximize2, RefreshCw, TriangleAlert, X } from "lucide-react";
import type { ConversionOptions, ConversionOutputFormat } from "../../../contexts/ConversionQueueContext";
import type { BookWithThumbnail } from "../../../types/LibraryTypes";
import { useTranslation } from "../../../i18n/useTranslation";
import { isPathBasedBook } from "../../../utils/localBooks";
import { computeGlobalPage, estimateTotalPages, type Position } from "./previewPaging";

type PreviewResponse = Awaited<ReturnType<typeof window.api.previewConversionOutput>>;
type PreviewData = NonNullable<PreviewResponse["preview"]>;

const AUTO_REFRESH_DELAY_MS = 600;
/** Asks the backend for "the last page" of a segment (it clamps the value). */
const LAST_PAGE = 100_000;

/**
 * Shows the real converted output: one chapter (or comic page) is exported
 * with the current options and rendered as a final PDF page or e-reader
 * screen. Navigation is by final page; chapters are crossed automatically.
 */
export function ConversionPreview({ book, targetFormat, options }: {
  book: BookWithThumbnail;
  targetFormat: ConversionOutputFormat;
  options: ConversionOptions;
}) {
  const { t } = useTranslation();
  const [position, setPosition] = useState<Position>({ segment: 1, page: 1 });
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [pageCounts, setPageCounts] = useState<Map<number, number>>(() => new Map());
  const [loading, setLoading] = useState(false);
  const [seeking, setSeeking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enlarged, setEnlarged] = useState(false);
  const [pageInput, setPageInput] = useState("");
  const requestIdRef = useRef(0);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const request = useCallback(async (segment: number, page: number) => {
    const payload = { targetFormat, conversionOptions: optionsRef.current, segmentIndex: segment - 1, page };
    return isPathBasedBook(book)
      ? window.api.previewConversionOutputFile(book.filePath, payload)
      : window.api.previewConversionOutput(book.fileHash, payload);
  }, [book, targetFormat]);

  const rememberCount = useCallback((data: PreviewData) => {
    setPageCounts((current) => {
      const segment = data.segmentIndex + 1;
      if (current.get(segment) === data.pageCount) return current;
      const next = new Map(current);
      next.set(segment, data.pageCount);
      return next;
    });
  }, []);

  const generate = useCallback(async (target: Position) => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const response = await request(target.segment, target.page);
      if (requestId !== requestIdRef.current) return; // a newer request superseded this one
      if (!response?.success || !response.preview) {
        setError(response?.error || t("conversion:preview.error"));
        return;
      }
      const data = response.preview;
      setPreview(data);
      rememberCount(data);
      const actual = { segment: data.segmentIndex + 1, page: data.page };
      if (actual.segment !== target.segment || actual.page !== target.page) setPosition(actual);
    } catch (caught) {
      if (requestId === requestIdRef.current) setError(caught instanceof Error ? caught.message : t("conversion:preview.error"));
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [rememberCount, request, t]);

  // Reset when switching books or output format.
  useEffect(() => {
    requestIdRef.current += 1;
    setPreview(null);
    setPosition({ segment: 1, page: 1 });
    setPageCounts(new Map());
    setError(null);
    setLoading(false);
    setSeeking(false);
  }, [book.fileHash, targetFormat]);

  // Layout options change page counts: forget what was measured.
  const optionsKey = JSON.stringify(options);
  useEffect(() => {
    setPageCounts(new Map());
  }, [optionsKey]);

  // Once a preview exists, keep it in sync with every option and with navigation.
  const started = preview !== null || loading;
  useEffect(() => {
    if (preview === null) return;
    const timer = window.setTimeout(() => void generate(position), AUTO_REFRESH_DELAY_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optionsKey, position.segment, position.page]);

  const segmentCount = preview?.segmentCount ?? 0;
  const currentCount = pageCounts.get(position.segment) ?? preview?.pageCount ?? 1;
  const globalPage = useMemo(() => computeGlobalPage(position, pageCounts), [position, pageCounts]);
  const totals = useMemo(() => estimateTotalPages(pageCounts, segmentCount), [pageCounts, segmentCount]);
  const atStart = position.segment <= 1 && position.page <= 1;
  const atEnd = position.segment >= segmentCount && position.page >= currentCount;

  const goNext = useCallback(() => {
    setPosition((current) => {
      const count = pageCounts.get(current.segment) ?? preview?.pageCount ?? 1;
      if (current.page < count) return { ...current, page: current.page + 1 };
      if (current.segment < segmentCount) return { segment: current.segment + 1, page: 1 };
      return current;
    });
  }, [pageCounts, preview?.pageCount, segmentCount]);

  const goPrevious = useCallback(() => {
    setPosition((current) => {
      if (current.page > 1) return { ...current, page: current.page - 1 };
      if (current.segment > 1) {
        const previous = current.segment - 1;
        return { segment: previous, page: pageCounts.get(previous) ?? LAST_PAGE };
      }
      return current;
    });
  }, [pageCounts]);

  /** Walks chapters (measuring unknown ones) until the requested final page. */
  const seekTo = useCallback(async (target: number) => {
    if (!preview || target < 1) return;
    setSeeking(true);
    setError(null);
    const counts = new Map(pageCounts);
    let offset = 0;
    try {
      for (let segment = 1; segment <= preview.segmentCount; segment += 1) {
        let count = counts.get(segment);
        if (count === undefined) {
          const response = await request(segment, 1);
          if (!response?.success || !response.preview) throw new Error(response?.error || t("conversion:preview.error"));
          count = response.preview.pageCount;
          counts.set(segment, count);
        }
        if (offset + count >= target || segment === preview.segmentCount) {
          setPageCounts(counts);
          setPosition({ segment, page: Math.min(count, Math.max(1, target - offset)) });
          return;
        }
        offset += count;
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("conversion:preview.error"));
    } finally {
      setSeeking(false);
    }
  }, [pageCounts, preview, request, t]);

  const submitPage = (event: FormEvent) => {
    event.preventDefault();
    const value = Number.parseInt(pageInput, 10);
    setPageInput("");
    if (Number.isFinite(value)) void seekTo(value);
  };

  useEffect(() => {
    if (!enlarged) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setEnlarged(false);
      } else if (event.key === "ArrowRight" || event.key === "PageDown") {
        event.preventDefault();
        goNext();
      } else if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        goPrevious();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [enlarged, goNext, goPrevious]);

  if (targetFormat === "lyceum") return null;

  const busy = loading || seeking;
  const pageLabel = globalPage !== null
    ? t("conversion:preview.pageOf", {
        page: globalPage,
        total: totals.exact ? totals.total : `~${totals.total}`,
      })
    : t("conversion:preview.chapterPage", { chapter: position.segment, page: position.page });

  const pager = (variant: "inline" | "overlay") => (
    <div className={`flex items-center gap-1 ${variant === "overlay" ? "rounded-sm bg-overlay px-1 py-1 shadow-lg" : ""}`}>
      <button
        type="button"
        onClick={goPrevious}
        disabled={busy || atStart}
        className="inline-flex h-8 w-8 items-center justify-center rounded-sm text-foreground-muted hover:bg-surface-muted hover:text-foreground disabled:opacity-30"
        aria-label={t("conversion:preview.previousPage")}
        title={t("conversion:preview.previousPage")}
      >
        <ChevronLeft size={16} />
      </button>
      <span className="min-w-0 flex-1 px-1 text-center text-xs tabular-nums text-foreground">{pageLabel}</span>
      <button
        type="button"
        onClick={goNext}
        disabled={busy || atEnd}
        className="inline-flex h-8 w-8 items-center justify-center rounded-sm text-foreground-muted hover:bg-surface-muted hover:text-foreground disabled:opacity-30"
        aria-label={t("conversion:preview.nextPage")}
        title={t("conversion:preview.nextPage")}
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );

  return (
    <div className="space-y-3 rounded-sm border border-border bg-background p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <Eye size={14} className="text-primary" />
            {t("conversion:preview.title")}
          </h4>
          <p className="mt-0.5 text-[11px] leading-snug text-foreground-subtle">{t("conversion:preview.description", { format: targetFormat.toUpperCase() })}</p>
        </div>
        {preview && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void generate(position)}
            className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-sm text-foreground-muted hover:bg-surface-muted hover:text-foreground disabled:opacity-40"
            title={t("conversion:preview.refresh")}
            aria-label={t("conversion:preview.refresh")}
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : undefined} />
          </button>
        )}
      </div>

      {!started ? (
        <button
          type="button"
          onClick={() => void generate({ segment: 1, page: 1 })}
          className="flex h-24 w-full flex-col items-center justify-center gap-1.5 rounded-sm border-2 border-dashed border-border-strong text-xs text-foreground-muted hover:border-primary hover:text-foreground"
        >
          <Eye size={18} />
          <span className="font-medium">{t("conversion:preview.generate")}</span>
          <span className="text-[11px] text-foreground-subtle">{t("conversion:preview.firstRunHint")}</span>
        </button>
      ) : (
        <>
          {preview && (
            <div className="space-y-1.5 rounded-sm border border-border bg-surface p-1.5">
              {pager("inline")}
              <form onSubmit={submitPage} className="flex items-center gap-2 px-1">
                <label htmlFor="conversion-preview-page" className="text-[11px] text-foreground-subtle">
                  {t("conversion:preview.goToPage")}
                </label>
                <input
                  id="conversion-preview-page"
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={pageInput}
                  onChange={(event) => setPageInput(event.target.value)}
                  placeholder={globalPage ? String(globalPage) : "1"}
                  className="h-7 w-20 rounded-sm border border-border-strong bg-background px-2 text-xs tabular-nums text-foreground outline-none focus:border-primary"
                />
                <button
                  type="submit"
                  disabled={busy || !pageInput}
                  className="h-7 rounded-sm border border-border px-2 text-xs text-foreground-muted hover:bg-surface-muted hover:text-foreground disabled:opacity-40"
                >
                  {t("conversion:preview.go")}
                </button>
              </form>
              {preview.segmentTitle && preview.segmentKind === "chapter" && (
                <p className="truncate px-1 text-[11px] text-foreground-subtle" title={preview.segmentTitle}>
                  {t("conversion:preview.inChapter", { title: preview.segmentTitle })}
                </p>
              )}
            </div>
          )}

          <div className="relative flex min-h-64 items-center justify-center overflow-hidden rounded-sm bg-surface-muted p-3">
            {preview ? (
              <button
                type="button"
                onClick={() => setEnlarged(true)}
                className="group relative cursor-zoom-in"
                title={t("conversion:preview.enlarge")}
              >
                <img
                  src={preview.dataUrl}
                  alt={t("conversion:preview.alt", { page: globalPage ?? preview.page })}
                  className={`max-h-[26rem] w-auto bg-white object-contain shadow-lg ring-1 ring-border transition-opacity ${busy ? "opacity-40" : "opacity-100"}`}
                />
                <span className="absolute right-1.5 top-1.5 rounded-sm bg-overlay p-1 text-foreground opacity-0 transition-opacity group-hover:opacity-100">
                  <Maximize2 size={13} />
                </span>
              </button>
            ) : null}
            {busy && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-xs text-foreground-muted">
                <LoaderCircle size={22} className="animate-spin text-primary" />
                <span>
                  {seeking
                    ? t("conversion:preview.seeking")
                    : preview ? t("conversion:preview.updating") : t("conversion:preview.generating")}
                </span>
              </div>
            )}
          </div>

          {preview && (
            <p className="text-center text-[11px] text-foreground-subtle">
              {preview.viewport.label}
              {preview.approximate && ` · ${t("conversion:preview.approximate")}`}
              {!totals.exact && ` · ${t("conversion:preview.totalEstimated")}`}
            </p>
          )}
        </>
      )}

      {error && (
        <p className="flex items-start gap-2 text-xs text-destructive" role="alert">
          <TriangleAlert size={14} className="mt-0.5 flex-none" />
          <span>{error}</span>
        </p>
      )}

      {enlarged && preview && (
        <div
          className="fixed inset-0 z-[120] flex flex-col items-center justify-center gap-3 bg-backdrop p-6"
          role="dialog"
          aria-modal="true"
          aria-label={t("conversion:preview.title")}
          onMouseDown={() => setEnlarged(false)}
        >
          <img
            src={preview.dataUrl}
            alt={t("conversion:preview.alt", { page: globalPage ?? preview.page })}
            className={`min-h-0 max-w-full flex-1 bg-white object-contain shadow-2xl transition-opacity ${busy ? "opacity-50" : ""}`}
            onMouseDown={(event) => event.stopPropagation()}
          />
          <div className="w-72 max-w-full" onMouseDown={(event) => event.stopPropagation()}>
            {pager("overlay")}
          </div>
          <button
            type="button"
            onClick={() => setEnlarged(false)}
            className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-sm bg-overlay text-foreground hover:bg-surface-muted"
            aria-label={t("conversion:dialog.closeAriaLabel")}
          >
            <X size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
