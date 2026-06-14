import ePub, { Book, Contents, Rendition } from "epubjs";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import {
  TextSelectionPayload,
  VocabularyEntry,
  WordInteractionPayload,
  extractUniqueWords,
  tokenizeText,
} from "./languageLearning";
import { ReaderSettings, THEME_COLORS, HIGHLIGHT_COLORS, getFontStack } from "./theme";
import useReadingStatePersistence from "../../hooks/useReadingStatePersistence";
import type { NavItem } from "./types";

interface ViewerCoreProps {
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

interface LyceumDocument extends Document {
  lyceumWrapped?: boolean;
  lyceumListenersAttached?: boolean;
}

type EpubRequest = (path: string) => Promise<object>;

const WORD_STATE_CLASSES = ["word-new", "word-learning", "word-known", "word-saved"];

interface ContinuousManagerLike {
  fill?: () => Promise<unknown>;
  check?: () => Promise<unknown>;
}

interface EpubRelocatedLocation {
  start?: {
    cfi?: string;
    href?: string;
    index?: number;
    location?: number;
    percentage?: number;
    totalItems?: number;
    displayed?: {
      page: number;
      total: number;
    };
  };
}

interface PersistedEpubLocation {
  cfi?: string;
  href?: string;
  sectionIndex?: number;
  location?: number;
  totalLocations?: number;
  totalSections?: number;
  percentage?: number;
  layoutProgress?: number;
  scrollTop?: number;
  sectionScrollTop?: number;
  sectionProgress?: number;
  updatedAt?: number;
}

function clampProgress(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  return Math.max(0, Math.min(1, value));
}

function normalizeEpubHref(value: string | undefined) {
  if (!value) {
    return "";
  }

  return value
    .split("#")[0]
    .replace(/^\/+/, "")
    .replace(/^\.\//, "");
}

export default function ViewerCore({
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
}: ViewerCoreProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<Book | null>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const isInitializedRef = useRef(false);
  const ensureScrollablePromiseRef = useRef<Promise<void> | null>(null);
  const latestLocationRef = useRef<PersistedEpubLocation | null>(null);
  const currentScrollTopRef = useRef(0);
  const currentCfiRef = useRef<string | null>(null);
  const spineHrefIndexRef = useRef(new Map<string, number>());
  const totalSpineItemsRef = useRef(0);
  const settingsRef = useRef(settings);
  const vocabularyEntriesRef = useRef(vocabularyEntries);
  const isRestoringScrollRef = useRef(false);
  const restoreTimeoutsRef = useRef<number[]>([]);
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
  const renderedSectionWordsRef = useRef(new Map<string, Set<string>>());

  settingsRef.current = settings;
  vocabularyEntriesRef.current = vocabularyEntries;
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
  const { loadState, saveNow, scheduleSave } = useReadingStatePersistence(fileHash, 250);

  const clearRestoreTimeouts = useCallback(() => {
    restoreTimeoutsRef.current.forEach((timeoutId) => {
      window.clearTimeout(timeoutId);
    });
    restoreTimeoutsRef.current = [];
  }, []);

  const stabilizeRestoredScroll = useCallback(
    (targetScrollTop: number) => {
      const checkpoints = [0, 120, 280, 520, 900, 1400];
      clearRestoreTimeouts();

      const applyCheckpoint = (index: number) => {
        const container = containerRef.current;
        if (!container) {
          isRestoringScrollRef.current = false;
          clearRestoreTimeouts();
          return;
        }

        container.scrollTop = targetScrollTop;
        currentScrollTopRef.current = container.scrollTop;

        if (index >= checkpoints.length - 1) {
          window.requestAnimationFrame(() => {
            isRestoringScrollRef.current = false;
          });
          return;
        }

        const delay = checkpoints[index + 1] - checkpoints[index];
        const timeoutId = window.setTimeout(() => {
          applyCheckpoint(index + 1);
        }, delay);
        restoreTimeoutsRef.current.push(timeoutId);
      };

      applyCheckpoint(0);
    },
    [clearRestoreTimeouts],
  );

  const parsePersistedEpubLocation = useCallback((raw: string | null | undefined) => {
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as PersistedEpubLocation | null;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return null;
      }

      const normalized = {
        cfi: typeof parsed.cfi === "string" ? parsed.cfi : undefined,
        href: typeof parsed.href === "string" ? parsed.href : undefined,
        sectionIndex:
          typeof parsed.sectionIndex === "number" && Number.isFinite(parsed.sectionIndex)
            ? parsed.sectionIndex
            : undefined,
        location:
          typeof parsed.location === "number" && Number.isFinite(parsed.location)
            ? parsed.location
            : undefined,
        totalLocations:
          typeof parsed.totalLocations === "number" && Number.isFinite(parsed.totalLocations)
            ? parsed.totalLocations
            : undefined,
        totalSections:
          typeof parsed.totalSections === "number" && Number.isFinite(parsed.totalSections)
            ? parsed.totalSections
            : undefined,
        percentage:
          clampProgress(parsed.percentage),
        layoutProgress:
          clampProgress(parsed.layoutProgress),
        scrollTop:
          typeof parsed.scrollTop === "number" && Number.isFinite(parsed.scrollTop)
            ? parsed.scrollTop
            : undefined,
        sectionScrollTop:
          typeof parsed.sectionScrollTop === "number" && Number.isFinite(parsed.sectionScrollTop)
            ? parsed.sectionScrollTop
            : undefined,
        sectionProgress:
          typeof parsed.sectionProgress === "number" && Number.isFinite(parsed.sectionProgress)
            ? parsed.sectionProgress
            : undefined,
        updatedAt:
          typeof parsed.updatedAt === "number" && Number.isFinite(parsed.updatedAt)
            ? parsed.updatedAt
            : undefined,
      };

      return Object.values(normalized).some((value) => value !== undefined)
        ? normalized
        : null;
    } catch {
      return null;
    }
  }, []);

