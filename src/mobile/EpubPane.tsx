import type { EpubBook, EpubRendition, EpubSection, TocItem, SearchHit } from "./epubAdapter";
import { loadSettings, persistSettings, FONT_MAP, FONT_LABELS, THEME_COLORS, THEME_LABELS, MARGIN_CONTENT_WIDTH, MARGIN_LABELS, type ReaderSettings, type ReaderTheme, type FontFamily, type MarginLevel } from "./textReaderSettings";
import { useTranslation } from "../i18n";
import { ReaderTools, useReaderHistory } from "./ReaderTools";
import { useReaderData } from "./ReaderData";
import type { ReaderLocator } from "./readerModel";
import type { Contents, Location } from "epubjs";

import {
  BookMarked,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Type,
  ChevronUp,
  List,
  Minus,
  Moon,
  NotebookPen,
  Plus,
  Search,
  Sun,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, type SyntheticEvent } from "react";
import MobileSheet from "./MobileSheet";
import { ReadingModeSwitch } from "./ReadingModeSwitch";
import { BACK_EVENT } from "./useBackNavigation";

interface EpubPaneProps {
  bookId?: string;
  dataUrl?: string;
  location?: string;
  onLocationChange: (location: string, progressPercent: number) => void;
  bookTitle: string;
  onBack: () => void;
  onRegister?: () => void;
  /** Switches to the language-learning reader for this book. */
  /** Switches this book to .lyceum reading (remembered per book). */
  onLearn?: () => void;
}

/** Window in which a click on freshly revealed controls is the tail of the revealing tap. */
const GHOST_CLICK_MS = 400;

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

