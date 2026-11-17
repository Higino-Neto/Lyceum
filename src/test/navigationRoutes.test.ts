import { describe, expect, it } from "vitest";
import { getDefaultHotkeyBindings, getEnabledNavigationRoutes } from "../navigation/routes";

describe("navigation hotkeys", () => {
  it("keeps the natural numeric order in sync with enabled beta routes", () => {
    const settings = { betaConversionEnabled: true };
    expect(getEnabledNavigationRoutes(settings).map((route) => route.id)).toEqual([
      "dashboard", "library", "reader", "conversion", "pdfBuilder",
    ]);
    expect(getDefaultHotkeyBindings(settings)).toMatchObject({
      dashboard: "1",
      library: "2",
      reader: "3",
      conversion: "4",
      pdfBuilder: "5",
    });
  });

  it("renumbers routes when a beta feature is disabled", () => {
    const settings = { betaConversionEnabled: false };
    expect(getDefaultHotkeyBindings(settings)).toEqual({
      dashboard: "1",
      library: "2",
      reader: "3",
    });
  });
});
