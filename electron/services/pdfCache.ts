export const MAX_CACHED_PDF_BUFFERS = 30;
export const MAX_CACHED_PDF_BYTES = 128 * 1024 * 1024;

/** Byte-bounded LRU for PDFs that cannot currently be served from a file. */
export class PdfBufferCache {
  private buffers = new Map<string, Buffer>();
  private totalBytes = 0;

  constructor(private readonly maxEntries: number, private readonly maxBytes: number) {}

  set(fileHash: string, buffer: ArrayBuffer | Buffer): void {
    if (!fileHash || !buffer) return;
    const value = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
    const previous = this.buffers.get(fileHash);
    if (previous) this.totalBytes -= previous.byteLength;
    this.buffers.delete(fileHash);
    if (value.byteLength === 0 || value.byteLength > this.maxBytes) return;

    this.buffers.set(fileHash, value);
    this.totalBytes += value.byteLength;
    while (this.buffers.size > this.maxEntries || this.totalBytes > this.maxBytes) {
      const oldest = this.buffers.keys().next().value as string | undefined;
      if (!oldest) break;
      this.totalBytes -= this.buffers.get(oldest)?.byteLength ?? 0;
      this.buffers.delete(oldest);
    }
  }

  get(fileHash: string): Buffer | undefined {
    const buffer = this.buffers.get(fileHash);
    if (buffer) {
      this.buffers.delete(fileHash);
      this.buffers.set(fileHash, buffer);
    }
    return buffer;
  }
}

const pdfBuffers = new PdfBufferCache(MAX_CACHED_PDF_BUFFERS, MAX_CACHED_PDF_BYTES);

export function cachePdfBuffer(fileHash: string, buffer: ArrayBuffer | Buffer): void {
  pdfBuffers.set(fileHash, buffer);
}

export function getCachedPdfBuffer(fileHash: string): Buffer | undefined {
  return pdfBuffers.get(fileHash);
}
