import type { SupportedLanguageCode } from "./config";

import enAuth from "./en/auth.json";
import enCommon from "./en/common.json";
import enDashboard from "./en/dashboard.json";
import enFriends from "./en/friends.json";
import enNavigation from "./en/navigation.json";
import enSettings from "./en/settings.json";

import ptBrAuth from "./pt-br/auth.json";
import ptBrCommon from "./pt-br/common.json";
import ptBrDashboard from "./pt-br/dashboard.json";
import ptBrFriends from "./pt-br/friends.json";
import ptBrNavigation from "./pt-br/navigation.json";
import ptBrSettings from "./pt-br/settings.json";

/**
 * One entry per namespace (one JSON file per feature area).
 * `en` is the reference shape: every other language must provide exactly the
 * same namespaces and keys, or the assignment below fails to type-check.
 */
const en = {
  common: enCommon,
  auth: enAuth,
  dashboard: enDashboard,
  navigation: enNavigation,
  settings: enSettings,
  friends: enFriends,
};

const ptBR = {
  common: ptBrCommon,
  auth: ptBrAuth,
  dashboard: ptBrDashboard,
  navigation: ptBrNavigation,
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
