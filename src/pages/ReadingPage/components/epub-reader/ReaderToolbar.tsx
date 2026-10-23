import { useState } from "react";
import {
  Minus,
  Plus,
  ChevronDown,
  ChevronRight,
  Type,
  ArrowUpDown,
  ArrowLeftRight,
  BookMarked,
  Languages,
  ArrowRight,
  Eye,
  EyeOff,
  BookOpen,
  ScrollText,
  Settings,
  PanelRightClose,
  Focus,
} from "lucide-react";
import {
  ThemeName,
  FontFamily,
  LanguageCode,
  EpubReadingMode,
  ReaderSettings,
  THEME_COLORS,
  FONT_OPTIONS,
  getFontStack,
} from "./theme";
import { SUPPORTED_LANGUAGES, getLanguageDisplayName } from "./languageServices";
import { useTranslation, type TranslationKey } from "../../../../i18n";

const THEME_LABEL_KEYS = {
  light: "epub:toolbar.themes.light",
  dark: "epub:toolbar.themes.dark",
  sepia: "epub:toolbar.themes.sepia",
} as const satisfies Record<ThemeName, TranslationKey>;

export interface ReaderToolbarProps {
  settings: ReaderSettings;
  isVocabularyPanelOpen: boolean;
  isTocOpen: boolean;
  readingProgress?: number;
  currentLocation?: number;
  totalLocations?: number;
  onFontSizeChange: (size: number) => void;
  onThemeChange: (theme: ThemeName) => void;
  onFontFamilyChange: (font: FontFamily) => void;
  onLineHeightChange: (height: number) => void;
  onContentWidthChange: (width: number) => void;
  onToggleVocabularyPanel: () => void;
  onToggleToc: () => void;
  onSourceLanguageChange: (lang: LanguageCode) => void;
  onTargetLanguageChange: (lang: LanguageCode) => void;
  onShowHighlightsChange: (show: boolean) => void;
  onFocusModeChange: (focusMode: boolean) => void;
  onEpubReadingModeChange: (mode: EpubReadingMode) => void;
}

