export const DEFAULT_LANGUAGE = "pt-BR";

export const LANGUAGE_STORAGE_KEY = "lyceum:language";

export const SUPPORTED_LANGUAGES = [
  {
    code: "pt-BR",
    label: "Português (Brasil)",
    englishName: "Portuguese (Brazil)",
    intlLocale: "pt-BR",
    dir: "ltr",
    matchTags: ["pt-br", "pt"],
  },
  {
    code: "en",
    label: "English",
    englishName: "English",
    intlLocale: "en-US",
    dir: "ltr",
    matchTags: ["en-us", "en-gb", "en"],
  },
] as const;

export type SupportedLanguageCode = (typeof SUPPORTED_LANGUAGES)[number]["code"];

export type LanguageDefinition = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_NAMESPACE = "common";

export function isSupportedLanguage(
  code: string | undefined | null,
): code is SupportedLanguageCode {
  if (!code) return false;
  return SUPPORTED_LANGUAGES.some((language) => language.code === code);
}

export function getLanguageDefinition(
  code: string,
): LanguageDefinition {
  return (
    SUPPORTED_LANGUAGES.find((language) => language.code === code) ??
    (SUPPORTED_LANGUAGES[0] as LanguageDefinition)
  );
}

/**
 * Locale used for `Intl` formatting (dates, numbers, relative time).
 * Falls back to the language code itself when the platform lacks the locale.
 */
export function getIntlLocale(code: string): string {
  const locale = getLanguageDefinition(code).intlLocale;

  try {
    Intl.DateTimeFormat.supportedLocalesOf(locale);
    return locale;
  } catch {
    return code;
  }
}
