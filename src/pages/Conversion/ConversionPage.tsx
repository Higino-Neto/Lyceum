import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BookOpen,
  Check,
  CircleAlert,
  CircleCheck,
  Clock3,
  FilePlus,
  FileText,
  HardDrive,
  Folder,
  FolderOpen,
  Info,
  ListTree,
  
  Search,
  Send,
  Square,
  
  Trash2,
  X,
} from "lucide-react";
import {
  canConvertBook,
  useConversionQueue,
  type ConversionOutputFormat,
  type ConversionProfile,
  type ConversionQueueItem,
  type BookConversionConfig,
  type ConversionOptions,
  defaultConversionOptions,
} from "../../contexts/ConversionQueueContext";
import { BookWithThumbnail } from "../../types/LibraryTypes";
import { fetchAllLibraryBooks } from "../../components/library/fetchAllLibraryBooks";
import {
  formatFileSize,
  getBookFolderLabel,
  getFileTypeLabel,
  getTitleWithoutExtension,
} from "../Library/utils";
import { useLazyThumbnail } from "../Library/components/BookGrid/useLazyThumbnail";
import Select from "../../components/ui/Select";
import { useTranslation } from "../../i18n/useTranslation";
import { formatNumber, getActiveLocale, normalizeCase, type TranslationKey } from "../../i18n";
import { LibraryPickerDialog } from "../../components/library/LibraryPickerDialog";
import { NumberOption, RangeOption, ToggleOption } from "./components/OptionControls";
import { translateConversionMessage } from "../../features/conversion/conversionMessages";
import { PDF_LAYOUT_PRESETS, PDF_LAYOUT_PRESET_IDS, matchPdfLayoutPreset } from "./pdfLayoutPresets";
import { ImageOptions } from "./components/ImageOptions";
import { ConversionPreview } from "./components/ConversionPreview";
import { IMAGE_BEARING_SOURCE_FORMATS } from "../../lib/lyceum/images/imagePresets";
import { createLocalBook } from "../../utils/localBooks";
import toast from "react-hot-toast";
import {
  KINDLE_NATIVE_FORMATS,
  canSendToKindle,
  getKindleBookFormat,
  loadKindleConversionOptions,
  saveKindleConversionOptions,
} from "../../features/kindle/kindleConversion";

const outputFormats: {
  value: ConversionOutputFormat;
  descriptionKey: TranslationKey;
}[] = [
  { value: "epub", descriptionKey: "conversion:formats.epub" },
  { value: "pdf", descriptionKey: "conversion:formats.pdf" },
  { value: "azw3", descriptionKey: "conversion:formats.azw3" },
  { value: "kfx", descriptionKey: "conversion:formats.kfx" },
  { value: "lyceum", descriptionKey: "conversion:formats.lyceum" },
  { value: "txt", descriptionKey: "conversion:formats.txt" },
  { value: "html", descriptionKey: "conversion:formats.html" },
];

function bookKey(book: BookWithThumbnail) {
  return `${book.fileHash}:${book.filePath}`;
}

const STATUS_LABEL_KEYS = {
  done: "conversion:status.done",
  error: "conversion:status.failed",
  canceled: "conversion:status.canceled",
  running: "conversion:status.running",
  pending: "conversion:status.pending",
} as const satisfies Record<ConversionQueueItem["status"], TranslationKey>;

function statusLabel(item: ConversionQueueItem): TranslationKey {
  if (item.status === "error") return "conversion:status.failed";
  return STATUS_LABEL_KEYS[item.status];
}

function Cover({ book }: { book: BookWithThumbnail }) {
  const { thumbnail, thumbnailRef } = useLazyThumbnail(book);
  if (thumbnail) {
    return (
      <div ref={thumbnailRef} className="h-20 w-14 flex-shrink-0 overflow-hidden rounded-sm">
        <img src={thumbnail} alt={book.title} className="h-full w-full object-cover" />
      </div>
    );
  }

  return (
    <div className="flex h-20 w-14 flex-shrink-0 items-center justify-center rounded-sm border border-border bg-background text-foreground-subtle">
      <FileText size={18} />
    </div>
  );
}

function MiniCover({ book }: { book: BookWithThumbnail }) {
  const { thumbnail, thumbnailRef } = useLazyThumbnail(book);
  if (thumbnail) {
    return (
      <div ref={thumbnailRef} className="h-10 w-7 flex-shrink-0 overflow-hidden rounded-sm">
        <img src={thumbnail} alt={book.title} className="h-full w-full object-cover" />
      </div>
    );
  }

  return (
    <div className="flex h-10 w-7 flex-shrink-0 items-center justify-center rounded-sm bg-surface-muted text-foreground-subtle">
      <FileText size={13} />
    </div>
  );
}

const IMAGE_AWARE_TARGETS = new Set<ConversionOutputFormat>(["epub", "pdf", "azw3", "kfx"]);

/** Mirrors the main process default: "<original name>-convertido". */
function defaultOutputBaseName(book: BookWithThumbnail) {
  const fileName = (book.filePath || book.fileName || book.title || "").split(/[\\/]/).pop() || "";
  return `${fileName.replace(/\.[^.]+$/, "") || book.title}-convertido`;
}

function sourceFormatOf(book: BookWithThumbnail) {
  return (book.fileType || book.filePath.split(".").pop() || "").toLowerCase();
}

function supportsImageOptions(book: BookWithThumbnail, target: ConversionOutputFormat) {
  return IMAGE_BEARING_SOURCE_FORMATS.has(sourceFormatOf(book)) && IMAGE_AWARE_TARGETS.has(target);
}

function TextOptionsHiddenNote() {
  const { t } = useTranslation();
  return <p className="text-[11px] leading-snug text-foreground-subtle">{t("conversion:options.images.textOptionsHidden")}</p>;
}

