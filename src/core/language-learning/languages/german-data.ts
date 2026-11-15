import type { GrammarFeatures } from "../model";
import type { ExpressionPattern } from "./types";

/**
 * Closed-class and high-frequency German lexical data. Kept as compact tables
 * so the module stays dependency-free; open-class words are analysed by the
 * rules in `german.ts` with document attestation.
 */

export interface ClosedEntry {
  lemma: string;
  pos: string;
  features?: GrammarFeatures;
}

/** Case/gender/number readings, space separated ("nom.m dat.f gen.pl"). */
const DER_WORD_ENDINGS: Record<string, string> = {
  er: "nom.m dat.f gen.f gen.pl",
  e: "nom.f acc.f nom.pl acc.pl",
  es: "nom.n acc.n gen.m gen.n",
  en: "acc.m dat.pl",
  em: "dat.m dat.n",
};

const EIN_WORD_ENDINGS: Record<string, string> = {
  "": "nom.m nom.n acc.n",
  e: "nom.f acc.f nom.pl acc.pl",
  en: "acc.m dat.pl",
  em: "dat.m dat.n",
  er: "dat.f gen.f gen.pl",
  es: "gen.m gen.n",
};

export const CLOSED_CLASS = new Map<string, ClosedEntry>();

function add(form: string, entry: ClosedEntry) {
  if (!CLOSED_CLASS.has(form)) CLOSED_CLASS.set(form, entry);
}

// Definite article (also relative/demonstrative pronoun in context).
const DEFINITE: Record<string, string> = {
  der: "nom.m dat.f gen.f gen.pl",
  die: "nom.f acc.f nom.pl acc.pl",
  das: "nom.n acc.n",
  den: "acc.m dat.pl",
  dem: "dat.m dat.n",
  des: "gen.m gen.n",
};
for (const [form, readings] of Object.entries(DEFINITE)) {
  add(form, { lemma: "der", pos: "DET", features: { determiner: "definite", readings } });
}

for (const stem of ["ein", "kein", "mein", "dein", "sein", "ihr", "unser", "euer"]) {
  for (const [ending, readings] of Object.entries(EIN_WORD_ENDINGS)) {
    const form = stem === "euer" && ending ? `eur${ending}` : `${stem}${ending}`;
    if (stem === "ein" && ending === "" ) {
      add(form, { lemma: "ein", pos: "DET", features: { determiner: "indefinite", readings } });
      continue;
    }
    // "sein" and "ihr" are ambiguous with the verb/pronoun; resolved in context.
    if ((stem === "sein" || stem === "ihr") && ending === "") continue;
    add(form, {
      lemma: stem,
      pos: "DET",
      features: { determiner: stem === "ein" ? "indefinite" : stem === "kein" ? "negative" : "possessive", readings },
    });
  }
}

for (const stem of ["dies", "jed", "welch", "jen", "manch", "solch", "all"]) {
  for (const [ending, readings] of Object.entries(DER_WORD_ENDINGS)) {
    add(`${stem}${ending}`, {
      lemma: `${stem}er`,
      pos: "DET",
      features: { determiner: "demonstrative", readings },
    });
  }
}

const PRONOUNS: Array<[string, string, string]> = [
  ["ich", "ich", "case=nom person=1 number=sg"],
  ["mich", "ich", "case=acc person=1 number=sg"],
  ["mir", "ich", "case=dat person=1 number=sg"],
  ["du", "du", "case=nom person=2 number=sg"],
  ["dich", "du", "case=acc person=2 number=sg"],
  ["dir", "du", "case=dat person=2 number=sg"],
  ["er", "er", "case=nom person=3 number=sg gender=m"],
  ["ihn", "er", "case=acc person=3 number=sg gender=m"],
  ["ihm", "er", "case=dat person=3 number=sg gender=m|n"],
  ["sie", "sie", "case=nom|acc person=3 number=sg|pl"],
  ["es", "es", "case=nom|acc person=3 number=sg gender=n"],
  ["wir", "wir", "case=nom person=1 number=pl"],
  ["uns", "wir", "case=acc|dat person=1 number=pl"],
  ["euch", "ihr", "case=acc|dat person=2 number=pl"],
  ["ihnen", "sie", "case=dat person=3 number=pl"],
  ["sich", "sich", "case=acc|dat reflexive=yes"],
  ["man", "man", "case=nom person=3 number=sg"],
  ["wer", "wer", "case=nom interrogative=yes"],
  ["wen", "wer", "case=acc interrogative=yes"],
  ["wem", "wer", "case=dat interrogative=yes"],
  ["was", "was", "case=nom|acc"],
  ["nichts", "nichts", ""],
  ["etwas", "etwas", ""],
  ["jemand", "jemand", ""],
  ["niemand", "niemand", ""],
];
for (const [form, lemma, raw] of PRONOUNS) {
  const features: GrammarFeatures = {};
  for (const pair of raw.split(" ").filter(Boolean)) {
    const [key, value] = pair.split("=");
    if (key && value) features[key] = value;
  }
  add(form, { lemma, pos: "PRON", features });
}

