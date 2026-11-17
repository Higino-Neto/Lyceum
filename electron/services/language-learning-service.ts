import fs from "node:fs";
import path from "node:path";
import type { BookFormat } from "../../src/lib/lyceum/schema/types";
import type { LinguisticDocument } from "../../src/core/language-learning/model";
import type { OpenLearningDocumentInput, OpenLearningDocumentResult } from "../handlers/language-learning.handler";
import { prepareLearningDocumentInWorker } from "../workers/processingClient";

const SUPPORTED: Record<string, BookFormat> = {
  ".epub": "epub",
  ".txt": "txt",
  ".html": "html",
  ".htm": "html",
  ".pdf": "pdf",
  ".lyceum": "lyceum",
};

export function learningSourceFormat(filePath: string): BookFormat | null {
  const lower = filePath.toLowerCase().replace(/[\\/]+$/, "");
  if (lower.endsWith(".kepub.epub")) return "epub";
  return SUPPORTED[path.extname(lower)] ?? null;
}

export function canOpenForLearning(filePath: string) {
  return learningSourceFormat(filePath) !== null;
}

export interface LanguageLearningServiceOptions {
  cacheRoot: string;
  emitProgress?: (payload: { fileHash: string; progress: number; stage: string }) => void;
}

/**
 * Prepares (imports + analyzes, once) a book for the language-learning
 * reader and returns its linguistic document. Heavy work runs in the
 * processing worker; the result is cached under `cacheRoot`.
 */
export function createLanguageLearningService(options: LanguageLearningServiceOptions) {
  return {
    async openDocument(input: OpenLearningDocumentInput): Promise<OpenLearningDocumentResult> {
      const sourceFormat = learningSourceFormat(input.filePath);
      if (!sourceFormat) throw new Error("UNSUPPORTED_FORMAT");
      if (!fs.existsSync(input.filePath)) throw new Error("FILE_NOT_FOUND");

      const prepared = await prepareLearningDocumentInWorker(
        {
          sourcePath: input.filePath,
          sourceFormat,
          cacheRoot: options.cacheRoot,
          cacheKey: input.fileHash,
          language: input.language,
          force: input.force,
        },
        {
          onProgress: (progress, stage) => options.emitProgress?.({ fileHash: input.fileHash, progress, stage: stage ?? "" }),
        },
      );

      const document = JSON.parse(await fs.promises.readFile(prepared.indexPath, "utf8")) as LinguisticDocument;
      return {
        document,
        packageRoot: prepared.packageRoot,
        language: prepared.language,
        metadataLanguage: prepared.metadataLanguage,
        detectedLanguage: prepared.detectedLanguage ?? null,
        reused: prepared.reused,
      };
    },
  };
}

export { translateWithMyMemory } from "../../src/features/language-learning/myMemory";
