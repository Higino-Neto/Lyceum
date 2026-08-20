import type { ConvertViaLyceumResult } from "./convert";

const LOSS_PATTERN = /\b(?:ausente|ignorado|omitid|removid|fallback|nao encontrado|nao foi|incompativel|ocr|pouco texto|indisponivel)\b/i;

export function buildConversionQualityReport(result: ConvertViaLyceumResult) {
  const warnings = [...new Set([...result.importReport.warnings, ...result.exportReport.warnings])];
  const losses = warnings.filter((warning) => LOSS_PATTERN.test(warning));
  const stats = { ...result.importReport.stats, ...result.exportReport.stats };
  const outputValidated = Boolean(
    stats.validatedXhtmlCount
    || stats.hasExth
    || stats.renderer === "chromium"
    || stats.imageCount === stats.pageCount,
  );

  return {
    status: losses.length ? "completed-with-fallbacks" : "validated",
    packageValidated: stats.packageValidated === true,
    outputValidated,
    fidelityMode: String(stats.fidelityMode || stats.renderer || "semantic"),
    warnings,
    losses,
  };
}

export function flattenConversionStats(result: ConvertViaLyceumResult) {
  return {
    ...result.importReport.stats,
    ...result.exportReport.stats,
    warnings: [...new Set([...result.importReport.warnings, ...result.exportReport.warnings])],
    quality: buildConversionQualityReport(result),
  };
}
