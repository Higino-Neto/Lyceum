import { describe, expect, it } from "vitest";
import { defaultConversionOptions } from "../contexts/ConversionQueueContext";
import { PDF_LAYOUT_PRESETS, matchPdfLayoutPreset } from "../pages/Conversion/pdfLayoutPresets";

describe("PDF layout presets", () => {
  it("recognizes the default options as the screen preset", () => {
    expect(matchPdfLayoutPreset(defaultConversionOptions)).toBe("screen");
  });

  it("reports a custom layout once a value is changed", () => {
    expect(matchPdfLayoutPreset({ ...PDF_LAYOUT_PRESETS.print })).toBe("print");
    expect(matchPdfLayoutPreset({ ...PDF_LAYOUT_PRESETS.print, pdfFontSizePt: 13 })).toBeNull();
  });
});
