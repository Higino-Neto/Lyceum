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

export function normalizeLanguageCode(code: string | undefined | null): string {
  const value = (code ?? "").trim().toLowerCase().replace("_", "-");
  return value.split("-")[0] || "und";
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
