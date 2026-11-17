import type { SupportedStorage } from "@supabase/supabase-js";

/**
 * Platform seam shared by the desktop (Electron) and mobile (Capacitor) builds.
 *
 * Shared modules (`src/lib`, `src/api`, `src/features`, `src/core`) never import
 * Electron or Capacitor directly. Each entry point registers the services of its
 * platform once, before rendering, and shared code reads them through
 * `getPlatform()`. Desktop keeps the defaults, so registering is optional there.
 */
export type PlatformTarget = "desktop" | "mobile";

export interface DictionaryCatalogEntry {
  id: string;
  name: string;
  sourceLang: string;
  targetLang: string;
  size?: number;
  headwords?: number;
  isDownloaded?: boolean;
}

/**
 * Offline dictionaries and online translation used by the learning reader.
 * Desktop implements it in the main process (`window.api`); WebView builds
 * register their own implementation.
 */
export interface LearningBridge {
  dictionaryGetIndex(): Promise<DictionaryCatalogEntry[]>;
  dictionaryLookup(word: string, dictId?: string): Promise<{ found: boolean; content?: string }>;
  dictionaryDownload(id: string): Promise<{ success: boolean; error?: string }>;
  dictionaryDelete?(id: string): Promise<boolean>;
  onDictionaryDownloadProgress?(callback: (data: { dictId: string; progress: number }) => void): () => void;
  languageLearningTranslateOnline?(text: string, source: string, target: string):
    Promise<{ success: true; translation: string } | { success: false; error: string }>;
}

export interface PlatformServices {
  target: PlatformTarget;
  /** Where the Supabase session is persisted. Defaults to localStorage. */
  authStorage?: SupportedStorage;
  /** OAuth/password-reset flow. Mobile uses PKCE; desktop keeps the implicit flow. */
  authFlowType?: "implicit" | "pkce";
  /** Sent as `X-Client-Info` so server logs can tell the clients apart. */
  clientInfo?: string;
  /** Dictionaries/translation for the learning reader. Defaults to `window.api` on desktop. */
  learningBridge?: LearningBridge;
}

const DEFAULT_PLATFORM: PlatformServices = { target: "desktop" };

let current: PlatformServices = DEFAULT_PLATFORM;
const listeners = new Set<(platform: PlatformServices) => void>();

export function registerPlatform(services: PlatformServices) {
  current = { ...DEFAULT_PLATFORM, ...services };
  listeners.forEach((listener) => listener(current));
}

export function getPlatform(): PlatformServices {
  return current;
}

/** The registered learning bridge, or the Electron preload API on desktop. */
export function getLearningBridge(): Partial<LearningBridge> | null {
  if (current.learningBridge) return current.learningBridge;
  if (typeof window === "undefined") return null;
  return ((window as unknown as { api?: Partial<LearningBridge> }).api) ?? null;
}

export function isMobilePlatform() {
  return current.target === "mobile";
}

/** Lets lazily created singletons (e.g. the Supabase client) drop stale instances. */
export function onPlatformChange(listener: (platform: PlatformServices) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function resetPlatformForTests() {
  current = DEFAULT_PLATFORM;
  listeners.forEach((listener) => listener(current));
}
