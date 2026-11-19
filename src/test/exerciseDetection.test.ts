import { describe, expect, it } from "vitest";
import {
  analyzeExercises,
  classifyHeading,
  visibleSections,
  type ExerciseLine,
  type ExercisePageText,
} from "../core/pdf/exercise-detection";

const BODY = 10;

function page(lines: Array<string | [string, number]>, header?: string): ExercisePageText {
  const content: ExerciseLine[] = lines.map((entry, index) => {
    const [text, size] = typeof entry === "string" ? [entry, BODY] : entry;
    return { text, size, top: 0.12 + index * (0.78 / Math.max(lines.length, 1)) };
  });
  if (header) content.unshift({ text: header, size: 8, top: 0.04 });
  return { lines: content };
}

function prose(count = 20, seed = "The theory of groups studies the algebraic structures") {
  return Array.from({ length: count }, (_, index) => `${seed} and their properties in a careful way, line ${index}.`);
}

function exerciseList(start: number, count = 8) {
  return Array.from({ length: count }, (_, index) => `${start + index}. Prove that the group of order ${start + index} is abelian.`);
}

describe("classifyHeading", () => {
  it("recognizes exercise sections in several languages", () => {
    for (const title of ["Exercises", "3.7 Exercises", "Chapter 4 Problems", "Exercícios propostos", "EXERCÍCIOS", "Lista de exercícios",
      "Problem Set 2", "Review Questions", "Exercices", "Ejercicios", "Übungen", "Test yourself", "Questões de vestibular"]) {
      expect(classifyHeading(title), title).toBe("exercise");
    }
  });

  it("separates answer keys from exercises", () => {
    for (const title of ["Solutions to the exercises", "Answers to selected problems", "Respostas", "Gabarito", "Hints and solutions", "Corrigés"]) {
      expect(classifyHeading(title), title).toBe("solution");
    }
  });

  it("does not take items, chapters or prose for sections", () => {
    expect(classifyHeading("Exercise 3.2")).toBe("item");
    expect(classifyHeading("Problem 7.")).toBe("item");
    expect(classifyHeading("Chapter 5 Linear maps")).toBe("chapter");
    expect(classifyHeading("In this chapter we review the problems of the theory")).toBe(null);
    expect(classifyHeading("Bibliography")).toBe("backmatter");
  });

  it("rejects look-alikes found in real books", () => {
    expect(classifyHeading("Solução", true)).toBe(null);
    expect(classifyHeading("14.3 Soluções constantes")).toBe(null);
    expect(classifyHeading("Estratégias de solução")).toBe(null);
    expect(classifyHeading("Hint: Think recursively how to represent the length")).toBe(null);
    expect(classifyHeading("Problem Definition")).toBe(null);
    expect(classifyHeading("CAPÍTULO 4 Aplicações à estatística")).not.toBe("exercise");
    expect(classifyHeading("Answering semantic questions about regular expressions")).toBe(null);
    expect(classifyHeading("Respostas, Sugestões ou Soluções")).toBe("solution");
    expect(classifyHeading("Exercise C-9.42")).toBe("item");
    expect(classifyHeading("R-1.1 Write a short Python function")).toBe("item");
  });
});