  const getSectionIndexFromHref = useCallback((href: string | undefined) => {
    const normalizedHref = normalizeEpubHref(href);
    if (!normalizedHref) {
      return undefined;
    }

    const directMatch = spineHrefIndexRef.current.get(normalizedHref);
    if (directMatch !== undefined) {
      return directMatch;
    }

    for (const [spineHref, index] of spineHrefIndexRef.current) {
      if (
        spineHref.endsWith(normalizedHref) ||
        normalizedHref.endsWith(spineHref)
      ) {
        return index;
      }
    }

    return undefined;
  }, []);

  const getStableSectionProgress = useCallback(
    (sectionIndex: number | undefined, sectionProgress = 0) => {
      const totalSections = totalSpineItemsRef.current;
      if (
        typeof sectionIndex !== "number" ||
        !Number.isFinite(sectionIndex) ||
        sectionIndex < 0 ||
        totalSections <= 0
      ) {
        return undefined;
      }

      return clampProgress((sectionIndex + clampProgress(sectionProgress)!) / totalSections);
    },
    [],
  );

  const getCurrentRenditionLocationSnapshot = useCallback((): Partial<PersistedEpubLocation> | null => {
    const book = bookRef.current;
    const rendition = renditionRef.current;
    if (!rendition) {
      return null;
    }

    const current = rendition.currentLocation() as {
      location?: number;
      href?: string;
      cfi?: string;
      percentage?: number;
      index?: number;
      start?: {
        cfi?: string;
        href?: string;
        index?: number;
        location?: number;
        percentage?: number;
      };
    } | null;
    const start = current?.start ?? current ?? undefined;
    if (!start) {
      return null;
    }

    const totalLocations = book?.locations?.length?.() ?? 0;
    const location = start.location ?? current?.location;
    const sectionIndex =
      typeof start.index === "number" && Number.isFinite(start.index)
        ? start.index
        : getSectionIndexFromHref(start.href ?? current?.href);
    const stablePercentage = getStableSectionProgress(sectionIndex);
    const percentage =
      stablePercentage ??
      (book && typeof location === "number" && totalLocations > 0
        ? clampProgress(book.locations.percentageFromLocation(location))
        : clampProgress(start.percentage ?? current?.percentage));

    return {
      cfi: start.cfi ?? current?.cfi,
      href: start.href ?? current?.href,
      sectionIndex,
      location:
        typeof location === "number" && Number.isFinite(location)
          ? location
          : undefined,
      totalLocations: totalLocations > 0 ? totalLocations : undefined,
      totalSections: totalSpineItemsRef.current || undefined,
      percentage,
    };
  }, [getSectionIndexFromHref, getStableSectionProgress]);

