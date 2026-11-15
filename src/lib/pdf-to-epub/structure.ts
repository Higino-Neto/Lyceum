import type { Block, Section } from "./types";

/**
 * Turns the flat block stream of a PDF into a book outline:
 * - consecutive heading lines are merged ("24" + "An Embarrassment to Who and
 *   What We" + "Are" -> one heading "24. An Embarrassment to Who and What We Are");
 * - every heading that opens a page starts a new section (one file per
 *   chapter, so the reader's "next chapter" and the TOC work);
 * - a section that only holds headings (a part title page) absorbs the next
 *   heading ("Part One" + "ROBE AND RING" -> "Part One: ROBE AND RING");
 * - nesting comes from the heading rank (chapter > title > subtitle).
 * Content before the first heading is a front section with no invented title.
 */

const HEADING_TYPES = new Set<Block["type"]>(["chapter", "title", "subtitle"]);
const HEADING_RANK: Partial<Record<Block["type"], number>> = { chapter: 0, title: 1, subtitle: 2 };
const NUMBER_LABEL = /^(?:\d{1,4}|[ivxlcdm]{1,7}|(?:chapter|cap[ií]tulo|part[e]?|livro|book|section|se[cç][aã]o)\s+[\w\d]+)\.?$/i;

export function isHeadingBlock(block: Block): boolean {
  return HEADING_TYPES.has(block.type);
}

export function headingLines(block: Block): string[] {
  const lines = block.attrs?.lines;
  if (Array.isArray(lines) && lines.every((line) => typeof line === "string")) return lines as string[];
  return block.text ? [block.text] : [];
}

/** "1" + "No Dimming of the Sun" -> "1. No Dimming of the Sun"; plain lines are joined with spaces. */
export function headingLabel(lines: string[]): string {
  const clean = lines.map((line) => line.trim()).filter(Boolean);
  if (clean.length === 0) return "";
  if (clean.length > 1 && NUMBER_LABEL.test(clean[0])) {
    const head = clean[0].replace(/\.$/, "");
    const rest = clean.slice(1).join(" ");
    return /^\d+$|^[ivxlcdm]+$/i.test(head) ? `${head}. ${rest}` : `${head}: ${rest}`;
  }
  return clean.join(" ");
}

function lineHeight(block: Block): number {
  return Math.max(1, block.bbox?.height ?? 12);
}

function isContinuation(previous: Block, next: Block): boolean {
  if (!isHeadingBlock(previous) || !isHeadingBlock(next)) return false;
  if (previous.pageRange.end !== next.pageRange.start) return false;
  if (!previous.bbox || !next.bbox) return true;
  const gap = next.bbox.y0 - previous.bbox.y1;
  return gap >= -2 && gap <= Math.max(lineHeight(previous), lineHeight(next)) * 2.5;
}

/** Merges runs of adjacent heading lines into one heading block. */
export function mergeHeadingRuns(blocks: Block[]): Block[] {
  const output: Block[] = [];
  for (const block of blocks) {
    const previous = output[output.length - 1];
    if (previous && isContinuation(previous, block)) {
      const lines = [...headingLines(previous), ...headingLines(block)];
      // A wrapped title line ("...What We" + "Are") continues the last line;
      // a number followed by a title stays on separate lines.
      const last = lines.length >= 2 ? lines[lines.length - 2] : "";
      // (Line types may differ: a wrapped line is often set in a smaller size.)
      const wraps = lines.length >= 2
        && !NUMBER_LABEL.test(last) && !/^(?:part[e]?|livro|book|volume|tomo)\b/i.test(last)
        && /^[\p{L}"“‘(]/u.test(lines[lines.length - 1]) && !/[.:!?”"]$/.test(last);
      const merged = wraps ? [...lines.slice(0, -2), `${last} ${lines[lines.length - 1]}`] : lines;
      const rank = Math.min(HEADING_RANK[previous.type] ?? 9, HEADING_RANK[block.type] ?? 9);
      const type = (Object.entries(HEADING_RANK).find(([, value]) => value === rank)?.[0] || previous.type) as Block["type"];
      output[output.length - 1] = {
        ...previous,
        type,
        text: headingLabel(merged),
        children: [...previous.children, ...block.children],
        pageRange: { start: previous.pageRange.start, end: block.pageRange.end },
        bbox: previous.bbox && block.bbox
          ? {
            x0: Math.min(previous.bbox.x0, block.bbox.x0),
            y0: previous.bbox.y0,
            x1: Math.max(previous.bbox.x1, block.bbox.x1),
            y1: block.bbox.y1,
            width: Math.max(previous.bbox.x1, block.bbox.x1) - Math.min(previous.bbox.x0, block.bbox.x0),
            height: block.bbox.y1 - previous.bbox.y0,
          }
          : previous.bbox,
        attrs: { ...previous.attrs, lines: merged },
      };
      continue;
    }
    output.push(isHeadingBlock(block) ? { ...block, attrs: { ...block.attrs, lines: headingLines(block) } } : block);
  }
  return output;
}