function FormatOptions({
  format,
  sourceFormat,
  options,
  onChange,
}: {
  format: ConversionOutputFormat;
  sourceFormat: string;
  options: ConversionOptions;
  onChange: (updates: Partial<ConversionOptions>) => void;
}) {
  const { t } = useTranslation();
  // Comic sources become one image per page: text layout settings are ignored by the exporters.
  const imageOnlySource = sourceFormat === "cbz";

  if (format === "pdf" && imageOnlySource) {
    return (
      <div className="space-y-4">
        <TextOptionsHiddenNote />
        <ToggleOption label={t("conversion:options.kindle.preserveMetadata")} checked={options.preserveMetadata} onChange={() => onChange({ preserveMetadata: !options.preserveMetadata })} />
      </div>
    );
  }

  if (format === "epub" && imageOnlySource) {
    return (
      <div className="space-y-4">
        <TextOptionsHiddenNote />
        <ToggleOption label={t("conversion:options.epub.generateIndex")} checked={options.generateIndex} onChange={() => onChange({ generateIndex: !options.generateIndex })} />
      </div>
    );
  }

  if (format === "pdf") {
    const activePreset = matchPdfLayoutPreset(options);
    return (
      <div className="space-y-4">
        <div className="space-y-1.5">
          <span className="block text-xs text-foreground-muted">{t("conversion:options.pdf.presets.label")}</span>
          <div className="grid grid-cols-1 gap-1.5" role="radiogroup" aria-label={t("conversion:options.pdf.presets.label")}>
            {PDF_LAYOUT_PRESET_IDS.map((id) => {
              const active = activePreset === id;
              const preset = PDF_LAYOUT_PRESETS[id];
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => onChange({ ...preset })}
                  className={`flex items-start justify-between gap-2 rounded-sm border px-3 py-2 text-left transition-colors ${
                    active
                      ? "border-primary/70 bg-primary-muted"
                      : "border-border bg-background hover:border-border-strong hover:bg-surface-muted/50"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-foreground">{t(`conversion:options.pdf.presets.${id}.label`)}</span>
                    <span className="block text-[11px] leading-snug text-foreground-subtle">{t(`conversion:options.pdf.presets.${id}.hint`)}</span>
                  </span>
                  <span className="flex-shrink-0 pt-0.5 text-[10px] tabular-nums text-foreground-subtle">
                    {preset.pdfPageSize} · {preset.pdfFontSizePt}pt
                  </span>
                </button>
              );
            })}
            {activePreset === null && (
              <p className="rounded-sm border border-dashed border-border px-3 py-2 text-[11px] text-foreground-subtle">
                {t("conversion:options.pdf.presets.custom")}
              </p>
            )}
          </div>
        </div>
        <MarginSliders options={options} onChange={onChange} />
        <details className="group rounded-sm border border-border bg-background/50">
          <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-xs font-medium text-foreground-muted hover:text-foreground">
            {t("conversion:options.pdf.advanced")}
            <span className="text-foreground-subtle transition-transform group-open:rotate-90">›</span>
          </summary>
          <div className="space-y-3 border-t border-border p-3">
            <label className="block space-y-1 text-xs text-foreground-muted">
              <span>{t("conversion:options.pdf.pageSize")}</span>
              <Select value={options.pdfPageSize} onChange={(value) => onChange({ pdfPageSize: value as ConversionOptions["pdfPageSize"] })} className="h-9 w-full text-sm" items={[{ value: "A4", label: "A4" }, { value: "A5", label: "A5" }, { value: "Letter", label: t("conversion:options.pdf.pageSizes.Letter") }, { value: "Legal", label: t("conversion:options.pdf.pageSizes.Legal") }]} />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <NumberOption label={t("conversion:options.pdf.marginTop")} value={options.pdfMarginTopMm} min={0} max={60} suffix="mm" onChange={(value) => onChange({ pdfMarginTopMm: value })} />
              <NumberOption label={t("conversion:options.pdf.marginBottom")} value={options.pdfMarginBottomMm} min={0} max={60} suffix="mm" onChange={(value) => onChange({ pdfMarginBottomMm: value })} />
              <NumberOption label={t("conversion:options.pdf.marginLeft")} value={options.pdfMarginLeftMm} min={0} max={60} suffix="mm" onChange={(value) => onChange({ pdfMarginLeftMm: value })} />
              <NumberOption label={t("conversion:options.pdf.marginRight")} value={options.pdfMarginRightMm} min={0} max={60} suffix="mm" onChange={(value) => onChange({ pdfMarginRightMm: value })} />
              <NumberOption label={t("conversion:options.pdf.fontSize")} value={options.pdfFontSizePt} min={7} max={24} step={0.5} suffix="pt" onChange={(value) => onChange({ pdfFontSizePt: value })} />
              <NumberOption label={t("conversion:options.pdf.lineHeight")} value={options.pdfLineHeight} min={1} max={2.4} step={0.05} onChange={(value) => onChange({ pdfLineHeight: value })} />
              <NumberOption label={t("conversion:options.pdf.paragraphSpacing")} value={options.pdfParagraphSpacingEm} min={0} max={3} step={0.05} suffix="em" onChange={(value) => onChange({ pdfParagraphSpacingEm: value })} />
            </div>
          </div>
        </details>
        <ToggleOption label={t("conversion:options.pdf.chapterPageBreaks")} checked={options.pdfChapterPageBreaks} onChange={() => onChange({ pdfChapterPageBreaks: !options.pdfChapterPageBreaks })} />
        <ToggleOption label={t("conversion:options.pdf.generateOutline")} checked={options.pdfGenerateOutline} onChange={() => onChange({ pdfGenerateOutline: !options.pdfGenerateOutline })} />
      </div>
    );
  }

  if (format === "epub") {
    return (
      <div className="space-y-4">
        <label className="block space-y-1 text-xs text-foreground-muted">
          <span>{t("conversion:options.epub.layout")}</span>
          <Select value={options.epubLayout} onChange={(value) => onChange({ epubLayout: value as ConversionOptions["epubLayout"] })} className="h-9 w-full text-sm" items={[{ value: "auto", label: t("conversion:options.epub.layouts.auto") }, { value: "fixed-layout", label: t("conversion:options.epub.layouts.fixed-layout") }, { value: "reflow", label: t("conversion:options.epub.layouts.reflow") }]} />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <NumberOption label={t("conversion:options.epub.lineHeight")} value={options.epubLineHeight} min={1} max={2.2} step={0.05} onChange={(value) => onChange({ epubLineHeight: value })} />
          <NumberOption label={t("conversion:options.epub.paragraphSpacing")} value={options.epubParagraphSpacingEm} min={0} max={3} step={0.05} suffix="em" onChange={(value) => onChange({ epubParagraphSpacingEm: value })} />
        </div>
        <ToggleOption label={t("conversion:options.epub.generateIndex")} checked={options.generateIndex} onChange={() => onChange({ generateIndex: !options.generateIndex })} />
      </div>
    );
  }

  if (format === "azw3" || format === "kfx") {
    return (
      <div className="space-y-4">
        {sourceFormat === "pdf" && (
          <label className="block space-y-1 text-xs text-foreground-muted">
            <span>{t("conversion:options.kindle.pdfLayout")}</span>
            <Select value={options.epubLayout} onChange={(value) => onChange({ epubLayout: value as ConversionOptions["epubLayout"] })} className="h-9 w-full text-sm" items={[{ value: "auto", label: t("conversion:options.kindle.pdfLayouts.auto") }, { value: "reflow", label: t("conversion:options.kindle.pdfLayouts.reflow") }, { value: "fixed-layout", label: t("conversion:options.kindle.pdfLayouts.fixed-layout") }]} />
          </label>
        )}
        {format === "azw3" && !imageOnlySource && (
          <label className="block space-y-1 text-xs text-foreground-muted">
            <span>{t("conversion:options.kindle.fontSizes")}</span>
            <Select value={options.kindleFontSizes || "kindle"} onChange={(value) => onChange({ kindleFontSizes: value as ConversionOptions["kindleFontSizes"] })} className="h-9 w-full text-sm" items={[{ value: "kindle", label: t("conversion:options.kindle.fontSizeModes.kindle") }, { value: "original", label: t("conversion:options.kindle.fontSizeModes.original") }]} />
            <span className="block text-[11px] text-foreground-subtle">{t(`conversion:options.kindle.fontSizeHints.${options.kindleFontSizes === "original" ? "original" : "kindle"}`)}</span>
          </label>
        )}
        {format === "azw3" && (
          <label className="block space-y-1 text-xs text-foreground-muted">
            <span>{t("conversion:options.kindle.pageNumbers")}</span>
            <Select value={options.pageNumbers === "estimate" || options.pageNumbers === "off" ? options.pageNumbers : "auto"} onChange={(value) => onChange({ pageNumbers: value as ConversionOptions["pageNumbers"] })} className="h-9 w-full text-sm" items={[{ value: "auto", label: t("conversion:options.kindle.pageNumberModes.auto") }, { value: "estimate", label: t("conversion:options.kindle.pageNumberModes.estimate") }, { value: "off", label: t("conversion:options.kindle.pageNumberModes.off") }]} />
          </label>
        )}
        <label className="block space-y-1 text-xs text-foreground-muted">
          <span>{t("conversion:options.kindle.profile")}</span>
          <Select value={options.kindleProfile} onChange={(value) => onChange({ kindleProfile: value as ConversionOptions["kindleProfile"] })} className="h-9 w-full text-sm" items={[{ value: "legacy-paperwhite", label: t("conversion:options.kindle.profiles.legacy-paperwhite") }, { value: "kindle-compatible", label: t("conversion:options.kindle.profiles.kindle-compatible") }, { value: "modern-kindle", label: t("conversion:options.kindle.profiles.modern-kindle") }, { value: "scribe", label: t("conversion:options.kindle.profiles.scribe") }]} />
        </label>
        <ToggleOption label={t("conversion:options.kindle.preserveCover")} checked={options.preserveCover} onChange={() => onChange({ preserveCover: !options.preserveCover })} />
        <ToggleOption label={t("conversion:options.kindle.preserveMetadata")} checked={options.preserveMetadata} onChange={() => onChange({ preserveMetadata: !options.preserveMetadata })} />
        <ToggleOption label={t("conversion:options.kindle.generateIndex")} checked={options.generateIndex} onChange={() => onChange({ generateIndex: !options.generateIndex })} />
      </div>
    );
  }

  if (format === "html") return <ToggleOption label={t("conversion:options.kindle.preserveMetadata")} checked={options.preserveMetadata} onChange={() => onChange({ preserveMetadata: !options.preserveMetadata })} />;
  if (format === "txt") return (
    <label className="block space-y-1 text-xs text-foreground-muted">
      <span>{t("conversion:options.txt.lineEnding")}</span>
      <Select value={options.txtLineEnding} onChange={(value) => onChange({ txtLineEnding: value as ConversionOptions["txtLineEnding"] })} className="h-9 w-full text-sm" items={[{ value: "crlf", label: t("conversion:options.txt.lineEndings.crlf") }, { value: "lf", label: t("conversion:options.txt.lineEndings.lf") }]} />
    </label>
  );
  return (
    <div className="space-y-2">
      <ToggleOption label={t("conversion:options.kindle.preserveCover")} checked={options.preserveCover} onChange={() => onChange({ preserveCover: !options.preserveCover })} />
      <ToggleOption label={t("conversion:options.kindle.preserveMetadata")} checked={options.preserveMetadata} onChange={() => onChange({ preserveMetadata: !options.preserveMetadata })} />
    </div>
  );
}

const MARGIN_LIMITS = { min: 0, max: 60 } as const;

/**
 * Ebook pages are symmetric, so the common case is one value per axis: the
 * horizontal slider sets left and right, the vertical one top and bottom.
 * Individual sides stay editable in the advanced settings.
 */
function MarginSliders({
  options,
  onChange,
}: {
  options: ConversionOptions;
  onChange: (updates: Partial<ConversionOptions>) => void;
}) {
  const { t } = useTranslation();
  const horizontal = Math.round((options.pdfMarginLeftMm + options.pdfMarginRightMm) / 2);
  const vertical = Math.round((options.pdfMarginTopMm + options.pdfMarginBottomMm) / 2);
  const uneven = options.pdfMarginLeftMm !== options.pdfMarginRightMm || options.pdfMarginTopMm !== options.pdfMarginBottomMm;
  return (
    <div className="space-y-3">
      <RangeOption
        label={t("conversion:options.pdf.marginHorizontal")}
        value={horizontal}
        min={MARGIN_LIMITS.min}
        max={MARGIN_LIMITS.max}
        suffix="mm"
        onChange={(value) => onChange({ pdfMarginLeftMm: value, pdfMarginRightMm: value })}
      />
      <RangeOption
        label={t("conversion:options.pdf.marginVertical")}
        value={vertical}
        min={MARGIN_LIMITS.min}
        max={MARGIN_LIMITS.max}
        suffix="mm"
        onChange={(value) => onChange({ pdfMarginTopMm: value, pdfMarginBottomMm: value })}
      />
      {uneven && (
        <p className="text-[11px] leading-snug text-foreground-subtle">{t("conversion:options.pdf.marginUneven")}</p>
      )}
    </div>
  );
}

interface LibrarySearchPanelProps {
  selectedBooks: BookWithThumbnail[];
  onAddBooks: (books: BookWithThumbnail[]) => void;
}

function LibrarySearchPanel({
  selectedBooks,
  onAddBooks,
}: LibrarySearchPanelProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const apiAvailable = Boolean(window.api?.listBooks);
  const canPickFiles = Boolean(window.api?.pickToolFiles);

  const addFromComputer = async () => {
    const picked = await window.api.pickToolFiles("books");
    const known = new Set(selectedBooks.map((book) => book.filePath));
    const books = picked.filter((file) => !known.has(file.path)).map((file, index) => createLocalBook(file, index));
    if (books.length > 0) onAddBooks(books);
  };
  const selectedHashes = useMemo(
    () => new Set(selectedBooks.map((book) => book.fileHash)),
    [selectedBooks],
  );

  const booksQuery = useQuery({
    queryKey: ["conversion-library-books"],
    queryFn: fetchAllLibraryBooks,
    enabled: apiAvailable,
    staleTime: 20_000,
  });

  const availableBooks = useMemo(
    () => (booksQuery.data ?? []).filter((book) => !selectedHashes.has(book.fileHash)),
    [booksQuery.data, selectedHashes],
  );

  return (
    <>
      <section className="mb-3 rounded-sm border border-border bg-surface/40">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">
              {t("conversion:libraryPanel.title")}
            </h2>
            <p className="mt-0.5 text-xs text-foreground-subtle">
              {t("conversion:libraryPanel.description")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canPickFiles && (
              <button
                type="button"
                onClick={() => void addFromComputer()}
                className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-sm border border-border-strong bg-background px-3 text-xs font-medium text-foreground hover:bg-surface-muted hover:text-foreground"
              >
                <HardDrive size={14} />
                {t("conversion:libraryPanel.addFromComputer")}
              </button>
            )}
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-sm border border-border-strong bg-background px-3 text-xs font-medium text-foreground hover:bg-surface-muted hover:text-foreground"
            >
              <FilePlus size={14} />
              {t("conversion:libraryPanel.open")}
            </button>
          </div>
        </div>
        {!apiAvailable ? (
          <div className="rounded-sm border border-dashed border-border px-4 py-8 text-center text-sm text-foreground-subtle">
            {t("conversion:libraryPanel.desktopOnly")}
          </div>
        ) : null}
      </section>
      <LibraryPickerDialog
        open={open}
        books={availableBooks}
        onClose={() => setOpen(false)}
        multiple
        onSelectMany={(books) => {
          onAddBooks(books);
          setOpen(false);
        }}
      />
    </>
  );
}

interface ConversionWorkspaceProps {
  onClose?: () => void;
  onOpenConverted?: (item: ConversionQueueItem) => void;
  className?: string;
}

function ConversionWorkspace({ onClose, onOpenConverted, className }: ConversionWorkspaceProps) {
  const {
    draftBooks,
    queue,
    logs,
    clearLogs,
    addDraftBooks,
    removeDraftBook,
    clearDraft,
    startConversionWithConfigs,
    cancelConversion,
    deleteConversion,
    kindleDelivery,
  } = useConversionQueue();
  const { t, i18n } = useTranslation();
  const kindleMode = Boolean(kindleDelivery);
  const [selectedBookHash, setSelectedBookHash] = useState<string | null>(null);
  const [bookConfigs, setBookConfigs] = useState<Map<string, {
    targetFormat: ConversionOutputFormat;
    profile: ConversionProfile;
    options: ConversionOptions;
    outputPath?: string;
    outputFileName?: string;
  }>>(
    new Map(),
  );
  const [search, setSearch] = useState("");

  const defaultConfigFor = useCallback((book: BookWithThumbnail) => (kindleDelivery
    ? {
        // Kindle mode: AZW3 with the favourite Kindle settings.
        targetFormat: "azw3" as ConversionOutputFormat,
        profile: "ereader" as ConversionProfile,
        options: loadKindleConversionOptions(),
      }
    : {
        targetFormat: (outputFormats.find((format) => canConvertBook(book, format.value))?.value || "epub") as ConversionOutputFormat,
        profile: "ereader" as ConversionProfile,
        options: { ...defaultConversionOptions },
      }), [kindleDelivery]);

  const getBookConfig = useCallback(
    (book: BookWithThumbnail): {
      targetFormat: ConversionOutputFormat;
      profile: ConversionProfile;
      options: ConversionOptions;
      outputPath?: string;
      outputFileName?: string;
    } => {
      return (
        bookConfigs.get(book.fileHash) || defaultConfigFor(book)
      );
    },
    [bookConfigs, defaultConfigFor],
  );

  const setBookConfig = useCallback(
    (bookHash: string, updates: Partial<{
      targetFormat: ConversionOutputFormat;
      profile: ConversionProfile;
      options: ConversionOptions;
      outputPath?: string;
      outputFileName?: string;
    }>) => {
      setBookConfigs((prev) => {
        const next = new Map(prev);
        const book = draftBooks.find((candidate) => candidate.fileHash === bookHash);
        const existing = next.get(bookHash) || (book ? defaultConfigFor(book) : {
          targetFormat: "epub" as ConversionOutputFormat,
          profile: "ereader" as ConversionProfile,
          options: { ...defaultConversionOptions },
        });
        next.set(bookHash, { ...existing, ...updates });
        return next;
      });
    },
    [defaultConfigFor, draftBooks],
  );

  const updateBookOptions = useCallback(
    (bookHash: string, updates: Partial<ConversionOptions>) => {
      setBookConfigs((prev) => {
        const next = new Map(prev);
        const book = draftBooks.find((candidate) => candidate.fileHash === bookHash);
        const existing = next.get(bookHash) || (book ? defaultConfigFor(book) : {
          targetFormat: "epub" as ConversionOutputFormat,
          profile: "ereader" as ConversionProfile,
          options: { ...defaultConversionOptions },
        });
        next.set(bookHash, {
          ...existing,
          options: {
            ...existing.options,
            ...updates,
          },
        });
        return next;
      });
    },
    [defaultConfigFor, draftBooks],
  );

  const selectedBook = useMemo(
    () => draftBooks.find((book) => book.fileHash === selectedBookHash) || null,
    [draftBooks, selectedBookHash],
  );

  useEffect(() => {
    if (draftBooks.length === 0) {
      setSelectedBookHash(null);
      return;
    }

    if (!selectedBookHash || !draftBooks.some((book) => book.fileHash === selectedBookHash)) {
      setSelectedBookHash(draftBooks[0].fileHash);
    }
  }, [draftBooks, selectedBookHash]);

  const selectedBooks = useMemo(() => {
    const normalized = normalizeCase(search.trim());
    if (!normalized) return draftBooks;
    return draftBooks.filter((book) =>
      [book.title, book.author, book.fileName, book.filePath]
        .filter(Boolean)
        .some((value) => normalizeCase(String(value)).includes(normalized)),
    );
  }, [draftBooks, search]);

  const visibleQueue = queue;
  const visibleItemIds = useMemo(() => new Set(visibleQueue.map((item) => item.id)), [visibleQueue]);
  const visibleLogs = useMemo(
    () => logs.filter((entry) => !entry.itemId || visibleItemIds.size === 0 || visibleItemIds.has(entry.itemId)),
    [logs, visibleItemIds],
  );
  const convertibleCount = useMemo(
    () =>
      draftBooks.filter((book) => {
        if (kindleMode) return canSendToKindle(book);
        const cfg = getBookConfig(book);
        return canConvertBook(book, cfg.targetFormat);
      }).length,
    [draftBooks, getBookConfig, kindleMode],
  );

  const handleStart = () => {
    const configs: BookConversionConfig[] = draftBooks.map((book) => ({
      book,
      ...getBookConfig(book),
      ...(kindleDelivery ? { delivery: kindleDelivery, targetFormat: "azw3" as ConversionOutputFormat } : {}),
    }));
    startConversionWithConfigs(configs);
    clearDraft();
  };

  const handleDeleteConversion = async (item: ConversionQueueItem) => {
    if (
      item.status === "done" &&
      !window.confirm(
        t("conversion:queueTable.deleteConfirm", {
          title: getTitleWithoutExtension(item.book.title, item.book.fileType),
        }),
      )
    ) {
      return;
    }
    await deleteConversion(item.id);
  };

  const handleSaveKindleDefaults = (book: BookWithThumbnail) => {
    if (saveKindleConversionOptions(getBookConfig(book).options)) toast.success(t("conversion:kindle.defaultsSaved"));
  };

  const handleApplyToAll = (book: BookWithThumbnail) => {
    const options = getBookConfig(book).options;
    setBookConfigs((current) => {
      const next = new Map(current);
      for (const candidate of draftBooks) {
        const existing = next.get(candidate.fileHash) || defaultConfigFor(candidate);
        next.set(candidate.fileHash, { ...existing, options: { ...options } });
      }
      return next;
    });
    toast.success(t("conversion:kindle.appliedToAll", { count: draftBooks.length }));
  };

  const handleRemoveBook = (book: BookWithThumbnail) => {
    removeDraftBook(book.fileHash);
    setBookConfigs((current) => {
      const next = new Map(current);
      next.delete(book.fileHash);
      return next;
    });
  };

  const handleCancel = () => {
    clearDraft();
    onClose?.();
  };

  return (
    <div className={`lyceum-page-conversion flex h-full min-h-0 flex-col overflow-hidden bg-background p-3 text-foreground ${className ?? ""}`}>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:overflow-hidden xl:grid-cols-[minmax(0,1fr)_400px]">
        <main className="flex-none overflow-visible pr-0.5 lg:min-h-0 lg:overflow-y-auto">
          <LibrarySearchPanel selectedBooks={draftBooks} onAddBooks={addDraftBooks} />

          <div className="mb-3 rounded-sm border border-border bg-surface/40">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold text-foreground">
                {t("conversion:selected.title", { count: draftBooks.length })}
              </h2>
              <label className="flex h-9 min-w-0 flex-[1_1_16rem] items-center gap-2 rounded-sm border border-border bg-background px-3 text-sm text-foreground-subtle sm:max-w-sm">
                <Search size={15} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-input-placeholder"
                  placeholder={t("conversion:selected.searchPlaceholder")}
                />
              </label>
            </div>
            {selectedBooks.length === 0 ? (
              <div className="flex min-h-44 flex-col items-center justify-center gap-3 p-6 text-center text-sm text-foreground-subtle">
                <CircleAlert size={22} className="text-foreground-subtle" />
                {t("conversion:selected.empty")}
              </div>
             ) : (
               <div className="grid gap-3 p-3 lg:grid-cols-2 xl:grid-cols-3">
                 {selectedBooks.map((book) => {
                   const isSelected = selectedBookHash === book.fileHash;
                   const cfg = getBookConfig(book);
                   return (
                     <article
                       key={bookKey(book)}
                       onClick={() => setSelectedBookHash(book.fileHash)}
                       className={`relative flex min-w-0 cursor-pointer gap-3 rounded-sm border p-3 pr-10 transition-colors ${isSelected ? "border-primary" : "border-border bg-background/70 hover:border-border-strong"}`}
                     >
                       <Cover book={book} />
                       <div className="min-w-0 flex-1">
                         <h3 className="truncate text-sm font-semibold text-foreground">
                           {getTitleWithoutExtension(book.title, book.fileType)}
                         </h3>
                         {/* <p className="mt-1 truncate text-sm text-foreground-subtle">
                           {book.author || getBookFolderLabel(book.filePath)}
                         </p> */}
                         {/* <p className="mt-3 text-xs text-foreground-muted">
                           {getFileTypeLabel(book.fileType, book.filePath)}{" "}
                           <span className="text-foreground">-</span> {formatFileSize(book.fileSize)}
                         </p> */}
                         <p className="mt-2 text-xs text-foreground-muted">
                            {formatFileSize(book.fileSize)}
                         </p>
                         <span className="mt-3 inline-flex items-center gap-1.5 rounded-sm bg-surface px-2 py-1 text-xs text-primary">
                           <CircleCheck size={13} />
                           {/* {t("conversion:selected.output", {
                             format: cfg.targetFormat.toUpperCase(),
                           })} */}
                           {getFileTypeLabel(book.fileType, book.filePath)}
                           <ArrowRight size={13} />
                           {cfg.targetFormat.toUpperCase()}
                         </span>
                       </div>
                       <button
                         type="button"
                         onClick={(event) => {
                           event.stopPropagation();
                           handleRemoveBook(book);
                         }}
                         className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-sm text-foreground-subtle hover:bg-surface-muted hover:text-foreground"
                         title={t("conversion:selected.removeTitle")}
                         aria-label={t("conversion:selected.removeAriaLabel", {
                           title: book.title,
                         })}
                       >
                         <X size={14} />
                       </button>
                       {isSelected && (
                         <span className="absolute bottom-3 right-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                           <Check size={13} />
                         </span>
                       )}
                     </article>
                   );
                 })}
               </div>
             )}
          </div>

           <div className="mb-3 overflow-hidden rounded-sm border border-border bg-surface/40">
             <div className="border-b border-border px-4 py-3">
               <h2 className="text-sm font-semibold text-foreground">
                 {t("conversion:queueTable.title", { count: visibleQueue.length })}
               </h2>
             </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px] table-fixed text-left text-sm">
                  <thead className="text-xs text-foreground-subtle">
                    <tr className="border-b border-border">
                      <th className="w-[200px] px-4 py-3 font-medium">{t("conversion:queueTable.columns.book")}</th>
                      <th className="w-[120px] px-3 py-3 font-medium">{t("conversion:queueTable.columns.formats")}</th>
                      <th className="w-[170px] px-3 py-3 font-medium">{t("conversion:queueTable.columns.progress")}</th>
                      <th className="w-[130px] px-3 py-3 font-medium">{t("conversion:queueTable.columns.status")}</th>
                      <th className="w-[60px] px-2 py-3 font-medium">{t("conversion:queueTable.columns.size")}</th>
                      <th className="w-[120px] px-2 py-3 font-medium">{t("conversion:queueTable.columns.actions")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {visibleQueue.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-foreground-subtle">
                          {t("conversion:queueTable.empty")}
                        </td>
                      </tr>
                    ) : (
                      visibleQueue.map((item) => {
                        const estimatedOutputSize = item.outputSize || (() => {
                          const multiplier =
                            item.targetFormat === "txt"
                              ? 0.22
                              : item.targetFormat === "html"
                                ? 0.7
                                : item.targetFormat === "kfx"
                                  ? 1.18
                                  : item.targetFormat === "lyceum"
                                    ? 1.05
                                    : 1.05;
                          return Math.round((item.book.fileSize || 0) * multiplier);
                        })();

                        return (
                          <tr key={item.id} className="hover:bg-surface/80">
                            <td className="w-[200px] px-4 py-2.5">
                              <div className="flex min-w-0 items-center gap-3">
                                <MiniCover book={item.book} />
                                <div className="min-w-0 flex-1">
                                  <p className="truncate font-medium text-foreground">
                                    {getTitleWithoutExtension(item.book.title, item.book.fileType)}
                                  </p>
                                  <p className="truncate text-xs text-foreground-subtle">
                                    {item.book.author || getBookFolderLabel(item.book.filePath)}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-2">
                                <span className="text-foreground">{item.sourceFormat.toUpperCase()}</span>
                                <ArrowRight size={14} className="text-foreground-subtle" />
                                <span className="rounded-sm border border-primary/50 bg-primary-muted px-2 py-0.5 text-xs text-primary">
                                  {item.targetFormat.toUpperCase()}
                                </span>
                              </div>
                            </td>
                            <td className="w-[170px] px-3 py-2.5">
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-24 flex-shrink-0 overflow-hidden rounded-full bg-surface-muted">
                                  <div
                                    className={`h-full rounded-full transition-all duration-300 ${
                                      item.status === "done"
                                        ? "bg-primary"
                                        : item.status === "error"
                                          ? "bg-destructive"
                                          : item.status === "running"
                                            ? "bg-primary"
                                            : "bg-border-strong"
                                    }`}
                                    style={{ width: `${item.progress}%` }}
                                  />
                                </div>
                                <span className="w-10 flex-shrink-0 text-right text-xs text-foreground-muted">
                                  {formatNumber(item.progress, i18n.language)}%
                                </span>
                              </div>
                            </td>
                            <td className="truncate px-3 py-2.5">
                              <span
                                className={`inline-flex items-center gap-1.5 ${
                                  item.status === "done"
                                    ? "text-primary"
                                    : item.status === "error"
                                      ? "text-destructive"
                                      : item.status === "running"
                                        ? "text-warning"
                                        : "text-foreground-subtle"
                                }`}
                              >
                                {item.status === "done" ? (
                                  <CircleCheck size={15} />
                                ) : item.status === "error" ? (
                                  <CircleAlert size={15} />
                                ) : item.status === "running" ? (
                                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-warning/30 border-t-amber-300" aria-hidden="true" />
                                ) : (
                                  <Clock3 size={15} />
                                )}
                                {item.status === "error" ? translateConversionMessage(item.message) : t(statusLabel(item))}
                              </span>
                            </td>
                            <td className="px-2 py-2.5 text-xs text-foreground-muted">
                              {item.status === "done" ? (
                                formatFileSize(estimatedOutputSize)
                              ) : (
                                <span className="text-foreground-subtle">-</span>
                              )}
                            </td>
                            <td className="px-2 py-2.5">
                              <div className="flex items-center gap-1">
                                {["pending", "running"].includes(item.status) && (
                                  <button
                                    type="button"
                                    onClick={() => void cancelConversion(item.id)}
                                    className="inline-flex h-7 w-7 items-center justify-center rounded-sm text-foreground-muted hover:bg-surface-muted hover:text-warning"
                                    title={t("conversion:queueTable.actions.cancelTitle")}
                                    aria-label={t("conversion:queueTable.actions.cancelAriaLabel", {
                                      title: item.book.title,
                                    })}
                                  >
                                    <Square size={13} fill="currentColor" />
                                  </button>
                                )}
                                {item.status === "done" && (
                                  <>
                                    <button
                                      type="button"
                                      disabled={!item.outputHash || !["pdf", "epub"].includes(item.targetFormat)}
                                      onClick={() => onOpenConverted?.(item)}
                                      className="inline-flex h-7 w-7 items-center justify-center rounded-sm text-foreground-muted hover:bg-surface-muted hover:text-primary disabled:cursor-not-allowed disabled:opacity-30"
                                      title={t("conversion:queueTable.actions.openTitle")}
                                      aria-label={t("conversion:queueTable.actions.openAriaLabel", {
                                        title: item.book.title,
                                      })}
                                    >
                                      <BookOpen size={15} />
                                    </button>
                                    <button
                                      type="button"
                                      disabled={!item.outputPath}
                                      onClick={() => item.outputPath && window.api.showBookInFolder(item.outputPath)}
                                      className="inline-flex h-7 w-7 items-center justify-center rounded-sm text-foreground-muted hover:bg-surface-muted hover:text-primary disabled:cursor-not-allowed disabled:opacity-30"
                                      title={t("conversion:queueTable.actions.revealTitle")}
                                      aria-label={t("conversion:queueTable.actions.revealAriaLabel", {
                                        title: item.book.title,
                                      })}
                                    >
                                      <FolderOpen size={15} />
                                    </button>
                                  </>
                                )}
                                {["done", "error", "canceled"].includes(item.status) && (
                                  <button
                                    type="button"
                                    onClick={() => void handleDeleteConversion(item)}
                                    className="inline-flex h-7 w-7 items-center justify-center rounded-sm text-foreground-muted hover:bg-destructive-muted hover:text-destructive"
                                    title={
                                      item.status === "done"
                                        ? t("conversion:queueTable.actions.deleteTitle")
                                        : t("conversion:queueTable.actions.removeTitle")
                                    }
                                    aria-label={
                                      item.status === "done"
                                        ? t("conversion:queueTable.actions.deleteAriaLabel", {
                                            title: item.book.title,
                                          })
                                        : t("conversion:queueTable.actions.removeAriaLabel", {
                                            title: item.book.title,
                                          })
                                    }
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <section className="mb-3 overflow-hidden rounded-sm border border-border bg-background">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <ListTree size={15} className="text-primary" />
                  {t("conversion:logs.title")}
                </h2>
                <button type="button" onClick={clearLogs} disabled={logs.length === 0} className="inline-flex h-8 w-8 items-center justify-center rounded-sm text-foreground-subtle hover:bg-surface-muted hover:text-foreground disabled:opacity-30" title={t("conversion:logs.clearTitle")}
                  aria-label={t("conversion:logs.clearAriaLabel")}>
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="max-h-56 overflow-y-auto font-mono text-xs">
                {visibleLogs.length === 0 ? (
                  <div className="px-4 py-6 text-center font-sans text-sm text-foreground-subtle">
                    {t("conversion:logs.empty")}
                  </div>
                ) : visibleLogs.map((entry) => (
                  <div key={entry.id} className="grid grid-cols-[5.25rem_4.5rem_minmax(0,1fr)] gap-2 border-b border-border px-4 py-2 last:border-0">
                    <time className="text-foreground-subtle">
                      {new Intl.DateTimeFormat(getActiveLocale(), {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                        hour12: false,
                      }).format(new Date(entry.timestamp))}
                    </time>
                    <span className={entry.level === "error" ? "text-destructive" : entry.level === "warning" ? "text-warning" : entry.level === "success" ? "text-primary" : "text-info"}>
                      {t(`conversion:logs.levels.${entry.level}` as const)}
                    </span>
                    <span className="min-w-0 break-words text-foreground">{translateConversionMessage(entry.message)}{entry.detail && <span className="mt-0.5 block text-foreground-subtle">{entry.detail}</span>}</span>
                  </div>
                ))}
              </div>
            </section>

          <div className="overflow-hidden rounded-sm border border-border bg-surface/40">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold text-foreground">{t("conversion:recent.title")}</h2>
            </div>
            <div className="divide-y divide-border">
              {queue.filter((item) => item.status === "done").slice(0, 4).map((item) => (
                <div key={`recent-${item.id}`} className="flex items-center gap-3 px-4 py-3">
                  <MiniCover book={item.book} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {getTitleWithoutExtension(item.book.title, item.book.fileType)}
                    </p>
                    <p className="text-xs text-foreground-subtle">
                      {item.sourceFormat.toUpperCase()} - {item.targetFormat.toUpperCase()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" disabled={!item.outputHash || !["pdf", "epub"].includes(item.targetFormat)} onClick={() => onOpenConverted?.(item)} className="inline-flex h-8 w-8 items-center justify-center rounded-sm text-foreground-muted hover:bg-surface-muted hover:text-primary disabled:opacity-30" title={t("conversion:queueTable.actions.openTitle")}><BookOpen size={14} /></button>
                    <button type="button" disabled={!item.outputPath} onClick={() => item.outputPath && window.api.showBookInFolder(item.outputPath)} className="inline-flex h-8 w-8 items-center justify-center rounded-sm text-foreground-muted hover:bg-surface-muted hover:text-primary disabled:opacity-30" title={t("conversion:queueTable.actions.revealTitle")}><FolderOpen size={14} /></button>
                    <button type="button" onClick={() => void handleDeleteConversion(item)} className="inline-flex h-8 w-8 items-center justify-center rounded-sm text-foreground-muted hover:bg-destructive-muted hover:text-destructive" title={t("conversion:queueTable.actions.deleteTitle")}
                      aria-label={t("conversion:queueTable.actions.deleteAriaLabel", { title: item.book.title })}><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
              {queue.every((item) => item.status !== "done") && (
                <div className="px-4 py-6 text-center text-sm text-foreground-subtle">
                  {t("conversion:recent.empty")}
                </div>
              )}
            </div>
          </div>
        </main>

        <aside className="flex-none overflow-visible rounded-sm border border-border bg-surface/60 lg:min-h-0 lg:overflow-y-auto">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div className="min-w-0">
              <h2 className="font-semibold text-foreground">{t("conversion:settings.title")}</h2>
              {selectedBook && (
                <p className="truncate text-xs text-foreground-subtle">
                  {getTitleWithoutExtension(selectedBook.title, selectedBook.fileType)}
                </p>
              )}
            </div>
          </div>

           {!selectedBook ? (
             <div className="flex min-h-64 flex-col items-center justify-center gap-3 p-6 text-center text-sm text-foreground-subtle">
               <Info size={28} className="text-foreground-subtle" />
               <p>{t("conversion:settings.selectBook")}</p>
             </div>
           ) : (
             (() => {
               const cfg = getBookConfig(selectedBook);

               return (
                 <div className="space-y-6 p-5">
                   {kindleMode && kindleDelivery && (
                     <section className="rounded-sm border border-primary/40 bg-primary/5 p-3">
                       <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                         <Send size={15} className="text-primary" />
                         {t("conversion:kindle.banner", { device: kindleDelivery.deviceName })}
                       </p>
                       <p className="mt-1 text-xs text-foreground-subtle">{t("conversion:kindle.bannerHint")}</p>
                       <p className="mt-2 text-xs font-medium text-foreground">
                         {KINDLE_NATIVE_FORMATS.has(getKindleBookFormat(selectedBook))
                           ? t("conversion:kindle.nativeFormat")
                           : t("conversion:kindle.outputFormat")}
                       </p>
                     </section>
                   )}
                   {!kindleMode && (
                   <section>
                     <div className="mb-2 flex items-center gap-2">
                       <h3 className="text-sm font-semibold text-foreground">{t("conversion:settings.outputFormat")}</h3>
                       <Info size={14} className="text-foreground-subtle" />
                     </div>
                     <div className="grid grid-cols-2 gap-2">
                       {outputFormats.map((format) => {
                         const usable = canConvertBook(selectedBook, format.value);
                         const selected = cfg.targetFormat === format.value;
                         return (
                           <button
                             key={format.value}
                             type="button"
                             disabled={!usable}
                             onClick={() => setBookConfig(selectedBook.fileHash, { targetFormat: format.value })}
                             className={`relative min-h-24 rounded-sm border p-3 text-center transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${selected ? "border-primary" : "border-border bg-background hover:border-border-strong"}`}
                           >
                             <FileText size={22} className={selected ? "mx-auto text-primary" : "mx-auto text-foreground-muted"} />
                             <span className="mt-2 block text-sm font-semibold text-foreground">
                               {format.value.toUpperCase()}
                             </span>
                             <span className="mt-1 block text-[11px] text-foreground-subtle">
                               {t(format.descriptionKey)}
                             </span>
                             {selected && (
                               <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                                 <Check size={13} />
                               </span>
                             )}
                           </button>
                         );
                       })}
                     </div>
                   </section>
                   )}

                   {!(kindleMode && KINDLE_NATIVE_FORMATS.has(getKindleBookFormat(selectedBook))) && (
                   <section>
                     <h3 className="mb-3 text-sm font-semibold text-foreground">
                       {t("conversion:settings.formatOptions", {
                         format: cfg.targetFormat.toUpperCase(),
                       })}
                     </h3>
                     <FormatOptions
                       format={cfg.targetFormat}
                       sourceFormat={sourceFormatOf(selectedBook)}
                       options={cfg.options}
                       onChange={(updates) => updateBookOptions(selectedBook.fileHash, updates)}
                     />
                   </section>
                   )}

                   {kindleMode && (
                     <section className="flex flex-col gap-2">
                       <button
                         type="button"
                         onClick={() => handleSaveKindleDefaults(selectedBook)}
                         className="flex h-9 w-full items-center justify-center gap-2 rounded-sm border border-border-strong bg-surface text-sm text-foreground hover:bg-surface-muted"
                       >
                         <Check size={14} />
                         {t("conversion:kindle.saveDefaults")}
                       </button>
                       {draftBooks.length > 1 && (
                         <button
                           type="button"
                           onClick={() => handleApplyToAll(selectedBook)}
                           className="flex h-9 w-full items-center justify-center gap-2 rounded-sm border border-border bg-background text-sm text-foreground hover:bg-surface-muted"
                         >
                           {t("conversion:kindle.applyToAll")}
                         </button>
                       )}
                     </section>
                   )}

                   {supportsImageOptions(selectedBook, cfg.targetFormat) && (
                     <section>
                       <h3 className="mb-2 text-sm font-semibold text-foreground">{t("conversion:options.images.title")}</h3>
                       <ImageOptions
                         options={cfg.options}
                         onChange={(updates) => updateBookOptions(selectedBook.fileHash, updates)}
                       />
                     </section>
                   )}

                   {!kindleMode && (
                     <ConversionPreview
                       book={selectedBook}
                       targetFormat={cfg.targetFormat}
                       options={cfg.options}
                       settings={(
                         <>
                           <FormatOptions
                             format={cfg.targetFormat}
                             sourceFormat={sourceFormatOf(selectedBook)}
                             options={cfg.options}
                             onChange={(updates) => updateBookOptions(selectedBook.fileHash, updates)}
                           />
                           {supportsImageOptions(selectedBook, cfg.targetFormat) && (
                             <section>
                               <h3 className="mb-2 text-sm font-semibold text-foreground">{t("conversion:options.images.title")}</h3>
                               <ImageOptions
                                 options={cfg.options}
                                 onChange={(updates) => updateBookOptions(selectedBook.fileHash, updates)}
                               />
                             </section>
                           )}
                         </>
                       )}
                     />
                   )}

                   {!kindleMode && (
                   <section>
                     <h3 className="mb-2 text-sm font-semibold text-foreground">{t("conversion:settings.fileName")}</h3>
                     <div className="flex h-9 items-center rounded-sm border border-border bg-background focus-within:border-primary">
                       <input
                         type="text"
                         value={cfg.outputFileName ?? ""}
                         onChange={(event) => setBookConfig(selectedBook.fileHash, { outputFileName: event.target.value })}
                         placeholder={defaultOutputBaseName(selectedBook)}
                         aria-label={t("conversion:settings.fileName")}
                         spellCheck={false}
                         className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm text-foreground outline-none placeholder:text-foreground-subtle"
                       />
                       <span className="flex-shrink-0 pr-3 text-sm text-foreground-subtle">.{cfg.targetFormat}</span>
                     </div>
                     <p className="mt-1 text-xs text-foreground-subtle">{t("conversion:settings.fileNameHint")}</p>
                   </section>
                   )}

                   {!kindleMode && (
                   <section>
                     <h3 className="mb-2 text-sm font-semibold text-foreground">{t("conversion:settings.destination")}</h3>
                     <div className="space-y-2">
                       {cfg.outputPath ? (
                         <div className="flex min-h-9 items-center justify-between gap-2 rounded-sm border border-border bg-background px-3">
                           <div className="flex min-w-0 items-center gap-2">
                             <Folder size={15} className="flex-shrink-0 text-foreground-subtle" />
                             <span className="truncate text-sm text-foreground">{cfg.outputPath}</span>
                           </div>
                           <button
                             type="button"
                             onClick={() => setBookConfig(selectedBook.fileHash, { outputPath: undefined })}
                             className="flex-shrink-0 text-xs text-foreground-subtle hover:text-foreground"
                           >
                             {t("conversion:settings.clear")}
                           </button>
                         </div>
                       ) : (
                         <div className="flex h-9 items-center gap-2 rounded-sm border border-border bg-background px-3 text-sm text-foreground">
                           <Folder size={15} className="text-foreground-subtle" />
                           <span>{t("conversion:settings.nextToOriginal")}</span>
                         </div>
                       )}
                       <button
                         type="button"
                         onClick={async () => {
                           const result = await (window.api as unknown as { selectFolder: () => Promise<{ canceled: boolean; filePaths: string[] }> }).selectFolder();
                           if (result && !result.canceled && result.filePaths.length > 0) {
                             setBookConfig(selectedBook.fileHash, { outputPath: result.filePaths[0] });
                           }
                         }}
                         className="flex h-9 w-full items-center justify-center gap-2 rounded-sm border border-border-strong bg-surface text-sm text-foreground hover:bg-surface-muted"
                       >
                         <FolderOpen size={14} />
                         {t("conversion:settings.chooseFolder")}
                       </button>
                     </div>
                   </section>
                   )}
                 </div>
               );
             })()
           )}

          <div className="sticky bottom-0 flex gap-3 border-t border-border bg-overlay p-4 backdrop-blur">
            <button
              type="button"
              onClick={handleCancel}
              className="h-11 flex-1 rounded-sm border border-border bg-background text-sm font-medium text-foreground hover:bg-surface-muted"
            >
              {t("conversion:settings.cancel")}
            </button>
            <button
              type="button"
              disabled={convertibleCount === 0}
              onClick={handleStart}
              className="flex h-11 flex-[1.8] items-center justify-center gap-2 rounded-sm bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send size={16} />
              {kindleMode
                ? t("conversion:kindle.start", { count: convertibleCount })
                : t("conversion:settings.convert", { count: convertibleCount })}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

interface ConversionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenConverted?: (item: ConversionQueueItem) => void;
}

export function ConversionDialog({ isOpen, onClose, onOpenConverted }: ConversionDialogProps) {
  const { t } = useTranslation();

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[88] flex items-center justify-center bg-backdrop px-3 py-5"
      onMouseDown={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="conversion-dialog-title"
    >
      <div
        className="flex h-[min(860px,calc(100vh-40px))] w-full max-w-7xl overflow-hidden rounded border border-border-strong/90 bg-background shadow-2xl shadow-shadow"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="flex min-h-14 items-center justify-between border-b border-border bg-surface px-4 sm:px-6">
            <div className="min-w-0">
              <h2 id="conversion-dialog-title" className="truncate text-base font-semibold text-foreground">
                {t("conversion:dialog.title")}
              </h2>
              <p className="hidden text-xs text-foreground-subtle sm:block">
                {t("conversion:dialog.description")}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded text-foreground-muted transition hover:bg-surface-muted hover:text-foreground"
              title={t("conversion:dialog.closeTitle")}
              aria-label={t("conversion:dialog.closeAriaLabel")}
            >
              <X size={17} />
            </button>
          </header>
          <ConversionWorkspace onClose={onClose} onOpenConverted={onOpenConverted} className="flex-1" />
        </div>
      </div>
    </div>
  );
}

export default function ConversionPage() {
  return <ConversionWorkspace />;
}
