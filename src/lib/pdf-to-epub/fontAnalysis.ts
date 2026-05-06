import type { Token } from "./types";

export interface FontGroupStats {
  fontName: string;
  baseName: string;
  avgNormalizedWidth: number;
  avgSkewFactor: number;
  avgHeightRatio: number;
  tokenCount: number;
  boldCandidate: boolean;
  italicCandidate: boolean;
  widthConfidence: number;
  skewConfidence: number;
}

export interface FontProfile {
  groups: Map<string, FontGroupStats>;
  families: Map<string, FontGroupStats[]>;
}

export interface StyleClassification {
  bold: boolean;
  italic: boolean;
  boldConfidence: number;
  italicConfidence: number;
}

function extractFontBaseName(fontName: string): string {
  const plusIndex = fontName.indexOf("+");
  const base = plusIndex >= 0 ? fontName.slice(plusIndex + 1) : fontName;
  return base
    .replace(/\b(bold|black|heavy|semibold|demi|extra)\b/gi, "")
    .replace(/\b(italic|oblique)\b/gi, "")
    .replace(/[-_]/g, "")
    .trim()
    .toLowerCase();
}

function inferStyleFromName(fontName: string) {
  const name = fontName.toLowerCase();
  return {
    bold: /\b(bold|black|heavy|semibold|demi)\b/.test(name),
    italic: /\b(italic|oblique)\b/.test(name),
  };
}

export function buildFontProfile(tokens: Token[]): FontProfile {
  const groupAccum = new Map<string, {
    totalWidth: number;
    totalChars: number;
    totalSkew: number;
    totalHeightRatio: number;
    count: number;
    rawName: string;
  }>();

  for (const token of tokens) {
    if (token.text.length === 0 || token.fontSize <= 0) continue;

    const baseName = extractFontBaseName(token.fontName);
    const entry = groupAccum.get(baseName);
    const charCount = Math.max(1, token.text.replace(/\s/g, "").length);
    const normalizedWidth = token.width / (charCount * token.fontSize);
    const skewFactor = token.rawTransform ? Math.abs(token.rawTransform[1] || 0) : 0;
    const heightRatio = token.height / token.fontSize;

    if (entry) {
      entry.totalWidth += normalizedWidth * charCount;
      entry.totalChars += charCount;
      entry.totalSkew += skewFactor * charCount;
      entry.totalHeightRatio += heightRatio * charCount;
      entry.count += charCount;
    } else {
      groupAccum.set(baseName, {
        totalWidth: normalizedWidth * charCount,
        totalChars: charCount,
        totalSkew: skewFactor * charCount,
        totalHeightRatio: heightRatio * charCount,
        count: charCount,
        rawName: token.fontName,
      });
    }
  }

  const groups = new Map<string, FontGroupStats>();
  const families = new Map<string, FontGroupStats[]>();

  const allStats: FontGroupStats[] = [];

  for (const [baseName, acc] of groupAccum) {
    const stats: FontGroupStats = {
      fontName: acc.rawName,
      baseName,
      avgNormalizedWidth: acc.totalWidth / acc.totalChars,
      avgSkewFactor: acc.totalSkew / acc.totalChars,
      avgHeightRatio: acc.totalHeightRatio / acc.totalChars,
      tokenCount: acc.count,
      boldCandidate: false,
      italicCandidate: false,
      widthConfidence: 0,
      skewConfidence: 0,
    };
    groups.set(baseName, stats);
    allStats.push(stats);

    const familyKey = baseName.replace(/psmt$|mt$|regular$/i, "");
    const family = families.get(familyKey) || [];
    family.push(stats);
    families.set(familyKey, family);
  }

  const baselineWidth = allStats.length
    ? Math.min(...allStats.map((s) => s.avgNormalizedWidth))
    : 0;

  for (const stats of allStats) {
    const nameStyle = inferStyleFromName(stats.fontName);

    if (baselineWidth > 0) {
      const widthRatio = stats.avgNormalizedWidth / baselineWidth;
      const excessWidth = widthRatio - 1;

      if (excessWidth > 0.08) {
        stats.boldCandidate = true;
        stats.widthConfidence = Math.min(1, excessWidth / 0.3);
      }
    }

    if (stats.avgSkewFactor > 0.03) {
      stats.italicCandidate = true;
      stats.skewConfidence = Math.min(1, (stats.avgSkewFactor - 0.03) / 0.15);
    }

    if (nameStyle.bold && !stats.boldCandidate) {
      stats.boldCandidate = true;
      stats.widthConfidence = Math.max(stats.widthConfidence, 0.7);
    }

    if (nameStyle.italic && !stats.italicCandidate) {
      stats.italicCandidate = true;
      stats.skewConfidence = Math.max(stats.skewConfidence, 0.7);
    }

    for (const other of allStats) {
      if (other === stats) continue;
      const sameFamily = other.baseName === stats.baseName.replace(/bold|italic/gi, "");
      if (sameFamily && other.avgNormalizedWidth < stats.avgNormalizedWidth) {
        stats.boldCandidate = true;
        const diff = (stats.avgNormalizedWidth - other.avgNormalizedWidth) / other.avgNormalizedWidth;
        stats.widthConfidence = Math.min(1, diff / 0.2);
      }
    }
  }

  return { groups, families };
}

export function classifyTokenStyle(token: Token, profile: FontProfile): StyleClassification {
  const baseName = extractFontBaseName(token.fontName);
  const group = profile.groups.get(baseName);

  if (!group) {
    const nameStyle = inferStyleFromName(token.fontName);
    return {
      bold: nameStyle.bold,
      italic: nameStyle.italic,
      boldConfidence: nameStyle.bold ? 0.7 : 0,
      italicConfidence: nameStyle.italic ? 0.7 : 0,
    };
  }

  let boldConfidence = group.boldCandidate ? Math.max(0.5, group.widthConfidence) : 0;
  let italicConfidence = group.italicCandidate ? Math.max(0.5, group.skewConfidence) : 0;

  if (token.rawTransform) {
    const explicitSkew = Math.abs(token.rawTransform[1] || 0);
    if (explicitSkew > 0.05 && italicConfidence < 0.3) {
      italicConfidence = Math.min(1, explicitSkew / 0.3);
    }
  }

  return {
    bold: boldConfidence >= 0.45,
    italic: italicConfidence >= 0.45,
    boldConfidence,
    italicConfidence,
  };
}
