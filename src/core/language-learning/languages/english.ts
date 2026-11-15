import type { GrammarFeatures } from "../model";
import type {
  AnalysisContext,
  ExpressionPattern,
  LanguageModule,
  SentenceAnalysis,
  SentenceTokenInput,
  TokenAnalysis,
} from "./types";
import { isCapitalized, segmentSentences, tokenizeWords } from "./segmentation";
import { guessProperNoun } from "./generic";

const IRREGULAR = `
be:am,is,are,was,were,been,being have:has,had,having do:does,did,done,doing go:goes,went,gone,going
get:got,gotten,getting make:made,making take:took,taken,taking see:saw,seen,seeing come:came,coming
know:knew,known,knowing think:thought,thinking say:said,saying find:found,finding give:gave,given,giving
tell:told,telling leave:left,leaving put:putting run:ran,running hold:held,holding bring:brought,bringing
write:wrote,written,writing stand:stood,standing meet:met,meeting pay:paid,paying buy:bought,buying
send:sent,sending build:built,building fall:fell,fallen,falling cut:cutting sell:sold,selling
begin:began,begun,beginning speak:spoke,spoken,speaking break:broke,broken,breaking choose:chose,chosen
drive:drove,driven,driving eat:ate,eaten,eating feel:felt,feeling fight:fought,fighting fly:flew,flown,flies
forget:forgot,forgotten grow:grew,grown hear:heard keep:kept lose:lost lead:led mean:meant
read:reading ride:rode,ridden rise:rose,risen sing:sang,sung sit:sat,sitting sleep:slept
spend:spent steal:stole,stolen swim:swam,swum teach:taught throw:threw,thrown understand:understood
wake:woke,woken wear:wore,worn win:won catch:caught draw:drew,drawn drink:drank,drunk lie:lay,lain,lying
show:showed,shown hide:hid,hidden shake:shook,shaken seek:sought shoot:shot strike:struck
man:men woman:women child:children foot:feet tooth:teeth mouse:mice person:people life:lives
wife:wives knife:knives leaf:leaves half:halves self:selves
good:better,best bad:worse,worst
`;

const IRREGULAR_FORMS = new Map<string, string>();
for (const entry of IRREGULAR.split(/\s+/).filter(Boolean)) {
  const [lemma, forms] = entry.split(":");
  if (!lemma || !forms) continue;
  IRREGULAR_FORMS.set(lemma, lemma);
  for (const form of forms.split(",")) if (!IRREGULAR_FORMS.has(form)) IRREGULAR_FORMS.set(form, lemma);
}

const CLOSED: Record<string, [string, string]> = {};
for (const w of "the a an this that these those".split(" ")) CLOSED[w] = [w === "an" ? "a" : w, "DET"];
for (const w of "i you he she it we they me him her us them myself yourself himself herself itself ourselves themselves".split(" ")) CLOSED[w] = [w, "PRON"];
for (const w of "in on at by for with from to of about into over under between through during without within against among".split(" ")) CLOSED[w] = [w, "ADP"];
for (const w of "and or but nor so yet".split(" ")) CLOSED[w] = [w, "CCONJ"];
for (const w of "because although if when while since unless whether that until".split(" ")) CLOSED[w] ??= [w, "SCONJ"];
for (const w of "can could will would shall should may might must".split(" ")) CLOSED[w] = [w, "AUX"];

const ENDINGS: Array<[string, string[], GrammarFeatures]> = [
  ["ies", ["y"], { number: "pl|3sg" }],
  ["ied", ["y"], { tense: "past" }],
  ["ing", ["", "e"], { form: "gerund|participle" }],
  ["ed", ["", "e"], { tense: "past" }],
  ["es", [""], { number: "pl|3sg" }],
  ["s", [""], { number: "pl|3sg" }],
  ["er", ["", "e"], { degree: "comparative" }],
  ["est", ["", "e"], { degree: "superlative" }],
];

