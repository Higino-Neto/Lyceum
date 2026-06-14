/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  BookMarked,
  ChevronDown,
  ChevronUp,
  List,
  Minus,
  Moon,
  Plus,
  Search,
  Sun,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface EpubPaneProps {
  dataUrl?: string;
  location?: string;
  onLocationChange: (location: string, progressPercent: number) => void;
  bookTitle: string;
  onBack: () => void;
}

interface TocItem {
  label: string;
  href: string;
  subitems?: TocItem[];
}

interface SearchHit {
  cfi: string;
  href: string;
  label: string;
  excerpt: string;
}

type ReaderTheme = "paper" | "dark" | "sepia";

type FontFamily = "georgia" | "serif" | "sans" | "opendyslexic";
type MarginLevel = "compact" | "medium" | "wide";

const MARGIN_CONTENT_WIDTH: Record<MarginLevel, number> = {
  compact: 92,
  medium: 84,
  wide: 72,
};

const MARGIN_LABELS: Record<MarginLevel, string> = {
  compact: "Compacto",
  medium: "Medio",
  wide: "Largo",
};

interface ReaderSettings {
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

const FONT_MAP: Record<FontFamily, string> = {
  georgia: "Georgia, 'Times New Roman', serif",
  serif: "'Iowan Old Style', Palatino, 'Book Antiqua', Georgia, serif",
  sans: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  opendyslexic: "'OpenDyslexic', 'Comic Sans MS', 'Trebuchet MS', sans-serif",
};

const FONT_LABELS: Record<FontFamily, string> = {
  georgia: "Georgia",
  serif: "Serif",
  sans: "Sans",
  opendyslexic: "Dyslexic",
};

const THEME_COLORS: Record<ReaderTheme, { background: string; foreground: string; accent: string; border: string }> = {
  paper: { background: "#f7f3ea", foreground: "#18181b", accent: "#047857", border: "#e7e0d2" },
  dark: { background: "#09090b", foreground: "#e4e4e7", accent: "#4ade80", border: "#27272a" },
  sepia: { background: "#efe2c7", foreground: "#292524", accent: "#8a4b12", border: "#d6c9b0" },
};

const SETTINGS_STORAGE_KEY = "lyceum_mobile_reader_settings";

function loadSettings(): ReaderSettings {
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

function persistSettings(settings: ReaderSettings) {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // storage full or unavailable
  }
}

const DEFAULT_SETTINGS: ReaderSettings = {
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

function dataUrlToArrayBuffer(dataUrl: string) {
  const [, base64 = ""] = dataUrl.split(",");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function normalizeText(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function buildExcerpt(text: string, query: string) {
  const normalizedText = normalizeText(text);
  const normalizedQuery = normalizeText(query);
  const index = normalizedText.indexOf(normalizedQuery);
  if (index < 0) return text.slice(0, 110);
  const start = Math.max(0, index - 46);
  const end = Math.min(text.length, index + query.length + 60);
  return `${start > 0 ? "..." : ""}${text.slice(start, end)}${end < text.length ? "..." : ""}`;
}

function flattenToc(items: TocItem[], depth = 0): Array<TocItem & { depth: number }> {
  return items.flatMap((item) => [
    { ...item, depth },
    ...flattenToc(item.subitems || [], depth + 1),
  ]);
}

function getSectionText(section: any) {
  return section.document?.body?.textContent
    || section.document?.documentElement?.textContent
    || "";
}

function computeBodyPad(level: MarginLevel): string {
  const pct = Math.round((100 - MARGIN_CONTENT_WIDTH[level]) / 2);
  return `0 ${pct}%`;
}

function buildOverrideCss(settings: ReaderSettings) {
  const colors = THEME_COLORS[settings.theme];
  const fontStack = FONT_MAP[settings.fontFamily];
  const bodyPad = computeBodyPad(settings.marginLevel);

  return `
    :root { color-scheme: ${settings.theme === "dark" ? "dark" : "light"}; }

    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background: ${colors.background} !important;
      color: ${colors.foreground} !important;
    }

    body {
      font-family: ${fontStack} !important;
      font-size: ${settings.fontSize}% !important;
      line-height: ${settings.lineHeight} !important;
      text-align: justify !important;
      letter-spacing: ${settings.letterSpacing}em !important;
      word-spacing: ${settings.wordSpacing * 0.08}em !important;
      font-weight: ${300 + settings.fontWeight * 125} !important;
      padding: ${bodyPad} !important;
    }

    p {
      margin: 0 0 ${settings.paragraphSpacing}em 0 !important;
      text-indent: ${settings.textIndent}em !important;
    }

    body, p, div, span, li, blockquote, h1, h2, h3, h4, h5, h6 {
      color: ${colors.foreground} !important;
    }

    body, p, div, span, li, blockquote, h1, h2, h3, h4, h5, h6, a, td, th {
      font-family: ${fontStack} !important;
    }

    a {
      color: ${colors.accent} !important;
    }

    ::selection {
      background: ${settings.theme === "dark" ? "rgba(74, 222, 128, 0.35)" : settings.theme === "sepia" ? "rgba(217, 119, 6, 0.25)" : "rgba(4, 120, 87, 0.28)"};
    }
  `;
}

export default function EpubPane({ dataUrl, location, onLocationChange, bookTitle, onBack }: EpubPaneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const bookRef = useRef<any>(null);
  const renditionRef = useRef<any>(null);
  const currentCfiRef = useRef(location);
  const onLocationChangeRef = useRef(onLocationChange);
  const loadIdRef = useRef(0);
  const searchResultsCacheRef = useRef<Map<string, SearchHit[]>>(new Map());
  const lastDisplayedRef = useRef<string | undefined>(location);
  const settingsRef = useRef<ReaderSettings>(loadSettings());
  const scrollCleanupRef = useRef<(() => void) | null>(null);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toc, setToc] = useState<TocItem[]>([]);
  const [tocOpen, setTocOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const showOverlayRef = useRef(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [activeHitIndex, setActiveHitIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);


  const [progress, setProgress] = useState(0);
  const [positionLabel, setPositionLabel] = useState("Inicio");

  const [settings, setSettings] = useState<ReaderSettings>(loadSettings);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    persistSettings(settings);
  }, [settings]);

  const colors = THEME_COLORS[settings.theme];

  const injectStylesToAllIframes = useCallback(() => {
    try {
      const iframes = document.querySelectorAll<HTMLIFrameElement>('iframe');
      for (const iframe of iframes) {
        const doc = iframe?.contentDocument;
        if (!doc?.head) continue;
        const css = buildOverrideCss(settingsRef.current);
        let styleEl = doc.getElementById("lyceum-theme-styles") as HTMLStyleElement | null;
        if (!styleEl) {
          styleEl = doc.createElement("style");
          styleEl.id = "lyceum-theme-styles";
          doc.head.appendChild(styleEl);
        }
        styleEl.textContent = css;
      }
    } catch {
      // cross-origin or destroyed iframes
    }
  }, []);

  const injectStylesRef = useRef(injectStylesToAllIframes);
  useEffect(() => {
    injectStylesRef.current = injectStylesToAllIframes;
  }, [injectStylesToAllIframes]);

  const handleTapZone = useCallback(() => {
    setShowOverlay((v) => !v);
  }, []);

  const applyReaderStyles = useCallback((rendition: any) => {
    if (!rendition?.themes) return;

    const s = settingsRef.current;
    const fontStack = FONT_MAP[s.fontFamily];

    function bodyStyles(theme: ReaderTheme): Record<string, string> {
      const c = THEME_COLORS[theme];
      const base: Record<string, string> = {
        background: `${c.background} !important`,
        color: `${c.foreground} !important`,
        "font-family": `${fontStack} !important`,
        "font-size": `${s.fontSize}% !important`,
        "line-height": `${s.lineHeight} !important`,
        "letter-spacing": `${s.letterSpacing}em !important`,
        margin: "0 !important",
        padding: `${computeBodyPad(s.marginLevel)} !important`,
      };
      return base;
    }

    function makeTheme(theme: ReaderTheme) {
      return {
        body: bodyStyles(theme),
        p: {
          margin: `0 0 ${s.paragraphSpacing}em 0 !important`,
        },
        a: { color: `${THEME_COLORS[theme].accent} !important` },
      };
    }

    rendition.themes.register("paper", makeTheme("paper"));
    rendition.themes.register("dark", makeTheme("dark"));
    rendition.themes.register("sepia", makeTheme("sepia"));
    rendition.themes.select(s.theme);

    rendition.themes.fontSize(`${s.fontSize}%`);
    rendition.themes.override("line-height", `${s.lineHeight}`, true);
    rendition.themes.override("font-family", fontStack, true);
    rendition.themes.override("letter-spacing", `${s.letterSpacing}em`, true);
    rendition.themes.override("word-spacing", `${s.wordSpacing * 0.08}em`, true);
    rendition.themes.override("font-weight", `${300 + s.fontWeight * 125}`, true);
    rendition.themes.override("padding", computeBodyPad(s.marginLevel), true);
  }, []);

  useEffect(() => {
    showOverlayRef.current = showOverlay;
  }, [showOverlay]);

  useEffect(() => {
    onLocationChangeRef.current = onLocationChange;
  }, [onLocationChange]);

  useEffect(() => {
    currentCfiRef.current = location || currentCfiRef.current;
  }, [location]);

  useEffect(() => {
    const rendition = renditionRef.current;
    if (!rendition) return;
    applyReaderStyles(rendition);
    injectStylesToAllIframes();
  }, [settings, applyReaderStyles, injectStylesToAllIframes]);

  useEffect(() => {
    const rendition = renditionRef.current;
    if (!rendition) return;

    const handleResize = () => {
      injectStylesRef.current?.();
      try {
        (rendition as any).resize();
      } catch {
        // ignore
      }
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadId = loadIdRef.current + 1;
    loadIdRef.current = loadId;
    let book: any;

    async function renderBook() {
      if (!containerRef.current) return;
      if (!dataUrl) {
        setReady(false);
        setError("Arquivo EPUB nao encontrado. Religue o arquivo pela biblioteca para continuar lendo.");
        return;
      }

      try {
        renditionRef.current?.destroy?.();
        bookRef.current?.destroy?.();
        renditionRef.current = null;
        bookRef.current = null;
        searchResultsCacheRef.current.clear();

        setError(null);
        setReady(false);
        setHits([]);
        setActiveHitIndex(0);
        setProgress(0);
        setPositionLabel("Inicio");
        containerRef.current.innerHTML = "";

        const mod = await import("epubjs");
        if (!mounted || loadIdRef.current !== loadId) return;
        const createEpub = (mod.default || mod) as any;
        book = createEpub(dataUrlToArrayBuffer(dataUrl));
        bookRef.current = book;

        await book.ready;
        if (!mounted || loadIdRef.current !== loadId || !containerRef.current) return;

        const rendition = book.renderTo(containerRef.current, {
          width: "100%",
          height: "100%",
          flow: "scrolled-doc",
          spread: "none",
          manager: "continuous",
          allowScriptedContent: false,
          resizeOnOrientationChange: true,
        });
        renditionRef.current = rendition;
        applyReaderStyles(rendition);

        rendition.on("rendered", () => {
          injectStylesRef.current?.();

          scrollCleanupRef.current?.();

          try {
            const iframes = document.querySelectorAll<HTMLIFrameElement>("iframe");
            const handlers: Array<() => void> = [];
            for (const iframe of iframes) {
              const doc = iframe?.contentDocument || iframe?.contentWindow?.document;
              if (!doc) continue;
              const onScroll = () => {
                if (showOverlayRef.current) {
                  setShowOverlay(false);
                }
              };
              doc.addEventListener("scroll", onScroll, { passive: true });
              handlers.push(() => doc.removeEventListener("scroll", onScroll));
            }
            if (handlers.length > 0) {
              scrollCleanupRef.current = () => {
                handlers.forEach((fn) => fn());
                scrollCleanupRef.current = null;
              };
            }
          } catch {
            // cross-origin iframe
          }
        });

        rendition.on("relocated", (section: any) => {
          const cfi = section?.start?.cfi;
          if (!cfi) return;
          currentCfiRef.current = cfi;
          const percent = book.locations?.percentageFromCfi
            ? Math.round((book.locations.percentageFromCfi(cfi) || 0) * 100)
            : 0;
          onLocationChangeRef.current(cfi, percent);
          setProgress(percent);
          setPositionLabel(percent > 0
            ? `${percent}%`
            : section?.start?.href
              ? "Lendo"
              : "Inicio");
        });

        const navigation = await book.loaded.navigation.catch(() => null);
        if (mounted && loadIdRef.current === loadId) setToc((navigation?.toc || []) as TocItem[]);

        await book.locations?.generate?.(900).catch(() => null);
        if (!mounted || loadIdRef.current !== loadId) return;

        const target = currentCfiRef.current || location || undefined;
        lastDisplayedRef.current = target;
        await rendition.display(target);
        const current = rendition.currentLocation?.();
        const cfi = current?.start?.cfi;
        if (cfi && book.locations?.percentageFromCfi) {
          const percent = Math.round((book.locations.percentageFromCfi(cfi) || 0) * 100);
          setProgress(percent);
          setPositionLabel(percent > 0 ? `${percent}%` : "Inicio");
        }
        if (mounted && loadIdRef.current === loadId) {
          setReady(true);
          setShowOverlay(true);
        }
      } catch (err) {
        if (mounted && loadIdRef.current === loadId) {
          setError(err instanceof Error ? err.message : "Nao foi possivel abrir este EPUB");
        }
      }
    }

    renderBook();

    return () => {
      mounted = false;
      scrollCleanupRef.current?.();
      scrollCleanupRef.current = null;
      try {
        renditionRef.current?.destroy?.();
        book?.destroy?.();
      } catch {
        // Best effort cleanup for epub.js iframes.
      }
      renditionRef.current = null;
      bookRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataUrl]);

  const updateSetting = <K extends keyof ReaderSettings>(key: K, value: ReaderSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const displayTarget = async (target: string) => {
    currentCfiRef.current = target;
    lastDisplayedRef.current = target;
    await renditionRef.current?.display?.(target);
    setTocOpen(false);
  };

  const runSearch = async () => {
    const book = bookRef.current;
    const searchQuery = query.trim();
    if (!book || searchQuery.length < 2) {
      setHits([]);
      setActiveHitIndex(0);
      return;
    }

    setIsSearching(true);
    try {
      const cacheKey = normalizeText(searchQuery);
      const cached = searchResultsCacheRef.current.get(cacheKey);
      const nextHits: SearchHit[] = cached ? [...cached] : [];

      if (!cached) {
        const spineItems = book.spine?.spineItems || [];
        for (const section of spineItems) {
          try {
            await section.load(book.load.bind(book));
            const text = getSectionText(section);
            if (!normalizeText(text).includes(cacheKey)) continue;

            const label = section?.label || section?.href || "Resultado";
            let found: Array<{ cfi: string; excerpt?: string }> = [];
            try {
              found = section.search?.(searchQuery) || section.find?.(searchQuery) || [];
            } catch {
              found = [];
            }

            if (found.length > 0) {
              found.slice(0, 8).forEach((match) => {
                nextHits.push({
                  cfi: match.cfi,
                  href: section.href,
                  label,
                  excerpt: match.excerpt || buildExcerpt(text, searchQuery),
                });
              });
            } else if (section.cfiBase) {
              nextHits.push({
                cfi: section.cfiBase,
                href: section.href,
                label,
                excerpt: buildExcerpt(text, searchQuery),
              });
            }
          } finally {
            section.unload?.();
          }

          if (nextHits.length >= 80) break;
        }

        searchResultsCacheRef.current.set(cacheKey, nextHits.slice(0, 80));
      }

      setHits(nextHits);
      setActiveHitIndex(0);
      if (nextHits[0]) await displayTarget(nextHits[0].href || nextHits[0].cfi);
    } finally {
      setIsSearching(false);
    }
  };

  const goToHit = (index: number) => {
    if (hits.length === 0) return;
    const nextIndex = (index + hits.length) % hits.length;
    setActiveHitIndex(nextIndex);
    displayTarget(hits[nextIndex].href || hits[nextIndex].cfi);
  };

  const tocItems = flattenToc(toc);

  const fontOptions: FontFamily[] = ["georgia", "serif", "sans", "opendyslexic"];

  return (
    <div className="relative h-full w-full overflow-hidden" style={{ background: colors.background, color: colors.foreground }}>
      {showOverlay && (
        <div className="absolute inset-0 z-30 flex flex-col bg-zinc-950/95 backdrop-blur shadow-2xl">
          {/* Header bar */}
          <div className="flex items-center gap-2 px-3 py-3">
            <button
              className="grid h-9 w-9 shrink-0 place-items-center rounded bg-zinc-900 text-zinc-100"
              onClick={onBack}
              type="button"
              aria-label="Voltar"
            >
              <X size={16} />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-zinc-100">{bookTitle}</p>
              <div className="mt-1.5 h-1 rounded bg-zinc-800">
                <div className="h-full rounded bg-green-500" style={{ width: `${progress}%` }} />
              </div>
            </div>
            <button
              className="grid h-9 w-9 shrink-0 place-items-center rounded bg-zinc-900 text-zinc-100"
              onClick={() => setTocOpen((value) => !value)}
              type="button"
              aria-label="Sumario"
            >
              <List size={16} />
            </button>
            <button
              className="grid h-9 w-9 shrink-0 place-items-center rounded bg-zinc-900 text-zinc-100"
              onClick={() => setSearchOpen((value) => !value)}
              type="button"
              aria-label="Buscar"
            >
              {searchOpen ? <X size={16} /> : <Search size={16} />}
            </button>
            <button
              className="grid h-9 w-9 shrink-0 place-items-center rounded bg-zinc-900 text-zinc-100"
              onClick={() => setShowOverlay(false)}
              type="button"
              aria-label="Fechar"
            >
              <ChevronDown size={16} />
            </button>
          </div>

          {/* Search panel */}
          {searchOpen && (
            <div className="border-t border-zinc-800 px-3 py-3">
              <div className="flex gap-2">
                <input
                  className="h-10 min-w-0 flex-1 rounded bg-zinc-900 px-3 text-sm text-zinc-100"
                  placeholder="Buscar no EPUB"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") runSearch();
                  }}
                />
                <button
                  className="rounded bg-green-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
                  disabled={isSearching}
                  onClick={runSearch}
                  type="button"
                >
                  {isSearching ? "..." : "Ir"}
                </button>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2 text-xs text-zinc-500">
                <span>{hits.length > 0 ? `${activeHitIndex + 1}/${hits.length} resultado(s)` : "Digite ao menos 2 caracteres"}</span>
                <div className="flex gap-1">
                  <button
                    className="grid h-8 w-8 place-items-center rounded bg-zinc-900 text-zinc-200 disabled:opacity-40"
                    disabled={hits.length === 0}
                    onClick={() => goToHit(activeHitIndex - 1)}
                    type="button"
                  >
                    <ChevronUp size={15} />
                  </button>
                  <button
                    className="grid h-8 w-8 place-items-center rounded bg-zinc-900 text-zinc-200 disabled:opacity-40"
                    disabled={hits.length === 0}
                    onClick={() => goToHit(activeHitIndex + 1)}
                    type="button"
                  >
                    <ChevronDown size={15} />
                  </button>
                </div>
              </div>
              {hits[activeHitIndex] && (
                <p className="mt-2 rounded bg-zinc-900 p-2 text-xs leading-5 text-zinc-300">
                  {hits[activeHitIndex].label}: {hits[activeHitIndex].excerpt}
                </p>
              )}
            </div>
          )}

          {/* Settings */}
          <div className="flex-1 overflow-y-auto border-t border-zinc-800 px-3 py-4">
            {/* Font family */}
            <div className="mb-4">
              <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Fonte</label>
              <div className="grid grid-cols-4 gap-2">
                {fontOptions.map((font) => (
                  <button
                    key={font}
                    className={`h-9 rounded text-sm font-medium ${
                      settings.fontFamily === font ? "bg-green-600 text-white" : "bg-zinc-900 text-zinc-200"
                    }`}
                    onClick={() => updateSetting("fontFamily", font)}
                    type="button"
                  >
                    {FONT_LABELS[font]}
                  </button>
                ))}
              </div>
            </div>

            {/* Font size + Line height */}
            <div className="mb-4 grid grid-cols-2 gap-4">
              <div>
                <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Tamanho</label>
                <div className="grid grid-cols-3 gap-1">
                  <button
                    className="grid h-9 place-items-center rounded bg-zinc-900 text-zinc-100 disabled:opacity-40"
                    disabled={settings.fontSize <= 60}
                    onClick={() => updateSetting("fontSize", Math.max(60, settings.fontSize - 5))}
                    type="button"
                  >
                    <Minus size={16} />
                  </button>
                  <div className="grid h-9 place-items-center rounded bg-zinc-900 text-xs text-zinc-200">
                    {settings.fontSize}%
                  </div>
                  <button
                    className="grid h-9 place-items-center rounded bg-zinc-900 text-zinc-100 disabled:opacity-40"
                    disabled={settings.fontSize >= 200}
                    onClick={() => updateSetting("fontSize", Math.min(200, settings.fontSize + 5))}
                    type="button"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Linha</label>
                <button
                  className="h-9 w-full rounded bg-zinc-900 text-xs font-medium text-zinc-100"
                  onClick={() => {
                    const next = settings.lineHeight >= 2.2 ? 1.0 : Number((settings.lineHeight + 0.15).toFixed(2));
                    updateSetting("lineHeight", next);
                  }}
                  type="button"
                >
                  {settings.lineHeight.toFixed(2)}
                </button>
              </div>
            </div>

            {/* Font weight + Word spacing */}
            <div className="mb-4 grid grid-cols-2 gap-4">
              <div>
                <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Peso</label>
                <div className="grid grid-cols-3 gap-1">
                  {[
                    { value: 0, label: "Leve" },
                    { value: 1, label: "Normal" },
                    { value: 2, label: "Negrito" },
                  ].map(({ value, label }) => (
                    <button
                      key={value}
                      className={`h-9 rounded text-xs font-medium ${
                        settings.fontWeight === value ? "bg-green-600 text-white" : "bg-zinc-900 text-zinc-200"
                      }`}
                      onClick={() => updateSetting("fontWeight", value)}
                      type="button"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Palavras</label>
                <div className="grid grid-cols-3 gap-1">
                  {[
                    { value: 0, label: "Nenhum" },
                    { value: 1, label: "Pouco" },
                    { value: 2, label: "Muito" },
                  ].map(({ value, label }) => (
                    <button
                      key={value}
                      className={`h-9 rounded text-xs font-medium ${
                        settings.wordSpacing === value ? "bg-green-600 text-white" : "bg-zinc-900 text-zinc-200"
                      }`}
                      onClick={() => updateSetting("wordSpacing", value)}
                      type="button"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Theme */}
            <div className="mb-4">
              <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Tema</label>
              <div className="grid grid-cols-3 gap-2">
                {(["paper", "dark", "sepia"] as ReaderTheme[]).map((item) => (
                  <button
                    key={item}
                    className={`flex h-9 items-center justify-center gap-2 rounded text-sm font-medium ${
                      settings.theme === item ? "bg-green-600 text-white" : "bg-zinc-900 text-zinc-200"
                    }`}
                    onClick={() => updateSetting("theme", item)}
                    type="button"
                  >
                    {item === "dark" ? <Moon size={15} /> : <Sun size={15} />}
                    {item === "paper" ? "Papel" : item === "dark" ? "Noite" : "Sépia"}
                  </button>
                ))}
              </div>
            </div>

            {/* Margins */}
            <div>
              <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Margens</label>
              <div className="grid grid-cols-3 gap-2">
                {(["compact", "medium", "wide"] as MarginLevel[]).map((level) => (
                  <button
                    key={level}
                    className={`h-9 rounded text-sm font-medium ${
                      settings.marginLevel === level ? "bg-green-600 text-white" : "bg-zinc-900 text-zinc-200"
                    }`}
                    onClick={() => updateSetting("marginLevel", level)}
                    type="button"
                  >
                    {MARGIN_LABELS[level]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="relative h-full w-full">
        <div
          ref={containerRef}
          className="h-full w-full"
        />
        {!ready && !error && (
          <div className="absolute inset-0 grid place-items-center text-sm text-zinc-500">
            Preparando EPUB...
          </div>
        )}
        {error && (
          <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-zinc-600">
            {error}
          </div>
        )}

        {ready && (
          <div className="absolute inset-0 z-10 pointer-events-none">
            <div
              className="absolute top-0 left-0 right-0 z-20 pointer-events-auto"
              style={{ height: "10%" }}
              onClick={handleTapZone}
            />
          </div>
        )}
      </div>

      {tocOpen && (
        <div className="absolute inset-0 z-20 bg-zinc-950/80 backdrop-blur-sm">
          <div className="absolute inset-y-0 left-0 w-[86%] max-w-sm md:max-w-md lg:max-w-xl overflow-y-auto border-r border-zinc-800 bg-zinc-950 p-3 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
                <BookMarked size={17} />
                Sumario
              </div>
              <button
                className="grid h-8 w-8 place-items-center rounded bg-zinc-900 text-zinc-100"
                onClick={() => setTocOpen(false)}
                type="button"
                aria-label="Fechar sumario"
              >
                <X size={16} />
              </button>
            </div>
            {tocItems.length === 0 ? (
              <p className="rounded bg-zinc-900 p-3 text-sm text-zinc-400">Este EPUB nao trouxe sumario navegavel.</p>
            ) : (
              <div className="space-y-1">
                {tocItems.map((item, index) => (
                  <button
                    key={`${item.href}-${index}`}
                    className="w-full rounded px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-900"
                    style={{ paddingLeft: 12 + item.depth * 14 }}
                    onClick={() => displayTarget(item.href)}
                    type="button"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
