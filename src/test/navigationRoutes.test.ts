import { describe, expect, it } from "vitest";
import { getDefaultHotkeyBindings, getEnabledNavigationRoutes } from "../navigation/routes";

describe("navigation hotkeys", () => {
  it("keeps the natural numeric order in sync with enabled beta routes", () => {
    const settings = {
      betaAtlasEnabled: false,
      betaConversionEnabled: true,
      betaHabitsEnabled: true,
    };
    expect(getEnabledNavigationRoutes(settings).map((route) => route.id)).toEqual([
      "dashboard", "register", "library", "reader", "conversion", "habits",
    ]);
    expect(getDefaultHotkeyBindings(settings)).toMatchObject({
      dashboard: "1",
      register: "2",
      library: "3",
      reader: "4",
      conversion: "5",
      habits: "6",
    });
  });
});
