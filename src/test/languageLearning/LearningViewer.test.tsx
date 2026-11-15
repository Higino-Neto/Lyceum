import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  analyzeDocument,
  getLanguageModule,
  type FormKnowledgeRecord,
  type KnowledgeRecord,
  type KnowledgeSnapshot,
  type LearningAnnotation,
  type ReviewItem,
} from "../../core/language-learning";
import { formKey } from "../../core/language-learning/knowledge";

vi.mock("../../contexts/AuthContext", () => ({ useAuth: () => ({ user: null }) }));

const { default: LyceumLearningViewer } = await import("../../pages/ReadingPage/components/lyceum-reader/Viewer");

const DOCUMENT = analyzeDocument({
  documentId: "pkg-1",
  title: "Testbuch",
  language: "de",
  chapters: [
    {
      id: "c1",
      href: "c1.xhtml",
      title: "Erstes Kapitel",
      blocks: [
        { kind: "paragraph", text: "Ich gehe nach Hause. Gestern ging ich ins Kino." },
        { kind: "paragraph", text: "Die Frau geht schnell, weil es regnet." },
      ],
    },
    { id: "c2", href: "c2.xhtml", title: "Zweites Kapitel", blocks: [{ kind: "paragraph", text: "Wir gehen zusammen." }] },
  ],
}, getLanguageModule("de"), { now: "2026-01-01T00:00:00.000Z" });

function createApi() {
  const snapshot: KnowledgeSnapshot = { lemmas: {}, forms: {} };
  const reviews: ReviewItem[] = [];
  const annotations: LearningAnnotation[] = [];
  const buckets: Array<{ userId: string; language: string; count: number; keys: string[] }> = [];
  const api = {
    languageLearningOpen: vi.fn(async () => ({
      success: true as const,
      document: DOCUMENT,
      packageRoot: "/cache/pkg.lyceum",
      language: "de",
      metadataLanguage: "de",
      reused: true,
    })),
    onLanguageLearningProgress: vi.fn(() => () => undefined),
    languageLearningLoadKnowledge: vi.fn(async () => structuredClone(snapshot)),
    languageLearningSetLemmaState: vi.fn(async (_user: string, record: Omit<KnowledgeRecord, "updatedAt" | "lookupCount">) => {
      const saved: KnowledgeRecord = { lookupCount: 0, translation: null, note: null, ...snapshot.lemmas[record.key], ...record, updatedAt: "t" };
      snapshot.lemmas[record.key] = saved;
      return saved;
    }),
    languageLearningSetFormState: vi.fn(async (_user: string, record: Omit<FormKnowledgeRecord, "updatedAt">) => {
      const saved = { ...record, updatedAt: "t" };
      snapshot.forms[formKey(record.key, record.form)] = saved;
      return saved;
    }),
    languageLearningClearFormState: vi.fn(async () => undefined),
    languageLearningRecordLookup: vi.fn(async () => undefined),
    languageLearningSetTranslation: vi.fn(async () => undefined),
    languageLearningListReviewItems: vi.fn(async () => reviews),
    languageLearningUpsertReviewItem: vi.fn(async (_user: string, item: ReviewItem) => { reviews.push(item); }),
    languageLearningDeleteReviewItem: vi.fn(async () => undefined),
    languageLearningLogReview: vi.fn(async () => undefined),
    languageLearningListReviewLog: vi.fn(async () => []),
    languageLearningListAnnotations: vi.fn(async () => annotations),
    languageLearningSaveAnnotation: vi.fn(async (_user: string, annotation: LearningAnnotation) => { annotations.push(annotation); }),
    languageLearningDeleteAnnotation: vi.fn(async () => undefined),
    languageLearningGetReadingState: vi.fn(async () => null),
    languageLearningSaveReadingState: vi.fn(async () => undefined),
    languageLearningTranslateOnline: vi.fn(async () => ({ success: false as const, error: "UNAVAILABLE" })),
    languageLearningSetLemmaStates: vi.fn(async (_user: string, records: Array<Omit<KnowledgeRecord, "updatedAt" | "lookupCount">>) => {
      for (const record of records) snapshot.lemmas[record.key] = { lookupCount: 0, translation: null, note: null, ...record, updatedAt: "t" };
      return records.length;
    }),
    languageLearningKnowledgeBuckets: vi.fn(async () => buckets),
    languageLearningMergeKnowledge: vi.fn(async () => ({ moved: 2, merged: 0, reviewItems: 0 })),
    languageLearningExportBackup: vi.fn(async () => ({ success: false as const, error: "CANCELLED" })),
    languageLearningImportBackup: vi.fn(async () => ({ success: false as const, error: "CANCELLED" })),
    languageLearningOpenBackupsFolder: vi.fn(async () => ({ success: true })),
    dictionaryGetIndex: vi.fn(async () => []),
    dictionaryLookup: vi.fn(async () => null),
  };
  return Object.assign(api, { snapshot, buckets });
}

