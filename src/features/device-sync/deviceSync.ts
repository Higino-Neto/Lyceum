import { getSupabaseClient, isSupabaseConfigured } from "../../lib/supabase";
import { isLearningBackup, type LearningBackup } from "../../core/language-learning/model";
import { parseTransferObjectName, transferObjectName, type IncomingTransfer, type TransferPlatform } from "./transferNames";

/**
 * Supabase Storage access for device sync (bucket created by migration 019).
 * Shared by the desktop renderer and the mobile WebView.
 */
export const DEVICE_SYNC_BUCKET = "device-sync";
const DEVICE_ID_KEY = "lyceum:device-id";

export class DeviceSyncError extends Error {
  constructor(public code: "NOT_SIGNED_IN" | "NOT_CONFIGURED" | "STORAGE", message?: string) {
    super(message ?? code);
  }
}

/** Stable id for this installation, used to skip books it sent itself. */
export function getDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing && /^[a-z0-9]{6,16}$/.test(existing)) return existing;
    const created = Array.from(crypto.getRandomValues(new Uint8Array(6)), (byte) => byte.toString(16).padStart(2, "0")).join("");
    localStorage.setItem(DEVICE_ID_KEY, created);
    return created;
  } catch {
    return "unknown";
  }
}

function storage() {
  return getSupabaseClient().storage.from(DEVICE_SYNC_BUCKET);
}

export async function currentSyncUserId(): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  const { data } = await getSupabaseClient().auth.getSession();
  return data.session?.user.id ?? null;
}

async function requireUserId(): Promise<string> {
  if (!isSupabaseConfigured) throw new DeviceSyncError("NOT_CONFIGURED");
  const userId = await currentSyncUserId();
  if (!userId) throw new DeviceSyncError("NOT_SIGNED_IN");
  return userId;
}

function storageError(error: { message?: string } | null | undefined): DeviceSyncError {
  return new DeviceSyncError("STORAGE", error?.message || "Storage request failed");
}

function isNotFound(error: unknown): boolean {
  const candidate = error as { status?: number; statusCode?: string | number; message?: string } | null;
  if (!candidate) return false;
  return candidate.status === 404 || String(candidate.statusCode) === "404" || /not.?found/i.test(candidate.message ?? "");
}

// --- Books -------------------------------------------------------------------

export async function sendBookToDevices(input: { fileName: string; bytes: Uint8Array | Blob; contentType?: string; platform: TransferPlatform }) {
  const userId = await requireUserId();
  const name = transferObjectName({ fileName: input.fileName, platform: input.platform, deviceId: getDeviceId() });
  const body = input.bytes instanceof Blob ? input.bytes : new Blob([input.bytes as BlobPart], { type: input.contentType || "application/octet-stream" });
  const { error } = await storage().upload(`${userId}/books/${name}`, body, {
    contentType: input.contentType || "application/octet-stream",
    upsert: false,
  });
  if (error) throw storageError(error);
}

/** Books waiting in the account, oldest first, excluding the ones this device sent. */
export async function listIncomingBooks(): Promise<IncomingTransfer[]> {
  const userId = await requireUserId();
  const folder = `${userId}/books`;
  const { data, error } = await storage().list(folder, { limit: 200, sortBy: { column: "name", order: "asc" } });
  if (error) throw storageError(error);
  const deviceId = getDeviceId();
  return (data ?? [])
    .map((item) => parseTransferObjectName(folder, item.name, typeof item.metadata?.size === "number" ? item.metadata.size : null))
    .filter((item): item is IncomingTransfer => Boolean(item) && item!.deviceId !== deviceId)
    .sort((a, b) => a.sentAt - b.sentAt);
}

export async function downloadIncomingBook(transfer: IncomingTransfer): Promise<Blob> {
  const { data, error } = await storage().download(transfer.path);
  if (error || !data) throw storageError(error);
  return data;
}

export async function removeIncomingBook(transfer: IncomingTransfer) {
  const { error } = await storage().remove([transfer.path]);
  if (error) throw storageError(error);
}

// --- Vocabulary ------------------------------------------------------------------

function vocabularyPath(userId: string) {
  return `${userId}/learning/vocabulary.json`;
}

export async function downloadVocabularySnapshot(): Promise<LearningBackup | null> {
  const userId = await requireUserId();
  const { data, error } = await storage().download(vocabularyPath(userId));
  if (error) {
    if (isNotFound(error)) return null;
    throw storageError(error);
  }
  if (!data) return null;
  const parsed: unknown = JSON.parse(await data.text());
  if (!isLearningBackup(parsed)) throw new DeviceSyncError("STORAGE", "INVALID_SNAPSHOT");
  return parsed;
}

export async function uploadVocabularySnapshot(backup: LearningBackup) {
  const userId = await requireUserId();
  const body = new Blob([JSON.stringify(backup)], { type: "application/json" });
  const { error } = await storage().upload(vocabularyPath(userId), body, {
    contentType: "application/json",
    cacheControl: "0",
    upsert: true,
  });
  if (error) throw storageError(error);
}