describe("analyzeExercises", () => {
  it("finds end-of-chapter exercise sections from headings and stops at the next chapter", () => {
    const pages = [
      page([["Chapter 1 Groups", 18], ...prose()]),
      page(prose()),
      page([...prose(8), ["1.5 Exercises", 13], ...exerciseList(1)]),
      page(exerciseList(9, 14)),
      page([["Chapter 2 Rings", 18], ...prose()]),
      page(prose()),
      page([["Exercises", 13], ...exerciseList(1, 14)]),
      page([["Chapter 3 Fields", 18], ...prose()]),
    ];
    const analysis = analyzeExercises({ pages });
    const exercises = analysis.sections.filter((section) => section.kind === "exercise");
    expect(exercises.map((section) => section.pages)).toEqual([[2, 3], [6]]);
    expect(exercises[0]!.startsMidPage).toBe(true);
    expect(exercises[0]!.method).toBe("heading");
    expect(exercises[0]!.confidence).toBeGreaterThanOrEqual(0.8);
    expect(analysis.chapters.map((chapter) => chapter.startPage)).toEqual([0, 4, 7]);
    expect(exercises.map((section) => section.chapterIndex)).toEqual([0, 1]);
  });

  it("trusts the outline and keeps answer keys apart", () => {
    const pages = Array.from({ length: 10 }, () => page(prose()));
    const analysis = analyzeExercises({
      pages,
      outline: [
        { title: "Chapter 1", pageIndex: 0, depth: 0 },
        { title: "1.1 Basics", pageIndex: 0, depth: 1 },
        { title: "1.2 Exercises", pageIndex: 3, depth: 1 },
        { title: "Chapter 2", pageIndex: 5, depth: 0 },
        { title: "Exercises", pageIndex: 7, depth: 1 },
        { title: "Answers to exercises", pageIndex: 9, depth: 0 },
      ],
    });
    const byKind = (kind: string) => analysis.sections.filter((section) => section.kind === kind).map((section) => section.pages);
    expect(byKind("exercise")).toEqual([[3, 4], [7, 8]]);
    expect(byKind("solution")).toEqual([[9]]);
    expect(visibleSections(analysis, { sensitivity: "strict", includeSolutions: false, includeInline: false }).map((section) => section.kind)).toEqual(["exercise", "exercise"]);
  });

  it("ends a heading section after two pages of prose", () => {
    const pages = [
      page([["Exercises", 13], ...exerciseList(1, 14)]),
      page(prose(20)),
      page(prose(20)),
      page(prose(20)),
    ];
    const analysis = analyzeExercises({ pages });
    expect(analysis.sections.filter((section) => section.kind === "exercise").map((section) => section.pages)).toEqual([[0]]);
  });

  it("uses repeated running headers and ignores the book title header", () => {
    const pages = [
      ...Array.from({ length: 4 }, () => page(prose(), "Algebra for Everyone")),
      page(exerciseList(1, 3).concat(prose(14)), "2.4 Exercises"),
      page(exerciseList(4, 3).concat(prose(14)), "2.4 Exercises"),
      page(exerciseList(7, 3).concat(prose(14)), "2.4 Exercises"),
      ...Array.from({ length: 3 }, () => page(prose(), "Algebra for Everyone")),
    ];
    const analysis = analyzeExercises({ pages });
    expect(analysis.pageKinds.map((kind) => kind === "exercise")).toEqual([false, false, false, false, true, true, true, false, false, false]);
  });

  it("detects exercise pages without any heading by their items, and inline exercises separately", () => {
    const mcq = ["1. Which of the following is a prime number?", "a) 4", "b) 6", "c) 7", "d) 9",
      "2. What is the derivative of x squared?", "a) x", "b) 2x", "c) x/2", "d) 2", "3. Compute 2 + 2.", "4. Explain why the sky is blue."];
    const pages = [
      page(prose()),
      page(mcq),
      page([...prose(10), "Exercise 1.3 Show that the identity is unique.", ...prose(6)]),
    ];
    const analysis = analyzeExercises({ pages });
    expect(analysis.pageKinds).toEqual(["content", "exercise", "inline"]);
    const balanced = visibleSections(analysis, { sensitivity: "balanced", includeSolutions: false, includeInline: false });
    expect(balanced.map((section) => section.pages)).toEqual([[1]]);
  });

  it("does not treat the table of contents as sections", () => {
    const toc = page(["Contents", "1 Groups ........ 1", "1.5 Exercises ........ 12", "2 Rings ........ 15", "2.6 Exercises ........ 30",
      "3 Fields ........ 33", "Answers ........ 50", "Index ........ 60"]);
    const analysis = analyzeExercises({ pages: [toc, page(prose())] });
    expect(analysis.sections).toEqual([]);
  });

  it("reports scans without a text layer", () => {
    const analysis = analyzeExercises({ pages: [{ lines: [] }, { lines: [] }], outline: [{ title: "Exercises", pageIndex: 1, depth: 0 }] });
    expect(analysis.textLayer).toBe("none");
    expect(analysis.sections[0]!.pages).toEqual([1]);
  });
});
