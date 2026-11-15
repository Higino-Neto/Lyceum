import type { GrammarFeatures } from "../model";
import type {
  AnalysisContext,
  AnalyzedTokenView,
  ClauseAnalysis,
  ConstructionMatch,
  GrammarAnalysis,
  GrammarNote,
  LanguageModule,
  LexemeObservation,
  RoleAnalysis,
  SentenceAnalysis,
  SentenceTokenInput,
  TokenAnalysis,
} from "./types";
import { isCapitalized, segmentSentences, tokenizeWords } from "./segmentation";
import {
  AUXILIARIES,
  CLOSED_CLASS,
  GERMAN_ABBREVIATIONS,
  GERMAN_EXPRESSIONS,
  INSEPARABLE_PREFIXES,
  KONJUNKTIV_II_COMMON,
  MODAL_PARTICLES,
  MODAL_VERBS,
  PREPOSITION_CASE,
  SEPARABLE_PARTICLES,
  SEPARABLE_PARTICLE_SET,
  STRONG_PARTICIPLES,
  SUBORDINATORS,
  VERB_FORMS,
} from "./german-data";

const REFLEXIVES = ["sich", "mich", "dich", "uns", "euch"];

function capitalize(value: string) {
  return value.charAt(0).toLocaleUpperCase() + value.slice(1);
}

const COORDINATORS = new Set(["und", "oder", "aber", "sondern", "denn"]);