export const PREPOSITION_CASE: Record<string, string> = {
  mit: "dat", nach: "dat", aus: "dat", zu: "dat", von: "dat", bei: "dat", seit: "dat",
  gegenüber: "dat", ab: "dat", außer: "dat",
  durch: "acc", für: "acc", gegen: "acc", ohne: "acc", um: "acc", bis: "acc",
  an: "acc|dat", auf: "acc|dat", hinter: "acc|dat", in: "acc|dat", neben: "acc|dat",
  über: "acc|dat", unter: "acc|dat", vor: "acc|dat", zwischen: "acc|dat",
  wegen: "gen", während: "gen", trotz: "gen", statt: "gen", anstatt: "gen", innerhalb: "gen", außerhalb: "gen",
};
for (const [form, governs] of Object.entries(PREPOSITION_CASE)) {
  add(form, { lemma: form, pos: "ADP", features: { governs } });
}

export const CONTRACTIONS: Record<string, [string, string]> = {
  zum: ["zu", "dat.m dat.n"], zur: ["zu", "dat.f"], im: ["in", "dat.m dat.n"], ins: ["in", "acc.n"],
  am: ["an", "dat.m dat.n"], ans: ["an", "acc.n"], beim: ["bei", "dat.m dat.n"], vom: ["von", "dat.m dat.n"],
  aufs: ["auf", "acc.n"], übers: ["über", "acc.n"], fürs: ["für", "acc.n"], durchs: ["durch", "acc.n"],
};
for (const [form, [lemma, readings]] of Object.entries(CONTRACTIONS)) {
  add(form, { lemma, pos: "ADP", features: { contraction: `${lemma} + article`, readings, governs: PREPOSITION_CASE[lemma] ?? "" } });
}

export const SUBORDINATORS = new Set([
  "dass", "weil", "ob", "wenn", "als", "obwohl", "obgleich", "damit", "bevor", "nachdem", "seitdem",
  "falls", "sobald", "solange", "indem", "sodass", "da", "bis", "ehe", "wie", "wo", "warum", "wieso",
  "weshalb", "wohin", "woher",
]);
for (const form of SUBORDINATORS) {
  add(form, { lemma: form, pos: "SCONJ" });
}

for (const form of ["und", "oder", "aber", "denn", "sondern", "doch"]) {
  add(form, { lemma: form, pos: "CCONJ" });
}

export const MODAL_PARTICLES = new Set(["ja", "doch", "mal", "eben", "halt", "wohl", "schon", "denn", "eigentlich", "bloß", "ruhig"]);

for (const form of [
  "nicht", "auch", "noch", "sehr", "immer", "nur", "hier", "dort", "jetzt", "dann", "heute", "gestern",
  "morgen", "oft", "nie", "niemals", "wieder", "bereits", "fast", "gern", "gerne", "vielleicht", "sogar",
  "zusammen", "damals", "deshalb", "darum", "trotzdem", "also", "sonst", "dabei", "dafür", "dagegen",
  "darauf", "darüber", "davon", "dazu", "danach", "daran", "so", "ganz", "genug", "bald", "überall",
]) {
  add(form, { lemma: form, pos: "ADV" });
}

export const SEPARABLE_PARTICLES = [
  "zurück", "zusammen", "weiter", "vorbei", "heraus", "herein", "hinaus", "hinein", "fest", "fort", "heim",
  "los", "statt", "weg", "auf", "aus", "ab", "an", "bei", "ein", "mit", "nach", "vor", "zu", "her", "hin",
] as const;
export const SEPARABLE_PARTICLE_SET = new Set<string>(SEPARABLE_PARTICLES);
export const INSEPARABLE_PREFIXES = ["be", "ver", "er", "ent", "zer", "emp", "miss", "ge"] as const;

export interface VerbForm {
  lemma: string;
  features: GrammarFeatures;
}

