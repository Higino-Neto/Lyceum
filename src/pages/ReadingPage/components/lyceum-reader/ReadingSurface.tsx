import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { KnowledgeState, LinguisticDocument } from "../../../../core/language-learning";
import type { OccurrenceIndex } from "../../../../core/language-learning";
import type { LearningReaderSettings } from "../../../../features/language-learning/settings";
import { applyStateClasses, buildChapterSegments, estimateSegmentHeight, renderBlocksHtml, type ChapterSegment } from "./renderChapter";

export interface ScrollTarget {
  ordinal?: number;
  blockId?: string;
  sentenceId?: string;
  nonce: number;
  flash?: boolean;
}

export interface SurfaceDecorations {
  selectedOrdinal: number | null;
  relatedLexeme: number | null;
  expressionOrdinals: number[];
  selectedSentenceId: string | null;
  speakingSentenceId: string | null;
  speakingOrdinal: number | null;
  /** ordinal -> grammar role class suffix */
  grammarRoles: Map<number, string>;
  /** stable ids (token/sentence/block) that carry annotations */
  annotatedIds: Set<string>;
}

interface ReadingSurfaceProps {
  document: LinguisticDocument;
  index: OccurrenceIndex;
  chapterIndex: number;
  formStates: KnowledgeState[];
  settings: LearningReaderSettings;
  decorations: SurfaceDecorations;
  scrollTarget: ScrollTarget | null;
  initialBlockId: string | null;
  onWordClick(ordinal: number, modifiers: { alt: boolean; ctrl: boolean }): void;
  onWordContextMenu(ordinal: number, x: number, y: number): void;
  onSentenceClick(sentenceId: string): void;
  onRangeSelect(startOrdinal: number, endOrdinal: number, x: number, y: number): void;
  onBackgroundClick(): void;
  onPosition(blockId: string | null, chapterProgress: number): void;
  /**
   * Touch screens: a double tap on a word acts like Ctrl+click (marks it
   * Known), so a single tap waits a moment before inspecting; long-press
   * selection (native handles) reports a range when the selection settles.
   */
  touch?: boolean;
  /** Rendered after the chapter text, inside the scroller (e.g. end-of-chapter actions). */
  footer?: React.ReactNode;
  /** CSS length of chrome floating over the top of the text (touch layout). */
  topInset?: string;
  /** Raw scroll offset, for chrome that hides while reading forward. */
  onScrollOffset?(scrollTop: number): void;
}

const DOUBLE_TAP_MS = 260;
const SELECTION_SETTLE_MS = 450;

