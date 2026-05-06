import JSZip from "jszip";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { packageEpub } from "../lib/pdf-to-epub/epub";
import { analyzeFontSizes, buildLines, computeDocumentStats, createLine } from "../lib/pdf-to-epub/geometry";
import { applyReadingOrder } from "../lib/pdf-to-epub/layout";
import { removeNoiseLines } from "../lib/pdf-to-epub/noise";
import { buildParagraphs } from "../lib/pdf-to-epub/paragraphs";
import { parsePdfToPages, reconstructStructureFromPages } from "../lib/pdf-to-epub/pipeline";
import { paragraphToBlock } from "../lib/pdf-to-epub/semantics";
import type { Line, PageModel, Paragraph, Token } from "../lib/pdf-to-epub/types";

function token(text: string, x: number, y: number, pageNumber = 1, width = text.length * 6): Token {
  return {
    text,
    x,
    y,
    width,
    height: 10,
    fontName: "Times-Roman",
    fontSize: 10,
    pageNumber,
  };
}

function line(text: string, x: number, y: number, pageNumber = 1, width = text.length * 6): Line {
  return createLine([token(text, x, y, pageNumber, width)]);
}

function page(pageNumber: number, lines: Line[], width = 600, height = 800): PageModel {
  return {
    pageNumber,
    width,
    height,
    tokens: lines.flatMap((item) => item.tokens),
    lines,
    orderedLines: lines,
  };
}

describe("pdf-to-epub geometry", () => {
  it("groups tokens into lines by baseline and reconstructs geometric spaces", () => {
    const lines = buildLines([
      token("Hello", 40, 100, 1, 30),
      token("world", 82, 100.3, 1, 30),
      token("Next", 40, 125, 1, 24),
    ]);

    expect(lines).toHaveLength(2);
    expect(lines[0].text).toBe("Hello world");
    expect(lines[0].bbox).toMatchObject({ x0: 40, x1: 112 });
    expect(lines[1].text).toBe("Next");
  });

  it("parses an actual PDF without requiring a loose pdf.worker.mjs file", async () => {
    const pdf = await PDFDocument.create();
    const pdfPage = pdf.addPage([300, 300]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    pdfPage.drawText("Teste PDF real", {
      x: 40,
      y: 240,
      size: 14,
      font,
    });

    const pdfBytes = await pdf.save();
    const pages = await parsePdfToPages(new Uint8Array(pdfBytes).buffer);

    expect(pages).toHaveLength(1);
    expect(pages[0].lines.map((item) => item.text).join(" ")).toContain("Teste PDF real");
  });
});

describe("pdf-to-epub noise removal", () => {
  it("removes repeated headers and page numbers without removing body text", () => {
    const pages = [
      page(1, [line("Book Header", 220, 24, 1), line("Body text one", 80, 160, 1), line("1", 300, 760, 1)]),
      page(2, [line("Book Header", 220, 24, 2), line("Body text two", 80, 160, 2), line("2", 300, 760, 2)]),
      page(3, [line("Book Header", 220, 24, 3), line("Body text three", 80, 160, 3), line("3", 300, 760, 3)]),
    ];
    const stats = computeDocumentStats(pages);
    const cleaned = removeNoiseLines(pages, stats);
    const text = cleaned.flatMap((item) => item.lines.map((itemLine) => itemLine.text));

    expect(text).toEqual(["Body text one", "Body text two", "Body text three"]);
  });
});

describe("pdf-to-epub reading order", () => {
  it("reads a two-column page down the left column before the right column", () => {
    const source = page(1, [
      line("Left column line 1", 60, 120, 1, 180),
      line("Right column line 1", 340, 120, 1, 180),
      line("Left column line 2", 60, 145, 1, 180),
      line("Right column line 2", 340, 145, 1, 180),
      line("Left column line 3", 60, 170, 1, 180),
      line("Right column line 3", 340, 170, 1, 180),
      line("Left column line 4", 60, 195, 1, 180),
      line("Right column line 4", 340, 195, 1, 180),
      line("Left column line 5", 60, 220, 1, 180),
      line("Right column line 5", 340, 220, 1, 180),
    ]);
    const stats = computeDocumentStats([source]);
    const [orderedPage] = applyReadingOrder([source], stats);

    expect(orderedPage.layout?.columnCount).toBe(2);
    expect(orderedPage.orderedLines.map((item) => item.text)).toEqual([
      "Left column line 1",
      "Left column line 2",
      "Left column line 3",
      "Left column line 4",
      "Left column line 5",
      "Right column line 1",
      "Right column line 2",
      "Right column line 3",
      "Right column line 4",
      "Right column line 5",
    ]);
  });

  it("keeps short dialogue-like lines inside their detected column", () => {
    const source = page(1, [
      line("Left column long line 1", 60, 120, 1, 180),
      line("- Sim.", 60, 145, 1, 48),
      line("Left column long line 2", 60, 170, 1, 180),
      line("Left column long line 3", 60, 195, 1, 180),
      line("Left column long line 4", 60, 220, 1, 180),
      line("Right column long line 1", 340, 120, 1, 180),
      line("Right column long line 2", 340, 145, 1, 180),
      line("Right column long line 3", 340, 170, 1, 180),
      line("Right column long line 4", 340, 195, 1, 180),
      line("Right column long line 5", 340, 220, 1, 180),
    ]);
    const stats = computeDocumentStats([source]);
    const [orderedPage] = applyReadingOrder([source], stats);

    expect(orderedPage.orderedLines.map((item) => item.text).slice(0, 5)).toEqual([
      "Left column long line 1",
      "- Sim.",
      "Left column long line 2",
      "Left column long line 3",
      "Left column long line 4",
    ]);
  });
});

describe("pdf-to-epub paragraph reconstruction", () => {
  it("joins continued lines, removes soft hyphenation, and splits indented paragraphs", () => {
    const lines = [
      line("This is a hyphen-", 60, 100, 1, 460),
      line("ated word in the same paragraph.", 60, 116, 1, 240),
      line("New paragraph starts here.", 84, 132, 1, 210),
    ];
    const stats = {
      ...computeDocumentStats([page(1, lines)]),
      bodyLeft: 60,
      bodyRight: 540,
      medianLineGap: 6,
    };
    const paragraphs = buildParagraphs(lines, stats);

    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0].text).toBe("This is a hyphenated word in the same paragraph.");
    expect(paragraphs[1].text).toBe("New paragraph starts here.");
  });

  it("does not merge separate dialogue lines into a single paragraph", () => {
    const lines = [
      line("- Voce vem?", 60, 100, 1, 120),
      line("- Agora nao.", 60, 116, 1, 120),
      line("Ele fechou a porta devagar.", 60, 132, 1, 210),
    ];
    const stats = {
      ...computeDocumentStats([page(1, lines)]),
      bodyLeft: 60,
      bodyRight: 540,
      medianLineGap: 6,
    };
    const paragraphs = buildParagraphs(lines, stats);

    expect(paragraphs.map((paragraph) => paragraph.text)).toEqual([
      "- Voce vem?",
      "- Agora nao.",
      "Ele fechou a porta devagar.",
    ]);
  });
});