export default function ReaderToolbar({
  settings,
  isVocabularyPanelOpen,
  isTocOpen,
  readingProgress = 0,
  currentLocation = 0,
  totalLocations = 0,
  onFontSizeChange,
  onThemeChange,
  onFontFamilyChange,
  onLineHeightChange,
  onContentWidthChange,
  onToggleVocabularyPanel,
  onToggleToc,
  onSourceLanguageChange,
  onTargetLanguageChange,
  onShowHighlightsChange,
  onFocusModeChange,
  onEpubReadingModeChange,
}) {
  const { t, i18n } = useTranslation();
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const toggleMenu = (menu: string) => {
    setOpenMenu((current) => (current === menu ? null : menu));
  };

  const getLanguageName = (code: LanguageCode) => getLanguageDisplayName(code, i18n.language);

  const triggerClasses =
    "inline-flex items-center gap-2 rounded-sm border border-border bg-surface px-3 py-2 text-sm text-foreground transition hover:bg-surface-muted";

  return (
    <div className="border-b border-border bg-overlay">
      <div className="flex flex-wrap items-center gap-2 p-3">
        <div className="flex items-center gap-2 text-sm text-foreground-muted tabular-nums">
          {totalLocations > 0 && (
            <span className="font-medium text-foreground">
              {currentLocation}
              <span className="text-foreground-subtle">/{totalLocations}</span>
            </span>
          )}
          <span className="font-medium text-foreground">{readingProgress}%</span>
          <div className="h-3 w-24 overflow-hidden rounded-full bg-surface-muted">
            <div
              className="h-full rounded-full bg-foreground-muted transition-all"
              style={{ width: `${readingProgress}%` }}
            />
          </div>
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => toggleMenu("fontSize")}
            className={triggerClasses}
          >
            <Type size={16} />
            <span>{settings.fontSize}%</span>
            <ChevronDown size={14} className="text-foreground-subtle" />
          </button>

          {openMenu === "fontSize" && (
            <div className="absolute left-0 top-full z-50 mt-2 w-56 rounded-sm border border-border bg-surface p-3 shadow-2xl">
              <div className="mb-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => onFontSizeChange(Math.max(80, settings.fontSize - 10))}
                  className="rounded-sm p-1 text-foreground-muted transition hover:bg-surface-muted hover:text-foreground"
                >
                  <Minus size={16} />
                </button>
                <span className="text-sm font-medium text-foreground">
                  {settings.fontSize}%
                </span>
                <button
                  type="button"
                  onClick={() => onFontSizeChange(Math.min(200, settings.fontSize + 10))}
                  className="rounded-sm p-1 text-foreground-muted transition hover:bg-surface-muted hover:text-foreground"
                >
                  <Plus size={16} />
                </button>
              </div>

              <input
                type="range"
                min="80"
                max="200"
                step="10"
                value={settings.fontSize}
                onChange={(event) => onFontSizeChange(Number(event.target.value))}
                className="w-full accent-primary"
              />
            </div>
          )}
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => toggleMenu("font")}
            className={triggerClasses}
            style={{ fontFamily: getFontStack(settings.fontFamily) }}
          >
            <span>
              {(() => {
                const font = FONT_OPTIONS.find((option) => option.value === settings.fontFamily);
                return font?.labelKey ? t(font.labelKey) : font?.value;
              })()}
            </span>
            <ChevronDown size={14} className="text-foreground-subtle" />
          </button>

          {openMenu === "font" && (
            <div className="absolute left-0 top-full z-50 mt-2 w-64 rounded-sm border border-border bg-surface p-2 shadow-2xl">
              {FONT_OPTIONS.map((font) => {
                const isActive = settings.fontFamily === font.value;

                return (
                  <button
                    key={font.value}
                    type="button"
                    onClick={() => {
                      onFontFamilyChange(font.value);
                      setOpenMenu(null);
                    }}
                    className={`mb-1 flex w-full items-center justify-between rounded-sm px-3 py-2 text-left transition ${
                      isActive
                        ? "bg-surface-muted text-foreground"
                        : "text-foreground hover:bg-surface-muted/80"
                    }`}
                    style={{ fontFamily: getFontStack(font.value) }}
                  >
                    <span>{font.labelKey ? t(font.labelKey) : font.value}</span>
                    <span className="text-xs text-foreground-subtle">Aa</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => toggleMenu("theme")}
            className={triggerClasses}
          >
            <div className="flex items-center gap-2">
              <div
                className="h-4 w-4 rounded-full border border-border-strong"
                style={{ backgroundColor: THEME_COLORS[settings.theme].background }}
              />
              <span className="capitalize">{t(THEME_LABEL_KEYS[settings.theme])}</span>
            </div>
            <ChevronDown size={14} className="text-foreground-subtle" />
          </button>

          {openMenu === "theme" && (
            <div className="absolute left-0 top-full z-50 mt-2 w-40 rounded-sm border border-border bg-surface p-2 shadow-2xl">
              {(["light", "dark", "sepia"] as ThemeName[]).map((theme) => {
                const isActive = settings.theme === theme;

                return (
                  <button
                    key={theme}
                    type="button"
                    onClick={() => {
                      onThemeChange(theme);
                      setOpenMenu(null);
                    }}
                    className={`mb-1 flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm transition ${
                      isActive
                        ? "bg-surface-muted text-foreground"
                        : "text-foreground hover:bg-surface-muted/80"
                    }`}
                  >
                    <div
                      className="h-4 w-4 rounded-full border border-border-strong"
                      style={{ backgroundColor: THEME_COLORS[theme].background }}
                    />
                    <span className="capitalize">{t(THEME_LABEL_KEYS[theme])}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => toggleMenu("spacing")}
            className={triggerClasses}
            title={t("epub:toolbar.spacing")}
          >
            <ArrowUpDown size={16} />
            <ChevronDown size={14} className="text-foreground-subtle" />
          </button>

          {openMenu === "spacing" && (
            <div className="absolute left-0 top-full z-50 mt-2 w-56 rounded-sm border border-border bg-surface p-3 shadow-2xl">
              <label className="mb-3 block text-sm text-foreground-muted">
                {t("epub:toolbar.lineHeight", { value: settings.lineHeight })}
              </label>
              <input
                type="range"
                min="1.2"
                max="2.0"
                step="0.1"
                value={settings.lineHeight}
                onChange={(event) => onLineHeightChange(Number(event.target.value))}
                className="w-full accent-primary"
              />
            </div>
          )}
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => toggleMenu("width")}
            className={triggerClasses}
            title={t("epub:toolbar.contentWidth")}
          >
            <ArrowLeftRight size={16} />
            <ChevronDown size={14} className="text-foreground-subtle" />
          </button>

          {openMenu === "width" && (
            <div className="absolute left-0 top-full z-50 mt-2 w-56 rounded-sm border border-border bg-surface p-3 shadow-2xl">
              <label className="mb-3 block text-sm text-foreground-muted">
                {t("epub:toolbar.contentWidthValue", { value: settings.contentWidth })}
              </label>
              <input
                type="range"
                min="30"
                max="100"
                step="5"
                value={settings.contentWidth}
                onChange={(event) => onContentWidthChange(Number(event.target.value))}
                className="w-full accent-primary"
              />
            </div>
          )}
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => toggleMenu("language")}
            className={triggerClasses}
          >
            <Languages size={16} />
            <span>{getLanguageName(settings.sourceLanguage)}</span>
            <ArrowRight size={14} className="text-foreground-subtle" />
            <span>{getLanguageName(settings.targetLanguage)}</span>
            <ChevronDown size={14} className="text-foreground-subtle" />
          </button>

          {openMenu === "language" && (
            <div className="absolute left-0 top-full z-50 mt-2 w-64 rounded-sm border border-border bg-surface p-3 shadow-2xl">
              <div className="mb-3">
                <label className="mb-2 block text-xs text-foreground-subtle">
                  {t("epub:toolbar.sourceLanguage")}
                </label>
                <div className="grid grid-cols-2 gap-1">
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => {
                        onSourceLanguageChange(lang.code);
                      }}
                      className={`flex items-center gap-1.5 rounded-sm px-2 py-1.5 text-xs transition ${
                        settings.sourceLanguage === lang.code
                          ? "bg-border-strong text-foreground"
                          : "text-foreground-muted hover:bg-surface-muted hover:text-foreground"
                      }`}
                    >
                      <span>{lang.flag}</span>
                      <span>{getLanguageName(lang.code)}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs text-foreground-subtle">
                  {t("epub:toolbar.targetLanguage")}
                </label>
                <div className="grid grid-cols-2 gap-1">
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => {
                        onTargetLanguageChange(lang.code);
                      }}
                      className={`flex items-center gap-1.5 rounded-sm px-2 py-1.5 text-xs transition ${
                        settings.targetLanguage === lang.code
                          ? "bg-border-strong text-foreground"
                          : "text-foreground-muted hover:bg-surface-muted hover:text-foreground"
                      }`}
                    >
                      <span>{lang.flag}</span>
                      <span>{getLanguageName(lang.code)}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

<div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => toggleMenu("settings")}
              className={`inline-flex items-center gap-2 rounded-sm border px-3 py-2 text-sm transition ${
                openMenu === "settings"
                  ? "border-border-strong/40 bg-foreground-subtle/10 text-foreground"
                  : "border-border bg-surface text-foreground hover:bg-surface-muted"
              }`}
            >
              <Settings size={16} />
              <ChevronRight
                size={14}
                className={`text-foreground-subtle transition-transform ${
                  openMenu === "settings" ? "rotate-90" : ""
                }`}
              />
            </button>

            {openMenu === "settings" && (
              <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-sm border border-border bg-surface p-2 shadow-2xl">
                <button
                  type="button"
                  onClick={() => {
                    onShowHighlightsChange(!settings.showHighlights);
                  }}
                  className={`flex w-full items-center gap-3 rounded-sm px-3 py-2 text-left text-sm transition ${
                    settings.showHighlights
                      ? "bg-surface-muted text-foreground"
                      : "text-foreground hover:bg-surface-muted/80"
                  }`}
                >
                  {settings.showHighlights ? <Eye size={16} /> : <EyeOff size={16} />}
                  {settings.showHighlights
                    ? t("epub:toolbar.hideHighlights")
                    : t("epub:toolbar.showHighlights")}
                </button>

                <div className="my-1 h-px bg-surface-muted" />
                <p className="px-3 py-1 text-xs uppercase tracking-[0.16em] text-foreground-subtle">
                  {t("epub:toolbar.readingMode")}
                </p>

                {([
                  ["continuous", "epub:toolbar.modes.continuous", ScrollText],
                  ["paginated", "epub:toolbar.modes.paginated", BookOpen],
                ] as Array<[EpubReadingMode, TranslationKey, typeof BookOpen]>).map(([mode, labelKey, Icon]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      onEpubReadingModeChange(mode);
                    }}
                    className={`flex w-full items-center gap-3 rounded-sm px-3 py-2 text-left text-sm transition ${
                      settings.epubReadingMode === mode
                        ? "bg-surface-muted text-foreground"
                        : "text-foreground hover:bg-surface-muted/80"
                    }`}
                  >
                    <Icon size={16} />
                    {t(labelKey)}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => {
                    onToggleVocabularyPanel();
                    setOpenMenu(null);
                  }}
                  className={`flex w-full items-center gap-3 rounded-sm px-3 py-2 text-left text-sm transition ${
                    isVocabularyPanelOpen
                      ? "bg-surface-muted text-foreground"
                      : "text-foreground hover:bg-surface-muted/80"
                  }`}
                >
                  <BookMarked size={16} />
                  {t("epub:toolbar.vocabulary")}
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onToggleToc}
            className={`inline-flex items-center gap-2 rounded-sm border px-3 py-2 text-sm transition ${
              isTocOpen
                ? "border-border-strong bg-surface-muted text-foreground"
                : "border-border bg-surface text-foreground hover:bg-surface-muted"
            }`}
            title={t("epub:toolbar.toc")}
          >
            <PanelRightClose size={16} />
          </button>

          <button
            type="button"
            onClick={() => onFocusModeChange(!settings.focusMode)}
            className={`inline-flex items-center gap-2 rounded-sm border px-3 py-2 text-sm transition ${
              settings.focusMode
                ? "border-primary bg-primary-muted text-primary"
                : "border-border bg-surface text-foreground hover:bg-surface-muted"
            }`}
            title={t("epub:toolbar.focusMode")}
          >
            <Focus size={16} />
          </button>
        </div>
      </div>

      {openMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setOpenMenu(null)}
        />
      )}
    </div>
  );
}
