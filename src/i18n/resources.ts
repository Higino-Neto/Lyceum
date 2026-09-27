import type { SupportedLanguageCode } from "./config";

import enAtlas from "./en/atlas.json";
import enAuth from "./en/auth.json";
import enDialogs from "./en/dialogs.json";
import enLibrary from "./en/library.json";
import enReading from "./en/reading.json";
import enCommon from "./en/common.json";
import enConversion from "./en/conversion.json";
import enEpub from "./en/epub.json";
import enPdf from "./en/pdf.json";
import enMobile from "./en/mobile.json";
import enDashboard from "./en/dashboard.json";
import enFriends from "./en/friends.json";
import enHabits from "./en/habits.json";
import enNavigation from "./en/navigation.json";
import enSettings from "./en/settings.json";
import enTabs from "./en/tabs.json";

import ptBrAtlas from "./pt-br/atlas.json";
import ptBrAuth from "./pt-br/auth.json";
import ptBrDialogs from "./pt-br/dialogs.json";
import ptBrLibrary from "./pt-br/library.json";
import ptBrReading from "./pt-br/reading.json";
import ptBrCommon from "./pt-br/common.json";
import ptBrConversion from "./pt-br/conversion.json";
import ptBrEpub from "./pt-br/epub.json";
import ptBrPdf from "./pt-br/pdf.json";
import ptBrMobile from "./pt-br/mobile.json";
import ptBrDashboard from "./pt-br/dashboard.json";
import ptBrFriends from "./pt-br/friends.json";
import ptBrHabits from "./pt-br/habits.json";
import ptBrNavigation from "./pt-br/navigation.json";
import ptBrSettings from "./pt-br/settings.json";
import ptBrTabs from "./pt-br/tabs.json";

/**
 * One entry per namespace (one JSON file per feature area).
 * `en` is the reference shape: every other language must provide exactly the
 * same namespaces and keys, or the assignment below fails to type-check.
 */
const en = {
  atlas: enAtlas,
  common: enCommon,
  conversion: enConversion,
  epub: enEpub,
  pdf: enPdf,
  mobile: enMobile,
  auth: enAuth,
  dashboard: enDashboard,
  dialogs: enDialogs,
  library: enLibrary,
  reading: enReading,
  navigation: enNavigation,
  tabs: enTabs,
  settings: enSettings,
  friends: enFriends,
  habits: enHabits,
};

const ptBR = {
  atlas: ptBrAtlas,
  common: ptBrCommon,
  conversion: ptBrConversion,
  epub: ptBrEpub,
  pdf: ptBrPdf,
  mobile: ptBrMobile,
  auth: ptBrAuth,
  dashboard: ptBrDashboard,
  dialogs: ptBrDialogs,
  library: ptBrLibrary,
  reading: ptBrReading,
  navigation: ptBrNavigation,
  tabs: ptBrTabs,
  settings: ptBrSettings,
  friends: ptBrFriends,
  habits: ptBrHabits,
};

/** Flat `namespace -> keys` map used for type checking `t()` calls. */
export type TranslationResources = typeof en;

export const resources: Record<SupportedLanguageCode, TranslationResources> = {
  en,
  "pt-BR": ptBR,
};

export const NAMESPACE_KEYS = Object.keys(en) as Array<keyof TranslationResources>;
