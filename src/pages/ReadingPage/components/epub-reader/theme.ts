export type ThemeName = "light" | "dark" | "sepia";
export type FontFamily = "serif" | "sans-serif" | "Georgia" | "OpenDyslexic";
export type TextAlignment = "left" | "justify";
export type LanguageCode = "en" | "fr" | "es" | "de" | "it" | "ja" | "ko" | "zh" | "ru" | "nl" | "pl" | "pt" | "la";

export interface ReaderSettings {
  fontSize: number;
  fontFamily: FontFamily;
  theme: ThemeName;
  lineHeight: number;
  contentWidth: number;
  textAlign: TextAlignment;
  showHighlights: boolean;
  showPages: boolean;
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
}

export const DEFAULT_SETTINGS: ReaderSettings = {
  fontSize: 100,
  fontFamily: "Georgia",
  theme: "dark",
  lineHeight: 1.5,
  contentWidth: 60,
  textAlign: "justify",
  showHighlights: true,
  showPages: false,
  sourceLanguage: "en",
  targetLanguage: "pt",
};

export interface ThemeColors {
  background: string;
  text: string;
  accent: string;
  border: string;
}

export const THEME_COLORS: Record<ThemeName, ThemeColors> = {
  light: {
    background: "#ffffff",
    text: "#1a1a1a",
    accent: "#64748b",
    border: "#e5e5e5",
  },
  dark: {
    background: "#18181b",
    text: "#fafafa",
    accent: "#94a3b8",
    border: "#3f3f46",
  },
  sepia: {
    background: "#f4ecd8",
    text: "#5c4b37",
    accent: "#a89984",
    border: "#d4c4a8",
  },
};

export interface HighlightColors {
  learningBg: string;
  learningUnderline: string;
  knownBg: string;
  knownUnderline: string;
  saved: string;
}

export const HIGHLIGHT_COLORS: Record<ThemeName, HighlightColors> = {
  light: {
    learningBg: "rgba(59, 130, 246, 0.12)",
    learningUnderline: "rgba(59, 130, 246, 0.2)",
    knownBg: "rgba(34, 197, 94, 0.1)",
    knownUnderline: "rgba(34, 197, 94, 0.15)",
    saved: "rgba(234, 179, 8, 0.6)",
  },
  dark: {
    learningBg: "rgba(34, 211, 238, 0.15)",
    learningUnderline: "rgba(34, 211, 238, 0.25)",
    knownBg: "rgba(52, 211, 153, 0.15)",
    knownUnderline: "rgba(52, 211, 153, 0.25)",
    saved: "rgba(251, 191, 36, 0.6)",
  },
  sepia: {
    learningBg: "rgba(107, 114, 128, 0.15)",
    learningUnderline: "rgba(107, 114, 128, 0.25)",
    knownBg: "rgba(90, 118, 73, 0.15)",
    knownUnderline: "rgba(90, 118, 73, 0.25)",
    saved: "rgba(180, 83, 9, 0.5)",
  },
};

export const FONT_OPTIONS: { value: FontFamily; label: string }[] = [
  { value: "Georgia", label: "Georgia" },
  { value: "serif", label: "Serif" },
  { value: "sans-serif", label: "Sans Serif" },
  { value: "OpenDyslexic", label: "OpenDyslexic" },
];

export function getFontStack(fontFamily: FontFamily) {
  switch (fontFamily) {
    case "Georgia":
      return "Georgia, 'Times New Roman', serif";
    case "sans-serif":
      return "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
    case "OpenDyslexic":
      return "'OpenDyslexic', 'Comic Sans MS', 'Trebuchet MS', sans-serif";
    case "serif":
    default:
      return "'Iowan Old Style', Palatino, 'Book Antiqua', Georgia, serif";
  }
}