  const captureCurrentLocationSnapshot = useCallback((): Partial<PersistedEpubLocation> | null => {
    if (settingsRef.current.epubReadingMode === "paginated") {
      return null;
    }

    const container = containerRef.current;
    if (!container) {
      return null;
    }

    const iframes = Array.from(container.querySelectorAll("iframe")) as HTMLIFrameElement[];
    if (!iframes.length) {
      return {
        scrollTop: container.scrollTop,
      };
    }

    const anchorTop = container.scrollTop + Math.min(container.clientHeight * 0.35, 240);
    let activeFrame: HTMLIFrameElement | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const iframe of iframes) {
      const frameTop = iframe.offsetTop;
      const frameHeight = iframe.offsetHeight || iframe.clientHeight || 0;
      const frameBottom = frameTop + frameHeight;

      if (anchorTop >= frameTop && anchorTop <= frameBottom) {
        activeFrame = iframe;
        break;
      }

      const distance = Math.abs(frameTop - anchorTop);
      if (distance < bestDistance) {
        bestDistance = distance;
        activeFrame = iframe;
      }
    }

    if (!activeFrame) {
      return {
        scrollTop: container.scrollTop,
      };
    }

    const frameTop = activeFrame.offsetTop;
    const frameHeight = activeFrame.offsetHeight || activeFrame.clientHeight || 1;
    const sectionScrollTop = Math.max(0, anchorTop - frameTop);
    const sectionProgress = Math.max(0, Math.min(1, sectionScrollTop / Math.max(frameHeight, 1)));
    const scrollHeight = container.scrollHeight - container.clientHeight;
    const layoutProgress = scrollHeight > 0 ? container.scrollTop / scrollHeight : 0;
    const datasetSectionIndex = Number(activeFrame.dataset.sectionIndex);
    const sectionIndex =
      Number.isFinite(datasetSectionIndex)
        ? datasetSectionIndex
        : getSectionIndexFromHref(activeFrame.dataset.sectionKey);
    const percentage =
      getStableSectionProgress(sectionIndex, sectionProgress) ??
      clampProgress(layoutProgress);

    return {
      href: activeFrame.dataset.sectionKey || undefined,
      sectionIndex: Number.isFinite(sectionIndex) ? sectionIndex : undefined,
      totalSections: totalSpineItemsRef.current || undefined,
      sectionScrollTop,
      sectionProgress,
      percentage,
      layoutProgress,
      scrollTop: container.scrollTop,
    };
  }, [getSectionIndexFromHref, getStableSectionProgress]);

  const getCurrentEpubPercentage = useCallback(() => {
    const book = bookRef.current;
    const rendition = renditionRef.current;
    if (!book || !rendition) {
      return undefined;
    }

    const current = rendition.currentLocation() as {
      location?: number;
      start?: {
        location?: number;
        percentage?: number;
      };
    } | null;
    const location = current?.location ?? current?.start?.location;
    const totalLocations = book.locations?.length?.() ?? 0;

    if (typeof location === "number" && totalLocations > 0) {
      return clampProgress(book.locations.percentageFromLocation(location));
    }

    const startPercentage = current?.start?.percentage;
    return clampProgress(startPercentage);
  }, []);

