import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { analyzeDocument, getLanguageModule } from "../../core/language-learning";
import { OccurrenceIndex } from "../../core/language-learning/occurrenceIndex";
import type { PackLookupResult } from "../../core/dictionary-packs";
import { createDefaultTranslationService } from "../../features/language-learning/translation";
import { refreshDictionaryPacks } from "../../features/language-learning/dictionaryPacks";
import { registerPlatform, resetPlatformForTests } from "../../platform";
import { WordSheet } from "../../mobile/learning/WordSheet";
import type { LearningSession } from "../../pages/ReadingPage/components/lyceum-reader/useLearningSessionCore";

const DOCUMENT = analyzeDocument({
  documentId: "pkg-1",
  title: "Testbuch",
  language: "de",
  chapters: [
    { id: "c1", href: "c1.xhtml", title: "Eins", blocks: [{ kind: "paragraph", text: "Ich gehe nach Hause. Gestern ging ich ins Kino." }] },
    { id: "c2", href: "c2.xhtml", title: "Zwei", blocks: [{ kind: "paragraph", text: "Wir gehen zusammen." }] },
  ],
}, getLanguageModule("de"), { now: "2026-01-01T00:00:00.000Z" });

const PACK: PackLookupResult = {
  found: true,
  query: "ging",
  lang: "de",
  target: "pt",
  entries: [{
    word: "gehen",
    pos: "verb",
    tags: [],
    ipa: ["/ˈɡeːən/"],
    audio: [],
    senses: [
      { gloss: "to go, to walk", tags: ["intransitive"], examples: [{ text: "Ich gehe nach Hause.", translation: "I am going home." }], relations: { synonyms: ["laufen"] } },
      { gloss: "to leave", tags: [], examples: [], relations: {} },
    ],
    relations: { antonyms: ["kommen"], derived: ["ausgehen", "weggehen"] },
    forms: [{ form: "ging", tags: ["past"] }],
    translations: [{ word: "ir" }, { word: "andar" }, { word: "caminhar" }, { word: "partir" }],
    etymology: "From Middle High German gēn.",
    matchedForm: { form: "ging", tags: ["past"] },
  }],
};

function session(): LearningSession {
  return {
    document: DOCUMENT,
    index: new OccurrenceIndex(DOCUMENT),
    snapshot: { lemmas: {}, forms: {} },
    setKnowledge: vi.fn(async () => undefined),
    clearFormOverride: vi.fn(async () => undefined),
    saveTranslation: vi.fn(async () => undefined),
  } as unknown as LearningSession;
}

function ordinalOf(word: string, current: LearningSession) {
  for (let ordinal = 0; ordinal < 200; ordinal += 1) {
    const resolved = current.index?.resolve(ordinal);
    if (resolved && resolved.block.text.slice(resolved.tuple[0], resolved.tuple[1]) === word) return ordinal;
  }
  throw new Error(`${word} not found`);
}

describe("mobile word sheet", () => {
  beforeAll(() => {
    globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  });
  afterEach(() => {
    resetPlatformForTests();
    refreshDictionaryPacks();
  });

  it("shows the translation collapsed and the dictionary details after expanding", async () => {
    registerPlatform({
      target: "mobile",
      learningBridge: {
        dictionaryGetIndex: async () => [{ id: "wiktionary-de", name: "Wiktionary · Deutsch", sourceLang: "de", targetLang: "*", isDownloaded: true }],
        dictionaryLookup: async () => ({ found: false }),
        dictionaryDownload: async () => ({ success: true }),
        dictionaryPackLookup: async () => PACK,
      },
    });
    const current = session();
    const ordinal = ordinalOf("ging", current);
    const onNavigate = vi.fn();
    render(
      <WordSheet
        session={current}
        ordinal={ordinal}
        settings={{ nativeLanguage: "pt", onlineTranslation: false } as never}
        translationService={createDefaultTranslationService(() => false)}
        translationRevision={0}
        speechAvailable={false}
        onState={vi.fn()}
        onSpeak={vi.fn()}
        onInspect={vi.fn()}
        onNavigate={onNavigate}
        onNote={vi.fn()}
        onManageDictionaries={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(await screen.findByText(/ir, andar, caminhar/)).toBeTruthy();
    expect(screen.getByText("/ˈɡeːən/")).toBeTruthy();

    const handle = screen.getByRole("button", { name: /show details|ver detalhes/i });
    expect(handle.getAttribute("aria-expanded")).toBe("false");
    await act(async () => fireEvent.click(handle));
    expect(handle.getAttribute("aria-expanded")).toBe("true");

    // Book statistics: "gehen" occurs 3 times (gehe, ging, gehen), twice in chapter 1.
    expect(screen.getByText(/^(in the book|no livro)$/).previousElementSibling?.textContent).toBe("3");
    expect(screen.getByText(/^(this chapter|neste capítulo)$/).previousElementSibling?.textContent).toBe("2");
    // Synonyms and antonyms come before the meanings.
    expect(screen.getByText("laufen")).toBeTruthy();
    expect(screen.getByText("kommen")).toBeTruthy();
    expect(screen.getByText("to go, to walk")).toBeTruthy();
    expect(screen.getByText(/I am going home/)).toBeTruthy();

    // Occurrence navigation follows the lemma through the book.
    fireEvent.click(screen.getByRole("button", { name: /next occurrence|próxima ocorrência/i }));
    await waitFor(() => expect(onNavigate).toHaveBeenCalled());
    expect(onNavigate.mock.calls[0]?.[0]).toMatchObject({ flash: true });
  });
});
