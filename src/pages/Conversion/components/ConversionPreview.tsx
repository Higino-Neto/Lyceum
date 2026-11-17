import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Eye, HardDrive, Layers, LoaderCircle, Maximize2, RefreshCw, SlidersHorizontal, TriangleAlert, X } from "lucide-react";
import type { ConversionOptions, ConversionOutputFormat } from "../../../contexts/ConversionQueueContext";
import type { BookWithThumbnail } from "../../../types/LibraryTypes";
import { useTranslation } from "../../../i18n/useTranslation";
import { formatNumber, getActiveLocale } from "../../../i18n";
import { isPathBasedBook } from "../../../utils/localBooks";
import { formatFileSize } from "../../Library/utils";
import { isEditableTarget } from "../../../utils/fileClipboardShortcuts";
import { estimateGlobalPage, estimateOutputBytes, estimateTotalPages, sampleSegments, type Position } from "./previewPaging";

type PreviewResponse = Awaited<ReturnType<typeof window.api.previewConversionOutput>>;
type PreviewData = NonNullable<PreviewResponse["preview"]>;

const AUTO_REFRESH_DELAY_MS = 600;
/** Asks the backend for "the last page" of a segment (it clamps the value). */
const LAST_PAGE = 100_000;
/** Gives the visible page priority before chapters are measured in the background. */
const MEASURE_START_DELAY_MS = 500;
/** Comic pages are one output page each: only a sample is exported to estimate the size. */
const COMIC_SIZE_SAMPLES = 6;

/**
 * Shows the real converted output: one chapter (or comic page) is exported
 * with the current options and rendered as a final PDF page or e-reader
 * screen. Navigation is by final page; chapters are crossed automatically.
 */
