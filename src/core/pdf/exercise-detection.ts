/**
 * Finds the exercise pages of a book (and, separately, its answer keys) from
 * the PDF's text layer and outline. Pure and framework-independent: the
 * desktop worker feeds it lines extracted with pdf.js, tests feed it fixtures.
 *
 * Signals, strongest first:
 *  1. Outline entries titled like an exercise section ("Exercises",
 *     "Exercícios propostos", "Problem Set 3") or an answer key ("Respostas").
 *  2. Headings in the text with those titles. A section runs from the heading
 *     until the next chapter/large heading, an answer key, or two pages of
 *     plain prose in a row.
 *  3. Running headers ("3.7 Exercises" at the top of every page).
 *  4. Item patterns: "Exercise 3.2", "Problem 4", numbered statements with
 *     imperative verbs or question marks, multiple-choice options, blanks.
 *     Pages dense in these become low-confidence sections even without a
 *     heading; isolated items inside the theory become "inline" exercises.
 */

export interface ExerciseLine {
  text: string;
  /** Font size in PDF points. */
  size: number;
  /** Vertical position of the baseline, 0 = top of the page, 1 = bottom. */
  top: number;
}

export interface ExercisePageText {
  lines: ExerciseLine[];
}

export interface ExerciseOutlineEntry {
  title: string;
  /** Zero-based page the entry points to. */
  pageIndex: number;
  /** 0 for top-level entries. */
  depth: number;
}

export type ExerciseSectionKind = "exercise" | "solution" | "inline";
export type ExerciseSectionMethod = "outline" | "heading" | "running-header" | "pattern";
export type ExercisePageKind = ExerciseSectionKind | "content";

export interface ExerciseSection {
  id: string;
  kind: ExerciseSectionKind;
  /** Heading or outline title as printed in the book; empty when the section has none. */
  title: string;
  method: ExerciseSectionMethod;
  /** Zero-based pages, ascending and contiguous. */
  pages: number[];
  /** 0..1 — how sure the detector is that these pages are what `kind` says. */
  confidence: number;
  /** The first page also carries theory before the section starts. */
  startsMidPage: boolean;
  /** The last page also carries content after the section ends. */
  endsMidPage: boolean;
  /** Exercise-like items counted in the section (numbered statements, "Problem 3", ...). */
  itemCount: number;
  /** Index into `chapters`, or -1 before the first chapter / when the book has none. */
  chapterIndex: number;
}

export interface ExerciseChapter {
  title: string;
  startPage: number;
}

export interface ExerciseAnalysis {
  pageCount: number;
  /** "none": a scan without text — only the outline could be used. */
  textLayer: "full" | "partial" | "none";
  chapters: ExerciseChapter[];
  sections: ExerciseSection[];
  /** Per page, what the strongest section covering it is. */
  pageKinds: ExercisePageKind[];
}

// ----- text helpers -----------------------------------------------------------

export function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[‐-―]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

const ROMAN = "[ivxlc]+";
/** "Chapter 3", "3.", "3.7", "IV -", "§2" — numbering that precedes a title. */
const LEADING_NUMBER = new RegExp(`^(?:§\\s*)?(?:\\d+(?:[.\\-]\\d+)*|${ROMAN}|[a-z])(?:[.):\\-]|\\s)\\s*`);
const CHAPTER_WORD = "chapter|chap|capitulo|cap|chapitre|kapitel|capitolo|unidade|unidad|unit|unite|lesson|licao|leccion|lecon|aula|modulo|module|tema|topic|part|parte|partie|teil|livro|book|semana|week";
const CHAPTER_PREFIX = new RegExp(`^(?:${CHAPTER_WORD})\\.?\\s+(?:\\d+|${ROMAN}|[a-z]+)\\b[\\s.:\\-]*`);

/** Strips numbering, chapter prefixes, dot leaders and trailing page numbers. */
export function headingCore(text: string): string {
  let value = normalizeText(text)
    .replace(/\s*\.{2,}\s*\d*\s*$/, "")
    .replace(/\s+\d{1,4}$/, "")
    .replace(/[*:•\-–—|]+$/, "")
    .trim();
  for (let guard = 0; guard < 3; guard += 1) {
    const next = value.replace(CHAPTER_PREFIX, "").replace(LEADING_NUMBER, "").trim();
    if (next === value || !next) break;
    value = next;
  }
  return value;
}

