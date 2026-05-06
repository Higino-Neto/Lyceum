import { ChevronDown, ChevronUp, LoaderCircle } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  TextSelectionPayload,
  VocabularyEntry,
  WordInteractionPayload,
  extractUniqueWords,
  tokenizeText,
} from "../languageLearning";
import {
  HIGHLIGHT_COLORS,
  ReaderSettings,
  THEME_COLORS,
  getFontStack,
} from "../theme";
import type { NavItem } from "../types";
import useReadingStatePersistence from "../../../hooks/useReadingStatePersistence";
import {
  InternalEpubBook,
  InternalEpubChapter,
  normalizeEpubPath,
  parseInternalEpub,
  releaseInternalEpubResources,
} from "./epubParser";

interface InternalViewerCoreProps {
  epubData: ArrayBuffer;
  fileHash: string;
  settings: ReaderSettings;
  vocabularyEntries: Record<string, VocabularyEntry>;
  onWordClick: (payload: WordInteractionPayload) => void;
  onWordRightClick: (payload: WordInteractionPayload) => void;
  onTextSelection: (payload: TextSelectionPayload) => void;
  onVocabularyIndex: (count: number) => void;
  onDismissOverlays: () => void;
  onViewerScroll: (scrollTop: number) => void;
  onScrollPositionChange?: (scrollTop: number) => void;
  onProgressChange?: (percentage: number, totalLocations?: number) => void;
  onNavigationLoaded?: (toc: NavItem[]) => void;
  onNavigateToChapter?: (href: string) => void;
  currentSectionHref?: string;
}

interface PageMetrics {
  viewportWidth: number;
  viewportHeight: number;
  pageWidth: number;
  pageHeight: number;
  pageGap: number;
  sidePadding: number;
  verticalPadding: number;
  pagePitch: number;
}

interface VirtualPage {
  index: number;
  chapterIndex: number;
  chapterHref: string;
  html: string;
  textLength: number;
}

interface PersistedInternalLocation {
  engine: "internal";
  version: 2;
  pageIndex: number;
  totalPages: number;
  percentage: number;
  href?: string;
  scrollTop: number;
  updatedAt: number;
}

const WORD_STATE_CLASSES = ["word-new", "word-learning", "word-known", "word-saved"];
const INTERNAL_STATE_SUFFIX = ":epub-internal";
const VIRTUALIZATION_OVERSCAN = 5;
const PAGE_HEIGHT_TOLERANCE = 8;
const DEFAULT_METRICS: PageMetrics = {
  viewportWidth: 0,
  viewportHeight: 0,
  pageWidth: 640,
  pageHeight: 760,
  pageGap: 28,
  sidePadding: 48,
  verticalPadding: 24,
  pagePitch: 788,
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function clampProgress(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  return clamp(value, 0, 1);
}

function sameMetrics(a: PageMetrics, b: PageMetrics) {
  return (
    a.viewportWidth === b.viewportWidth &&
    a.viewportHeight === b.viewportHeight &&
    a.pageWidth === b.pageWidth &&
    a.pageHeight === b.pageHeight &&
    a.pageGap === b.pageGap &&
    a.sidePadding === b.sidePadding &&
    a.verticalPadding === b.verticalPadding
  );
}

function calculateMetrics(container: HTMLElement, settings: ReaderSettings): PageMetrics {
  const viewportWidth = Math.max(320, container.clientWidth || DEFAULT_METRICS.pageWidth);
  const viewportHeight = Math.max(420, container.clientHeight || DEFAULT_METRICS.pageHeight);
  const compact = viewportWidth < 720;
  const pageGap = compact ? 18 : 28;
  const verticalPadding = compact ? 12 : 24;
  const horizontalReserve = compact ? 20 : 96;
  const maxPageWidth = compact ? viewportWidth - horizontalReserve : 980;
  const preferredWidth = viewportWidth * (settings.contentWidth / 100);
  const pageWidth = Math.round(
    clamp(preferredWidth, compact ? 280 : 380, Math.max(280, Math.min(maxPageWidth, viewportWidth - 16))),
  );
  const pageHeight = Math.round(Math.max(360, viewportHeight - verticalPadding * 2));
  const sidePadding = Math.round(Math.max(compact ? 10 : 32, (viewportWidth - pageWidth) / 2));

  return {
    viewportWidth,
    viewportHeight,
    pageWidth,
    pageHeight,
    pageGap,
    sidePadding,
    verticalPadding,
    pagePitch: pageHeight + pageGap,
  };
}

function parsePersistedLocation(raw: string | null | undefined): PersistedInternalLocation | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<PersistedInternalLocation & { scrollLeft?: number }> | null;
    if (!parsed || parsed.engine !== "internal") {
      return null;
    }

    const pageIndex =
      typeof parsed.pageIndex === "number" && Number.isFinite(parsed.pageIndex)
        ? Math.max(0, Math.round(parsed.pageIndex))
        : 0;
    const totalPages =
      typeof parsed.totalPages === "number" && Number.isFinite(parsed.totalPages)
        ? Math.max(1, Math.round(parsed.totalPages))
        : 1;

    return {
      engine: "internal",
      version: 2,
      pageIndex,
      totalPages,
      percentage: clampProgress(parsed.percentage) ?? 0,
      href: typeof parsed.href === "string" ? parsed.href : undefined,
      scrollTop:
        typeof parsed.scrollTop === "number" && Number.isFinite(parsed.scrollTop)
          ? Math.max(0, parsed.scrollTop)
          : typeof parsed.scrollLeft === "number" && Number.isFinite(parsed.scrollLeft)
            ? Math.max(0, parsed.scrollLeft)
            : 0,
      updatedAt:
        typeof parsed.updatedAt === "number" && Number.isFinite(parsed.updatedAt)
          ? parsed.updatedAt
          : 0,
    };
  } catch {
    return null;
  }
}

