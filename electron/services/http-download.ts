import http from "node:http";
import https from "node:https";

export interface HttpDownloadOptions {
  headers?: Record<string, string>;
  maxBytes?: number;
  onProgress?: (percent: number) => void;
  redirectsLeft?: number;
}

/** Buffer a small/medium HTTP asset using APIs available in Electron 22's Node 16. */
export function downloadHttpBuffer(input: string, options: HttpDownloadOptions = {}): Promise<Buffer> {
  const url = new URL(input);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return Promise.reject(new Error(`Unsupported download protocol: ${url.protocol}`));
  }

  const transport = url.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const request = transport.get(url, { headers: options.headers }, (response) => {
      const status = response.statusCode || 0;
      if (status >= 300 && status < 400 && response.headers.location) {
        response.resume();
        const redirectsLeft = options.redirectsLeft ?? 5;
        if (redirectsLeft <= 0) {
          reject(new Error("Too many HTTP redirects"));
          return;
        }
        const redirectUrl = new URL(response.headers.location, url).toString();
        downloadHttpBuffer(redirectUrl, { ...options, redirectsLeft: redirectsLeft - 1 }).then(resolve, reject);
        return;
      }
      if (status < 200 || status >= 300) {
        response.resume();
        reject(new Error(`Download failed with HTTP ${status}`));
        return;
      }

      const expectedBytes = Number(response.headers["content-length"] || 0);
      if (options.maxBytes && expectedBytes > options.maxBytes) {
        response.destroy();
        reject(new Error(`Download exceeds ${options.maxBytes} bytes`));
        return;
      }

      const chunks: Buffer[] = [];
      let receivedBytes = 0;
      response.on("data", (chunk: Buffer | Uint8Array) => {
        const bytes = Buffer.from(chunk);
        receivedBytes += bytes.length;
        if (options.maxBytes && receivedBytes > options.maxBytes) {
          response.destroy(new Error(`Download exceeds ${options.maxBytes} bytes`));
          return;
        }
        chunks.push(bytes);
        if (expectedBytes > 0) options.onProgress?.(Math.min(100, Math.round(receivedBytes / expectedBytes * 100)));
      });
      response.on("end", () => resolve(Buffer.concat(chunks)));
      response.on("error", reject);
    });
    request.on("error", reject);
  });
}
