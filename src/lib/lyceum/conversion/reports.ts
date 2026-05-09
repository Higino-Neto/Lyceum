import type { ConvertViaLyceumResult } from "./convert";

export function flattenConversionStats(result: ConvertViaLyceumResult) {
  return {
    ...result.importReport.stats,
    ...result.exportReport.stats,
    warnings: [
      ...result.importReport.warnings,
      ...result.exportReport.warnings,
    ],
  };
}

