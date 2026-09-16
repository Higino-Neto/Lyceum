const MAX_SOURCES = 100;
const sources = new Map<string, string>();

/** Paths verified when a PDF is opened; the protocol can serve them without retaining its bytes. */
export function registerPdfSource(fileHash: string, filePath: string): void {
  if (!/^[a-f0-9]{64}$/i.test(fileHash) || !filePath) return;
  sources.delete(fileHash);
  sources.set(fileHash, filePath);
  while (sources.size > MAX_SOURCES) {
    const oldest = sources.keys().next().value as string | undefined;
    if (!oldest) break;
    sources.delete(oldest);
  }
}

export function getPdfSource(fileHash: string): string | undefined {
  const filePath = sources.get(fileHash);
  if (filePath) {
    sources.delete(fileHash);
    sources.set(fileHash, filePath);
  }
  return filePath;
}
