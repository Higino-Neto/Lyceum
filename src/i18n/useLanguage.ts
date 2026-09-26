import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";

import {
  SUPPORTED_LANGUAGES,
  getIntlLocale,
  isSupportedLanguage,
  type SupportedLanguageCode,
} from "./config";

export interface LanguageOption {
  code: SupportedLanguageCode;
  label: string;
  englishName: string;
  locale: string;
}

export interface UseLanguageResult {
  language: SupportedLanguageCode;
  locale: string;
  options: LanguageOption[];
  changeLanguage: (code: string) => Promise<void>;
  isSupported: (code: string) => boolean;
}

export function useLanguage(): UseLanguageResult {
  const { i18n } = useTranslation();

  const language = isSupportedLanguage(i18n.language)
    ? i18n.language
    : i18n.resolvedLanguage && isSupportedLanguage(i18n.resolvedLanguage)
      ? i18n.resolvedLanguage
      : ("pt-BR" as SupportedLanguageCode);

  const options = useMemo<LanguageOption[]>(
    () =>
      SUPPORTED_LANGUAGES.map((definition) => ({
        code: definition.code,
        label: definition.label,
        englishName: definition.englishName,
        locale: getIntlLocale(definition.code),
      })),
    [],
  );

  const changeLanguage = useCallback(
    async (code: string) => {
      if (!isSupportedLanguage(code) || code === i18n.language) return;
      await i18n.changeLanguage(code);
    },
    [i18n],
  );

  return {
    language,
    locale: getIntlLocale(language),
    options,
    changeLanguage,
    isSupported: isSupportedLanguage,
  };
}