function isClauseBoundary(trailing: string) {
  return /[,;:.!?()"«»„“”–—]/.test(trailing);
}

/** A token ends a clause before punctuation or before a coordinating conjunction. */
function endsClause(tokens: SentenceTokenInput[], index: number) {
  const token = tokens[index];
  if (!token) return true;
  if (index === tokens.length - 1 || isClauseBoundary(token.trailing)) return true;
  const next = tokens[index + 1];
  return next !== undefined && COORDINATORS.has(next.lower);
}

/** Looks up a verb form, also through separable and inseparable prefixes. */
function lookupVerb(lower: string): { lemma: string; features: GrammarFeatures } | null {
  const direct = VERB_FORMS.get(lower);
  if (direct) return direct;

  for (const particle of SEPARABLE_PARTICLES) {
    if (!lower.startsWith(particle) || lower.length <= particle.length + 3) continue;
    const rest = lower.slice(particle.length);
    // zu-infinitive: "aufzustehen"
    if (rest.startsWith("zu")) {
      const inner = VERB_FORMS.get(rest.slice(2));
      if (inner?.features.form === "infinitive") {
        return { lemma: particle + inner.lemma, features: { form: "zu-infinitive" } };
      }
    }
    const inner = VERB_FORMS.get(rest);
    if (inner && (inner.features.form === "participle" || inner.features.form === "infinitive")) {
      return { lemma: particle + inner.lemma, features: inner.features };
    }
  }

  for (const prefix of INSEPARABLE_PREFIXES) {
    if (!lower.startsWith(prefix) || lower.length <= prefix.length + 3) continue;
    const rest = lower.slice(prefix.length);
    const participle = STRONG_PARTICIPLES.get(`ge${rest}`);
    if (participle) return { lemma: prefix + participle, features: { form: "participle" } };
    const inner = VERB_FORMS.get(rest);
    if (inner && inner.features.form !== "participle" && !AUXILIARIES.has(inner.lemma) && !MODAL_VERBS.has(inner.lemma)) {
      return { lemma: prefix + inner.lemma, features: inner.features };
    }
  }
  return null;
}

const REGULAR_ENDINGS: Array<[string, GrammarFeatures]> = [
  ["test", { form: "finite", tense: "pret", person: "2sg" }],
  ["ten", { form: "finite", tense: "pret", person: "1pl|3pl" }],
  ["tet", { form: "finite", tense: "pret", person: "2pl" }],
  ["te", { form: "finite", tense: "pret", person: "1sg|3sg" }],
  ["st", { form: "finite", tense: "pres", person: "2sg" }],
  ["et", { form: "finite", tense: "pres", person: "3sg|2pl" }],
  ["t", { form: "finite", tense: "pres", person: "3sg|2pl" }],
  ["e", { form: "finite", tense: "pres", person: "1sg" }],
  ["en", { form: "finite|infinitive", tense: "pres", person: "1pl|3pl" }],
];

/** Weak verbs: accept the infinitive only when the document attests it. */
function lemmatizeRegularVerb(lower: string, context: AnalysisContext): { lemma: string; features: GrammarFeatures } | null {
  // Participle: ge...t / particle+ge...t
  const participleMatch = /^(.*?)ge(.+?)e?t$/.exec(lower);
  if (participleMatch) {
    const [, prefix = "", stem = ""] = participleMatch;
    if (prefix === "" || SEPARABLE_PARTICLE_SET.has(prefix)) {
      const infinitive = `${prefix}${stem}en`;
      if (stem.length >= 2 && context.attested(infinitive)) {
        return { lemma: infinitive, features: { form: "participle" } };
      }
    }
  }
  for (const [ending, features] of REGULAR_ENDINGS) {
    if (lower.length <= ending.length + 2 || !lower.endsWith(ending)) continue;
    const stem = lower.slice(0, -ending.length);
    for (const infinitive of [`${stem}en`, `${stem}n`]) {
      if (infinitive !== lower && context.attested(infinitive)) {
        return { lemma: infinitive, features };
      }
    }
  }
  return null;
}

const NOUN_SUFFIXES: Array<[string, string]> = [
  ["innen", "in"], ["nen", ""], ["en", ""], ["ern", ""], ["er", ""], ["es", ""], ["n", ""], ["e", ""], ["s", ""],
];

function removeUmlaut(value: string) {
  const index = Math.max(value.lastIndexOf("ä"), value.lastIndexOf("ö"), value.lastIndexOf("ü"));
  if (index < 0) return null;
  const replacement = { ä: "a", ö: "o", ü: "u" }[value[index] as "ä" | "ö" | "ü"];
  return value.slice(0, index) + replacement + value.slice(index + 1);
}

function lemmatizeNoun(lower: string, context: AnalysisContext): { lemma: string; inflected: boolean } {
  for (const [suffix, replacement] of NOUN_SUFFIXES) {
    if (lower.length <= suffix.length + 2 || !lower.endsWith(suffix)) continue;
    const base = lower.slice(0, -suffix.length) + replacement;
    const candidates = [base];
    const deUmlauted = removeUmlaut(base);
    if (deUmlauted && (suffix === "er" || suffix === "e" || suffix === "ern" || suffix === "en")) candidates.push(deUmlauted);
    for (const candidate of candidates) {
      if (context.attestedCapitalizedInside(candidate)) return { lemma: candidate, inflected: true };
    }
  }
  return { lemma: lower, inflected: false };
}

/** Per-document cache: attestation differs between documents. */
const compoundCaches = new WeakMap<AnalysisContext, Map<string, string | null>>();

function analyzeCompound(lower: string, context: AnalysisContext): string | null {
  if (lower.length < 6) return null;
  let compoundCache = compoundCaches.get(context);
  if (!compoundCache) {
    compoundCache = new Map();
    compoundCaches.set(context, compoundCache);
  }
  const cached = compoundCache.get(lower);
  if (cached !== undefined) return cached;
  let result: string | null = null;
  for (let split = lower.length - 3; split >= 3 && !result; split -= 1) {
    const head = lower.slice(split);
    if (!context.attestedCapitalizedInside(head)) continue;
    let modifier = lower.slice(0, split);
    for (const linker of ["", "s", "es", "n", "en"]) {
      if (linker && !modifier.endsWith(linker)) continue;
      const candidate = linker ? modifier.slice(0, -linker.length) : modifier;
      if (candidate.length >= 3 && context.attested(candidate)) {
        modifier = candidate;
        result = `${capitalize(modifier)} + ${capitalize(head)}`;
        break;
      }
    }
  }
  compoundCache.set(lower, result);
  return result;
}

function analyzeToken(
  token: SentenceTokenInput,
  previous: SentenceTokenInput | undefined,
  next: SentenceTokenInput | undefined,
  context: AnalysisContext,
): TokenAnalysis {
  const { lower, text } = token;
  const capitalizedInside = isCapitalized(text) && token.index > 0;
  // Sentence-initial capitals are nouns when the form is capitalized elsewhere
  // or never written in lower case anywhere in the document.
  const sentenceInitialNoun = token.index === 0 && isCapitalized(text)
    && !CLOSED_CLASS.has(lower) && !VERB_FORMS.has(lower)
    && (context.attestedCapitalizedInside(lower) || !context.attestedLowercase(lower));

  if (capitalizedInside && lower !== "sie" && lower !== "ihnen" && lower !== "ihr" || sentenceInitialNoun) {
    const noun = lemmatizeNoun(lower, context);
    const compound = analyzeCompound(noun.lemma, context);
    return {
      lemma: capitalize(noun.lemma),
      pos: "NOUN",
      estimated: noun.inflected,
      features: noun.inflected ? { number: "pl|inflected" } : undefined,
      lemmaFeatures: compound ? { compound } : undefined,
      // German capitalizes all nouns: proper-noun candidates are decided
      // document-wide in inferLexemeFeatures, not from capitalization.
      properNounCandidate: false,
    };
  }

  // Ambiguous "sein"/"ihr": possessive before a noun, otherwise verb/pronoun.
  if (lower === "sein" || lower === "ihr") {
    const beforeNoun = next !== undefined && isCapitalized(next.text);
    if (beforeNoun) return { lemma: lower, pos: "DET", features: { determiner: "possessive", readings: "nom.m nom.n acc.n" } };
    if (lower === "sein") return { lemma: "sein", pos: "AUX", features: { form: "infinitive" } };
    return { lemma: "ihr", pos: "PRON", features: { case: "nom|dat", person: "2|3", number: "pl|sg" } };
  }

  const closed = CLOSED_CLASS.get(lower);
  if (closed) {
    const features: GrammarFeatures = { ...(closed.features ?? {}) };
    let pos = closed.pos;
    if (MODAL_PARTICLES.has(lower) && previous) features.modalParticle = "possible";
    // Article after a comma is likely a relative pronoun.
    if (pos === "DET" && closed.lemma === "der" && previous && /,\s*$/.test(previous.trailing) && !(next && isCapitalized(next.text))) {
      pos = "PRON";
      features.relative = "likely";
    }
    return { lemma: closed.lemma, pos, features };
  }

  const verb = lookupVerb(lower);
  if (verb) {
    const auxiliary = AUXILIARIES.has(verb.lemma) || MODAL_VERBS.has(verb.lemma);
    const features: GrammarFeatures = { ...verb.features };
    if (KONJUNKTIV_II_COMMON.has(lower)) features.mood = "subjunctive-ii";
    if (features.tense === "subj2") features.mood = "subjunctive-ii";
    if (features.tense === "subj1") features.mood = "subjunctive-i";
    return { lemma: verb.lemma, pos: auxiliary ? "AUX" : "VERB", features };
  }

  const regular = lemmatizeRegularVerb(lower, context);
  if (regular) {
    return { lemma: regular.lemma, pos: "VERB", features: regular.features, estimated: true };
  }

  // Attributive adjective between a determiner and a noun.
  if (next && isCapitalized(next.text) && previous && /^(e|en|em|er|es)$/.test(lower.match(/(e|en|em|er|es)$/)?.[0] ?? "")) {
    const previousEntry = CLOSED_CLASS.get(previous.lower);
    const ending = /(em|en|er|es|e)$/.exec(lower)?.[1] ?? "";
    const base = lower.slice(0, -ending.length);
    if (previousEntry?.pos === "DET" || previousEntry?.pos === "ADP") {
      const declension = previousEntry.pos === "ADP"
        ? "strong"
        : previousEntry.features?.determiner === "definite" || previousEntry.features?.determiner === "demonstrative"
          ? "weak"
          : "mixed";
      const attestedBase = base.length >= 2 && context.attested(base);
      return {
        lemma: attestedBase ? base : lower,
        pos: "ADJ",
        estimated: attestedBase,
        features: { declension, ending: `-${ending}` },
      };
    }
  }

  return { lemma: lower, estimated: false };
}

function detectSeparableVerbs(tokens: SentenceTokenInput[], analyses: TokenAnalysis[]): ConstructionMatch[] {
  const matches: ConstructionMatch[] = [];
  let clauseStart = 0;
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token) continue;
    const isLast = endsClause(tokens, index);
    if (isLast) {
      const analysis = analyses[index];
      const clauseHasSubordinator = tokens.slice(clauseStart, index).some((t) => SUBORDINATORS.has(t.lower) && t.lower !== "als" && t.lower !== "wie");
      if (analysis && SEPARABLE_PARTICLE_SET.has(token.lower) && !clauseHasSubordinator && index > clauseStart) {
        for (let v = clauseStart; v < index; v += 1) {
          const verb = analyses[v];
          if (!verb || verb.pos !== "VERB" || !verb.features?.form?.includes("finite")) continue;
          if (!/(en|n)$/.test(verb.lemma)) break;
          const compound = token.lower + verb.lemma;
          verb.lemma = compound;
          verb.estimated = true;
          verb.features = { ...verb.features, separable: token.lower };
          analysis.pos = "PTKVZ";
          analysis.features = { ...(analysis.features ?? {}), separableOf: compound };
          matches.push({
            key: `expr:${compound}`,
            label: compound,
            kind: "separable",
            tokens: [v, index],
            note: "expr.separable",
          });
          break;
        }
      }
      clauseStart = COORDINATORS.has(tokens[index + 1]?.lower ?? "") ? index + 2 : index + 1;
    }
  }
  return matches;
}

