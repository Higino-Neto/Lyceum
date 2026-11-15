import {
  LINGUISTIC_SCHEMA,
  LINGUISTIC_SCHEMA_VERSION,
  TOKEN_FLAG_LEMMA_ESTIMATED,
  TOKEN_FLAG_PROPER_NOUN_CANDIDATE,
  type ChapterStatistic,
  type ExpressionEntry,
  type ExpressionOccurrence,
  type GrammarFeatures,
  type LexicalEntry,
  type LinguisticBlock,
  type LinguisticBlockKind,
  type LinguisticChapter,
  type LinguisticDocument,
  type SurfaceForm,
  type TokenTuple,
} from "../model";
import type {
  AnalysisContext,
  ConstructionMatch,
  LanguageModule,
  LexemeObservation,
  SentenceTokenInput,
} from "../languages/types";
import { isCapitalized, normalizeForm } from "../languages/segmentation";
import { matchExpression } from "./expressions";

export interface BlockInput {
  kind: LinguisticBlockKind;
  level?: number;
  text: string;
}

export interface ChapterInput {
  id: string;
  href: string;
  title: string;
  blocks: BlockInput[];
}

export interface AnalyzeDocumentInput {
  documentId: string;
  title: string;
  language: string;
  chapters: ChapterInput[];
}

export interface AnalyzeOptions {
  now?: string;
  onProgress?: (progress: number) => void;
}

interface PendingSentence {
  chapterIndex: number;
  blockId: string;
  id: string;
  start: number;
  end: number;
  tokens: SentenceTokenInput[];
  ranges: Array<[number, number]>;
}

