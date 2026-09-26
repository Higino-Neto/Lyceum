import { useMemo } from "react";
import { useTranslation as useI18nextTranslation } from "react-i18next";
import type { i18n as I18nInstance } from "i18next";

import type { Translate } from "./keys";

export interface UseTranslationResult {
  t: Translate;
  i18n: I18nInstance;
  ready: boolean;
}

/**
 * Thin wrapper around `react-i18next`'s hook that exposes a `t` function whose
 * keys are checked against the translation files at compile time.
 *
 * ```tsx
 * const { t } = useTranslation();
 * t("library:header.addBook");
 * t("common:units.page", { count: total });
 * ```
 *
 * The `ns` argument is accepted for familiarity but not required: keys always
 * carry their namespace, and when provided it only becomes the default one.
 */
export function useTranslation(ns?: string | readonly string[]): UseTranslationResult {
  const { t, i18n, ready } = useI18nextTranslation(ns as string | string[] | undefined);

  return useMemo(
    () => ({ t: t as unknown as Translate, i18n, ready }),
    [t, i18n, ready],
  );
}