describe("pdf-to-epub end-to-end structure", () => {
  it("classifies chapter headings and produces package files", async () => {
    const pages = [
      page(1, [
        createLine([{ ...token("Capitulo 1", 210, 80, 1, 100), fontSize: 18, height: 18, bold: true }]),
        line("A primeira linha do livro preenche a pagina.", 70, 150, 1, 380),
        line("A segunda linha continua o mesmo paragrafo.", 70, 166, 1, 360),
      ]),
    ];
    const structure = reconstructStructureFromPages(pages);

    expect(structure.sections[0].title).toBe("Capitulo 1");
    expect(structure.blocks[0].type).toBe("chapter");

    const epub = await packageEpub({
      metadata: {
        title: "Livro Teste",
        language: "pt-BR",
        identifier: "urn:test:book",
      },
      css: "body { line-height: 1.4; }",
      chapters: [
        {
          id: "chapter-001",
          href: "text/chapter-001.xhtml",
          title: "Capitulo 1",
          xhtml: '<html><body><h1>Capitulo 1</h1><figure><img src="../images/fig-1.jpg" /></figure></body></html>',
        },
      ],
      assets: [
        {
          href: "images/fig-1.jpg",
          mediaType: "image/jpeg",
          data: new Uint8Array([255, 216, 255, 217]),
        },
      ],
    });
    const zip = await JSZip.loadAsync(epub);

    expect(zip.file("mimetype")).toBeTruthy();
    expect(zip.file("META-INF/container.xml")).toBeTruthy();
    expect(zip.file("OEBPS/content.opf")).toBeTruthy();
    expect(zip.file("OEBPS/toc.xhtml")).toBeTruthy();
    expect(zip.file("OEBPS/text/chapter-001.xhtml")).toBeTruthy();
    expect(zip.file("OEBPS/images/fig-1.jpg")).toBeTruthy();
    expect(await zip.file("OEBPS/content.opf")?.async("text")).toContain("images/fig-1.jpg");
  });

  it("keeps a paragraph that crosses pages after the chapter heading that starts it", () => {
    const pages = [
      page(1, [
        createLine([{ ...token("Capitulo 2", 220, 80, 1, 100), fontSize: 18, height: 18, bold: true }]),
        line("Este paragrafo comeca no fim da primeira pagina", 70, 700, 1, 390),
      ]),
      page(2, [
        line("e termina no topo da segunda pagina.", 70, 80, 2, 290),
      ]),
    ];

    const structure = reconstructStructureFromPages(pages);

    expect(structure.blocks.map((block) => block.text)).toEqual([
      "Capitulo 2",
      "Este paragrafo comeca no fim da primeira pagina e termina no topo da segunda pagina.",
    ]);
    expect(structure.sections).toHaveLength(1);
    expect(structure.sections[0].title).toBe("Capitulo 2");
    expect(structure.sections[0].children.map((block) => block.text)).toEqual([
      "Capitulo 2",
      "Este paragrafo comeca no fim da primeira pagina e termina no topo da segunda pagina.",
    ]);
  });
});