function getProgressForPage(pageIndex: number, totalPages: number) {
  if (totalPages <= 1) return 0;
  return clamp(pageIndex / (totalPages - 1), 0, 1);
}

function getDisplayProgressForPage(pageIndex: number, totalPages: number) {
  if (totalPages <= 0) return 0;
  return Math.round(((pageIndex + 1) / totalPages) * 100);
}

function buildPageOffsets(
  pageCount: number,
  pageHeights: Record<number, number>,
  metrics: PageMetrics,
) {
  const offsets: number[] = [];
  const heights: number[] = [];
  let nextTop = metrics.verticalPadding;

  for (let index = 0; index < pageCount; index += 1) {
    offsets[index] = nextTop;
    const measuredHeight = pageHeights[index];
    const height =
      typeof measuredHeight === "number" && Number.isFinite(measuredHeight)
        ? Math.max(metrics.pageHeight, measuredHeight)
        : metrics.pageHeight;
    heights[index] = height;
    nextTop += height + metrics.pageGap;
  }

  return {
    offsets,
    heights,
    totalHeight: nextTop - metrics.pageGap + metrics.verticalPadding,
  };
}

function findPageByScrollTop(
  scrollTop: number,
  offsets: number[],
  heights: number[],
  pageCount: number,
) {
  if (pageCount <= 1) return 0;

  let low = 0;
  let high = pageCount - 1;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const top = offsets[middle] ?? 0;
    const bottom = top + (heights[middle] ?? 0);

    if (scrollTop < top) {
      high = middle - 1;
    } else if (scrollTop > bottom) {
      low = middle + 1;
    } else {
      return middle;
    }
  }

  return clamp(low, 0, pageCount - 1);
}

function getCssEscaped(value: string) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }

  return value.replace(/["\\#.;:[\],>+~*^$|=]/g, "\\$&");
}

function decodeFragment(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function scopeBookCss(cssText: string) {
  return cssText.replace(/(^|})\s*([^@}{][^{]+)\{/g, (_match, close, selectorText) => {
    const scopedSelectors = String(selectorText)
      .split(",")
      .map((selector) => selector.trim())
      .filter(Boolean)
      .map((selector) => `.internal-epub-content ${selector}`)
      .join(", ");

    return `${close} ${scopedSelectors} {`;
  });
}

function estimatePageBudget(metrics: PageMetrics, settings: ReaderSettings) {
  const fontSizePx = 16 * (settings.fontSize / 100);
  const lineHeightPx = fontSizePx * settings.lineHeight;
  const linesPerPage = Math.max(10, Math.floor((metrics.pageHeight - 72) / lineHeightPx));
  const charsPerLine = Math.max(24, Math.floor((metrics.pageWidth - 72) / (fontSizePx * 0.55)));

  return Math.max(650, Math.floor(linesPerPage * charsPerLine * 0.82));
}

function estimateNodeWeight(node: Node) {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent?.replace(/\s+/g, " ").trim().length || 0;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return 0;
  }

  const element = node as Element;
  const tagName = element.tagName.toLowerCase();
  const textWeight = element.textContent?.replace(/\s+/g, " ").trim().length || 0;

  if (["img", "svg", "video", "table", "pre", "blockquote"].includes(tagName)) {
    return Math.max(textWeight, tagName === "table" ? 900 : 520);
  }

  if (/^h[1-6]$/.test(tagName)) {
    return Math.max(textWeight * 1.8, 160);
  }

  return Math.max(textWeight, 24);
}

function serializeNode(node: Node) {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent || "";
  }

  if (node.nodeType === Node.ELEMENT_NODE) {
    return (node as Element).outerHTML;
  }

  return "";
}

function splitTextIntoParagraphPages(text: string, budget: number) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];

  const words = normalized.split(" ");
  const chunks: string[] = [];
  let current = "";

  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (next.length > budget && current.length > 0) {
      chunks.push(`<p>${current}</p>`);
      current = word;
      return;
    }

    current = next;
  });

  if (current) {
    chunks.push(`<p>${current}</p>`);
  }

  return chunks;
}