/** Turns chapter text into a fully indexed `LinguisticDocument`. */
export function analyzeDocument(
  input: AnalyzeDocumentInput,
  module: LanguageModule,
  options: AnalyzeOptions = {},
): LinguisticDocument {
  const chapters: LinguisticChapter[] = [];
  const pending: PendingSentence[] = [];
  const blockLookup = new Map<string, LinguisticBlock>();

  const attested = new Set<string>();
  const capitalizedInside = new Set<string>();
  const lowercase = new Set<string>();

  // Pass 1: structure, sentences, tokens, attested forms.
  input.chapters.forEach((chapterInput, chapterIndex) => {
    const chapter: LinguisticChapter = {
      id: chapterInput.id,
      href: chapterInput.href,
      title: chapterInput.title,
      blocks: [],
      tokenCount: 0,
    };
    let blockCounter = 0;
    for (const blockInput of chapterInput.blocks) {
      const text = blockInput.text.replace(/\s+/g, " ").trim();
      if (!text) continue;
      const block: LinguisticBlock = {
        id: `${chapter.id}.b${blockCounter}`,
        kind: blockInput.kind,
        level: blockInput.level,
        text,
        sentences: [],
      };
      blockCounter += 1;
      chapter.blocks.push(block);
      blockLookup.set(block.id, block);

      const sentenceRanges = module.segmentSentences(text);
      sentenceRanges.forEach(([start, end], sentenceIndex) => {
        const sentenceText = text.slice(start, end);
        const ranges = module.tokenize(sentenceText).map<[number, number]>(([s, e]) => [s + start, e + start]);
        const tokens: SentenceTokenInput[] = ranges.map(([s, e], index) => {
          const surface = text.slice(s, e);
          const nextStart = ranges[index + 1]?.[0] ?? end;
          return { text: surface, lower: normalizeForm(surface), index, trailing: text.slice(e, nextStart) };
        });
        for (const token of tokens) {
          attested.add(token.lower);
          if (token.index > 0 && isCapitalized(token.text)) capitalizedInside.add(token.lower);
          if (!isCapitalized(token.text)) lowercase.add(token.lower);
        }
        pending.push({
          chapterIndex,
          blockId: block.id,
          id: `${block.id}.s${sentenceIndex}`,
          start,
          end,
          tokens,
          ranges,
        });
      });
    }
    chapters.push(chapter);
  });

  const context: AnalysisContext = {
    attested: (form) => attested.has(form),
    attestedCapitalizedInside: (form) => capitalizedInside.has(form),
    attestedLowercase: (form) => lowercase.has(form),
  };

  // Pass 2: lemmatization, lexicon, forms, constructions.
  const lexicon: LexicalEntry[] = [];
  const lexemeIndex = new Map<string, number>();
  const confident = new Set<number>();
  const posVotes: Array<Map<string, number>> = [];
  const observations: LexemeObservation[][] = [];
  const forms: SurfaceForm[] = [];
  const formIndex = new Map<string, number>();
  const expressions: ExpressionEntry[] = [];
  const expressionIndex = new Map<string, number>();
  const expressionOccurrences: ExpressionOccurrence[] = [];
  const chapterCounts: Array<Map<number, number>> = chapters.map(() => new Map());
  const reflexives = new Set(module.reflexivePronouns ?? []);
  const formMatcher = module.formMatchesLemma?.bind(module);
  let totalTokens = 0;

  const registerExpression = (match: ConstructionMatch, sentenceId: string) => {
    let index = expressionIndex.get(match.key);
    if (index === undefined) {
      index = expressions.length;
      expressions.push({ key: match.key, label: match.label, kind: match.kind, note: match.note, glosses: match.glosses, count: 0 });
      expressionIndex.set(match.key, index);
    }
    const entry = expressions[index];
    if (entry) entry.count += 1;
    expressionOccurrences.push({ expression: index, sentenceId, tokens: match.tokens });
  };

  pending.forEach((sentence, sentenceNumber) => {
    const analysis = module.analyzeSentence(sentence.tokens, context);
    const tuples: TokenTuple[] = [];
    const matchable: Array<{ lower: string; lemmaLower: string }> = [];

    sentence.tokens.forEach((token, index) => {
      const result = analysis.tokens[index] ?? { lemma: token.lower };
      const lemma = result.lemma || token.lower;
      const key = module.caseSensitiveLemmas ? lemma : lemma.toLocaleLowerCase();
      let lexeme = lexemeIndex.get(key);
      if (lexeme === undefined) {
        lexeme = lexicon.length;
        lexicon.push({ key, lemma, count: 0 });
        lexemeIndex.set(key, lexeme);
        posVotes.push(new Map());
        observations.push([]);
      }
      const entry = lexicon[lexeme];
      if (entry) {
        entry.count += 1;
        if (result.lemmaFeatures) entry.features = { ...(entry.features ?? {}), ...result.lemmaFeatures };
      }
      if (!result.estimated) confident.add(lexeme);
      if (result.pos) {
        const votes = posVotes[lexeme];
        votes?.set(result.pos, (votes.get(result.pos) ?? 0) + 1);
      }
      observations[lexeme]?.push({
        previousLower: sentence.tokens[index - 1]?.lower ?? null,
        formEqualsLemma: token.lower === lemma.toLocaleLowerCase(),
      });

      const formKey = `${lexeme}|${token.lower}`;
      let form = formIndex.get(formKey);
      if (form === undefined) {
        form = forms.length;
        forms.push({ form: token.lower, lexeme, features: result.features, count: 0 });
        formIndex.set(formKey, form);
      }
      const formEntry = forms[form];
      if (formEntry) formEntry.count += 1;

      let flags = 0;
      if (result.properNounCandidate) flags |= TOKEN_FLAG_PROPER_NOUN_CANDIDATE;
      if (result.estimated) flags |= TOKEN_FLAG_LEMMA_ESTIMATED;
      const [start, end] = sentence.ranges[index] ?? [0, 0];
      tuples.push([start, end, lexeme, form, flags]);
      matchable.push({ lower: token.lower, lemmaLower: lemma.toLocaleLowerCase() });

      const counts = chapterCounts[sentence.chapterIndex];
      counts?.set(lexeme, (counts.get(lexeme) ?? 0) + 1);
      totalTokens += 1;
    });

    for (const construction of analysis.constructions) registerExpression(construction, sentence.id);
    for (const pattern of module.expressions ?? []) {
      const matched = matchExpression(pattern, matchable, reflexives, formMatcher);
      if (matched) {
        registerExpression({
          key: `expr:${pattern.label}`,
          label: pattern.label,
          kind: pattern.kind,
          tokens: matched,
          note: pattern.note,
          glosses: pattern.glosses,
        }, sentence.id);
      }
    }

    const block = blockLookup.get(sentence.blockId);
    block?.sentences.push({ id: sentence.id, start: sentence.start, end: sentence.end, tokens: tuples });
    const chapter = chapters[sentence.chapterIndex];
    if (chapter) chapter.tokenCount += tuples.length;

    if (options.onProgress && sentenceNumber % 500 === 0) {
      options.onProgress(sentenceNumber / Math.max(1, pending.length));
    }
  });

  lexicon.forEach((entry, index) => {
    const votes = posVotes[index];
    if (votes && votes.size > 0) {
      entry.pos = [...votes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    }
    if (!confident.has(index)) entry.estimated = true;
    const inferred = module.inferLexemeFeatures?.(entry.lemma, entry.pos, observations[index] ?? []);
    if (inferred) entry.features = { ...(entry.features ?? {}), ...inferred } as GrammarFeatures;
  });

  // Lexeme-level proper-noun inference (from language modules) marks tokens.
  const properLexemes = new Set<number>();
  lexicon.forEach((entry, index) => {
    if (entry.features?.properNoun === "candidate") properLexemes.add(index);
  });
  if (properLexemes.size > 0) {
    for (const chapter of chapters) {
      for (const block of chapter.blocks) {
        for (const sentence of block.sentences) {
          for (const token of sentence.tokens) {
            if (properLexemes.has(token[2])) token[4] |= TOKEN_FLAG_PROPER_NOUN_CANDIDATE;
          }
        }
      }
    }
  }

  const chapterStats: ChapterStatistic[] = chapters.map((chapter, index) => {
    const counts = chapterCounts[index] ?? new Map<number, number>();
    return {
      chapterId: chapter.id,
      tokenCount: chapter.tokenCount,
      uniqueLexemes: counts.size,
      lexemeCounts: Object.fromEntries(counts),
    };
  });

  options.onProgress?.(1);

  return {
    schema: LINGUISTIC_SCHEMA,
    schemaVersion: LINGUISTIC_SCHEMA_VERSION,
    documentId: input.documentId,
    title: input.title,
    language: module.code,
    analyzer: {
      language: module.code,
      module: module.id,
      moduleVersion: module.version,
      capabilities: module.capabilities,
    },
    createdAt: options.now ?? new Date().toISOString(),
    chapters,
    lexicon,
    forms,
    expressions,
    expressionOccurrences,
    chapterStats,
    totals: {
      tokens: totalTokens,
      lexemes: lexicon.length,
      sentences: pending.length,
      blocks: blockLookup.size,
    },
  };
}
