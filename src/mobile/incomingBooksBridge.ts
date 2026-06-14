import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";

export interface NativeImportFile {
  uri: string;
  name: string;
  size: number;
  mimeType: string;
}

interface IncomingBooksPlugin {
  pickFiles(): Promise<{ files: NativeImportFile[] }>;
  getPendingFiles(): Promise<{ files: NativeImportFile[] }>;
  readFile(options: { uri: string; requestId: string }): Promise<{ base64: string }>;
  cancelRead(options: { requestId: string }): Promise<void>;
  acknowledge(options: { uri: string }): Promise<void>;
  addListener(eventName: "incomingFiles", listener: (event: { count: number }) => void): Promise<PluginListenerHandle>;
  addListener(eventName: "importProgress", listener: (event: { requestId: string; loaded: number; total: number }) => void): Promise<PluginListenerHandle>;
}

const IncomingBooks = registerPlugin<IncomingBooksPlugin>("IncomingBooks");

export function supportsNativeIncomingBooks() {
  return Capacitor.isNativePlatform();
}

export function supportsNativeDocumentPicker() {
  return Capacitor.getPlatform() === "android";
}

export async function pickNativeBooks() {
  return (await IncomingBooks.pickFiles()).files;
}

export async function getPendingNativeBooks() {
  return (await IncomingBooks.getPendingFiles()).files;
}

export async function listenForIncomingBooks(listener: () => void) {
  return IncomingBooks.addListener("incomingFiles", listener);
}

export async function loadNativeBook(
  nativeFile: NativeImportFile,
  onProgress: (loaded: number, total: number) => void,
  signal?: AbortSignal,
) {
  const requestId = `incoming_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const progressListener = await IncomingBooks.addListener("importProgress", (event) => {
    if (event.requestId === requestId) onProgress(event.loaded, event.total || nativeFile.size);
  });
  const abort = () => { void IncomingBooks.cancelRead({ requestId }); };
  signal?.addEventListener("abort", abort, { once: true });
  try {
    if (signal?.aborted) throw new DOMException("Importacao cancelada", "AbortError");
    const { base64 } = await IncomingBooks.readFile({ uri: nativeFile.uri, requestId });
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    onProgress(bytes.length, nativeFile.size || bytes.length);
    return new File([bytes], nativeFile.name, { type: nativeFile.mimeType || "application/octet-stream" });
  } finally {
    signal?.removeEventListener("abort", abort);
    await progressListener.remove();
  }
}

export async function acknowledgeNativeBook(uri: string) {
  await IncomingBooks.acknowledge({ uri });
}