function paginateChapter(chapter: InternalEpubChapter, chapterIndex: number, budget: number) {
  const doc = new DOMParser().parseFromString(`<body>${chapter.html}</body>`, "text/html");
  const nodes = Array.from(doc.body.childNodes);
  const pages: Omit<VirtualPage, "index">[] = [];
  let currentHtml = "";
  let currentWeight = 0;

  const pushPage = () => {
    if (!currentHtml.trim()) return;

    pages.push({
      chapterIndex,
      chapterHref: chapter.href,
      html: currentHtml,
      textLength: currentWeight,
    });
    currentHtml = "";
    currentWeight = 0;
  };

  nodes.forEach((node) => {
    const weight = estimateNodeWeight(node);
    const html = serializeNode(node);
    if (!html.trim()) return;

    if (weight > budget * 1.45 && node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element;
      const tagName = element.tagName.toLowerCase();

      if (tagName === "p" || tagName === "div") {
        pushPage();
        splitTextIntoParagraphPages(element.textContent || "", budget).forEach((chunk) => {
          pages.push({
            chapterIndex,
            chapterHref: chapter.href,
            html: chunk,
            textLength: chunk.length,
          });
        });
        return;
      }
    }

    if (currentHtml && currentWeight + weight > budget) {
      pushPage();
    }

    currentHtml += html;
    currentWeight += weight;
  });

  pushPage();

  if (!pages.length && chapter.html.trim()) {
    pages.push({
      chapterIndex,
      chapterHref: chapter.href,
      html: chapter.html,
      textLength: chapter.text.length,
    });
  }

  return pages;
}

function paginateBook(book: InternalEpubBook | null, metrics: PageMetrics, settings: ReaderSettings) {
  if (!book) return [];

  const budget = estimatePageBudget(metrics, settings);
  const pages = book.chapters.flatMap((chapter, chapterIndex) =>
    paginateChapter(chapter, chapterIndex, budget),
  );

  return pages.map<VirtualPage>((page, index) => ({
    ...page,
    index,
  }));
}