describe("font size clustering", () => {
  it("identifies body font size as the most frequent size", () => {
    const tokens: Token[] = [];
    for (let i = 0; i < 50; i += 1) {
      tokens.push({
        text: "word", x: 40, y: 100 + i * 14, width: 30, height: 10,
        fontName: "Times-Roman", fontSize: 10, pageNumber: 1,
      });
    }
    for (let i = 0; i < 5; i += 1) {
      tokens.push({
        text: "Chapter Title", x: 200, y: 50 + i * 200, width: 100, height: 16,
        fontName: "Times-Bold", fontSize: 16, pageNumber: 1, bold: true,
      });
    }
    for (let i = 0; i < 3; i += 1) {
      tokens.push({
        text: "8", x: 550, y: 100 + i * 300, width: 6, height: 7,
        fontName: "Times-Roman", fontSize: 7, pageNumber: 1,
      });
    }

    const analysis = analyzeFontSizes(tokens);

    expect(analysis.bodyFontSize).toBeGreaterThanOrEqual(9);
    expect(analysis.bodyFontSize).toBeLessThanOrEqual(11.5);
    expect(analysis.clusters.some((c) => c.label === "body")).toBe(true);
    expect(analysis.headingThresholds.h1Min).toBeGreaterThan(10);
    expect(analysis.headingThresholds.h2Min).toBeGreaterThan(10);
  });

  it("falls back to median when histogram has no clear peaks", () => {
    const tokens: Token[] = [];
    for (let i = 0; i < 20; i += 1) {
      tokens.push({
        text: "text", x: 40, y: 100 + i * 14, width: 24, height: 12,
        fontName: "Arial", fontSize: 12, pageNumber: 1,
      });
    }

    const analysis = analyzeFontSizes(tokens);

    expect(analysis.bodyFontSize).toBeGreaterThanOrEqual(11.5);
    expect(analysis.bodyFontSize).toBeLessThanOrEqual(12.5);
    expect(analysis.clusters.length).toBeGreaterThan(0);
  });
});

describe("bold/italic visual detection", () => {
  it("detects bold tokens by wider char width ratio", () => {
    const regularTokens: Token[] = [];
    for (let i = 0; i < 20; i += 1) {
      regularTokens.push({
        text: "normal text line", x: 40, y: 100 + i * 14, width: 96, height: 10,
        fontName: "Times-Roman", fontSize: 10, pageNumber: 1,
      });
    }
    const boldTokens: Token[] = [];
    for (let i = 0; i < 5; i += 1) {
      boldTokens.push({
        text: "bold heading", x: 40, y: 50 + i * 200, width: 84, height: 10,
        fontName: "Times-Bold", fontSize: 10, pageNumber: 1,
      });
    }

    const analysis = analyzeFontSizes([...regularTokens, ...boldTokens]);

    expect(analysis.bodyFontSize).toBeGreaterThanOrEqual(9.5);
    expect(analysis.bodyFontSize).toBeLessThanOrEqual(10.5);
  });

  it("classifies italic tokens by skew factor in transform", () => {
    const italicToken: Token = {
      text: "italic", x: 40, y: 100, width: 42, height: 10,
      fontName: "Times-Italic", fontSize: 10, pageNumber: 1,
      rawTransform: [0.8, 0.2, 0, 1, 40, 100],
    };

    expect(italicToken.rawTransform![1]).toBe(0.2);
  });
});

