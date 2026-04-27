import ePub, { Book, Contents, Rendition } from "epubjs";
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

export interface NavItem {
  id: string;
  label: string;
  href: string;
  subitems?: NavItem[];
}

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
  percentage?: number;
  scrollTop?: number;
  sectionScrollTop?: number;
  sectionProgress?: number;
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
  const { loadState, saveNow, scheduleSave } = useReadingStatePersistence(fileHash);

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
      if (!parsed || typeof parsed !== "object") {
        return null;
      }

      return {
        cfi: typeof parsed.cfi === "string" ? parsed.cfi : undefined,
        href: typeof parsed.href === "string" ? parsed.href : undefined,
        sectionIndex:
          typeof parsed.sectionIndex === "number" && Number.isFinite(parsed.sectionIndex)
            ? parsed.sectionIndex
            : undefined,
        percentage:
          typeof parsed.percentage === "number" && Number.isFinite(parsed.percentage)
            ? parsed.percentage
            : undefined,
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
      };
    } catch {
      return null;
    }
  }, []);

  const captureCurrentLocationSnapshot = useCallback((): Partial<PersistedEpubLocation> | null => {
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
    
    const scrollHeight = container.scrollHeight - container.clientHeight;
    const percentage = scrollHeight > 0 ? container.scrollTop / scrollHeight : 0;

    return {
      href: activeFrame.dataset.sectionKey || undefined,
      sectionScrollTop,
      sectionProgress: Math.max(0, Math.min(1, sectionScrollTop / Math.max(frameHeight, 1))),
      percentage,
      scrollTop: container.scrollTop,
    };
  }, []);

