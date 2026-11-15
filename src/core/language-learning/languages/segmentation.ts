/**
 * Language-neutral segmentation helpers. `Intl.Segmenter` is used when the
 * runtime provides it (Chromium/Electron and Node 16+); regular expressions
 * are the fallback.
 */

interface SegmentDataLike {
  segment: string;
  index: number;
  isWordLike?: boolean;
}

interface SegmenterLike {
  segment(input: string): Iterable<SegmentDataLike>;
}

type SegmenterConstructor = new (
  locale: string | undefined,
  options: { granularity: "word" | "sentence" | "grapheme" },
) => SegmenterLike;

function getSegmenterConstructor(): SegmenterConstructor | null {
  const intl = Intl as unknown as { Segmenter?: SegmenterConstructor };
  return typeof intl.Segmenter === "function" ? intl.Segmenter : null;
}

const segmenterCache = new Map<string, SegmenterLike>();

function getSegmenter(locale: string, granularity: "word" | "sentence"): SegmenterLike | null {
  const Segmenter = getSegmenterConstructor();
  if (!Segmenter) return null;
  const cacheKey = `${locale}:${granularity}`;
  let segmenter = segmenterCache.get(cacheKey);
  if (!segmenter) {
    try {
      segmenter = new Segmenter(locale, { granularity });
    } catch {
      return null;
    }
    segmenterCache.set(cacheKey, segmenter);
  }
  return segmenter;
}

const DEFAULT_ABBREVIATIONS = new Set([
  "mr", "mrs", "ms", "dr", "prof", "st", "vs", "etc", "e.g", "i.e", "no", "vol", "ch", "fig",
]);

/**
 * Splits text into sentence ranges. Ranges are trimmed of surrounding
 * whitespace and never empty.
 */
export function segmentSentences(
  text: string,
  locale: string,
  abbreviations: ReadonlySet<string> = DEFAULT_ABBREVIATIONS,
): Array<[number, number]> {
  const raw: Array<[number, number]> = [];
  const segmenter = getSegmenter(locale, "sentence");

  if (segmenter) {
    for (const segment of segmenter.segment(text)) {
      raw.push([segment.index, segment.index + segment.segment.length]);
    }
  } else {
    const pattern = /[^.!?…]+(?:[.!?…]+["'»«”’)\]]*|$)/g;
    for (const match of text.matchAll(pattern)) {
      const index = match.index ?? 0;
      raw.push([index, index + match[0].length]);
    }
  }

  // Re-join splits after known abbreviations ("z.B.", "Dr.") and initials.
  const merged: Array<[number, number]> = [];
  for (const range of raw) {
    const previous = merged[merged.length - 1];
    if (previous) {
      const previousText = text.slice(previous[0], previous[1]).trimEnd();
      const lastWord = /([\p{L}.]+)\.$/u.exec(previousText)?.[1]?.toLocaleLowerCase();
      if (lastWord && (abbreviations.has(lastWord) || /^\p{L}$/u.test(lastWord))) {
        previous[1] = range[1];
        continue;
      }
    }
    merged.push([range[0], range[1]]);
  }

  const trimmed: Array<[number, number]> = [];
  for (const [start, end] of merged) {
    let s = start;
    let e = end;
    while (s < e && /\s/u.test(text[s] ?? "")) s += 1;
    while (e > s && /\s/u.test(text[e - 1] ?? "")) e -= 1;
    if (e > s) trimmed.push([s, e]);
  }
  return trimmed;
}

const ALPHABETIC_WORD = /\p{L}[\p{L}\p{M}]*(?:['’\-‐]\p{L}[\p{L}\p{M}]*)*/gu;

/** Languages written without spaces between words. */
const UNSPACED_LANGUAGES = new Set(["zh", "ja", "th", "lo", "km", "my"]);

/** Returns word ranges; numbers and punctuation are not tokens. */
export function tokenizeWords(text: string, locale: string): Array<[number, number]> {
  const language = locale.split("-")[0]?.toLowerCase() ?? locale;
  if (UNSPACED_LANGUAGES.has(language)) {
    const segmenter = getSegmenter(locale, "word");
    if (segmenter) {
      const ranges: Array<[number, number]> = [];
      for (const segment of segmenter.segment(text)) {
        if (segment.isWordLike && /\p{L}/u.test(segment.segment)) {
          ranges.push([segment.index, segment.index + segment.segment.length]);
        }
      }
      return ranges;
    }
  }

  const ranges: Array<[number, number]> = [];
  for (const match of text.matchAll(ALPHABETIC_WORD)) {
    const index = match.index ?? 0;
    ranges.push([index, index + match[0].length]);
  }
  return ranges;
}

export function normalizeForm(value: string): string {
  return value.normalize("NFC").replace(/[’‘`]/g, "'").replace(/[‐]/g, "-").toLocaleLowerCase();
}

export function isCapitalized(value: string): boolean {
  const first = value.charAt(0);
  return first !== first.toLocaleLowerCase() && first === first.toLocaleUpperCase();
}
