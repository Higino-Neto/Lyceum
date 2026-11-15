import type { KnowledgeState, LinguisticBlock, LinguisticChapter } from "../../../../core/language-learning/model";
import { TOKEN_FLAG_PROPER_NOUN_CANDIDATE } from "../../../../core/language-learning/model";

export const STATE_CLASS: Record<KnowledgeState, string> = {
  unknown: "s-u",
  learning: "s-l",
  known: "s-k",
  ignored: "s-i",
};

export const STATE_CLASSES = Object.values(STATE_CLASS);

function escapeHtml(value: string) {
  return value.replace(/[&<>"]/g, (char) => (char === "&" ? "&amp;" : char === "<" ? "&lt;" : char === ">" ? "&gt;" : "&quot;"));
}

function blockTag(kind: string, level?: number) {
  if (kind === "heading") return `h${Math.min(6, Math.max(2, (level ?? 2) + 1))}`;
  if (kind === "quote") return "blockquote";
  return "p";
}

/**
 * Builds markup for a run of blocks. Each word is a plain span carrying its
 * global ordinal (`data-o`), lexeme (`data-l`) and form (`data-f`); state
 * changes later patch classes in place instead of re-rendering. Original
 * text is copied verbatim between tokens, so content is never altered.
 */
export function renderBlocksHtml(
  blocks: readonly LinguisticBlock[],
  firstOrdinal: number,
  formStates: KnowledgeState[],
): string {
  let ordinal = firstOrdinal;
  const parts: string[] = [];
  for (const block of blocks) {
    const tag = blockTag(block.kind, block.level);
    const extraClass = block.kind === "list-item" ? " lx-li" : "";
    parts.push(`<${tag} class="lx-block${extraClass}" data-b="${escapeHtml(block.id)}">`);
    let cursor = 0;
    for (const sentence of block.sentences) {
      if (sentence.start > cursor) parts.push(escapeHtml(block.text.slice(cursor, sentence.start)));
      parts.push(`<span class="lx-s" data-s="${escapeHtml(sentence.id)}">`);
      let inner = sentence.start;
      for (const [start, end, lexeme, form, flags] of sentence.tokens) {
        if (start > inner) parts.push(escapeHtml(block.text.slice(inner, start)));
        const state = formStates[form] ?? "unknown";
        const proper = flags & TOKEN_FLAG_PROPER_NOUN_CANDIDATE ? " pn" : "";
        parts.push(
          `<span class="lx-w ${STATE_CLASS[state]}${proper}" data-o="${ordinal}" data-l="${lexeme}" data-f="${form}">${escapeHtml(block.text.slice(start, end))}</span>`,
        );
        inner = end;
        ordinal += 1;
      }
      if (sentence.end > inner) parts.push(escapeHtml(block.text.slice(inner, sentence.end)));
      parts.push("</span>");
      cursor = sentence.end;
    }
    if (cursor < block.text.length) parts.push(escapeHtml(block.text.slice(cursor)));
    parts.push(`</${tag}>`);
  }
  return parts.join("");
}

/** Builds the markup of a whole chapter (used by tests and small chapters). */
export function renderChapterHtml(
  chapter: LinguisticChapter,
  firstOrdinal: number,
  formStates: KnowledgeState[],
): string {
  return renderBlocksHtml(chapter.blocks, firstOrdinal, formStates);
}

/** A run of consecutive blocks rendered (or not) as one unit. */
export interface ChapterSegment {
  index: number;
  blockStart: number;
  blockEnd: number;
  firstOrdinal: number;
  tokenCount: number;
  charCount: number;
  headingCount: number;
}

/**
 * Splits a chapter into segments of roughly `targetTokens` words so very long
 * chapters only keep the visible part in the DOM.
 */
export function buildChapterSegments(chapter: LinguisticChapter, firstOrdinal: number, targetTokens = 700, maxBlocks = 40): ChapterSegment[] {
  const segments: ChapterSegment[] = [];
  let current: ChapterSegment | null = null;
  let ordinal = firstOrdinal;
  chapter.blocks.forEach((block, blockIndex) => {
    if (!current || current.tokenCount >= targetTokens || current.blockEnd - current.blockStart >= maxBlocks) {
      current = { index: segments.length, blockStart: blockIndex, blockEnd: blockIndex, firstOrdinal: ordinal, tokenCount: 0, charCount: 0, headingCount: 0 };
      segments.push(current);
    }
    let tokens = 0;
    for (const sentence of block.sentences) tokens += sentence.tokens.length;
    current.blockEnd = blockIndex + 1;
    current.tokenCount += tokens;
    current.charCount += block.text.length;
    if (block.kind === "heading") current.headingCount += 1;
    ordinal += tokens;
  });
  return segments;
}

/** Height estimate for a segment that is not rendered. */
export function estimateSegmentHeight(
  chapter: LinguisticChapter,
  segment: ChapterSegment,
  layout: { fontSize: number; lineHeight: number; contentWidth: number },
): number {
  const width = Math.max(200, layout.contentWidth - 64);
  const charsPerLine = Math.max(20, width / (layout.fontSize * 0.5));
  const lineHeight = layout.fontSize * layout.lineHeight;
  let height = 0;
  for (let index = segment.blockStart; index < segment.blockEnd; index += 1) {
    const block = chapter.blocks[index];
    if (!block) continue;
    const lines = Math.max(1, Math.ceil(block.text.length / charsPerLine));
    height += lines * lineHeight * (block.kind === "heading" ? 1.2 : 1) + layout.fontSize * (block.kind === "heading" ? 2.3 : 0.9);
  }
  return Math.round(height);
}

/** Patches state classes of the given word spans in place. */
export function applyStateClasses(
  root: ParentNode,
  formStates: KnowledgeState[],
  lexemes?: ReadonlySet<number>,
) {
  const spans = root.querySelectorAll<HTMLElement>("span.lx-w");
  spans.forEach((span) => {
    if (lexemes && !lexemes.has(Number(span.dataset.l))) return;
    const state = formStates[Number(span.dataset.f)] ?? "unknown";
    const wanted = STATE_CLASS[state];
    if (span.classList.contains(wanted)) return;
    span.classList.remove(...STATE_CLASSES);
    span.classList.add(wanted);
  });
}
