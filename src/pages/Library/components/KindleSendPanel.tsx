import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  FileText,
  Folder,
  Mail,
  RefreshCw,
  Usb,
  Send,
  SlidersHorizontal,
  Smartphone,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { translate, useTranslation } from "../../../i18n";
import { BookWithThumbnail } from "../../../types/LibraryTypes";
import Select from "../../../components/ui/Select";
import {
  formatFileSize,
  getFileTypeLabel,
  getTitleWithoutExtension,
} from "../utils";
import { KindleEmailSettingsForm, KindleEmailSummary, type KindleEmailConfig } from "./KindleEmailSettings";
import { useConversionQueue } from "../../../contexts/ConversionQueueContext";
import { loadKindleConversionOptions, toKindleSendPayload } from "../../../features/kindle/kindleConversion";
import type { LyceumConversionOptions } from "../../../lib/lyceum/schema/types";

interface KindleSendDevice {
  id: string;
  name: string;
  kind: "kindle" | "kobo" | "ereader";
  isMtp: boolean;
  rootPath?: string;
  devicePath?: string;
  storageName?: string;
  destinationLabel: string;
}

interface KindleSendResultItem {
  fileHash: string;
  title: string;
  success: boolean;
  status: "sent" | "converted" | "skipped" | "error";
  outputName?: string;
  outputPath?: string;
  verified?: boolean;
  bytes?: number;
  note?: string;
  error?: string;
  pageCount?: number;
}

type PageNumbersMode = "auto" | "off" | "estimate";

interface KindleSendApi {
  listKindleDevices: () => Promise<KindleSendDevice[]>;
  onKindleSendProgress?: (callback: (payload: { fileHash: string; progress: number; message: string }) => void) => () => void;
  sendBooksToKindle: (options: {
    deviceId?: string;
    books: Array<{
      fileHash: string;
      filePath: string;
      title: string;
      author?: string | null;
      fileType?: string | null;
      fileName?: string | null;
      publisher?: string | null;
      description?: string | null;
      publishDate?: string | null;
      language?: string | null;
      identifier?: string | null;
      asin?: string | null;
      subject?: string | null;
      series?: string | null;
      seriesIndex?: string | null;
      authorSort?: string | null;
      titleSort?: string | null;
    }>;
    convertToAzw3?: boolean;
    preserveMetadata?: boolean;
    organizeByAuthor?: boolean;
    destination?: string;
    pageNumbers?: PageNumbersMode;
    conversionOptions?: LyceumConversionOptions;
  }) => Promise<{
    success: boolean;
    sent: number;
    failed: number;
    device?: KindleSendDevice;
    results: KindleSendResultItem[];
    error?: string;
  }>;
}

interface KindleSendPanelProps {
  books: BookWithThumbnail[];
  onClose: () => void;
  onSent?: () => void;
}

const CONVERTIBLE_TO_AZW3 = new Set(["pdf", "epub", "txt", "html", "cbz"]);
const DIRECT_KINDLE_FORMATS = new Set(["azw3", "azw", "mobi", "prc", "kfx", "pdf", "txt"]);
const DEFAULT_DESTINATION = "documents/Downloads";
const EMAIL_ACCEPTED_FORMATS = new Set(["epub", "pdf", "txt", "html"]);
const EMAIL_CONVERTIBLE_FORMATS = new Set(["cbz"]);
const EMAIL_MAX_BYTES = 50 * 1024 * 1024;
const MODE_STORAGE_KEY = "lyceum-kindle-send-mode";
const PAGE_NUMBERS_STORAGE_KEY = "lyceum-kindle-page-numbers";

function readStoredPageNumbers(): PageNumbersMode {
  try {
    const value = localStorage.getItem(PAGE_NUMBERS_STORAGE_KEY);
    return value === "off" || value === "estimate" ? value : "auto";
  } catch {
    return "auto";
  }
}

function storePageNumbers(value: PageNumbersMode) {
  try {
    localStorage.setItem(PAGE_NUMBERS_STORAGE_KEY, value);
  } catch {
    /* The choice simply is not remembered. */
  }
}

