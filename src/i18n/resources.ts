import type { SupportedLanguageCode } from "./config";

import enAuth from "./en/auth.json";
import enDialogs from "./en/dialogs.json";
import enLibrary from "./en/library.json";
import enReading from "./en/reading.json";
import enCommon from "./en/common.json";
import enDashboard from "./en/dashboard.json";
import enFriends from "./en/friends.json";
import enNavigation from "./en/navigation.json";
import enSettings from "./en/settings.json";
import enTabs from "./en/tabs.json";

import ptBrAuth from "./pt-br/auth.json";
import ptBrDialogs from "./pt-br/dialogs.json";
import ptBrLibrary from "./pt-br/library.json";
import ptBrReading from "./pt-br/reading.json";
import ptBrCommon from "./pt-br/common.json";
import ptBrDashboard from "./pt-br/dashboard.json";
import ptBrFriends from "./pt-br/friends.json";
import ptBrNavigation from "./pt-br/navigation.json";
import ptBrSettings from "./pt-br/settings.json";
import ptBrTabs from "./pt-br/tabs.json";

/**
 * One entry per namespace (one JSON file per feature area).
 * `en` is the reference shape: every other language must provide exactly the
 * same namespaces and keys, or the assignment below fails to type-check.
 */
const en = {
  common: enCommon,
  auth: enAuth,
  dashboard: enDashboard,
  dialogs: enDialogs,
  library: enLibrary,
  reading: enReading,
  navigation: enNavigation,
  tabs: enTabs,
  settings: enSettings,
  friends: enFriends,
};

const ptBR = {
  common: ptBrCommon,
  auth: ptBrAuth,
  dashboard: ptBrDashboard,
  dialogs: ptBrDialogs,
  library: ptBrLibrary,
  reading: ptBrReading,
  navigation: ptBrNavigation,
  tabs: ptBrTabs,
  settings: ptBrSettings,
  friends: ptBrFriends,
};

/** Flat `namespace -> keys` map used for type checking `t()` calls. */
export type TranslationResources = typeof en;

export const resources: Record<SupportedLanguageCode, TranslationResources> = {
  en,
  "pt-BR": ptBR,
};

export const NAMESPACE_KEYS = Object.keys(en) as Array<keyof TranslationResources>;
