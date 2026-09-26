import i18next from "i18next";
import { initReactI18next } from "react-i18next";

import {
  DEFAULT_LANGUAGE,
  DEFAULT_NAMESPACE,
  getLanguageDefinition,
  type SupportedLanguageCode,
} from "./config";
import { detectLanguage, getPreferredLanguages } from "./detectLanguage";
import type { Translate } from "./keys";
import { resources, NAMESPACE_KEYS } from "./resources";
import { readStoredLanguage, writeStoredLanguage } from "./storage";

i18next.use(initReactI18next).init({
  resources,
  lng: detectLanguage({
    storedLanguage: readStoredLanguage(),
    preferredLanguages: getPreferredLanguages(),
  }),
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: Object.keys(resources) as SupportedLanguageCode[],
  defaultNS: DEFAULT_NAMESPACE,
  ns: NAMESPACE_KEYS,
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
  returnNull: false,
});

function applyDocumentLanguage(language: string) {
  if (typeof document === "undefined") return;

  const { dir } = getLanguageDefinition(language);
  document.documentElement.lang = language;
  document.documentElement.dir = dir;
}

i18next.on("languageChanged", (language) => {
  writeStoredLanguage(language);
  applyDocumentLanguage(language);
});

applyDocumentLanguage(i18next.language);

/**
 * Imperative translation for code that runs outside React (API error messages,
 * toasts helpers, Electron main/preload helpers).
 */
export const translate: Translate = (key, options) =>
  i18next.t(key, options ?? {}) as string;

export { i18next };
export { useTranslation } from "./useTranslation";
export { useLanguage } from "./useLanguage";
export { default as LanguageSwitcher } from "./LanguageSwitcher";
export {
  compareText,
  formatDate,
  formatDuration,
  formatNumber,
  formatShortDate,
  getActiveLocale,
  getShortMonthNames,
  getWeekdayInitials,
  getWeekdayShortNames,
  normalizeCase,
} from "./format";
export * from "./config";
export type { TranslationKey, Translate, TranslateOptions } from "./keys";
export type { TranslationResources } from "./resources";