const EXERCISE_TERMS = [
  "exercises?", "exercise set", "exercicios?", "exercices?", "ejercicios?", "esercizi(?:o)?", "ubungen", "ubungsaufgaben", "aufgaben",
  "problems?", "problem set", "problemas?", "problemes?", "probleme", "problemi",
  "questions?", "questoes", "questao", "cuestiones", "preguntas", "fragen", "domande",
  "practice(?: problems| questions| exercises)?", "pratique", "praticando", "para praticar", "pratica", "praxis",
  "homework", "assignments?", "tarefas?", "atividades?", "actividades", "activites", "deveres", "devoirs",
  "drills?", "quiz(?:zes)?", "quizz", "worksheets?", "testes? (?:de|seus|sua)", "tests? (?:yourself|your)",
  "self[- ]?(?:test|assessment|check|evaluation)", "autoavaliacao", "autoevaluacion", "auto-avaliacao",
  "test yourself", "teste seus conhecimentos", "teste sua compreensao", "check your (?:understanding|progress|knowledge)",
  "verifique (?:seu aprendizado|o que aprendeu)", "fixacao", "lista de exercicios", "lista \\d+", "review (?:questions|exercises|problems)",
  "exercicios de revisao", "repaso", "exam(?:ination)? questions", "questoes de (?:vestibular|concursos?|enem|revisao)",
  "vestibulares?", "desafios?", "mise en pratique",
  "a vous de jouer", "a toi de jouer", "entrainement", "s'entrainer", "on s'entraine", "travaux diriges", "td",
  "exercitando", "exercite", "hora de praticar", "agora e com voce", "aprofundando",
];

const SOLUTION_TERMS = [
  "answers?", "answer key", "solutions?", "worked solutions", "hints?", "hints and (?:solutions|answers)",
  "respostas?", "gabaritos?", "solucoes", "solucao", "resolucoes", "resolucao", "resolucoes comentadas",
  "corriges?", "corrections?", "solutions des exercices", "soluciones", "solucionario", "respuestas",
  "losungen", "losungshinweise", "soluzioni", "risposte", "chave de respostas", "comentarios",
];

const BACKMATTER_TERMS = [
  "references", "bibliography", "bibliografia", "referencias", "bibliographie", "literatur", "index", "indice",
  "indice remissivo", "appendix", "appendices", "apendice", "anexos?", "glossary", "glossario", "glossaire",
  "acknowledg(?:e)?ments", "agradecimentos", "about the author", "sobre o autor", "further reading", "leituras complementares",
  "notes", "notas", "summary", "resumo", "conclusion", "conclusao", "introduction", "introducao", "preface", "prefacio",
  "contents", "sumario", "table of contents", "table des matieres",
];

const words = (terms: string[]) => `(?:${terms.join("|")})`;
// Up to three leading words ("Additional", "Exercícios de", "Mais"), the term, and a short tail.
const EXERCISE_HEADING = new RegExp(`^${words(EXERCISE_TERMS)}(?:\\s+[\\p{L}\\d'.,()-]+){0,6}$`, "u");
// With words before the term ("Additional problems", "Mais exercícios resolvidos") only a short tail is allowed.
const EXERCISE_HEADING_LATE = new RegExp(`^(?:[\\p{L}'-]+\\s+){1,3}${words(EXERCISE_TERMS)}(?:\\s+[\\p{L}\\d'.,()-]+){0,2}$`, "u");
const EXERCISE_FIRST = new RegExp(`^${words(EXERCISE_TERMS)}\\b`, "u");
const SOLUTION_HEADING = new RegExp(`^(?:(?:selected|brief|short|worked|partial|full|complete|odd|even|odd-numbered|chapter|answers? and|hints? and)\\s+)?${words(SOLUTION_TERMS)}\\b`, "u");
/** After a singular answer word only these may follow: "Solution to ...", "Resposta dos ...". */
const SOLUTION_LINK = /^(?:to|for|of|key|keys|manual|dos|das|aos|as|de|des|du|da|do|e|and|or|ou|y|o|und|zu|ai|alle|selected|selecionadas|selecionados|comentadas|comentados|sugestoes|hints?|answers?|solutions?|respostas?|solucoes|resolucoes|gabarito|et|aux|exercises|exercicios)$/;
const ANSWER_WORD = /^(?:solutions?|solucoes|solucao|resolucoes|resolucao|respostas?|answers?|hints?|gabaritos?|corriges?|corrections?|soluciones|respuestas|losungen|soluzioni|risposte|solucionario|comentarios)$/;
const SOLUTION_FIRST = new RegExp(`^${words(SOLUTION_TERMS)}\\b`, "u");
const BACKMATTER_HEADING = new RegExp(`^${words(BACKMATTER_TERMS)}\\b`, "u");
const CHAPTER_HEADING = new RegExp(`^(?:${CHAPTER_WORD})\\.?\\s+(?:\\d+|${ROMAN}|[a-z]+)\\b`);
/** A single exercise statement, not a section: "Exercise 3.2", "Problem 7", "Questão 12". */
const ITEM_LABEL = /^(?:exercise|exercicio|exercice|ejercicio|esercizio|aufgabe|ubung|problem|problema|probleme|question|questao|cuestion|pregunta|activity|atividade|exemplo resolvido|q)\s*\.?\s*\(?(?:[a-z]-?)?\d+(?:[.-]\d+)*\)?(?:\b|[.):])|^[rcpe]-\d+(?:\.\d+)+\b/;
/** "Answer 3", "Solution 2.4" — an answer to one item. */
const SOLUTION_ITEM = /^(?:solution|answer|solucao|resolucao|resposta|solucion|respuesta|losung|soluzione)\s*\.?\s*\(?\d+(?:[.-]\d+)*\)?/;
/**
 * Singular "Solução" / "Solution" / "Resposta" usually follows one worked
 * example inside the theory; it only names an answer key when set large.
 */
