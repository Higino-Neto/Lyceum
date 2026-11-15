import type { LanguageCapability } from "../model";
import type {
  AnalysisContext,
  LanguageModule,
  SentenceAnalysis,
  SentenceTokenInput,
  TokenAnalysis,
} from "./types";
import { isCapitalized, segmentSentences, tokenizeWords } from "./segmentation";

/**
 * Plural/feminine suffix rules that are only applied when the shorter form is
 * attested in the same document. This keeps the guess data-driven: "casas"
 * becomes "casa" only if the book also contains "casa".
 */
const ATTESTED_SUFFIX_RULES: Record<string, Array<[string, string]>> = {
  es: [["es", ""], ["s", ""]],
  pt: [["ões", "ão"], ["ães", "ão"], ["is", "l"], ["ns", "m"], ["es", ""], ["s", ""]],
  fr: [["aux", "al"], ["x", ""], ["s", ""]],
  it: [["i", "o"], ["e", "a"]],
  nl: [["en", ""], ["s", ""]],
};

/**
 * Function words and common invariable words that end like plurals. Without
 * this, attestation alone turns "vous" into "vou" or "dans" into "dan".
 */
const INVARIABLE: Record<string, Set<string>> = {
  fr: new Set(("vous nous mais dans sous plus moins très après depuis alors toujours jamais puis pas tous ceux deux trois " +
    "six dix mieux ailleurs parfois autrefois fois temps corps bras pays prix voix choix fils gens cas dos os avis souris " +
    "tandis lors dès vers chez sans selon hors parmi jadis exprès gros bas las mis pris assis surpris dessous dessus " +
    "auprès près thé ainsi aussi aux des les mes tes ses ces nos vos leurs quels quelles quelques plusieurs certains " +
    "certaines autres mêmes heureux mieux vieux faux doux roux jaloux deux yeux cieux jeux feux lieux voeux vœux " +
    "es suis avais avons avez étais était fais fait vais dis dit mis peux veux sais vis crois dois bois").split(" ")),
  es: new Set("más menos después antes además entonces siempre jamás tras mientras pues dos tres seis tus sus mis los las unos unas nosotros vosotros ellos ellas lunes martes miércoles jueves viernes crisis análisis tesis virus".split(" ")),
  pt: new Set("mais menos depois antes nós vós pois dois três seis às aos dos das nos nas pelos pelas meus teus seus suas minhas tuas nossos vossos eles elas lápis ônibus vírus tênis atrás através talvez".split(" ")),
  it: new Set("di e il la che per un non una del con si da le della lo gli ma come al anche più sono nel ha era mi questo io lui lei poi già mai qui così".split(" ")),
  nl: new Set("dan als ons ze zijn mijn hun ook alles iets niets mensen".split(" ")),
};

/** Elided articles/pronouns split off as their own tokens ("l'écran" → "l'" + "écran"). */
const ELISION: Record<string, { pattern: RegExp; lemmas: Record<string, string> }> = {
  fr: {
    pattern: /^(jusqu|lorsqu|puisqu|quoiqu|presqu|qu|l|d|j|m|n|s|t|c)['’](?=\p{L})/iu,
    lemmas: { "l'": "le", "d'": "de", "j'": "je", "m'": "me", "n'": "ne", "s'": "se", "t'": "te", "c'": "ce", "qu'": "que", "jusqu'": "jusque", "lorsqu'": "lorsque", "puisqu'": "puisque", "quoiqu'": "quoique", "presqu'": "presque" },
  },
  it: {
    pattern: /^(dell|dall|nell|sull|all|coll|quest|quell|un|l|c|d|s|m|t|v|n)['’](?=\p{L})/iu,
    lemmas: { "l'": "lo", "un'": "una", "dell'": "dello", "dall'": "dallo", "nell'": "nello", "sull'": "sullo", "all'": "allo", "coll'": "collo", "quest'": "questo", "quell'": "quello", "c'": "ci", "d'": "di", "s'": "si", "m'": "mi", "t'": "ti", "v'": "vi", "n'": "ne" },
  },
  ca: {
    pattern: /^(l|d|m|t|s|n)['’](?=\p{L})/iu,
    lemmas: { "l'": "el", "d'": "de", "m'": "em", "t'": "et", "s'": "es", "n'": "en" },
  },
};

export function splitElisions(text: string, ranges: Array<[number, number]>, language: string): Array<[number, number]> {
  const rule = ELISION[language];
  if (!rule) return ranges;
  const result: Array<[number, number]> = [];
  for (const [start, end] of ranges) {
    const match = rule.pattern.exec(text.slice(start, end));
    if (match && start + match[0].length < end) {
      result.push([start, start + match[0].length], [start + match[0].length, end]);
    } else {
      result.push([start, end]);
    }
  }
  return result;
}

export function guessProperNoun(
  token: SentenceTokenInput,
  context: AnalysisContext,
): boolean {
  return token.index > 0 && isCapitalized(token.text) && !context.attestedLowercase(token.lower);
}

export function attestedSuffixLemma(
  lower: string,
  rules: Array<[string, string]>,
  context: AnalysisContext,
): string | null {
  for (const [suffix, replacement] of rules) {
    if (lower.length > suffix.length + 2 && lower.endsWith(suffix)) {
      const candidate = lower.slice(0, -suffix.length) + replacement;
      if (candidate !== lower && context.attested(candidate)) return candidate;
    }
  }
  return null;
}

export function createGenericModule(code: string): LanguageModule {
  const language = code.toLowerCase().split("-")[0] || "und";
  const rules = ATTESTED_SUFFIX_RULES[language];
  const invariable = INVARIABLE[language];
  const elision = ELISION[language];
  const capabilities: LanguageCapability[] = ["tokenization", "sentence-segmentation"];
  if (rules) capabilities.push("lemmatization");

  return {
    code: language,
    id: rules ? `${language}-attested-suffix` : "generic",
    // v2: elision splitting and protected invariable words.
    version: 2,
    capabilities,
    speechLang: language,
    caseSensitiveLemmas: false,
    segmentSentences: (text) => segmentSentences(text, language),
    tokenize: (text) => splitElisions(text, tokenizeWords(text, language), language),
    analyzeSentence(tokens: SentenceTokenInput[], context: AnalysisContext): SentenceAnalysis {
      return {
        tokens: tokens.map<TokenAnalysis>((token) => {
          const lower = token.lower.replace(/’/g, "'");
          const elided = elision?.lemmas[lower];
          if (elided) return { lemma: elided, estimated: false, properNounCandidate: false };
          const attestedLemma = rules && !invariable?.has(lower) ? attestedSuffixLemma(lower, rules, context) : null;
          return {
            lemma: attestedLemma ?? lower,
            estimated: attestedLemma !== null,
            properNounCandidate: guessProperNoun(token, context),
          };
        }),
        constructions: [],
      };
    },
  };
}
