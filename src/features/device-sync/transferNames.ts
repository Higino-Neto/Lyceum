/**
 * Naming scheme for books sent between a user's devices. Everything the
 * receiver needs to show and file the book is encoded in the Storage object
 * name, so one `list` call is enough to see what is waiting:
 *
 *   <uid>/books/<sentAt>_<platform>_<deviceId>__<base64url(file name)>.<ext>
 */

export type TransferPlatform = "desktop" | "mobile";

export interface IncomingTransfer {
  /** Full Storage object path. */
  path: string;
  fileName: string;
  extension: string;
  sentAt: number;
  platform: TransferPlatform;
  deviceId: string;
  size: number | null;
}

/** Formats every Lyceum build can open (desktop and mobile). */
export const PORTABLE_BOOK_EXTENSIONS = ["epub", "pdf"] as const;
/** What each platform accepts when receiving. */
export const RECEIVABLE_EXTENSIONS: Record<TransferPlatform, readonly string[]> = {
  desktop: ["epub", "pdf", "cbz", "mobi", "azw", "azw3", "kfx"],
  mobile: ["epub", "pdf", "txt"],
};

export function fileExtension(fileName: string): string {
  const match = /\.([a-z0-9]{1,8})$/i.exec(fileName.trim());
  return match?.[1]?.toLowerCase() ?? "";
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): string | null {
  try {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

/** Keeps names readable but bounded (Storage keys are limited to 1024 bytes). */
function boundedFileName(fileName: string): string {
  const clean = fileName.replace(/[\\/]/g, "_").trim() || "book";
  if (clean.length <= 180) return clean;
  const extension = fileExtension(clean);
  const stem = clean.slice(0, 180 - extension.length - 1);
  return extension ? `${stem}.${extension}` : stem;
}

export function transferObjectName(input: { fileName: string; platform: TransferPlatform; deviceId: string; sentAt?: number }): string {
  const fileName = boundedFileName(input.fileName);
  const extension = fileExtension(fileName) || "bin";
  const deviceId = input.deviceId.replace(/[^a-z0-9]/gi, "").slice(0, 16) || "device";
  return `${input.sentAt ?? Date.now()}_${input.platform}_${deviceId}__${toBase64Url(fileName)}.${extension}`;
}

const OBJECT_NAME = /^(\d{10,16})_(desktop|mobile)_([a-z0-9]{1,16})__([A-Za-z0-9_-]+)\.([a-z0-9]{1,8})$/i;

export function parseTransferObjectName(folder: string, name: string, size: number | null = null): IncomingTransfer | null {
  const match = OBJECT_NAME.exec(name);
  if (!match) return null;
  const [, sentAt = "", platform = "", deviceId = "", encodedName = "", extension = ""] = match;
  const fileName = fromBase64Url(encodedName);
  if (!fileName) return null;
  return {
    path: `${folder}/${name}`,
    fileName,
    extension: extension.toLowerCase(),
    sentAt: Number(sentAt),
    platform: platform.toLowerCase() as TransferPlatform,
    deviceId,
    size,
  };
}

export function canReceive(platform: TransferPlatform, transfer: Pick<IncomingTransfer, "extension">): boolean {
  return RECEIVABLE_EXTENSIONS[platform].includes(transfer.extension);
}
