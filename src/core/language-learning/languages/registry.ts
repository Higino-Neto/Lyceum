import type { LanguageModule } from "./types";
import { createGenericModule } from "./generic";
import { createGermanModule } from "./german";
import { createEnglishModule } from "./english";

type ModuleFactory = () => LanguageModule;

/**
 * Registry of language processing modules. Languages without a specialised
 * module fall back to the generic module (tokenization + segmentation, plus
 * attestation-based suffix stripping where configured).
 */
export class LanguageProcessingRegistry {
  private readonly factories = new Map<string, ModuleFactory>();
  private readonly instances = new Map<string, LanguageModule>();

  register(code: string, factory: ModuleFactory) {
    this.factories.set(code.toLowerCase(), factory);
    this.instances.delete(code.toLowerCase());
  }

  has(code: string) {
    return this.factories.has(normalizeLanguageCode(code));
  }

  get(code: string): LanguageModule {
    const language = normalizeLanguageCode(code);
    const cached = this.instances.get(language);
    if (cached) return cached;
    const factory = this.factories.get(language);
    const module = factory ? factory() : createGenericModule(language);
    this.instances.set(language, module);
    return module;
  }
}

/**
 * EPUB metadata often carries ISO 639-2/3 codes ("fre", "fra", "ger") or a
 * language name. Vocabulary is filed by language, so every spelling of the
 * same language must map to one code or words would split across buckets.
 */
const LANGUAGE_ALIASES: Record<string, string> = {
  fre: "fr", fra: "fr", french: "fr", francais: "fr", "français": "fr",
  eng: "en", english: "en", ger: "de", deu: "de", german: "de", deutsch: "de",
  spa: "es", spanish: "es", "español": "es", espanol: "es",
  por: "pt", portuguese: "pt", "português": "pt", portugues: "pt",
  ita: "it", italian: "it", italiano: "it", dut: "nl", nld: "nl", dutch: "nl",
  swe: "sv", pol: "pl", rus: "ru", jpn: "ja", chi: "zh", zho: "zh", kor: "ko", lat: "la",
  cat: "ca", dan: "da", fin: "fi", gre: "el", ell: "el", hun: "hu", nor: "no", nob: "nb", ces: "cs", cze: "cs", tur: "tr", ara: "ar",
};

export function normalizeLanguageCode(code: string | undefined | null): string {
  const value = (code ?? "").trim().toLowerCase().replace("_", "-");
  const base = value.split("-")[0] || "und";
  return LANGUAGE_ALIASES[base] ?? base;
}

export function createDefaultLanguageRegistry() {
  const registry = new LanguageProcessingRegistry();
  registry.register("de", createGermanModule);
  registry.register("en", createEnglishModule);
  return registry;
}

let defaultRegistry: LanguageProcessingRegistry | null = null;

export function getLanguageModule(code: string): LanguageModule {
  defaultRegistry ??= createDefaultLanguageRegistry();
  return defaultRegistry.get(code);
}