export default function InternalViewerCore({
  epubData,
  fileHash,
  settings,
  vocabularyEntries,
  onWordClick,
  onWordRightClick,
  onTextSelection,
  onVocabularyIndex,
  onDismissOverlays,
  onViewerScroll,
  onScrollPositionChange,
  onProgressChange,
  onNavigationLoaded,
  onNavigateToChapter,
  currentSectionHref,
}: InternalViewerCoreProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const metricsRef = useRef<PageMetrics>(DEFAULT_METRICS);
  const currentPageIndexRef = useRef(0);
  const totalPagesRef = useRef(1);
  const settingsRef = useRef(settings);
  const vocabularyEntriesRef = useRef(vocabularyEntries);
  const isRestoringRef = useRef(false);
  const scrollFrameRef = useRef<number | null>(null);
  const measureFrameRef = useRef<number | null>(null);
  const pageOffsetsRef = useRef<number[]>([]);
  const pageHeightsRef = useRef<number[]>([]);
  const latestLocationRef = useRef<PersistedInternalLocation | null>(null);
  const activeSectionHrefRef = useRef<string | undefined>();
  const [book, setBook] = useState<InternalEpubBook | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [metrics, setMetrics] = useState<PageMetrics>(DEFAULT_METRICS);
  const [pageHeights, setPageHeights] = useState<Record<number, number>>({});
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 0 });
  const [pendingRestore, setPendingRestore] = useState<PersistedInternalLocation | null | undefined>(undefined);
  const callbacksRef = useRef({
    onWordClick,
    onWordRightClick,
    onTextSelection,
    onVocabularyIndex,
    onDismissOverlays,
    onViewerScroll,
    onScrollPositionChange,
    onProgressChange,
    onNavigationLoaded,
    onNavigateToChapter,
  });

  settingsRef.current = settings;
  vocabularyEntriesRef.current = vocabularyEntries;
  metricsRef.current = metrics;
  callbacksRef.current = {
    onWordClick,
    onWordRightClick,
    onTextSelection,
    onVocabularyIndex,
    onDismissOverlays,
    onViewerScroll,
    onScrollPositionChange,
    onProgressChange,
    onNavigationLoaded,
    onNavigateToChapter,
  };

  const { loadState, saveNow, scheduleSave } = useReadingStatePersistence(
    `${fileHash}${INTERNAL_STATE_SUFFIX}`,
    250,
  );

  const themeColors = THEME_COLORS[settings.theme];
  const highlightColors = HIGHLIGHT_COLORS[settings.theme];
  const scopedBookCss = useMemo(() => scopeBookCss(book?.cssText || ""), [book?.cssText]);
  const pages = useMemo(() => paginateBook(book, metrics, settings), [
    book,
    metrics,
    settings.fontSize,
    settings.fontFamily,
    settings.lineHeight,
    settings.contentWidth,
  ]);
  const totalPages = Math.max(1, pages.length);
  const pageLayout = useMemo(
    () => buildPageOffsets(totalPages, pageHeights, metrics),
    [metrics, pageHeights, totalPages],
  );
  const visiblePages = useMemo(
    () => pages.slice(visibleRange.start, visibleRange.end + 1),
    [pages, visibleRange.end, visibleRange.start],
  );

  totalPagesRef.current = totalPages;
  currentPageIndexRef.current = currentPageIndex;
  pageOffsetsRef.current = pageLayout.offsets;
  pageHeightsRef.current = pageLayout.heights;

  const updateProgress = useCallback((pageIndex: number, pageCount: number) => {
    callbacksRef.current.onProgressChange?.(
      getDisplayProgressForPage(pageIndex, pageCount),
      pageCount,
    );
  }, []);

  const updateVisibleRange = useCallback((scrollTop: number, pageCount = totalPagesRef.current) => {
    const currentMetrics = metricsRef.current;
    const offsets = pageOffsetsRef.current;
    const heights = pageHeightsRef.current;
    const firstVisible = findPageByScrollTop(scrollTop, offsets, heights, pageCount);
    const lastVisible = findPageByScrollTop(
      scrollTop + currentMetrics.viewportHeight,
      offsets,
      heights,
      pageCount,
    );
    const start = clamp(firstVisible - VIRTUALIZATION_OVERSCAN, 0, Math.max(0, pageCount - 1));
    const end = clamp(lastVisible + VIRTUALIZATION_OVERSCAN, 0, Math.max(0, pageCount - 1));

    setVisibleRange((current) =>
      current.start === start && current.end === end ? current : { start, end },
    );
  }, []);

  const getPageTop = useCallback((pageIndex: number) => {
    return pageOffsetsRef.current[pageIndex] ?? metricsRef.current.verticalPadding;
  }, []);

  const getActivePage = useCallback(() => {
    const container = containerRef.current;
    if (!container) return currentPageIndexRef.current;

    return clamp(
      findPageByScrollTop(
        container.scrollTop + metricsRef.current.viewportHeight * 0.28,
        pageOffsetsRef.current,
        pageHeightsRef.current,
        totalPagesRef.current,
      ),
      0,
      Math.max(0, totalPagesRef.current - 1),
    );
  }, []);

  const getActiveSectionHref = useCallback((pageIndex = getActivePage()) => {
    return pages[pageIndex]?.chapterHref || activeSectionHrefRef.current;
  }, [getActivePage, pages]);

  const persistLocation = useCallback(
    (mode: "now" | "schedule", pageOverride?: number) => {
      const container = containerRef.current;
      const pageCount = totalPagesRef.current;
      const pageIndex = clamp(
        Math.round(pageOverride ?? currentPageIndexRef.current),
        0,
        Math.max(0, pageCount - 1),
      );
      const activeHref = getActiveSectionHref(pageIndex);
      const scrollTop = container?.scrollTop ?? getPageTop(pageIndex);
      const nextLocation: PersistedInternalLocation = {
        engine: "internal",
        version: 2,
        pageIndex,
        totalPages: pageCount,
        percentage: getProgressForPage(pageIndex, pageCount),
        href: activeHref,
        scrollTop,
        updatedAt: Date.now(),
      };
      const readingState = {
        currentPage: pageIndex + 1,
        currentZoom: 1,
        currentScroll: scrollTop,
        annotations: JSON.stringify(nextLocation),
      };

      latestLocationRef.current = nextLocation;

      if (mode === "now") {
        void saveNow(readingState);
      } else {
        scheduleSave(readingState);
      }

      updateProgress(pageIndex, pageCount);
    },
    [getActiveSectionHref, getPageTop, saveNow, scheduleSave, updateProgress],
  );

  const scrollToPage = useCallback(
    (targetPage: number, behavior: ScrollBehavior = "smooth") => {
      const container = containerRef.current;
      const pageCount = totalPagesRef.current;
      if (!container) return;

      const nextPage = clamp(Math.round(targetPage), 0, Math.max(0, pageCount - 1));
      const top = getPageTop(nextPage);

      container.scrollTo({
        top,
        behavior,
      });

      currentPageIndexRef.current = nextPage;
      setCurrentPageIndex(nextPage);
      updateVisibleRange(top, pageCount);
      updateProgress(nextPage, pageCount);
    },
    [getPageTop, updateProgress, updateVisibleRange],
  );

  const measureViewport = useCallback((preserveProgress = true) => {
    if (measureFrameRef.current !== null) {
      window.cancelAnimationFrame(measureFrameRef.current);
    }

    measureFrameRef.current = window.requestAnimationFrame(() => {
      measureFrameRef.current = null;
      const container = containerRef.current;
      if (!container) return;

      const previousTotal = totalPagesRef.current;
      const previousPage = currentPageIndexRef.current;
      const previousProgress = preserveProgress
        ? getProgressForPage(previousPage, previousTotal)
        : 0;
      const nextMetrics = calculateMetrics(container, settingsRef.current);
      metricsRef.current = nextMetrics;

      setMetrics((current) => (sameMetrics(current, nextMetrics) ? current : nextMetrics));

      if (preserveProgress && !isRestoringRef.current) {
        const nextPage = clamp(
          Math.round(previousProgress * Math.max(0, totalPagesRef.current - 1)),
          0,
          Math.max(0, totalPagesRef.current - 1),
        );
        window.requestAnimationFrame(() => scrollToPage(nextPage, "auto"));
      } else {
        updateVisibleRange(container.scrollTop);
      }
    });
  }, [scrollToPage, updateVisibleRange]);

  const getAnchorFromRect = useCallback((rect: DOMRect) => {
    const root = rootRef.current;
    if (!root) return null;

    const rootRect = root.getBoundingClientRect();
    const anchorTop = rect.top - rootRect.top;
    const anchorBottom = rect.bottom - rootRect.top;
    const placement = anchorTop < 220 ? "bottom" : "top";

    return {
      left: rect.left - rootRect.left + rect.width / 2,
      top: placement === "top" ? anchorTop : anchorBottom,
      placement,
    } as const;
  }, []);

  const syncWordStates = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const showHighlights = settingsRef.current.showHighlights;
    const spans = container.querySelectorAll<HTMLElement>(".word[data-word]");

    spans.forEach((span) => {
      const wordKey = span.dataset.word || "";
      const entry = vocabularyEntriesRef.current[wordKey];
      const status = entry?.status || "new";

      span.classList.remove(...WORD_STATE_CLASSES);

      if (showHighlights) {
        span.classList.add(`word-${status}`);
      }

      if (showHighlights && entry?.saved) {
        span.classList.add("word-saved");
      }
    });
  }, []);

  const measureVisiblePageHeights = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const pageElements = Array.from(
      container.querySelectorAll<HTMLElement>(".internal-epub-page"),
    );

    if (!pageElements.length) return;

    setPageHeights((current) => {
      let changed = false;
      const next = { ...current };

      pageElements.forEach((pageElement) => {
        const pageIndex = Number(pageElement.dataset.pageIndex);
        if (!Number.isFinite(pageIndex)) return;

        const measuredHeight = Math.ceil(pageElement.getBoundingClientRect().height);
        const previousHeight = next[pageIndex];
        if (
          typeof previousHeight !== "number" ||
          Math.abs(previousHeight - measuredHeight) > PAGE_HEIGHT_TOLERANCE
        ) {
          next[pageIndex] = measuredHeight;
          changed = true;
        }
      });

      return changed ? next : current;
    });
  }, []);

  const wrapTextNodes = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const pageBodies = Array.from(container.querySelectorAll<HTMLElement>(".internal-epub-page-body"));

    pageBodies.forEach((pageBody) => {
      if (pageBody.dataset.lyceumWrapped === "true") return;

      const walker = document.createTreeWalker(pageBody, NodeFilter.SHOW_TEXT);
      const textNodes: Text[] = [];
      let currentNode: Text | null;

      while ((currentNode = walker.nextNode() as Text | null)) {
        if (!currentNode.textContent?.trim()) continue;
        const parent = currentNode.parentElement;
        if (!parent) continue;

        const tagName = parent.tagName.toUpperCase();
        if (["SCRIPT", "STYLE", "NOSCRIPT", "CODE", "PRE"].includes(tagName)) {
          continue;
        }

        if (parent.closest(".word")) {
          continue;
        }

        textNodes.push(currentNode);
      }

      textNodes.forEach((textNode) => {
        const parts = tokenizeText(textNode.textContent || "");
        if (!parts.some((part) => part.type === "word")) return;

        const fragment = document.createDocumentFragment();

        parts.forEach((part) => {
          if (part.type === "text") {
            fragment.appendChild(document.createTextNode(part.value));
            return;
          }

          const span = document.createElement("span");
          span.className = "word";
          span.textContent = part.value;
          span.dataset.word = part.normalizedWord || "";
          span.dataset.displayWord = part.value;
          fragment.appendChild(span);
        });

        textNode.parentNode?.replaceChild(fragment, textNode);
      });

      pageBody.dataset.lyceumWrapped = "true";
    });

    syncWordStates();
    window.requestAnimationFrame(measureVisiblePageHeights);
  }, [measureVisiblePageHeights, syncWordStates]);

  const findPageIndexForHref = useCallback((href: string) => {
    const path = normalizeEpubPath(href);
    const [, fragment] = href.split("#");
    const fragmentCandidates = fragment ? [fragment, decodeFragment(fragment)] : [];

    if (fragmentCandidates.length) {
      const matchingPage = pages.find((page) =>
        fragmentCandidates.some((candidate) => {
          const escaped = candidate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          return new RegExp(`(?:id|name)=["']${escaped}["']`).test(page.html);
        }),
      );

      if (matchingPage) return matchingPage.index;
    }

    const exactMatch = pages.find((page) => page.chapterHref === path);
    if (exactMatch) return exactMatch.index;

    const fuzzyMatch = pages.find((page) => {
      const pageHref = page.chapterHref || "";
      return pageHref.endsWith(path) || path.endsWith(pageHref);
    });

    return fuzzyMatch?.index ?? 0;
  }, [pages]);

  const navigateToHref = useCallback(
    (href: string, behavior: ScrollBehavior = "smooth") => {
      if (!href || pages.length === 0) return;

      const pageIndex = findPageIndexForHref(href);
      activeSectionHrefRef.current = pages[pageIndex]?.chapterHref;
      scrollToPage(pageIndex, behavior);
      persistLocation("schedule", pageIndex);
    },
    [findPageIndexForHref, pages, persistLocation, scrollToPage],
  );

  const handleWordClick = useCallback(
    (wordElement: HTMLElement) => {
      const normalizedWord = wordElement.dataset.word || "";
      const displayWord = wordElement.dataset.displayWord || wordElement.textContent || "";
      const anchor = getAnchorFromRect(wordElement.getBoundingClientRect());

      if (!normalizedWord || !anchor) return;

      callbacksRef.current.onWordClick({
        displayWord,
        normalizedWord,
        anchor,
        scrollTop: containerRef.current?.scrollTop || 0,
      });
    },
    [getAnchorFromRect],
  );

  const handleWordRightClick = useCallback(
    (wordElement: HTMLElement) => {
      const normalizedWord = wordElement.dataset.word || "";
      const displayWord = wordElement.dataset.displayWord || wordElement.textContent || "";
      const anchor = getAnchorFromRect(wordElement.getBoundingClientRect());

      if (!normalizedWord || !anchor) return;

      callbacksRef.current.onWordRightClick({
        displayWord,
        normalizedWord,
        anchor,
        scrollTop: containerRef.current?.scrollTop || 0,
      });
    },
    [getAnchorFromRect],
  );

  const handleSelection = useCallback(() => {
    const selection = window.getSelection();
    const container = containerRef.current;
    if (!selection || !container || selection.isCollapsed || !selection.toString().trim()) {
      return;
    }

    const range = selection.rangeCount ? selection.getRangeAt(0) : null;
    if (!range || !container.contains(range.commonAncestorContainer)) return;

    const rect = range.getBoundingClientRect();
    const anchor = getAnchorFromRect(rect);
    const selectedText = selection.toString().replace(/\s+/g, " ").trim();

    if (!anchor || selectedText.length < 2) return;

    callbacksRef.current.onTextSelection({
      selectedText,
      anchor,
      scrollTop: container.scrollTop,
    });
  }, [getAnchorFromRect]);

  const updateActiveSectionFromPage = useCallback((pageIndex: number) => {
    const activeHref = pages[pageIndex]?.chapterHref;
    if (!activeHref || activeHref === activeSectionHrefRef.current) {
      return;
    }

    activeSectionHrefRef.current = activeHref;
    callbacksRef.current.onNavigateToChapter?.(activeHref);
  }, [pages]);

  useEffect(() => {
    let cancelled = false;
    let parsedBook: InternalEpubBook | null = null;

    setBook(null);
    setLoadError(null);
    setIsLoading(true);
    setPendingRestore(undefined);
    currentPageIndexRef.current = 0;
    setCurrentPageIndex(0);
    setPageHeights({});
    setVisibleRange({ start: 0, end: 0 });

    parseInternalEpub(epubData)
      .then((nextBook) => {
        if (cancelled) {
          releaseInternalEpubResources(nextBook);
          return;
        }

        parsedBook = nextBook;
        setBook(nextBook);
        setLoadError(nextBook.chapters.length ? null : "Este EPUB nao possui capitulos de texto legiveis.");
        callbacksRef.current.onNavigationLoaded?.(nextBook.toc);
        callbacksRef.current.onVocabularyIndex(
          extractUniqueWords(nextBook.chapters.map((chapter) => chapter.text).join("\n")).size,
        );
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(error instanceof Error ? error.message : "Nao foi possivel abrir este EPUB.");
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
      releaseInternalEpubResources(parsedBook);
      if (scrollFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollFrameRef.current);
      }
      if (measureFrameRef.current !== null) {
        window.cancelAnimationFrame(measureFrameRef.current);
      }
    };
  }, [epubData, fileHash]);

  useEffect(() => {
    if (!book) return;

    let isActive = true;
    setPendingRestore(undefined);
    isRestoringRef.current = true;

    loadState()
      .then((savedState) => {
        if (!isActive) return;
        const persisted = parsePersistedLocation(savedState.annotations);
        const fallback =
          savedState.currentPage > 1 || savedState.currentScroll > 0
            ? {
                engine: "internal" as const,
                version: 2 as const,
                pageIndex: Math.max(0, savedState.currentPage - 1),
                totalPages: 1,
                percentage: 0,
                scrollTop: savedState.currentScroll,
                updatedAt: 0,
              }
            : null;

        latestLocationRef.current = persisted || fallback;
        setPendingRestore(persisted || fallback);
      })
      .catch(() => {
        if (isActive) setPendingRestore(null);
      });

    return () => {
      isActive = false;
    };
  }, [book, loadState]);

  useLayoutEffect(() => {
    wrapTextNodes();
  }, [visiblePages, wrapTextNodes]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const pageElements = Array.from(
      container.querySelectorAll<HTMLElement>(".internal-epub-page"),
    );

    if (!pageElements.length) return;

    const resizeObserver = new ResizeObserver(() => {
      measureVisiblePageHeights();
      updateVisibleRange(container.scrollTop);
    });

    pageElements.forEach((pageElement) => resizeObserver.observe(pageElement));
    window.requestAnimationFrame(() => {
      measureVisiblePageHeights();
      updateVisibleRange(container.scrollTop);
    });

    return () => resizeObserver.disconnect();
  }, [measureVisiblePageHeights, updateVisibleRange, visiblePages]);

  useEffect(() => {
    syncWordStates();
  }, [settings.showHighlights, vocabularyEntries, visiblePages, syncWordStates]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateMetrics = () => {
      measureViewport(true);
    };
    const resizeObserver = new ResizeObserver(updateMetrics);

    resizeObserver.observe(container);
    updateMetrics();

    return () => {
      resizeObserver.disconnect();
    };
  }, [measureViewport]);

  useEffect(() => {
    measureViewport(true);
  }, [
    settings.fontSize,
    settings.fontFamily,
    settings.lineHeight,
    settings.contentWidth,
    settings.theme,
    measureViewport,
  ]);

  useEffect(() => {
    const pageCount = totalPagesRef.current;
    setVisibleRange((current) => ({
      start: clamp(current.start, 0, Math.max(0, pageCount - 1)),
      end: clamp(Math.max(current.end, current.start), 0, Math.max(0, pageCount - 1)),
    }));
    updateProgress(clamp(currentPageIndexRef.current, 0, Math.max(0, pageCount - 1)), pageCount);
  }, [pageLayout.totalHeight, totalPages, updateProgress]);

  useEffect(() => {
    if (pendingRestore === undefined || pages.length === 0) return;

    const restoreLocation = pendingRestore;
    const pageCount = totalPagesRef.current;
    const targetPage = restoreLocation
      ? clamp(
          restoreLocation.totalPages > 1
            ? Math.round(restoreLocation.percentage * Math.max(0, pageCount - 1))
            : restoreLocation.pageIndex,
          0,
          Math.max(0, pageCount - 1),
        )
      : 0;

    isRestoringRef.current = true;
    scrollToPage(targetPage, "auto");
    activeSectionHrefRef.current = restoreLocation?.href || pages[targetPage]?.chapterHref;

    window.requestAnimationFrame(() => {
      isRestoringRef.current = false;
      updateActiveSectionFromPage(targetPage);
      persistLocation("schedule", targetPage);
    });
  }, [pages, pendingRestore, persistLocation, scrollToPage, updateActiveSectionFromPage]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (scrollFrameRef.current !== null) {
        return;
      }

      scrollFrameRef.current = window.requestAnimationFrame(() => {
        scrollFrameRef.current = null;
        const pageIndex = getActivePage();
        const scrollTop = container.scrollTop;

        currentPageIndexRef.current = pageIndex;
        setCurrentPageIndex(pageIndex);
        updateVisibleRange(scrollTop);
        callbacksRef.current.onViewerScroll(scrollTop);
        callbacksRef.current.onScrollPositionChange?.(scrollTop);
        updateActiveSectionFromPage(pageIndex);

        if (!isRestoringRef.current) {
          persistLocation("schedule", pageIndex);
        }
      });
    };

    container.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, [getActivePage, persistLocation, updateActiveSectionFromPage, updateVisibleRange]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) {
        return;
      }

      if (event.key === "ArrowDown" || event.key === "PageDown" || event.key === " ") {
        event.preventDefault();
        scrollToPage(currentPageIndexRef.current + 1);
      } else if (event.key === "ArrowUp" || event.key === "PageUp") {
        event.preventDefault();
        scrollToPage(currentPageIndexRef.current - 1);
      } else if (event.key === "Home") {
        event.preventDefault();
        scrollToPage(0);
      } else if (event.key === "End") {
        event.preventDefault();
        scrollToPage(totalPagesRef.current - 1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [scrollToPage]);

  useEffect(() => {
    const href = currentSectionHref;
    if (!href || pages.length === 0) return;

    const normalizedHref = normalizeEpubPath(href);
    if (normalizedHref && normalizedHref === activeSectionHrefRef.current) {
      return;
    }

    navigateToHref(href);
  }, [currentSectionHref, navigateToHref, pages.length]);

  useEffect(() => {
    const flushPersistence = () => {
      persistLocation("now");
    };

    const interval = window.setInterval(flushPersistence, 5000);
    window.addEventListener("beforeunload", flushPersistence);
    window.addEventListener("pagehide", flushPersistence);
    document.addEventListener("visibilitychange", flushPersistence);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("beforeunload", flushPersistence);
      window.removeEventListener("pagehide", flushPersistence);
      document.removeEventListener("visibilitychange", flushPersistence);
      flushPersistence();
    };
  }, [persistLocation]);

  const handlePageClick = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      const target = event.target as HTMLElement | null;
      const wordElement = target?.closest(".word") as HTMLElement | null;

      if (wordElement && containerRef.current?.contains(wordElement)) {
        event.preventDefault();
        event.stopPropagation();
        window.getSelection()?.removeAllRanges();
        handleWordClick(wordElement);
        return;
      }

      const anchor = target?.closest("a") as HTMLAnchorElement | null;
      const epubHref = anchor?.dataset.epubHref;
      if (epubHref) {
        event.preventDefault();
        event.stopPropagation();
        navigateToHref(epubHref);
        return;
      }

      callbacksRef.current.onDismissOverlays();
    },
    [handleWordClick, navigateToHref],
  );

  const handlePageContextMenu = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      const target = event.target as HTMLElement | null;
      const wordElement = target?.closest(".word") as HTMLElement | null;

      if (!wordElement || !containerRef.current?.contains(wordElement)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      handleWordRightClick(wordElement);
    },
    [handleWordRightClick],
  );

  const stripHeight = pageLayout.totalHeight;

  return (
    <div
      ref={rootRef}
      className="internal-epub-viewer relative h-full w-full overflow-hidden"
      style={{
        backgroundColor: themeColors.background,
        color: themeColors.text,
      }}
    >
      <style>{`
        .internal-epub-pages {
          scrollbar-width: thin;
          scrollbar-color: var(--ui-zinc-700) transparent;
          overscroll-behavior: contain;
          overflow-anchor: none;
        }

        .internal-epub-pages::-webkit-scrollbar {
          width: 8px;
        }

        .internal-epub-pages::-webkit-scrollbar-track {
          background: transparent;
        }

        .internal-epub-pages::-webkit-scrollbar-thumb {
          background-color: var(--ui-zinc-700);
          border-radius: 4px;
        }

        .internal-epub-page {
          contain: paint style;
        }

        .internal-epub-content {
          font-family: ${getFontStack(settings.fontFamily)};
          font-size: ${settings.fontSize}%;
          line-height: ${settings.lineHeight};
          text-align: ${settings.textAlign};
          color: ${themeColors.text};
        }

        .internal-epub-content * {
          max-width: 100%;
        }

        .internal-epub-content p {
          margin: 0 0 1em;
        }

        .internal-epub-content a {
          color: ${themeColors.accent};
        }

        .internal-epub-content img,
        .internal-epub-content svg,
        .internal-epub-content video {
          display: block;
          height: auto;
          margin: 1rem auto;
          max-height: ${Math.max(220, metrics.pageHeight - 96)}px;
          object-fit: contain;
        }

        .internal-epub-content table {
          border-collapse: collapse;
          display: block;
          max-width: 100%;
          overflow-x: auto;
        }

        .internal-epub-content .word {
          border-radius: 4px;
          cursor: pointer;
          transition: background-color 120ms ease, box-shadow 120ms ease;
        }

        .internal-epub-content .word:hover {
          background: rgba(59, 130, 246, 0.08);
        }

        ${settings.showHighlights ? `
        .internal-epub-content .word.word-learning {
          background: ${highlightColors.learningBg};
        }

        .internal-epub-content .word.word-known {
          background: ${highlightColors.knownBg};
        }

        .internal-epub-content .word.word-saved {
          text-decoration: underline dotted ${highlightColors.saved};
          text-underline-offset: 0.22em;
        }
        ` : ""}

        ${scopedBookCss}
      `}</style>

      <div
        ref={containerRef}
        className="internal-epub-pages h-full w-full overflow-y-auto overflow-x-hidden"
        tabIndex={0}
      >
        <div
          className="relative"
          style={{
            height: `${stripHeight}px`,
            minHeight: "100%",
          }}
        >
          {visiblePages.map((page) => (
            <article
              key={page.index}
              className="internal-epub-page internal-epub-content absolute rounded-sm border shadow-2xl"
              data-page-index={page.index}
              data-section-href={page.chapterHref}
              onClick={handlePageClick}
              onContextMenu={handlePageContextMenu}
              onPointerDown={(event) => {
                const target = event.target as HTMLElement | null;
                if (!target?.closest(".word")) {
                  callbacksRef.current.onDismissOverlays();
                }
              }}
              onMouseUp={() => window.requestAnimationFrame(handleSelection)}
              onKeyUp={() => window.requestAnimationFrame(handleSelection)}
              onLoadCapture={() => window.requestAnimationFrame(measureVisiblePageHeights)}
              style={{
                left: `${metrics.sidePadding}px`,
                top: `${getPageTop(page.index)}px`,
                width: `${metrics.pageWidth}px`,
                minHeight: `${metrics.pageHeight}px`,
                backgroundColor: themeColors.background,
                borderColor: settings.showPages ? themeColors.border : "transparent",
                boxShadow:
                  settings.theme === "light"
                    ? "0 18px 48px rgba(15, 23, 42, 0.12)"
                    : "0 18px 48px rgba(0, 0, 0, 0.28)",
              }}
            >
              <div
                className="internal-epub-page-body px-9 py-8"
                dangerouslySetInnerHTML={{ __html: page.html }}
              />
              {settings.showPages && (
                <span className="pointer-events-none absolute bottom-3 right-4 text-xs tabular-nums opacity-50">
                  {page.index + 1}
                </span>
              )}
            </article>
          ))}
        </div>
      </div>

      {(isLoading || loadError) && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-zinc-950/80 px-6 text-center">
          <div className="space-y-3 text-sm text-zinc-400">
            {isLoading ? (
              <>
                <LoaderCircle className="mx-auto animate-spin text-zinc-300" size={28} />
                <p>Preparando engine interna...</p>
              </>
            ) : (
              <p>{loadError}</p>
            )}
          </div>
        </div>
      )}

      {!isLoading && !loadError && (
        <>
          <button
            type="button"
            className="absolute right-4 top-4 z-10 rounded-sm border border-zinc-700 bg-zinc-950/80 p-2 text-zinc-300 opacity-75 transition hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-25"
            onClick={() => scrollToPage(currentPageIndex - 1)}
            disabled={currentPageIndex <= 0}
            title="Pagina anterior"
          >
            <ChevronUp size={20} />
          </button>

          <button
            type="button"
            className="absolute bottom-4 right-4 z-10 rounded-sm border border-zinc-700 bg-zinc-950/80 p-2 text-zinc-300 opacity-75 transition hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-25"
            onClick={() => scrollToPage(currentPageIndex + 1)}
            disabled={currentPageIndex >= totalPages - 1}
            title="Proxima pagina"
          >
            <ChevronDown size={20} />
          </button>

          <div className="pointer-events-none absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-sm border border-zinc-800 bg-zinc-950/80 px-3 py-1 text-xs tabular-nums text-zinc-300">
            {currentPageIndex + 1}/{totalPages}
          </div>
        </>
      )}
    </div>
  );
}