type SendMode = "usb" | "email";

function readStoredMode(): SendMode {
  try {
    return localStorage.getItem(MODE_STORAGE_KEY) === "email" ? "email" : "usb";
  } catch {
    return "usb";
  }
}

function storeMode(mode: SendMode) {
  try {
    localStorage.setItem(MODE_STORAGE_KEY, mode);
  } catch {
    /* The choice simply is not remembered. */
  }
}

type EmailBookPlan = { kind: "ready" | "convertPdf" | "convertEpub" | "unsupported" | "tooLarge" };

function planEmailBook(book: BookWithThumbnail, convertPdfToEpub: boolean, maxBytes = EMAIL_MAX_BYTES): EmailBookPlan {
  const format = getBookFormat(book);
  if (EMAIL_CONVERTIBLE_FORMATS.has(format)) return { kind: "convertPdf" };
  if (format === "pdf" && convertPdfToEpub) return { kind: "convertEpub" };
  if (!EMAIL_ACCEPTED_FORMATS.has(format)) return { kind: "unsupported" };
  if ((book.fileSize || 0) > maxBytes) return { kind: "tooLarge" };
  return { kind: "ready" };
}

function getApi(): KindleSendApi {
  return window.api as unknown as KindleSendApi;
}

function Toggle({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onChange}
      className={`flex h-5 w-9 flex-shrink-0 items-center rounded-full p-0.5 transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? "bg-primary" : "bg-border-strong"
      }`}
      title={checked ? t("library:kindle.toggleOn") : t("library:kindle.toggleOff")}
    >
      <span
        className={`h-4 w-4 rounded-full bg-primary-foreground transition-transform ${
          checked ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function OptionRow({ label, hint, checked, disabled, onChange }: {
  label: string;
  hint: string;
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-foreground">{label}</p>
        <p className="text-xs text-foreground-subtle">{hint}</p>
      </div>
      <Toggle checked={checked} disabled={disabled} onChange={onChange} />
    </div>
  );
}

function MiniCover({ book }: { book: BookWithThumbnail }) {
  if (book.thumbnail) {
    return (
      <img
        src={book.thumbnail}
        alt={book.title}
        className="h-12 w-8 flex-shrink-0 rounded-sm object-cover"
      />
    );
  }

  return (
    <div className="flex h-12 w-8 flex-shrink-0 items-center justify-center rounded-sm border border-border bg-background text-foreground-subtle">
      <FileText size={15} />
    </div>
  );
}

function getBookFormat(book: BookWithThumbnail) {
  return (book.fileType || book.filePath.split(".").pop() || "").toLowerCase();
}

function itemStatusLabel(result?: KindleSendResultItem, shouldConvert?: boolean) {
  if (!result) {
    return translate(
      shouldConvert ? "library:kindle.status.convert" : "library:kindle.status.ready",
    );
  }
  if (result.success && result.status === "converted") {
    return translate(
      result.verified
        ? "library:kindle.status.convertedVerified"
        : "library:kindle.status.convertedSent",
    );
  }
  if (result.success) {
    return translate(
      result.verified ? "library:kindle.status.sentVerified" : "library:kindle.status.sent",
    );
  }
  return result.error || translate("library:kindle.status.error");
}

const toSendPayload = toKindleSendPayload;

export default function KindleSendPanel({
  books,
  onClose,
  onSent,
}: KindleSendPanelProps) {
  const { t } = useTranslation();
  const { prepareKindleSend } = useConversionQueue();
  const [conversionOptions] = useState(loadKindleConversionOptions);
  const [progress, setProgress] = useState<Map<string, { progress: number; message: string }>>(new Map());
  const [devices, setDevices] = useState<KindleSendDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [loadingDevices, setLoadingDevices] = useState(true);
  const [sending, setSending] = useState(false);
  const [convertToAzw3, setConvertToAzw3] = useState(true);
  const [preserveMetadata, setPreserveMetadata] = useState(true);
  const [organizeByAuthor, setOrganizeByAuthor] = useState(false);
  const [pageNumbers, setPageNumbersState] = useState<PageNumbersMode>(readStoredPageNumbers);
  const setPageNumbers = (next: PageNumbersMode) => {
    setPageNumbersState(next);
    storePageNumbers(next);
  };
  const [results, setResults] = useState<Map<string, KindleSendResultItem>>(new Map());
  const [mode, setModeState] = useState<SendMode>(readStoredMode);
  const [emailConfig, setEmailConfig] = useState<KindleEmailConfig | null>(null);
  const [editingEmail, setEditingEmail] = useState(false);
  const [convertPdfToEpub, setConvertPdfToEpub] = useState(false);
  const emailAvailable = Boolean(window.api?.getKindleEmailConfig);

  const setMode = (next: SendMode) => {
    setModeState(next);
    setResults(new Map());
    storeMode(next);
  };

  useEffect(() => {
    if (!emailAvailable) return;
    void window.api.getKindleEmailConfig().then((config) => {
      setEmailConfig(config);
      if (!config.configured) setEditingEmail(true);
    }).catch((error) => console.error("Error loading Kindle email settings:", error));
  }, [emailAvailable]);

  const emailPlans = useMemo(
    () => new Map(books.map((book) => [book.fileHash, planEmailBook(book, convertPdfToEpub, emailConfig?.maxAttachmentBytes)])),
    [books, convertPdfToEpub, emailConfig?.maxAttachmentBytes],
  );
  const emailSendableCount = useMemo(
    () => Array.from(emailPlans.values()).filter((plan) => plan.kind !== "unsupported" && plan.kind !== "tooLarge").length,
    [emailPlans],
  );

  const selectedDevice = useMemo(
    () => devices.find((device) => device.id === selectedDeviceId) || devices[0],
    [devices, selectedDeviceId],
  );

  const convertibleCount = useMemo(
    () =>
      books.filter((book) => {
        const format = getBookFormat(book);
        return convertToAzw3 && format !== "azw3" && CONVERTIBLE_TO_AZW3.has(format);
      }).length,
    [books, convertToAzw3],
  );

  const totalSize = useMemo(
    () => books.reduce((sum, book) => sum + (book.fileSize || 0), 0),
    [books],
  );
  const verifiedCount = useMemo(
    () => Array.from(results.values()).filter((result) => result.success && result.verified).length,
    [results],
  );
  const inferredCount = useMemo(
    () => Array.from(results.values()).filter((result) => result.success && !result.verified).length,
    [results],
  );

  const destinationLabel = useMemo(() => {
    const base = selectedDevice?.destinationLabel || DEFAULT_DESTINATION;
    return organizeByAuthor ? `${base}/Autor` : base;
  }, [organizeByAuthor, selectedDevice?.destinationLabel]);

  const refreshDevices = async () => {
    setLoadingDevices(true);
    try {
      const nextDevices = await getApi().listKindleDevices();
      setDevices(nextDevices);
      setSelectedDeviceId((current) =>
        current && nextDevices.some((device) => device.id === current)
          ? current
          : nextDevices[0]?.id || "",
      );
    } catch (error) {
      console.error("Error loading Kindle devices:", error);
      toast.error(t("library:kindle.toasts.checkFailed"));
    } finally {
      setLoadingDevices(false);
    }
  };

  useEffect(() => {
    void refreshDevices();
  }, []);

  useEffect(() => {
    const subscribe = getApi().onKindleSendProgress;
    if (!subscribe) return;
    return subscribe(({ fileHash, progress: value, message }) => {
      setProgress((current) => new Map(current).set(fileHash, { progress: value, message }));
    });
  }, []);

  /** Opens the conversion window in Kindle mode with these books and the favourite settings. */
  const openConversionWindow = () => {
    if (!selectedDevice) return;
    prepareKindleSend(books, { deviceId: selectedDevice.id, deviceName: selectedDevice.name });
    window.dispatchEvent(new CustomEvent("lyceum:open-conversion"));
    onClose();
  };

  const handleSend = async () => {
    if (!selectedDevice || books.length === 0) return;

    setSending(true);
    setResults(new Map());
    setProgress(new Map());

    try {
      const response = await getApi().sendBooksToKindle({
        deviceId: selectedDevice.id,
        books: books.map(toSendPayload),
        convertToAzw3,
        preserveMetadata,
        organizeByAuthor,
        destination: DEFAULT_DESTINATION,
        pageNumbers,
        conversionOptions,
      });

      setResults(new Map(response.results.map((result) => [result.fileHash, result])));

      if (response.sent > 0) {
        toast.success(t("library:kindle.toasts.sent", { count: response.sent }));
        onSent?.();
      }
      if (response.failed > 0) {
        toast.error(
          response.error || t("library:kindle.toasts.failed", { count: response.failed }),
        );
      }
    } catch (error) {
      console.error("Error sending to Kindle:", error);
      toast.error(t("library:kindle.toasts.sendFailed"));
    } finally {
      setSending(false);
    }
  };

  const handleSendEmail = async () => {
    const sendable = books.filter((book) => {
      const plan = emailPlans.get(book.fileHash);
      return plan && plan.kind !== "unsupported" && plan.kind !== "tooLarge";
    });
    if (sendable.length === 0 || !emailConfig?.configured) return;

    setSending(true);
    setResults(new Map());
    try {
      const response = await window.api.sendBooksToKindleEmail({
        books: sendable.map(toSendPayload),
        preserveMetadata,
        convertPdfToEpub,
      });
      setResults(new Map(response.results.map((result) => [result.fileHash, result])));
      if (response.sent > 0) {
        toast.success(t("library:kindle.toasts.sent", { count: response.sent }));
        onSent?.();
      }
      if (response.failed > 0) {
        toast.error(response.results.find((result) => !result.success)?.error || t("library:kindle.toasts.failed", { count: response.failed }));
      }
    } catch (error) {
      console.error("Error sending to Kindle by email:", error);
      toast.error(t("library:kindle.toasts.sendFailed"));
    } finally {
      setSending(false);
    }
  };

  const emailReady = Boolean(emailConfig?.configured) && !editingEmail;

  return (
    <aside
      className="lyceum-kindle-send-panel flex h-full w-[390px] flex-shrink-0 flex-col border-l border-border bg-surface text-foreground"
      aria-label={t("library:kindle.aria")}
    >
      <header className="flex-shrink-0 border-b border-border px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">{t("library:kindle.title")}</h2>
            <p className="mt-0.5 truncate text-xs text-foreground-subtle">
              {t("library:kindle.selectedBooks", { count: books.length })}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-sm p-1.5 text-foreground-subtle hover:bg-surface-muted hover:text-foreground"
            title={t("common:actions.close")}
          >
            <X size={17} />
          </button>
        </div>
        {emailAvailable && (
          <div role="tablist" className="mt-3 grid grid-cols-2 gap-1 rounded-sm border border-border bg-background/60 p-1">
            {(["usb", "email"] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={mode === value}
                disabled={sending}
                onClick={() => setMode(value)}
                className={`inline-flex h-7 items-center justify-center gap-1.5 rounded-sm text-xs font-medium transition-colors disabled:opacity-50 ${
                  mode === value ? "bg-surface text-foreground shadow-sm" : "text-foreground-muted hover:text-foreground"
                }`}
              >
                {value === "usb" ? <Usb size={13} /> : <Mail size={13} />}
                {t(value === "usb" ? "library:kindle.email.modeUsb" : "library:kindle.email.modeEmail")}
              </button>
            ))}
          </div>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {mode === "usb" ? (
          <>
            <section className="mb-4 rounded-sm border border-border bg-background/60 p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <Smartphone size={17} className="flex-shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {loadingDevices
                        ? t("library:kindle.searching")
                        : selectedDevice?.name || t("library:kindle.noDevice")}
                    </p>
                    <p className="truncate text-xs text-foreground-subtle">
                      {selectedDevice?.isMtp
                        ? t("library:kindle.mtp")
                        : selectedDevice
                          ? t("library:kindle.usb")
                          : t("library:kindle.connectPaperwhite")}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void refreshDevices()}
                  disabled={loadingDevices || sending}
                  className="rounded-sm p-2 text-foreground-subtle hover:bg-surface-muted hover:text-foreground disabled:opacity-50"
                  title={t("library:kindle.refreshDevices")}
                >
                  <RefreshCw size={15} className={loadingDevices ? "animate-spin" : ""} />
                </button>
              </div>

              {devices.length > 1 && (
                <Select value={selectedDevice?.id || ""} onChange={setSelectedDeviceId} className="h-9 w-full text-sm" items={devices.map((device) => ({ value: device.id, label: device.name }))} />
              )}

              <div className="mt-3 flex items-center gap-2 rounded-sm border border-border bg-surface px-3 py-2 text-xs text-foreground-muted">
                <Folder size={14} className="flex-shrink-0 text-foreground-subtle" />
                <span className="truncate">{destinationLabel}</span>
              </div>
            </section>

            <section className="mb-4 rounded-sm border border-border bg-background/60 p-3">
              <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-foreground-subtle">
                {t("library:kindle.transferOptions")}
              </h3>
              <div className="space-y-3 text-sm">
                <OptionRow label={t("library:kindle.convertAzw3")} hint={t("library:kindle.convertAzw3Hint")} checked={convertToAzw3} disabled={sending} onChange={() => setConvertToAzw3((value) => !value)} />
                <OptionRow label={t("library:kindle.preserveMetadata")} hint={t("library:kindle.preserveMetadataHint")} checked={preserveMetadata} disabled={sending} onChange={() => setPreserveMetadata((value) => !value)} />
                <OptionRow label={t("library:kindle.organizeByAuthor")} hint={t("library:kindle.organizeByAuthorHint")} checked={organizeByAuthor} disabled={sending} onChange={() => setOrganizeByAuthor((value) => !value)} />
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-foreground">{t("library:kindle.pageNumbers.label")}</p>
                    <p className="text-xs text-foreground-subtle">{t(`library:kindle.pageNumbers.hint.${pageNumbers}`)}</p>
                  </div>
                  <div className="w-36 flex-shrink-0">
                    <Select
                      value={pageNumbers}
                      onChange={(value) => setPageNumbers(value as PageNumbersMode)}
                      disabled={sending}
                      ariaLabel={t("library:kindle.pageNumbers.label")}
                      items={[
                        { value: "auto", label: t("library:kindle.pageNumbers.auto") },
                        { value: "estimate", label: t("library:kindle.pageNumbers.estimate") },
                        { value: "off", label: t("library:kindle.pageNumbers.off") },
                      ]}
                    />
                  </div>
                </div>
              </div>
            </section>

            <section className="mb-4 rounded-sm border border-border bg-background/60 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-xs font-medium uppercase tracking-wide text-foreground-subtle">
                  {t("library:kindle.conversion.title")}
                </h3>
                <button
                  type="button"
                  onClick={openConversionWindow}
                  disabled={sending || !selectedDevice}
                  className="flex items-center gap-1.5 rounded-sm border border-border-strong bg-surface px-2.5 py-1 text-xs text-foreground hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <SlidersHorizontal size={13} />
                  {t("library:kindle.conversion.configure")}
                </button>
              </div>
              <ul className="space-y-1 text-xs text-foreground-muted">
                <li>{t("library:kindle.conversion.summary.layout", { value: t(`library:kindle.conversion.layouts.${conversionOptions.epubLayout || "auto"}`) })}</li>
                <li>{t("library:kindle.conversion.summary.fonts", { value: t(`library:kindle.conversion.fonts.${conversionOptions.kindleFontSizes === "original" ? "original" : "kindle"}`) })}</li>
                <li>{t("library:kindle.conversion.summary.profile", { value: t(`library:kindle.conversion.profiles.${conversionOptions.kindleProfile || "kindle-compatible"}`) })}</li>
              </ul>
              <p className="mt-2 text-[11px] text-foreground-subtle">{t("library:kindle.conversion.hint")}</p>
            </section>
          </>
        ) : (
          <>
            <section className="mb-4 rounded-sm border border-border bg-background/60 p-3">
              {!emailConfig ? (
                <p className="flex items-center gap-2 text-xs text-foreground-subtle"><RefreshCw size={13} className="animate-spin" />{t("library:kindle.searching")}</p>
              ) : editingEmail || !emailConfig.configured ? (
                <>
                  <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-foreground-subtle">{t("library:kindle.email.configTitle")}</h3>
                  <KindleEmailSettingsForm
                    config={emailConfig}
                    onSaved={(config) => {
                      setEmailConfig(config);
                      setEditingEmail(!config.configured);
                    }}
                    onCancel={emailConfig.configured ? () => setEditingEmail(false) : undefined}
                  />
                </>
              ) : (
                <KindleEmailSummary config={emailConfig} disabled={sending} onEdit={() => setEditingEmail(true)} />
              )}
            </section>

            <section className="mb-4 rounded-sm border border-border bg-background/60 p-3">
              <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-foreground-subtle">
                {t("library:kindle.transferOptions")}
              </h3>
              <div className="space-y-3 text-sm">
                <OptionRow label={t("library:kindle.email.convertPdf")} hint={t("library:kindle.email.convertPdfHint")} checked={convertPdfToEpub} disabled={sending} onChange={() => setConvertPdfToEpub((value) => !value)} />
                <OptionRow label={t("library:kindle.preserveMetadata")} hint={t("library:kindle.preserveMetadataHint")} checked={preserveMetadata} disabled={sending} onChange={() => setPreserveMetadata((value) => !value)} />
              </div>
              <p className="mt-3 text-[11px] leading-4 text-foreground-subtle">{t("library:kindle.email.limitHint", { size: Math.round((emailConfig?.maxAttachmentBytes ?? EMAIL_MAX_BYTES) / 1024 / 1024) })}</p>
            </section>
          </>
        )}

        <section>
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="text-xs font-medium uppercase tracking-wide text-foreground-subtle">
              {t("library:kindle.selectedHeading")}
            </h3>
            <span className="text-xs text-foreground-subtle">{formatFileSize(totalSize)}</span>
          </div>
          <div className="space-y-2">
            {books.map((book) => {
              const format = getBookFormat(book);
              const result = results.get(book.fileHash);
              let hasError: boolean;
              let pending: boolean;
              let status: string;
              if (mode === "email") {
                const plan = emailPlans.get(book.fileHash)?.kind ?? "ready";
                const blocked = plan === "unsupported" || plan === "tooLarge";
                hasError = blocked || Boolean(result && !result.success);
                pending = !result && (plan === "convertPdf" || plan === "convertEpub");
                status = result
                  ? result.success ? t("library:kindle.email.emailed") : result.error || t("library:kindle.status.error")
                  : plan === "unsupported" ? t("library:kindle.email.unsupported")
                    : plan === "tooLarge" ? t("library:kindle.email.tooLarge", { size: Math.round((emailConfig?.maxAttachmentBytes ?? EMAIL_MAX_BYTES) / 1024 / 1024) })
                      : plan === "convertPdf" ? t("library:kindle.email.willConvertPdf")
                        : plan === "convertEpub" ? t("library:kindle.email.willConvertEpub")
                          : t("library:kindle.status.ready");
              } else {
                const shouldConvert = convertToAzw3 && format !== "azw3" && CONVERTIBLE_TO_AZW3.has(format);
                const needsConversion = !convertToAzw3 && !DIRECT_KINDLE_FORMATS.has(format);
                hasError = needsConversion || Boolean(result && !result.success);
                pending = shouldConvert && !result;
                status = needsConversion ? t("library:kindle.needsConversion") : itemStatusLabel(result, shouldConvert);
              }
              const isDone = Boolean(result?.success);

              return (
                <article
                  key={book.fileHash}
                  className="flex min-w-0 gap-3 rounded-sm border border-border bg-background/60 p-2.5"
                >
                  <MiniCover book={book} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {getTitleWithoutExtension(book.title, book.fileType)}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-foreground-subtle">
                      {book.author || t("library:kindle.unknownAuthor")} - {getFileTypeLabel(book.fileType, book.filePath)} - {formatFileSize(book.fileSize)}
                    </p>
                    <p
                      className={`mt-2 flex items-center gap-1.5 text-xs ${
                        hasError ? "text-destructive" : isDone ? "text-primary" : pending ? "text-warning" : "text-foreground-muted"
                      }`}
                    >
                      {hasError ? (
                        <AlertCircle size={13} className="flex-shrink-0" />
                      ) : isDone ? (
                        <CheckCircle2 size={13} className="flex-shrink-0" />
                      ) : pending ? (
                        <RefreshCw size={13} className="flex-shrink-0" />
                      ) : (
                        <BookOpen size={13} className="flex-shrink-0" />
                      )}
                      <span className={mode === "email" && hasError ? "break-words" : "truncate"}>{status}</span>
                    </p>
                    {mode === "usb" && sending && !result && progress.get(book.fileHash) && (
                      <div className="mt-1.5">
                        <div className="h-1 overflow-hidden rounded-full bg-border">
                          <div
                            className="h-full bg-primary transition-[width] duration-300"
                            style={{ width: `${Math.round((progress.get(book.fileHash)?.progress || 0) * 100)}%` }}
                          />
                        </div>
                        <p className="mt-1 truncate text-[11px] text-foreground-subtle">
                          {progress.get(book.fileHash)?.message} · {Math.round((progress.get(book.fileHash)?.progress || 0) * 100)}%
                        </p>
                      </div>
                    )}
                    {result?.note && (
                      <p className="mt-1 text-[11px] leading-4 text-foreground-subtle">{result.note}</p>
                    )}
                    {result?.success && result.pageCount ? (
                      <p className="mt-1 text-[11px] leading-4 text-primary">{t("library:kindle.pageNumbers.added", { count: result.pageCount })}</p>
                    ) : null}
                    {result?.outputPath && (
                      <p className="mt-1 truncate text-[11px] text-foreground-subtle" title={result.outputPath}>{result.outputPath}</p>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>

      <footer className="flex-shrink-0 border-t border-border bg-overlay p-4">
        <div className="mb-3 flex items-center justify-between text-xs text-foreground-subtle">
          {mode === "email" ? (
            <span>{emailReady ? t("library:kindle.summaryPending", { count: emailSendableCount }) : t("library:kindle.email.notConfigured")}</span>
          ) : (
            <>
              <span>{t("library:kindle.conversions", { count: convertibleCount })}</span>
              <span>
                {results.size > 0
                  ? inferredCount > 0
                    ? t("library:kindle.summaryInferred", {
                        verified: verifiedCount,
                        inferred: inferredCount,
                      })
                    : t("library:kindle.summary", { verified: verifiedCount })
                  : t("library:kindle.summaryPending", { count: books.length })}
              </span>
            </>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="h-10 flex-1 rounded-sm border border-border bg-background text-sm text-foreground hover:bg-surface-muted disabled:opacity-50"
          >
            {t("common:actions.cancel")}
          </button>
          {mode === "email" ? (
            <button
              type="button"
              onClick={() => void handleSendEmail()}
              disabled={sending || emailSendableCount === 0 || !emailReady}
              className="flex h-10 flex-[1.6] items-center justify-center gap-2 rounded-sm bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sending ? <RefreshCw size={16} className="animate-spin" /> : <Mail size={16} />}
              {sending ? t("library:kindle.sending") : t("library:kindle.email.send", { count: emailSendableCount })}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || books.length === 0 || !selectedDevice}
              className="flex h-10 flex-[1.6] items-center justify-center gap-2 rounded-sm bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sending ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
              {sending
                ? t("library:kindle.sending")
                : t("library:kindle.send", { count: books.length })}
            </button>
          )}
        </div>
      </footer>
    </aside>
  );
}
