import { escapeXml } from "./text";
import type { Block, Paragraph, Section } from "./types";

function isParagraph(value: Block | Paragraph): value is Paragraph {
  return "lines" in value;
}

function paragraphText(block: Block) {
  const paragraph = block.children.find(isParagraph);
  return paragraph?.text || block.text || "";
}

function renderParagraph(paragraph: Paragraph, className?: string) {
  const classAttr = className ? ` class="${className}"` : "";
  return `<p${classAttr}>${escapeXml(paragraph.text)}</p>`;
}

function renderBlock(block: Block, index: number): string {
  const paragraph = block.children.find(isParagraph);
  const text = paragraphText(block);

  switch (block.type) {
    case "chapter":
      return `<h1 id="chapter-${index}">${escapeXml(text)}</h1>`;
    case "title":
      return `<h1 id="title-${index}">${escapeXml(text)}</h1>`;
    case "subtitle":
      return `<h2 id="subtitle-${index}">${escapeXml(text)}</h2>`;
    case "tocEntry": {
      const cleanText = text.replace(/[\s·]{2,}\d+\s*$/, "");
      return `<p class="toc-entry">${escapeXml(cleanText)}</p>`;
    }
    case "blockquote":
      return `<blockquote>${paragraph ? renderParagraph(paragraph, "no-indent") : `<p>${escapeXml(text)}</p>`}</blockquote>`;
    case "footnote":
      return `<aside epub:type="footnote" id="fn-${index}"><p>${escapeXml(text)}</p></aside>`;
    case "list": {
      const ordered = block.children.some((child) => {
        const childText = isParagraph(child) ? child.text : child.text || "";
        return /^\s*\d+[\.)]/.test(childText);
      });
      const tag = ordered ? "ol" : "ul";
      const items = block.children
        .map((child) => {
          const childText = isParagraph(child) ? child.text : child.text || "";
          const clean = childText.replace(/^\s*(?:[-*•]|\d+[\.)]|[A-Za-z][\.)]|[ivxlcdm]+[\.)])\s+/i, "");
          return `<li>${escapeXml(clean)}</li>`;
        })
        .join("\n");
      return `<${tag}>\n${items}\n</${tag}>`;
    }
    case "image":
      return `<figure><img src="${escapeXml(String(block.attrs?.src || ""))}" alt="${escapeXml(text)}" />${text ? `<figcaption>${escapeXml(text)}</figcaption>` : ""}</figure>`;
    case "table":
    case "formula":
      return `<figure class="${block.type}">${text ? `<figcaption>${escapeXml(text)}</figcaption>` : ""}</figure>`;
    case "paragraph":
    default:
      return paragraph ? renderParagraph(paragraph) : `<p>${escapeXml(text)}</p>`;
  }
}

export function renderSectionToXhtml(section: Section, index: number) {
  const body = section.children
    .map((block, blockIndex) => renderBlock(block, index * 10000 + blockIndex))
    .join("\n\n");

  return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>${escapeXml(section.title || `Secao ${index + 1}`)}</title>
  <link rel="stylesheet" type="text/css" href="../styles/book.css" />
</head>
<body>
<section epub:type="${section.level === 1 ? "chapter" : "section"}">
${body}
</section>
</body>
</html>`;
}

export function renderDefaultCss() {
  return `body {
  font-family: serif;
  line-height: 1.35;
  margin: 0;
}

p {
  margin: 0 0 0.9em 0;
  text-indent: 1.2em;
}

p.no-indent,
blockquote p,
li p {
  text-indent: 0;
}

p.toc-entry {
  text-indent: 0;
  margin: 0.25em 0;
  font-size: 0.95em;
  line-height: 1.4;
}

h1,
h2,
h3 {
  line-height: 1.2;
  margin: 1.6em 0 0.8em;
}

blockquote {
  margin: 1em 1.5em;
}

figure {
  margin: 1em 0;
  text-align: center;
}

img {
  max-width: 100%;
  height: auto;
}`;
}