function detectReflexive(tokens: SentenceTokenInput[], analyses: TokenAnalysis[]): ConstructionMatch[] {
  const matches: ConstructionMatch[] = [];
  let clauseStart = 0;
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token) continue;
    const isLast = endsClause(tokens, index);
    if (isLast) {
      const range = Array.from({ length: index - clauseStart + 1 }, (_, i) => clauseStart + i);
      const pronoun = range.find((i) => tokens[i]?.lower === "sich");
      if (pronoun !== undefined) {
        // The reflexive pronoun belongs to the nearest lexical verb of its clause.
        const verbIndex = range
          .filter((i) => analyses[i]?.pos === "VERB")
          .sort((a, b) => Math.abs(a - pronoun) - Math.abs(b - pronoun))[0];
        const verb = verbIndex === undefined ? undefined : analyses[verbIndex];
        if (verb && verbIndex !== undefined) {
          const label = `sich ${verb.lemma}`;
          matches.push({ key: `expr:${label}`, label, kind: "reflexive", tokens: [pronoun, verbIndex].sort((a, b) => a - b), note: "expr.reflexive" });
        }
      }
      clauseStart = COORDINATORS.has(tokens[index + 1]?.lower ?? "") ? index + 2 : index + 1;
    }
  }
  return matches;
}

