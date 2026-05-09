import type {
  LyceumTextualChapter,
  LyceumTextualContent,
  LyceumTocItem,
} from "./schema/types";

const ENTITY_MAP: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: "\"",
  apos: "'",
};

export function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function decodeHtmlEntities(value: string) {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([a-f0-9]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&([a-z][a-z0-9]+);/gi, (match, entity) => ENTITY_MAP[entity.toLowerCase()] ?? match);
}

export function stripHtml(value: string) {
  return decodeHtmlEntities(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractBodyHtml(value: string) {
  return value.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? value;
}

export function wrapTextAsXhtml(title: string, paragraphs: string[]) {
  const body = paragraphs
    .filter(Boolean)
    .map((paragraph) => `    <p>${escapeXml(paragraph)}</p>`)
    .join("\n");

  return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <title>${escapeXml(title)}</title>
</head>
<body>
  <h1>${escapeXml(title)}</h1>
${body}
</body>
</html>`;
}

export function buildTextualContent(chapters: LyceumTextualChapter[]): LyceumTextualContent {
  const spine = chapters.map((chapter) => ({
    id: chapter.id,
    href: chapter.href,
    title: chapter.title,
  }));
  const toc: LyceumTocItem[] = spine.map((item) => ({
    ...item,
    level: 1,
  }));
  const fulltext = chapters
    .map((chapter) => stripHtml(chapter.xhtml))
    .filter(Boolean)
    .join("\n\n");

  return {
    chapters,
    spine,
    toc,
    fulltext,
  };
}