function lemmatize(lower: string, context: AnalysisContext): { lemma: string; features?: GrammarFeatures; estimated: boolean } {
  const irregular = IRREGULAR_FORMS.get(lower);
  if (irregular) return { lemma: irregular, estimated: false };
  for (const [suffix, replacements, features] of ENDINGS) {
    if (lower.length <= suffix.length + 2 || !lower.endsWith(suffix)) continue;
    let stem = lower.slice(0, -suffix.length);
    for (const replacement of replacements) {
      const candidate = stem + replacement;
      if (context.attested(candidate)) return { lemma: candidate, features, estimated: true };
    }
    // doubled consonant: "stopped" -> "stop"
    if (/([bdgklmnprt])\1$/.test(stem)) {
      stem = stem.slice(0, -1);
      if (context.attested(stem)) return { lemma: stem, features, estimated: true };
    }
  }
  return { lemma: lower, estimated: false };
}

const g = (en: string, pt: string) => ({ en, pt });
const phrasal = (verb: string, particle: string, pt: string, en: string): ExpressionPattern => ({
  label: `${verb} ${particle}`,
  kind: "phrasal",
  chunks: [[verb], particle.split(" ")],
  ordered: true,
  maxSpan: 5,
  glosses: g(en, pt),
});

const EXPRESSIONS: ExpressionPattern[] = [
  phrasal("give", "up", "desistir", "to stop trying"),
  phrasal("find", "out", "descobrir", "to discover"),
  phrasal("turn", "out", "acabar sendo", "to prove to be"),
  phrasal("carry", "on", "continuar", "to continue"),
  phrasal("come", "across", "deparar-se com", "to find by chance"),
  phrasal("get", "along", "dar-se bem", "to have a good relationship"),
  phrasal("look", "forward to", "aguardar ansiosamente", "to anticipate with pleasure"),
  phrasal("put", "up with", "tolerar", "to tolerate"),
  phrasal("run", "into", "encontrar por acaso", "to meet by chance"),
  phrasal("set", "up", "montar, organizar", "to establish"),
  phrasal("figure", "out", "entender, resolver", "to understand"),
  phrasal("point", "out", "salientar", "to indicate"),
  phrasal("pick", "up", "pegar, buscar", "to lift; to collect"),
  phrasal("make", "up", "inventar; fazer as pazes", "to invent; to reconcile"),
  phrasal("look", "after", "cuidar de", "to take care of"),
  phrasal("go", "on", "continuar", "to continue"),
  phrasal("take", "off", "decolar; tirar", "to leave the ground; to remove"),
  { label: "as well as", kind: "fixed", chunks: [["as", "well", "as"]], glosses: g("in addition to", "assim como") },
  { label: "in spite of", kind: "fixed", chunks: [["in", "spite", "of"]], glosses: g("despite", "apesar de") },
  { label: "by the way", kind: "fixed", chunks: [["by", "the", "way"]], glosses: g("incidentally", "a propósito") },
  { label: "at least", kind: "fixed", chunks: [["at", "least"]], glosses: g("no less than", "pelo menos") },
  { label: "of course", kind: "fixed", chunks: [["of", "course"]], glosses: g("certainly", "claro") },
  { label: "take into account", kind: "fixed", chunks: [["take"], ["into", "account"]], maxSpan: 7, glosses: g("to consider", "levar em conta") },
];

export function createEnglishModule(): LanguageModule {
  return {
    code: "en",
    id: "en-rules",
    version: 1,
    capabilities: ["tokenization", "sentence-segmentation", "lemmatization", "pos-tagging", "expressions"],
    speechLang: "en-US",
    caseSensitiveLemmas: false,
    expressions: EXPRESSIONS,
    segmentSentences: (text) => segmentSentences(text, "en"),
    tokenize: (text) => tokenizeWords(text, "en"),
    analyzeSentence(tokens: SentenceTokenInput[], context: AnalysisContext): SentenceAnalysis {
      return {
        tokens: tokens.map<TokenAnalysis>((token) => {
          const closed = CLOSED[token.lower];
          if (closed) return { lemma: closed[0], pos: closed[1] };
          if (token.lower === "i" || (isCapitalized(token.text) && guessProperNoun(token, context))) {
            return { lemma: token.lower, properNounCandidate: token.lower !== "i", pos: token.lower === "i" ? "PRON" : "PROPN" };
          }
          const result = lemmatize(token.lower, context);
          return { lemma: result.lemma, features: result.features, estimated: result.estimated };
        }),
        constructions: [],
      };
    },
  };
}
