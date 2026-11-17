/**
 * MyMemory public translation endpoint (no credentials). Only called when the
 * user enables online translation; text leaves the device.
 */
export async function translateWithMyMemory(text: string, source: string, target: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  const query = new URLSearchParams({ q: text, langpair: `${source}|${target}` });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetchImpl(`https://api.mymemory.translated.net/get?${query.toString()}`, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP_${response.status}`);
    const payload = await response.json() as { responseStatus?: number; responseData?: { translatedText?: string } };
    const translated = payload.responseData?.translatedText?.replace(/\s+/g, " ").trim();
    if (!translated || (payload.responseStatus !== undefined && payload.responseStatus !== 200)) throw new Error("EMPTY_TRANSLATION");
    return translated;
  } finally {
    clearTimeout(timeout);
  }
}