export function ConversionPreview({ book, targetFormat, options, settings }: {
  book: BookWithThumbnail;
  targetFormat: ConversionOutputFormat;
  options: ConversionOptions;
  /** Conversion settings shown next to the enlarged page, so changes are seen immediately. */
  settings?: ReactNode;
}) {
  const { t } = useTranslation();
  const [position, setPosition] = useState<Position>({ segment: 1, page: 1 });
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [pageCounts, setPageCounts] = useState<Map<number, number>>(() => new Map());
  const [segmentBytes, setSegmentBytes] = useState<Map<number, number>>(() => new Map());
  const [measuring, setMeasuring] = useState(false);
  const [loading, setLoading] = useState(false);
  const [seeking, setSeeking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enlarged, setEnlarged] = useState(false);
  const [pageInput, setPageInput] = useState("");
  const requestIdRef = useRef(0);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const optionsKey = JSON.stringify(options);
  const optionsKeyRef = useRef(optionsKey);
  optionsKeyRef.current = optionsKey;
  const pageCountsRef = useRef(pageCounts);
  pageCountsRef.current = pageCounts;
  const segmentBytesRef = useRef(segmentBytes);
  segmentBytesRef.current = segmentBytes;

  const request = useCallback(async (segment: number, page: number, measureOnly = false) => {
    const payload = { targetFormat, conversionOptions: optionsRef.current, segmentIndex: segment - 1, page, measureOnly };
    return isPathBasedBook(book)
      ? window.api.previewConversionOutputFile(book.filePath, payload)
      : window.api.previewConversionOutput(book.fileHash, payload);
  }, [book, targetFormat]);

  /** Records what a segment measured, unless the options changed while it was being exported. */
  const rememberCount = useCallback((data: PreviewData, requestedWith: string) => {
    if (requestedWith !== optionsKeyRef.current) return;
    const segment = data.segmentIndex + 1;
    setPageCounts((current) => {
      if (current.get(segment) === data.pageCount) return current;
      const next = new Map(current);
      next.set(segment, data.pageCount);
      return next;
    });
    if (data.outputBytes > 0) {
      setSegmentBytes((current) => {
        if (current.get(segment) === data.outputBytes) return current;
        const next = new Map(current);
        next.set(segment, data.outputBytes);
        return next;
      });
    }
  }, []);

  const generate = useCallback(async (target: Position) => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    const requestedWith = optionsKeyRef.current;
    try {
      const response = await request(target.segment, target.page);
      if (requestId !== requestIdRef.current) return; // a newer request superseded this one
      if (!response?.success || !response.preview) {
        setError(response?.error || t("conversion:preview.error"));
        return;
      }
      const data = response.preview;
      setPreview(data);
      rememberCount(data, requestedWith);
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
    setSegmentBytes(new Map());
    setError(null);
    setLoading(false);
    setSeeking(false);
  }, [book.fileHash, targetFormat]);

  // Layout options change page counts and sizes: forget what was measured.
  useEffect(() => {
    setPageCounts(new Map());
    setSegmentBytes(new Map());
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
  const segmentKind = preview?.segmentKind ?? "chapter";
  const hasPreview = preview !== null;

  // Measure every chapter in the background so the final page count (and the
  // output size) are known without the user walking through the book.
  useEffect(() => {
    if (!hasPreview || segmentCount <= 0) return;
    let cancelled = false;
    const requestedWith = optionsKeyRef.current;
    const timer = window.setTimeout(() => {
      void (async () => {
        let targets: number[];
        if (segmentKind === "page") {
          // One comic page always becomes one output page.
          setPageCounts((current) => {
            if (current.size === segmentCount) return current;
            return new Map(Array.from({ length: segmentCount }, (_, index) => [index + 1, 1] as const));
          });
          targets = sampleSegments(segmentCount, COMIC_SIZE_SAMPLES).filter((segment) => !segmentBytesRef.current.has(segment));
        } else {
          targets = Array.from({ length: segmentCount }, (_, index) => index + 1)
            .filter((segment) => !pageCountsRef.current.has(segment) || !segmentBytesRef.current.has(segment));
        }
        if (targets.length === 0) return;
        setMeasuring(true);
        try {
          for (const segment of targets) {
            if (cancelled) return;
            const response = await request(segment, 1, true).catch(() => null);
            if (cancelled) return;
            if (response?.success && response.preview) rememberCount(response.preview, requestedWith);
          }
        } finally {
          if (!cancelled) setMeasuring(false);
        }
      })();
    }, MEASURE_START_DELAY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      setMeasuring(false);
    };
  }, [hasPreview, optionsKey, rememberCount, request, segmentCount, segmentKind]);

  const currentCount = pageCounts.get(position.segment) ?? preview?.pageCount ?? 1;
  const globalPosition = useMemo(() => estimateGlobalPage(position, pageCounts), [position, pageCounts]);
  const globalPage = globalPosition.exact ? globalPosition.page : null;
  const totals = useMemo(() => estimateTotalPages(pageCounts, segmentCount), [pageCounts, segmentCount]);
  const sizeEstimate = useMemo(
    () => estimateOutputBytes(segmentBytes, segmentCount, segmentKind),
    [segmentBytes, segmentCount, segmentKind],
  );
  const measuredSegments = segmentKind === "page" ? segmentBytes.size : pageCounts.size;
  const measureTarget = segmentKind === "page" ? Math.min(segmentCount, COMIC_SIZE_SAMPLES) : segmentCount;
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
          rememberCount(response.preview, optionsKeyRef.current);
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
  }, [pageCounts, preview, rememberCount, request, t]);

  const submitPage = (event: FormEvent) => {
    event.preventDefault();
    const value = Number.parseInt(pageInput, 10);
    setPageInput("");
    if (Number.isFinite(value)) void seekTo(value);
  };

  useEffect(() => {
    if (!enlarged) return;
    const onKey = (event: KeyboardEvent) => {
      // Arrow keys belong to sliders and fields of the settings panel.
      if (event.key !== "Escape" && isEditableTarget(event.target)) return;
      if (event.key === "Escape") {
        // Let an open dropdown close first.
        if (document.querySelector("[role='listbox']")) return;
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
  const formatCount = (value: number) => formatNumber(value, getActiveLocale());
  const totalLabel = totals.exact ? formatCount(totals.total) : `~${formatCount(totals.total)}`;
  const pageLabel = t("conversion:preview.pageOf", {
    page: globalPosition.exact ? globalPosition.page : `~${globalPosition.page}`,
    total: totalLabel,
  });
  const sourceBytes = book.fileSize || 0;
  const sizeDelta = sizeEstimate && sourceBytes > 0
    ? Math.round(((sizeEstimate.bytes - sourceBytes) / sourceBytes) * 100)
    : null;

  const stats = (
    <dl className="grid grid-cols-2 gap-2">
      <div className="min-w-0 rounded-sm border border-border bg-surface px-2.5 py-2">
        <dt className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-foreground-subtle">
          <Layers size={11} />
          {t("conversion:preview.finalPages")}
        </dt>
        <dd className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">{segmentCount > 0 ? totalLabel : "—"}</dd>
      </div>
      <div className="min-w-0 rounded-sm border border-border bg-surface px-2.5 py-2">
        <dt className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-foreground-subtle">
          <HardDrive size={11} />
          {t("conversion:preview.estimatedSize")}
        </dt>
        <dd className="mt-0.5 truncate text-sm font-semibold tabular-nums text-foreground">
          {sizeEstimate ? `≈ ${formatFileSize(sizeEstimate.bytes)}` : "—"}
        </dd>
        {sizeDelta !== null && (
          <dd className={`truncate text-[10px] tabular-nums ${sizeDelta <= 0 ? "text-primary" : "text-foreground-subtle"}`}>
            {t("conversion:preview.vsOriginal", {
              delta: `${sizeDelta > 0 ? "+" : ""}${sizeDelta}%`,
              size: formatFileSize(sourceBytes),
            })}
          </dd>
        )}
      </div>
      {(measuring || (!totals.exact && segmentCount > 0)) && (
        <p className="col-span-2 flex items-center gap-1.5 text-[10px] text-foreground-subtle" aria-live="polite">
          {measuring && <LoaderCircle size={11} className="animate-spin text-primary" />}
          {measuring
            ? t("conversion:preview.measuring", { done: Math.min(measuredSegments, measureTarget), total: measureTarget })
            : t("conversion:preview.totalEstimated")}
        </p>
      )}
      {segmentKind === "page" && sizeEstimate && !sizeEstimate.exact && !measuring && (
        <p className="col-span-2 text-[10px] text-foreground-subtle">{t("conversion:preview.sizeSampled", { count: segmentBytes.size })}</p>
      )}
    </dl>
  );

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
            </p>
          )}

          {preview && stats}
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
          className="fixed inset-0 z-[120] flex bg-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={t("conversion:preview.title")}
          onMouseDown={() => setEnlarged(false)}
        >
          <div className="relative flex min-w-0 flex-1 flex-col items-center justify-center gap-3 p-6">
            <img
              src={preview.dataUrl}
              alt={t("conversion:preview.alt", { page: globalPage ?? preview.page })}
              className={`min-h-0 max-w-full flex-1 bg-white object-contain shadow-2xl transition-opacity ${busy ? "opacity-50" : ""}`}
              onMouseDown={(event) => event.stopPropagation()}
            />
            {busy && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <LoaderCircle size={26} className="animate-spin text-primary" />
              </div>
            )}
            <div className="w-72 max-w-full" onMouseDown={(event) => event.stopPropagation()}>
              {pager("overlay")}
            </div>
            <button
              type="button"
              onClick={() => setEnlarged(false)}
              className="absolute left-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-sm bg-overlay text-foreground hover:bg-surface-muted"
              aria-label={t("conversion:dialog.closeAriaLabel")}
            >
              <X size={18} />
            </button>
          </div>
          {settings && (
            <aside
              className="flex w-[22rem] max-w-[45vw] flex-none flex-col border-l border-border bg-surface shadow-2xl"
              onMouseDown={(event) => event.stopPropagation()}
              aria-label={t("conversion:preview.settings")}
            >
              <div className="flex items-center gap-2 border-b border-border px-5 py-4">
                <SlidersHorizontal size={15} className="text-primary" />
                <h3 className="text-sm font-semibold text-foreground">{t("conversion:preview.settings")}</h3>
              </div>
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
                {stats}
                {settings}
              </div>
            </aside>
          )}
        </div>
      )}
    </div>
  );
}
