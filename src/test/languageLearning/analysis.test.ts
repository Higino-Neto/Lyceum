import { describe, expect, it } from "vitest";
import {
  analyzeDocument,
  getLanguageModule,
  OccurrenceIndex,
  type ChapterInput,
} from "../../core/language-learning";

const GERMAN: ChapterInput[] = [
  {
    id: "ch1",
    href: "ch1.xhtml",
    title: "Kapitel 1",
    blocks: [
      { kind: "heading", level: 1, text: "Der Morgen" },
      { kind: "paragraph", text: "Ich stehe jeden Morgen früh auf. Ich gehe gern in die Stadt. Die Frau geht nach Hause." },
      { kind: "paragraph", text: "Gestern ging ich mit einer Frau ins Kino. Wir sind spät gegangen, weil der Film lang war." },
    ],
  },
  {
    id: "ch2",
    href: "ch2.xhtml",
    title: "Kapitel 2",
    blocks: [
      { kind: "paragraph", text: "Ich freue mich sehr auf den Urlaub. Wir ziehen das in Betracht. Es kommt darauf an." },
      { kind: "paragraph", text: "Die Frauen wollen aufstehen. Das Haus ist groß. Die Haustür ist offen. Eine Tür ist alt." },
    ],
  },
];

function analyzeGerman() {
  return analyzeDocument({ documentId: "doc-de", title: "Test", language: "de", chapters: GERMAN }, getLanguageModule("de"), { now: "2026-01-01T00:00:00.000Z" });
}

function lexeme(document: ReturnType<typeof analyzeGerman>, key: string) {
  const index = document.lexicon.findIndex((entry) => entry.key === key);
  return { index, entry: document.lexicon[index] };
}

describe("analyzeDocument (German)", () => {
  const document = analyzeGerman();
  const index = new OccurrenceIndex(document);

  it("builds stable structural identifiers", () => {
    const chapter = document.chapters[0]!;
    expect(chapter.blocks[1]!.id).toBe("ch1.b1");
    expect(chapter.blocks[1]!.sentences[1]!.id).toBe("ch1.b1.s1");
    expect(chapter.blocks[1]!.sentences).toHaveLength(3);
    expect(document.totals.tokens).toBe(index.tokenCount);
  });

  it("groups inflected verb forms under one lemma", () => {
    const { index: gehen, entry } = lexeme(document, "gehen");
    expect(entry).toBeDefined();
    const forms = index.formsOfLexeme(gehen).map((f) => document.forms[f]!.form).sort();
    expect(forms).toEqual(["gegangen", "geht", "gehe", "ging"].sort());
    expect(entry!.count).toBe(4);
  });

  it("reunites separable verbs split across the clause", () => {
    const { entry } = lexeme(document, "aufstehen");
    // "stehe ... auf" and the infinitive "aufstehen"
    expect(entry?.count).toBe(2);
    expect(document.expressions.some((e) => e.kind === "separable" && e.label === "aufstehen")).toBe(true);
  });

  it("lemmatizes noun plurals only when the singular is attested", () => {
    const { entry } = lexeme(document, "Frau");
    expect(entry?.count).toBe(3);
    expect(lexeme(document, "Frauen").entry).toBeUndefined();
  });

  it("infers noun gender from articles in the document", () => {
    expect(lexeme(document, "Frau").entry?.features?.gender).toBe("f");
    expect(lexeme(document, "Haus").entry?.features?.gender).toBe("n");
  });

  it("analyzes compounds from attested parts", () => {
    expect(lexeme(document, "Haustür").entry?.features?.compound).toBe("Haus + Tür");
  });

  it("recognizes gapped multi-word expressions without substring matching", () => {
    const labels = document.expressions.map((e) => e.label);
    expect(labels).toContain("in Betracht ziehen");
    expect(labels).toContain("sich freuen auf");
    expect(labels).toContain("es kommt darauf an");
  });

  it("precomputes chapter statistics", () => {
    const frau = lexeme(document, "Frau").index;
    expect(document.chapterStats[0]!.lexemeCounts[frau]).toBe(2);
    expect(document.chapterStats[1]!.lexemeCounts[frau]).toBe(1);
    expect(document.chapterStats.reduce((sum, c) => sum + c.tokenCount, 0)).toBe(document.totals.tokens);
  });
});

describe("German clause-level constructions (regressions)", () => {
  const document = analyzeDocument({
    documentId: "r",
    title: "R",
    language: "de",
    chapters: [{
      id: "c",
      href: "c",
      title: "c",
      blocks: [
        { kind: "paragraph", text: "Sie ging in die Küche und machte sich einen Kaffee. Ich stehe auf und gehe los." },
        { kind: "paragraph", text: "Anna wohnt in Berlin. Die Brücke ist alt. Anna sieht die Brücke. Er machen will." },
      ],
    }],
  }, getLanguageModule("de"));
  const labels = document.expressions.map((entry) => entry.label);
  const flagOf = (surface: string) => {
    for (const block of document.chapters[0]!.blocks) {
      for (const sentence of block.sentences) {
        for (const token of sentence.tokens) {
          if (block.text.slice(token[0], token[1]) === surface) return token[4] & 1;
        }
      }
    }
    return null;
  };

  it("attaches the reflexive pronoun to the nearest verb, not the first verb of the sentence", () => {
    expect(labels).toContain("sich machen");
    expect(labels).not.toContain("sich gehen");
  });

  it("treats coordinating conjunctions as clause boundaries for separable verbs", () => {
    expect(labels).toContain("aufstehen");
    expect(labels).toContain("losgehen");
  });

  it("flags proper nouns from document context, not from German noun capitalization", () => {
    expect(flagOf("Anna")).toBe(1);
    expect(flagOf("Berlin")).toBe(1);
    expect(flagOf("Brücke")).toBe(0);
    expect(flagOf("Küche")).toBe(0);
  });
});

