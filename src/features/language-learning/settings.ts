/**
 * Per-viewer reader preferences for the language-learning reader. These are
 * display conveniences; learning data itself lives in SQLite.
 */
/** "app" follows the application theme tokens; "sepia" is a paper tone for long reading. */
export type LearningTheme = "app" | "sepia";

export interface LearningReaderSettings {
  /** Language-learning mode (vocabulary indicators) vs traditional reading. */
  learningMode: boolean;
  showHighlights: boolean;
  /** Highlight known words too (subtle green); off keeps known words plain. */
  highlightKnown: boolean;
  nativeLanguage: string;
  fontSize: number;
  lineHeight: number;
  contentWidth: number;
  theme: LearningTheme;
  /** Opt-in: allow sending text to the online translation service. */
  onlineTranslation: boolean;
  speechRate: number;
  inspectorOpen: boolean;
  progressPanelOpen: boolean;
  /** Clicking an unknown word in the text moves it to "learning" and adds it to the vocabulary. */
  autoLearnOnClick: boolean;
  /** Touch screens: space between the text and the screen edges, in px. */
  horizontalMargin: number;
}

export const HORIZONTAL_MARGIN_LIMITS = { min: 4, max: 72, step: 4 } as const;

export const DEFAULT_LEARNING_SETTINGS: LearningReaderSettings = {
  learningMode: true,
  showHighlights: true,
  highlightKnown: false,
  nativeLanguage: "en",
  fontSize: 19,
  lineHeight: 1.7,
  contentWidth: 680,
  theme: "app",
  onlineTranslation: false,
  speechRate: 1,
  inspectorOpen: true,
  progressPanelOpen: false,
  autoLearnOnClick: true,
  horizontalMargin: 20,
};

const SETTINGS_KEY = "lyceum-learning-reader:settings";
const LANGUAGE_KEY_PREFIX = "lyceum-learning-reader:language:";

function clamp(value: unknown, min: number, max: number, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

export function sanitizeSettings(raw: unknown, fallbackNative: string): LearningReaderSettings {
  const value = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof LearningReaderSettings, unknown>>;
  const defaults = { ...DEFAULT_LEARNING_SETTINGS, nativeLanguage: fallbackNative };
  const bool = (key: keyof LearningReaderSettings) => (typeof value[key] === "boolean" ? value[key] as boolean : defaults[key] as boolean);
  // Older "light"/"dark" reader themes duplicated the app theme; they now follow it.
  const theme = value.theme === "sepia" ? "sepia" : "app";
  return {
    learningMode: bool("learningMode"),
    showHighlights: bool("showHighlights"),
    highlightKnown: bool("highlightKnown"),
    nativeLanguage: typeof value.nativeLanguage === "string" && /^[a-z]{2,3}$/.test(value.nativeLanguage) ? value.nativeLanguage : defaults.nativeLanguage,
    fontSize: clamp(value.fontSize, 13, 32, defaults.fontSize),
    lineHeight: clamp(value.lineHeight, 1.2, 2.4, defaults.lineHeight),
    contentWidth: clamp(value.contentWidth, 420, 1100, defaults.contentWidth),
    theme,
    onlineTranslation: bool("onlineTranslation"),
    speechRate: clamp(value.speechRate, 0.5, 1.75, defaults.speechRate),
    inspectorOpen: bool("inspectorOpen"),
    progressPanelOpen: bool("progressPanelOpen"),
    autoLearnOnClick: bool("autoLearnOnClick"),
    horizontalMargin: clamp(value.horizontalMargin, HORIZONTAL_MARGIN_LIMITS.min, HORIZONTAL_MARGIN_LIMITS.max, defaults.horizontalMargin),
  };
}

export function loadLearningSettings(fallbackNative: string): LearningReaderSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    return sanitizeSettings(stored ? JSON.parse(stored) : null, fallbackNative);
  } catch {
    return sanitizeSettings(null, fallbackNative);
  }
}

export function saveLearningSettings(settings: LearningReaderSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Storage unavailable: settings stay in memory for this session.
  }
}

/** Document language override chosen by the reader (metadata can be wrong). */
export function loadLanguageOverride(fileHash: string): string | null {
  try {
    return localStorage.getItem(`${LANGUAGE_KEY_PREFIX}${fileHash}`);
  } catch {
    return null;
  }
}

export function saveLanguageOverride(fileHash: string, language: string) {
  try {
    localStorage.setItem(`${LANGUAGE_KEY_PREFIX}${fileHash}`, language);
  } catch {
    // ignore
  }
}

/** Languages offered in the document-language picker. */
export const LEARNING_LANGUAGES = ["de", "en", "fr", "es", "it", "pt", "nl", "sv", "pl", "ru", "ja", "zh", "ko", "la"] as const;
