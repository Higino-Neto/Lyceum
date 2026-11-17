/**
 * Book formats that can be read in .lyceum (language-learning) mode. Every
 * one of them has a textual importer in the conversion registry; comics
 * (CBZ/CBR) and KFX carry no extractable text and are left out.
 */
export const LEARNING_SOURCE_FORMATS = [
  "epub",
  "txt",
  "html",
  "pdf",
  "lyceum",
  "mobi",
  "azw",
  "azw3",
  "prc",
  "fb2",
  "docx",
] as const;

export type LearningSourceFormat = (typeof LEARNING_SOURCE_FORMATS)[number];

const FORMATS = new Set<string>(LEARNING_SOURCE_FORMATS);

const EXTENSION_ALIASES: Record<string, LearningSourceFormat> = {
  htm: "html",
  xhtml: "html",
};

export function isLearningSourceFormat(fileType: string | null | undefined): fileType is LearningSourceFormat {
  return typeof fileType === "string" && FORMATS.has(fileType.toLowerCase());
}

/** Learning format of a file path (by extension), or null when it cannot be read in .lyceum mode. */
export function learningFormatOfPath(filePath: string): LearningSourceFormat | null {
  const lower = filePath.toLowerCase().replace(/[\\/]+$/, "");
  if (lower.endsWith(".kepub.epub")) return "epub";
  const extension = lower.match(/\.([a-z0-9]+)$/)?.[1] ?? "";
  const format = EXTENSION_ALIASES[extension] ?? extension;
  return isLearningSourceFormat(format) ? format : null;
}