describe("OccurrenceIndex", () => {
  const document = analyzeGerman();
  const index = new OccurrenceIndex(document);
  const gehen = document.lexicon.findIndex((entry) => entry.key === "gehen");

  it("counts lemma, surface form and chapter occurrences", () => {
    expect(index.lexemeOccurrences(gehen)).toHaveLength(4);
    expect(index.lexemeOccurrences(gehen, { chapterIndex: 1 })).toHaveLength(0);
    const ging = document.forms.findIndex((f) => f.form === "ging");
    expect(index.formOccurrences(ging)).toHaveLength(1);
  });

  it("round-trips stable token ids to locations", () => {
    for (const ordinal of index.lexemeOccurrences(gehen)) {
      const resolved = index.resolve(ordinal)!;
      expect(index.ordinalOfTokenId(resolved.tokenId)).toBe(ordinal);
      expect(resolved.block.text.slice(resolved.tuple[0], resolved.tuple[1]).toLowerCase()).toMatch(/^ge|^ging/);
    }
    expect(index.ordinalOfTokenId("ch1.b1.s0.t999")).toBeNull();
    expect(index.ordinalOfTokenId("missing.t0")).toBeNull();
  });
});

describe("generic module", () => {
  it("degrades gracefully without lemmatization", () => {
    const document = analyzeDocument({
      documentId: "doc-x",
      title: "X",
      language: "sv",
      chapters: [{ id: "c", href: "c", title: "c", blocks: [{ kind: "paragraph", text: "Hej hej världen. Världen är stor." }] }],
    }, getLanguageModule("sv"));
    expect(document.analyzer.capabilities).not.toContain("lemmatization");
    expect(document.lexicon.find((e) => e.key === "hej")?.count).toBe(2);
    expect(document.totals.sentences).toBe(2);
  });

  it("segments unspaced scripts with Intl.Segmenter", () => {
    const document = analyzeDocument({
      documentId: "doc-ja",
      title: "J",
      language: "ja",
      chapters: [{ id: "c", href: "c", title: "c", blocks: [{ kind: "paragraph", text: "私は本を読みます。" }] }],
    }, getLanguageModule("ja"));
    expect(document.totals.tokens).toBeGreaterThan(1);
  });
});

describe("French analysis (elisions and invariable words)", () => {
  const document = analyzeDocument({
    documentId: "fr",
    title: "F",
    language: "fr",
    chapters: [{ id: "c", href: "c", title: "c", blocks: [
      { kind: "paragraph", text: "Vous regardez l'écran. Mais l'écran est dans la maison, qu'il dit. Les maisons sont grandes." },
      { kind: "paragraph", text: "Le mai est beau. Dan est là. C'est un écran, et nous parlons d'écrans." },
    ] }],
  }, getLanguageModule("fr"));
  const key = (k: string) => document.lexicon.find((entry) => entry.key === k);

  it("splits elided articles and pronouns into their own tokens", () => {
    expect(key("écran")?.count).toBe(4);
    expect(key("l'écran")).toBeUndefined();
    expect(key("le")?.count).toBeGreaterThanOrEqual(3);
    expect(key("que")).toBeDefined();
    expect(key("il")).toBeDefined();
  });

  it("does not strip plural-like endings from function words", () => {
    expect(key("vous")).toBeDefined();
    expect(key("vou")).toBeUndefined();
    expect(key("mais")).toBeDefined();
    expect(key("dans")).toBeDefined();
    expect(key("maison")?.count).toBe(2);
  });
});

describe("language detection", () => {
  it("identifies the language from the text, not the metadata", async () => {
    const { detectLanguage } = await import("../../core/language-learning");
    const french = "Il était une fois, dans une petite maison au bord de la mer, une femme qui vivait seule avec son chat. Elle ne sortait jamais le soir, mais elle aimait regarder les bateaux qui passaient sur l'eau, et elle se demandait souvent où ils allaient.";
    const portuguese = "Era uma vez, numa pequena casa à beira do mar, uma mulher que vivia sozinha com o seu gato. Ela não saía à noite, mas gostava de olhar os barcos que passavam na água e muitas vezes se perguntava para onde eles iam.";
    const german = "Es war einmal eine Frau, die allein mit ihrer Katze in einem kleinen Haus am Meer wohnte. Sie ging abends nie aus, aber sie sah gern den Schiffen zu, die auf dem Wasser vorbeifuhren, und fragte sich oft, wohin sie fuhren.";
    expect(detectLanguage(french)?.language).toBe("fr");
    expect(detectLanguage(portuguese)?.language).toBe("pt");
    expect(detectLanguage(german)?.language).toBe("de");
    expect(detectLanguage("短い")?.language).toBe("ja");
    expect(detectLanguage("too short")).toBeNull();
  });
});
