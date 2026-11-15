import fs from "node:fs";
import path from "node:path";
import {
  LINGUISTIC_SCHEMA,
  LINGUISTIC_SCHEMA_VERSION,
  type LinguisticDocument,
} from "../../../core/language-learning/model";

/**
 * `.lyceum` format extension (schema "lyceum.linguistic", version 1):
 *
 *   indexes/linguistic/document.json   LinguisticDocument (structure, tokens,
 *                                      lexicon, forms, expressions, stats)
 *
 * The index is document data only. User knowledge, reviews, annotations and
 * progress are never written into the package.
 */
export const LINGUISTIC_INDEX_RELATIVE_PATH = path.join("indexes", "linguistic", "document.json");

export function packageLinguisticIndexPath(packageRoot: string) {
  return path.join(packageRoot, LINGUISTIC_INDEX_RELATIVE_PATH);
}

export interface LinguisticIndexHeader {
  schema: string;
  schemaVersion: number;
  language: string;
  module: string;
  moduleVersion: number;
}

export function isCompatibleIndex(
  header: LinguisticIndexHeader | null,
  expected: { language: string; module: string; moduleVersion: number },
) {
  return Boolean(
    header
    && header.schema === LINGUISTIC_SCHEMA
    && header.schemaVersion === LINGUISTIC_SCHEMA_VERSION
    && header.language === expected.language
    && header.module === expected.module
    && header.moduleVersion === expected.moduleVersion,
  );
}

export async function readLinguisticIndex(indexPath: string): Promise<LinguisticDocument | null> {
  try {
    const raw = await fs.promises.readFile(indexPath, "utf8");
    const parsed = JSON.parse(raw) as LinguisticDocument;
    if (parsed?.schema !== LINGUISTIC_SCHEMA || !Array.isArray(parsed.chapters)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function readLinguisticIndexHeader(indexPath: string): Promise<LinguisticIndexHeader | null> {
  const document = await readLinguisticIndex(indexPath);
  if (!document) return null;
  return {
    schema: document.schema,
    schemaVersion: document.schemaVersion,
    language: document.language,
    module: document.analyzer.module,
    moduleVersion: document.analyzer.moduleVersion,
  };
}

/** Atomic write so a crashed analysis never leaves a truncated index. */
export async function writeLinguisticIndex(indexPath: string, document: LinguisticDocument) {
  await fs.promises.mkdir(path.dirname(indexPath), { recursive: true });
  const tempPath = `${indexPath}.${process.pid}.tmp`;
  await fs.promises.writeFile(tempPath, JSON.stringify(document), "utf8");
  await fs.promises.rename(tempPath, indexPath);
}