describe("TOC detection", () => {
  it("splits TOC entries into separate paragraphs", () => {
    const lines = [
      createLine([{ ...token("1.1 Fundamental principles", 60, 100, 1, 320), fontSize: 10 }]),
      createLine([{ ...token("1.2 Definition of an inertial observer", 60, 116, 1, 350), fontSize: 10 }]),
      createLine([{ ...token("1.3 New units", 60, 132, 1, 180), fontSize: 10 }]),
      createLine([{ ...token("1.4 Spacetime diagrams", 60, 148, 1, 240), fontSize: 10 }]),
      createLine([{ ...token("Body text starts here after the TOC page.", 70, 200, 1, 400), fontSize: 10 }]),
    ];

    const stats = {
      ...computeDocumentStats([page(1, lines)]),
      bodyLeft: 60,
      bodyRight: 480,
      medianLineGap: 6,
    };
    const paragraphs = buildParagraphs(lines, stats);

    expect(paragraphs.length).toBeGreaterThanOrEqual(2);
  });

  it("classifies TOC entries with page number patterns", () => {
    const tocParagraph: Paragraph = {
      lines: [createLine([token("1.1 Fundamentals.....25", 60, 100, 1, 350)])],
      text: "1.1 Fundamentals.....25",
      bbox: { x0: 60, y0: 100, x1: 350, y1: 110, width: 290, height: 10 },
      indentation: 0,
      avgLineGap: 0,
      pageStart: 1,
      pageEnd: 1,
      style: { avgFontSize: 10, dominantFontName: "Times-Roman", boldRatio: 0, italicRatio: 0 },
    };

    const stats = {
      bodyFontSize: 10,
      medianLineGap: 4,
      bodyLeft: 60,
      bodyRight: 480,
      pageWidth: 600,
      pageHeight: 800,
    };

    const block = paragraphToBlock(tocParagraph, stats);

    expect(block.type).toBe("tocEntry");
  });
});

describe("hyphenation handling", () => {
  it("removes hyphen at end of full-width line", () => {
    const lines = [
      createLine([{ ...token("The quick brown fox jumps over-", 60, 100, 1, 440), fontSize: 10 }]),
      createLine([{ ...token("the lazy dog continues here.", 60, 116, 1, 240), fontSize: 10 }]),
    ];

    const stats = {
      ...computeDocumentStats([page(1, lines)]),
      bodyLeft: 60,
      bodyRight: 500,
      medianLineGap: 6,
    };
    const paragraphs = buildParagraphs(lines, stats);

    expect(paragraphs).toHaveLength(1);
    expect(paragraphs[0].text).toContain("overthe");
  });
});

describe("real PDF with multiple font sizes", async () => {
  it("handles a PDF with headings, body text, and TOC-like content", async () => {
    const pdf = await PDFDocument.create();
    const page1 = pdf.addPage([612, 792]);
    const fontRegular = await pdf.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

    page1.drawText("Capitulo 1 Introducao", {
      x: 180, y: 720, size: 18, font: fontBold,
    });

    page1.drawText("1.1 Primeiros conceitos", { x: 72, y: 680, size: 14, font: fontBold });
    page1.drawText("1.2 Definicoes formais", { x: 72, y: 660, size: 14, font: fontBold });
    page1.drawText("1.3 Exemplos praticos", { x: 72, y: 640, size: 14, font: fontBold });
    page1.drawText("1.4 Exercicios", { x: 72, y: 620, size: 14, font: fontBold });

    const bodyText = "Este e o corpo principal do texto. Ele contem varias linhas ".repeat(3);
    let y = 580;
    const words = bodyText.split(" ");
    let lineText = "";
    for (const word of words) {
      if ((lineText + word).length > 80) {
        page1.drawText(lineText.trim(), { x: 72, y, size: 11, font: fontRegular });
        y -= 14;
        lineText = word + " ";
      } else {
        lineText += word + " ";
      }
    }
    if (lineText.trim()) {
      page1.drawText(lineText.trim(), { x: 72, y, size: 11, font: fontRegular });
    }

    const pdfBytes = await pdf.save();
    const pages = await parsePdfToPages(new Uint8Array(pdfBytes).buffer);

    expect(pages).toHaveLength(1);
    expect(pages[0].lines.length).toBeGreaterThan(3);

    const structure = reconstructStructureFromPages(pages);
    expect(structure.sections.length).toBeGreaterThan(0);
  });
});