const SINGULAR_SOLUTION = /^(?:solution|solucao|resolucao|resposta|answer|hint|solucion|respuesta|losung|soluzione|correction|corrige)$/;
/** Phrases that look like "Questions" headings but are not exercises. */
const NOT_EXERCISE = /\b(?:frequently asked|faq|perguntas frequentes|open questions|questoes em aberto|research problems)\b/;
/** Words that would make "Exercises" part of a sentence rather than a heading. */
const SENTENCE_WORDS = /\b(?:the|this|these|in|of|see|veja|ver|os|as|dos|das|nos|nas|que|is|are|for|para|com|with|will|you|voce)\b/;

export type HeadingClass = "exercise" | "solution" | "chapter" | "backmatter" | "item" | "solution-item" | null;

/**
 * Classifies a short line (a heading or an outline title). `strict` refuses
 * titles where the keyword is not the first word — used for body-sized lines,
 * which are only headings when they are exactly a section name.
 */
export function classifyHeading(text: string, strict = false): HeadingClass {
  const raw = normalizeText(text);
  if (!raw || raw.length > 110) return null;
  if (ITEM_LABEL.test(raw)) return "item";
  if (SOLUTION_ITEM.test(raw)) return "solution-item";
  const core = headingCore(text);
  if (!core) return CHAPTER_HEADING.test(raw) ? "chapter" : null;
  const wordCount = core.split(" ").length;
  if (NOT_EXERCISE.test(core)) return null;
  // Singular "Problem Definition", "Exercício resolvido", "Question answering" name one thing, not a list.
  if (/^(?:exercise|exercicio|exercice|ejercicio|problem|problema|probleme|question|questao|pregunta)\s+(?!set\b|sheet\b|list\b)\S/.test(core)) return null;
  const tokens = core.split(/[\s.:,;!?()]+/).filter(Boolean);
  if (strict && SINGULAR_SOLUTION.test(core)) return null;
  // Answer keys first: "Solutions to the exercises" mentions both.
  if ((strict ? SOLUTION_FIRST : SOLUTION_HEADING).test(core) && wordCount <= 9) {
    const answerAt = tokens.findIndex((token) => ANSWER_WORD.test(token));
    const next = answerAt >= 0 ? tokens[answerAt + 1] : undefined;
    // "Hint: think recursively…", "Solução trivial", "Soluções constantes" are content, not answer keys.
    if (answerAt < 0 || next === undefined || SOLUTION_LINK.test(next)) return "solution";
    return null;
  }
  if (wordCount <= 10 && (strict ? EXERCISE_FIRST.test(core) && wordCount <= 5 : EXERCISE_HEADING.test(core) || EXERCISE_HEADING_LATE.test(core))) {
    // "In this chapter we review ..." is prose, not a heading.
    const leading = core.split(" ").slice(0, 2).join(" ");
    if (!EXERCISE_FIRST.test(core) && SENTENCE_WORDS.test(leading)) return null;
    return "exercise";
  }
  if (CHAPTER_HEADING.test(raw)) return "chapter";
  if (BACKMATTER_HEADING.test(core) && wordCount <= 5) return "backmatter";
  return null;
}

// ----- item patterns ----------------------------------------------------------

