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
  learningMode: boolean;
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
  learningMode: true,
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