function parseReadings(readings: string | undefined) {
  return (readings ?? "").split(" ").filter(Boolean);
}

/** Rule-based, explicitly uncertain structural analysis of one sentence. */
export function analyzeGermanGrammar(tokens: AnalyzedTokenView[]): GrammarAnalysis {
  const clauses: ClauseAnalysis[] = [];
  const roles: RoleAnalysis[] = [];
  const notes: GrammarNote[] = [];

  let start = 0;
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token) continue;
    if (index === tokens.length - 1 || /[,;:]/.test(token.trailing)) {
      const first = tokens[start];
      const isSubordinate = first !== undefined && first.pos === "SCONJ";
      const isRelative = first !== undefined && first.pos === "PRON" && first.features?.relative === "likely";
      const isInfinitive = tokens.slice(start, index + 1).some((t, i, all) => t.lower === "zu" && all[i + 1]?.features?.form === "infinitive")
        && !tokens.slice(start, index + 1).some((t) => t.features?.form?.includes("finite"));
      const clause: ClauseAnalysis = {
        type: isSubordinate ? "subordinate" : isRelative ? "relative" : isInfinitive ? "infinitive" : "main",
        start,
        end: index,
        subordinator: isSubordinate || isRelative ? start : undefined,
      };
      const finiteCandidates: number[] = [];
      for (let i = start; i <= index; i += 1) {
        const form = tokens[i]?.features?.form ?? "";
        if ((tokens[i]?.pos === "VERB" || tokens[i]?.pos === "AUX") && form.includes("finite") && !form.includes("infinitive")) finiteCandidates.push(i);
      }
      if (clause.type === "main") clause.finiteVerb = finiteCandidates[0];
      if (clause.type === "subordinate" || clause.type === "relative") clause.finiteVerb = finiteCandidates[finiteCandidates.length - 1];
      clauses.push(clause);

      if (clause.finiteVerb !== undefined) {
        roles.push({ role: "finite-verb", tokens: [clause.finiteVerb], confidence: "likely" });
        const position = clause.finiteVerb - start;
        const previousClause = clauses[clauses.length - 2];
        if (clause.type === "main" && position === 0 && previousClause && previousClause.type !== "main") {
          notes.push({ code: "grammar.verbAfterClause", tokens: [clause.finiteVerb] });
        } else if (clause.type === "main" && position <= 3) {
          notes.push({ code: "grammar.verbSecond", tokens: [clause.finiteVerb] });
        } else if (clause.type === "subordinate") {
          notes.push({ code: "grammar.verbFinal", params: { subordinator: first?.text ?? "" }, tokens: [clause.finiteVerb] });
        } else if (clause.type === "relative") {
          notes.push({ code: "grammar.relativeClause", tokens: [start, clause.finiteVerb] });
        }
      }
      if (clause.subordinator !== undefined) roles.push({ role: "subordinator", tokens: [clause.subordinator], confidence: "likely" });

      // Verb complements at clause end (participle / infinitive after a finite auxiliary or modal).
      const finite = clause.finiteVerb === undefined ? undefined : tokens[clause.finiteVerb];
      for (let i = start; i <= index; i += 1) {
        const t = tokens[i];
        if (!t || i === clause.finiteVerb) continue;
        if (t.pos === "PTKVZ") roles.push({ role: "separable-particle", tokens: [i], confidence: "likely" });
        const form = t.features?.form ?? "";
        if ((form === "participle" || form === "infinitive") && finite) {
          roles.push({ role: "verb-complement", tokens: [i], confidence: "possible" });
          if (form === "participle" && finite.lemma === "werden") notes.push({ code: "grammar.passive", tokens: [clause.finiteVerb ?? i, i] });
          else if (form === "participle" && (finite.lemma === "haben" || finite.lemma === "sein")) notes.push({ code: "grammar.perfect", params: { auxiliary: finite.lemma }, tokens: [clause.finiteVerb ?? i, i] });
          else if (form === "infinitive" && finite.lemma === "werden") notes.push({ code: "grammar.future", tokens: [clause.finiteVerb ?? i, i] });
          else if (form === "infinitive" && MODAL_VERBS.has(finite.lemma)) notes.push({ code: "grammar.modal", params: { modal: finite.lemma }, tokens: [clause.finiteVerb ?? i, i] });
        }
      }

      // Noun phrases: determiner (+ adjectives) + noun, with case readings.
      for (let i = start; i <= index; i += 1) {
        const t = tokens[i];
        if (!t) continue;
        if (t.pos === "PRON" && t.features?.case) {
          const cases = t.features.case.split("|");
          if (cases.length === 1 && cases[0] === "nom") roles.push({ role: "subject", tokens: [i], confidence: "likely", features: { case: "nom" } });
          else if (cases.length === 1 && cases[0] === "acc") roles.push({ role: "direct-object", tokens: [i], confidence: "likely", features: { case: "acc" } });
          else if (cases.length === 1 && cases[0] === "dat") roles.push({ role: "indirect-object", tokens: [i], confidence: "possible", features: { case: "dat" } });
          continue;
        }
        if (t.pos !== "DET") continue;
        let end = i + 1;
        while (end <= index && tokens[end]?.pos === "ADJ") end += 1;
        if (tokens[end]?.pos !== "NOUN") continue;
        const phrase = Array.from({ length: end - i + 1 }, (_, k) => i + k);
        const previousToken = tokens[i - 1];
        let readings = parseReadings(t.features?.readings);
        const nounGender = tokens[end]?.features?.gender;
        if (nounGender && tokens[end]?.lemma === tokens[end]?.text) readings = readings.filter((r) => r.endsWith(`.${nounGender}`) || r.endsWith(".pl"));
        if (previousToken?.pos === "ADP") {
          const governs = PREPOSITION_CASE[previousToken.lemma]?.split("|") ?? [];
          const filtered = readings.filter((r) => governs.some((c) => r.startsWith(c)));
          if (filtered.length) readings = filtered;
          roles.push({
            role: "prepositional-phrase",
            tokens: [i - 1, ...phrase],
            confidence: "likely",
            features: { governs: PREPOSITION_CASE[previousToken.lemma] ?? "", readings: readings.join(" ") },
            note: {
              code: (PREPOSITION_CASE[previousToken.lemma] ?? "").includes("|") ? "grammar.twoWayPreposition" : "grammar.prepositionCase",
              params: { preposition: previousToken.text, case: PREPOSITION_CASE[previousToken.lemma] ?? "" },
            },
          });
          i = end;
          continue;
        }
        const cases = Array.from(new Set(readings.map((r) => r.split(".")[0] ?? "")));
        const adjective = tokens[i + 1]?.pos === "ADJ" ? tokens[i + 1] : undefined;
        if (adjective?.features?.declension) {
          notes.push({ code: "grammar.adjectiveDeclension", params: { adjective: adjective.text, declension: adjective.features.declension, ending: adjective.features.ending ?? "" }, tokens: [i + 1] });
        }
        if (cases.length === 1) {
          const onlyCase = cases[0];
          const role = onlyCase === "nom" ? "subject" : onlyCase === "acc" ? "direct-object" : onlyCase === "dat" ? "indirect-object" : null;
          if (role) roles.push({ role, tokens: phrase, confidence: "likely", features: { case: onlyCase ?? "", readings: readings.join(" ") }, note: { code: `grammar.case.${onlyCase}`, params: { article: t.text } } });
          if (onlyCase === "gen") notes.push({ code: "grammar.case.gen", params: { article: t.text }, tokens: phrase });
        } else if (cases.length > 1) {
          notes.push({ code: "grammar.caseAmbiguous", params: { article: t.text, cases: cases.join(", ") }, tokens: phrase });
        }
        i = end;
      }
      start = index + 1;
    }
  }

  for (let i = 0; i < tokens.length; i += 1) {
    const t = tokens[i];
    if (t?.features?.mood === "subjunctive-ii") notes.push({ code: "grammar.konjunktiv2", params: { form: t.text }, tokens: [i] });
    if (t?.features?.mood === "subjunctive-i") notes.push({ code: "grammar.konjunktiv1", params: { form: t.text }, tokens: [i] });
    if (t?.features?.modalParticle) notes.push({ code: "grammar.modalParticle", params: { particle: t.text }, tokens: [i] });
  }

  return { clauses, roles, notes };
}

