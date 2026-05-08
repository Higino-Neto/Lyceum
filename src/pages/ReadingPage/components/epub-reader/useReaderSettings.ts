import { useState, useCallback, useEffect, useRef } from "react";
import {
  ReaderSettings,
  DEFAULT_SETTINGS,
  ThemeName,
  FontFamily,
  TextAlignment,
  LanguageCode,
  EpubReadingMode,
} from "./theme";

const STORAGE_KEY = "lyceum-reader-settings";

function buildBookSettingsKey(fileHash?: string) {
  return fileHash ? `${STORAGE_KEY}:book:${fileHash}` : STORAGE_KEY;
}

function readSettingsFromStorage(key: string): Partial<ReaderSettings> | null {
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored) as Partial<ReaderSettings>;
    }
  } catch {
    // ignore parse errors
  }

  return null;
}

function loadSettings(fileHash?: string): ReaderSettings {
  const globalSettings = readSettingsFromStorage(STORAGE_KEY);
  const bookSettings = readSettingsFromStorage(buildBookSettingsKey(fileHash));
  const loadedSettings = {
    ...DEFAULT_SETTINGS,
    ...globalSettings,
    ...bookSettings,
  };

  return {
    fontSize: loadedSettings.fontSize,
    fontFamily: loadedSettings.fontFamily,
    theme: loadedSettings.theme,
    lineHeight: loadedSettings.lineHeight,
    contentWidth: loadedSettings.contentWidth,
    textAlign: loadedSettings.textAlign,
    showHighlights: loadedSettings.showHighlights,
    sourceLanguage: loadedSettings.sourceLanguage,
    targetLanguage: loadedSettings.targetLanguage,
    focusMode: loadedSettings.focusMode,
    epubReadingMode:
      loadedSettings.epubReadingMode === "paginated" ? "paginated" : "continuous",
  };
}

function saveSettings(settings: ReaderSettings, fileHash?: string) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));

    if (fileHash) {
      localStorage.setItem(buildBookSettingsKey(fileHash), JSON.stringify(settings));
    }
  } catch {
    // ignore storage errors
  }
}

export function useReaderSettings(fileHash?: string) {
  const [settings, setSettings] = useState<ReaderSettings>(() => loadSettings(fileHash));
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }

    setSettings(loadSettings(fileHash));
  }, [fileHash]);

  useEffect(() => {
    saveSettings(settings, fileHash);
  }, [fileHash, settings]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

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

  const setFocusMode = useCallback(
    (focusMode: boolean) => {
      updateSetting("focusMode", focusMode);
      if (focusMode) {
        updateSetting("showHighlights", false);
      }
      try {
        localStorage.setItem("lyceum-focus-mode", String(focusMode));
      } catch {
        // ignore
      }
    },
    [updateSetting],
  );

  useEffect(() => {
    try {
      localStorage.setItem("lyceum-focus-mode", String(settings.focusMode));
    } catch {
      // ignore
    }
  }, [settings.focusMode]);

  const setEpubReadingMode = useCallback(
    (epubReadingMode: EpubReadingMode) => {
      setSettings((prev) => ({
        ...prev,
        epubReadingMode,
      }));
    },
    [],
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
    setFocusMode,
    setEpubReadingMode,
  };
}

export type {
  ReaderSettings,
  ThemeName,
  FontFamily,
  TextAlignment,
  LanguageCode,
  EpubReadingMode,
};