const persistReadingLocation = useCallback(
    (mode: "now" | "schedule", locationOverride?: Partial<PersistedEpubLocation>) => {
      const liveSnapshot = captureCurrentLocationSnapshot();
      const nextLocation: PersistedEpubLocation = {
        ...latestLocationRef.current,
        ...liveSnapshot,
        ...locationOverride,
      };

      if (locationOverride?.cfi) {
        nextLocation.cfi = locationOverride.cfi;
      } else if (currentCfiRef.current) {
        nextLocation.cfi = currentCfiRef.current;
      } else if (latestLocationRef.current?.cfi) {
        nextLocation.cfi = latestLocationRef.current.cfi;
      }

      latestLocationRef.current = nextLocation;

      const currentPage = Math.max(1, (nextLocation.sectionIndex ?? 0) + 1);
      const readingState = {
        currentPage,
        currentZoom: 1,
        currentScroll: nextLocation.scrollTop ?? 0,
        annotations: JSON.stringify(nextLocation),
      };

      if (mode === "now") {
        saveNow(readingState);
        return;
      }

      scheduleSave(readingState);
    },
    [saveNow, scheduleSave],
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
    const paddingValue = Math.round((100 - settingsRef.current.contentWidth) / 2);

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
        padding: 0 ${paddingValue}% !important;
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

const LINES_PER_PAGE = 30;
  const BASE_FONT_SIZE_PX = 16;

  const injectPageBreaks = (doc: Document) => {
    if (!settingsRef.current.showPages) return;

    const content = doc.body;
    if (!content) return;

    const existingBreaks = content.querySelectorAll(".lyceum-page-break");
    existingBreaks.forEach((el) => el.remove());

    const themeColors = THEME_COLORS[settingsRef.current.theme];
    const borderColor = themeColors.border || "rgba(128, 128, 128, 0.3)";

    requestAnimationFrame(() => {
      const fontSizePx = (settingsRef.current.fontSize / 100) * BASE_FONT_SIZE_PX;
      const lineHeight = settingsRef.current.lineHeight;
      const pageHeight = fontSizePx * lineHeight * LINES_PER_PAGE;

      const totalHeight = content.scrollHeight;
      const estimatedPages = Math.max(1, Math.floor(totalHeight / pageHeight));
      
      if (estimatedPages <= 1) return;

      const allElements = content.querySelectorAll("p, div, h1, h2, h3, h4, h5, h6, li, blockquote");
      if (allElements.length === 0) return;

      const elementsArray = Array.from(allElements);
      const breaksNeeded = estimatedPages - 1;
      const interval = Math.floor(elementsArray.length / breaksNeeded);

      for (let i = 1; i < breaksNeeded; i++) {
        const index = i * interval;
        const el = elementsArray[index] as HTMLElement;
        if (!el) continue;

        const breakEl = doc.createElement("div");
        breakEl.className = "lyceum-page-break";
        breakEl.style.cssText = `
          height: 2px;
          margin: 24px 0;
          border: none;
          border-top: 2px dashed ${borderColor};
        `;
        el.parentNode?.insertBefore(breakEl, el);
      }
    });
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
    injectPageBreaks(typedDoc);
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
    const paddingValue = Math.round((100 - settingsRef.current.contentWidth) / 2);

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

  const ensureScrollableContent = () => {
    if (ensureScrollablePromiseRef.current) {
      return ensureScrollablePromiseRef.current;
    }

    const task = (async () => {
      const container = containerRef.current;
      const rendition = renditionRef.current;
      if (!container || !rendition) {
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

        book.locations.generate(100).then(() => {
          if (!isMounted || !renditionRef.current) return;
          const total = book.locations.length();
          if (total > 0 && callbacksRef.current.onProgressChange) {
            const current = renditionRef.current.currentLocation();
            if (current && typeof current.location === "number") {
              const percentage = book.locations.percentageFromLocation(current.location);
              callbacksRef.current.onProgressChange(
                Math.round(percentage * 100),
                total
              );
            }
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
        latestLocationRef.current = savedLocation;
        currentScrollTopRef.current =
          savedLocation?.scrollTop ?? savedState.currentScroll ?? 0;
        currentCfiRef.current = savedLocation?.cfi ?? null;

        const savedCfi = savedLocation?.cfi;
        const savedHref = savedLocation?.href;

        const rendition = book.renderTo(containerRef.current, {
          flow: "scrolled",
          manager: "continuous",
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

          persistReadingLocation("now", {
            cfi: start.cfi,
            href: start.href,
            sectionIndex: start.index,
            percentage: start.percentage,
            scrollTop: containerRef.current?.scrollTop ?? currentScrollTopRef.current,
          });

          if (callbacksRef.current.onProgressChange) {
            const totalLocations = book.locations?.length() ?? 0;
            if (totalLocations > 0) {
              const currentLoc = rendition.currentLocation();
              const locationNum = currentLoc?.location ?? start?.location;
              if (typeof locationNum === "number") {
                const percentage = book.locations.percentageFromLocation(locationNum);
                callbacksRef.current.onProgressChange(
                  Math.round(percentage * 100),
                  totalLocations
                );
              }
            }
          }
        };

        rendition.on("rendered", (section: { href?: string }, contents: Contents) => {
          const iframe = contents?.window?.frameElement as HTMLIFrameElement | null;
          if (iframe && section?.href) {
            iframe.dataset.sectionKey = section.href;
          }

          if (contents?.document) {
            processDocument(contents.document, section?.href || "rendered-section");
          }

          void ensureScrollableContent();
        });
        rendition.on("relocated", handleRelocated);

        isRestoringScrollRef.current = true;

        if (savedCfi) {
          rendition.display(savedCfi).then(() => {
            isRestoringScrollRef.current = false;
          }).catch(() => {
            if (savedHref) {
              rendition.display(savedHref).then(() => {
                isRestoringScrollRef.current = false;
              }).catch(() => {
                isRestoringScrollRef.current = false;
              });
            } else {
              isRestoringScrollRef.current = false;
            }
          });
        } else if (savedHref) {
          rendition.display(savedHref).then(() => {
            isRestoringScrollRef.current = false;
          }).catch(() => {
            isRestoringScrollRef.current = false;
          });
        } else {
          rendition.display().then(() => {
            isRestoringScrollRef.current = false;
          });
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
      ensureScrollablePromiseRef.current = null;
      clearRestoreTimeouts();
    };
  }, [clearRestoreTimeouts, epubData, fileHash, stabilizeRestoredScroll]);

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
    void ensureScrollableContent();
  }, [settings]);

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
    if (!container) return;

    const handleScroll = () => {
      currentScrollTopRef.current = container.scrollTop;
      if (isRestoringScrollRef.current) return;
      callbacksRef.current.onViewerScroll(container.scrollTop);
      callbacksRef.current.onScrollPositionChange?.(container.scrollTop);
    };

    container.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, []);

  useEffect(() => {
    const flushPersistence = () => {
      const current = latestLocationRef.current;
      if (!current) return;
      persistReadingLocation("now", {});
    };

    const interval = window.setInterval(flushPersistence, 5000);
    window.addEventListener("beforeunload", flushPersistence);
    document.addEventListener("visibilitychange", flushPersistence);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("beforeunload", flushPersistence);
      document.removeEventListener("visibilitychange", flushPersistence);
      flushPersistence();
    };
  }, [persistReadingLocation]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const handleWheel = () => {
      if (container.scrollHeight <= container.clientHeight + 2) {
        void ensureScrollableContent();
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      if (container.scrollHeight <= container.clientHeight + 2) {
        void ensureScrollableContent();
      }
    });

    container.addEventListener("wheel", handleWheel, { passive: true });
    resizeObserver.observe(container);
    void ensureScrollableContent();

    return () => {
      container.removeEventListener("wheel", handleWheel);
      resizeObserver.disconnect();
    };
  }, []);
  /* eslint-enable react-hooks/exhaustive-deps */

  return (
    <div className="w-full h-full overflow-hidden">
      <style>{`
        .epub-container {
          height: 100%;
          overflow-y: auto;
          overflow-x: hidden;
          background-color: #18181b;
          overscroll-behavior: contain;
          overflow-anchor: none !important;
          scrollbar-width: thin;
          scrollbar-color: #3f3f46 transparent;
        }
        
        .epub-container::-webkit-scrollbar {
          width: 6px;
        }
        
        .epub-container::-webkit-scrollbar-track {
          background: transparent;
        }
        
        .epub-container::-webkit-scrollbar-thumb {
          background-color: #3f3f46;
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
      <div ref={containerRef} className="epub-container" />
    </div>
  );
}