/**
 * Infers noun gender from article co-occurrence across the document.
 * Only singular-looking occurrences (form equals lemma) are counted.
 */
const DETERMINER_LIKE = new Set([
  ...Array.from(CLOSED_CLASS.entries()).filter(([, entry]) => entry.pos === "DET").map(([form]) => form),
  "zum", "zur", "im", "ins", "am", "ans", "beim", "vom", "aufs", "fürs", "durchs", "übers", "sein", "ihr",
]);

/**
 * A noun is a proper-noun candidate when none of its singular occurrences in
 * the whole document follows an article or determiner ("Anna", "Berlin"),
 * unlike common nouns ("die Brücke").
 */
export function isGermanProperNounCandidate(observations: LexemeObservation[]): boolean {
  const singular = observations.filter((observation) => observation.formEqualsLemma);
  if (singular.length === 0) return false;
  return singular.every((observation) => !observation.previousLower || !DETERMINER_LIKE.has(observation.previousLower));
}

export function inferGermanNounGender(observations: LexemeObservation[]): GrammarFeatures | null {
  const evidence: Record<string, Record<"m" | "f" | "n", number>> = {
    das: { m: 0, f: 0, n: 1 }, eine: { m: 0, f: 1, n: 0 }, einen: { m: 1, f: 0, n: 0 },
    die: { m: 0, f: 0.6, n: 0 }, den: { m: 0.6, f: 0, n: 0 }, ein: { m: 0.5, f: 0, n: 0.5 },
    einem: { m: 0.5, f: 0, n: 0.5 }, dem: { m: 0.5, f: 0, n: 0.5 }, des: { m: 0.5, f: 0, n: 0.5 },
    einer: { m: 0, f: 1, n: 0 }, der: { m: 0.5, f: 0.5, n: 0 },
    keine: { m: 0, f: 1, n: 0 }, keinen: { m: 1, f: 0, n: 0 }, dieses: { m: 0.3, f: 0, n: 0.7 },
    diese: { m: 0, f: 0.6, n: 0 }, dieser: { m: 0.5, f: 0.5, n: 0 }, diesen: { m: 0.6, f: 0, n: 0 },
  };
  const score = { m: 0, f: 0, n: 0 };
  let samples = 0;
  for (const observation of observations) {
    if (!observation.formEqualsLemma || !observation.previousLower) continue;
    const weights = evidence[observation.previousLower];
    if (!weights) continue;
    samples += 1;
    score.m += weights.m;
    score.f += weights.f;
    score.n += weights.n;
  }
  if (samples === 0) return null;
  const ranked = (Object.entries(score) as Array<["m" | "f" | "n", number]>).sort((a, b) => b[1] - a[1]);
  const [best, second] = ranked;
  if (!best || best[1] < 1 || (second && best[1] < second[1] * 1.8)) return null;
  return { gender: best[0], genderSource: "document" };
}

