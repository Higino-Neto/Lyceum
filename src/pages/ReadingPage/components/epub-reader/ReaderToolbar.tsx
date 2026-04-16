import { useState } from "react";
import {
  Minus,
  Plus,
  ChevronDown,
  Type,
  ArrowUpDown,
  Maximize2,
  BookMarked,
  Languages,
  ArrowRight,
  Eye,
  EyeOff,
  BookOpen,
} from "lucide-react";
import {
  ThemeName,
  FontFamily,
  LanguageCode,
  ReaderSettings,
  THEME_COLORS,
  FONT_OPTIONS,
  getFontStack,
} from "./theme";
import { SUPPORTED_LANGUAGES } from "./languageServices";

interface ReaderToolbarProps {
  settings: ReaderSettings;
  isVocabularyPanelOpen: boolean;
  onFontSizeChange: (size: number) => void;
  onThemeChange: (theme: ThemeName) => void;
  onFontFamilyChange: (font: FontFamily) => void;
  onLineHeightChange: (height: number) => void;
  onContentWidthChange: (width: number) => void;
  onToggleVocabularyPanel: () => void;
  onSourceLanguageChange: (lang: LanguageCode) => void;
  onTargetLanguageChange: (lang: LanguageCode) => void;
  onShowHighlightsChange: (show: boolean) => void;
  onShowPagesChange: (show: boolean) => void;
}