/** Fully listed auxiliaries and modals (form -> analysis). */
const IRREGULAR_PARADIGMS: Record<string, Record<string, string>> = {
  sein: {
    bin: "pres 1sg", bist: "pres 2sg", ist: "pres 3sg", sind: "pres 1pl|3pl", seid: "pres 2pl",
    war: "pret 1sg|3sg", warst: "pret 2sg", waren: "pret 1pl|3pl", wart: "pret 2pl", gewesen: "part",
    sei: "subj1 1sg|3sg", seist: "subj1 2sg", seien: "subj1 1pl|3pl",
    wäre: "subj2 1sg|3sg", wärst: "subj2 2sg", wärest: "subj2 2sg", wären: "subj2 1pl|3pl", wärt: "subj2 2pl",
  },
  haben: {
    habe: "pres 1sg", hast: "pres 2sg", hat: "pres 3sg", habt: "pres 2pl",
    hatte: "pret 1sg|3sg", hattest: "pret 2sg", hatten: "pret 1pl|3pl", hattet: "pret 2pl", gehabt: "part",
    hätte: "subj2 1sg|3sg", hättest: "subj2 2sg", hätten: "subj2 1pl|3pl", hättet: "subj2 2pl",
  },
  werden: {
    werde: "pres 1sg", wirst: "pres 2sg", wird: "pres 3sg", werdet: "pres 2pl",
    wurde: "pret 1sg|3sg", wurdest: "pret 2sg", wurden: "pret 1pl|3pl", wurdet: "pret 2pl",
    geworden: "part", worden: "part passive",
    würde: "subj2 1sg|3sg", würdest: "subj2 2sg", würden: "subj2 1pl|3pl", würdet: "subj2 2pl",
  },
  können: {
    kann: "pres 1sg|3sg", kannst: "pres 2sg", könnt: "pres 2pl", konnte: "pret 1sg|3sg", konntest: "pret 2sg",
    konnten: "pret 1pl|3pl", konntet: "pret 2pl", gekonnt: "part", könnte: "subj2 1sg|3sg",
    könntest: "subj2 2sg", könnten: "subj2 1pl|3pl", könntet: "subj2 2pl",
  },
  müssen: {
    muss: "pres 1sg|3sg", musst: "pres 2sg", müsst: "pres 2pl", musste: "pret 1sg|3sg", musstest: "pret 2sg",
    mussten: "pret 1pl|3pl", gemusst: "part", müsste: "subj2 1sg|3sg", müssten: "subj2 1pl|3pl",
  },
  dürfen: {
    darf: "pres 1sg|3sg", darfst: "pres 2sg", dürft: "pres 2pl", durfte: "pret 1sg|3sg", durften: "pret 1pl|3pl",
    gedurft: "part", dürfte: "subj2 1sg|3sg", dürften: "subj2 1pl|3pl",
  },
  sollen: {
    soll: "pres 1sg|3sg", sollst: "pres 2sg", sollt: "pres 2pl", sollte: "pret|subj2 1sg|3sg",
    solltest: "pret|subj2 2sg", sollten: "pret|subj2 1pl|3pl", gesollt: "part",
  },
  wollen: {
    will: "pres 1sg|3sg", willst: "pres 2sg", wollt: "pres 2pl", wollte: "pret|subj2 1sg|3sg",
    wolltest: "pret|subj2 2sg", wollten: "pret|subj2 1pl|3pl", gewollt: "part",
  },
  mögen: {
    mag: "pres 1sg|3sg", magst: "pres 2sg", mögt: "pres 2pl", mochte: "pret 1sg|3sg", mochten: "pret 1pl|3pl",
    gemocht: "part", möchte: "subj2 1sg|3sg", möchtest: "subj2 2sg", möchten: "subj2 1pl|3pl", möchtet: "subj2 2pl",
  },
  wissen: {
    weiß: "pres 1sg|3sg", weißt: "pres 2sg", wisst: "pres 2pl", wusste: "pret 1sg|3sg", wussten: "pret 1pl|3pl",
    gewusst: "part", wüsste: "subj2 1sg|3sg", wüssten: "subj2 1pl|3pl",
  },
};

export const MODAL_VERBS = new Set(["können", "müssen", "dürfen", "sollen", "wollen", "mögen"]);
export const AUXILIARIES = new Set(["sein", "haben", "werden"]);

