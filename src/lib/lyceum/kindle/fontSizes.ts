/**
 * Makes publisher font sizes relative so the Kindle's own font-size setting
 * works. Absolute sizes (pt/px, keywords) are fixed on the device: a book whose
 * CSS says `p { font-size: 14pt }` renders tiny no matter what the reader picks.
 *
 * - The body-text size is detected (most common absolute size on p/body/div...)
 *   and becomes 1em; every other absolute size is expressed relative to it.
 * - html/body sizes are dropped so the reader's size is the base.
 * - rem becomes em (Kindle has no reliable root size).
 */

const POINTS_PER_PX = 0.75;
const DEFAULT_BASE_PT = 12;
const MIN_EM = 0.6;
const MAX_EM = 3;
const KEYWORD_EM: Record<string, number> = {
  "xx-small": 0.6,
  "x-small": 0.75,
  small: 0.89,
  medium: 1,
  large: 1.2,
  "x-large": 1.5,
  "xx-large": 2,
  "xxx-large": 3,
};
const BODY_TEXT_SELECTOR = /(^|[\s,>+~])(p|div|blockquote|li|span|\*|body|html)(?=$|[\s,>+~.#:[])/i;
const ROOT_SELECTOR = /^(?:html|body|:root)(?:[.#:[][^,]*)?$/i;
const ABSOLUTE_SIZE = /(-?\d*\.?\d+)\s*(pt|px)\b/i;

function toPoints(value: number, unit: string): number {
  return unit.toLowerCase() === "px" ? value * POINTS_PER_PX : value;
}

function formatEm(value: number): string {
  const clamped = Math.min(MAX_EM, Math.max(MIN_EM, value));
  return `${Number(clamped.toFixed(3))}em`;
}

interface Rule {
  selector: string;
  body: string;
}

/** Innermost `selector { declarations }` blocks (also inside @media). */
function forEachRule(css: string, visit: (rule: Rule) => string | void): string {
  return css.replace(/([^{}]*)\{([^{}]*)\}/g, (match, rawSelector: string, body: string) => {
    const selector = rawSelector.trim();
    if (selector.startsWith("@font-face") || selector.startsWith("@page")) return match;
    const next = visit({ selector, body });
    return typeof next === "string" ? `${rawSelector}{${next}}` : match;
  });
}

function fontSizeValues(body: string): string[] {
  const values: string[] = [];
  for (const match of body.matchAll(/(?:^|;)\s*font-size\s*:\s*([^;!]+)/gi)) values.push(match[1].trim());
  for (const match of body.matchAll(/(?:^|;)\s*font\s*:\s*([^;!]+)/gi)) {
    const size = ABSOLUTE_SIZE.exec(match[1]);
    if (size) values.push(size[0]);
  }
  return values;
}

/** Most common absolute body-text size, in points. */
export function detectBaseFontSizePt(css: string): number {
  const counts = new Map<number, number>();
  forEachRule(css, ({ selector, body }) => {
    if (!BODY_TEXT_SELECTOR.test(selector) || /\bh[1-6]\b/i.test(selector)) return;
    for (const value of fontSizeValues(body)) {
      const absolute = ABSOLUTE_SIZE.exec(value);
      if (!absolute) continue;
      const points = Math.round(toPoints(Number(absolute[1]), absolute[2]) * 10) / 10;
      if (points > 0) counts.set(points, (counts.get(points) || 0) + 1);
    }
  });
  let best = DEFAULT_BASE_PT;
  let bestCount = 0;
  for (const [points, count] of counts) {
    if (count > bestCount) {
      best = points;
      bestCount = count;
    }
  }
  return best;
}

function relativize(value: string, basePt: number): string {
  const trimmed = value.trim();
  const keyword = KEYWORD_EM[trimmed.toLowerCase()];
  if (keyword) return formatEm(keyword);
  const rem = /^(-?\d*\.?\d+)\s*rem$/i.exec(trimmed);
  if (rem) return formatEm(Number(rem[1]));
  const absolute = /^(-?\d*\.?\d+)\s*(pt|px)$/i.exec(trimmed);
  if (absolute) return formatEm(toPoints(Number(absolute[1]), absolute[2]) / basePt);
  return trimmed;
}

export function normalizeKindleFontSizes(css: string): string {
  const basePt = detectBaseFontSizePt(css);
  return forEachRule(css, ({ selector, body }) => {
    const selectors = selector.split(",").map((part) => part.trim());
    const rootOnly = selectors.length > 0 && selectors.every((part) => ROOT_SELECTOR.test(part));
    let changed = body;
    if (rootOnly) {
      // The reader's chosen size is the base: no fixed size on html/body.
      changed = changed.replace(/(^|;)\s*font-size\s*:[^;]*;?/gi, "$1");
    } else {
      changed = changed.replace(/((?:^|;)\s*font-size\s*:\s*)([^;!]*?)(\s*)(?=;|!|$)/gi, (_match, prefix: string, value: string, space: string) => (
        `${prefix}${relativize(value, basePt)}${space}`
      ));
    }
    changed = changed.replace(/((?:^|;)\s*font\s*:\s*)([^;!]+)/gi, (_match, prefix: string, value: string) => (
      `${prefix}${value.replace(/(-?\d*\.?\d+)\s*(pt|px|rem)\b/i, (size) => relativize(size, basePt))}`
    ));
    return changed === body ? undefined : changed;
  });
}