/** Regular (weak) inflection check used for expression matching only. */
export function germanFormMatchesLemma(lowerForm: string, lemma: string): boolean {
  if (!lemma.endsWith("en") || lemma.length < 4) return false;
  const stem = lemma.slice(0, -2);
  if (lowerForm === `ge${stem}t`) return true;
  if (!lowerForm.startsWith(stem)) return false;
  return ["e", "st", "t", "et", "en", "te", "test", "ten", "tet"].includes(lowerForm.slice(stem.length));
}

export function createGermanModule(): LanguageModule {
  return {
    code: "de",
    id: "de-rules",
    version: 2,
    capabilities: ["tokenization", "sentence-segmentation", "lemmatization", "pos-tagging", "morphology", "expressions", "syntax"],
    speechLang: "de-DE",
    caseSensitiveLemmas: true,
    reflexivePronouns: REFLEXIVES,
    expressions: GERMAN_EXPRESSIONS,
    segmentSentences: (text) => segmentSentences(text, "de", GERMAN_ABBREVIATIONS),
    tokenize: (text) => tokenizeWords(text, "de"),
    analyzeSentence(tokens: SentenceTokenInput[], context: AnalysisContext): SentenceAnalysis {
      const analyses = tokens.map((token, index) => analyzeToken(token, tokens[index - 1], tokens[index + 1], context));
      const constructions = [
        ...detectSeparableVerbs(tokens, analyses),
        ...detectReflexive(tokens, analyses),
      ];
      return { tokens: analyses, constructions };
    },
    analyzeGrammar: analyzeGermanGrammar,
    formMatchesLemma: germanFormMatchesLemma,
    inferLexemeFeatures(_lemma, pos, observations) {
      if (pos !== "NOUN") return null;
      const features: GrammarFeatures = { ...(inferGermanNounGender(observations) ?? {}) };
      if (!features.gender && isGermanProperNounCandidate(observations)) features.properNoun = "candidate";
      return Object.keys(features).length > 0 ? features : null;
    },
  };
}
