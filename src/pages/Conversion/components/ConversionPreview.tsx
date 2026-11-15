import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Eye, LoaderCircle, Maximize2, RefreshCw, TriangleAlert, X } from "lucide-react";
import type { ConversionOptions, ConversionOutputFormat } from "../../../contexts/ConversionQueueContext";
import type { BookWithThumbnail } from "../../../types/LibraryTypes";
import { useTranslation } from "../../../i18n/useTranslation";
import { isPathBasedBook } from "../../../utils/localBooks";

type PreviewResponse = Awaited<ReturnType<typeof window.api.previewConversionOutput>>;
type PreviewData = NonNullable<PreviewResponse["preview"]>;

const AUTO_REFRESH_DELAY_MS = 600;

function Stepper({ label, value, count, onChange, disabled }: {
  label: string;
  value: number;
  count: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        disabled={disabled || value <= 1}
        className="inline-flex h-7 w-7 items-center justify-center rounded-sm text-foreground-muted hover:bg-surface-muted hover:text-foreground disabled:opacity-30"
        aria-label={t("conversion:preview.previous", { label })}
        title={t("conversion:preview.previous", { label })}
      >
        <ChevronLeft size={15} />
      </button>
      <span className="min-w-0 flex-1 text-center text-xs tabular-nums text-foreground">
        {label} {value} <span className="text-foreground-subtle">/ {count}</span>
      </span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        disabled={disabled || value >= count}
        className="inline-flex h-7 w-7 items-center justify-center rounded-sm text-foreground-muted hover:bg-surface-muted hover:text-foreground disabled:opacity-30"
        aria-label={t("conversion:preview.next", { label })}
        title={t("conversion:preview.next", { label })}
      >
        <ChevronRight size={15} />
      </button>
    </div>
  );
}

/**
 * Shows the real converted output: one chapter (or comic page) is exported
 * with the current options and rendered as a final PDF page or e-reader screen.
 */
export function ConversionPreview({ book, targetFormat, options }: {
  book: BookWithThumbnail;
  targetFormat: ConversionOutputFormat;
  options: ConversionOptions;
}) {
  const { t } = useTranslation();
  const [segment, setSegment] = useState(1);
  const [page, setPage] = useState(1);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enlarged, setEnlarged] = useState(false);
  const requestIdRef = useRef(0);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const generate = useCallback(async (segmentNumber: number, pageNumber: number) => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    const request = { targetFormat, conversionOptions: optionsRef.current, segmentIndex: segmentNumber - 1, page: pageNumber };
    try {
      const response = isPathBasedBook(book)
        ? await window.api.previewConversionOutputFile(book.filePath, request)
        : await window.api.previewConversionOutput(book.fileHash, request);
      if (requestId !== requestIdRef.current) return; // a newer request superseded this one
      if (!response?.success || !response.preview) {
        setError(response?.error || t("conversion:preview.error"));
        return;
      }
      setPreview(response.preview);
      if (response.preview.segmentIndex + 1 !== segmentNumber) setSegment(response.preview.segmentIndex + 1);
      if (response.preview.page !== pageNumber) setPage(response.preview.page);
    } catch (caught) {
      if (requestId === requestIdRef.current) setError(caught instanceof Error ? caught.message : t("conversion:preview.error"));
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [book, targetFormat, t]);

  // Reset when switching books or output format.
  useEffect(() => {
    requestIdRef.current += 1;
    setPreview(null);
    setSegment(1);
    setPage(1);
    setError(null);
    setLoading(false);
  }, [book.fileHash, targetFormat]);

  // Once a preview exists, keep it in sync with every option and with navigation.
  const optionsKey = JSON.stringify(options);
  const started = preview !== null || loading;
  useEffect(() => {
    if (preview === null) return;
    const timer = window.setTimeout(() => void generate(segment, page), AUTO_REFRESH_DELAY_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optionsKey, segment, page]);

  useEffect(() => {
    if (!enlarged) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setEnlarged(false);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [enlarged]);

  if (targetFormat === "lyceum") return null;

  const segmentLabel = preview?.segmentKind === "page" ? t("conversion:preview.sourcePage") : t("conversion:preview.chapter");

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
            disabled={loading}
            onClick={() => void generate(segment, page)}
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
          onClick={() => void generate(1, 1)}
          className="flex h-24 w-full flex-col items-center justify-center gap-1.5 rounded-sm border-2 border-dashed border-border-strong text-xs text-foreground-muted hover:border-primary hover:text-foreground"
        >
          <Eye size={18} />
          <span className="font-medium">{t("conversion:preview.generate")}</span>
          <span className="text-[11px] text-foreground-subtle">{t("conversion:preview.firstRunHint")}</span>
        </button>
      ) : (
        <>
          {preview && (
            <div className="space-y-1 rounded-sm border border-border bg-surface p-1.5">
              <Stepper
                label={segmentLabel}
                value={segment}
                count={preview.segmentCount}
                disabled={loading}
                onChange={(value) => {
                  setSegment(value);
                  setPage(1);
                }}
              />
              {preview.segmentTitle && preview.segmentKind === "chapter" && (
                <p className="truncate px-1 text-center text-[11px] text-foreground-subtle" title={preview.segmentTitle}>{preview.segmentTitle}</p>
              )}
              {preview.pageCount > 1 && (
                <Stepper label={t("conversion:preview.page")} value={page} count={preview.pageCount} disabled={loading} onChange={setPage} />
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
                  alt={t("conversion:preview.alt", { page: preview.page })}
                  className={`max-h-[26rem] w-auto bg-white object-contain shadow-lg ring-1 ring-border transition-opacity ${loading ? "opacity-40" : "opacity-100"}`}
                />
                <span className="absolute right-1.5 top-1.5 rounded-sm bg-overlay p-1 text-foreground opacity-0 transition-opacity group-hover:opacity-100">
                  <Maximize2 size={13} />
                </span>
              </button>
            ) : null}
            {loading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-xs text-foreground-muted">
                <LoaderCircle size={22} className="animate-spin text-primary" />
                <span>{preview ? t("conversion:preview.updating") : t("conversion:preview.generating")}</span>
              </div>
            )}
          </div>

          {preview && (
            <p className="text-center text-[11px] text-foreground-subtle">
              {preview.viewport.label}
              {preview.approximate && ` · ${t("conversion:preview.approximate")}`}
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
          className="fixed inset-0 z-[120] flex items-center justify-center bg-backdrop p-6"
          role="dialog"
          aria-modal="true"
          aria-label={t("conversion:preview.title")}
          onMouseDown={() => setEnlarged(false)}
        >
          <img
            src={preview.dataUrl}
            alt={t("conversion:preview.alt", { page: preview.page })}
            className="max-h-full max-w-full bg-white object-contain shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          />
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
