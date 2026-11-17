import { afterEach, describe, expect, it, vi } from "vitest";
import {
  OfflineDictionaryProvider,
  baseLanguage,
  parseDictionaryHtml,
} from "../../features/language-learning/translation";

const FREEDICT_ENTRY = '<div>/<font color="gray">e.nɔʁm</font>/<br>\n<div><font class="grammar" color="green">adjective</font></div><ol><li><div>enorme</div></li><li><div>imenso, gigantesco</div></li></ol></div>';

function installBridge(index: unknown[], content = FREEDICT_ENTRY) {
  const api = {
    dictionaryGetIndex: vi.fn(async () => index),
    dictionaryLookup: vi.fn(async () => ({ found: true, content })),
  };
  (window as unknown as { api: unknown }).api = api;
  return api;
}

afterEach(() => {
  delete (window as unknown as { api?: unknown }).api;
});

describe("offline dictionary provider", () => {
  it("parses FreeDict/WikDict entries without grammar or pronunciation", () => {
    expect(parseDictionaryHtml(FREEDICT_ENTRY)).toEqual(["enorme", "imenso", "gigantesco"]);
  });

  it("normalizes regional and ISO 639-3 codes", () => {
    expect(baseLanguage("pt-BR")).toBe("pt");
    expect(baseLanguage("fra")).toBe("fr");
  });

  it("uses a downloaded fr→pt dictionary for a pt-BR reader", async () => {
    const api = installBridge([{ id: "fra-por", sourceLang: "fr", targetLang: "pt", isDownloaded: true }]);
    const provider = new OfflineDictionaryProvider();
    const request = { text: "énorme", source: "fr", target: "pt-BR", kind: "word" as const };
    expect(await provider.isAvailable(request)).toBe(true);
    const result = await provider.translate(request);
    expect(api.dictionaryLookup).toHaveBeenCalledWith("énorme", "fra-por");
    expect(result.text).toBe("enorme, imenso, gigantesco");
    expect(result.language).toBeUndefined();
  });

  it("falls back to any dictionary of the source language and labels it", async () => {
    installBridge([{ id: "fra-por", sourceLang: "fr", targetLang: "pt", isDownloaded: true }]);
    const provider = new OfflineDictionaryProvider();
    const result = await provider.translate({ text: "énorme", source: "fr", target: "en", kind: "word" });
    expect(result.language).toBe("pt");
  });

  it("tries short expressions but not full sentences", () => {
    const provider = new OfflineDictionaryProvider();
    expect(provider.supports({ text: "tout à fait", source: "fr", target: "pt", kind: "sentence" })).toBe(true);
    expect(provider.supports({ text: "il était une fois un roi très ancien", source: "fr", target: "pt", kind: "sentence" })).toBe(false);
  });
});
