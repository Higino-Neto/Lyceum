import type { ConversionOptions } from "../../contexts/ConversionQueueContext";

export type PdfLayoutPresetId = "screen" | "ereader" | "paperback" | "print" | "large";

export type PdfLayoutValues = Pick<
  ConversionOptions,
  | "pdfPageSize"
  | "pdfMarginTopMm"
  | "pdfMarginBottomMm"
  | "pdfMarginLeftMm"
  | "pdfMarginRightMm"
  | "pdfFontSizePt"
  | "pdfLineHeight"
  | "pdfParagraphSpacingEm"
>;

/**
 * Typographic presets for EPUB → PDF, based on common book conventions:
 * - screen: the app defaults, comfortable on a monitor (A4).
 * - ereader: A5 with thin margins and larger type, for 6–7" e-ink screens.
 * - paperback: pocket/trade book proportions (A5, ~10.5 pt, generous gutters).
 * - print: academic print layout (ABNT NBR 14724: 3 cm top/left, 2 cm
 *   bottom/right, 12 pt, 1.5 line spacing).
 * - large: accessible large print (14 pt, airy spacing).
 */
export const PDF_LAYOUT_PRESETS: Record<PdfLayoutPresetId, PdfLayoutValues> = {
  screen: {
    pdfPageSize: "A4",
    pdfMarginTopMm: 16,
    pdfMarginBottomMm: 18,
    pdfMarginLeftMm: 15,
    pdfMarginRightMm: 15,
    pdfFontSizePt: 11,
    pdfLineHeight: 1.45,
    pdfParagraphSpacingEm: 0.85,
  },
  ereader: {
    pdfPageSize: "A5",
    pdfMarginTopMm: 6,
    pdfMarginBottomMm: 8,
    pdfMarginLeftMm: 6,
    pdfMarginRightMm: 6,
    pdfFontSizePt: 12,
    pdfLineHeight: 1.4,
    pdfParagraphSpacingEm: 0.6,
  },
  paperback: {
    pdfPageSize: "A5",
    pdfMarginTopMm: 18,
    pdfMarginBottomMm: 20,
    pdfMarginLeftMm: 17,
    pdfMarginRightMm: 14,
    pdfFontSizePt: 10.5,
    pdfLineHeight: 1.4,
    pdfParagraphSpacingEm: 0.45,
  },
  print: {
    pdfPageSize: "A4",
    pdfMarginTopMm: 30,
    pdfMarginBottomMm: 20,
    pdfMarginLeftMm: 30,
    pdfMarginRightMm: 20,
    pdfFontSizePt: 12,
    pdfLineHeight: 1.5,
    pdfParagraphSpacingEm: 0.5,
  },
  large: {
    pdfPageSize: "A4",
    pdfMarginTopMm: 20,
    pdfMarginBottomMm: 22,
    pdfMarginLeftMm: 20,
    pdfMarginRightMm: 20,
    pdfFontSizePt: 14,
    pdfLineHeight: 1.6,
    pdfParagraphSpacingEm: 0.9,
  },
};

export const PDF_LAYOUT_PRESET_IDS = Object.keys(PDF_LAYOUT_PRESETS) as PdfLayoutPresetId[];

/** The preset whose values all match the options, or `null` for a custom layout. */
export function matchPdfLayoutPreset(options: PdfLayoutValues): PdfLayoutPresetId | null {
  for (const id of PDF_LAYOUT_PRESET_IDS) {
    const preset = PDF_LAYOUT_PRESETS[id];
    const matches = (Object.keys(preset) as Array<keyof PdfLayoutValues>).every((key) => (
      typeof preset[key] === "number"
        ? Math.abs((options[key] as number) - (preset[key] as number)) < 1e-6
        : options[key] === preset[key]
    ));
    if (matches) return id;
  }
  return null;
}
