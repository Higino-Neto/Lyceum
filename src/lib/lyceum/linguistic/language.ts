import type { ChapterInput } from "../../../core/language-learning/analysis/analyzeDocument";
import { detectLanguage } from "../../../core/language-learning/languages/detect";
import { normalizeLanguageCode } from "../../../core/language-learning/languages/registry";

/** Text sample for language detection (shared by desktop and the WebView builds). */
export function sampleText(chapters: ChapterInput[], limit = 60_000) {
  const parts: string[] = [];
  let length = 0;
  // Skip the first chapter when possible: front matter is often in another language.
  const ordered = chapters.length > 2 ? [...chapters.slice(1), chapters[0]!] : chapters;
  for (const chapter of ordered) {
    for (const block of chapter.blocks) {
      parts.push(block.text);
      length += block.text.length;
      if (length >= limit) return parts.join("\n");
    }
  }
  return parts.join("\n");
}

export interface DocumentLanguageChoice {
  language: string;
  metadataLanguage: string | null;
  detectedLanguage: string | null;
}

/**
 * Text evidence beats metadata: imports default a missing language, and a
 * wrong label would file the reader's vocabulary under the wrong language.
 * An explicit user override beats both.
 */
export function chooseDocumentLanguage(chapters: ChapterInput[], metadata: string | null | undefined, override?: string | null): DocumentLanguageChoice {
  const metadataLanguage = metadata ? normalizeLanguageCode(metadata) : null;
  const detectedLanguage = detectLanguage(sampleText(chapters))?.language ?? null;
  return {
    language: normalizeLanguageCode(override || detectedLanguage || metadataLanguage || "und"),
    metadataLanguage,
    detectedLanguage,
  };
}
