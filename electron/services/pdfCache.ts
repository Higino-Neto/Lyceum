export const MAX_CACHED_PDF_BUFFERS = 30;

const pdfBuffers = new Map<string, Buffer>();

export function cachePdfBuffer(fileHash: string, buffer: ArrayBuffer | Buffer): void {
  if (!fileHash || !buffer) {
    return;
  }

  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  if (buf.length === 0) {
    return;
  }

  pdfBuffers.delete(fileHash);
  pdfBuffers.set(fileHash, buf);

  while (pdfBuffers.size > MAX_CACHED_PDF_BUFFERS) {
    const oldest = pdfBuffers.keys().next().value as string | undefined;
    if (oldest === undefined) {
      break;
    }
    pdfBuffers.delete(oldest);
  }
}

export function getCachedPdfBuffer(fileHash: string): Buffer | undefined {
  return pdfBuffers.get(fileHash);
}
