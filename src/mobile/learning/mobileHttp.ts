import { Capacitor, CapacitorHttp } from "@capacitor/core";

function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

/**
 * Downloads bytes. On Android the request goes through native HTTP
 * (`CapacitorHttp`), which follows redirects and is not subject to CORS —
 * download.freedict.org does not send CORS headers.
 */
export async function fetchBytes(url: string): Promise<Uint8Array> {
  if (Capacitor.isNativePlatform()) {
    const response = await CapacitorHttp.get({ url, responseType: "arraybuffer", connectTimeout: 20_000, readTimeout: 120_000 });
    if (response.status < 200 || response.status >= 300) throw new Error(`HTTP_${response.status}`);
    if (typeof response.data === "string") return base64ToBytes(response.data);
    if (response.data instanceof ArrayBuffer) return new Uint8Array(response.data);
    throw new Error("UNEXPECTED_RESPONSE");
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP_${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

/** `fetch` replacement for JSON APIs without CORS headers (native HTTP on Android). */
export const nativeFetch: typeof fetch = async (input, init) => {
  if (!Capacitor.isNativePlatform()) return fetch(input, init);
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  const response = await CapacitorHttp.get({ url, responseType: "text", connectTimeout: 15_000, readTimeout: 15_000 });
  const body = typeof response.data === "string" ? response.data : JSON.stringify(response.data);
  return new Response(body, { status: response.status, headers: response.headers });
};