/** Escapes a value for use inside a double-quoted attribute selector. */
function attr(value: string) {
  return value.replace(/["\\]/g, "\\$&");
}

const DECORATION_CLASSES = [
  "is-selected", "is-related", "is-expression", "is-speaking", "is-speaking-word", "lx-note-mark",
  "g-subject", "g-finite-verb", "g-verb-complement", "g-separable-particle", "g-direct-object",
  "g-indirect-object", "g-prepositional-phrase", "g-subordinator",
];

interface SegmentRuntime {
  segments: ChapterSegment[];
  elements: HTMLDivElement[];
  mounted: Set<number>;
  measured: Map<number, number>;
  blockToSegment: Map<string, number>;
}

function ReadingSurfaceComponent(props: ReadingSurfaceProps) {
  const {
    document, index, chapterIndex, formStates, settings, decorations, scrollTarget, initialBlockId,
  } = props;
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const formStatesRef = useRef(formStates);
  formStatesRef.current = formStates;
  const decorationsRef = useRef(decorations);
  decorationsRef.current = decorations;
  const horizontalMargin = props.touch ? settings.horizontalMargin : 32;
  const layoutRef = useRef({ fontSize: settings.fontSize, lineHeight: settings.lineHeight, contentWidth: settings.contentWidth, margin: horizontalMargin });
  layoutRef.current = { fontSize: settings.fontSize, lineHeight: settings.lineHeight, contentWidth: settings.contentWidth, margin: horizontalMargin };
  /** Layout for height estimates: on a phone the column is the screen, not the max width. */
  const effectiveLayout = useCallback(() => {
    const layout = layoutRef.current;
    const viewport = scrollRef.current?.clientWidth ?? 0;
    // estimateSegmentHeight subtracts 64px of desktop padding; feed it the real text width.
    const textWidth = viewport > 0 ? Math.min(layout.contentWidth - 64, viewport - layout.margin * 2) : layout.contentWidth - 64;
    return { fontSize: layout.fontSize, lineHeight: layout.lineHeight, contentWidth: textWidth + 64 };
  }, []);
  /** Pixels of floating chrome over the top of the scroller. */
  const insetTop = useCallback(() => {
    const scroller = scrollRef.current;
    if (!scroller || !callbacks.current.topInset) return 0;
    return Number.parseFloat(window.getComputedStyle(scroller).scrollPaddingTop) || 0;
  }, []);
  const decorated = useRef<Set<Element>>(new Set());
  const anchorRef = useRef<{ blockId: string; offset: number } | null>(null);
  const runtimeRef = useRef<SegmentRuntime | null>(null);
  const callbacks = useRef(props);
  callbacks.current = props;
  const pendingTap = useRef<{ ordinal: number; timer: number } | null>(null);

  const chapter = document.chapters[chapterIndex];
  const firstOrdinal = index.chapterRange(chapterIndex)?.[0] ?? 0;
  const segments = useMemo(() => (chapter ? buildChapterSegments(chapter, firstOrdinal) : []), [chapter, firstOrdinal]);

  /** Applies selection/related/grammar/annotation marks to whatever is mounted. */
  const decorate = useCallback(() => {
    const content = contentRef.current;
    if (!content) return;
    const current = decorationsRef.current;
    for (const element of decorated.current) element.classList.remove(...DECORATION_CLASSES);
    decorated.current.clear();
    const mark = (element: Element | null, className: string) => {
      if (!element) return;
      element.classList.add(className);
      decorated.current.add(element);
    };
    const word = (ordinal: number) => content.querySelector(`.lx-w[data-o="${ordinal}"]`);

    if (current.relatedLexeme !== null) {
      content.querySelectorAll(`.lx-w[data-l="${current.relatedLexeme}"]`).forEach((el) => mark(el, "is-related"));
    }
    for (const ordinal of current.expressionOrdinals) mark(word(ordinal), "is-expression");
    if (current.selectedOrdinal !== null) mark(word(current.selectedOrdinal), "is-selected");
    if (current.selectedSentenceId) mark(content.querySelector(`.lx-s[data-s="${attr(current.selectedSentenceId)}"]`), "is-selected");
    if (current.speakingSentenceId) mark(content.querySelector(`.lx-s[data-s="${attr(current.speakingSentenceId)}"]`), "is-speaking");
    if (current.speakingOrdinal !== null) mark(word(current.speakingOrdinal), "is-speaking-word");
    for (const [ordinal, role] of current.grammarRoles) mark(word(ordinal), `g-${role}`);
    for (const id of current.annotatedIds) {
      const tokenOrdinal = /\.t\d+$/.test(id) ? index.ordinalOfTokenId(id) : null;
      if (tokenOrdinal !== null) mark(word(tokenOrdinal), "lx-note-mark");
      else mark(content.querySelector(`[data-s="${attr(id)}"], [data-b="${attr(id)}"]`), "lx-note-mark");
    }
  }, [index]);

  const mountSegment = useCallback((segmentIndex: number) => {
    const runtime = runtimeRef.current;
    if (!runtime || !chapter || runtime.mounted.has(segmentIndex)) return false;
    const segment = runtime.segments[segmentIndex];
    const element = runtime.elements[segmentIndex];
    if (!segment || !element) return false;
    element.innerHTML = renderBlocksHtml(chapter.blocks.slice(segment.blockStart, segment.blockEnd), segment.firstOrdinal, formStatesRef.current);
    element.style.height = "";
    runtime.mounted.add(segmentIndex);
    return true;
  }, [chapter]);

  const unmountSegment = useCallback((segmentIndex: number) => {
    const runtime = runtimeRef.current;
    const element = runtime?.elements[segmentIndex];
    if (!runtime || !element || !runtime.mounted.has(segmentIndex)) return;
    const height = element.offsetHeight;
    if (height > 0) runtime.measured.set(segmentIndex, height);
    element.style.height = `${runtime.measured.get(segmentIndex) ?? 0}px`;
    for (const decoratedElement of [...decorated.current]) {
      if (element.contains(decoratedElement)) decorated.current.delete(decoratedElement);
    }
    element.textContent = "";
    runtime.mounted.delete(segmentIndex);
  }, []);

  /** Mounts the segment holding a block/sentence/token so it can be scrolled to. */
  const ensureMounted = useCallback((target: { ordinal?: number; blockId?: string; sentenceId?: string }) => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    let segmentIndex = -1;
    if (target.ordinal !== undefined) {
      segmentIndex = runtime.segments.findIndex((segment) => target.ordinal! >= segment.firstOrdinal && target.ordinal! < segment.firstOrdinal + segment.tokenCount);
    } else {
      const blockId = target.blockId ?? target.sentenceId?.replace(/\.s\d+$/, "");
      if (blockId) segmentIndex = runtime.blockToSegment.get(blockId) ?? -1;
    }
    if (segmentIndex >= 0 && mountSegment(segmentIndex)) decorate();
  }, [decorate, mountSegment]);

  // Build the segment skeleton once per chapter; restore position.
  useLayoutEffect(() => {
    const content = contentRef.current;
    const scroller = scrollRef.current;
    if (!content || !scroller || !chapter) return;
    content.textContent = "";
    decorated.current.clear();
    const blockToSegment = new Map<string, number>();
    const elements = segments.map((segment) => {
      const element = window.document.createElement("div");
      element.className = "lx-seg";
      element.dataset.seg = String(segment.index);
      element.style.height = `${estimateSegmentHeight(chapter, segment, effectiveLayout())}px`;
      for (let blockIndex = segment.blockStart; blockIndex < segment.blockEnd; blockIndex += 1) {
        const id = chapter.blocks[blockIndex]?.id;
        if (id) blockToSegment.set(id, segment.index);
      }
      content.appendChild(element);
      return element;
    });
    runtimeRef.current = { segments, elements, mounted: new Set(), measured: new Map(), blockToSegment };

    const observerAvailable = typeof IntersectionObserver !== "undefined";
    const startSegment = initialBlockId ? blockToSegment.get(initialBlockId) ?? 0 : 0;
    if (!observerAvailable) {
      segments.forEach((segment) => mountSegment(segment.index));
    } else {
      for (let offset = -1; offset <= 1; offset += 1) mountSegment(startSegment + offset);
    }
    const target = initialBlockId ? content.querySelector<HTMLElement>(`[data-b="${attr(initialBlockId)}"]`) : null;
    scroller.scrollTop = target ? Math.max(0, target.offsetTop - 24 - insetTop()) : 0;
    decorate();

    if (!observerAvailable) return;
    const observer = new IntersectionObserver((entries) => {
      let changed = false;
      for (const entry of entries) {
        const segmentIndex = Number((entry.target as HTMLElement).dataset.seg);
        if (entry.isIntersecting) changed = mountSegment(segmentIndex) || changed;
        else unmountSegment(segmentIndex);
      }
      if (changed) decorate();
    }, { root: scroller, rootMargin: "1200px 0px 1200px 0px" });
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
    // initialBlockId is only meaningful when the chapter changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapter, segments]);

  /** Layout changes (type, width, rotation) invalidate the height of segments that are not rendered. */
  const reestimateHiddenSegments = useCallback(() => {
    const runtime = runtimeRef.current;
    if (!runtime || !chapter) return;
    runtime.measured.clear();
    const layout = effectiveLayout();
    runtime.segments.forEach((segment) => {
      if (runtime.mounted.has(segment.index)) return;
      const element = runtime.elements[segment.index];
      if (element) element.style.height = `${estimateSegmentHeight(chapter, segment, layout)}px`;
    });
  }, [chapter, effectiveLayout]);

  useEffect(() => {
    reestimateHiddenSegments();
  }, [reestimateHiddenSegments, settings.fontSize, settings.lineHeight, settings.contentWidth, horizontalMargin]);

  // Knowledge changes patch classes in place (only rendered segments exist in the DOM).
  useEffect(() => {
    if (contentRef.current) applyStateClasses(contentRef.current, formStates);
  }, [formStates, segments]);

  // Decorations.
  useEffect(() => {
    decorate();
  }, [decorate, decorations, segments]);

  // Scroll requests (occurrence navigation, annotations, audio follow).
  useEffect(() => {
    if (!scrollTarget) return;
    const content = contentRef.current;
    if (!content) return;
    ensureMounted(scrollTarget);
    const element = scrollTarget.ordinal !== undefined
      ? content.querySelector<HTMLElement>(`.lx-w[data-o="${scrollTarget.ordinal}"]`)
      : scrollTarget.sentenceId
        ? content.querySelector<HTMLElement>(`[data-s="${attr(scrollTarget.sentenceId)}"]`)
        : scrollTarget.blockId
          ? content.querySelector<HTMLElement>(`[data-b="${attr(scrollTarget.blockId)}"]`)
          : null;
    if (!element) return;
    element.scrollIntoView({ block: "center", behavior: scrollTarget.flash ? "smooth" : "auto" });
    if (scrollTarget.flash) {
      element.classList.remove("lx-flash");
      void element.offsetWidth;
      element.classList.add("lx-flash");
    }
  }, [scrollTarget, segments, ensureMounted]);

  // Track position; keep an anchor so panel/width changes do not lose it.
  const reportPosition = useCallback(() => {
    const scroller = scrollRef.current;
    const content = contentRef.current;
    if (!scroller || !content) return;
    const top = scroller.scrollTop + insetTop();
    const firstBelow = (children: HTMLCollection) => {
      let low = 0;
      let high = children.length - 1;
      let found = -1;
      while (low <= high) {
        const mid = (low + high) >> 1;
        const element = children[mid] as HTMLElement;
        if (element.offsetTop + element.offsetHeight > top) {
          found = mid;
          high = mid - 1;
        } else {
          low = mid + 1;
        }
      }
      return found >= 0 ? (children[found] as HTMLElement) : null;
    };
    const segment = firstBelow(content.children);
    const block = segment && segment.children.length > 0 ? firstBelow(segment.children) : null;
    const runtime = runtimeRef.current;
    const segmentIndex = segment ? Number(segment.dataset.seg) : -1;
    const fallbackBlockId = runtime && segmentIndex >= 0 && chapter
      ? chapter.blocks[runtime.segments[segmentIndex]?.blockStart ?? 0]?.id ?? null
      : null;
    const blockId = block?.dataset.b ?? fallbackBlockId;
    anchorRef.current = block?.dataset.b ? { blockId: block.dataset.b, offset: top - block.offsetTop } : null;
    const max = scroller.scrollHeight - scroller.clientHeight;
    callbacks.current.onPosition(blockId, max > 0 ? scroller.scrollTop / max : 1);
  }, [chapter, insetTop]);

  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    let frame = 0;
    const onScroll = () => {
      callbacks.current.onScrollOffset?.(scroller.scrollTop);
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(reportPosition);
    };
    scroller.addEventListener("scroll", onScroll, { passive: true });
    reportPosition();
    let lastWidth = scroller.clientWidth;
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => {
      if (scroller.clientWidth === lastWidth) return;
      lastWidth = scroller.clientWidth;
      // Rotation or a resized panel: hidden segments were sized for the old width.
      reestimateHiddenSegments();
      const anchor = anchorRef.current;
      const element = anchor ? contentRef.current?.querySelector<HTMLElement>(`[data-b="${attr(anchor.blockId)}"]`) : null;
      if (anchor && element) scroller.scrollTop = element.offsetTop + Math.min(anchor.offset, element.offsetHeight) - insetTop();
    });
    observer?.observe(scroller);
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [insetTop, reestimateHiddenSegments, reportPosition, segments]);

  // Touch: report the settled native selection (long press + drag handles) as a range.
  useEffect(() => {
    if (!props.touch) return;
    let timer = 0;
    const onSelectionChange = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const selection = window.getSelection();
        const content = contentRef.current;
        if (!selection || selection.isCollapsed || !content || selection.rangeCount === 0) return;
        const range = selection.getRangeAt(0);
        if (!content.contains(range.commonAncestorContainer)) return;
        const words = Array.from(content.querySelectorAll<HTMLElement>(".lx-w"))
          .filter((element) => range.intersectsNode(element))
          .map((element) => Number(element.dataset.o));
        if (words.length < 2) return;
        const rect = range.getBoundingClientRect();
        callbacks.current.onRangeSelect(Math.min(...words), Math.max(...words), rect.left + rect.width / 2, rect.bottom);
      }, SELECTION_SETTLE_MS);
    };
    window.document.addEventListener("selectionchange", onSelectionChange);
    return () => {
      window.clearTimeout(timer);
      window.document.removeEventListener("selectionchange", onSelectionChange);
    };
  }, [props.touch]);

  useEffect(() => () => {
    if (pendingTap.current) window.clearTimeout(pendingTap.current.timer);
  }, []);

  const handleTouchWord = (ordinal: number) => {
    const pending = pendingTap.current;
    if (pending) {
      window.clearTimeout(pending.timer);
      pendingTap.current = null;
      if (pending.ordinal === ordinal) {
        callbacks.current.onWordClick(ordinal, { alt: false, ctrl: true });
        return;
      }
      callbacks.current.onWordClick(pending.ordinal, { alt: false, ctrl: false });
    }
    pendingTap.current = {
      ordinal,
      timer: window.setTimeout(() => {
        pendingTap.current = null;
        callbacks.current.onWordClick(ordinal, { alt: false, ctrl: false });
      }, DOUBLE_TAP_MS),
    };
  };

  const handleClick = (event: React.MouseEvent) => {
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) return;
    const target = event.target as HTMLElement;
    const wordElement = target.closest<HTMLElement>(".lx-w");
    if (wordElement?.dataset.o) {
      const ordinal = Number(wordElement.dataset.o);
      if (props.touch) {
        handleTouchWord(ordinal);
        return;
      }
      if (event.altKey) {
        const sentence = wordElement.closest<HTMLElement>(".lx-s");
        if (sentence?.dataset.s) props.onSentenceClick(sentence.dataset.s);
        return;
      }
      props.onWordClick(ordinal, { alt: event.altKey, ctrl: event.ctrlKey || event.metaKey });
      return;
    }
    const sentence = target.closest<HTMLElement>(".lx-s");
    if (sentence?.dataset.s) {
      props.onSentenceClick(sentence.dataset.s);
      return;
    }
    props.onBackgroundClick();
  };

  const handleContextMenu = (event: React.MouseEvent) => {
    const wordElement = (event.target as HTMLElement).closest<HTMLElement>(".lx-w");
    if (!wordElement?.dataset.o) return;
    event.preventDefault();
    props.onWordContextMenu(Number(wordElement.dataset.o), event.clientX, event.clientY);
  };

  const handleMouseUp = (event: React.MouseEvent) => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !contentRef.current) return;
    const range = selection.getRangeAt(0);
    if (!contentRef.current.contains(range.commonAncestorContainer)) return;
    const words = Array.from(contentRef.current.querySelectorAll<HTMLElement>(".lx-w"))
      .filter((element) => range.intersectsNode(element))
      .map((element) => Number(element.dataset.o));
    if (words.length < 2) return;
    props.onRangeSelect(Math.min(...words), Math.max(...words), event.clientX, event.clientY);
  };

  return (
    <div
      ref={scrollRef}
      className="lx-surface relative h-full overflow-y-auto"
      data-mode={settings.learningMode ? "learning" : "traditional"}
      data-highlights={settings.showHighlights ? "on" : "off"}
      data-known={settings.highlightKnown ? "on" : "off"}
      data-theme={settings.theme}
      data-touch={props.touch ? "on" : undefined}
      style={{
        ["--lx-font-size" as string]: `${settings.fontSize}px`,
        ["--lx-line-height" as string]: String(settings.lineHeight),
        ["--lx-width" as string]: `${settings.contentWidth}px`,
        ...(props.touch ? { ["--lx-margin-x" as string]: `${settings.horizontalMargin}px` } : {}),
        ...(props.topInset ? { ["--lx-inset-top" as string]: props.topInset } : {}),
      }}
    >
      <div className="lx-content" lang={document.language}>
        {chapter && <div className="lx-chapter-title">{chapter.title}</div>}
        <div
          ref={contentRef}
          onClick={handleClick}
          onContextMenu={handleContextMenu}
          onMouseUp={handleMouseUp}
        />
        {props.footer}
      </div>
    </div>
  );
}

export const ReadingSurface = memo(ReadingSurfaceComponent);