export interface OutlineSection extends Section {
  /** Content before the first heading (cover, copyright...): no title, not in the TOC. */
  front?: boolean;
  rank?: number;
}

function hasBodyContent(section: OutlineSection): boolean {
  return section.children.some((block) => !isHeadingBlock(block));
}

const PART_LABEL = /^(?:part[e]?|livro|book|volume|tomo)\b/i;
const NUMBERED_LABEL = /^(?:\d{1,4}|[ivxlcdm]{1,7})\.\s|^(?:chapter|cap[ií]tulo)\s+[\w\d]+/i;

/**
 * Outline rank from the heading's wording rather than its font size, which
 * varies inside one heading (a wrapped second line may be typeset smaller):
 * parts > numbered chapters; unnumbered headings sit at the top level when the
 * book numbers its chapters (front/back matter), else they follow the
 * typographic rank.
 */
function outlineRank(block: Block, label: string, bookHasNumberedChapters: boolean): number {
  if (PART_LABEL.test(label)) return 0;
  if (NUMBERED_LABEL.test(label)) return 1;
  if (bookHasNumberedChapters) return 0;
  return HEADING_RANK[block.type] ?? 2;
}

function startsSectionAt(block: Block, previousBlock: Block | null): boolean {
  if (!isHeadingBlock(block)) return false;
  const opensPage = !previousBlock || previousBlock.pageRange.end < block.pageRange.start;
  return block.type === "chapter" || block.type === "title" || opensPage;
}

export function buildOutlineSections(blocks: Block[]): OutlineSection[] {
  const labelOf = (block: Block) => block.text || headingLabel(headingLines(block));
  const numberedStarts = blocks.filter((block, index) => (
    startsSectionAt(block, blocks[index - 1] || null) && NUMBERED_LABEL.test(labelOf(block))
  )).length;
  const bookHasNumberedChapters = numberedStarts >= 3;

  const sections: OutlineSection[] = [];
  const rankStack: number[] = [];
  let current: OutlineSection | null = null;
  let absorbed = false;
  let previousBlock: Block | null = null;

  for (const block of blocks) {
    if (startsSectionAt(block, previousBlock)) {
      const title = labelOf(block);
      const rank = outlineRank(block, title, bookHasNumberedChapters);
      // A part title page absorbs one following subtitle ("Part One" +
      // "ROBE AND RING"), never a chapter of its own.
      if (
        current && !current.front && !absorbed && !hasBodyContent(current)
        && (current.rank ?? 9) === 0 && PART_LABEL.test(current.title || "")
        && !NUMBERED_LABEL.test(title) && !PART_LABEL.test(title)
        && block.pageRange.start <= current.pageRange.end + 1
      ) {
        current.title = `${current.title}: ${title}`;
        current.children.push(block);
        current.pageRange.end = block.pageRange.end;
        absorbed = true;
        previousBlock = block;
        continue;
      }
      while (rankStack.length > 0 && rankStack[rankStack.length - 1] >= rank) rankStack.pop();
      const level = rankStack.length + 1;
      rankStack.push(rank);
      current = { type: "section", title, level, rank, children: [block], pageRange: { ...block.pageRange } };
      sections.push(current);
      absorbed = false;
      previousBlock = block;
      continue;
    }

    if (!current) {
      current = { type: "section", level: 1, front: true, children: [], pageRange: { ...block.pageRange } };
      sections.push(current);
    }
    current.children.push(block);
    current.pageRange.end = Math.max(current.pageRange.end, block.pageRange.end);
    previousBlock = block;
  }

  return sections;
}
