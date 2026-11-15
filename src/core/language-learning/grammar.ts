import type { LinguisticBlock, LinguisticDocument, LinguisticSentence } from "./model";
import type { AnalyzedTokenView, GrammarAnalysis, LanguageModule } from "./languages/types";

/** Builds the token view used by grammar analyzers from stored document data. */
export function buildTokenViews(
  document: LinguisticDocument,
  block: LinguisticBlock,
  sentence: LinguisticSentence,
): AnalyzedTokenView[] {
  return sentence.tokens.map((tuple, index) => {
    const [start, end, lexeme, form] = tuple;
    const entry = document.lexicon[lexeme];
    const formEntry = document.forms[form];
    const nextStart = sentence.tokens[index + 1]?.[0] ?? sentence.end;
    const text = block.text.slice(start, end);
    return {
      text,
      lower: formEntry?.form ?? text.toLocaleLowerCase(),
      lemma: entry?.lemma ?? text,
      pos: entry?.pos,
      features: { ...(entry?.features ?? {}), ...(formEntry?.features ?? {}) },
      trailing: block.text.slice(end, nextStart),
    };
  });
}

/**
 * Structural analysis, or null when the language module has no syntax
 * capability (the UI then shows only lexical information).
 */
export function analyzeSentenceStructure(
  module: LanguageModule,
  document: LinguisticDocument,
  block: LinguisticBlock,
  sentence: LinguisticSentence,
): GrammarAnalysis | null {
  if (!module.analyzeGrammar) return null;
  return module.analyzeGrammar(buildTokenViews(document, block, sentence));
}