/**
 * Strong and mixed verbs: infinitive | 3sg present (vowel change) |
 * preterite stem | past participle.
 */
const STRONG_VERBS = `
gehen|geht|ging|gegangen kommen|kommt|kam|gekommen sehen|sieht|sah|gesehen geben|gibt|gab|gegeben
nehmen|nimmt|nahm|genommen sprechen|spricht|sprach|gesprochen finden|findet|fand|gefunden stehen|steht|stand|gestanden
liegen|liegt|lag|gelegen sitzen|sitzt|saß|gesessen lassen|lässt|ließ|gelassen halten|hält|hielt|gehalten
fahren|fährt|fuhr|gefahren tragen|trägt|trug|getragen schlafen|schläft|schlief|geschlafen fallen|fällt|fiel|gefallen
laufen|läuft|lief|gelaufen rufen|ruft|rief|gerufen heißen|heißt|hieß|geheißen bleiben|bleibt|blieb|geblieben
schreiben|schreibt|schrieb|geschrieben lesen|liest|las|gelesen essen|isst|aß|gegessen trinken|trinkt|trank|getrunken
singen|singt|sang|gesungen beginnen|beginnt|begann|begonnen helfen|hilft|half|geholfen sterben|stirbt|starb|gestorben
werfen|wirft|warf|geworfen treffen|trifft|traf|getroffen vergessen|vergisst|vergaß|vergessen bitten|bittet|bat|gebeten
ziehen|zieht|zog|gezogen fliegen|fliegt|flog|geflogen verlieren|verliert|verlor|verloren schließen|schließt|schloss|geschlossen
bieten|bietet|bot|geboten scheinen|scheint|schien|geschienen schweigen|schweigt|schwieg|geschwiegen steigen|steigt|stieg|gestiegen
greifen|greift|griff|gegriffen leiden|leidet|litt|gelitten schneiden|schneidet|schnitt|geschnitten reiten|reitet|ritt|geritten
streiten|streitet|stritt|gestritten binden|bindet|band|gebunden springen|springt|sprang|gesprungen gewinnen|gewinnt|gewann|gewonnen
schwimmen|schwimmt|schwamm|geschwommen brechen|bricht|brach|gebrochen stehlen|stiehlt|stahl|gestohlen empfehlen|empfiehlt|empfahl|empfohlen
tun|tut|tat|getan schlagen|schlägt|schlug|geschlagen wachsen|wächst|wuchs|gewachsen waschen|wäscht|wusch|gewaschen
fangen|fängt|fing|gefangen hängen|hängt|hing|gehangen erschrecken|erschrickt|erschrak|erschrocken wiegen|wiegt|wog|gewogen
lügen|lügt|log|gelogen frieren|friert|fror|gefroren riechen|riecht|roch|gerochen fließen|fließt|floss|geflossen
genießen|genießt|genoss|genossen schieben|schiebt|schob|geschoben heben|hebt|hob|gehoben treten|tritt|trat|getreten
messen|misst|maß|gemessen raten|rät|riet|geraten braten|brät|briet|gebraten stoßen|stößt|stieß|gestoßen
bringen|bringt|brachte|gebracht denken|denkt|dachte|gedacht kennen|kennt|kannte|gekannt nennen|nennt|nannte|genannt
rennen|rennt|rannte|gerannt brennen|brennt|brannte|gebrannt senden|sendet|sandte|gesandt wenden|wendet|wandte|gewandt
erscheinen|erscheint|erschien|erschienen gelten|gilt|galt|gegolten werben|wirbt|warb|geworben verderben|verdirbt|verdarb|verdorben
schaffen|schafft|schuf|geschaffen meiden|meidet|mied|gemieden weisen|weist|wies|gewiesen preisen|preist|pries|gepriesen
reißen|reißt|riss|gerissen beißen|beißt|biss|gebissen gleichen|gleicht|glich|geglichen schreien|schreit|schrie|geschrien
leihen|leiht|lieh|geliehen treiben|treibt|trieb|getrieben steigen|steigt|stieg|gestiegen sinken|sinkt|sank|gesunken
zwingen|zwingt|zwang|gezwungen klingen|klingt|klang|geklungen schwinden|schwindet|schwand|geschwunden
`;

export const VERB_FORMS = new Map<string, VerbForm>();