const IMPERATIVE = new RegExp(`^(?:${[
  // English
  "prove", "show", "find", "compute", "calculate", "determine", "evaluate", "solve", "explain", "describe", "write", "use",
  "verify", "sketch", "simplify", "derive", "estimate", "give", "state", "define", "identify", "compare", "discuss",
  "list", "draw", "graph", "plot", "factor", "expand", "convert", "translate", "complete", "fill", "match", "choose",
  "select", "circle", "classify", "justify", "construct", "suppose", "let", "consider", "assume", "how", "what", "why",
  "which", "when", "where", "who", "is", "are", "does", "do", "can",
  // Portuguese
  "demonstre", "mostre", "prove", "calcule", "determine", "encontre", "ache", "obtenha", "resolva", "explique", "descreva",
  "escreva", "use", "utilize", "verifique", "esboce", "simplifique", "deduza", "estime", "de", "defina", "identifique",
  "compare", "discuta", "liste", "desenhe", "construa", "fatore", "converta", "traduza", "complete", "preencha", "relacione",
  "associe", "assinale", "marque", "escolha", "circule", "classifique", "justifique", "suponha", "seja", "considere",
  "responda", "cite", "indique", "analise", "elabore", "redija", "leia", "observe", "qual", "quais", "quanto", "quantos",
  "como", "por que", "porque", "o que", "quando", "onde", "quem",
  // French
  "demontrer", "demontrez", "montrer", "montrez", "calculer", "calculez", "determiner", "determinez", "trouver", "trouvez",
  "resoudre", "resolvez", "expliquer", "expliquez", "ecrire", "ecrivez", "completer", "completez", "justifier", "justifiez",
  "traduisez", "conjuguez", "repondez", "quel", "quelle", "quels", "pourquoi", "comment",
  // Spanish / Italian / German
  "demuestra", "demuestre", "calcula", "resuelve", "resuelva", "explica", "explique", "escribe", "encuentra", "halla",
  "dimostrare", "calcolare", "risolvere", "spiegare", "berechnen", "berechne", "zeigen", "zeige", "bestimmen", "bestimme",
  "losen", "lose", "erklaren", "erklare", "beweisen", "beweise",
].join("|")})\\b`);

const NUMBERED = /^(?:\(\d{1,3}\)|\d{1,3}[.)]|\d{1,3}\s+[-–]|[①-⑳])\s*(?=\S)/;
const OPTION = /^(?:\(?[a-e]\)|[a-e][.)]\s|\([a-e]\)|[a-e]\s[-–]\s)/;
const BLANK = /_{4,}|(?:\.\s?){8,}(?!\s*\d+\s*$)|\[\s{2,}\]|\(\s{3,}\)/;
const TOC_LINE = /(?:\.{3,}|\s{2,}|\s)\d{1,4}\s*$/;
const PURE_NUMBER = /^(?:page\s+|p\.?\s*|pag\.?\s*)?[\divxlc]{1,6}(?:\s*(?:of|de|\/)\s*\d+)?$/;

export interface PageSignals {
  labeled: number;
  numbered: number;
  cues: number;
  options: number;
  blanks: number;
  questions: number;
  solutionItems: number;
  contentLines: number;
  chars: number;
}

function lineSignals(text: string, signals: PageSignals) {
  const normalized = normalizeText(text);
  if (ITEM_LABEL.test(normalized)) signals.labeled += 1;
  else if (SOLUTION_ITEM.test(normalized)) signals.solutionItems += 1;
  if (NUMBERED.test(normalized)) {
    signals.numbered += 1;
    const statement = normalized.replace(NUMBERED, "");
    if (IMPERATIVE.test(statement) || statement.endsWith("?")) signals.cues += 1;
  } else if (OPTION.test(normalized)) {
    signals.options += 1;
  }
  if (normalized.endsWith("?")) signals.questions += 1;
  if (BLANK.test(text)) signals.blanks += 1;
}

/** How exercise-like a page reads on its own, 0..1. */
export function itemDensity(signals: PageSignals): number {
  const weighted = signals.labeled * 2 + signals.cues * 1.5 + signals.numbered * 0.6 + signals.options * 0.35
    + signals.blanks * 0.5 + signals.questions * 0.5;
  return Math.min(1, weighted / Math.max(8, signals.contentLines));
}

function itemCount(signals: PageSignals) {
  return signals.labeled + Math.max(signals.cues, Math.round(signals.numbered * 0.6)) + Math.floor(signals.options / 4);
}

/** A page that is clearly a list of exercises even without a heading. */
function strongPattern(signals: PageSignals) {
  return signals.labeled >= 3
    || (signals.numbered >= 4 && signals.cues >= 3)
    || (signals.options >= 8 && signals.numbered + signals.labeled >= 2)
    || (signals.blanks >= 4 && signals.numbered >= 3)
    || (signals.numbered >= 3 && signals.questions >= 3);
}

// ----- analysis -----------------------------------------------------------------

interface PreparedLine extends ExerciseLine {
  normalized: string;
}

