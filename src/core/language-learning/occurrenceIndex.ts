import type {
  LinguisticBlock,
  LinguisticDocument,
  LinguisticSentence,
  TokenTuple,
} from "./model";

/** Location of one token, addressable by stable ids. */
export interface TokenLocation {
  ordinal: number;
  chapterIndex: number;
  blockIndex: number;
  sentenceIndex: number;
  tokenIndex: number;
}

export interface ResolvedToken extends TokenLocation {
  chapterId: string;
  block: LinguisticBlock;
  sentence: LinguisticSentence;
  tuple: TokenTuple;
  tokenId: string;
}

export interface OccurrenceScope {
  chapterIndex?: number;
}

/**
 * Document-wide token index built once per loaded document. Every token gets
 * a global ordinal; lexeme/form lookups are O(occurrences) and never scan
 * the document again.
 */
export class OccurrenceIndex {
  readonly tokenCount: number;
  private readonly locations: Int32Array;
  private readonly lexemeRefs: number[][];
  private readonly formRefs: number[][];
  private readonly sentenceById = new Map<string, [number, number, number]>();
  private readonly blockById = new Map<string, [number, number]>();
  private readonly firstOrdinalOfSentence = new Map<string, number>();
  private readonly chapterRanges: Array<[number, number]> = [];

  constructor(readonly document: LinguisticDocument) {
    this.tokenCount = document.totals.tokens;
    this.locations = new Int32Array(this.tokenCount * 4);
    this.lexemeRefs = document.lexicon.map(() => []);
    this.formRefs = document.forms.map(() => []);

    let ordinal = 0;
    document.chapters.forEach((chapter, chapterIndex) => {
      const chapterStart = ordinal;
      chapter.blocks.forEach((block, blockIndex) => {
        this.blockById.set(block.id, [chapterIndex, blockIndex]);
        block.sentences.forEach((sentence, sentenceIndex) => {
          this.sentenceById.set(sentence.id, [chapterIndex, blockIndex, sentenceIndex]);
          this.firstOrdinalOfSentence.set(sentence.id, ordinal);
          sentence.tokens.forEach((tuple, tokenIndex) => {
            const base = ordinal * 4;
            this.locations[base] = chapterIndex;
            this.locations[base + 1] = blockIndex;
            this.locations[base + 2] = sentenceIndex;
            this.locations[base + 3] = tokenIndex;
            this.lexemeRefs[tuple[2]]?.push(ordinal);
            this.formRefs[tuple[3]]?.push(ordinal);
            ordinal += 1;
          });
        });
      });
      this.chapterRanges.push([chapterStart, ordinal]);
    });
  }

  location(ordinal: number): TokenLocation | null {
    if (ordinal < 0 || ordinal >= this.tokenCount) return null;
    const base = ordinal * 4;
    return {
      ordinal,
      chapterIndex: this.locations[base] ?? 0,
      blockIndex: this.locations[base + 1] ?? 0,
      sentenceIndex: this.locations[base + 2] ?? 0,
      tokenIndex: this.locations[base + 3] ?? 0,
    };
  }

  resolve(ordinal: number): ResolvedToken | null {
    const location = this.location(ordinal);
    if (!location) return null;
    const chapter = this.document.chapters[location.chapterIndex];
    const block = chapter?.blocks[location.blockIndex];
    const sentence = block?.sentences[location.sentenceIndex];
    const tuple = sentence?.tokens[location.tokenIndex];
    if (!chapter || !block || !sentence || !tuple) return null;
    return {
      ...location,
      chapterId: chapter.id,
      block,
      sentence,
      tuple,
      tokenId: `${sentence.id}.t${location.tokenIndex}`,
    };
  }

  private filter(refs: number[], scope?: OccurrenceScope) {
    if (scope?.chapterIndex === undefined) return refs;
    const range = this.chapterRanges[scope.chapterIndex];
    if (!range) return [];
    return refs.filter((ordinal) => ordinal >= range[0] && ordinal < range[1]);
  }

  lexemeOccurrences(lexeme: number, scope?: OccurrenceScope): number[] {
    return this.filter(this.lexemeRefs[lexeme] ?? [], scope);
  }

  formOccurrences(form: number, scope?: OccurrenceScope): number[] {
    return this.filter(this.formRefs[form] ?? [], scope);
  }

  /** All surface forms (indexes) of one lexeme, most frequent first. */
  formsOfLexeme(lexeme: number): number[] {
    const result: number[] = [];
    this.document.forms.forEach((form, index) => {
      if (form.lexeme === lexeme) result.push(index);
    });
    return result.sort((a, b) => (this.document.forms[b]?.count ?? 0) - (this.document.forms[a]?.count ?? 0));
  }

  /** Converts a stable token id (`<sentenceId>.t<n>`) back to an ordinal. */
  ordinalOfTokenId(tokenId: string): number | null {
    const match = /^(.*)\.t(\d+)$/.exec(tokenId);
    if (!match) return null;
    const first = this.firstOrdinalOfSentence.get(match[1] ?? "");
    if (first === undefined) return null;
    const tokenIndex = Number(match[2]);
    const sentence = this.sentence(match[1] ?? "");
    if (!sentence || tokenIndex >= sentence.sentence.tokens.length) return null;
    return first + tokenIndex;
  }

  sentenceLocation(sentenceId: string): [number, number, number] | null {
    return this.sentenceById.get(sentenceId) ?? null;
  }

  blockLocation(blockId: string): [number, number] | null {
    return this.blockById.get(blockId) ?? null;
  }

  sentence(sentenceId: string): { block: LinguisticBlock; sentence: LinguisticSentence; chapterIndex: number } | null {
    const location = this.sentenceById.get(sentenceId);
    if (!location) return null;
    const block = this.document.chapters[location[0]]?.blocks[location[1]];
    const sentence = block?.sentences[location[2]];
    return block && sentence ? { block, sentence, chapterIndex: location[0] } : null;
  }

  firstOrdinalOf(sentenceId: string): number | null {
    return this.firstOrdinalOfSentence.get(sentenceId) ?? null;
  }

  chapterRange(chapterIndex: number): [number, number] | null {
    return this.chapterRanges[chapterIndex] ?? null;
  }

  /** Distinct sentences containing the lexeme, in document order. */
  sentencesWithLexeme(lexeme: number, limit = Number.POSITIVE_INFINITY): string[] {
    const seen = new Set<string>();
    for (const ordinal of this.lexemeRefs[lexeme] ?? []) {
      const resolved = this.resolve(ordinal);
      if (resolved) seen.add(resolved.sentence.id);
      if (seen.size >= limit) break;
    }
    return [...seen];
  }
}

export function sentenceText(block: LinguisticBlock, sentence: LinguisticSentence) {
  return block.text.slice(sentence.start, sentence.end);
}
