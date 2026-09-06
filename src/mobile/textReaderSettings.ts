export type ReaderTheme = "paper" | "dark" | "sepia";

export type FontFamily = "georgia" | "serif" | "sans" | "opendyslexic";
export type MarginLevel = "compact" | "medium" | "wide";

export const MARGIN_CONTENT_WIDTH: Record<MarginLevel, number> = {
  compact: 92,
  medium: 84,
  wide: 72,
};

export const MARGIN_LABELS: Record<MarginLevel, string> = {
  compact: "Compacto",
  medium: "Medio",
  wide: "Largo",
};

export interface ReaderSettings {
  paginated: boolean;
  theme: ReaderTheme;
  fontSize: number;
  lineHeight: number;
  fontFamily: FontFamily;
  marginLevel: MarginLevel;
  letterSpacing: number;
  paragraphSpacing: number;
  textIndent: number;
  fontWeight: number;
  wordSpacing: number;
}

export const FONT_MAP: Record<FontFamily, string> = {
  georgia: "Georgia, 'Times New Roman', serif",
  serif: "'Iowan Old Style', Palatino, 'Book Antiqua', Georgia, serif",
  sans: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  opendyslexic: "'OpenDyslexic', 'Comic Sans MS', 'Trebuchet MS', sans-serif",
};

export const FONT_LABELS: Record<FontFamily, string> = {
  georgia: "Georgia",
  serif: "Serif",
  sans: "Sans",
  opendyslexic: "Dyslexic",
};

export const THEME_COLORS: Record<ReaderTheme, { background: string; foreground: string; accent: string; border: string }> = {
  paper: { background: "#f7f3ea", foreground: "#18181b", accent: "#047857", border: "#e7e0d2" },
  dark: { background: "#09090b", foreground: "#e4e4e7", accent: "#4ade80", border: "#27272a" },
  sepia: { background: "#efe2c7", foreground: "#292524", accent: "#8a4b12", border: "#d6c9b0" },
};

const SETTINGS_STORAGE_KEY = "lyceum_mobile_reader_settings";

export function loadSettings(): ReaderSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ReaderSettings>;
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch {
    // ignore corrupt settings
  }
  return { ...DEFAULT_SETTINGS };
}

export function persistSettings(settings: ReaderSettings) {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // storage full or unavailable
  }
}

export const DEFAULT_SETTINGS: ReaderSettings = {
  paginated: false,
  theme: "paper",
  fontSize: 100,
  lineHeight: 1.55,
  fontFamily: "georgia",
  marginLevel: "medium",
  letterSpacing: 0,
  paragraphSpacing: 1,
  textIndent: 0,
  fontWeight: 0,
  wordSpacing: 0,
};