interface PreparedPage {
  lines: PreparedLine[];
  signals: PageSignals;
  toc: boolean;
  runningExercise: boolean;
  runningSolution: boolean;
}

/** The size most characters are set in. */
function bodyFontSize(pages: ExercisePageText[]) {
  const weights = new Map<number, number>();
  for (const page of pages) {
    for (const line of page.lines) {
      if (!(line.size > 0)) continue;
      const key = Math.round(line.size * 2) / 2;
      weights.set(key, (weights.get(key) ?? 0) + line.text.length);
    }
  }
  let best = 0;
  let bestWeight = -1;
  for (const [size, weight] of weights) {
    if (weight > bestWeight) {
      best = size;
      bestWeight = weight;
    }
  }
  return best || 10;
}

function marginKey(text: string) {
  return normalizeText(text).replace(/\b(?:\d+|[ivxlc]+)\b/g, "#").replace(/[^\p{L}#]+/gu, " ").trim();
}

/**
 * Splits page lines into running headers/footers (repeated text near the
 * edges, page numbers) and content, and flags running headers that name an
 * exercise section or an answer key.
 */
function preparePages(pages: ExercisePageText[], contentsPages: Set<number>): PreparedPage[] {
  const marginal = (line: ExerciseLine) => line.top < 0.09 || line.top > 0.92;
  const keyCounts = new Map<string, number>();
  for (const page of pages) {
    const seen = new Set<string>();
    for (const line of page.lines) {
      if (!marginal(line)) continue;
      const key = marginKey(line.text);
      if (key.length < 3 || seen.has(key)) continue;
      seen.add(key);
      keyCounts.set(key, (keyCounts.get(key) ?? 0) + 1);
    }
  }
  const repeatThreshold = Math.max(3, Math.min(8, Math.ceil(pages.length * 0.03)));
  // A header on most pages is the book's or chapter's title — it says nothing about sections.
  const ubiquitous = Math.max(6, pages.length * 0.5);

  return pages.map((page, pageIndex) => {
    const signals: PageSignals = { labeled: 0, numbered: 0, cues: 0, options: 0, blanks: 0, questions: 0, solutionItems: 0, contentLines: 0, chars: 0 };
    const lines: PreparedLine[] = [];
    let runningExercise = false;
    let runningSolution = false;
    let tocLines = 0;
    for (const line of page.lines) {
      const text = line.text.trim();
      if (!text) continue;
      const normalized = normalizeText(text);
      signals.chars += text.length;
      if (marginal(line)) {
        if (PURE_NUMBER.test(normalized)) continue;
        const count = keyCounts.get(marginKey(text)) ?? 0;
        if (count >= repeatThreshold) {
          if (count < ubiquitous && normalized.length <= 90) {
            const heading = classifyHeading(text);
            if (heading === "exercise") runningExercise = true;
            else if (heading === "solution") runningSolution = true;
          }
          continue;
        }
      }
      if (TOC_LINE.test(normalized) && /\p{L}{3}/u.test(normalized) && normalized.length > 6) tocLines += 1;
      // Page numbers set in their own column come out as separate lines.
      if (/^\d{1,4}$/.test(normalized)) tocLines += 0.8;
      lines.push({ ...line, text, normalized });
      signals.contentLines += 1;
      lineSignals(text, signals);
    }
    const toc = contentsPages.has(pageIndex) || (lines.length >= 6 && tocLines / lines.length > 0.4);
    return { lines, signals, toc, runningExercise, runningSolution };
  });
}

type Mark = {
  kind: ExerciseSectionKind;
  method: ExerciseSectionMethod;
  key: string;
  title: string;
  confidence: number;
  startsMid?: boolean;
  endsMid?: boolean;
};

const METHOD_RANK: Record<ExerciseSectionMethod, number> = { outline: 4, heading: 3, "running-header": 2, pattern: 1 };

function chooseChapters(outline: ExerciseOutlineEntry[], prepared: PreparedPage[], body: number, pageCount: number): ExerciseChapter[] {
  if (outline.length) {
    const byDepth = new Map<number, ExerciseOutlineEntry[]>();
    for (const entry of outline) byDepth.set(entry.depth, [...(byDepth.get(entry.depth) ?? []), entry]);
    const depths = [...byDepth.keys()].sort((a, b) => a - b);
    // Prefer the level that reads like chapters; else the first level with more than one entry.
    let chosen = depths.find((depth) => {
      const entries = byDepth.get(depth)!;
      return entries.length >= 2 && entries.filter((entry) => classifyHeading(entry.title) === "chapter").length >= Math.max(2, entries.length * 0.4);
    });
    if (chosen === undefined) chosen = depths.find((depth) => byDepth.get(depth)!.length >= 2) ?? depths[0]!;
    const entries = byDepth.get(chosen)!
      .filter((entry) => entry.pageIndex >= 0 && entry.pageIndex < pageCount)
      .filter((entry) => {
        const cls = classifyHeading(entry.title);
        return cls !== "exercise" && cls !== "solution" && cls !== "item";
      })
      .sort((a, b) => a.pageIndex - b.pageIndex);
    const chapters: ExerciseChapter[] = [];
    for (const entry of entries) {
      if (chapters.length && chapters[chapters.length - 1]!.startPage === entry.pageIndex) continue;
      chapters.push({ title: entry.title.trim(), startPage: entry.pageIndex });
    }
    if (chapters.length >= 2) return chapters;
  }
  // No usable outline: "Chapter 3"-style headings or the largest headings in the book.
  const chapters: ExerciseChapter[] = [];
  prepared.forEach((page, pageIndex) => {
    if (page.toc) return;
    const line = page.lines.slice(0, 6).find((candidate) =>
      classifyHeading(candidate.text) === "chapter" && (candidate.size >= body * 1.15 || candidate.normalized.split(" ").length <= 6));
    if (line && (!chapters.length || chapters[chapters.length - 1]!.startPage !== pageIndex)) {
      const next = page.lines[page.lines.indexOf(line) + 1];
      const title = next && next.size >= body * 1.15 && next.text.length < 80 && !/^\d/.test(next.text) ? `${line.text} — ${next.text}` : line.text;
      chapters.push({ title, startPage: pageIndex });
    }
  });
  return chapters.length >= 2 ? chapters : [];
}

/** Outline entries' page ranges (an entry ends where the next entry of the same or a higher level starts). */
function outlineRanges(outline: ExerciseOutlineEntry[], pageCount: number) {
  return outline.map((entry, index) => {
    let end = pageCount - 1;
    let sharesEnd = false;
    for (let next = index + 1; next < outline.length; next += 1) {
      const candidate = outline[next]!;
      if (candidate.depth <= entry.depth) {
        end = Math.max(entry.pageIndex, candidate.pageIndex - 1);
        sharesEnd = candidate.pageIndex === entry.pageIndex;
        break;
      }
    }
    const previous = outline[index - 1];
    const startsMid = Boolean(previous && previous.pageIndex === entry.pageIndex);
    return { entry, start: entry.pageIndex, end: Math.min(end, pageCount - 1), startsMid, endsMid: sharesEnd };
  });
}

export function analyzeExercises(input: {
  pages: ExercisePageText[];
  outline?: ExerciseOutlineEntry[];
}): ExerciseAnalysis {
  const pageCount = input.pages.length;
  const outline = (input.outline ?? []).filter((entry) => Number.isInteger(entry.pageIndex) && entry.pageIndex >= 0 && entry.pageIndex < pageCount);
  // Pages the outline calls "Contents"/"Sumário" are a table of contents, whatever they look like.
  const contentsPages = new Set<number>();
  outlineRanges(outline, pageCount).forEach(({ entry, start, end }) => {
    if (/^(?:contents|table of contents|sumario|indice|table des matieres|inhalt|inhaltsverzeichnis|indice general)$/.test(headingCore(entry.title)) && end - start <= 20) {
      for (let page = start; page <= end; page += 1) contentsPages.add(page);
    }
  });
  const prepared = preparePages(input.pages, contentsPages);
  const body = bodyFontSize(input.pages);
  const textPages = prepared.filter((page) => page.signals.chars >= 25).length;
  const textLayer: ExerciseAnalysis["textLayer"] = pageCount === 0 || textPages / pageCount < 0.15
    ? "none"
    : textPages / pageCount < 0.8 ? "partial" : "full";

  const marks: Array<Mark | null> = new Array(pageCount).fill(null);
  const setMark = (page: number, mark: Mark) => {
    const current = marks[page];
    if (!current) {
      marks[page] = mark;
      return;
    }
    // Answer keys beat exercises when both claim a page through equally strong signals.
    const better = METHOD_RANK[mark.method] > METHOD_RANK[current.method]
      || (METHOD_RANK[mark.method] === METHOD_RANK[current.method] && mark.confidence > current.confidence);
    if (better) marks[page] = mark;
  };

  // 1. Outline.
  outlineRanges(outline, pageCount).forEach(({ entry, start, end, startsMid, endsMid }, index) => {
    const cls = classifyHeading(entry.title);
    let kind: ExerciseSectionKind | null = null;
    if (cls === "exercise") kind = "exercise";
    else if (cls === "solution") kind = "solution";
    else if (cls === "item" && end - start <= 3) kind = "exercise";
    if (!kind) return;
    // Consecutive "Exercise 1.1", "Exercise 1.2" outline entries form one section.
    const parentKey = cls === "item" ? `oi:${entry.depth}:${outline.slice(0, index).filter((candidate) => candidate.depth < entry.depth).length}` : `o:${index}`;
    for (let page = start; page <= end; page += 1) {
      setMark(page, {
        kind,
        method: "outline",
        key: parentKey,
        title: cls === "item" ? "" : entry.title.trim(),
        confidence: cls === "item" ? 0.85 : 0.95,
        startsMid: page === start && startsMid,
        endsMid: page === end && endsMid,
      });
    }
  });

  // 2. Headings in the text, as a section state machine across pages.
  type Open = { kind: "exercise" | "solution"; title: string; key: string; startPage: number; startsMid: boolean; items: number; pages: number[]; prose: number[] };
  let open: Open | null = null;
  let sectionCounter = 0;
  const finished: Array<Open & { endsMid: boolean }> = [];
  const close = (endsMid: boolean, dropTrailingProse = true) => {
    if (!open) return;
    if (dropTrailingProse && open.prose.length) open.pages = open.pages.filter((page) => !open!.prose.includes(page));
    if (open.pages.length) finished.push({ ...open, endsMid });
    open = null;
  };

  prepared.forEach((page, pageIndex) => {
    if (page.toc) return;
    let contentBefore = 0;
    let pageItems = 0;
    let sawBreakAtTop = false;
    for (const line of page.lines) {
      const big = line.size >= body * 1.15;
      const huge = line.size >= body * 1.3;
      const short = line.text.length <= 90;
      let cls: HeadingClass = null;
      if (short && (big || line.text.length <= 60)) cls = classifyHeading(line.text, !big);
      if (cls === "solution" && !huge && SINGULAR_SOLUTION.test(headingCore(line.text))) cls = null;
      if (cls === "exercise" || cls === "solution") {
        // A body-size line counts only when it stands alone (no sentence punctuation).
        if (!big && /[,;]\s|\.\s+\p{L}|\p{L}{3}\.$/u.test(line.text)) cls = null;
        // A line starting in lowercase is the tail of a wrapped sentence.
        if (/^\p{Ll}/u.test(line.text)) cls = null;
      }
      if (cls === "exercise" || cls === "solution") {
        if (open && open.kind === cls && open.pages.includes(pageIndex) && contentBefore < 3) {
          // "Exercises" followed by "Exercícios de fixação" on the same page: same section.
          continue;
        }
        const mid = contentBefore >= 3;
        if (open) {
          if (!mid && open.pages[open.pages.length - 1] === pageIndex) open.pages.pop();
          close(mid);
        }
        sectionCounter += 1;
        open = { kind: cls, title: line.text.trim(), key: `h:${sectionCounter}`, startPage: pageIndex, startsMid: mid, items: 0, pages: [pageIndex], prose: [] };
      } else if (open && (cls === "chapter" || cls === "backmatter" || (huge && short && cls !== "item" && cls !== "solution-item" && !NUMBERED.test(line.normalized)))) {
        if (contentBefore < 3) {
          if (open.pages[open.pages.length - 1] === pageIndex) open.pages.pop();
          sawBreakAtTop = true;
          close(false);
        } else {
          close(true);
        }
      } else if (open) {
        if (!open.pages.includes(pageIndex)) open.pages.push(pageIndex);
      }
      contentBefore += 1;
    }
    if (open) {
      const items = itemCount(page.signals);
      pageItems = items;
      const target: Open = open;
      if (!target.pages.includes(pageIndex) && !sawBreakAtTop) target.pages.push(pageIndex);
      target.items += pageItems;
      // Two pages of plain prose in a row end the section (a figure-only page does not count).
      const prose = page.signals.contentLines >= 14 && pageItems === 0 && page.signals.solutionItems === 0
        && itemDensity(page.signals) < 0.05 && !page.runningExercise && !page.runningSolution;
      if (prose && target.startPage !== pageIndex) {
        target.prose.push(pageIndex);
        if (target.prose.length >= 2) close(false);
      } else if (!prose) {
        target.prose = [];
      }
    }
  });
  close(false);

  for (const section of finished) {
    const perPage = section.items / Math.max(1, section.pages.length);
    let confidence = section.kind === "solution" ? 0.85 : 0.8;
    if (perPage >= 2) confidence += 0.1;
    else if (section.items === 0) confidence -= section.kind === "solution" ? 0.05 : 0.15;
    const first = section.pages[0];
    const last = section.pages[section.pages.length - 1];
    for (const page of section.pages) {
      setMark(page, {
        kind: section.kind,
        method: "heading",
        key: section.key,
        title: section.title,
        confidence: Math.min(0.92, confidence),
        startsMid: page === first && section.startsMid,
        endsMid: page === last && section.endsMid,
      });
    }
  }

  // 3. Running headers.
  prepared.forEach((page, pageIndex) => {
    if (!page.runningExercise && !page.runningSolution) return;
    const previous = marks[pageIndex - 1];
    const kind = page.runningSolution ? "solution" : "exercise";
    const key = previous && previous.kind === kind && previous.method === "running-header" ? previous.key : `r:${pageIndex}`;
    setMark(pageIndex, { kind, method: "running-header", key, title: "", confidence: 0.75 });
  });

  // 4. Pattern-only pages.
  prepared.forEach((page, pageIndex) => {
    if (page.toc || marks[pageIndex]) return;
    const signals = page.signals;
    const previous = marks[pageIndex - 1];
    if (strongPattern(signals)) {
      const density = itemDensity(signals);
      const key = previous && previous.kind === "exercise" && previous.method === "pattern" ? previous.key : `p:${pageIndex}`;
      setMark(pageIndex, { kind: "exercise", method: "pattern", key, title: "", confidence: Math.min(0.7, 0.45 + density * 0.4) });
    } else if (signals.solutionItems >= 3) {
      const key = previous && previous.kind === "solution" && previous.method === "pattern" ? previous.key : `ps:${pageIndex}`;
      setMark(pageIndex, { kind: "solution", method: "pattern", key, title: "", confidence: 0.55 });
    } else if (signals.labeled >= 1) {
      const key = previous && previous.kind === "inline" ? previous.key : `i:${pageIndex}`;
      setMark(pageIndex, { kind: "inline", method: "pattern", key, title: "", confidence: 0.5, startsMid: true, endsMid: true });
    }
  });

  // Group consecutive pages with the same mark into sections.
  const chapters = chooseChapters(outline, prepared, body, pageCount);
  const chapterOf = (page: number) => {
    let index = -1;
    for (let i = 0; i < chapters.length; i += 1) if (chapters[i]!.startPage <= page) index = i;
    return index;
  };
  const sections: ExerciseSection[] = [];
  let current: ExerciseSection | null = null;
  let currentKey = "";
  let confidenceSum = 0;
  marks.forEach((mark, page) => {
    const chapterIndex = chapterOf(page);
    const continues = mark && current && currentKey === mark.key && current.pages[current.pages.length - 1] === page - 1
      && (current.chapterIndex === chapterIndex || mark.method === "outline");
    if (mark && continues && current) {
      current.pages.push(page);
      current.endsMidPage = Boolean(mark.endsMid);
      current.itemCount += itemCount(prepared[page]!.signals);
      confidenceSum += mark.confidence;
      current.confidence = confidenceSum / current.pages.length;
      return;
    }
    if (!mark) {
      current = null;
      currentKey = "";
      return;
    }
    confidenceSum = mark.confidence;
    current = {
      id: `section-${sections.length + 1}`,
      kind: mark.kind,
      title: mark.title,
      method: mark.method,
      pages: [page],
      confidence: mark.confidence,
      startsMidPage: Boolean(mark.startsMid),
      endsMidPage: Boolean(mark.endsMid),
      itemCount: itemCount(prepared[page]!.signals),
      chapterIndex,
    };
    currentKey = mark.key;
    sections.push(current);
  });

  for (const section of sections) section.confidence = Math.round(section.confidence * 100) / 100;

  return {
    pageCount,
    textLayer,
    chapters,
    sections,
    pageKinds: marks.map((mark) => mark?.kind ?? "content"),
  };
}

/** Confidence floor for each sensitivity level offered in the UI. */
export const EXERCISE_SENSITIVITY = { strict: 0.75, balanced: 0.55, broad: 0.4 } as const;
export type ExerciseSensitivity = keyof typeof EXERCISE_SENSITIVITY;

export function visibleSections(
  analysis: ExerciseAnalysis,
  options: { sensitivity: ExerciseSensitivity; includeSolutions: boolean; includeInline: boolean },
): ExerciseSection[] {
  const floor = EXERCISE_SENSITIVITY[options.sensitivity];
  return analysis.sections.filter((section) => {
    if (section.kind === "solution" && !options.includeSolutions) return false;
    if (section.kind === "inline" && !options.includeInline) return false;
    return section.confidence >= floor || (section.kind === "inline" && options.includeInline);
  });
}
