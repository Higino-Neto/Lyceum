import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";

export interface NativeSourceFile {
  uri: string;
  name: string;
  relativePath: string;
  mimeType: string;
  size: number;
}

interface SourceFoldersPlugin {
  pickFolder(): Promise<{ uri: string; name: string }>;
  scanFolder(options: { uri: string }): Promise<{ name: string; files: NativeSourceFile[] }>;
  readFile(options: { uri: string; requestId: string; size: number }): Promise<{ base64: string }>;
  cancelRead(options: { requestId: string }): Promise<void>;
  releaseFolder(options: { uri: string }): Promise<void>;
  addListener(eventName: "sourceImportProgress", listener: (event: { requestId: string; loaded: number; total: number }) => void): Promise<PluginListenerHandle>;
}

const SourceFolders = registerPlugin<SourceFoldersPlugin>("SourceFolders");

export function supportsPersistentSourceFolders() {
  return Capacitor.getPlatform() === "android";
}

export async function pickPersistentSourceFolder() {
  return SourceFolders.pickFolder();
}

export async function scanPersistentSourceFolder(uri: string) {
  return SourceFolders.scanFolder({ uri });
}

export async function loadPersistentSourceFile(
  file: NativeSourceFile,
  onProgress: (loaded: number, total: number) => void = () => undefined,
  signal?: AbortSignal,
) {
  const requestId = `source_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const listener = await SourceFolders.addListener("sourceImportProgress", (event) => {
    if (event.requestId === requestId) onProgress(event.loaded, event.total || file.size);
  });
  const abort = () => { void SourceFolders.cancelRead({ requestId }); };
  signal?.addEventListener("abort", abort, { once: true });
  try {
    const { base64 } = await SourceFolders.readFile({ uri: file.uri, requestId, size: file.size });
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    onProgress(bytes.length, file.size || bytes.length);
    return new File([bytes], file.name, { type: file.mimeType || "application/octet-stream" });
  } finally {
    signal?.removeEventListener("abort", abort);
    await listener.remove();
  }
}

export async function releasePersistentSourceFolder(uri: string) {
  if (!supportsPersistentSourceFolders()) return;
  await SourceFolders.releaseFolder({ uri });
}
