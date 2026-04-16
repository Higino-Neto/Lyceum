import { useState, useCallback, useEffect, useRef } from "react";
import {
  ReaderSettings,
  DEFAULT_SETTINGS,
  ThemeName,
  FontFamily,
  TextAlignment,
  LanguageCode,
} from "./theme";

const STORAGE_KEY = "lyceum-reader-settings";

function loadSettings(): ReaderSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch {
    // ignore parse errors
  }
  return DEFAULT_SETTINGS;
}

function saveSettings(settings: ReaderSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore storage errors
  }
}

export function useReaderSettings() {
  const [settings, setSettings] = useState<ReaderSettings>(loadSettings);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  const updateSetting = useCallback(<K extends keyof ReaderSettings>(
    key: K,
    value: ReaderSettings[K],
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  const setFontSize = useCallback(
    (size: number) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        updateSetting("fontSize", Math.min(200, Math.max(80, size)));
      }, 50);
    },
    [updateSetting],
  );

  const setTheme = useCallback(
    (theme: ThemeName) => updateSetting("theme", theme),
    [updateSetting],
  );

  const setFontFamily = useCallback(
    (fontFamily: FontFamily) => updateSetting("fontFamily", fontFamily),
    [updateSetting],
  );

  const setLineHeight = useCallback(
    (lineHeight: number) => updateSetting("lineHeight", lineHeight),
    [updateSetting],
  );

  const setContentWidth = useCallback(
    (contentWidth: number) => updateSetting("contentWidth", Math.min(100, Math.max(30, contentWidth))),
    [updateSetting],
  );

  const setTextAlign = useCallback(
    (textAlign: TextAlignment) => updateSetting("textAlign", textAlign),
    [updateSetting],
  );

  const setSourceLanguage = useCallback(
    (sourceLanguage: LanguageCode) => updateSetting("sourceLanguage", sourceLanguage),
    [updateSetting],
  );

  const setTargetLanguage = useCallback(
    (targetLanguage: LanguageCode) => updateSetting("targetLanguage", targetLanguage),
    [updateSetting],
  );

  const setShowHighlights = useCallback(
    (showHighlights: boolean) => updateSetting("showHighlights", showHighlights),
    [updateSetting],
  );

  const setShowPages = useCallback(
    (showPages: boolean) => updateSetting("showPages", showPages),
    [updateSetting],
  );

  return {
    settings,
    setFontSize,
    setTheme,
    setFontFamily,
    setLineHeight,
    setContentWidth,
    setTextAlign,
    setSourceLanguage,
    setTargetLanguage,
    setShowHighlights,
    setShowPages,
  };
}

export type { ReaderSettings, ThemeName, FontFamily, TextAlignment, LanguageCode };
