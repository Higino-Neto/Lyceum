import { useCallback, useEffect, useRef, useState } from "react";
import { ImageIcon, LoaderCircle, RefreshCw, TriangleAlert } from "lucide-react";
import type { ConversionOptions } from "../../../contexts/ConversionQueueContext";
import type { BookWithThumbnail } from "../../../types/LibraryTypes";
import { useTranslation } from "../../../i18n/useTranslation";
import { formatFileSize } from "../../Library/utils";
import { NumberOption } from "./OptionControls";

type PreviewResponse = Awaited<ReturnType<typeof window.api.previewConversionPage>>;
type PreviewData = NonNullable<PreviewResponse["preview"]>;

const AUTO_REFRESH_DELAY_MS = 500;

function imageOptionsKey(options: ConversionOptions) {
  return JSON.stringify([
    options.imagePreset,
    options.imageMaxWidth,
    options.imageMaxHeight,
    options.imageQuality,
    options.imageGrayscale,
  ]);
}

function isFileOnlyBook(book: BookWithThumbnail) {
  return book.fileHash.startsWith("usb:") || book.fileHash.startsWith("mtp:");
}

export function ConversionPreview({ book, options }: { book: BookWithThumbnail; options: ConversionOptions }) {
  const { t } = useTranslation();
  const [pageNumber, setPageNumber] = useState(1);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const generate = useCallback(async (page: number) => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    const request = { pageIndex: page - 1, conversionOptions: optionsRef.current };
    try {
      const response = isFileOnlyBook(book)
        ? await window.api.previewConversionPageFile(book.filePath, request)
        : await window.api.previewConversionPage(book.fileHash, request);
      if (requestId !== requestIdRef.current) return; // a newer request superseded this one
      if (!response?.success || !response.preview) {
        setError(response?.error || t("conversion:preview.error"));
        return;
      }
      setPreview(response.preview);
      setPageCount(response.preview.pageCount);
      if (response.preview.pageIndex + 1 !== page) setPageNumber(response.preview.pageIndex + 1);
    } catch (caught) {
      if (requestId === requestIdRef.current) {
        setError(caught instanceof Error ? caught.message : t("conversion:preview.error"));
      }
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [book, t]);

  // Reset when switching books.
  useEffect(() => {
    requestIdRef.current += 1;
    setPreview(null);
    setPageCount(null);
    setPageNumber(1);
    setError(null);
    setLoading(false);
  }, [book.fileHash]);

  // Once a preview exists, keep it in sync with the image settings and the chosen page.
  const optionsKey = imageOptionsKey(options);
  const hasPreview = preview !== null;
  useEffect(() => {
    if (!hasPreview) return;
    const timer = window.setTimeout(() => void generate(pageNumber), AUTO_REFRESH_DELAY_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optionsKey, pageNumber]);

  const maxPage = Math.max(1, pageCount ?? 1);

  return (
    <div className="space-y-3 rounded-sm border border-border bg-background p-3">
      <div>
        <h4 className="text-sm font-semibold text-foreground">{t("conversion:preview.title")}</h4>
        <p className="mt-0.5 text-[11px] leading-snug text-foreground-subtle">{t("conversion:preview.description")}</p>
      </div>

      <div className="flex items-end gap-2">
        <div className="w-24 flex-none">
          <NumberOption
            label={t("conversion:preview.page")}
            value={pageNumber}
            min={1}
            max={pageCount ?? 99999}
            onChange={setPageNumber}
          />
        </div>
        {pageCount !== null && (
          <span className="pb-2 text-xs text-foreground-subtle">{t("conversion:preview.pageOf", { count: pageCount })}</span>
        )}
        <button
          type="button"
          disabled={loading}
          onClick={() => void generate(pageNumber)}
          className="ml-auto flex h-9 items-center gap-2 rounded-sm border border-border-strong bg-surface px-3 text-sm text-foreground hover:bg-surface-muted disabled:cursor-wait disabled:opacity-60"
        >
          {loading ? <LoaderCircle size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          {hasPreview ? t("conversion:preview.refresh") : t("conversion:preview.generate")}
        </button>
      </div>

      {pageCount !== null && pageCount > 1 && (
        <input
          type="range"
          min={1}
          max={maxPage}
          value={Math.min(pageNumber, maxPage)}
          onChange={(event) => setPageNumber(Number(event.target.value))}
          className="w-full accent-primary"
          aria-label={t("conversion:preview.page")}
        />
      )}

      <div className="relative flex min-h-48 items-center justify-center overflow-hidden rounded-sm border border-border bg-surface-muted">
        {preview ? (
          <img
            src={preview.dataUrl}
            alt={t("conversion:preview.alt", { page: preview.pageIndex + 1 })}
            className={`max-h-96 w-auto object-contain transition-opacity ${loading ? "opacity-50" : "opacity-100"}`}
          />
        ) : (
          <div className="flex flex-col items-center gap-2 p-6 text-center text-xs text-foreground-subtle">
            {loading ? <LoaderCircle size={22} className="animate-spin" /> : <ImageIcon size={22} />}
            <span>{loading ? t("conversion:preview.generating") : t("conversion:preview.description")}</span>
          </div>
        )}
      </div>

      {error && (
        <p className="flex items-start gap-2 text-xs text-destructive">
          <TriangleAlert size={14} className="mt-0.5 flex-none" />
          <span>{error}</span>
        </p>
      )}

      {preview && (
        <dl className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-sm bg-surface-muted px-2 py-1.5">
            <dt className="text-foreground-subtle">{t("conversion:preview.pageSize")}</dt>
            <dd className="font-semibold text-foreground">{formatFileSize(preview.bytes)}</dd>
            <dd className="text-[11px] text-foreground-subtle">
              {t("conversion:preview.dimensions", { width: preview.width, height: preview.height })}
              {preview.optimized && ` · ${t("conversion:preview.originalSize", { size: formatFileSize(preview.originalBytes) })}`}
            </dd>
          </div>
          {preview.estimatedTotalBytes > 0 && (
            <div className="rounded-sm bg-surface-muted px-2 py-1.5" title={t("conversion:preview.estimateHint")}>
              <dt className="text-foreground-subtle">{t("conversion:preview.estimatedTotal")}</dt>
              <dd className="font-semibold text-foreground">~{formatFileSize(preview.estimatedTotalBytes)}</dd>
              <dd className="text-[11px] text-foreground-subtle">
                {t("conversion:preview.originalSize", { size: formatFileSize(preview.sourceBytes) })}
              </dd>
            </div>
          )}
          {!preview.optimized && (
            <p className="col-span-2 text-[11px] text-foreground-subtle">{t("conversion:preview.unchanged")}</p>
          )}
        </dl>
      )}
    </div>
  );
}