function addVerbForm(form: string, lemma: string, raw: string) {
  if (VERB_FORMS.has(form)) return;
  const [tense, persons] = raw.split(" ");
  const features: GrammarFeatures = {};
  if (tense === "part") {
    features.form = "participle";
    if (persons === "passive") features.usage = "passive";
  } else if (tense === "inf") {
    features.form = "infinitive";
  } else if (tense) {
    features.form = "finite";
    features.tense = tense;
    if (persons) features.person = persons;
  }
  VERB_FORMS.set(form, { lemma, features });
}

for (const [lemma, forms] of Object.entries(IRREGULAR_PARADIGMS)) {
  addVerbForm(lemma, lemma, "inf");
  for (const [form, raw] of Object.entries(forms)) addVerbForm(form, lemma, raw);
}

function stemOf(infinitive: string) {
  return infinitive.endsWith("en") ? infinitive.slice(0, -2) : infinitive.slice(0, -1);
}

function umlaut(value: string) {
  return value.replace(/au(?!.*[aou])/, "äu").replace(/a(?!.*[aou])/, "ä").replace(/o(?!.*[aou])/, "ö").replace(/u(?!.*[aou])/, "ü");
}

export const STRONG_PARTICIPLES = new Map<string, string>();

for (const entry of STRONG_VERBS.split(/\s+/).filter(Boolean)) {
  const [infinitive, present3, preterite, participle] = entry.split("|");
  if (!infinitive || !present3 || !preterite || !participle) continue;
  const stem = stemOf(infinitive);
  const glue = /[dt]$/.test(stem) ? "e" : "";
  addVerbForm(infinitive, infinitive, "inf");
  addVerbForm(`${stem}e`, infinitive, "pres 1sg");
  addVerbForm(present3, infinitive, "pres 3sg");
  const present2 = present3.endsWith("t") ? `${present3.slice(0, -1)}st`.replace(/sst$|ßst$|zst$/, (m) => m.slice(0, -2) + "t") : `${present3}st`;
  addVerbForm(present2, infinitive, "pres 2sg");
  addVerbForm(`${stem}${glue}t`, infinitive, "pres 2pl");
  addVerbForm(preterite, infinitive, "pret 1sg|3sg");
  addVerbForm(`${preterite}st`, infinitive, "pret 2sg");
  addVerbForm(preterite.endsWith("e") ? `${preterite}n` : `${preterite}en`, infinitive, "pret 1pl|3pl");
  addVerbForm(`${preterite}t`, infinitive, "pret 2pl");
  if (!preterite.endsWith("te")) {
    const subjunctive = `${umlaut(preterite)}e`;
    addVerbForm(subjunctive, infinitive, "subj2 1sg|3sg");
    addVerbForm(`${subjunctive}n`, infinitive, "subj2 1pl|3pl");
  }
  addVerbForm(participle, infinitive, "part");
  STRONG_PARTICIPLES.set(participle, infinitive);
}

export const KONJUNKTIV_II_COMMON = new Set([
  "wäre", "wären", "wärst", "hätte", "hätten", "hättest", "würde", "würden", "würdest", "könnte",
  "könnten", "müsste", "müssten", "dürfte", "dürften", "möchte", "möchten", "wüsste", "käme", "gäbe", "ginge",
]);

export const GERMAN_ABBREVIATIONS = new Set([
  "z.b", "d.h", "u.a", "usw", "bzw", "vgl", "ca", "dr", "prof", "nr", "str", "evtl", "ggf", "inkl", "s", "z", "bspw", "etc",
]);

const g = (en: string, pt: string) => ({ en, pt });