export default function ReaderToolbar({
  settings,
  isVocabularyPanelOpen,
  onFontSizeChange,
  onThemeChange,
  onFontFamilyChange,
  onLineHeightChange,
  onContentWidthChange,
  onToggleVocabularyPanel,
  onSourceLanguageChange,
  onTargetLanguageChange,
  onShowHighlightsChange,
  onShowPagesChange,
}) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const toggleMenu = (menu: string) => {
    setOpenMenu((current) => (current === menu ? null : menu));
  };

  const getLanguageName = (code: LanguageCode) => {
    const lang = SUPPORTED_LANGUAGES.find((l) => l.code === code);
    return lang ? lang.name : code;
  };

  const triggerClasses =
    "inline-flex items-center gap-2 rounded-sm border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 transition hover:bg-zinc-800";

  return (
    <div className="border-b border-zinc-800 bg-zinc-900/95">
      <div className="flex flex-wrap items-center gap-2 p-3">
        <div className="relative">
          <button
            type="button"
            onClick={() => toggleMenu("fontSize")}
            className={triggerClasses}
          >
            <Type size={16} />
            <span>{settings.fontSize}%</span>
            <ChevronDown size={14} className="text-zinc-500" />
          </button>

          {openMenu === "fontSize" && (
            <div className="absolute left-0 top-full z-50 mt-2 w-56 rounded-sm border border-zinc-800 bg-zinc-900 p-3 shadow-2xl">
              <div className="mb-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => onFontSizeChange(Math.max(80, settings.fontSize - 10))}
                  className="rounded-sm p-1 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
                >
                  <Minus size={16} />
                </button>
                <span className="text-sm font-medium text-zinc-100">
                  {settings.fontSize}%
                </span>
                <button
                  type="button"
                  onClick={() => onFontSizeChange(Math.min(200, settings.fontSize + 10))}
                  className="rounded-sm p-1 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
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
                className="w-full accent-zinc-400"
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
            <span>{FONT_OPTIONS.find((font) => font.value === settings.fontFamily)?.label}</span>
            <ChevronDown size={14} className="text-zinc-500" />
          </button>

          {openMenu === "font" && (
            <div className="absolute left-0 top-full z-50 mt-2 w-64 rounded-sm border border-zinc-800 bg-zinc-900 p-2 shadow-2xl">
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
                        ? "bg-zinc-800 text-zinc-100"
                        : "text-zinc-300 hover:bg-zinc-800/80"
                    }`}
                    style={{ fontFamily: getFontStack(font.value) }}
                  >
                    <span>{font.label}</span>
                    <span className="text-xs text-zinc-500">Aa</span>
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
                className="h-4 w-4 rounded-full border border-zinc-600"
                style={{ backgroundColor: THEME_COLORS[settings.theme].background }}
              />
              <span className="capitalize">{settings.theme}</span>
            </div>
            <ChevronDown size={14} className="text-zinc-500" />
          </button>

          {openMenu === "theme" && (
            <div className="absolute left-0 top-full z-50 mt-2 w-40 rounded-sm border border-zinc-800 bg-zinc-900 p-2 shadow-2xl">
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
                        ? "bg-zinc-800 text-zinc-100"
                        : "text-zinc-300 hover:bg-zinc-800/80"
                    }`}
                  >
                    <div
                      className="h-4 w-4 rounded-full border border-zinc-600"
                      style={{ backgroundColor: THEME_COLORS[theme].background }}
                    />
                    <span className="capitalize">{theme}</span>
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
          >
            <ArrowUpDown size={16} />
            <span>Espaçamento</span>
            <ChevronDown size={14} className="text-zinc-500" />
          </button>

          {openMenu === "spacing" && (
            <div className="absolute left-0 top-full z-50 mt-2 w-56 rounded-sm border border-zinc-800 bg-zinc-900 p-3 shadow-2xl">
              <label className="mb-3 block text-sm text-zinc-400">
                Altura da linha: {settings.lineHeight}
              </label>
              <input
                type="range"
                min="1.2"
                max="2.0"
                step="0.1"
                value={settings.lineHeight}
                onChange={(event) => onLineHeightChange(Number(event.target.value))}
                className="w-full accent-zinc-400"
              />
            </div>
          )}
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => toggleMenu("width")}
            className={triggerClasses}
          >
            <Maximize2 size={16} />
            <span>Largura</span>
            <ChevronDown size={14} className="text-zinc-500" />
          </button>

          {openMenu === "width" && (
            <div className="absolute left-0 top-full z-50 mt-2 w-56 rounded-sm border border-zinc-800 bg-zinc-900 p-3 shadow-2xl">
              <label className="mb-3 block text-sm text-zinc-400">
                Largura do conteúdo: {settings.contentWidth}%
              </label>
              <input
                type="range"
                min="30"
                max="100"
                step="5"
                value={settings.contentWidth}
                onChange={(event) => onContentWidthChange(Number(event.target.value))}
                className="w-full accent-zinc-400"
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
            <ArrowRight size={14} className="text-zinc-500" />
            <span>{getLanguageName(settings.targetLanguage)}</span>
            <ChevronDown size={14} className="text-zinc-500" />
          </button>

          {openMenu === "language" && (
            <div className="absolute left-0 top-full z-50 mt-2 w-64 rounded-sm border border-zinc-800 bg-zinc-900 p-3 shadow-2xl">
              <div className="mb-3">
                <label className="mb-2 block text-xs text-zinc-500">Idioma de origem</label>
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
                          ? "bg-zinc-700 text-zinc-100"
                          : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                      }`}
                    >
                      <span>{lang.flag}</span>
                      <span>{lang.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs text-zinc-500">Idioma de destino</label>
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
                          ? "bg-zinc-700 text-zinc-100"
                          : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                      }`}
                    >
                      <span>{lang.flag}</span>
                      <span>{lang.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onShowPagesChange(!settings.showPages)}
            className={`inline-flex items-center gap-2 rounded-sm border px-3 py-2 text-sm transition ${
              settings.showPages
                ? "border-zinc-500/40 bg-zinc-500/10 text-zinc-200"
                : "border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
            }`}
            title={settings.showPages ? "Ocultar páginas" : "Mostrar páginas"}
          >
            <BookOpen size={16} />
            {settings.showPages ? "Páginas" : "Sem páginas"}
          </button>

          <button
            type="button"
            onClick={() => onShowHighlightsChange(!settings.showHighlights)}
            className={`inline-flex items-center gap-2 rounded-sm border px-3 py-2 text-sm transition ${
              settings.showHighlights
                ? "border-zinc-500/40 bg-zinc-500/10 text-zinc-200"
                : "border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
            }`}
            title={settings.showHighlights ? "Ocultar destaques" : "Mostrar destaques"}
          >
            {settings.showHighlights ? <Eye size={16} /> : <EyeOff size={16} />}
            {settings.showHighlights ? "Destaques" : "Sem destaque"}
          </button>

          <button
            type="button"
            onClick={onToggleVocabularyPanel}
            className={`inline-flex items-center gap-2 rounded-sm border px-3 py-2 text-sm transition ${
              isVocabularyPanelOpen
                ? "border-zinc-600 bg-zinc-800 text-zinc-100"
                : "border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
            }`}
          >
            <BookMarked size={16} />
            Vocabulário
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