let api: ReturnType<typeof createApi>;

beforeEach(() => {
  localStorage.clear();
  api = createApi();
  (window as unknown as { api: unknown }).api = api;
  Element.prototype.scrollIntoView = vi.fn();
});

function chapterTitle(container: HTMLElement) {
  return container.querySelector(".lx-chapter-title")?.textContent ?? null;
}

async function renderViewer() {
  const utils = render(<LyceumLearningViewer fileHash="hash-1" fileName="Testbuch" filePath="/books/testbuch.epub" />);
  await waitFor(() => expect(chapterTitle(utils.container)).toBe("Erstes Kapitel"));
  const surface = utils.container.querySelector<HTMLElement>(".lx-surface")!;
  return { ...utils, surface };
}

function word(surface: HTMLElement, text: string, nth = 0) {
  const matches = Array.from(surface.querySelectorAll<HTMLElement>(".lx-w")).filter((el) => el.textContent === text);
  const element = matches[nth];
  if (!element) throw new Error(`word ${text} not rendered`);
  return element;
}

describe("Language-learning reader", () => {
  it("opens the book through the .lyceum preparation API and renders the original text verbatim", async () => {
    const { surface } = await renderViewer();
    expect(api.languageLearningOpen).toHaveBeenCalledWith({ filePath: "/books/testbuch.epub", fileHash: "hash-1", language: undefined });
    const blocks = Array.from(surface.querySelectorAll(".lx-block")).map((el) => el.textContent);
    expect(blocks).toEqual(DOCUMENT.chapters[0]!.blocks.map((block) => block.text));
  });

  it("selects a word on click and shows lemma information without changing the text", async () => {
    const snapshotBefore = JSON.stringify(DOCUMENT);
    const { surface } = await renderViewer();
    fireEvent.click(word(surface, "ging"));
    const inspector = await screen.findByRole("complementary", { name: "Contexto" });
    expect(within(inspector).getAllByText("gehen").length).toBeGreaterThan(0);
    expect(word(surface, "ging")).toHaveClass("is-selected");
    // All forms of the lemma in the chapter are related.
    expect(word(surface, "gehe")).toHaveClass("is-related");
    expect(api.languageLearningRecordLookup).toHaveBeenCalledWith("local", "de", "gehen", "gehen");
    expect(JSON.stringify(DOCUMENT)).toBe(snapshotBefore);
  });

  it("changes knowledge state from the keyboard at lemma level and patches the text in place", async () => {
    const { surface } = await renderViewer();
    const gehe = word(surface, "gehe");
    expect(gehe).toHaveClass("s-u");
    fireEvent.click(word(surface, "ging"));
    await screen.findByRole("complementary", { name: "Contexto" });
    fireEvent.keyDown(window, { key: "3" });
    await waitFor(() => expect(api.languageLearningSetLemmaState).toHaveBeenCalledWith("local", expect.objectContaining({ key: "gehen", state: "known" })));
    await waitFor(() => expect(gehe).toHaveClass("s-k"));
    expect(word(surface, "geht")).toHaveClass("s-k");
    // Same DOM node: no re-render of the chapter.
    expect(word(surface, "gehe")).toBe(gehe);
  });

  it("opens the right-click menu and ignores a word", async () => {
    const { surface } = await renderViewer();
    fireEvent.contextMenu(word(surface, "Frau"), { clientX: 100, clientY: 100 });
    const menu = await screen.findByRole("menu", { name: "Frau" });
    fireEvent.click(within(menu).getByRole("menuitem", { name: /Ignorar esta palavra/ }));
    await waitFor(() => expect(api.languageLearningSetLemmaState).toHaveBeenCalledWith("local", expect.objectContaining({ key: "Frau", state: "ignored" })));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    fireEvent.contextMenu(word(surface, "Kino"), { clientX: 10, clientY: 10 });
    await screen.findByRole("menu", { name: "Kino" });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("switches between traditional and learning modes", async () => {
    const { surface } = await renderViewer();
    expect(surface).toHaveAttribute("data-mode", "learning");
    fireEvent.click(screen.getByRole("radio", { name: "Ler" }));
    expect(surface).toHaveAttribute("data-mode", "traditional");
    fireEvent.click(screen.getByRole("radio", { name: "Aprender" }));
    expect(surface).toHaveAttribute("data-mode", "learning");
  });

  it("keeps the reading position when the contextual panel opens and closes", async () => {
    const { surface } = await renderViewer();
    surface.scrollTop = 420;
    fireEvent.click(word(surface, "ging"));
    const inspector = await screen.findByRole("complementary", { name: "Contexto" });
    fireEvent.click(within(inspector).getByRole("button", { name: "Fechar" }));
    expect(screen.queryByRole("complementary", { name: "Contexto" })).not.toBeInTheDocument();
    expect(surface.scrollTop).toBe(420);
  });

  it("navigates between lemma occurrences across chapters using stable ids", async () => {
    const { surface } = await renderViewer();
    fireEvent.click(word(surface, "geht"));
    const inspector = await screen.findByRole("complementary", { name: "Contexto" });
    expect(within(inspector).getByText("3 / 4")).toBeInTheDocument();
    fireEvent.click(within(inspector).getByRole("button", { name: "Próxima ocorrência" }));
    // The fourth occurrence ("gehen") lives in chapter 2.
    await waitFor(() => expect(chapterTitle(surface)).toBe("Zweites Kapitel"));
    await waitFor(() => expect(word(surface, "gehen")).toHaveClass("is-selected"));
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it("saves annotations against stable token ids, separate from the document", async () => {
    const { surface } = await renderViewer();
    fireEvent.contextMenu(word(surface, "Kino"), { clientX: 10, clientY: 10 });
    fireEvent.click(within(await screen.findByRole("menu")).getByRole("menuitem", { name: /Adicionar nota/ }));
    fireEvent.change(screen.getByPlaceholderText("Sua nota (opcional)"), { target: { value: "cinema" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    });
    expect(api.languageLearningSaveAnnotation).toHaveBeenCalledWith("local", expect.objectContaining({
      documentId: "pkg-1",
      targetType: "token",
      targetId: "c1.b0.s1.t4",
      quote: "Kino",
      note: "cinema",
    }));
    await waitFor(() => expect(word(surface, "Kino")).toHaveClass("lx-note-mark"));
  });

  it("clicking an unknown word moves it to Learning and adds it to the vocabulary with its context", async () => {
    const { surface } = await renderViewer();
    await act(async () => {
      fireEvent.click(word(surface, "ging"));
    });
    await waitFor(() => expect(api.languageLearningUpsertReviewItem).toHaveBeenCalled());
    await waitFor(() => expect(word(surface, "gehe")).toHaveClass("s-l"));
    expect(api.languageLearningUpsertReviewItem).toHaveBeenCalledWith("local", expect.objectContaining({
      key: "gehen",
      context: "Gestern ging ich ins Kino.",
      contextForm: "ging",
      documentId: "pkg-1",
    }));
    expect(api.languageLearningSetLemmaState).toHaveBeenCalledWith("local", expect.objectContaining({ key: "gehen", state: "learning" }));
  });

  it("does not auto-add when the setting is off, and never on keyboard navigation", async () => {
    localStorage.setItem("lyceum-learning-reader:settings", JSON.stringify({ autoLearnOnClick: false }));
    const { surface } = await renderViewer();
    fireEvent.click(word(surface, "ging"));
    await screen.findByRole("complementary", { name: "Contexto" });
    fireEvent.keyDown(window, { key: "ArrowRight" });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(api.languageLearningUpsertReviewItem).not.toHaveBeenCalled();
    expect(api.languageLearningSetLemmaState).not.toHaveBeenCalled();
  });

  it("lists every word of the book with state buttons, sorted by frequency on request", async () => {
    localStorage.setItem("lyceum-learning-reader:settings", JSON.stringify({ progressPanelOpen: true }));
    await renderViewer();
    const list = await screen.findByRole("list", { name: "Palavras" });
    fireEvent.change(screen.getByRole("combobox", { name: "Ordenar por" }), { target: { value: "frequency" } });
    await waitFor(() => {
      const first = within(list).getAllByRole("listitem")[0]!;
      expect(first).toHaveTextContent("gehen");
      expect(first).toHaveTextContent("×4");
    });
    const row = within(list).getAllByRole("listitem")[0]!;
    await act(async () => {
      fireEvent.click(within(row).getByRole("radio", { name: "Conhecida" }));
    });
    expect(api.languageLearningSetLemmaState).toHaveBeenCalledWith("local", expect.objectContaining({ key: "gehen", state: "known" }));
    fireEvent.click(screen.getByRole("button", { name: /^Conhecida/, pressed: false }));
    await waitFor(() => expect(within(list).getAllByRole("listitem")).toHaveLength(1));
  });

  it("offers to recover vocabulary saved under another language label", async () => {
    api.buckets.push({ userId: "local", language: "pt", count: 3, keys: ["gehen", "Frau", "Kino"] });
    await renderViewer();
    const button = await screen.findByRole("button", { name: /Mover para “de”/ });
    await act(async () => {
      fireEvent.click(button);
    });
    expect(api.languageLearningMergeKnowledge).toHaveBeenCalledWith("local", "local", "pt", "de");
  });

  it("shows an unavailable translation state instead of inventing translations", async () => {
    const { surface } = await renderViewer();
    fireEvent.click(word(surface, "Kino"));
    expect(await screen.findByText(/Nenhuma fonte de tradução disponível/)).toBeInTheDocument();
    expect(api.languageLearningTranslateOnline).not.toHaveBeenCalled();
  });
});