const persistReadingLocation = useCallback(
    (mode: "now" | "schedule", locationOverride?: Partial<PersistedEpubLocation>) => {
      const renditionSnapshot = getCurrentRenditionLocationSnapshot();
      const liveSnapshot = captureCurrentLocationSnapshot();
      if (
        !renditionSnapshot &&
        !liveSnapshot &&
        !latestLocationRef.current &&
        (!locationOverride || Object.keys(locationOverride).length === 0)
      ) {
        return;
      }

      const epubPercentage = clampProgress(
        locationOverride?.percentage ??
        renditionSnapshot?.percentage ??
        liveSnapshot?.percentage ??
        getCurrentEpubPercentage() ??
        latestLocationRef.current?.percentage,
      );
      const nextLocation: PersistedEpubLocation = {
        ...latestLocationRef.current,
        ...renditionSnapshot,
        ...liveSnapshot,
        ...locationOverride,
      };

      if (epubPercentage !== undefined) {
        nextLocation.percentage = epubPercentage;
      }

      if (locationOverride?.cfi) {
        nextLocation.cfi = locationOverride.cfi;
      } else if (currentCfiRef.current) {
        nextLocation.cfi = currentCfiRef.current;
      } else if (latestLocationRef.current?.cfi) {
        nextLocation.cfi = latestLocationRef.current.cfi;
      }

      latestLocationRef.current = nextLocation;

      nextLocation.totalSections =
        nextLocation.totalSections ?? (totalSpineItemsRef.current || undefined);
      nextLocation.updatedAt = Date.now();

      const currentPage = Math.max(
        1,
        Math.round(
          typeof nextLocation.sectionIndex === "number"
            ? nextLocation.sectionIndex + 1
            : typeof nextLocation.location === "number"
              ? nextLocation.location + 1
              : 1,
        ),
      );
      const readingState = {
        currentPage,
        currentZoom: 1,
        currentScroll: nextLocation.scrollTop ?? 0,
        annotations: JSON.stringify(nextLocation),
      };

      if (mode === "now") {
        saveNow(readingState);
        if (nextLocation.percentage !== undefined) {
          callbacksRef.current.onProgressChange?.(
            Math.round(nextLocation.percentage * 100),
            nextLocation.totalSections,
          );
        }
        return;
      }

      scheduleSave(readingState);
      if (nextLocation.percentage !== undefined) {
        callbacksRef.current.onProgressChange?.(
          Math.round(nextLocation.percentage * 100),
          nextLocation.totalSections,
        );
      }
    },
    [captureCurrentLocationSnapshot, getCurrentEpubPercentage, getCurrentRenditionLocationSnapshot, saveNow, scheduleSave],
  );

  const getAnchorFromRect = (doc: Document, rect: DOMRect) => {
    const container = containerRef.current;
    const frameElement = doc.defaultView?.frameElement as HTMLElement | null;
    if (!container || !frameElement) {
      return null;
    }

    const containerRect = container.getBoundingClientRect();
    const frameRect = frameElement.getBoundingClientRect();
    const anchorLeft =
      frameRect.left - containerRect.left + rect.left + rect.width / 2;
    const anchorTop = frameRect.top - containerRect.top + rect.top;
    const anchorBottom = frameRect.top - containerRect.top + rect.bottom;
    const placement = anchorTop < 220 ? "bottom" : "top";

    return {
      left: anchorLeft,
      top: placement === "top" ? anchorTop : anchorBottom,
      placement,
    } as const;
  };

  const injectStyles = (doc: Document) => {
    if (!doc.head || !doc.body) return;

    const themeColors = THEME_COLORS[settingsRef.current.theme];
    const highlightColors = HIGHLIGHT_COLORS[settingsRef.current.theme];
    const fontFamily = getFontStack(settingsRef.current.fontFamily);
    const isPaginated = settingsRef.current.epubReadingMode === "paginated";

    let themeStyle = doc.getElementById(
      "lyceum-theme-styles",
    ) as HTMLStyleElement | null;

    if (!themeStyle) {
      themeStyle = doc.createElement("style");
      themeStyle.id = "lyceum-theme-styles";
      doc.head.appendChild(themeStyle);
    }

    themeStyle.textContent = `
      :root {
        color-scheme: ${settingsRef.current.theme === "dark" ? "dark" : "light"};
      }

      html, body {
        margin: 0 !important;
        background: ${themeColors.background} !important;
        color: ${themeColors.text} !important;
      }

      body {
        padding: 0 ${isPaginated ? 0 : Math.round((100 - settingsRef.current.contentWidth) / 2)}% !important;
        font-family: ${fontFamily} !important;
        font-size: ${settingsRef.current.fontSize}% !important;
        line-height: ${settingsRef.current.lineHeight} !important;
        text-align: ${settingsRef.current.textAlign} !important;
        transition: background-color 120ms ease, color 120ms ease;
      }

      p {
        margin: 0 0 1em 0 !important;
      }

      body, p, div, span, li, blockquote, h1, h2, h3, h4, h5, h6 {
        color: ${themeColors.text} !important;
      }

      body, p, div, span, li, blockquote, h1, h2, h3, h4, h5, h6, a, td, th {
        font-family: ${fontFamily} !important;
      }

      a {
        color: ${themeColors.accent} !important;
      }

      img, svg, video, audio, picture {
        background: transparent !important;
      }
    `;

    let wordStyle = doc.getElementById(
      "lyceum-word-styles",
    ) as HTMLStyleElement | null;

    if (!wordStyle) {
      wordStyle = doc.createElement("style");
      wordStyle.id = "lyceum-word-styles";
      doc.head.appendChild(wordStyle);
    }

    const showHighlights = settingsRef.current.showHighlights;

    wordStyle.textContent = `
      .word {
        cursor: pointer !important;
        border-radius: 4px;
        transition: background-color 120ms ease, box-shadow 120ms ease;
      }

      .word:hover {
        background: rgba(59, 130, 246, 0.08) !important;
      }

      ${showHighlights ? `
      .word.word-learning {
        background: ${highlightColors.learningBg} !important;
      }

      .word.word-known {
        background: ${highlightColors.knownBg} !important;
      }

      .word.word-saved {
        text-decoration: underline dotted ${highlightColors.saved};
        text-underline-offset: 0.22em;
      }
      ` : ""}
    `;
  };

  const syncWordStates = (doc: Document) => {
    const showHighlights = settingsRef.current.showHighlights;
    const spans = doc.querySelectorAll<HTMLElement>(".word[data-word]");
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
  };

  const updateVisibleWordCounts = (sectionKey: string, text: string) => {
    const sectionWords = extractUniqueWords(text);
    renderedSectionWordsRef.current.set(sectionKey, sectionWords);

    const allWords = new Set<string>();
    renderedSectionWordsRef.current.forEach((words) => {
      words.forEach((word) => allWords.add(word));
    });

    callbacksRef.current.onVocabularyIndex(allWords.size);
  };

  const wrapTextNodes = (doc: LyceumDocument, sectionKey: string) => {
    if (!doc.body) return;

    if (doc.lyceumWrapped) {
      syncWordStates(doc);
      return;
    }

    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
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
      if (!parts.some((part) => part.type === "word")) {
        return;
      }

      const fragment = doc.createDocumentFragment();

      parts.forEach((part) => {
        if (part.type === "text") {
          fragment.appendChild(doc.createTextNode(part.value));
          return;
        }

        const span = doc.createElement("span");
        span.className = "word";
        span.textContent = part.value;
        span.dataset.word = part.normalizedWord || "";
        span.dataset.displayWord = part.value;
        fragment.appendChild(span);
      });

      textNode.parentNode?.replaceChild(fragment, textNode);
    });

    doc.lyceumWrapped = true;
    doc.body.dataset.lyceumSectionKey = sectionKey;

    updateVisibleWordCounts(sectionKey, doc.body.textContent || "");
    syncWordStates(doc);
  };

  const handleDocumentClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement | null;
    const wordElement = target?.closest(".word") as HTMLElement | null;
    const doc = target?.ownerDocument;
    if (!wordElement || !doc) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    doc.getSelection()?.removeAllRanges();

    const normalizedWord = wordElement.dataset.word || "";
    const displayWord = wordElement.dataset.displayWord || wordElement.textContent || "";
    const anchor = getAnchorFromRect(doc, wordElement.getBoundingClientRect());
    if (!normalizedWord || !anchor) {
      return;
    }

    callbacksRef.current.onWordClick({
      displayWord,
      normalizedWord,
      anchor,
      scrollTop: containerRef.current?.scrollTop || 0,
    });
  };

  const handleDocumentContextMenu = (event: MouseEvent) => {
    const target = event.target as HTMLElement | null;
    const wordElement = target?.closest(".word") as HTMLElement | null;
    const doc = target?.ownerDocument;
    if (!wordElement || !doc) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const normalizedWord = wordElement.dataset.word || "";
    const displayWord = wordElement.dataset.displayWord || wordElement.textContent || "";
    const anchor = getAnchorFromRect(doc, wordElement.getBoundingClientRect());
    if (!normalizedWord || !anchor) {
      return;
    }

    callbacksRef.current.onWordRightClick({
      displayWord,
      normalizedWord,
      anchor,
      scrollTop: containerRef.current?.scrollTop || 0,
    });
  };

  const handleSelectionFromDocument = (doc: Document) => {
    const selection = doc.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      return;
    }

    const range = selection.rangeCount ? selection.getRangeAt(0) : null;
    if (!range) return;

    const rect = range.getBoundingClientRect();
    const anchor = getAnchorFromRect(doc, rect);
    const selectedText = selection.toString().replace(/\s+/g, " ").trim();

    if (!anchor || selectedText.length < 2) {
      return;
    }

    callbacksRef.current.onTextSelection({
      selectedText,
      anchor,
      scrollTop: containerRef.current?.scrollTop || 0,
    });
  };

  const attachDocumentListeners = (doc: LyceumDocument) => {
    if (doc.lyceumListenersAttached) {
      return;
    }

    doc.addEventListener("click", handleDocumentClick);
    doc.addEventListener("contextmenu", handleDocumentContextMenu);
    doc.addEventListener("pointerdown", (event) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest(".word")) {
        callbacksRef.current.onDismissOverlays();
      }
    });
    doc.addEventListener("mouseup", () => {
      window.requestAnimationFrame(() => handleSelectionFromDocument(doc));
    });
    doc.addEventListener("keyup", () => {
      window.requestAnimationFrame(() => handleSelectionFromDocument(doc));
    });

    doc.lyceumListenersAttached = true;
  };

  const processDocument = (doc: Document, sectionKey = "visible-section") => {
    const typedDoc = doc as LyceumDocument;
    if (!typedDoc.body) return;

    injectStyles(typedDoc);
    attachDocumentListeners(typedDoc);
    wrapTextNodes(typedDoc, sectionKey);
    syncWordStates(typedDoc);
  };

  const processAllIframes = () => {
    if (!containerRef.current) return;

    const iframes = containerRef.current.querySelectorAll("iframe");
    iframes.forEach((iframe, index) => {
      try {
        const htmlIframe = iframe as HTMLIFrameElement;
        const doc = htmlIframe.contentDocument || htmlIframe.contentWindow?.document;
        if (!doc?.body) return;

        const existingSectionKey =
          doc.body.dataset.lyceumSectionKey || htmlIframe.dataset.sectionKey;
        processDocument(doc, existingSectionKey || `iframe-${index}`);
      } catch {
        // ignore inaccessible frames
      }
    });
  };

  const registerThemes = (rendition: Rendition) => {
    const themeColors = THEME_COLORS[settingsRef.current.theme];
    const fontFamily = getFontStack(settingsRef.current.fontFamily);
    const isPaginated = settingsRef.current.epubReadingMode === "paginated";
    const paddingValue = isPaginated ? 0 : Math.round((100 - settingsRef.current.contentWidth) / 2);

    rendition.themes.register({
      lyceum: {
        body: {
          "background-color": themeColors.background,
          color: themeColors.text,
          "font-family": fontFamily,
          "font-size": `${settingsRef.current.fontSize}%`,
          "line-height": settingsRef.current.lineHeight,
          "text-align": settingsRef.current.textAlign,
          margin: "0",
          padding: `0 ${paddingValue}%`,
        },
      },
    });

    rendition.themes.select("lyceum");
  };

  const resizeRenditionToContainer = useCallback(() => {
    const container = containerRef.current;
    const rendition = renditionRef.current;
    if (!container || !rendition) return;

    const cfi = currentCfiRef.current ?? undefined;
    (rendition as Rendition & {
      resize: (width?: number, height?: number, epubcfi?: string) => void;
    }).resize(container.clientWidth, container.clientHeight, cfi);
  }, []);

  const ensureScrollableContent = () => {
    if (ensureScrollablePromiseRef.current) {
      return ensureScrollablePromiseRef.current;
    }

    const task = (async () => {
      const container = containerRef.current;
      const rendition = renditionRef.current;
      if (!container || !rendition || settingsRef.current.epubReadingMode === "paginated") {
        return;
      }

      const manager = (rendition as Rendition & {
        manager?: ContinuousManagerLike;
      }).manager;
      if (!manager?.fill) {
        return;
      }

      let attempts = 0;
      while (
        container.scrollHeight <= container.clientHeight + 2 &&
        attempts < 6
      ) {
        attempts += 1;
        await manager.fill();
        await new Promise<void>((resolve) => {
          window.requestAnimationFrame(() => resolve());
        });
      }
    })().finally(() => {
      ensureScrollablePromiseRef.current = null;
    });

    ensureScrollablePromiseRef.current = task;
    return task;
  };

  const restorePersistedScroll = useCallback(
    async (location: PersistedEpubLocation | null) => {
      if (settingsRef.current.epubReadingMode === "paginated") {
        isRestoringScrollRef.current = false;
        return;
      }

      if (!location) {
        isRestoringScrollRef.current = false;
        return;
      }

      await ensureScrollableContent();
      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => resolve());
      });

      const container = containerRef.current;
      if (!container) {
        isRestoringScrollRef.current = false;
        return;
      }

      const anchorOffset = Math.min(container.clientHeight * 0.35, 240);
      let targetScrollTop = location.scrollTop ?? 0;

      if (location.href) {
        const iframes = Array.from(
          container.querySelectorAll("iframe"),
        ) as HTMLIFrameElement[];
        const sectionFrame = iframes.find((iframe) => {
          const sectionKey = iframe.dataset.sectionKey;
          return (
            sectionKey === location.href ||
            sectionKey?.endsWith(location.href || "") ||
            location.href?.endsWith(sectionKey || "")
          );
        });

        if (sectionFrame) {
          const frameHeight = sectionFrame.offsetHeight || sectionFrame.clientHeight || 1;

          if (typeof location.sectionScrollTop === "number") {
            targetScrollTop = sectionFrame.offsetTop + location.sectionScrollTop - anchorOffset;
          } else if (typeof location.sectionProgress === "number") {
            targetScrollTop =
              sectionFrame.offsetTop +
              frameHeight * Math.max(0, Math.min(1, location.sectionProgress)) -
              anchorOffset;
          }
        }
      }

      const maxScrollTop = Math.max(0, container.scrollHeight - container.clientHeight);
      const clampedScrollTop = Math.max(0, Math.min(targetScrollTop, maxScrollTop));

      if (clampedScrollTop <= 0) {
        window.requestAnimationFrame(() => {
          isRestoringScrollRef.current = false;
        });
        return;
      }

      stabilizeRestoredScroll(clampedScrollTop);
    },
    [stabilizeRestoredScroll],
  );

  const indexBookVocabulary = async (book: Book) => {
    try {
      const allWords = new Set<string>();
      await book.loaded.spine;
      const sections = (book.spine as unknown as {
        spineItems?: Array<{
          href?: string;
          load: (request?: EpubRequest) => Promise<Element>;
          unload?: () => void;
          document?: Document;
        }>;
      }).spineItems || [];

      for (const section of sections) {
        if (!section.load) {
          continue;
        }

        const contents = await section.load(book.load.bind(book));
        const textSource =
          section.document?.body?.textContent ||
          (contents as Element | undefined)?.textContent ||
          "";
        const words = extractUniqueWords(textSource);
        words.forEach((word) => allWords.add(word));
        section.unload?.();
      }

      callbacksRef.current.onVocabularyIndex(allWords.size);
    } catch (error) {
      console.error("Failed to index EPUB vocabulary:", error);
    }
  };

  // The helpers above intentionally read from refs so the viewer can reuse
  // listeners across re-renders without re-binding every iframe document.
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!containerRef.current || !epubData || isInitializedRef.current) return;

    let isMounted = true;
    clearRestoreTimeouts();
    renderedSectionWordsRef.current = new Map();
    latestLocationRef.current = null;
    currentScrollTopRef.current = 0;

    const initialize = async () => {
      try {
        renditionRef.current?.destroy();
        bookRef.current?.destroy();

        const book = ePub(epubData);
        bookRef.current = book;
        await book.ready;

        const spineItems = (book.spine as unknown as {
          spineItems?: Array<{ href?: string; index?: number }>;
        } | undefined)?.spineItems ?? [];
        totalSpineItemsRef.current = spineItems.length;
        spineHrefIndexRef.current = new Map();
        spineItems.forEach((item, index) => {
          const normalizedHref = normalizeEpubHref(item.href);
          if (normalizedHref) {
            spineHrefIndexRef.current.set(normalizedHref, index);
          }
        });

        const tocObj = await book.loaded.navigation;
        const tocArray = tocObj?.toc;
        if (!tocArray || !Array.isArray(tocArray)) {
          console.warn("No TOC found in EPUB");
        } else {
          const convertNavItem = (item: { id: string; label: string; href: string; subitems?: unknown[] }): NavItem => ({
            id: item.id,
            label: item.label,
            href: item.href,
            subitems: item.subitems?.map((sub: unknown) => convertNavItem(sub as { id: string; label: string; href: string })),
          });
          const tocItems: NavItem[] = tocArray.map(convertNavItem);
          callbacksRef.current.onNavigationLoaded?.(tocItems);
        }

        if (!isMounted || !containerRef.current) {
          book.destroy();
          return;
        }

        const savedState = await loadState();
        const savedLocation = parsePersistedEpubLocation(savedState.annotations);
        const fallbackLocation: PersistedEpubLocation | null =
          savedState.currentScroll > 0
            ? { scrollTop: savedState.currentScroll }
            : null;
        const locationToRestore: PersistedEpubLocation | null =
          savedLocation ||
          fallbackLocation;
        latestLocationRef.current = locationToRestore;
        currentScrollTopRef.current =
          locationToRestore?.scrollTop ?? savedState.currentScroll ?? 0;
        currentCfiRef.current = locationToRestore?.cfi ?? null;

        if (locationToRestore?.percentage !== undefined) {
          callbacksRef.current.onProgressChange?.(
            Math.round(locationToRestore.percentage * 100),
            locationToRestore.totalSections,
          );
        }

        const savedCfi = locationToRestore?.cfi;
        const savedHref = locationToRestore?.href;
        const isPaginated = settingsRef.current.epubReadingMode === "paginated";

        const rendition = book.renderTo(containerRef.current, {
          flow: isPaginated ? "paginated" : "scrolled",
          manager: isPaginated ? "default" : "continuous",
          spread: "none",
          width: "100%",
          height: "100%",
        });

        renditionRef.current = rendition;
        isInitializedRef.current = true;

        registerThemes(rendition);

        rendition.hooks.content.register((contents: Contents) => {
          const doc = contents.document;
          if (doc) {
            doc.documentElement.style.overflowAnchor = "none";
            doc.body.style.overflowAnchor = "none";
          }
        });

        const handleRelocated = (location: EpubRelocatedLocation) => {
          const start = location?.start;
          if (!start) {
            return;
          }

          if (start.cfi) {
            currentCfiRef.current = start.cfi;
          }

          if (isRestoringScrollRef.current) {
            return;
          }

          const sectionIndex =
            typeof start.index === "number" && Number.isFinite(start.index)
              ? start.index
              : getSectionIndexFromHref(start.href);
          const sectionProgress =
            start.displayed && start.displayed.total > 0
              ? (start.displayed.page - 1) / start.displayed.total
              : 0;

          persistReadingLocation("now", {
            cfi: start.cfi,
            href: start.href,
            sectionIndex,
            location: start.location,
            totalSections: totalSpineItemsRef.current || undefined,
            percentage: getStableSectionProgress(sectionIndex, sectionProgress) ?? start.percentage,
            scrollTop: containerRef.current?.scrollTop ?? currentScrollTopRef.current,
          });
        };

        rendition.on("rendered", (section: { href?: string }, contents: Contents) => {
          const iframe = contents?.window?.frameElement as HTMLIFrameElement | null;
          if (iframe && section?.href) {
            iframe.dataset.sectionKey = section.href;

            const sectionIndex =
              typeof (section as { index?: unknown }).index === "number" &&
              Number.isFinite((section as { index?: number }).index)
                ? (section as { index: number }).index
                : getSectionIndexFromHref(section.href);
            if (typeof sectionIndex === "number" && Number.isFinite(sectionIndex)) {
              iframe.dataset.sectionIndex = String(sectionIndex);
            }
          }

          if (contents?.document) {
            processDocument(contents.document, section?.href || "rendered-section");
          }

          if (settingsRef.current.epubReadingMode !== "paginated") {
            void ensureScrollableContent();
          }
        });
        rendition.on("relocated", handleRelocated);

        isRestoringScrollRef.current = true;

        const finishRestore = () => {
          void restorePersistedScroll(locationToRestore).catch(() => {
            isRestoringScrollRef.current = false;
          });
        };

        const displayDefault = () => {
          rendition.display().then(finishRestore).catch(() => {
            isRestoringScrollRef.current = false;
          });
        };

        if (savedCfi) {
          rendition.display(savedCfi).then(finishRestore).catch(() => {
            if (savedHref) {
              rendition.display(savedHref).then(finishRestore).catch(() => {
                displayDefault();
              });
            } else {
              displayDefault();
            }
          });
        } else if (savedHref) {
          rendition.display(savedHref).then(finishRestore).catch(() => {
            displayDefault();
          });
        } else {
          displayDefault();
        }

        void ensureScrollableContent();

        void indexBookVocabulary(book);
      } catch (error) {
        console.error("EPUB load error:", error);
      }
    };

    void initialize();

    return () => {
      isMounted = false;
      isInitializedRef.current = false;
      renditionRef.current?.destroy();
      renditionRef.current = null;
      bookRef.current?.destroy();
      bookRef.current = null;
      spineHrefIndexRef.current = new Map();
      totalSpineItemsRef.current = 0;
      ensureScrollablePromiseRef.current = null;
      clearRestoreTimeouts();
    };
  }, [clearRestoreTimeouts, epubData, fileHash, restorePersistedScroll, stabilizeRestoredScroll]);

  useEffect(() => {
    const rendition = renditionRef.current;
    const href = currentSectionHref;
    if (!rendition || !href) return;

    rendition.display(href).catch(console.error);
  }, [currentSectionHref]);

  useEffect(() => {
    if (!renditionRef.current) return;

    registerThemes(renditionRef.current);
    processAllIframes();
    if (settings.epubReadingMode === "paginated") {
      window.requestAnimationFrame(resizeRenditionToContainer);
    } else {
      void ensureScrollableContent();
    }
  }, [resizeRenditionToContainer, settings]);

  useEffect(() => {
    if (!containerRef.current) return;
    const iframes = containerRef.current.querySelectorAll("iframe");
    iframes.forEach((iframe) => {
      try {
        const doc = (iframe as HTMLIFrameElement).contentDocument;
        if (doc?.body) {
          syncWordStates(doc);
        }
      } catch { /* cross-origin iframe */ }
    });
  }, [vocabularyEntries]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || settingsRef.current.epubReadingMode === "paginated") return;

    const saveScrollPosition = () => {
      currentScrollTopRef.current = container.scrollTop;
      if (isRestoringScrollRef.current) return;
      callbacksRef.current.onViewerScroll(container.scrollTop);
      callbacksRef.current.onScrollPositionChange?.(container.scrollTop);
      persistReadingLocation("schedule", {
        scrollTop: container.scrollTop,
      });
    };

    const handleScroll = () => {
      saveScrollPosition();
    };

    container.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, [persistReadingLocation]);

  useEffect(() => {
    const flushPersistence = () => {
      persistReadingLocation("now", {});
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
  }, [persistReadingLocation]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || settingsRef.current.epubReadingMode === "paginated") {
      return;
    }

    const saveAfterInteraction = () => {
      window.setTimeout(() => {
        if (!containerRef.current || isRestoringScrollRef.current) {
          return;
        }

        currentScrollTopRef.current = containerRef.current.scrollTop;
        persistReadingLocation("schedule", {
          scrollTop: containerRef.current.scrollTop,
        });
      }, 120);
    };

    const handleWheel = () => {
      if (container.scrollHeight <= container.clientHeight + 2) {
        void ensureScrollableContent();
      }
      saveAfterInteraction();
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const keysThatCanMoveReadingPosition = new Set([
        "ArrowDown",
        "ArrowUp",
        "PageDown",
        "PageUp",
        "Home",
        "End",
        " ",
      ]);

      if (keysThatCanMoveReadingPosition.has(event.key)) {
        saveAfterInteraction();
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      if (container.scrollHeight <= container.clientHeight + 2) {
        void ensureScrollableContent();
      }
    });

    container.addEventListener("wheel", handleWheel, { passive: true });
    container.addEventListener("touchend", saveAfterInteraction, { passive: true });
    window.addEventListener("keyup", handleKeyUp);
    resizeObserver.observe(container);
    void ensureScrollableContent();

    return () => {
      container.removeEventListener("wheel", handleWheel);
      container.removeEventListener("touchend", saveAfterInteraction);
      window.removeEventListener("keyup", handleKeyUp);
      resizeObserver.disconnect();
    };
  }, [persistReadingLocation]);
  /* eslint-enable react-hooks/exhaustive-deps */

  const isPaginated = settings.epubReadingMode === "paginated";

  const goToPreviousPage = () => {
    renditionRef.current?.prev().catch(console.error);
  };

  const goToNextPage = () => {
    renditionRef.current?.next().catch(console.error);
  };

  return (
    <div className="relative h-full w-full overflow-hidden">
      <style>{`
        .epub-container {
          height: 100%;
          overflow-y: ${isPaginated ? "hidden" : "auto"};
          overflow-x: hidden;
          background-color: var(--ui-zinc-900);
          overscroll-behavior: contain;
          overflow-anchor: none !important;
          scrollbar-width: thin;
          scrollbar-color: var(--ui-zinc-700) transparent;
        }
        
        .epub-container::-webkit-scrollbar {
          width: 6px;
        }
        
        .epub-container::-webkit-scrollbar-track {
          background: transparent;
        }
        
        .epub-container::-webkit-scrollbar-thumb {
          background-color: var(--ui-zinc-700);
          border-radius: 3px;
        }

        .epub-container > div {
          background-color: transparent !important;
        }

        .epub-container iframe {
          background-color: transparent !important;
          display: block !important;
          width: 100% !important;
          border: none !important;
        }
      `}</style>
      <div
        ref={containerRef}
        className="epub-container"
        style={{
          margin: "0 auto",
          width: isPaginated ? `${settings.contentWidth}%` : "100%",
        }}
      />

      {isPaginated && (
        <>
          <button
            type="button"
            className="absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-sm border border-zinc-700 bg-zinc-950/80 p-2 text-zinc-300 opacity-75 transition hover:opacity-100"
            onClick={goToPreviousPage}
            title="Pagina anterior"
          >
            <ChevronLeft size={22} />
          </button>

          <button
            type="button"
            className="absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-sm border border-zinc-700 bg-zinc-950/80 p-2 text-zinc-300 opacity-75 transition hover:opacity-100"
            onClick={goToNextPage}
            title="Proxima pagina"
          >
            <ChevronRight size={22} />
          </button>
        </>
      )}
    </div>
  );
}
