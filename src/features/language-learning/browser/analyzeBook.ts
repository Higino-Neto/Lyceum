import { analyzeDocument, type ChapterInput } from "../../../core/language-learning/analysis/analyzeDocument";
import type { LinguisticDocument } from "../../../core/language-learning/model";
import { getLanguageModule } from "../../../core/language-learning/languages/registry";
import { extractBlocksFromXhtml } from "../../../lib/lyceum/linguistic/blocks";
import { chooseDocumentLanguage } from "../../../lib/lyceum/linguistic/language";
import type { RawBook } from "./sourceChapters";

export interface AnalyzeBookRequest {
  documentId: string;
  book: RawBook;
  language?: string | null;
}

export interface AnalyzeBookResult {
  document: LinguisticDocument;
  metadataLanguage: string | null;
  detectedLanguage: string | null;
}

/** Block extraction, language choice and analysis; the same pipeline as desktop's `prepareLearningDocument`. */
export function analyzeBook(request: AnalyzeBookRequest, onProgress?: (value: number) => void): AnalyzeBookResult {
  const chapters: ChapterInput[] = request.book.chapters
    .map((chapter) => ({ id: chapter.id, href: chapter.href, title: chapter.title, blocks: extractBlocksFromXhtml(chapter.xhtml) }))
    .filter((chapter) => chapter.blocks.length > 0);
  if (chapters.length === 0) throw new Error("NO_TEXTUAL_CONTENT");
  const choice = chooseDocumentLanguage(chapters, request.book.metadataLanguage, request.language);
  const module = getLanguageModule(choice.language);
  const document = analyzeDocument(
    { documentId: request.documentId, title: request.book.title, language: module.code, chapters },
    module,
    { onProgress },
  );
  return { document, metadataLanguage: choice.metadataLanguage, detectedLanguage: choice.detectedLanguage };
}

/** True when a cached document was produced by the analyzer that would run now. */
export function isCurrentAnalysis(document: LinguisticDocument, language: string) {
  const module = getLanguageModule(language);
  return document.language === module.code
    && document.analyzer.module === module.id
    && document.analyzer.moduleVersion === module.version;
}
