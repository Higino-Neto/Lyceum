import ePub, { Book, Contents, Rendition } from "epubjs";
import { useEffect, useRef } from "react";
import {
  TextSelectionPayload,
  VocabularyEntry,
  WordInteractionPayload,
  extractUniqueWords,
  tokenizeText,
} from "./languageLearning";
import { ReaderSettings, THEME_COLORS, getFontStack } from "./theme";

interface ViewerCoreProps {
  epubData: ArrayBuffer;
  fileHash: string;
  settings: ReaderSettings;
  vocabularyEntries: Record<string, VocabularyEntry>;
  onWordClick: (payload: WordInteractionPayload) => void;
  onTextSelection: (payload: TextSelectionPayload) => void;
  onVocabularyIndex: (count: number) => void;
  onDismissOverlays: () => void;
  onViewerScroll: (scrollTop: number) => void;
}

interface LyceumDocument extends Document {
  lyceumWrapped?: boolean;
  lyceumListenersAttached?: boolean;
}

type EpubRequest = (path: string) => Promise<object>;

const WORD_STATE_CLASSES = ["word-new", "word-learning", "word-known", "word-saved"];

export default function ViewerCore({
  epubData,
  fileHash,
  settings,
  vocabularyEntries,
  onWordClick,
  onTextSelection,
  onVocabularyIndex,
  onDismissOverlays,
  onViewerScroll,
}: ViewerCoreProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<Book | null>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const isInitializedRef = useRef(false);
  const settingsRef = useRef(settings);
  const vocabularyEntriesRef = useRef(vocabularyEntries);
  const callbacksRef = useRef({
    onWordClick,
    onTextSelection,
    onVocabularyIndex,
    onDismissOverlays,
    onViewerScroll,
  });
  const renderedSectionWordsRef = useRef(new Map<string, Set<string>>());

  settingsRef.current = settings;
  vocabularyEntriesRef.current = vocabularyEntries;
  callbacksRef.current = {
    onWordClick,
    onTextSelection,
    onVocabularyIndex,
    onDismissOverlays,
    onViewerScroll,
  };

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

    wordStyle.textContent = `
      .word {
        cursor: pointer !important;
        border-radius: 4px;
        transition: background-color 120ms ease, box-shadow 120ms ease;
      }

      .word:hover {
        background: rgba(59, 130, 246, 0.14) !important;
      }

      .word.word-learning {
        background: rgba(245, 158, 11, 0.16) !important;
        box-shadow: inset 0 -0.45em 0 rgba(245, 158, 11, 0.18);
      }

      .word.word-known {
        background: rgba(34, 197, 94, 0.14) !important;
        box-shadow: inset 0 -0.45em 0 rgba(34, 197, 94, 0.18);
      }

      .word.word-saved {
        text-decoration: underline dotted rgba(250, 204, 21, 0.75);
        text-underline-offset: 0.22em;
      }
    `;
  };

  const syncWordStates = (doc: Document) => {
    const spans = doc.querySelectorAll<HTMLElement>(".word[data-word]");
    spans.forEach((span) => {
      const wordKey = span.dataset.word || "";
      const entry = vocabularyEntriesRef.current[wordKey];
      const status = entry?.status || "new";

      span.classList.remove(...WORD_STATE_CLASSES);
      span.classList.add(`word-${status}`);

      if (entry?.saved) {
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
    renderedSectionWordsRef.current = new Map();

    const initialize = async () => {
      try {
        renditionRef.current?.destroy();
        bookRef.current?.destroy();

        const book = ePub(epubData);
        bookRef.current = book;
        await book.ready;

        if (!isMounted || !containerRef.current) {
          book.destroy();
          return;
        }

        const rendition = book.renderTo(containerRef.current, {
          flow: "scrolled",
          manager: "continuous",
          width: "100%",
          height: "100%",
        });

        renditionRef.current = rendition;
        isInitializedRef.current = true;

        registerThemes(rendition);

        rendition.on("rendered", (section: { href?: string }, contents: Contents) => {
          const iframe = contents?.window?.frameElement as HTMLIFrameElement | null;
          if (iframe && section?.href) {
            iframe.dataset.sectionKey = section.href;
          }

          if (contents?.document) {
            processDocument(contents.document, section?.href || "rendered-section");
          }
        });

        await rendition.display();
        processAllIframes();
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
    };
  }, [epubData, fileHash]);

  useEffect(() => {
    if (!renditionRef.current) return;

    registerThemes(renditionRef.current);
    processAllIframes();
  }, [settings]);

  useEffect(() => {
    processAllIframes();
  }, [vocabularyEntries]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      callbacksRef.current.onViewerScroll(container.scrollTop);
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, []);
  /* eslint-enable react-hooks/exhaustive-deps */

  return (
    <div className="w-full h-full overflow-hidden">
      <style>{`
        .epub-container {
          height: 100%;
          overflow-y: auto;
          background-color: #18181b;
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
