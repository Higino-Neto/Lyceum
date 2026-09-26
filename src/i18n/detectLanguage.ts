import {
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
  isSupportedLanguage,
} from "./config";

export interface LanguageDetectionInput {
  /** Language explicitly chosen by the user, when available. */
  storedLanguage?: string | null;
  /** Raw browser/OS language tags, most preferred first. */
  preferredLanguages?: readonly string[];
}

/**
 * Resolves which language the app should start with.
 * Priority: user's saved choice > browser/OS preference > default language.
 */
export function detectLanguage({
  storedLanguage,
  preferredLanguages = [],
}: LanguageDetectionInput = {}): string {
  if (isSupportedLanguage(storedLanguage)) return storedLanguage;

  for (const preferred of preferredLanguages) {
    const normalized = normalizeTag(preferred);
    if (!normalized) continue;

    const exact = SUPPORTED_LANGUAGES.find((language) =>
      (language.matchTags as readonly string[]).includes(normalized),
    );
    if (exact) return exact.code;

    const base = normalized.split("-")[0]!;
    const partial = SUPPORTED_LANGUAGES.find((language) =>
      (language.matchTags as readonly string[]).some(
        (tag) => tag.split("-")[0] === base,
      ),
    );
    if (partial) return partial.code;
  }

  return DEFAULT_LANGUAGE;
}

function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase().replace(/_/g, "-");
}

export function getPreferredLanguages(): string[] {
  if (typeof navigator === "undefined") return [];

  const candidates = [
    ...(Array.isArray(navigator.languages) ? navigator.languages : []),
    navigator.language,
  ];

  return candidates.filter((tag): tag is string => typeof tag === "string" && tag.length > 0);
}
