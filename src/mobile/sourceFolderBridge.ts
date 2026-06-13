import { Capacitor, registerPlugin } from "@capacitor/core";

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
  readFile(options: { uri: string }): Promise<{ base64: string }>;
  releaseFolder(options: { uri: string }): Promise<void>;
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

export async function loadPersistentSourceFile(file: NativeSourceFile) {
  const { base64 } = await SourceFolders.readFile({ uri: file.uri });
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new File([bytes], file.name, { type: file.mimeType || "application/octet-stream" });
}

export async function releasePersistentSourceFolder(uri: string) {
  if (!supportsPersistentSourceFolders()) return;
  await SourceFolders.releaseFolder({ uri });
}
