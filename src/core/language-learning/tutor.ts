import type { KnowledgeSnapshot, LinguisticDocument } from "./model";
import type { OccurrenceIndex } from "./occurrenceIndex";
import { sentenceText } from "./occurrenceIndex";

/**
 * Integration boundary for an optional AI tutor (phase 4). No provider is
 * bundled: reading, vocabulary and statistics never depend on it. A provider
 * receives a context assembled from real document and user data.
 */
export interface TutorContext {
  documentTitle: string;
  learningLanguage: string;
  nativeLanguage: string;
  selection: string;
  surroundingText: string;
  vocabulary: Array<{ lemma: string; state: string; translation?: string | null }>;
  knownLemmaSample: string[];
}

export interface TutorProvider {
  id: string;
  isAvailable(): Promise<boolean>;
  ask(question: string, context: TutorContext, signal?: AbortSignal): Promise<string>;
}

export function buildTutorContext(args: {
  document: LinguisticDocument;
  index: OccurrenceIndex;
  snapshot: KnowledgeSnapshot;
  sentenceId: string;
  selection: string;
  nativeLanguage: string;
  knownSampleSize?: number;
}): TutorContext | null {
  const located = args.index.sentence(args.sentenceId);
  if (!located) return null;
  const { block, sentence } = located;
  const vocabulary = sentence.tokens.map((tuple) => {
    const entry = args.document.lexicon[tuple[2]];
    const record = entry ? args.snapshot.lemmas[entry.key] : undefined;
    return { lemma: entry?.lemma ?? "", state: record?.state ?? "unknown", translation: record?.translation };
  });
  const known = Object.values(args.snapshot.lemmas)
    .filter((record) => record.state === "known")
    .slice(0, args.knownSampleSize ?? 200)
    .map((record) => record.label);
  return {
    documentTitle: args.document.title,
    learningLanguage: args.document.language,
    nativeLanguage: args.nativeLanguage,
    selection: args.selection || sentenceText(block, sentence),
    surroundingText: block.text,
    vocabulary,
    knownLemmaSample: known,
  };
}