export const GERMAN_EXPRESSIONS: ExpressionPattern[] = [
  { label: "in Betracht ziehen", kind: "fixed", chunks: [["in", "betracht"], ["ziehen"]], glosses: g("to take into consideration", "levar em consideração") },
  { label: "zur Verfügung stehen", kind: "fixed", chunks: [["zu", "verfügung"], ["stehen"]], glosses: g("to be available", "estar à disposição") },
  { label: "zur Verfügung stellen", kind: "fixed", chunks: [["zu", "verfügung"], ["stellen"]], glosses: g("to make available", "colocar à disposição") },
  { label: "es kommt darauf an", kind: "idiom", chunks: [["es"], ["darauf"], ["ankommen"]], glosses: g("it depends", "depende") },
  { label: "sich freuen auf", kind: "reflexive", chunks: [["{refl}"], ["freuen"], ["auf"]], note: "expr.prepositionalObject", glosses: g("to look forward to", "estar ansioso por") },
  { label: "sich freuen über", kind: "reflexive", chunks: [["{refl}"], ["freuen"], ["über"]], note: "expr.prepositionalObject", glosses: g("to be happy about", "alegrar-se com") },
  { label: "sich interessieren für", kind: "reflexive", chunks: [["{refl}"], ["interessieren"], ["für"]], glosses: g("to be interested in", "interessar-se por") },
  { label: "sich erinnern an", kind: "reflexive", chunks: [["{refl}"], ["erinnern"], ["an"]], glosses: g("to remember", "lembrar-se de") },
  { label: "sich kümmern um", kind: "reflexive", chunks: [["{refl}"], ["kümmern"], ["um"]], glosses: g("to take care of", "cuidar de") },
  { label: "sich gewöhnen an", kind: "reflexive", chunks: [["{refl}"], ["gewöhnen"], ["an"]], glosses: g("to get used to", "acostumar-se a") },
  { label: "Angst haben vor", kind: "collocation", chunks: [["angst"], ["haben"], ["vor"]], glosses: g("to be afraid of", "ter medo de") },
  { label: "eine Rolle spielen", kind: "collocation", chunks: [["rolle"], ["spielen"]], maxSpan: 6, glosses: g("to play a role", "desempenhar um papel") },
  { label: "in Frage kommen", kind: "fixed", chunks: [["in", "frage"], ["kommen"]], glosses: g("to be an option", "entrar em questão") },
  { label: "Rücksicht nehmen auf", kind: "collocation", chunks: [["rücksicht"], ["nehmen"]], glosses: g("to show consideration for", "ter consideração por") },
  { label: "Bescheid wissen", kind: "collocation", chunks: [["bescheid"], ["wissen"]], glosses: g("to be informed", "estar a par") },
  { label: "Bescheid sagen", kind: "collocation", chunks: [["bescheid"], ["sagen"]], glosses: g("to let someone know", "avisar") },
  { label: "Recht haben", kind: "collocation", chunks: [["recht"], ["haben"]], maxSpan: 5, glosses: g("to be right", "ter razão") },
  { label: "Lust haben", kind: "collocation", chunks: [["lust"], ["haben"]], maxSpan: 5, glosses: g("to feel like (doing)", "ter vontade") },
  { label: "Spaß machen", kind: "collocation", chunks: [["spaß"], ["machen"]], maxSpan: 5, glosses: g("to be fun", "ser divertido") },
  { label: "es gibt", kind: "idiom", chunks: [["es"], ["geben"]], maxSpan: 4, glosses: g("there is / there are", "há / existe") },
  { label: "in der Lage sein", kind: "fixed", chunks: [["in", "der", "lage"], ["sein"]], glosses: g("to be able to", "ser capaz de") },
  { label: "ums Leben kommen", kind: "fixed", chunks: [["um", "leben"], ["kommen"]], glosses: g("to lose one's life", "perder a vida") },
  { label: "zum Beispiel", kind: "fixed", chunks: [["zu", "beispiel"]], glosses: g("for example", "por exemplo") },
  { label: "auf jeden Fall", kind: "fixed", chunks: [["auf", "jeder", "fall"]], glosses: g("in any case", "de qualquer forma") },
  { label: "vor allem", kind: "fixed", chunks: [["vor", "aller"]], glosses: g("above all", "sobretudo") },
  { label: "nach wie vor", kind: "fixed", chunks: [["nach", "wie", "vor"]], glosses: g("still, as before", "como antes, ainda") },
  { label: "ab und zu", kind: "fixed", chunks: [["ab", "und", "zu"]], glosses: g("now and then", "de vez em quando") },
  { label: "im Gegenteil", kind: "fixed", chunks: [["in", "gegenteil"]], glosses: g("on the contrary", "pelo contrário") },
  { label: "immer noch", kind: "fixed", chunks: [["immer", "noch"]], glosses: g("still", "ainda") },
  { label: "Platz nehmen", kind: "collocation", chunks: [["platz"], ["nehmen"]], maxSpan: 5, glosses: g("to take a seat", "sentar-se") },
  { label: "Abschied nehmen", kind: "collocation", chunks: [["abschied"], ["nehmen"]], glosses: g("to say goodbye", "despedir-se") },
  { label: "eine Entscheidung treffen", kind: "collocation", chunks: [["entscheidung"], ["treffen"]], glosses: g("to make a decision", "tomar uma decisão") },
  { label: "zu Ende", kind: "fixed", chunks: [["zu", "ende"]], glosses: g("over, finished", "terminado") },
];
