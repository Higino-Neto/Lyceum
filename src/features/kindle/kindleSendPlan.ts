/**
 * What happens to each book when it is sent to a Kindle, by USB or by e-mail.
 *
 * Pure and dependency-free: the send panel uses it to show the plan before
 * anything runs, and the main process uses the same rules to execute it, so
 * the preview and the real send can never disagree.
 */

/** Read by the Kindle as-is when copied over USB. */
export const USB_DIRECT_FORMATS = new Set(["azw3", "azw", "mobi", "prc", "kfx", "pdf", "txt"]);
/** Lyceum can convert these to AZW3 for USB. */
export const USB_CONVERTIBLE_FORMATS = new Set(["pdf", "epub", "txt", "html", "cbz", "cbr", "docx", "fb2"]);

/** Accepted by Amazon's Send to Kindle e-mail service and sent untouched. */
export const EMAIL_DIRECT_FORMATS = new Set(["epub", "pdf", "docx", "doc", "rtf"]);
/** Rejected (or poorly handled) by Amazon by e-mail; Lyceum converts them to EPUB first. */
export const EMAIL_TO_EPUB_FORMATS = new Set(["mobi", "azw", "azw3", "prc", "fb2", "txt", "html", "htm"]);
/** Comics: sent as PDF (one page per image). */
export const EMAIL_TO_PDF_FORMATS = new Set(["cbz", "cbr"]);

export type KindleSendMode = "usb" | "email";

export type KindleSendStage =
  | "queued"
  | "preparing"
  | "converting"
  | "validating"
  | "pageNumbers"
  | "copying"
  | "cover"
  | "sending"
  | "cleaning"
  | "done";

export type KindleSendErrorCode =
  | "source-missing"
  | "unsupported-format"
  | "kfx-email"
  | "needs-azw3"
  | "invalid-azw3"
  | "too-large"
  | "canceled"
  | "no-device"
  | "copy-failed"
  | "conversion-failed"
  | "not-configured"
  | "google-not-connected"
  | "smtp-app-password"
  | "smtp-auth"
  | "smtp-connection"
  | "smtp-too-large"
  | "invalid-kindle-address"
  | "invalid-sender"
  | "unknown";

export interface KindleSendError {
  code: KindleSendErrorCode;
  params?: Record<string, string | number>;
  /** Raw technical detail (server reply, exception text) shown under the message. */
  detail?: string;
}

export type UsbPlan =
  | { action: "copy"; target: string }
  | { action: "convert"; target: "azw3" }
  | { action: "unsupported"; reason: "needs-azw3" | "unsupported-format" };

export function normalizeBookFormat(format: string | null | undefined): string {
  return (format || "").toLowerCase().replace(/^\./, "");
}

export function planUsbBook(format: string, options: { convertToAzw3: boolean }): UsbPlan {
  const value = normalizeBookFormat(format);
  if (options.convertToAzw3 && value !== "azw3" && USB_CONVERTIBLE_FORMATS.has(value)) {
    return { action: "convert", target: "azw3" };
  }
  if (USB_DIRECT_FORMATS.has(value)) return { action: "copy", target: value };
  if (USB_CONVERTIBLE_FORMATS.has(value)) return { action: "unsupported", reason: "needs-azw3" };
  return { action: "unsupported", reason: "unsupported-format" };
}

export interface EmailPlanOptions {
  /** Convert PDFs to reflowable EPUB instead of sending the original layout. */
  pdfAsEpub: boolean;
  /** Downscale/recompress images while converting, and rebuild oversized EPUBs. */
  compressImages: boolean;
  /** Largest attachment the configured account can send (already base64-adjusted). */
  maxBytes: number;
}

export type EmailPlan =
  | { action: "send"; target: string; tooLarge: boolean }
  | { action: "convert"; target: "epub" | "pdf"; compress: boolean; rebuild?: boolean }
  | { action: "unsupported"; reason: "kfx-email" | "unsupported-format" };

export function planEmailBook(format: string, sizeBytes: number | null | undefined, options: EmailPlanOptions): EmailPlan {
  const value = normalizeBookFormat(format);
  if (value === "kfx" || value === "azw4") return { action: "unsupported", reason: "kfx-email" };
  if (EMAIL_TO_PDF_FORMATS.has(value)) return { action: "convert", target: "pdf", compress: options.compressImages };
  if (value === "pdf" && options.pdfAsEpub) return { action: "convert", target: "epub", compress: options.compressImages };
  if (EMAIL_TO_EPUB_FORMATS.has(value)) return { action: "convert", target: "epub", compress: options.compressImages };
  if (EMAIL_DIRECT_FORMATS.has(value)) {
    const tooLarge = (sizeBytes || 0) > options.maxBytes;
    // An oversized EPUB can usually be rescued by recompressing its images.
    if (tooLarge && value === "epub" && options.compressImages) {
      return { action: "convert", target: "epub", compress: true, rebuild: true };
    }
    return { action: "send", target: value, tooLarge };
  }
  return { action: "unsupported", reason: "unsupported-format" };
}

export function isEmailPlanSendable(plan: EmailPlan): boolean {
  return plan.action === "convert" || (plan.action === "send" && !plan.tooLarge);
}

export function isUsbPlanSendable(plan: UsbPlan): boolean {
  return plan.action !== "unsupported";
}

const MB = 1024 * 1024;

/** Message size limits per provider (Amazon itself caps at 50 MB per e-mail). */
export const EMAIL_MESSAGE_LIMITS_BYTES: Record<string, number> = {
  gmail: 25 * MB,
  outlook: 20 * MB,
  icloud: 20 * MB,
  yahoo: 25 * MB,
  custom: 50 * MB,
};
export const AMAZON_EMAIL_MESSAGE_LIMIT_BYTES = 50 * MB;

/**
 * Attachments travel base64-encoded (4/3 of their size) plus MIME headers, so
 * a 25 MB message only fits a ~18 MB file.
 */
export function maxAttachmentBytesForMessage(messageBytes: number): number {
  return Math.floor((messageBytes * 3) / 4) - 64 * 1024;
}

export function maxEmailAttachmentBytes(provider: string | null | undefined): number {
  const message = Math.min(EMAIL_MESSAGE_LIMITS_BYTES[provider || "custom"] ?? AMAZON_EMAIL_MESSAGE_LIMIT_BYTES, AMAZON_EMAIL_MESSAGE_LIMIT_BYTES);
  return maxAttachmentBytesForMessage(message);
}

/** Image settings used when the user asks to shrink files for e-mail. */
export const EMAIL_COMPRESSED_IMAGES = {
  imagePreset: "custom" as const,
  imageMaxWidth: 1264,
  imageMaxHeight: 1680,
  imageQuality: 70,
};

/** Where the user approves senders and finds their @kindle.com address. */
export const AMAZON_PERSONAL_DOCUMENTS_URL = "https://www.amazon.com/mycd";
