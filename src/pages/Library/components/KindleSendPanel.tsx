import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Folder,
  Info,
  Mail,
  RefreshCw,
  RotateCcw,
  Send,
  SlidersHorizontal,
  Smartphone,
  Square,
  Usb,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { useTranslation, type TranslationKey } from "../../../i18n";
import { BookWithThumbnail } from "../../../types/LibraryTypes";
import Select from "../../../components/ui/Select";
import { formatFileSize, getFileTypeLabel, getTitleWithoutExtension } from "../utils";
import { KindleEmailSettingsForm, KindleEmailSummary, type KindleEmailConfig } from "./KindleEmailSettings";
import { useConversionQueue } from "../../../contexts/ConversionQueueContext";
import {
  getKindleBookFormat,
  loadKindleConversionOptions,
  saveKindleConversionOptions,
  toKindleSendPayload,
} from "../../../features/kindle/kindleConversion";
import {
  isEmailPlanSendable,
  isUsbPlanSendable,
  maxEmailAttachmentBytes,
  planEmailBook,
  planUsbBook,
  type EmailPlan,
  type KindleSendStage,
  type UsbPlan,
} from "../../../features/kindle/kindleSendPlan";
import { describeKindleError, kindleStageLabel } from "../../../features/kindle/kindleSendMessages";
import { KINDLE_IMAGE_PRESETS, isKindleImagePreset, type KindleImagePresetId } from "../../../lib/lyceum/images/imagePresets";
import type { ConversionOptions } from "../../../contexts/ConversionQueueContext";
import { useLazyThumbnail } from "./BookGrid/useLazyThumbnail";

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
  outputFormat?: string;
  verified?: boolean;
  bytes?: number;
  note?: string;
  error?: string;
  errorCode?: string;
  errorParams?: Record<string, string | number>;
  pageCount?: number;
}

interface LiveProgress {
  progress: number;
  stage: KindleSendStage;
  detail?: string;
}

type PageNumbersMode = "auto" | "off" | "estimate";
type SendMode = "usb" | "email";

interface KindleSendPanelProps {
  books: BookWithThumbnail[];
  onClose: () => void;
  onSent?: () => void;
}

const DEFAULT_DESTINATION = "documents/Downloads";
const MODE_STORAGE_KEY = "lyceum-kindle-send-mode";
const PAGE_NUMBERS_STORAGE_KEY = "lyceum-kindle-page-numbers";
const PREFS_STORAGE_KEY = "lyceum-kindle-send-prefs";
const KINDLE_MODELS = Object.keys(KINDLE_IMAGE_PRESETS) as KindleImagePresetId[];

interface SendPrefs {
  convertToAzw3: boolean;
  preserveMetadata: boolean;
  organizeByAuthor: boolean;
  pdfAsEpub: boolean;
  compressImages: boolean;
}

const DEFAULT_PREFS: SendPrefs = {
  convertToAzw3: true,
  preserveMetadata: true,
  organizeByAuthor: false,
  pdfAsEpub: false,
  compressImages: true,
};

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

function writeValue(key: string, value: unknown) {
  try {
    localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
  } catch {
    /* The choice simply is not remembered. */
  }
}

function readStoredMode(): SendMode {
  try {
    return localStorage.getItem(MODE_STORAGE_KEY) === "email" ? "email" : "usb";
  } catch {
    return "usb";
  }
}

function readStoredPageNumbers(): PageNumbersMode {
  try {
    const value = localStorage.getItem(PAGE_NUMBERS_STORAGE_KEY);
    return value === "off" || value === "estimate" ? value : "auto";
  } catch {
    return "auto";
  }
}

function Toggle({ checked, disabled, onChange, label }: { checked: boolean; disabled?: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={`flex h-5 w-9 flex-shrink-0 items-center rounded-full p-0.5 transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? "bg-primary" : "bg-border-strong"
      }`}
    >
      <span className={`h-4 w-4 rounded-full bg-primary-foreground transition-transform ${checked ? "translate-x-4" : "translate-x-0"}`} />
    </button>
  );
}

function OptionRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm text-foreground">{label}</p>
        {hint && <p className="text-xs leading-4 text-foreground-subtle">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function ToggleRow({ label, hint, checked, disabled, onChange }: { label: string; hint?: string; checked: boolean; disabled?: boolean; onChange: () => void }) {
  return (
    <OptionRow label={label} hint={hint}>
      <Toggle checked={checked} disabled={disabled} onChange={onChange} label={label} />
    </OptionRow>
  );
}

function SelectRow({ label, hint, value, items, disabled, onChange }: {
  label: string;
  hint?: string;
  value: string;
  items: Array<{ value: string; label: string }>;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-foreground">{label}</p>
        <div className="w-44 flex-shrink-0">
          <Select value={value} onChange={onChange} disabled={disabled} ariaLabel={label} items={items} className="h-8 w-full text-xs" />
        </div>
      </div>
      {hint && <p className="text-xs leading-4 text-foreground-subtle">{hint}</p>}
    </div>
  );
}

function Section({ title, children, action }: { title?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="mb-4 rounded-sm border border-border bg-background/60 p-3">
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h3 className="text-xs font-medium uppercase tracking-wide text-foreground-subtle">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

function MiniCover({ book }: { book: BookWithThumbnail }) {
  const { thumbnail, thumbnailRef } = useLazyThumbnail(book);
  return (
    <div ref={thumbnailRef} className="flex h-12 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-sm border border-border bg-background text-foreground-subtle">
      {thumbnail ? <img src={thumbnail} alt="" className="h-full w-full object-cover" /> : <FileText size={15} />}
    </div>
  );
}

const MB = 1024 * 1024;
const toMb = (bytes: number) => Math.round((bytes / MB) * 10) / 10;

export default function KindleSendPanel({ books, onClose, onSent }: KindleSendPanelProps) {
  const { t } = useTranslation();
  const { prepareKindleSend } = useConversionQueue();
  const [conversionOptions, setConversionOptionsState] = useState<ConversionOptions>(loadKindleConversionOptions);
  const [prefs, setPrefsState] = useState<SendPrefs>(() => readJson(PREFS_STORAGE_KEY, DEFAULT_PREFS));
  const [pageNumbers, setPageNumbersState] = useState<PageNumbersMode>(readStoredPageNumbers);
  const [mode, setModeState] = useState<SendMode>(readStoredMode);
  const [devices, setDevices] = useState<KindleSendDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [loadingDevices, setLoadingDevices] = useState(true);
  const [emailConfig, setEmailConfig] = useState<KindleEmailConfig | null>(null);
  const [editingEmail, setEditingEmail] = useState(false);
  const [sending, setSending] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [runIds, setRunIds] = useState<string[]>([]);
  const [progress, setProgress] = useState<Map<string, LiveProgress>>(new Map());
  const [results, setResults] = useState<Record<SendMode, Map<string, KindleSendResultItem>>>({ usb: new Map(), email: new Map() });
  const [lastEmailRun, setLastEmailRun] = useState(false);
  const emailAvailable = Boolean(window.api?.getKindleEmailConfig);
  const sendingRef = useRef(false);

  const setPrefs = (patch: Partial<SendPrefs>) => {
    setPrefsState((current) => {
      const next = { ...current, ...patch };
      writeValue(PREFS_STORAGE_KEY, next);
      return next;
    });
  };
  const setConversionOptions = (patch: Partial<ConversionOptions>) => {
    setConversionOptionsState((current) => {
      const next = { ...current, ...patch };
      saveKindleConversionOptions(next);
      return next;
    });
  };
  const setPageNumbers = (next: PageNumbersMode) => {
    setPageNumbersState(next);
    writeValue(PAGE_NUMBERS_STORAGE_KEY, next);
  };
  const setMode = (next: SendMode) => {
    setModeState(next);
    writeValue(MODE_STORAGE_KEY, next);
  };

  useEffect(() => {
    if (!emailAvailable) return;
    void window.api.getKindleEmailConfig().then((config) => {
      setEmailConfig(config);
      if (!config.configured) setEditingEmail(true);
    }).catch((error) => console.error("Error loading Kindle email settings:", error));
  }, [emailAvailable]);

  const refreshDevices = async () => {
    setLoadingDevices(true);
    try {
      const nextDevices = (await window.api.listKindleDevices()) as KindleSendDevice[];
      setDevices(nextDevices);
      setSelectedDeviceId((current) => (current && nextDevices.some((device) => device.id === current) ? current : nextDevices[0]?.id || ""));
    } catch (error) {
      console.error("Error loading Kindle devices:", error);
      toast.error(t("library:kindle.toasts.checkFailed"));
    } finally {
      setLoadingDevices(false);
    }
  };

  useEffect(() => {
    void refreshDevices();
    // Devices plugged in while the panel is open show up on their own.
    const unsubscribe = window.api?.onUsbDevicesUpdated?.(() => {
      if (!sendingRef.current) void refreshDevices();
    });
    return () => unsubscribe?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const subscribe = window.api?.onKindleSendProgress;
    if (!subscribe) return;
    return subscribe(({ fileHash, progress: value, stage, detail }) => {
      setProgress((current) => new Map(current).set(fileHash, { progress: value, stage, detail }));
    });
  }, []);

  const selectedDevice = useMemo(
    () => devices.find((device) => device.id === selectedDeviceId) || devices[0],
    [devices, selectedDeviceId],
  );
  const maxEmailBytes = emailConfig?.maxAttachmentBytes ?? maxEmailAttachmentBytes(emailConfig?.provider);

  const usbPlans = useMemo(
    () => new Map(books.map((book) => [book.fileHash, planUsbBook(getKindleBookFormat(book), { convertToAzw3: prefs.convertToAzw3 })])),
    [books, prefs.convertToAzw3],
  );
  const emailPlans = useMemo(
    () => new Map(books.map((book) => [book.fileHash, planEmailBook(getKindleBookFormat(book), book.fileSize, {
      pdfAsEpub: prefs.pdfAsEpub,
      compressImages: prefs.compressImages,
      maxBytes: maxEmailBytes,
    })])),
    [books, prefs.pdfAsEpub, prefs.compressImages, maxEmailBytes],
  );

  const isSendable = (book: BookWithThumbnail) => {
    if (mode === "usb") {
      const plan = usbPlans.get(book.fileHash);
      return Boolean(plan && isUsbPlanSendable(plan));
    }
    const plan = emailPlans.get(book.fileHash);
    return Boolean(plan && isEmailPlanSendable(plan));
  };
  const sendableBooks = books.filter(isSendable);
  const conversionCount = sendableBooks.filter((book) => (mode === "usb" ? usbPlans.get(book.fileHash)?.action : emailPlans.get(book.fileHash)?.action) === "convert").length;
  const blockedCount = books.length - sendableBooks.length;
  const modeResults = results[mode];
  const failedBooks = books.filter((book) => modeResults.get(book.fileHash) && !modeResults.get(book.fileHash)?.success && isSendable(book));
  const sentCount = Array.from(modeResults.values()).filter((result) => result.success).length;
  const finished = !sending && modeResults.size > 0;
  const emailReady = Boolean(emailConfig?.configured) && !editingEmail;
  const canSend = mode === "usb" ? Boolean(selectedDevice) : emailReady;
  const totalSize = books.reduce((sum, book) => sum + (book.fileSize || 0), 0);

  // Overall progress of the running batch.
  const runDone = runIds.filter((id) => modeResults.has(id)).length;
  const currentId = runIds.find((id) => !modeResults.has(id) && progress.has(id)) ?? runIds.find((id) => !modeResults.has(id));
  const currentBook = books.find((book) => book.fileHash === currentId);
  const currentProgress = currentId ? progress.get(currentId) : undefined;
  const overall = runIds.length ? (runDone + Math.min(0.99, currentProgress?.progress ?? 0)) / runIds.length : 0;

  const destinationLabel = `${selectedDevice?.destinationLabel || DEFAULT_DESTINATION}${prefs.organizeByAuthor ? `/${t("library:kindle.authorFolder")}` : ""}`;

  const openConversionWindow = () => {
    if (!selectedDevice) return;
    prepareKindleSend(books, { deviceId: selectedDevice.id, deviceName: selectedDevice.name });
    window.dispatchEvent(new CustomEvent("lyceum:open-conversion"));
    onClose();
  };

  const run = async (targets: BookWithThumbnail[]) => {
    if (targets.length === 0 || sendingRef.current) return;
    const runMode = mode;
    sendingRef.current = true;
    setSending(true);
    setStopping(false);
    setRunIds(targets.map((book) => book.fileHash));
    setLastEmailRun(runMode === "email");
    setProgress((current) => {
      const next = new Map(current);
      targets.forEach((book) => next.delete(book.fileHash));
      return next;
    });
    setResults((current) => {
      const next = new Map(current[runMode]);
      targets.forEach((book) => next.delete(book.fileHash));
      return { ...current, [runMode]: next };
    });

    const store = (items: KindleSendResultItem[]) => {
      setResults((current) => {
        const next = new Map(current[runMode]);
        items.forEach((item) => next.set(item.fileHash, item));
        return { ...current, [runMode]: next };
      });
    };

    try {
      const response = runMode === "usb"
        ? await window.api.sendBooksToKindle({
            deviceId: selectedDevice?.id,
            books: targets.map(toKindleSendPayload),
            convertToAzw3: prefs.convertToAzw3,
            preserveMetadata: prefs.preserveMetadata,
            organizeByAuthor: prefs.organizeByAuthor,
            destination: DEFAULT_DESTINATION,
            pageNumbers,
            conversionOptions,
          })
        : await window.api.sendBooksToKindleEmail({
            books: targets.map(toKindleSendPayload),
            preserveMetadata: prefs.preserveMetadata,
            convertPdfToEpub: prefs.pdfAsEpub,
            compressImages: prefs.compressImages,
          });
      const items = (response.results || []) as KindleSendResultItem[];
      store(items);
      if (items.length === 0 && response.errorCode) {
        toast.error(describeKindleError(response).message);
        if (response.errorCode === "no-device") void refreshDevices();
      }
      const sent = items.filter((item) => item.success).length;
      const failed = items.length - sent;
      if (sent > 0) {
        toast.success(t("library:kindle.toasts.sent", { count: sent }));
        onSent?.();
      }
      if (failed > 0 && items.some((item) => !item.success && item.errorCode !== "canceled")) {
        toast.error(t("library:kindle.toasts.failed", { count: failed }));
      }
    } catch (error) {
      console.error("Error sending to Kindle:", error);
      toast.error(t("library:kindle.toasts.sendFailed"));
    } finally {
      sendingRef.current = false;
      setSending(false);
      setStopping(false);
    }
  };

  const stop = () => {
    setStopping(true);
    void window.api.cancelKindleSend?.();
  };

  const planLabel = (book: BookWithThumbnail): { text: string; blocked: boolean } => {
    const format = getFileTypeLabel(book.fileType, book.filePath).toUpperCase();
    if (mode === "usb") {
      const plan = usbPlans.get(book.fileHash) as UsbPlan;
      if (plan.action === "unsupported") return { text: describeKindleError({ errorCode: plan.reason, errorParams: { format } }).message, blocked: true };
      if (plan.action === "convert") return { text: t("library:kindle.plan.convert", { from: format, to: "AZW3" }), blocked: false };
      return { text: t("library:kindle.plan.copy", { format }), blocked: false };
    }
    const plan = emailPlans.get(book.fileHash) as EmailPlan;
    if (plan.action === "unsupported") return { text: describeKindleError({ errorCode: plan.reason, errorParams: { format } }).message, blocked: true };
    if (plan.action === "send") {
      return plan.tooLarge
        ? { text: t("library:kindle.plan.tooLarge", { size: toMb(book.fileSize || 0), limit: toMb(maxEmailBytes) }), blocked: true }
        : { text: t("library:kindle.plan.send", { format }), blocked: false };
    }
    if (plan.rebuild) return { text: t("library:kindle.plan.rebuild"), blocked: false };
    const base = t("library:kindle.plan.convert", { from: format, to: plan.target.toUpperCase() });
    return { text: plan.compress ? `${base} · ${t("library:kindle.plan.compressed")}` : base, blocked: false };
  };

  const modelValue = isKindleImagePreset(conversionOptions.imagePreset) ? conversionOptions.imagePreset : "original";

  return (
    <aside
      className="lyceum-kindle-send-panel flex h-full w-[400px] flex-shrink-0 flex-col border-l border-border bg-surface text-foreground"
      aria-label={t("library:kindle.aria")}
    >
      <header className="flex-shrink-0 border-b border-border px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">{t("library:kindle.title")}</h2>
            <p className="mt-0.5 truncate text-xs text-foreground-subtle">
              {t("library:kindle.selectedBooks", { count: books.length })} · {formatFileSize(totalSize)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="rounded-sm p-1.5 text-foreground-subtle hover:bg-surface-muted hover:text-foreground disabled:opacity-40"
            title={t("common:actions.close")}
            aria-label={t("common:actions.close")}
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
            <Section>
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <Smartphone size={17} className={`flex-shrink-0 ${selectedDevice ? "text-primary" : "text-foreground-subtle"}`} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {loadingDevices ? t("library:kindle.searching") : selectedDevice?.name || t("library:kindle.noDevice")}
                    </p>
                    <p className="truncate text-xs text-foreground-subtle">
                      {selectedDevice?.isMtp ? t("library:kindle.mtp") : selectedDevice ? t("library:kindle.usb") : t("library:kindle.connectPaperwhite")}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void refreshDevices()}
                  disabled={loadingDevices || sending}
                  className="rounded-sm p-2 text-foreground-subtle hover:bg-surface-muted hover:text-foreground disabled:opacity-50"
                  title={t("library:kindle.refreshDevices")}
                  aria-label={t("library:kindle.refreshDevices")}
                >
                  <RefreshCw size={15} className={loadingDevices ? "animate-spin" : ""} />
                </button>
              </div>
              {devices.length > 1 && (
                <Select value={selectedDevice?.id || ""} onChange={setSelectedDeviceId} className="mt-3 h-9 w-full text-sm" items={devices.map((device) => ({ value: device.id, label: device.name }))} />
              )}
              {selectedDevice && (
                <div className="mt-3 flex items-center gap-2 rounded-sm border border-border bg-surface px-3 py-2 text-xs text-foreground-muted">
                  <Folder size={14} className="flex-shrink-0 text-foreground-subtle" />
                  <span className="truncate">{destinationLabel}</span>
                </div>
              )}
            </Section>

            <Section
              title={t("library:kindle.options.title")}
              action={(
                <button
                  type="button"
                  onClick={openConversionWindow}
                  disabled={sending || !selectedDevice}
                  title={t("library:kindle.options.advancedHint")}
                  className="flex items-center gap-1.5 rounded-sm px-2 py-1 text-xs text-foreground-muted hover:bg-surface-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <SlidersHorizontal size={13} />
                  {t("library:kindle.options.advanced")}
                </button>
              )}
            >
              <div className="space-y-3.5">
                <ToggleRow label={t("library:kindle.convertAzw3")} hint={t("library:kindle.convertAzw3Hint")} checked={prefs.convertToAzw3} disabled={sending} onChange={() => setPrefs({ convertToAzw3: !prefs.convertToAzw3 })} />
                {prefs.convertToAzw3 && (
                  <>
                    <SelectRow
                      label={t("library:kindle.options.model")}
                      hint={t("library:kindle.options.modelHint")}
                      value={modelValue}
                      disabled={sending}
                      onChange={(value) => setConversionOptions(isKindleImagePreset(value)
                        ? { imagePreset: value, kindleProfile: KINDLE_IMAGE_PRESETS[value].kindleProfile }
                        : { imagePreset: "original" })}
                      items={["original", ...KINDLE_MODELS].map((value) => ({ value, label: t(`conversion:options.images.presets.${value}` as TranslationKey) }))}
                    />
                    <SelectRow
                      label={t("library:kindle.options.pdfLayout")}
                      hint={t(`library:kindle.options.pdfLayoutHint.${conversionOptions.epubLayout || "auto"}` as TranslationKey)}
                      value={conversionOptions.epubLayout || "auto"}
                      disabled={sending}
                      onChange={(value) => setConversionOptions({ epubLayout: value as ConversionOptions["epubLayout"] })}
                      items={(["auto", "reflow", "fixed-layout"] as const).map((value) => ({ value, label: t(`library:kindle.conversion.layouts.${value}`) }))}
                    />
                    <SelectRow
                      label={t("library:kindle.options.fonts")}
                      hint={t(`library:kindle.options.fontsHint.${conversionOptions.kindleFontSizes === "original" ? "original" : "kindle"}` as TranslationKey)}
                      value={conversionOptions.kindleFontSizes === "original" ? "original" : "kindle"}
                      disabled={sending}
                      onChange={(value) => setConversionOptions({ kindleFontSizes: value as "kindle" | "original" })}
                      items={(["kindle", "original"] as const).map((value) => ({ value, label: t(`library:kindle.conversion.fonts.${value}`) }))}
                    />
                  </>
                )}
                <SelectRow
                  label={t("library:kindle.pageNumbers.label")}
                  hint={t(`library:kindle.pageNumbers.hint.${pageNumbers}`)}
                  value={pageNumbers}
                  disabled={sending}
                  onChange={(value) => setPageNumbers(value as PageNumbersMode)}
                  items={(["auto", "estimate", "off"] as const).map((value) => ({ value, label: t(`library:kindle.pageNumbers.${value}`) }))}
                />
                <ToggleRow label={t("library:kindle.preserveMetadata")} hint={t("library:kindle.preserveMetadataHint")} checked={prefs.preserveMetadata} disabled={sending} onChange={() => setPrefs({ preserveMetadata: !prefs.preserveMetadata })} />
                <ToggleRow label={t("library:kindle.organizeByAuthor")} hint={t("library:kindle.organizeByAuthorHint")} checked={prefs.organizeByAuthor} disabled={sending} onChange={() => setPrefs({ organizeByAuthor: !prefs.organizeByAuthor })} />
              </div>
            </Section>
          </>
        ) : (
          <>
            <Section title={editingEmail || !emailConfig?.configured ? t("library:kindle.email.configTitle") : undefined}>
              {!emailConfig ? (
                <p className="flex items-center gap-2 text-xs text-foreground-subtle"><RefreshCw size={13} className="animate-spin" />{t("library:kindle.searching")}</p>
              ) : editingEmail || !emailConfig.configured ? (
                <KindleEmailSettingsForm
                  config={emailConfig}
                  onSaved={(config) => {
                    setEmailConfig(config);
                    setEditingEmail(!config.configured);
                  }}
                  onCancel={emailConfig.configured ? () => setEditingEmail(false) : undefined}
                />
              ) : (
                <KindleEmailSummary config={emailConfig} disabled={sending} onEdit={() => setEditingEmail(true)} />
              )}
            </Section>

            <Section title={t("library:kindle.options.title")}>
              <div className="space-y-3.5">
                <SelectRow
                  label={t("library:kindle.options.emailPdf")}
                  hint={t(`library:kindle.options.emailPdfHint.${prefs.pdfAsEpub ? "epub" : "keep"}`)}
                  value={prefs.pdfAsEpub ? "epub" : "keep"}
                  disabled={sending}
                  onChange={(value) => setPrefs({ pdfAsEpub: value === "epub" })}
                  items={[
                    { value: "keep", label: t("library:kindle.options.emailPdfKeep") },
                    { value: "epub", label: t("library:kindle.options.emailPdfEpub") },
                  ]}
                />
                <ToggleRow label={t("library:kindle.options.compressImages")} hint={t("library:kindle.options.compressImagesHint")} checked={prefs.compressImages} disabled={sending} onChange={() => setPrefs({ compressImages: !prefs.compressImages })} />
                <ToggleRow label={t("library:kindle.preserveMetadata")} hint={t("library:kindle.preserveMetadataHint")} checked={prefs.preserveMetadata} disabled={sending} onChange={() => setPrefs({ preserveMetadata: !prefs.preserveMetadata })} />
              </div>
              <p className="mt-3 text-[11px] leading-4 text-foreground-subtle">{t("library:kindle.email.limitHint", { size: Math.floor(toMb(maxEmailBytes)) })}</p>
            </Section>

            {lastEmailRun && finished && sentCount > 0 && emailConfig && (
              <div className="mb-4 flex gap-2.5 rounded-sm border border-info/40 bg-info/10 p-3" role="status">
                <Info size={16} className="mt-0.5 flex-shrink-0 text-info" />
                <div className="min-w-0 space-y-1.5">
                  <p className="text-sm font-medium text-foreground">{t("library:kindle.delivery.title")}</p>
                  <p className="text-xs leading-5 text-foreground-muted">{t("library:kindle.delivery.body", { sender: emailConfig.senderAddress })}</p>
                  {window.api.openKindlePersonalDocuments && (
                    <button
                      type="button"
                      onClick={() => void window.api.openKindlePersonalDocuments()}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground underline-offset-2 hover:underline"
                    >
                      <ExternalLink size={12} />
                      {t("library:kindle.delivery.openAmazon")}
                    </button>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        <section>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-foreground-subtle">{t("library:kindle.selectedHeading")}</h3>
          <ul className="space-y-2">
            {books.map((book) => (
              <BookRow
                key={book.fileHash}
                book={book}
                plan={planLabel(book)}
                result={modeResults.get(book.fileHash)}
                live={progress.get(book.fileHash)}
                queued={sending && runIds.includes(book.fileHash) && !modeResults.has(book.fileHash) && !progress.has(book.fileHash)}
                mode={mode}
              />
            ))}
          </ul>
        </section>
      </div>

      <footer className="flex-shrink-0 border-t border-border bg-overlay p-4">
        {sending ? (
          <div className="mb-3" aria-live="polite">
            <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
              <span className="min-w-0 truncate text-foreground">
                {stopping
                  ? t("library:kindle.run.stopping")
                  : currentBook
                    ? t("library:kindle.run.current", { stage: kindleStageLabel(currentProgress?.stage ?? "preparing"), title: getTitleWithoutExtension(currentBook.title, currentBook.fileType) })
                    : t("library:kindle.sending")}
              </span>
              <span className="flex-shrink-0 tabular-nums text-foreground-subtle">{t("library:kindle.run.progress", { done: runDone, total: runIds.length })}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-border" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(overall * 100)}>
              <div className="h-full bg-primary transition-[width] duration-300" style={{ width: `${Math.round(overall * 100)}%` }} />
            </div>
          </div>
        ) : (
          <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-foreground-subtle">
            {finished ? (
              <>
                <span className="inline-flex items-center gap-1 text-primary"><CheckCircle2 size={13} />{t("library:kindle.run.result_sent", { count: sentCount })}</span>
                {modeResults.size - sentCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-destructive"><AlertCircle size={13} />{t("library:kindle.run.result_failed", { count: modeResults.size - sentCount })}</span>
                )}
              </>
            ) : mode === "email" && !emailReady ? (
              <span>{t("library:kindle.email.notConfigured")}</span>
            ) : (
              <>
                <span>{t("library:kindle.run.planSummary", { send: sendableBooks.length })}</span>
                {conversionCount > 0 && <span>· {t("library:kindle.run.planConversions", { count: conversionCount })}</span>}
                {blockedCount > 0 && <span className="text-destructive">· {t("library:kindle.run.planBlocked", { count: blockedCount })}</span>}
              </>
            )}
          </div>
        )}
        <div className="flex gap-2">
          {sending ? (
            <button
              type="button"
              onClick={stop}
              disabled={stopping}
              className="flex h-10 flex-1 items-center justify-center gap-2 rounded-sm border border-border bg-background text-sm text-foreground hover:bg-surface-muted disabled:opacity-50"
            >
              <Square size={13} />
              {t("library:kindle.run.stop")}
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="h-10 flex-1 rounded-sm border border-border bg-background text-sm text-foreground hover:bg-surface-muted"
            >
              {finished ? t("library:kindle.run.close") : t("common:actions.cancel")}
            </button>
          )}
          {finished && failedBooks.length > 0 ? (
            <button
              type="button"
              onClick={() => void run(failedBooks)}
              disabled={!canSend}
              className="flex h-10 flex-[1.6] items-center justify-center gap-2 rounded-sm bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RotateCcw size={15} />
              {t("library:kindle.run.retry", { count: failedBooks.length })}
            </button>
          ) : !finished || sending ? (
            <button
              type="button"
              onClick={() => void run(sendableBooks)}
              disabled={sending || sendableBooks.length === 0 || !canSend}
              className="flex h-10 flex-[1.6] items-center justify-center gap-2 rounded-sm bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sending ? <RefreshCw size={16} className="animate-spin" /> : mode === "email" ? <Mail size={16} /> : <Send size={16} />}
              {sending
                ? t("library:kindle.sending")
                : mode === "email"
                  ? t("library:kindle.email.send", { count: sendableBooks.length })
                  : t("library:kindle.send", { count: sendableBooks.length })}
            </button>
          ) : null}
        </div>
      </footer>
    </aside>
  );
}

function BookRow({ book, plan, result, live, queued, mode }: {
  book: BookWithThumbnail;
  plan: { text: string; blocked: boolean };
  result?: KindleSendResultItem;
  live?: LiveProgress;
  queued: boolean;
  mode: SendMode;
}) {
  const { t } = useTranslation();
  const running = !result && live && live.stage !== "done";
  const error = result && !result.success ? describeKindleError(result) : null;
  const percent = Math.round((live?.progress ?? 0) * 100);

  return (
    <li className="flex min-w-0 gap-3 rounded-sm border border-border bg-background/60 p-2.5">
      <MiniCover book={book} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{getTitleWithoutExtension(book.title, book.fileType)}</p>
        <p className="mt-0.5 truncate text-xs text-foreground-subtle">
          {book.author || t("library:kindle.unknownAuthor")} · {formatFileSize(book.fileSize)}
        </p>

        {result?.success ? (
          <div className="mt-1.5 space-y-0.5 text-xs">
            <p className="flex items-center gap-1.5 text-primary">
              <CheckCircle2 size={13} className="flex-shrink-0" />
              <span className="truncate">
                {mode === "email"
                  ? t("library:kindle.run.emailAccepted")
                  : result.verified ? t("library:kindle.run.verified") : t("library:kindle.run.unverified")}
              </span>
            </p>
            <p className="pl-5 text-[11px] text-foreground-subtle">
              {result.outputFormat && t("library:kindle.run.sentAs", { format: result.outputFormat.toUpperCase() })}
              {result.pageCount ? ` · ${t("library:kindle.pageNumbers.added", { count: result.pageCount })}` : ""}
            </p>
          </div>
        ) : error ? (
          <div className="mt-1.5 text-xs">
            <p className={`flex items-start gap-1.5 ${result?.errorCode === "canceled" ? "text-foreground-muted" : "text-destructive"}`}>
              <AlertCircle size={13} className="mt-0.5 flex-shrink-0" />
              <span className="break-words">{error.message}</span>
            </p>
            {error.detail && (
              <details className="mt-1 pl-5 text-[11px] text-foreground-subtle">
                <summary className="cursor-pointer select-none hover:text-foreground">{t("library:kindle.run.showDetail")}</summary>
                <p className="mt-1 break-words font-mono">{error.detail}</p>
              </details>
            )}
          </div>
        ) : running ? (
          <div className="mt-1.5">
            <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
              <span className="truncate text-foreground">{kindleStageLabel(live.stage)}</span>
              <span className="flex-shrink-0 tabular-nums text-foreground-subtle">{percent}%</span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-border">
              <div className="h-full bg-primary transition-[width] duration-300" style={{ width: `${percent}%` }} />
            </div>
            {live.detail && <p className="mt-1 truncate text-[11px] text-foreground-subtle" title={live.detail}>{live.detail}</p>}
          </div>
        ) : (
          <p className={`mt-1.5 flex items-center gap-1.5 text-xs ${plan.blocked ? "text-destructive" : "text-foreground-muted"}`}>
            {plan.blocked ? <AlertCircle size={13} className="flex-shrink-0" /> : queued ? <Clock size={13} className="flex-shrink-0" /> : <ArrowRight size={13} className="flex-shrink-0" />}
            <span className={plan.blocked ? "break-words" : "truncate"}>{queued ? kindleStageLabel("queued") : plan.text}</span>
          </p>
        )}
      </div>
    </li>
  );
}
