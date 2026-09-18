import type { Session } from "electron";

const SHARED_POLICY = [
  "default-src 'self'",
  "worker-src 'self' blob: lyceum-pdfjs:",
  "frame-src 'self' blob: pdf-resource: lyceum-pdfjs: lyceum-pdf: thumb:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: thumb: img-preview: lyceum-pdfjs: https://*.supabase.co https://covers.openlibrary.org https://books.google.com https://*.googleusercontent.com https://www.loc.gov https://tile.loc.gov",
  "font-src 'self' data: lyceum-pdfjs:",
  "object-src 'none'",
  "base-uri 'self'",
];

const REMOTE_CONNECTIONS = "https://*.supabase.co https://openlibrary.org https://covers.openlibrary.org https://www.googleapis.com https://books.google.com https://www.loc.gov https://loc.gov";

export function contentSecurityPolicy(isDevelopment: boolean): string {
  const scripts = isDevelopment
    ? "script-src 'self' 'unsafe-eval'"
    : "script-src 'self'";
  const developmentConnections = isDevelopment ? " http://localhost:* ws: wss:" : "";
  const connections = `connect-src 'self' blob: lyceum-pdf: lyceum-pdfjs: ${REMOTE_CONNECTIONS}${developmentConnections}`;
  return [SHARED_POLICY[0], scripts, ...SHARED_POLICY.slice(1, 5), connections, ...SHARED_POLICY.slice(5)].join("; ") + ";";
}

export function shouldBypassContentSecurityPolicy(url: string): boolean {
  return [
    "http://localhost",
    "http://127.0.0.1",
    "file://",
    "pdf-resource://",
    "blob:",
    "data:",
  ].some((prefix) => url.startsWith(prefix));
}

export function installContentSecurityPolicy(
  electronSession: Session,
  isDevelopment: boolean,
) {
  const policy = contentSecurityPolicy(isDevelopment);
  electronSession.webRequest.onHeadersReceived((details, callback) => {
    if (shouldBypassContentSecurityPolicy(details.url)) {
      callback({ responseHeaders: details.responseHeaders });
      return;
    }
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [policy],
      },
    });
  });
}