function getSectionText(section: EpubSection) {
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

export default function EpubPane({ bookId, dataUrl, location, onLocationChange, bookTitle, onBack, onRegister, onLearn }: EpubPaneProps) {
  const { data: readerData } = useReaderData();
  const [selection, setSelection] = useState<{ locator: ReaderLocator; text: string }>();
  const [footnote, setFootnote] = useState("");
  const searchGeneration = useRef(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const bookRef = useRef<EpubBook | null>(null);
  const renditionRef = useRef<EpubRendition | null>(null);
  const currentCfiRef = useRef(location);
  const history = useReaderHistory({ format: "epub", cfi: location || "epubcfi(/6/2!/4/1:0)" }, l => { if (l.format === "epub") void renditionRef.current?.display(l.cfi); });
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
  /** When the controls appeared: clicks right after belong to the tap that revealed them. */
  const overlayShownAtRef = useRef(0);
  const swallowGhostClick = useCallback((event: SyntheticEvent) => {
    if (Date.now() - overlayShownAtRef.current < GHOST_CLICK_MS) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, []);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [chapterLabel, setChapterLabel] = useState("");
  const [locationsReady, setLocationsReady] = useState(false);
  const [sliderValue, setSliderValue] = useState<number | null>(null);
  const tocRef = useRef<TocItem[]>([]);
  const showOverlayRef = useRef(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [activeHitIndex, setActiveHitIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);


  const [progress, setProgress] = useState(0);
  const { t } = useTranslation();
  const [positionLabel, setPositionLabel] = useState(t("mobile:epub.start"));

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
      const iframes = containerRef.current?.querySelectorAll<HTMLIFrameElement>('iframe') || [];
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

  /**
   * Taps inside the book: in paginated mode the outer thirds turn the page
   * and the middle shows/hides the controls; in scrolled mode any tap toggles
   * the controls. `x` is relative to the reader's left edge.
   */
  const handleTap = useCallback((x: number) => {
    const width = containerRef.current?.clientWidth || window.innerWidth;
    if (settingsRef.current.paginated && !showOverlayRef.current) {
      if (x < width * 0.28) {
        void renditionRef.current?.prev();
        return;
      }
      if (x > width * 0.72) {
        void renditionRef.current?.next();
        return;
      }
    }
    setShowOverlay((visible) => {
      if (!visible) overlayShownAtRef.current = Date.now();
      return !visible;
    });
  }, []);
  const handleTapRef = useRef(handleTap);
  handleTapRef.current = handleTap;

  const applyReaderStyles = useCallback((rendition: EpubRendition) => {
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
    const anchor = currentCfiRef.current;
    applyReaderStyles(rendition);
    injectStylesToAllIframes();
    if (anchor) void rendition.display(anchor);
  }, [settings, applyReaderStyles, injectStylesToAllIframes]);

  useEffect(() => {
    const handleResize = () => {
      const rendition = renditionRef.current;
      if (!rendition) return;
      const anchor = currentCfiRef.current;
      injectStylesRef.current?.();
      try {
        rendition.resize(containerRef.current?.clientWidth || window.innerWidth, containerRef.current?.clientHeight || window.innerHeight);
        if (anchor) void rendition.display(anchor);
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
    let book: EpubBook;

    async function renderBook() {
      if (!containerRef.current) return;
      if (!dataUrl) {
        setReady(false);
        setError(t("mobile:epub.fileNotFound"));
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
        setPositionLabel(t("mobile:epub.start"));
        containerRef.current.innerHTML = "";

        const mod = await import("epubjs");
        if (!mounted || loadIdRef.current !== loadId) return;
        const createEpub = mod.default;
        const buffer = dataUrl.startsWith("data:") ? dataUrlToArrayBuffer(dataUrl) : await (await fetch(dataUrl)).arrayBuffer();
        if (!mounted || loadIdRef.current !== loadId) return;
        book = createEpub(buffer) as unknown as EpubBook;
        bookRef.current = book;

        await book.ready;
        if (!mounted || loadIdRef.current !== loadId || !containerRef.current) return;

        const rendition = book.renderTo(containerRef.current, {
          width: "100%",
          height: "100%",
          // Scrolling flows through chapters ("continuous"); paginated keeps one section per view.
          flow: settingsRef.current.paginated ? "paginated" : "scrolled",
          spread: "none",
          manager: settingsRef.current.paginated ? "default" : "continuous",
          allowScriptedContent: false,
          resizeOnOrientationChange: true,
        });
        renditionRef.current = rendition;
        applyReaderStyles(rendition);

        rendition.on("selected", (cfi: string, contents: Contents) => {
          const text = contents.window.getSelection()?.toString() || "";
          if (text.trim()) setSelection({ locator: { format: "epub", cfi }, text });
        });
        rendition.hooks.content.register((contents: Contents) => {
          // Swipe to turn pages; tap zones (see handleTap). Long-press selection is left alone.
          let touchStart: { x: number; y: number; time: number } | null = null;
          contents.document.addEventListener("touchstart", (event: TouchEvent) => {
            const touch = event.touches[0];
            touchStart = touch && event.touches.length === 1 ? { x: touch.clientX, y: touch.clientY, time: Date.now() } : null;
          }, { passive: true });
          contents.document.addEventListener("touchend", (event: TouchEvent) => {
            const start = touchStart;
            touchStart = null;
            const touch = event.changedTouches[0];
            if (!start || !touch) return;
            const selection = contents.window.getSelection();
            if (selection && !selection.isCollapsed && selection.toString().trim()) return;
            const dx = touch.clientX - start.x;
            const dy = touch.clientY - start.y;
            const elapsed = Date.now() - start.time;
            if (settingsRef.current.paginated && Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.4 && elapsed < 800) {
              if (dx < 0) void renditionRef.current?.next();
              else void renditionRef.current?.prev();
              setShowOverlay(false);
              return;
            }
            if (Math.abs(dx) > 10 || Math.abs(dy) > 10 || elapsed > 450) return;
            if ((event.target as Element | null)?.closest?.("a")) return;
            // The tap is fully handled here. Cancelling it stops the browser's
            // synthetic click from landing on the controls this tap reveals
            // (it used to hit the top bar and open another reader).
            if (event.cancelable) event.preventDefault();
            const frame = contents.window.frameElement as HTMLElement | null;
            const frameLeft = frame?.getBoundingClientRect().left ?? 0;
            const containerLeft = containerRef.current?.getBoundingClientRect().left ?? 0;
            handleTapRef.current(frameLeft + touch.clientX - containerLeft);
          }, { passive: false });
          contents.document.addEventListener("click", (event: MouseEvent) => {
            const link = (event.target as Element)?.closest("a");
            if (!link) return;
            const href = link.getAttribute("href") || "";
            if (link.getAttribute("epub:type")?.includes("noteref") || link.getAttribute("role") === "doc-noteref") {
              const id = href.split("#")[1];
              const note = id && contents.document.getElementById(decodeURIComponent(id));
              if (note) { event.preventDefault(); event.stopImmediatePropagation(); setFootnote(note.textContent || ""); }
            }
          }, true);
        });
        rendition.on("rendered", () => {
          injectStylesRef.current?.();

          scrollCleanupRef.current?.();

          try {
            const iframes = containerRef.current?.querySelectorAll<HTMLIFrameElement>("iframe") || [];
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

        rendition.on("relocated", (section: Location) => {
          const cfi = section?.start?.cfi;
          if (!cfi) return;
          currentCfiRef.current = cfi;
          const percent = book.locations?.percentageFromCfi
            ? Math.round((book.locations.percentageFromCfi(cfi) || 0) * 100)
            : 0;
          onLocationChangeRef.current(cfi, percent);
          setProgress(percent);
          setPositionLabel(section.start.displayed?.total
            ? t("mobile:epub.positionInChapter", { page: section.start.displayed.page, total: section.start.displayed.total, percent })
            : t("mobile:epub.percentOfBook", { percent }));
          const href = (section.start.href || "").split("#")[0];
          const entry = flattenToc(tocRef.current).filter((item) => item.href.split("#")[0].endsWith(href) || href.endsWith(item.href.split("#")[0])).pop();
          setChapterLabel(entry?.label?.trim() || "");
        });

        const navigation = await book.loaded.navigation.catch(() => null);
        if (mounted && loadIdRef.current === loadId) {
          tocRef.current = (navigation?.toc || []) as TocItem[];
          setToc(tocRef.current);
        }

        if (!mounted || loadIdRef.current !== loadId) return;

        const target = currentCfiRef.current || location || undefined;
        lastDisplayedRef.current = target;
        await rendition.display(target);
        const current = rendition.currentLocation?.();
        const cfi = current?.start?.cfi;
        if (cfi && book.locations?.percentageFromCfi) {
          const percent = Math.round((book.locations.percentageFromCfi(cfi) || 0) * 100);
          setProgress(percent);
          setPositionLabel(percent > 0 ? `${percent}%` : t("mobile:epub.start"));
        }
        if (mounted && loadIdRef.current === loadId) {
          setReady(true);
          // Locations (needed for % and the position slider) are expensive on long books: cache them per book.
          const locationsKey = `lyceum-epub-locations:v1:${bookId || bookTitle}`;
          let cachedLocations: string | null = null;
          try { cachedLocations = localStorage.getItem(locationsKey); } catch { /* storage unavailable */ }
          const locationsReadyPromise = cachedLocations
            ? Promise.resolve(book.locations.load(cachedLocations))
            : book.locations.generate(900).then(() => {
              try { localStorage.setItem(locationsKey, book.locations.save()); } catch { /* quota: regenerate next time */ }
            });
          void locationsReadyPromise.then(() => {
            if (mounted && loadIdRef.current === loadId) setLocationsReady(true);
            if (!mounted || loadIdRef.current !== loadId || !currentCfiRef.current) return;
            const percent = Math.round(book.locations.percentageFromCfi(currentCfiRef.current) * 100);
            setProgress(percent); onLocationChangeRef.current(currentCfiRef.current, percent);
          }).catch(() => undefined);
        }
      } catch (err) {
        if (mounted && loadIdRef.current === loadId) {
          setError(err instanceof Error ? err.message : t("mobile:epub.openFailed"));
        }
      }
    }

    renderBook();

    return () => {
      mounted = false;
      // eslint-disable-next-line react-hooks/exhaustive-deps
      searchGeneration.current++;
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
  // The manager is fixed at render time, so switching between paging and scrolling re-renders (position is kept).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataUrl, settings.paginated]);

  useEffect(() => {
    const rendition = renditionRef.current;
    if (!rendition || !ready) return;
    const annotations = readerData.annotations.filter(a => a.bookId === bookId && !a.deletedAt && a.type !== "bookmark" && a.locator.format === "epub");
    for (const a of annotations) {
      if (a.locator.format === "epub") rendition.annotations.highlight(a.locator.cfi, {}, () => setSelection({ locator: a.locator, text: a.text }), "lyceum-highlight", { fill: a.color, "fill-opacity": "0.3", "mix-blend-mode": "multiply" });
    }
    return () => { for (const a of annotations) if (a.locator.format === "epub") { try { rendition.annotations.remove(a.locator.cfi, "highlight"); } catch { /* Destroyed. */ } } };
  }, [readerData.annotations, bookId, ready]);

  const updateSetting = <K extends keyof ReaderSettings>(key: K, value: ReaderSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const displayTarget = async (target: string) => {
    if (target.startsWith("epubcfi(")) history.record({ format: "epub", cfi: target });
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

    const generation = ++searchGeneration.current;
    setIsSearching(true);
    try {
      const cacheKey = normalizeText(searchQuery);
      const cached = searchResultsCacheRef.current.get(cacheKey);
      const nextHits: SearchHit[] = cached ? [...cached] : [];

      if (!cached) {
        const spineItems = book.spine?.spineItems || [];
        for (const section of spineItems) {
          if (generation !== searchGeneration.current) return;
          try {
            await section.load(book.load.bind(book));
            if (generation !== searchGeneration.current) return;
            const text = getSectionText(section);
            if (!normalizeText(text).includes(cacheKey)) continue;

            const label = section?.label || section?.href || t("mobile:epub.searchHitLabel");
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

          if (generation !== searchGeneration.current) return;
          setHits([...nextHits].slice(0, 80));
          await new Promise(resolve => setTimeout(resolve, 0));
          if (nextHits.length >= 80) break;
        }

        searchResultsCacheRef.current.set(cacheKey, nextHits.slice(0, 80));
      }

      setHits(nextHits);
      setActiveHitIndex(0);
      if (nextHits[0]) await displayTarget(nextHits[0].cfi || nextHits[0].href);
    } catch {
      if (generation === searchGeneration.current) setError(t("mobile:epub.searchIncomplete"));
    } finally {
      if (generation === searchGeneration.current) setIsSearching(false);
    }
  };

  const goToHit = (index: number) => {
    if (hits.length === 0) return;
    const nextIndex = (index + hits.length) % hits.length;
    setActiveHitIndex(nextIndex);
    displayTarget(hits[nextIndex].cfi || hits[nextIndex].href);
  };

  const commitSlider = () => {
    const value = sliderValue;
    setSliderValue(null);
    const book = bookRef.current;
    if (value === null || !book || !locationsReady) return;
    try {
      const cfi = book.locations.cfiFromPercentage(Math.min(0.9999, Math.max(0, value / 100)));
      if (cfi) void displayTarget(cfi);
    } catch {
      /* locations not ready */
    }
  };

  /** Jumps to the start of the previous/next spine section. */
  const goToChapter = async (direction: 1 | -1) => {
    const book = bookRef.current;
    const rendition = renditionRef.current;
    if (!book || !rendition) return;
    const current = rendition.currentLocation?.() as unknown as { start?: { index?: number } } | undefined;
    const index = current?.start?.index;
    if (index === undefined) return;
    const target = book.spine.get(index + direction);
    if (target?.href) await displayTarget(target.href);
  };

  // Android back closes the topmost layer of the reader first.
  useEffect(() => {
    const onBack = (event: Event) => {
      if (settingsOpen) setSettingsOpen(false);
      else if (tocOpen) setTocOpen(false);
      else if (footnote) setFootnote("");
      else if (searchOpen) setSearchOpen(false);
      else return;
      event.preventDefault();
    };
    window.addEventListener(BACK_EVENT, onBack);
    return () => window.removeEventListener(BACK_EVENT, onBack);
  }, [footnote, searchOpen, settingsOpen, tocOpen]);

  const tocItems = flattenToc(toc);

  const fontOptions: FontFamily[] = ["georgia", "serif", "sans", "opendyslexic"];

  return (
    <div className="relative h-full w-full overflow-hidden" style={{ background: colors.background, color: colors.foreground }}>
      <ReaderTools onTurn={direction => { if (direction > 0) void renditionRef.current?.next(); else void renditionRef.current?.prev(); }} bookId={bookId} locator={currentCfiRef.current?.startsWith("epubcfi(") ? { format: "epub", cfi: currentCfiRef.current } : undefined} selection={selection} clearSelection={() => { setSelection(undefined); for (const iframe of containerRef.current?.querySelectorAll("iframe") || []) iframe.contentWindow?.getSelection()?.removeAllRanges(); }} history={history} navigate={l => { if (l.format === "epub") void renditionRef.current?.display(l.cfi); }} getText={async () => Array.from(containerRef.current?.querySelectorAll("iframe") || []).map(iframe => iframe.contentDocument?.body.textContent || "").join("\n")} />
      {footnote && <div role="dialog" aria-label={t("mobile:epub.footnoteAriaLabel")} className="absolute inset-x-3 bottom-12 z-[60] max-h-[60%] overflow-auto rounded-xl bg-surface p-4 text-foreground shadow-xl"><button className="float-right p-2" onClick={() => setFootnote("")}>{t("common:actions.close")}</button><p className="whitespace-pre-wrap">{footnote}</p></div>}
      {showOverlay && ready && (
        <>
          <div onClickCapture={swallowGhostClick} className="absolute inset-x-0 top-0 z-30 border-b border-border bg-surface/95 pt-[env(safe-area-inset-top)] text-foreground shadow-lg backdrop-blur">
            <div className="flex h-14 items-center gap-1 px-1.5">
              <button className="grid h-11 w-11 shrink-0 place-items-center rounded-full active:bg-surface-muted" onClick={onBack} type="button" aria-label={t("common:actions.back")}>
                <ChevronLeft size={22} />
              </button>
              <div className="min-w-0 flex-1 px-1">
                <p className="truncate text-sm font-semibold">{bookTitle}</p>
                {chapterLabel && <p className="truncate text-xs text-foreground-subtle">{chapterLabel}</p>}
              </div>
              {onRegister && <button className="grid h-11 w-11 shrink-0 place-items-center rounded-full active:bg-surface-muted" onClick={onRegister} type="button" aria-label={t("mobile:epub.registerReadingAriaLabel")}><NotebookPen size={19} /></button>}
              <button className="grid h-11 w-11 shrink-0 place-items-center rounded-full active:bg-surface-muted" onClick={() => setTocOpen((value) => !value)} type="button" aria-label={t("mobile:epub.tocAriaLabel")}>
                <List size={20} />
              </button>
              <button className="grid h-11 w-11 shrink-0 place-items-center rounded-full active:bg-surface-muted" onClick={() => setSearchOpen((value) => !value)} type="button" aria-label={t("mobile:epub.searchAriaLabel")}>
                {searchOpen ? <X size={20} /> : <Search size={20} />}
              </button>
              <button className="grid h-11 w-11 shrink-0 place-items-center rounded-full active:bg-surface-muted" onClick={() => setSettingsOpen(true)} type="button" aria-label={t("mobile:reader.settingsAriaLabel")}>
                <Type size={20} />
              </button>
            </div>
          {/* Search panel */}
          {searchOpen && (
            <div className="border-t border-border px-3 py-3">
              <div className="flex gap-2">
                <input
                  className="h-10 min-w-0 flex-1 rounded bg-surface-muted px-3 text-sm text-foreground"
                  placeholder={t("mobile:epub.searchPlaceholder")}
                  value={query}
                  onChange={(event) => { searchGeneration.current++; setIsSearching(false); setQuery(event.target.value); }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") runSearch();
                  }}
                />
                <button
                  className="rounded bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                  onClick={() => { if (isSearching) { searchGeneration.current++; setIsSearching(false); } else void runSearch(); }}
                  type="button"
                >
                  {isSearching ? t("common:actions.cancel") : t("mobile:epub.searchGo")}
                </button>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2 text-xs text-foreground-subtle">
                <span>{hits.length > 0
                  ? t("mobile:epub.searchProgress", { hit: activeHitIndex + 1, total: hits.length })
                  : t("mobile:epub.searchHint")}</span>
                <div className="flex gap-1">
                  <button
                    className="grid h-8 w-8 place-items-center rounded bg-surface text-foreground disabled:opacity-40"
                    disabled={hits.length === 0}
                    onClick={() => goToHit(activeHitIndex - 1)}
                    type="button"
                  >
                    <ChevronUp size={15} />
                  </button>
                  <button
                    className="grid h-8 w-8 place-items-center rounded bg-surface text-foreground disabled:opacity-40"
                    disabled={hits.length === 0}
                    onClick={() => goToHit(activeHitIndex + 1)}
                    type="button"
                  >
                    <ChevronDown size={15} />
                  </button>
                </div>
              </div>
              {hits[activeHitIndex] && (
                <p className="mt-2 rounded bg-surface p-2 text-xs leading-5 text-foreground">
                  {hits[activeHitIndex].label}: {hits[activeHitIndex].excerpt}
                </p>
              )}
            </div>
          )}

          </div>
          <div onClickCapture={swallowGhostClick} className="absolute inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 px-3 pb-[max(10px,env(safe-area-inset-bottom))] pt-2 text-foreground shadow-lg backdrop-blur">
            <div className="flex items-center gap-2">
              <button className="grid h-11 w-11 shrink-0 place-items-center rounded-full active:bg-surface-muted" onClick={() => void goToChapter(-1)} type="button" aria-label={t("mobile:epub.previousChapter")}>
                <ChevronLeft size={20} />
              </button>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                disabled={!locationsReady}
                value={sliderValue ?? progress}
                aria-label={t("mobile:epub.positionSlider")}
                onChange={(event) => setSliderValue(Number(event.target.value))}
                onPointerUp={() => commitSlider()}
                onKeyUp={() => commitSlider()}
                onTouchEnd={() => commitSlider()}
                className="h-11 min-w-0 flex-1 accent-[var(--primary)] disabled:opacity-40"
              />
              <button className="grid h-11 w-11 shrink-0 place-items-center rounded-full active:bg-surface-muted" onClick={() => void goToChapter(1)} type="button" aria-label={t("mobile:epub.nextChapter")}>
                <ChevronRight size={20} />
              </button>
            </div>
            <p className="pb-0.5 text-center text-xs text-foreground-subtle">{sliderValue !== null ? t("mobile:epub.percentOfBook", { percent: sliderValue }) : positionLabel}</p>
          </div>
        </>
      )}
      <MobileSheet open={settingsOpen} title={t("mobile:reader.settingsAriaLabel")} onClose={() => setSettingsOpen(false)} closeLabel={t("common:actions.close")} size="full">
          <div className="pb-2 pt-1">
            {onLearn && (
              <div className="mb-5 border-b border-border pb-4">
                <ReadingModeSwitch mode="reader" formatLabel="EPUB" onChange={(mode) => { if (mode === "learning") { setSettingsOpen(false); onLearn(); } }} />
              </div>
            )}
            <label className="mb-4 flex gap-3 text-foreground"><input type="checkbox" checked={settings.paginated} onChange={e => updateSetting("paginated", e.target.checked)} /> {t("mobile:reader.paginatedLabel")}</label>
            {/* Font family */}
            <div className="mb-4">
              <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-foreground-subtle">{t("mobile:reader.fontFamilyLabel")}</label>
              <div className="grid grid-cols-4 gap-2">
                {fontOptions.map((font) => (
                  <button
                    key={font}
                    className={`h-9 rounded text-sm font-medium ${
                      settings.fontFamily === font ? "bg-primary text-primary-foreground" : "bg-surface-muted text-foreground"
                    }`}
                    onClick={() => updateSetting("fontFamily", font)}
                    type="button"
                  >
                    {t(FONT_LABELS[font])}
                  </button>
                ))}
              </div>
            </div>

            {/* Font size + Line height */}
            <div className="mb-4 grid grid-cols-2 gap-4">
              <div>
                <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-foreground-subtle">{t("mobile:reader.fontSizeLabel")}</label>
                <div className="grid grid-cols-3 gap-1">
                  <button
                    className="grid h-9 place-items-center rounded bg-surface-muted text-foreground disabled:opacity-40"
                    disabled={settings.fontSize <= 60}
                    onClick={() => updateSetting("fontSize", Math.max(60, settings.fontSize - 5))}
                    type="button"
                  >
                    <Minus size={16} />
                  </button>
                  <div className="grid h-9 place-items-center rounded bg-surface-muted text-xs text-foreground">
                    {settings.fontSize}%
                  </div>
                  <button
                    className="grid h-9 place-items-center rounded bg-surface-muted text-foreground disabled:opacity-40"
                    disabled={settings.fontSize >= 200}
                    onClick={() => updateSetting("fontSize", Math.min(200, settings.fontSize + 5))}
                    type="button"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-foreground-subtle">{t("mobile:reader.lineHeightLabel")}</label>
                <button
                  className="h-9 w-full rounded bg-surface-muted text-xs font-medium text-foreground"
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
                <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-foreground-subtle">{t("mobile:reader.fontWeightLabel")}</label>
                <div className="grid grid-cols-3 gap-1">
                  {[
                    { value: 0, label: t("mobile:reader.fontWeights.light") },
                    { value: 1, label: t("mobile:reader.fontWeights.regular") },
                    { value: 2, label: t("mobile:reader.fontWeights.bold") },
                  ].map(({ value, label }) => (
                    <button
                      key={value}
                      className={`h-9 rounded text-xs font-medium ${
                        settings.fontWeight === value ? "bg-primary text-primary-foreground" : "bg-surface-muted text-foreground"
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
                <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-foreground-subtle">{t("mobile:reader.wordSpacingLabel")}</label>
                <div className="grid grid-cols-3 gap-1">
                  {[
                    { value: 0, label: t("mobile:reader.wordSpacings.none") },
                    { value: 1, label: t("mobile:reader.wordSpacings.little") },
                    { value: 2, label: t("mobile:reader.wordSpacings.lot") },
                  ].map(({ value, label }) => (
                    <button
                      key={value}
                      className={`h-9 rounded text-xs font-medium ${
                        settings.wordSpacing === value ? "bg-primary text-primary-foreground" : "bg-surface-muted text-foreground"
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
              <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-foreground-subtle">{t("mobile:reader.themeLabel")}</label>
              <div className="grid grid-cols-3 gap-2">
                {(["paper", "dark", "sepia"] as ReaderTheme[]).map((item) => (
                  <button
                    key={item}
                    className={`flex h-9 items-center justify-center gap-2 rounded text-sm font-medium ${
                      settings.theme === item ? "bg-primary text-primary-foreground" : "bg-surface-muted text-foreground"
                    }`}
                    onClick={() => updateSetting("theme", item)}
                    type="button"
                  >
                    {item === "dark" ? <Moon size={15} /> : <Sun size={15} />}
                    {t(THEME_LABELS[item])}
                  </button>
                ))}
              </div>
            </div>

            {/* Margins */}
            <div>
              <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-foreground-subtle">{t("mobile:reader.marginsLabel")}</label>
              <div className="grid grid-cols-3 gap-2">
                {(["compact", "medium", "wide"] as MarginLevel[]).map((level) => (
                  <button
                    key={level}
                    className={`h-9 rounded text-sm font-medium ${
                      settings.marginLevel === level ? "bg-primary text-primary-foreground" : "bg-surface-muted text-foreground"
                    }`}
                    onClick={() => updateSetting("marginLevel", level)}
                    type="button"
                  >
                    {t(MARGIN_LABELS[level])}
                  </button>
                ))}
              </div>
            </div>
          </div>
      </MobileSheet>
      <div className="relative h-full w-full">
        <div
          ref={containerRef}
          className="h-full w-full"
        />
        {!ready && !error && (
          <div className="absolute inset-0 grid place-items-center text-sm text-foreground-subtle">
            {t("mobile:epub.preparing")}
          </div>
        )}
        {error && (
          <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-foreground-subtle">
            {error}
          </div>
        )}

      </div>

      {tocOpen && (
        <div className="absolute inset-0 z-20 bg-background/80 backdrop-blur-sm">
          <div className="absolute inset-y-0 left-0 w-[86%] max-w-sm md:max-w-md lg:max-w-xl overflow-y-auto border-r border-border bg-background p-3 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <BookMarked size={17} />
                {t("mobile:epub.tocAriaLabel")}
              </div>
              <button
                className="grid h-8 w-8 place-items-center rounded bg-surface text-foreground"
                onClick={() => setTocOpen(false)}
                type="button"
                aria-label={t("mobile:epub.closeTocAriaLabel")}
              >
                <X size={16} />
              </button>
            </div>
            {tocItems.length === 0 ? (
              <p className="rounded bg-surface p-3 text-sm text-foreground-muted">{t("mobile:epub.noToc")}</p>
            ) : (
              <div className="space-y-1">
                {tocItems.map((item, index) => (
                  <button
                    key={`${item.href}-${index}`}
                    className="w-full rounded px-3 py-2 text-left text-sm text-foreground hover:bg-surface"
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
